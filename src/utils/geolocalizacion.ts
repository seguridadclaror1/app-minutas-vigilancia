import type { Sede } from '../types/database';

/**
 * Representa las coordenadas GPS obtenidas del dispositivo móvil o navegador.
 */
export interface CoordenadasGPS {
  latitud: number;
  longitud: number;
  precision?: number;
}

/**
 * Resultado del análisis de geocercas respecto a las sedes registradas.
 */
export interface ResultadoGeocerca {
  /** Sede autorizada si el usuario está físicamente dentro de su radio */
  sedeAutorizada: Sede | null;
  /** Sede más cercana geográficamente */
  sedeMasCercana: Sede | null;
  /** Distancia en metros a la sede más cercana */
  distanciaMetros: number | null;
  /** Indica si está dentro del radio permitido de alguna sede */
  estaDentroGeocerca: boolean;
}

/**
 * Calcula la distancia en metros entre dos coordenadas geográficas utilizando la fórmula de Haversine.
 * 
 * @param latitud1 Latitud del punto de origen
 * @param longitud1 Longitud del punto de origen
 * @param latitud2 Latitud del punto de destino
 * @param longitud2 Longitud del punto de destino
 * @returns Distancia en metros (entero redondeado)
 */
export function calcularDistanciaMetros(
  latitud1: number,
  longitud1: number,
  latitud2: number,
  longitud2: number
): number {
  const radioTierraMetros = 6371000;
  const dLatitud = ((latitud2 - latitud1) * Math.PI) / 180;
  const dLongitud = ((longitud2 - longitud1) * Math.PI) / 180;

  const lat1Rad = (latitud1 * Math.PI) / 180;
  const lat2Rad = (latitud2 * Math.PI) / 180;

  const a =
    Math.sin(dLatitud / 2) * Math.sin(dLatitud / 2) +
    Math.sin(dLongitud / 2) *
      Math.sin(dLongitud / 2) *
      Math.cos(lat1Rad) *
      Math.cos(lat2Rad);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(radioTierraMetros * c);
}

/**
 * Evalúa las coordenadas actuales del usuario frente al catálogo de sedes.
 * 
 * @param coordenadas Posición actual del usuario
 * @param sedes Lista de sedes disponibles
 * @returns Análisis detallado de cercanía y autorización
 */
export function evaluarGeocercaUsuario(
  coordenadas: CoordenadasGPS,
  sedes: Sede[]
): ResultadoGeocerca {
  // Filtrar solo sedes que posean coordenadas válidas
  const sedesConCoordenadas = sedes.filter(
    (s): s is Sede & { latitud: number; longitud: number } =>
      typeof s.latitud === 'number' && typeof s.longitud === 'number'
  );

  if (sedesConCoordenadas.length === 0) {
    return {
      sedeAutorizada: null,
      sedeMasCercana: null,
      distanciaMetros: null,
      estaDentroGeocerca: false
    };
  }

  let sedeMasCercana: Sede | null = null;
  let menorDistancia = Infinity;

  for (const sede of sedesConCoordenadas) {
    const distancia = calcularDistanciaMetros(
      coordenadas.latitud,
      coordenadas.longitud,
      sede.latitud,
      sede.longitud
    );

    if (distancia < menorDistancia) {
      menorDistancia = distancia;
      sedeMasCercana = sede;
    }
  }

  if (!sedeMasCercana) {
    return {
      sedeAutorizada: null,
      sedeMasCercana: null,
      distanciaMetros: null,
      estaDentroGeocerca: false
    };
  }

  const radioPermitido = sedeMasCercana.radio_metros ?? 150;
  const estaDentro = menorDistancia <= radioPermitido;

  return {
    sedeAutorizada: estaDentro ? sedeMasCercana : null,
    sedeMasCercana,
    distanciaMetros: menorDistancia,
    estaDentroGeocerca: estaDentro
  };
}
