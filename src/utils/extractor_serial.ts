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
  es_sn_priorizado?: boolean;
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

// Lista de palabras comunes que deben ser ignoradas estrictamente
const PALABRAS_IGNORADAS = new Set([
  'COLOMBIANO', 'COLOMBIA', 'PRODUCTO', 'INDUSTRIA', 'HECHO', 'BOGOTA', 'MEDELLIN',
  'REPUBLICA', 'GARANTIA', 'PROSEGUR', 'CLARO', 'MODEL', 'MODELO', 'TYPE', 'TIPO',
  'MADE', 'CHINA', 'VIETNAM', 'INPUT', 'OUTPUT', 'RATING', 'VOLTS', 'SERIES',
  'SERIAL', 'NUMBER', 'NUMERO', 'VERSION', 'IMPORTADO', 'FABRICADO', 'CONTENIDO',
  'MARCA', 'PESO', 'REGISTRO', 'EQUIPO', 'ACTIVO', 'CODIGO', 'DISPOSITIVO', 'ORIGEN',
  'FIJO', 'FIJOS', 'NUEVO', 'USADO', 'BUENO', 'MALO', 'REGULAR', 'ESTADO', 'OBSERVACION'
]);

/**
 * Aplica un filtro antirreflejo y binarización adaptativa local optimizada con Imagen Integral.
 * Resuelve reflejos de flash y luces de techo en stickers metálicos y plastificados.
 */
export function aplicar_filtro_antirreflejo_y_adaptativo(
  ctx: CanvasRenderingContext2D,
  ancho: number,
  alto: number
): { canvas_binarizado: HTMLCanvasElement; canvas_contraste: HTMLCanvasElement } {
  const imgData = ctx.getImageData(0, 0, ancho, alto);
  const datos = imgData.data;
  const totalPixeles = ancho * alto;

  // 1. Escala de grises con atenuación de reflejos especulares (glare suppression)
  const escala_gris = new Uint8Array(totalPixeles);

  for (let i = 0, p = 0; i < datos.length; i += 4, p++) {
    const r = datos[i];
    const g = datos[i + 1];
    const b = datos[i + 2];
    let gris = 0.299 * r + 0.587 * g + 0.114 * b;

    // Supresión suave de brillos/reflejos extremos donde el flash ciega el sensor
    if (gris > 210) {
      gris = 210 + (gris - 210) * 0.4;
    }
    escala_gris[p] = Math.min(255, Math.max(0, Math.round(gris)));
  }

  // 2. Construir Imagen Integral para cálculo de medias locales en tiempo O(1)
  const ancho_int = ancho + 1;
  const integral = new Float64Array((ancho + 1) * (alto + 1));

  for (let y = 0; y < alto; y++) {
    let suma_fila = 0;
    const y_int_idx = (y + 1) * ancho_int;
    const y_prev_idx = y * ancho_int;
    const p_offset = y * ancho;

    for (let x = 0; x < ancho; x++) {
      suma_fila += escala_gris[p_offset + x];
      integral[y_int_idx + x + 1] = integral[y_prev_idx + x + 1] + suma_fila;
    }
  }

  // 3. Crear canvas binarizado adaptativo local (Sauvola/Bradley adaptado)
  const canvas_bin = document.createElement('canvas');
  canvas_bin.width = ancho;
  canvas_bin.height = alto;
  const ctx_bin = canvas_bin.getContext('2d');
  const imgData_bin = ctx_bin ? ctx_bin.createImageData(ancho, alto) : null;

  // Radio adaptativo según resolución (~1/32 del ancho)
  const radio = Math.max(8, Math.min(32, Math.round(ancho / 32)));
  const C = 0.11; // Sensibilidad de contraste local

  if (imgData_bin) {
    const datos_bin = imgData_bin.data;
    for (let y = 0; y < alto; y++) {
      const y1 = Math.max(0, y - radio);
      const y2 = Math.min(alto - 1, y + radio);
      const p_offset = y * ancho;

      for (let x = 0; x < ancho; x++) {
        const x1 = Math.max(0, x - radio);
        const x2 = Math.min(ancho - 1, x + radio);

        const conteo = (x2 - x1 + 1) * (y2 - y1 + 1);

        const suma =
          integral[(y2 + 1) * ancho_int + (x2 + 1)] -
          integral[y1 * ancho_int + (x2 + 1)] -
          integral[(y2 + 1) * ancho_int + x1] +
          integral[y1 * ancho_int + x1];

        const media_local = suma / conteo;
        const valor_pixel = escala_gris[p_offset + x];

        // Si el píxel es significativamente más oscuro que su vecindario local, es trazo (negro)
        const es_trazo = valor_pixel < media_local * (1 - C);
        const valor_final = es_trazo ? 0 : 255;

        const idx = (p_offset + x) * 4;
        datos_bin[idx] = valor_final;
        datos_bin[idx + 1] = valor_final;
        datos_bin[idx + 2] = valor_final;
        datos_bin[idx + 3] = 255;
      }
    }
    ctx_bin?.putImageData(imgData_bin, 0, 0);
  }

  // 4. Crear canvas de contraste normalizado y preservación de bordes
  const canvas_contraste = document.createElement('canvas');
  canvas_contraste.width = ancho;
  canvas_contraste.height = alto;
  const ctx_con = canvas_contraste.getContext('2d');
  if (ctx_con) {
    const imgData_con = ctx_con.createImageData(ancho, alto);
    const datos_con = imgData_con.data;
    for (let p = 0; p < totalPixeles; p++) {
      const g = escala_gris[p];
      const contrastado = Math.min(255, Math.max(0, 1.4 * (g - 128) + 128));
      const idx = p * 4;
      datos_con[idx] = contrastado;
      datos_con[idx + 1] = contrastado;
      datos_con[idx + 2] = contrastado;
      datos_con[idx + 3] = 255;
    }
    ctx_con.putImageData(imgData_con, 0, 0);
  }

  return {
    canvas_binarizado: canvas_bin,
    canvas_contraste: canvas_contraste
  };
}

