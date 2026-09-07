import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Camera, 
  X, 
  Loader2, 
  Sparkles, 
  RefreshCw, 
  CheckCircle2, 
  Flashlight, 
  SwitchCamera,
  ScanLine
} from 'lucide-react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { procesar_imagen_serial, type ResultadoExtraccionSerial } from '../../utils/extractor_serial';
import './LectorSerialCamara.css';

interface PropiedadesLectorSerial {
  serial_actual: string;
  al_detectar_serial: (serial: string, archivo_foto?: File, url_foto?: string) => void;
  al_cambiar_foto?: (archivo_foto: File | null) => void;
}

// Configuración de lector ZXing en vivo
const pistas_en_vivo = new Map();
pistas_en_vivo.set(DecodeHintType.POSSIBLE_FORMATS, [
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.CODE_93,
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.QR_CODE,
  BarcodeFormat.DATA_MATRIX,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.ITF,
  BarcodeFormat.CODABAR
]);
pistas_en_vivo.set(DecodeHintType.TRY_HARDER, true);

const lector_zxing_vivo = new BrowserMultiFormatReader(pistas_en_vivo);

/**
 * Emite un sonido de confirmación positivo (Beep) al detectar un código
 */
function emitir_sonido_escaneo() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      const contexto = new AudioCtx();
      const oscilador = contexto.createOscillator();
      const ganancia = contexto.createGain();

      oscilador.type = 'sine';
      oscilador.frequency.setValueAtTime(880, contexto.currentTime); // La5
      oscilador.frequency.exponentialRampToValueAtTime(1760, contexto.currentTime + 0.1);

      ganancia.gain.setValueAtTime(0.3, contexto.currentTime);
      ganancia.gain.exponentialRampToValueAtTime(0.01, contexto.currentTime + 0.12);

      oscilador.connect(ganancia);
      ganancia.connect(contexto.destination);

      oscilador.start();
      oscilador.stop(contexto.currentTime + 0.12);
    }
  } catch (e) {
    console.log('Audio no disponible:', e);
  }
}

