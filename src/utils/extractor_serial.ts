import { createWorker } from 'tesseract.js';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';

export interface ResultadoExtraccionSerial {
  serial_detectado: string;
  candidatos_alternativos: string[];
  metodo: 'codigo_barras' | 'ocr' | 'ninguno';
  confianza: number;
  texto_completo: string;
  imagen_procesada_url?: string;
}

// Configuración de formatos soportados por el lector ZXing
const pistas_decodificacion = new Map();
pistas_decodificacion.set(DecodeHintType.POSSIBLE_FORMATS, [
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
pistas_decodificacion.set(DecodeHintType.TRY_HARDER, true);

const lector_zxing = new BrowserMultiFormatReader(pistas_decodificacion);

// Patrones comunes para identificar números de serie en etiquetas
const PATRONES_SERIAL: RegExp[] = [
  /(?:S\/N|S\.N\.|SN|SERIAL\s*NO\.?|SERIAL\s*NÚMERO|SERIAL|N\/S|SERIE|SERVICE\s*TAG|ST|IMEI|MAC\s*ADDRESS|MAC|PLACA|ACTIVO)[\s:#=\-_]+([A-Za-z0-9\-_]{4,30})/i,
  /(?:MODEL\/SERIAL|TAG|ASSET\s*TAG)[\s:#=\-_]+([A-Za-z0-9\-_]{4,30})/i,
  /\b([A-Z0-9]{2,4}-[A-Z0-9]{4,8}-[A-Z0-9]{2,8})\b/i,
  /\b([0-9]{6,20})\b/,
  /\b([A-Z0-9]{6,24})\b/
];

// Lista de palabras comunes que deben ser ignoradas estrictamente
const PALABRAS_IGNORADAS = new Set([
  'COLOMBIANO', 'COLOMBIA', 'PRODUCTO', 'INDUSTRIA', 'HECHO', 'BOGOTA', 'MEDELLIN',
  'REPUBLICA', 'GARANTIA', 'PROSEGUR', 'CLARO', 'MODEL', 'MODELO', 'TYPE', 'TIPO',
  'MADE', 'CHINA', 'VIETNAM', 'INPUT', 'OUTPUT', 'RATING', 'VOLTS', 'SERIES',
  'SERIAL', 'NUMBER', 'NUMERO', 'VERSION', 'IMPORTADO', 'FABRICADO', 'CONTENIDO',
  'MARCA', 'PESO', 'REGISTRO', 'EQUIPO', 'ACTIVO', 'CODIGO', 'DISPOSITIVO', 'ORIGEN'
]);

/**
 * Preprocesa la imagen en un canvas HTML5 para optimizar el contraste del texto y códigos de barras.
 */
export async function preprocesar_imagen_para_ocr(archivo_imagen: File): Promise<{ canvas: HTMLCanvasElement; url_procesada: string; img_original: HTMLImageElement }> {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = (evento) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          rechazar(new Error('No se pudo inicializar el contexto del canvas'));
          return;
        }

        let ancho = img.width;
        let alto = img.height;
        const max_dimension = 1800;

        if (ancho > max_dimension || alto > max_dimension) {
          if (ancho > alto) {
            alto = Math.round((alto * max_dimension) / ancho);
            ancho = max_dimension;
          } else {
            ancho = Math.round((ancho * max_dimension) / alto);
            alto = max_dimension;
          }
        }

        canvas.width = ancho;
        canvas.height = alto;
        ctx.drawImage(img, 0, 0, ancho, alto);

        try {
          const imgData = ctx.getImageData(0, 0, ancho, alto);
          const datos = imgData.data;
          const factor_contraste = 1.4;

          for (let i = 0; i < datos.length; i += 4) {
            const gris = 0.299 * datos[i] + 0.587 * datos[i + 1] + 0.114 * datos[i + 2];
            const nuevo_gris = Math.min(255, Math.max(0, factor_contraste * (gris - 128) + 128));
            datos[i] = nuevo_gris;
            datos[i + 1] = nuevo_gris;
            datos[i + 2] = nuevo_gris;
          }

          ctx.putImageData(imgData, 0, 0);
        } catch (e) {
          console.warn('No se pudo aplicar filtro de imagen directo:', e);
        }

        const url_procesada = canvas.toDataURL('image/jpeg', 0.95);
        resolver({ canvas, url_procesada, img_original: img });
      };

      img.onerror = () => rechazar(new Error('No se pudo cargar la imagen'));
      img.src = evento.target?.result as string;
    };

    lector.onerror = () => rechazar(new Error('Error al leer el archivo de imagen'));
    lector.readAsDataURL(archivo_imagen);
  });
}