/**
 * Preprocesa la imagen en un canvas HTML5 para optimizar el contraste del texto y códigos de barras,
 * aplicando filtros antirreflejo y binarización adaptativa local.
 */
export async function preprocesar_imagen_para_ocr(archivo_imagen: File): Promise<{ 
  canvas: HTMLCanvasElement; 
  canvas_binarizado: HTMLCanvasElement; 
  url_procesada: string; 
  img_original: HTMLImageElement 
}> {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = (evento) => {
      const img = new Image();
      img.onload = () => {
        const canvas_base = document.createElement('canvas');
        const ctx = canvas_base.getContext('2d');
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

        canvas_base.width = ancho;
        canvas_base.height = alto;
        ctx.drawImage(img, 0, 0, ancho, alto);

        // Aplicar supresión de reflejos y binarización adaptativa
        const { canvas_binarizado, canvas_contraste } = aplicar_filtro_antirreflejo_y_adaptativo(ctx, ancho, alto);

        const url_procesada = canvas_contraste.toDataURL('image/jpeg', 0.95);
        resolver({ 
          canvas: canvas_contraste, 
          canvas_binarizado, 
          url_procesada, 
          img_original: img 
        });
      };

      img.onerror = () => rechazar(new Error('No se pudo cargar la imagen'));
      img.src = evento.target?.result as string;
    };

    lector.onerror = () => rechazar(new Error('Error al leer el archivo de imagen'));
    lector.readAsDataURL(archivo_imagen);
  });
}

/**
 * Escanea todos los códigos de barras o QR utilizando BarcodeDetector nativo y ZXing
 * sobre múltiples capas de procesamiento (contraste antirreflejo, binarización adaptativa y original).
 */