export default function LectorSerialCamara({
  serial_actual,
  al_detectar_serial,
  al_cambiar_foto
}: PropiedadesLectorSerial) {
  const [procesando, setProcesando] = useState(false);
  const [mensaje_estado, setMensaje_estado] = useState('');
  const [porcentaje_progreso, setPorcentaje_progreso] = useState(0);

  const [foto_url_previa, setFoto_url_previa] = useState<string | null>(null);
  const [candidatos, setCandidatos] = useState<string[]>([]);
  const [metodo_extraccion, setMetodo_extraccion] = useState<'codigo_barras' | 'ocr' | 'ninguno' | null>(null);

  // Estados del visor en vivo
  const [mostrar_visor, setMostrar_visor] = useState(false);
  const [linterna_activa, setLinterna_activa] = useState(false);
  const [soporta_linterna, setSoporta_linterna] = useState(false);
  const [modo_camara, setModo_camara] = useState<'environment' | 'user'>('environment');

  const video_ref = useRef<HTMLVideoElement>(null);
  const stream_ref = useRef<MediaStream | null>(null);
  const escaneo_activo_ref = useRef<boolean>(false);
  const canvas_oculto_ref = useRef<HTMLCanvasElement | null>(null);

  const input_camara_nativa_ref = useRef<HTMLInputElement>(null);

  // Detener la cámara
  const detener_camara = useCallback(() => {
    escaneo_activo_ref.current = false;
    if (stream_ref.current) {
      stream_ref.current.getTracks().forEach((pista) => pista.stop());
      stream_ref.current = null;
    }
    setMostrar_visor(false);
    setLinterna_activa(false);
  }, []);

  // Procesar archivo estático (desde galería o foto capturada)
  const procesar_archivo = async (archivo: File) => {
    setProcesando(true);
    setMensaje_estado('Optimizando imagen...');
    setPorcentaje_progreso(15);

    const url_objeto = URL.createObjectURL(archivo);
    setFoto_url_previa(url_objeto);

    try {
      const resultado: ResultadoExtraccionSerial = await procesar_imagen_serial(
        archivo,
        (mensaje, porcentaje) => {
          setMensaje_estado(mensaje);
          setPorcentaje_progreso(porcentaje);
        }
      );

      setCandidatos(resultado.candidatos_alternativos || []);
      setMetodo_extraccion(resultado.metodo);

      if (resultado.serial_detectado) {
        emitir_sonido_escaneo();
        if (navigator.vibrate) navigator.vibrate(120);
        al_detectar_serial(resultado.serial_detectado, archivo, resultado.imagen_procesada_url || url_objeto);
      } else {
        al_detectar_serial('', archivo, url_objeto);
      }

      al_cambiar_foto?.(archivo);
    } catch (error) {
      console.error('Error al procesar serial:', error);
      setMensaje_estado('No se pudo extraer el serial automáticamente. Ingréselo manualmente.');
    } finally {
      setProcesando(false);
    }
  };

  // Loop continuo de escaneo en tiempo real sobre el video de la cámara trasera
  const iniciar_bucle_escaneo = useCallback(() => {
    if (!canvas_oculto_ref.current) {
      canvas_oculto_ref.current = document.createElement('canvas');
    }
    const canvas = canvas_oculto_ref.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const escanear_frame = async () => {
      if (!escaneo_activo_ref.current || !video_ref.current) return;

      const video = video_ref.current;
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;

        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          // 1. Intentar decodificación con ZXing en el frame actual
          try {
            const resultado = await lector_zxing_vivo.decodeFromCanvas(canvas);
            if (resultado && resultado.getText()) {
              const codigo_detectado = resultado.getText().trim();
              if (codigo_detectado.length >= 4) {
                // ¡Código de barras detectado en tiempo real!
                escaneo_activo_ref.current = false;
                emitir_sonido_escaneo();
                if (navigator.vibrate) navigator.vibrate(150);

                // Capturar snapshot actual para vista previa
                canvas.toBlob((blob) => {
                  const archivo = blob 
                    ? new File([blob], `serial_${Date.now()}.jpg`, { type: 'image/jpeg' })
                    : undefined;
                  const url_img = canvas.toDataURL('image/jpeg', 0.9);
                  setFoto_url_previa(url_img);
                  setMetodo_extraccion('codigo_barras');
                  detener_camara();
                  al_detectar_serial(codigo_detectado, archivo, url_img);
                  if (archivo) al_cambiar_foto?.(archivo);
                }, 'image/jpeg', 0.9);
                return;
              }
            }
          } catch {
            // No se detectó código en este frame, continuar al siguiente
          }
        }
      }

      if (escaneo_activo_ref.current) {
        requestAnimationFrame(escanear_frame);
      }
    };

    requestAnimationFrame(escanear_frame);
  }, [al_detectar_serial, al_cambiar_foto, detener_camara]);

  // Iniciar cámara trasera por defecto
  const iniciar_camara_trasera = async (preferencia_modo: 'environment' | 'user' = modo_camara) => {
    // Si el navegador no soporta mediaDevices (por ejemplo, en contexto HTTP sin SSL), abrir cámara nativa
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.warn('getUserMedia no soportado en este contexto, abriendo cámara nativa.');
      input_camara_nativa_ref.current?.click();
      return;
    }

    setMostrar_visor(true);
    setMensaje_estado('Iniciando cámara trasera...');

    try {
      if (stream_ref.current) {
        stream_ref.current.getTracks().forEach(t => t.stop());
      }

      // Restricciones garantizando la cámara trasera
      const restricciones: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: preferencia_modo },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(restricciones);
      stream_ref.current = stream;

      // Verificar soporte de linterna en la cámara
      const pista_video = stream.getVideoTracks()[0];
      const capacidades = pista_video.getCapabilities ? (pista_video.getCapabilities() as unknown as { torch?: boolean }) : {};
      setSoporta_linterna(Boolean(capacidades.torch));

      if (video_ref.current) {
        video_ref.current.srcObject = stream;
        await video_ref.current.play();
        escaneo_activo_ref.current = true;
        iniciar_bucle_escaneo();
      }
    } catch (error) {
      console.error('Error al iniciar cámara en vivo:', error);
      detener_camara();
      // Si falla getUserMedia, abrir cámara fotográfica nativa directamente
      input_camara_nativa_ref.current?.click();
    }
  };

  // Alternar linterna / flash
  const alternar_linterna = async () => {
    if (!stream_ref.current) return;
    const pista = stream_ref.current.getVideoTracks()[0];
    try {
      const nuevo_estado = !linterna_activa;
      await pista.applyConstraints({
        advanced: [{ torch: nuevo_estado } as unknown as MediaTrackConstraintSet]
      });
      setLinterna_activa(nuevo_estado);
    } catch (e) {
      console.warn('No se pudo activar la linterna:', e);
    }
  };

  // Alternar entre cámara trasera y delantera
  const alternar_camara = () => {
    const nuevo_modo = modo_camara === 'environment' ? 'user' : 'environment';
    setModo_camara(nuevo_modo);
    iniciar_camara_trasera(nuevo_modo);
  };

  // Botón manual de captura (para texto impreso OCR)
  const capturar_y_analizar_ocr = () => {
    if (!video_ref.current) return;
    const video = video_ref.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (blob) {
          const archivo = new File([blob], `serial_ocr_${Date.now()}.jpg`, { type: 'image/jpeg' });
          detener_camara();
          procesar_archivo(archivo);
        }
      }, 'image/jpeg', 0.95);
    }
  };

  const limpiar_foto = () => {
    if (foto_url_previa) {
      URL.revokeObjectURL(foto_url_previa);
    }
    setFoto_url_previa(null);
    setCandidatos([]);
    setMetodo_extraccion(null);
    al_detectar_serial('');
    al_cambiar_foto?.(null);
  };

  useEffect(() => {
    return () => {
      detener_camara();
    };
  }, [detener_camara]);

  return (
    <div className="lector-camara-contenedor">
      {/* Input de Cámara Nativa del Celular (capture="environment" abre la aplicación de cámara directamente) */}
      <input
        type="file"
        ref={input_camara_nativa_ref}
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            procesar_archivo(e.target.files[0]);
          }
        }}
      />

      {/* Botón de acción principal: Exclusivo Escanear con Cámara */}
      {!foto_url_previa && !procesando && !mostrar_visor && (
        <div className="lector-opciones-captura">
          <button
            type="button"
            className="btn-captura-camara"
            onClick={() => iniciar_camara_trasera('environment')}
          >
            <Camera size={22} />
            <span>Escanear con Cámara en Vivo</span>
          </button>
        </div>
      )}

      {/* Indicador de procesamiento OCR */}
      {procesando && (
        <div className="ocr-procesando-caja">
          <div className="ocr-procesando-header">
            <Loader2 size={20} className="spin-icon" color="#da2d34" style={{ animation: 'spin 1s linear infinite' }} />
            <span>{mensaje_estado}</span>
          </div>
          <div className="ocr-barra-progreso-fondo">
            <div
              className="ocr-barra-progreso-relleno"
              style={{ width: `${porcentaje_progreso}%` }}
            />
          </div>
        </div>
      )}

      {/* Previsualización del serial detectado */}
      {foto_url_previa && !procesando && (
        <div className="vista-previa-serial-caja">
          <div className="vista-previa-imagen-wrapper">
            <img
              src={foto_url_previa}
              alt="Etiqueta del serial"
              className="vista-previa-img"
            />
            <button
              type="button"
              className="btn-eliminar-foto"
              onClick={limpiar_foto}
              title="Tomar otra foto"
            >
              <RefreshCw size={18} />
            </button>
          </div>

          {metodo_extraccion && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#166534', fontWeight: 600 }}>
              <CheckCircle2 size={18} color="#16a34a" />
              <span>
                {metodo_extraccion === 'codigo_barras'
                  ? '¡Código de barras detectado en tiempo real!'
                  : metodo_extraccion === 'ocr'
                  ? '¡Texto y serial extraído mediante OCR!'
                  : 'Foto cargada correctamente.'}
              </span>
            </div>
          )}

          {candidatos.length > 1 && (
            <div className="candidatos-seccion">
              <span className="candidatos-titulo">
                <Sparkles size={13} style={{ display: 'inline', marginRight: '4px' }} />
                Otros números detectados en la etiqueta (Toca para seleccionar):
              </span>
              <div className="candidatos-chips-lista">
                {candidatos.map((candidato, index) => (
                  <button
                    key={`${candidato}-${index}`}
                    type="button"
                    className={`chip-candidato ${serial_actual === candidato ? 'activo' : ''}`}
                    onClick={() => al_detectar_serial(candidato)}
                  >
                    {candidato}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Visor de Escáner en Vivo con Cámara Trasera */}
      {mostrar_visor && (
        <div className="visor-en-vivo-modal">
          <div className="visor-header">
            <div className="visor-titulo-contenedor">
              <ScanLine size={24} color="#da2d34" />
              <div>
                <h3 className="visor-titulo">Escáner de Activos</h3>
                <span className="visor-subtitulo">Apunta al código de barras o serial</span>
              </div>
            </div>

            <div className="visor-acciones-header">
              {soporta_linterna && (
                <button
                  type="button"
                  className={`btn-icono-visor ${linterna_activa ? 'activo' : ''}`}
                  onClick={alternar_linterna}
                  title="Linterna"
                >
                  <Flashlight size={20} />
                </button>
              )}

              <button
                type="button"
                className="btn-icono-visor"
                onClick={alternar_camara}
                title="Cambiar Cámara"
              >
                <SwitchCamera size={20} />
              </button>

              <button
                type="button"
                className="btn-icono-visor"
                onClick={detener_camara}
                title="Cerrar Escáner"
              >
                <X size={22} />
              </button>
            </div>
          </div>

          <div className="visor-video-wrapper">
            <video ref={video_ref} className="visor-video" playsInline muted autoPlay />
            <div className="guia-enfoque-serial">
              <div className="laser-animado" />
              <span className="guia-enfoque-texto">Centrar código de barras o serial</span>
            </div>
          </div>

          <div className="visor-controles">
            <div className="visor-instruccion-rapida">
              💡 La cámara lee códigos de barras automáticamente en vivo.
            </div>

            <div className="visor-botones-accion-fila">
              <button
                type="button"
                className="btn-disparo-foto"
                onClick={capturar_y_analizar_ocr}
                title="Capturar y leer texto OCR"
              >
                <Camera size={28} />
                <span>Leer OCR</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
