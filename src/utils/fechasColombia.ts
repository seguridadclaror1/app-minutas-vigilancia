/**
 * Utilidades para manejo y formateo de fechas en horario de Colombia (America/Bogota, UTC-5)
 * Directriz: Todo el código y comentarios en español.
 */

export const ZONA_HORARIA_COLOMBIA = 'America/Bogota';
export const DESFASE_COLOMBIA = '-05:00';

/**
 * Genera el rango ISO con el offset -05:00 para realizar consultas precisas en Supabase/PostgreSQL.
 * 
 * @param fechaInicio Fecha de inicio en formato 'YYYY-MM-DD'
 * @param fechaFin Fecha de fin opcional en formato 'YYYY-MM-DD' (si no se especifica, se usa fechaInicio)
 * @returns { desde: string, hasta: string } Rangos con offset horario colombiano
 */
export function obtenerRangoUtcParaFiltroColombia(
  fechaInicio: string,
  fechaFin?: string
): { desde: string; hasta: string } {
  if (!fechaInicio) {
    return { desde: '', hasta: '' };
  }

  const finAUsar = fechaFin && fechaFin.trim() !== '' ? fechaFin.trim() : fechaInicio.trim();
  const inicioLimpio = fechaInicio.trim();

  // Inicio del día en Colombia: 00:00:00.000 con -05:00
  const desde = `${inicioLimpio}T00:00:00.000-05:00`;
  // Fin del día en Colombia: 23:59:59.999 con -05:00
  const hasta = `${finAUsar}T23:59:59.999-05:00`;

  return { desde, hasta };
}

/**
 * Formatea una fecha o cadena ISO a formato colombiano 'DD/MM/YYYY'.
 */
export function formatearFechaColombia(isoOFecha: string | Date | null | undefined): string {
  if (!isoOFecha) return '-';
  try {
    const fecha = typeof isoOFecha === 'string' ? new Date(isoOFecha) : isoOFecha;
    if (isNaN(fecha.getTime())) return '-';

    return new Intl.DateTimeFormat('es-CO', {
      timeZone: ZONA_HORARIA_COLOMBIA,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(fecha);
  } catch (error) {
    console.error('Error al formatear fecha colombiana:', error);
    return '-';
  }
}

/**
 * Formatea una fecha o cadena ISO a formato colombiano 'DD/MM/YYYY, HH:mm' (24 horas).
 */
export function formatearFechaHoraColombia(isoOFecha: string | Date | null | undefined): string {
  if (!isoOFecha) return '-';
  try {
    const fecha = typeof isoOFecha === 'string' ? new Date(isoOFecha) : isoOFecha;
    if (isNaN(fecha.getTime())) return '-';

    return new Intl.DateTimeFormat('es-CO', {
      timeZone: ZONA_HORARIA_COLOMBIA,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(fecha);
  } catch (error) {
    console.error('Error al formatear fecha y hora colombiana:', error);
    return '-';
  }
}

/**
 * Obtiene la clave 'YYYY-MM-DD' de una fecha o ISO en la zona horaria de Colombia.
 * Evita el problema de desfase por UTC donde registros de la noche se asignan al día siguiente.
 */
export function obtenerClaveFechaColombia(isoOFecha: string | Date): string {
  try {
    const fecha = typeof isoOFecha === 'string' ? new Date(isoOFecha) : isoOFecha;
    if (isNaN(fecha.getTime())) return '';

    // 'en-CA' produce formato 'YYYY-MM-DD'
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: ZONA_HORARIA_COLOMBIA,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(fecha);
  } catch (error) {
    console.error('Error al obtener clave de fecha colombiana:', error);
    return '';
  }
}
