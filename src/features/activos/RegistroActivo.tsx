import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Laptop, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Building2, 
  Hash, 
  CheckCircle, 
  Trash2, 
  Boxes,
  UserCheck,
  FileText
} from 'lucide-react';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../hooks/useAuth';
import PremiumSelect from '../../components/PremiumSelect';
import LectorSerialCamara from './LectorSerialCamara';
import type { Sede } from '../../types/database';
import { generateUUID } from '../../utils/uuid';
import { ZONA_HORARIA_COLOMBIA } from '../../utils/fechasColombia';
import './RegistroActivo.css';

export type TipoMovimiento = 'entrada' | 'salida';

export type TipologiaActivo = 
  | 'Portátil / Laptop'
  | 'Computador Escritorio'
  | 'Monitor / Pantalla'
  | 'Radio de Comunicación'
  | 'Celular Corporativo'
  | 'Impresora / Escáner'
  | 'Herramienta / Equipo Técnico'
  | 'Otro Activo';

export type EstadoEquipo = 'bueno' | 'regular' | 'malo';

export interface RegistroActivoItem {
  id: string;
  tipo_movimiento: TipoMovimiento;
  sede_id: string;
  sede_nombre: string;
  tipologia: TipologiaActivo;
  serial: string;
  marca: string;
  modelo: string;
  estado: EstadoEquipo;
  responsable: string;
  observaciones: string;
  fecha_hora: string;
  foto_url?: string;
}

const OPCIONES_TIPOLOGIA: TipologiaActivo[] = [
  'Portátil / Laptop',
  'Computador Escritorio',
  'Monitor / Pantalla',
  'Radio de Comunicación',
  'Celular Corporativo',
  'Impresora / Escáner',
  'Herramienta / Equipo Técnico',
  'Otro Activo'
];

const CLAVE_STORAGE_ACTIVOS = 'minutas_control_activos_local';

