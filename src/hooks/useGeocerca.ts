import { useState, useEffect, useCallback } from 'react';
import type { Sede } from '../types/database';
import {
  evaluarGeocercaUsuario,
  type CoordenadasGPS,
  type ResultadoGeocerca
} from '../utils/geolocalizacion';

export interface EstadoGeocerca extends ResultadoGeocerca {
  cargandoUbicacion: boolean;
  coordenadas: CoordenadasGPS | null;
  errorGps: string | null;
  actualizarUbicacion: () => void;
}

/**
 * Hook personalizado para gestionar la geocerca satelital por GPS en los puestos de vigilancia.
 * 
 * @param sedes Lista de sedes disponibles
 * @param autoIniciar Si debe solicitar la ubicación automáticamente al montar el componente (default: true)
 */
export function useGeocerca(sedes: Sede[], autoIniciar: boolean = true): EstadoGeocerca {
  const [cargandoUbicacion, setCargandoUbicacion] = useState<boolean>(false);
  const [coordenadas, setCoordenadas] = useState<CoordenadasGPS | null>(null);
  const [errorGps, setErrorGps] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoGeocerca>({
    sedeAutorizada: null,
    sedeMasCercana: null,
    distanciaMetros: null,
    estaDentroGeocerca: false
  });

  const evaluar = useCallback(
    (coords: CoordenadasGPS, listaSedes: Sede[]) => {
      const res = evaluarGeocercaUsuario(coords, listaSedes);
      setResultado(res);
    },
    []
  );

  const actualizarUbicacion = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setErrorGps('Su dispositivo o navegador no soporta geolocalización GPS.');
      return;
    }

    setCargandoUbicacion(true);
    setErrorGps(null);

    navigator.geolocation.getCurrentPosition(
      (posicion) => {
        const coords: CoordenadasGPS = {
          latitud: posicion.coords.latitude,
          longitud: posicion.coords.longitude,
          precision: Math.round(posicion.coords.accuracy)
        };
        setCoordenadas(coords);
        setCargandoUbicacion(false);
        evaluar(coords, sedes);
      },
      (error) => {
        setCargandoUbicacion(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setErrorGps('Permiso de GPS denegado. Active la ubicación en su navegador.');
            break;
          case error.POSITION_UNAVAILABLE:
            setErrorGps('Señal GPS no disponible. Asegúrese de tener el GPS encendido.');
            break;
          case error.TIMEOUT:
            setErrorGps('Tiempo de espera agotado al obtener coordenadas GPS.');
            break;
          default:
            setErrorGps('Ocurrió un error al obtener la ubicación satelital.');
            break;
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  }, [sedes, evaluar]);

  // Ejecutar automáticamente al tener sedes cargadas
  useEffect(() => {
    if (autoIniciar && sedes.length > 0) {
      actualizarUbicacion();
    }
  }, [autoIniciar, sedes.length, actualizarUbicacion]);

  // Si cambian las sedes y ya tenemos coordenadas, reevaluar
  useEffect(() => {
    if (coordenadas && sedes.length > 0) {
      evaluar(coordenadas, sedes);
    }
  }, [sedes, coordenadas, evaluar]);

  return {
    ...resultado,
    cargandoUbicacion,
    coordenadas,
    errorGps,
    actualizarUbicacion
  };
}