/**
 * Escanea códigos de barras o QR utilizando ZXing (Multi-formato compatible universalmente)
 */
async function escanear_con_zxing(canvas: HTMLCanvasElement, img_original: HTMLImageElement): Promise<string | null> {
  // 1. Intentar decodificar sobre el canvas preprocesado
  try {
    const resultado = await lector_zxing.decodeFromCanvas(canvas);
    if (resultado && resultado.getText()) {
      return resultado.getText().trim();
    }
  } catch {
    // Continuar con otros intentos
  }

  // 2. Intentar decodificar sobre la imagen original
  try {
    const resultado = await lector_zxing.decodeFromImageElement(img_original);
    if (resultado && resultado.getText()) {
      return resultado.getText().trim();
    }
  } catch {
    // Continuar
  }

  // 3. Fallback a BarcodeDetector nativo si está presente en el navegador
  try {
    const ventana = window as unknown as { BarcodeDetector?: new (opciones?: { formats: string[] }) => { detect: (imagen: CanvasImageSource) => Promise<Array<{ rawValue: string }>> } };
    if (ventana.BarcodeDetector) {
      const detector = new ventana.BarcodeDetector({
        formats: ['code_128', 'code_39', 'code_93', 'qr_code', 'data_matrix', 'itf', 'ean_13', 'ean_8', 'upc_a', 'upc_e']
      });
      const resultados = await detector.detect(canvas);
      if (resultados && resultados.length > 0) {
        const mejor = resultados.find(r => r.rawValue && r.rawValue.trim().length >= 4) || resultados[0];
        if (mejor?.rawValue) {
          return mejor.rawValue.trim();
        }
      }
    }
  } catch {
    // No disponible
  }

  return null;
}

/**
 * Limpia y normaliza cadenas de seriales extraídas
 */
function limpiar_serial(cadena: string): string {
  return cadena
    .replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '')
    .replace(/[\s\t\r\n]+/g, '')
    .toUpperCase();
}

/**
 * Analiza el texto plano del OCR y extrae exclusivamente números de serie o secuencias numéricas/alfanuméricas.
 * Excluye rigurosamente palabras del diccionario en español o inglés sin números.
 */