export async function escanear_codigos_de_barras(
  canvas: HTMLCanvasElement, 
  img_original: HTMLImageElement,
  canvas_binarizado?: HTMLCanvasElement
): Promise<string[]> {
  const codigos_set = new Set<string>();

  // 1. BarcodeDetector nativo si está presente (detecta múltiples códigos en paralelo)
  try {
    const ventana = window as unknown as { BarcodeDetector?: new (opciones?: { formats: string[] }) => { detect: (imagen: CanvasImageSource) => Promise<Array<{ rawValue: string }>> } };
    if (ventana.BarcodeDetector) {
      const detector = new ventana.BarcodeDetector({
        formats: ['code_128', 'code_39', 'code_93', 'qr_code', 'data_matrix', 'itf', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'codabar']
      });

      // Detección en canvas con filtro antirreflejo
      const resultados_canvas = await detector.detect(canvas);
      for (const r of resultados_canvas) {
        if (r.rawValue && r.rawValue.trim().length >= 4) {
          codigos_set.add(r.rawValue.trim());
        }
      }

      // Detección en canvas binarizado adaptativo (ideal si hay reflejos en la etiqueta)
      if (canvas_binarizado) {
        const resultados_bin = await detector.detect(canvas_binarizado);
        for (const r of resultados_bin) {
          if (r.rawValue && r.rawValue.trim().length >= 4) {
            codigos_set.add(r.rawValue.trim());
          }
        }
      }

      // Detección en imagen original como respaldo
      const resultados_img = await detector.detect(img_original);
      for (const r of resultados_img) {
        if (r.rawValue && r.rawValue.trim().length >= 4) {
          codigos_set.add(r.rawValue.trim());
        }
      }
    }
  } catch (e) {
    console.warn('BarcodeDetector nativo no disponible o con error:', e);
  }

  // 2. Intentar decodificar sobre el canvas con ZXing
  try {
    const resultado = await lector_zxing.decodeFromCanvas(canvas);
    if (resultado && resultado.getText()) {
      const txt = resultado.getText().trim();
      if (txt.length >= 4) codigos_set.add(txt);
    }
  } catch {
    // Continuar
  }

  // 3. Intentar decodificar sobre el canvas binarizado adaptativo con ZXing
  if (canvas_binarizado) {
    try {
      const resultado_bin = await lector_zxing.decodeFromCanvas(canvas_binarizado);
      if (resultado_bin && resultado_bin.getText()) {
        const txt = resultado_bin.getText().trim();
        if (txt.length >= 4) codigos_set.add(txt);
      }
    } catch {
      // Continuar
    }
  }

  // 4. Intentar decodificar sobre la imagen original con ZXing
  try {
    const resultado = await lector_zxing.decodeFromImageElement(img_original);
    if (resultado && resultado.getText()) {
      const txt = resultado.getText().trim();
      if (txt.length >= 4) codigos_set.add(txt);
    }
  } catch {
    // Continuar
  }

  return Array.from(codigos_set);
}

/**
 * Limpia y normaliza cadenas de seriales extraídas
 */
export function limpiar_serial(cadena: string): string {
  if (!cadena) return '';
  return cadena
    .replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '')
    .replace(/[\s\t\r\n]+/g, '')
    .toUpperCase();
}

/**
 * Remueve prefijos comunes de S/N como "S/N:", "SN:", "(S)"
 */