export default function RegistroActivo() {
  const navigate = useNavigate();
  const { perfil } = useAuth();

  // Estados del formulario
  const [tipo_movimiento, setTipo_movimiento] = useState<TipoMovimiento>('entrada');
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [sede_id, setSede_id] = useState('');
  const [tipologia, setTipologia] = useState<TipologiaActivo>('Portátil / Laptop');
  const [serial, setSerial] = useState('');
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [estado_equipo, setEstado_equipo] = useState<EstadoEquipo>('bueno');
  const [responsable, setResponsable] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [, setFoto_archivo] = useState<File | null>(null);
  const [foto_url, setFoto_url] = useState<string>('');

  // Estados de interfaz y lista local
  const [registros, setRegistros] = useState<RegistroActivoItem[]>([]);
  const [mensaje_exito, setMensaje_exito] = useState('');
  const [error_formulario, setError_formulario] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Cargar sedes e historial local inicial
  useEffect(() => {
    async function cargar_datos() {
      try {
        const { data } = await supabase.from('sedes').select('*').order('nombre');
        if (data && data.length > 0) {
          setSedes(data as Sede[]);
          setSede_id((data[0] as Sede).id);
        } else {
          // Fallback sedes locales si está offline
          const sedes_locales: Sede[] = [
            { id: '1', nombre: 'Sede Principal Bogotá' },
            { id: '2', nombre: 'Centro Operativo Medellín' },
            { id: '3', nombre: 'Sede Cali' },
            { id: '4', nombre: 'Sede Barranquilla' }
          ];
          setSedes(sedes_locales);
          setSede_id('1');
        }
      } catch (err) {
        console.error('Error al cargar sedes:', err);
      }

      // Cargar registros locales
      try {
        const guardados = localStorage.getItem(CLAVE_STORAGE_ACTIVOS);
        if (guardados) {
          setRegistros(JSON.parse(guardados));
        }
      } catch (e) {
        console.error('Error al cargar historial local de activos:', e);
      }
    }

    cargar_datos();
  }, []);

  // Guardar en localStorage cuando cambian los registros
  const actualizar_registros_locales = (nuevos: RegistroActivoItem[]) => {
    setRegistros(nuevos);
    try {
      localStorage.setItem(CLAVE_STORAGE_ACTIVOS, JSON.stringify(nuevos));
    } catch (e) {
      console.error('Error al persistir en localStorage:', e);
    }
  };

  // Callback cuando la cámara / OCR detecta un serial
  const manejar_serial_detectado = (serial_extraido: string, _foto?: File, url_foto?: string) => {
    if (serial_extraido) {
      setSerial(serial_extraido.toUpperCase());
    }
    if (url_foto) {
      setFoto_url(url_foto);
    }
  };

  // Manejar envío del formulario
  const manejar_guardar = (e: React.FormEvent) => {
    e.preventDefault();
    setError_formulario('');
    setMensaje_exito('');

    if (!serial.trim()) {
      setError_formulario('Por favor tome una foto al serial o escríbalo manualmente.');
      return;
    }

    if (!sede_id) {
      setError_formulario('Seleccione la sede correspondiente.');
      return;
    }

    setGuardando(true);

    const sede_encontrada = sedes.find(s => s.id === sede_id);
    const nombre_sede = sede_encontrada ? sede_encontrada.nombre : 'Sede General';

    const nuevo_registro: RegistroActivoItem = {
      id: generateUUID(),
      tipo_movimiento,
      sede_id,
      sede_nombre: nombre_sede,
      tipologia,
      serial: serial.trim().toUpperCase(),
      marca: marca.trim(),
      modelo: modelo.trim(),
      estado: estado_equipo,
      responsable: responsable.trim() || perfil?.nombre || 'Personal Autorizado',
      observaciones: observaciones.trim(),
      fecha_hora: new Date().toLocaleString('es-CO', { 
        timeZone: ZONA_HORARIA_COLOMBIA,
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
      }),
      foto_url
    };

    const nueva_lista = [nuevo_registro, ...registros];
    actualizar_registros_locales(nueva_lista);

    setMensaje_exito(`¡${tipo_movimiento === 'entrada' ? 'Entrada' : 'Salida'} de activo registrada exitosamente (Serial: ${nuevo_registro.serial})!`);
    
    // Limpiar campos para el siguiente registro
    setSerial('');
    setMarca('');
    setModelo('');
    setResponsable('');
    setObservaciones('');
    setFoto_archivo(null);
    setFoto_url('');
    setGuardando(false);

    // Ocultar notificación de éxito tras 4 segundos
    setTimeout(() => {
      setMensaje_exito('');
    }, 4000);
  };

  const eliminar_registro_prueba = (id: string) => {
    const filtrados = registros.filter(r => r.id !== id);
    actualizar_registros_locales(filtrados);
  };

  // Métricas calculadas para la sede seleccionada
  const registros_sede = registros.filter(r => r.sede_id === sede_id);
  const total_entradas = registros_sede.filter(r => r.tipo_movimiento === 'entrada').length;
  const total_salidas = registros_sede.filter(r => r.tipo_movimiento === 'salida').length;
  const balance_en_sede = Math.max(0, total_entradas - total_salidas);

  return (
    <div className="registro-activos-page">
      {/* Barra superior de navegación */}
      <header className="registro-activos-header">
        <button className="btn-volver" onClick={() => navigate('/')} title="Volver al inicio">
          <ArrowLeft size={20} />
        </button>
        <div className="header-titulos">
          <h1 className="header-titulo">Control de Entrada y Salida de Activos</h1>
          <span className="header-subtitulo">Validación y escaneo de serial por OCR</span>
        </div>
      </header>

      <main className="registro-activos-contenedor">
        {/* Notificación de éxito */}
        {mensaje_exito && (
          <div className="notificacion-exito">
            <CheckCircle size={20} />
            <span>{mensaje_exito}</span>
          </div>
        )}

        {/* Notificación de error */}
        {error_formulario && (
          <div style={{ background: '#fee2e2', border: '1px solid #ef4444', color: '#b91c1c', padding: '12px 16px', borderRadius: '12px', fontSize: '14px', fontWeight: 600 }}>
            {error_formulario}
          </div>
        )}

        {/* Selector de Movimiento: Entrada / Salida */}
        <div className="movimiento-toggle-contenedor">
          <button
            type="button"
            className={`btn-toggle-movimiento ${tipo_movimiento === 'entrada' ? 'activo-entrada' : ''}`}
            onClick={() => setTipo_movimiento('entrada')}
          >
            <ArrowDownLeft size={20} />
            <span>🟢 Entrada a Sede</span>
          </button>
          <button
            type="button"
            className={`btn-toggle-movimiento ${tipo_movimiento === 'salida' ? 'activo-salida' : ''}`}
            onClick={() => setTipo_movimiento('salida')}
          >
            <ArrowUpRight size={20} />
            <span>🔴 Salida de Sede</span>
          </button>
        </div>

        {/* Formulario Principal */}
        <form onSubmit={manejar_guardar} className="formulario-card">
          {/* Selector de Sede */}
          <div className="form-grupo">
            <label className="form-label">
              <Building2 size={16} color="#da2d34" />
              <span>Sede de la Operación <span className="requerido">*</span></span>
            </label>
            <PremiumSelect
              value={sede_id}
              onChange={(val) => setSede_id(val)}
              options={sedes.map(s => ({ value: s.id, label: s.nombre }))}
              placeholder="Seleccione la sede..."
            />
          </div>

          {/* Selector de Tipología de Activo */}
          <div className="form-grupo">
            <label className="form-label">
              <Laptop size={16} color="#da2d34" />
              <span>Tipología del Activo / Equipo <span className="requerido">*</span></span>
            </label>
            <PremiumSelect
              value={tipologia}
              onChange={(val) => setTipologia(val as TipologiaActivo)}
              options={OPCIONES_TIPOLOGIA.map(t => ({ value: t, label: t }))}
              placeholder="Seleccione la tipología..."
            />
          </div>

          {/* Lector de Serial con Cámara OCR */}
          <div className="form-grupo">
            <label className="form-label">
              <Hash size={16} color="#da2d34" />
              <span>Escáner de Serial con Cámara (OCR / Código de Barras)</span>
            </label>
            <LectorSerialCamara
              serial_actual={serial}
              al_detectar_serial={manejar_serial_detectado}
              al_cambiar_foto={(archivo) => setFoto_archivo(archivo)}
            />
          </div>

          {/* Campo de Serial editable */}
          <div className="form-grupo">
            <label className="form-label">
              <span>Número de Serial / Placa del Equipo <span className="requerido">*</span></span>
            </label>
            <input
              type="text"
              className="form-input input-serial"
              placeholder="Ej: ABC12345678 o escanee con la cámara"
              value={serial}
              onChange={(e) => setSerial(e.target.value.toUpperCase())}
              required
            />
          </div>

          {/* Marca y Modelo en Grid */}
          <div className="form-grid-2">
            <div className="form-grupo">
              <label className="form-label">Marca / Fabricante</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ej: HP, Dell, Motorola"
                value={marca}
                onChange={(e) => setMarca(e.target.value)}
              />
            </div>
            <div className="form-grupo">
              <label className="form-label">Modelo</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ej: Latitude 5420, APX2000"
                value={modelo}
                onChange={(e) => setModelo(e.target.value)}
              />
            </div>
          </div>

          {/* Estado del Equipo */}
          <div className="form-grupo">
            <label className="form-label">Estado Físico / Funcional del Equipo</label>
            <div className="estado-chips-grupo">
              <button
                type="button"
                className={`chip-estado ${estado_equipo === 'bueno' ? 'seleccionado-bueno' : ''}`}
                onClick={() => setEstado_equipo('bueno')}
              >
                ✓ Bueno
              </button>
              <button
                type="button"
                className={`chip-estado ${estado_equipo === 'regular' ? 'seleccionado-regular' : ''}`}
                onClick={() => setEstado_equipo('regular')}
              >
                ⚠ Regular
              </button>
              <button
                type="button"
                className={`chip-estado ${estado_equipo === 'malo' ? 'seleccionado-malo' : ''}`}
                onClick={() => setEstado_equipo('malo')}
              >
                ✕ Malo / Dañado
              </button>
            </div>
          </div>

          {/* Responsable */}
          <div className="form-grupo">
            <label className="form-label">
              <UserCheck size={16} color="#da2d34" />
              <span>Persona Responsable (Entrega / Retira)</span>
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="Nombre y apellido / Cargo / Empresa"
              value={responsable}
              onChange={(e) => setResponsable(e.target.value)}
            />
          </div>

          {/* Observaciones */}
          <div className="form-grupo">
            <label className="form-label">
              <FileText size={16} color="#da2d34" />
              <span>Observaciones / Novedad</span>
            </label>
            <textarea
              className="form-textarea"
              rows={3}
              placeholder="Detalles sobre accesorios incluidos (cargador, mouse, estuche), motivos de traslado, etc."
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
            />
          </div>

          {/* Botón Guardar */}
          <button
            type="submit"
            className="btn-guardar-registro"
            disabled={guardando || !serial.trim()}
          >
            <CheckCircle size={20} />
            <span>Guardar {tipo_movimiento === 'entrada' ? 'Entrada' : 'Salida'} de Activo</span>
          </button>
        </form>

        {/* Panel de Resumen de Inventario en la Sede */}
        <section className="inventario-resumen-card">
          <div className="inventario-header">
            <h2 className="inventario-titulo">
              <Boxes size={20} color="#da2d34" />
              <span>Inventario y Movimientos en Sede</span>
            </h2>
            <span style={{ fontSize: '12px', color: '#5c403e' }}>
              {sedes.find(s => s.id === sede_id)?.nombre || 'Sede actual'}
            </span>
          </div>

          <div className="metricas-activos-grid">
            <div className="metrica-item">
              <span className="metrica-valor" style={{ color: '#16a34a' }}>{total_entradas}</span>
              <span className="metrica-etiqueta">Entradas</span>
            </div>
            <div className="metrica-item">
              <span className="metrica-valor" style={{ color: '#da2d34' }}>{total_salidas}</span>
              <span className="metrica-etiqueta">Salidas</span>
            </div>
            <div className="metrica-item">
              <span className="metrica-valor" style={{ color: '#2563eb' }}>{balance_en_sede}</span>
              <span className="metrica-etiqueta">Activos en Sede</span>
            </div>
          </div>

          {/* Lista de Registros Recientes de Prueba */}
          <div style={{ marginTop: '8px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#5c403e', marginBottom: '8px', textTransform: 'uppercase' }}>
              Historial de Registros de Prueba ({registros.length})
            </h3>

            {registros.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#78716c', textAlign: 'center', padding: '16px 0' }}>
                Aún no hay registros de prueba. Complete el formulario y pruebe el escáner de serial.
              </p>
            ) : (
              <div className="registros-recientes-lista">
                {registros.map((item) => (
                  <div key={item.id} className="registro-item-card">
                    <div className="registro-item-left">
                      <span className={`registro-badge-movimiento ${item.tipo_movimiento === 'entrada' ? 'badge-entrada' : 'badge-salida'}`}>
                        {item.tipo_movimiento}
                      </span>
                      <div className="registro-item-info">
                        <span className="registro-item-serial">{item.serial}</span>
                        <span className="registro-item-detalles">
                          {item.tipologia} {item.marca ? `• ${item.marca}` : ''} | {item.sede_nombre}
                        </span>
                        <span style={{ fontSize: '11px', color: '#78716c' }}>
                          {item.fecha_hora} • Resp: {item.responsable}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn-eliminar-registro"
                      onClick={() => eliminar_registro_prueba(item.id)}
                      title="Eliminar registro de prueba"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