export function extraer_candidatos_serial(texto: string): { principal: string; candidatos: string[] } {
  const candidatos_set = new Set<string>();
  let serial_principal = '';

  // 1. Buscar coincidencias con palabras clave explícitas (S/N, SERIAL, etc.)
  for (const patron of PATRONES_SERIAL) {
    const coincidencia = texto.match(patron);
    if (coincidencia && coincidencia[1]) {
      const serial_limpio = limpiar_serial(coincidencia[1]);
      // Si tiene al menos 4 caracteres y contiene al menos 1 número (o viene de S/N explícito)
      if (serial_limpio.length >= 4 && !PALABRAS_IGNORADAS.has(serial_limpio)) {
        serial_principal = serial_limpio;
        candidatos_set.add(serial_limpio);
        break;
      }
    }
  }

  // 2. Extraer secuencias numéricas (códigos de barras como '7 701362 009733' impresos bajo las barras)
  const lineas = texto.split('\n');
  for (const linea of lineas) {
    // Buscar dígitos agrupados con espacios en la misma línea (ej: 7 701362 009733)
    const digitos_linea = linea.replace(/[^0-9]/g, '');
    if (digitos_linea.length >= 6 && digitos_linea.length <= 20) {
      candidatos_set.add(digitos_linea);
      if (!serial_principal) {
        serial_principal = digitos_linea;
      }
    }
  }

  // 3. Extraer otros tokens alfanuméricos sospechosos de ser seriales (exigir que contengan al menos un NÚMERO)
  for (const linea of lineas) {
    const palabras = linea.split(/[\s,;:|=/\\()[\]{}]+/).filter(Boolean);
    for (const palabra of palabras) {
      const limpia = limpiar_serial(palabra);

      if (PALABRAS_IGNORADAS.has(limpia)) continue;

      // REGLA FUNDAMENTAL: Un serial DEBE contener al menos un dígito numérico (0-9)
      const tiene_numeros = /[0-9]/.test(limpia);
      const tiene_letras = /[A-Z]/.test(limpia);

      if (limpia.length >= 5 && limpia.length <= 25) {
        // Solo aceptar si tiene números (ej: 7701362009733 o SN123456 o PF2K89AB)
        // Rechazar palabras compuestas 100% de letras a menos que tengan guiones de formato serial
        if (tiene_numeros || (tiene_letras && limpia.includes('-'))) {
          candidatos_set.add(limpia);
        }
      }
    }
  }

  const lista_candidatos = Array.from(candidatos_set);

  // Si no se asignó un serial principal, ordenar candidatos dando máxima prioridad a secuencias numéricas o alfanuméricas
  if (!serial_principal && lista_candidatos.length > 0) {
    const ordenados = [...lista_candidatos].sort((a, b) => {
      // Priorizar secuencias de 8 a 15 caracteres (estándar de seriales y códigos de barras)
      const a_es_numero = /^[0-9]+$/.test(a) ? 3 : (/[0-9]/.test(a) ? 2 : 1);
      const b_es_numero = /^[0-9]+$/.test(b) ? 3 : (/[0-9]/.test(b) ? 2 : 1);

      if (a_es_numero !== b_es_numero) return b_es_numero - a_es_numero;
      return b.length - a.length;
    });

    serial_principal = ordenados[0];
  }

  return {
    principal: serial_principal,
    candidatos: lista_candidatos
  };
}

/**
 * Función principal de extracción de serial por imagen
 */
export async function procesar_imagen_serial(
  archivo: File,
  notificar_progreso?: (mensaje: string, porcentaje: number) => void
): Promise<ResultadoExtraccionSerial> {
  notificar_progreso?.('Optimizando imagen...', 15);

  const { canvas, url_procesada, img_original } = await preprocesar_imagen_para_ocr(archivo);

  // 1. Escaneo de código de barras universal con ZXing (instantáneo y ultra preciso)
  notificar_progreso?.('Decodificando código de barras/QR...', 35);
  const serial_barcode = await escanear_con_zxing(canvas, img_original);

  if (serial_barcode) {
    notificar_progreso?.('¡Código de barras detectado con éxito!', 100);
    return {
      serial_detectado: serial_barcode,
      candidatos_alternativos: [serial_barcode],
      metodo: 'codigo_barras',
      confianza: 100,
      texto_completo: `Código de barras decodificado: ${serial_barcode}`,
      imagen_procesada_url: url_procesada
    };
  }

  // 2. Reconocimiento OCR con Tesseract.js
  notificar_progreso?.('Analizando caracteres y números con OCR...', 60);

  let worker = null;
  try {
    worker = await createWorker('eng+spa');
    
    // Configurar reconocimiento con alta sensibilidad a números y mayúsculas
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-/:#.'
    });

    notificar_progreso?.('Extrayendo serial de la etiqueta...', 80);
    const resultado_ocr = await worker.recognize(canvas);

    const texto_extraido = resultado_ocr.data.text || '';
    const confianza = Math.round(resultado_ocr.data.confidence || 0);

    const { principal, candidatos } = extraer_candidatos_serial(texto_extraido);

    await worker.terminate();

    notificar_progreso?.('Listo', 100);

    return {
      serial_detectado: principal,
      candidatos_alternativos: candidatos,
      metodo: principal ? 'ocr' : 'ninguno',
      confianza,
      texto_completo: texto_extraido,
      imagen_procesada_url: url_procesada
    };
  } catch (error) {
    if (worker) {
      try {
        await worker.terminate();
      } catch {
        // Ignorar error al terminar worker
      }
    }
    console.error('Error durante OCR:', error);
    return {
      serial_detectado: '',
      candidatos_alternativos: [],
      metodo: 'ninguno',
      confianza: 0,
      texto_completo: '',
      imagen_procesada_url: url_procesada
    };
  }
}