export function remover_prefijo_sn(cadena: string): string {
  const sin_prefijo = cadena.replace(/^(?:\(S\)|\[S\/N\]|\(S\/N\)|S[\/|\\.]?N\.?|SN|S\.N\.)[\s:#=\-_]*/i, '');
  return limpiar_serial(sin_prefijo);
}

/**
 * Valida si un candidato es un serial verosímil y no una palabra común
 */
function es_candidato_valido(cadena: string, es_sn = false): boolean {
  if (!cadena || cadena.length < 4 || cadena.length > 35) return false;
  if (PALABRAS_IGNORADAS.has(cadena)) return false;

  // Si proviene explícitamente de una etiqueta S/N
  if (es_sn) {
    return /[0-9]/.test(cadena) || cadena.includes('-') || cadena.length >= 6;
  }

  // Para cualquier otro candidato sin etiqueta S/N: DEBE contener al menos un dígito numérico (0-9)
  return /[0-9]/.test(cadena);
}

/**
 * Analiza el texto plano del OCR y los códigos de barra para extraer candidatos,
 * PRIORIZANDO ESTRICTAMENTE cualquier número asociado a "S/N".
 */
export function extraer_candidatos_serial(
  texto: string,
  barcodes_adicionales: string[] = []
): { principal: string; candidatos: string[]; es_sn_detectado: boolean } {
  const candidatos_sn: string[] = [];
  let candidato_sn_principal = '';
  const candidatos_otros_labels: string[] = [];
  const candidatos_numericos: string[] = [];
  const candidatos_tokens: string[] = [];

  // 1. Revisar si entre los códigos de barra alguno viene con prefijo explícito de S/N
  for (const b of barcodes_adicionales) {
    const b_limpio = limpiar_serial(b);
    if (!b_limpio || PALABRAS_IGNORADAS.has(b_limpio)) continue;

    if (/^(?:\(S\)|\[S\/N\]|\(S\/N\)|S[\/|\\.]?N\.?|SN|S\.N\.)[\s:#=\-_]*/i.test(b)) {
      const b_sn = remover_prefijo_sn(b);
      if (es_candidato_valido(b_sn, true)) {
        candidatos_sn.push(b_sn);
        if (!candidato_sn_principal) candidato_sn_principal = b_sn;
      }
    }
  }

  // 2. Extraer coincidencias de S/N en el texto OCR (MÁXIMA PRIORIDAD)
  const PATRONES_SN_LINEA = [
    /(?:^|[\s,;([{\/])(?:S[\/|\\.]?N\.?|SN|S\.N\.)[\s:#=\-_]+([A-Za-z0-9\-_]{4,30})/gi,
    /(?:SERIAL\s*NUMBER|SERIAL\s*NO\.?|SERIAL\s*N[UÚ]MERO|N\/S|SERIE|N[UÚ]MERO\s*DE\s*SERIE|NO\.?\s*DE\s*SERIE)[\s:#=\-_]+([A-Za-z0-9\-_]{4,30})/gi
  ];

  if (texto) {
    for (const patron of PATRONES_SN_LINEA) {
      const matches = texto.matchAll(patron);
      for (const m of matches) {
        if (m && m[1]) {
          const limpia = limpiar_serial(m[1]);
          if (es_candidato_valido(limpia, true)) {
            candidatos_sn.push(limpia);
            if (!candidato_sn_principal) {
              candidato_sn_principal = limpia;
            }
          }
        }
      }
    }

    // Multilínea: Etiqueta S/N en una línea y el valor en la línea siguiente
    const lineas = texto.split(/\r?\n/);
    for (let i = 0; i < lineas.length; i++) {
      const linea = lineas[i].trim();
      const es_etiqueta_sn = /^(?:S[\/|\\.]?N\.?|SN|S\.N\.|SERIAL\s*NO\.?|SERIAL\s*NUMBER|SERIAL\s*N[UÚ]MERO|N\/S|SERIE)[\s:#=\-_]*$/i.test(linea);
      if (es_etiqueta_sn && i + 1 < lineas.length) {
        const linea_sig = lineas[i + 1].trim();
        const tokens_sig = linea_sig.split(/[\s,;:|=/\\()[\]{}]+/).filter(Boolean);
        for (const tok of tokens_sig) {
          const limpia = limpiar_serial(tok);
          if (es_candidato_valido(limpia, true)) {
            candidatos_sn.push(limpia);
            if (!candidato_sn_principal) {
              candidato_sn_principal = limpia;
            }
            break;
          }
        }
      }
    }

    // 3. Extraer otros identificadores etiquetados (Service Tag, IMEI, MAC, Asset Tag, Placa, etc.)
    const PATRONES_OTROS = [
      /(?:SERVICE\s*TAG|ST|IMEI|MAC\s*ADDRESS|MAC|PLACA|ACTIVO|MODEL\/SERIAL|TAG|ASSET\s*TAG|P\/N|PART\s*NO\.?|PRODUCT\s*NO\.?|ITEM)[\s:#=\-_]+([A-Za-z0-9\-_:]{4,30})/gi
    ];

    for (const patron of PATRONES_OTROS) {
      const matches = texto.matchAll(patron);
      for (const m of matches) {
        if (m && m[1]) {
          const limpia = limpiar_serial(m[1]);
          if (es_candidato_valido(limpia, false)) {
            candidatos_otros_labels.push(limpia);
          }
        }
      }
    }

    // 4. Secuencias numéricas agrupadas en líneas
    for (const linea of lineas) {
      const digitos_linea = linea.replace(/[^0-9]/g, '');
      if (digitos_linea.length >= 6 && digitos_linea.length <= 20) {
        candidatos_numericos.push(digitos_linea);
      }
    }

    // 5. Tokens alfanuméricos en el texto
    for (const linea of lineas) {
      const palabras = linea.split(/[\s,;:|=/\\()[\]{}]+/).filter(Boolean);
      for (const palabra of palabras) {
        const limpia = limpiar_serial(palabra);
        if (es_candidato_valido(limpia, false)) {
          candidatos_tokens.push(limpia);
        }
      }
    }
  }

  // 6. Selección del serial principal dando prioridad absoluta a "S/N"
  let serial_principal = '';
  let es_sn_detectado = false;

  if (candidato_sn_principal) {
    serial_principal = candidato_sn_principal;
    es_sn_detectado = true;
  } else if (candidatos_sn.length > 0) {
    serial_principal = candidatos_sn[0];
    es_sn_detectado = true;
  } else if (barcodes_adicionales.length > 0) {
    // Si no hay S/N explícito, usar el primer código de barras detectado (comportamiento por defecto)
    serial_principal = limpiar_serial(barcodes_adicionales[0]);
  } else if (candidatos_otros_labels.length > 0) {
    serial_principal = candidatos_otros_labels[0];
  } else if (candidatos_numericos.length > 0) {
    serial_principal = candidatos_numericos[0];
  } else if (candidatos_tokens.length > 0) {
    const ordenados = [...candidatos_tokens].sort((a, b) => {
      const a_es_numero = /^[0-9]+$/.test(a) ? 3 : (/[0-9]/.test(a) ? 2 : 1);
      const b_es_numero = /^[0-9]+$/.test(b) ? 3 : (/[0-9]/.test(b) ? 2 : 1);
      if (a_es_numero !== b_es_numero) return b_es_numero - a_es_numero;
      return b.length - a.length;
    });
    serial_principal = ordenados[0];
  }

  // 7. Unificar todos los candidatos únicos asegurando que el principal esté de primero
  const lista_final: string[] = [];
  if (serial_principal) {
    lista_final.push(serial_principal);
  }

  const agregar_si_nuevo = (valor: string) => {
    if (!valor) return;
    const v_limpio = limpiar_serial(valor);
    if (es_candidato_valido(v_limpio, true) && !lista_final.includes(v_limpio)) {
      lista_final.push(v_limpio);
    }
  };

  candidatos_sn.forEach(agregar_si_nuevo);
  barcodes_adicionales.forEach(agregar_si_nuevo);
  candidatos_otros_labels.forEach(agregar_si_nuevo);
  candidatos_numericos.forEach(agregar_si_nuevo);
  candidatos_tokens.forEach(agregar_si_nuevo);

  return {
    principal: serial_principal,
    candidatos: lista_final,
    es_sn_detectado
  };
}

/**
 * Función principal de extracción de serial por imagen: decodifica códigos de barra
 * y procesa texto OCR para priorizar S/N y recopilar candidatos alternativos.
 */
export async function procesar_imagen_serial(
  archivo: File,
  notificar_progreso?: (mensaje: string, porcentaje: number) => void
): Promise<ResultadoExtraccionSerial> {
  notificar_progreso?.('Optimizando imagen...', 15);

  const { canvas, canvas_binarizado, url_procesada, img_original } = await preprocesar_imagen_para_ocr(archivo);

  // 1. Escaneo de códigos de barras (instantáneo y ultra preciso con capas antirreflejo)
  notificar_progreso?.('Decodificando códigos de barras y etiquetas...', 35);
  const codigos_barras = await escanear_codigos_de_barras(canvas, img_original, canvas_binarizado);

  // 2. Reconocimiento OCR con Tesseract.js para extraer texto impreso y buscar etiquetas S/N
  notificar_progreso?.('Analizando caracteres y números con OCR...', 60);

  let worker = null;
  let texto_extraido = '';
  let confianza_ocr = 0;

  try {
    worker = await createWorker('eng+spa');
    
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-/:#.|\\'
    });

    notificar_progreso?.('Extrayendo serial de la etiqueta...', 80);
    // Se procesa preferentemente sobre el canvas binarizado adaptativo que elimina brillos de flash
    const resultado_ocr = await worker.recognize(canvas_binarizado || canvas);

    texto_extraido = resultado_ocr.data.text || '';
    confianza_ocr = Math.round(resultado_ocr.data.confidence || 0);

    await worker.terminate();
    worker = null;
  } catch (error) {
    if (worker) {
      try {
        await (worker as unknown as { terminate: () => Promise<void> }).terminate();
      } catch {
        // Ignorar error al terminar worker
      }
    }
    console.warn('Advertencia en OCR, continuando con códigos de barras detectados:', error);
  }

  // 3. Extraer candidatos priorizando "S/N" si existe, o código de barras/patrones existentes
  const { principal, candidatos, es_sn_detectado } = extraer_candidatos_serial(texto_extraido, codigos_barras);

  notificar_progreso?.('Listo', 100);

  const metodo_final: 'codigo_barras' | 'ocr' | 'ninguno' = !principal
    ? 'ninguno'
    : (codigos_barras.length > 0 && codigos_barras.includes(principal))
      ? 'codigo_barras'
      : (texto_extraido ? 'ocr' : (codigos_barras.length > 0 ? 'codigo_barras' : 'ninguno'));

  return {
    serial_detectado: principal,
    candidatos_alternativos: candidatos,
    metodo: metodo_final,
    confianza: metodo_final === 'codigo_barras' ? 100 : (confianza_ocr || 90),
    texto_completo: texto_extraido || (codigos_barras.length > 0 ? `Códigos decodificados: ${codigos_barras.join(', ')}` : ''),
    imagen_procesada_url: url_procesada,
    es_sn_priorizado: es_sn_detectado
  };
}
