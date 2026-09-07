import { useState, useEffect, useMemo } from 'react';
import {
  HardDrive,
  Database,
  Image as ImageIcon,
  TrendingUp,
  RefreshCw,
  Copy,
  Check,
  Server,
  Sparkles,
  Layers,
  ChevronRight,
  Calendar,
  AlertTriangle,
  ArrowUpLeft
} from 'lucide-react';
import { supabase } from '../../config/supabase';
import { obtenerClaveFechaColombia, ZONA_HORARIA_COLOMBIA } from '../../utils/fechasColombia';
import PremiumDatePicker from '../../components/PremiumDatePicker';
import './SeccionAlmacenamiento.css';

// Utilidad para formatear bytes a KB, MB o GB (soporta 1 decimal para GB)
export function formatearBytes(bytes: number, decimalesGB: number = 0): { valor: string; unidad: string; full: string } {
  if (bytes === 0 || !bytes) {
    return { valor: '0', unidad: 'KB', full: '0 KB' };
  }
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  const unidad = sizes[i] || 'Bytes';
  const esGB = unidad === 'GB' || unidad === 'TB';
  const dec = esGB ? decimalesGB : 0;
  const divisor = Math.pow(k, i);
  const valorNum = dec > 0 ? (bytes / divisor) : Math.round(bytes / divisor);
  const valor = dec > 0 ? valorNum.toFixed(dec) : valorNum.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return { valor, unidad, full: `${valor} ${unidad}` };
}

interface MetricasDetalleTabla {
  tabla: string;
  tamano_bytes: number;
  tamano_datos: number;
  tamano_indices: number;
}

interface MetricasAlmacenamientoData {
  db_total_bytes: number;
  schema_bytes: number;
  storage_bytes: number;
  total_fotos: number;
  tablas: MetricasDetalleTabla[];
  fotos_por_dia: Record<string, number>;
  minutas_por_dia: Record<string, number>;
  fecha_consulta?: string;
}

type RangoPredefinidoStorage = 'todos' | 'hoy' | 'ayer' | '7d' | 'mes' | 'mes_pasado' | '30d' | 'trimestre' | 'custom';
type NivelGranularidad = 'mes' | 'semana' | 'dia';

const MESES_NOMBRES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

interface ItemGraficoStorage {
  id: string;              // Clave única (ej. '2026-08', 'sem-3', '2026-08-25')
  label: string;           // Texto visible en eje X (ej. '1 de sept', 'Semana 1', 'Agosto')
  subLabel?: string;       // Texto complementario (ej. 'mar', '15-21 Ago', '2026')
  fechaTexto: string;      // Texto completo para tooltip
  bytesFotos: number;
  bytesDb: number;
  totalBytes: number;
  cantFotos: number;
  cantMinutas: number;
  fechaInicio: Date;
  fechaFin: Date;
}

export default function SeccionAlmacenamiento() {
  const [loading, setLoading] = useState(true);
  const [metricas, setMetricas] = useState<MetricasAlmacenamientoData | null>(null);

  // Estados de Filtro Temporal en Almacenamiento (por defecto 'todos' para ver todo el historial)
  const [rango, setRango] = useState<RangoPredefinidoStorage>('todos');
  const [fechaCustom, setFechaCustom] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [claveSelectorPersonalizado, setClaveSelectorPersonalizado] = useState(0);

  // Manejador toggle: si se hace clic en el filtro ya activo, se desactiva y vuelve a 'todos'
  const handleToggleRango = (nuevoRango: RangoPredefinidoStorage) => {
    if (rango === nuevoRango) {
      setRango('todos');
    } else {
      setRango(nuevoRango);
      if (nuevoRango === 'custom') {
        setClaveSelectorPersonalizado((c) => c + 1);
      }
    }
  };

  // Nivel de granularidad actual en la gráfica (Día / Semana / Mes)
  const [nivel, setNivel] = useState<NivelGranularidad>('dia');

  // Estados de Drill-Down
  const [filtroMes, setFiltroMes] = useState<{ id: string; label: string; start: Date; end: Date } | null>(null);
  const [filtroSemana, setFiltroSemana] = useState<{ id: string; label: string; start: Date; end: Date } | null>(null);
  const [hoveredDiaIdx, setHoveredDiaIdx] = useState<number | null>(null);

  // Estados del Simulador de Proyección
  const [anosProyeccion, setAnosProyeccion] = useState<number>(1);
  const [multiplicadorEscalamiento, setMultiplicadorEscalamiento] = useState<number>(1);
  const [copiado, setCopiado] = useState(false);

  // Estados de datos
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  // ─── Carga de Datos 100% Reales desde PostgreSQL y Storage ────
  const cargarMetricas = async () => {
    setLoading(true);
    setErrorCarga(null);
    try {
      // 1. Invocar la función RPC directamente desde el esquema public
      let res = await supabase.schema('public').rpc('obtener_metricas_almacenamiento');

      if (res.error || !res.data) {
        // Intento de rescate por si se creó en el esquema Minuta_seguridad
        const resDef = await supabase.rpc('obtener_metricas_almacenamiento');
        if (!resDef.error && resDef.data) {
          res = resDef;
        }
      }

      if (res.error) {
        console.error('Error al consultar métricas reales en Supabase:', res.error);
        setErrorCarga(`Error de conexión con Supabase: ${res.error.message || 'No se pudo obtener la información de la base de datos'}`);
        return;
      }

      if (res.data) {
        setMetricas(res.data as MetricasAlmacenamientoData);
      }
    } catch (err: any) {
      console.error('Excepción al cargar métricas:', err);
      setErrorCarga(`Error inesperado: ${err?.message || 'Error al conectar con el servidor'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarMetricas();
  }, []);

  // ─── Cálculos Generales de Almacenamiento ──────────────────────
  // Tamaño físico completo de la instancia PostgreSQL (el mismo valor que muestra Supabase en su panel Usage)
  const totalBaseDatosBytes = (metricas?.db_total_bytes && metricas.db_total_bytes > 0)
    ? metricas.db_total_bytes
    : (metricas?.schema_bytes || 0);

  const totalFotosBytes = metricas?.storage_bytes || 0;
  const almacenamientoTotalBytes = totalBaseDatosBytes + totalFotosBytes;

  // Promedio por foto
  const promedioPorFotoBytes = metricas?.total_fotos && metricas.total_fotos > 0
    ? Math.round(totalFotosBytes / metricas.total_fotos)
    : 245 * 1024;

  // Total de minutas registradas
  const totalMinutasConteo = useMemo(() => {
    if (!metricas?.minutas_por_dia) return 0;
    return Object.values(metricas.minutas_por_dia).reduce((a, b) => a + b, 0);
  }, [metricas]);

  // Días con actividad registrada
  const diasActivosSet = useMemo(() => {
    const set = new Set<string>();
    if (metricas?.fotos_por_dia) Object.keys(metricas.fotos_por_dia).forEach(d => set.add(d));
    if (metricas?.minutas_por_dia) Object.keys(metricas.minutas_por_dia).forEach(d => set.add(d));
    return Array.from(set).sort();
  }, [metricas]);

  const diasConActividad = Math.max(1, diasActivosSet.length);

  // Tasa de crecimiento diario promedio
  const tasaDiariaBytes = almacenamientoTotalBytes > 0 ? Math.round(almacenamientoTotalBytes / diasConActividad) : 0;
  const tasaDiariaDbBytes = totalBaseDatosBytes > 0 ? Math.round(totalBaseDatosBytes / diasConActividad) : 0;
  const tasaDiariaFotosBytes = totalFotosBytes > 0 ? Math.round(totalFotosBytes / diasConActividad) : 0;

  // ─── Filtrado por Rango de Fechas en Almacenamiento ──────────
  const { fechaInicio, fechaFin, periodoTitulo } = useMemo(() => {
    const ahora = new Date();
    const claveHoy = obtenerClaveFechaColombia(ahora);
    const [yH, mH, dH] = claveHoy.split('-').map(Number);

    let inicio = new Date();
    let fin = new Date();
    let titulo = 'Histórico Total';

    if (rango === 'todos') {
      if (diasActivosSet.length > 0) {
        const [yI, mI, dI] = diasActivosSet[0].split('-').map(Number);
        inicio = new Date(yI, mI - 1, dI, 0, 0, 0, 0);
      } else {
        inicio = new Date(yH, mH - 1, dH - 29, 0, 0, 0, 0);
      }
      fin = new Date(yH, mH - 1, dH, 23, 59, 59, 999);
      titulo = 'Histórico Total';
    } else if (rango === 'hoy') {
      inicio = new Date(yH, mH - 1, dH, 0, 0, 0, 0);
      fin = new Date(yH, mH - 1, dH, 23, 59, 59, 999);
      titulo = 'Hoy';
    } else if (rango === 'ayer') {
      inicio = new Date(yH, mH - 1, dH - 1, 0, 0, 0, 0);
      fin = new Date(yH, mH - 1, dH - 1, 23, 59, 59, 999);
      titulo = 'Ayer';
    } else if (rango === '7d') {
      inicio = new Date(yH, mH - 1, dH - 6, 0, 0, 0, 0);
      fin = new Date(yH, mH - 1, dH, 23, 59, 59, 999);
      titulo = 'Últimos 7 días';
    } else if (rango === 'mes') {
      inicio = new Date(yH, mH - 1, 1, 0, 0, 0, 0);
      fin = new Date(yH, mH - 1, dH, 23, 59, 59, 999);
      titulo = 'Este Mes';
    } else if (rango === 'mes_pasado') {
      inicio = new Date(yH, mH - 2, 1, 0, 0, 0, 0);
      fin = new Date(yH, mH - 1, 0, 23, 59, 59, 999);
      const nombreMesPasado = inicio.toLocaleDateString('es-CO', { timeZone: ZONA_HORARIA_COLOMBIA, month: 'long' });
      titulo = `Mes Pasado (${nombreMesPasado.charAt(0).toUpperCase() + nombreMesPasado.slice(1)})`;
    } else if (rango === '30d') {
      inicio = new Date(yH, mH - 1, dH - 29, 0, 0, 0, 0);
      fin = new Date(yH, mH - 1, dH, 23, 59, 59, 999);
      titulo = 'Últimos 30 días';
    } else if (rango === 'trimestre') {
      inicio = new Date(yH, mH - 1, dH - 89, 0, 0, 0, 0);
      fin = new Date(yH, mH - 1, dH, 23, 59, 59, 999);
      titulo = 'Último Trimestre (90 días)';
    } else if (rango === 'custom') {
      if (fechaCustom.start) {
        const [y, m, d] = fechaCustom.start.split('-').map(Number);
        inicio = new Date(y, m - 1, d, 0, 0, 0, 0);
      } else {
        inicio = new Date(yH, mH - 1, dH - 29, 0, 0, 0, 0);
      }

      if (fechaCustom.end) {
        const [y, m, d] = fechaCustom.end.split('-').map(Number);
        fin = new Date(y, m - 1, d, 23, 59, 59, 999);
      } else if (fechaCustom.start) {
        const [y, m, d] = fechaCustom.start.split('-').map(Number);
        fin = new Date(y, m - 1, d, 23, 59, 59, 999);
      } else {
        fin = new Date(yH, mH - 1, dH, 23, 59, 59, 999);
      }

      if (fechaCustom.start && fechaCustom.end) {
        const [sy, sm, sd] = fechaCustom.start.split('-');
        const [ey, em, ed] = fechaCustom.end.split('-');
        titulo = `Rango (${sd}/${sm}/${sy} a ${ed}/${em}/${ey})`;
      } else if (fechaCustom.start) {
        const [sy, sm, sd] = fechaCustom.start.split('-');
        titulo = `Día (${sd}/${sm}/${sy})`;
      } else {
        titulo = 'Rango Personalizado';
      }
    }

    return { fechaInicio: inicio, fechaFin: fin, periodoTitulo: titulo };
  }, [rango, fechaCustom, diasActivosSet]);

  // Sincronizar nivel por defecto según la amplitud del periodo seleccionado
  useEffect(() => {
    // Reiniciar drill-down al cambiar de rango temporal
    setFiltroMes(null);
    setFiltroSemana(null);

    if (rango === 'hoy' || rango === 'ayer' || rango === '7d') {
      setNivel('dia');
    } else if (rango === 'trimestre') {
      setNivel('mes');
    } else {
      const diffDias = Math.ceil((fechaFin.getTime() - fechaInicio.getTime()) / (24 * 60 * 60 * 1000));
      if (diffDias <= 14) {
        setNivel('dia');
      } else if (diffDias > 45) {
        setNivel('mes');
      } else {
        setNivel('semana');
      }
    }
  }, [rango, fechaInicio, fechaFin]);

  // ─── Métricas Filtradas por el Periodo Seleccionado ──────────
  const {
    totalPeriodoBytes,
    fotosEnPeriodoBytes,
    dbEnPeriodoBytes,
    porcentajeFotosPeriodo,
    porcentajeDbPeriodo,
    cantFotosEnPeriodo,
    totalMinutasEnPeriodo,
    diasActivosEnPeriodo,
    tasaDiariaPeriodoBytes
  } = useMemo(() => {
    if (!metricas) {
      return {
        totalPeriodoBytes: 0,
        fotosEnPeriodoBytes: 0,
        dbEnPeriodoBytes: 0,
        porcentajeFotosPeriodo: 0,
        porcentajeDbPeriodo: 0,
        cantFotosEnPeriodo: 0,
        totalMinutasEnPeriodo: 0,
        diasActivosEnPeriodo: 1,
        tasaDiariaPeriodoBytes: 0
      };
    }

    if (rango === 'todos') {
      const dbTotal = totalBaseDatosBytes;
      const fotosTotal = totalFotosBytes;
      const total = almacenamientoTotalBytes;
      const porcFotos = total > 0 ? (fotosTotal / total) * 100 : 0;
      const porcDb = total > 0 ? (dbTotal / total) * 100 : 0;
      return {
        totalPeriodoBytes: total,
        fotosEnPeriodoBytes: fotosTotal,
        dbEnPeriodoBytes: dbTotal,
        porcentajeFotosPeriodo: porcFotos,
        porcentajeDbPeriodo: porcDb,
        cantFotosEnPeriodo: metricas.total_fotos || 0,
        totalMinutasEnPeriodo: totalMinutasConteo,
        diasActivosEnPeriodo: diasConActividad,
        tasaDiariaPeriodoBytes: tasaDiariaBytes
      };
    }

    let fBytesTotal = 0;
    let mCountTotal = 0;
    let diasConActividadPeriodo = 0;

    diasActivosSet.forEach((fechaStr) => {
      const [y, m, d] = fechaStr.split('-').map(Number);
      const f = new Date(y, m - 1, d, 12, 0, 0);
      if (f >= fechaInicio && f <= fechaFin) {
        const fBytes = metricas.fotos_por_dia?.[fechaStr] || 0;
        const mCount = metricas.minutas_por_dia?.[fechaStr] || 0;
        fBytesTotal += fBytes;
        mCountTotal += mCount;
        if (fBytes > 0 || mCount > 0) {
          diasConActividadPeriodo++;
        }
      }
    });

    const dbBytesTotal = mCountTotal * 1800;
    const totalBytes = fBytesTotal + dbBytesTotal;
    const porcFotos = totalBytes > 0 ? (fBytesTotal / totalBytes) * 100 : 0;
    const porcDb = totalBytes > 0 ? (dbBytesTotal / totalBytes) * 100 : 0;
    const cantFotos = promedioPorFotoBytes > 0 ? Math.round(fBytesTotal / promedioPorFotoBytes) : 0;
    const divisor = Math.max(1, diasConActividadPeriodo);
    const tasaDiaria = totalBytes > 0 ? Math.round(totalBytes / divisor) : 0;

    return {
      totalPeriodoBytes: totalBytes,
      fotosEnPeriodoBytes: fBytesTotal,
      dbEnPeriodoBytes: dbBytesTotal,
      porcentajeFotosPeriodo: porcFotos,
      porcentajeDbPeriodo: porcDb,
      cantFotosEnPeriodo: cantFotos,
      totalMinutasEnPeriodo: mCountTotal,
      diasActivosEnPeriodo: diasConActividadPeriodo,
      tasaDiariaPeriodoBytes: tasaDiaria
    };
  }, [
    metricas,
    diasActivosSet,
    fechaInicio,
    fechaFin,
    promedioPorFotoBytes,
    rango,
    totalBaseDatosBytes,
    totalFotosBytes,
    almacenamientoTotalBytes,
    totalMinutasConteo,
    diasConActividad,
    tasaDiariaBytes
  ]);

  // ─── Generación de Datos según el Nivel de Granularidad Activo ─
  const itemsGrafico: ItemGraficoStorage[] = useMemo(() => {
    if (!metricas) return [];

    // Determinar rango efectivo considerando navegación jerárquica (Drill-Down)
    const inicioEfectivo = filtroSemana ? filtroSemana.start : (filtroMes ? filtroMes.start : fechaInicio);
    const finEfectivo = filtroSemana ? filtroSemana.end : (filtroMes ? filtroMes.end : fechaFin);

    // ── NIVEL MES ────────────────────────────────────────────────
    if (nivel === 'mes') {
      const mesesMap = new Map<string, ItemGraficoStorage>();
      const cur = new Date(inicioEfectivo.getFullYear(), inicioEfectivo.getMonth(), 1, 0, 0, 0, 0);
      const endLimit = new Date(finEfectivo.getFullYear(), finEfectivo.getMonth(), 1, 0, 0, 0, 0);
      let maxIter = 120;

      while (cur <= endLimit && maxIter-- > 0) {
        const y = cur.getFullYear();
        const m = cur.getMonth();
        const key = `${y}-${String(m + 1).padStart(2, '0')}`;
        const mesStart = new Date(y, m, 1, 0, 0, 0, 0);
        const mesEnd = new Date(y, m + 1, 0, 23, 59, 59, 999);
        const label = MESES_NOMBRES[m];

        mesesMap.set(key, {
          id: key,
          label,
          subLabel: String(y),
          fechaTexto: `${label} de ${y}`,
          bytesFotos: 0,
          bytesDb: 0,
          totalBytes: 0,
          cantFotos: 0,
          cantMinutas: 0,
          fechaInicio: mesStart,
          fechaFin: mesEnd
        });

        cur.setMonth(cur.getMonth() + 1);
      }

      diasActivosSet.forEach((fechaStr) => {
        const [y, m, d] = fechaStr.split('-').map(Number);
        const f = new Date(y, m - 1, d, 12, 0, 0);
        if (f >= inicioEfectivo && f <= finEfectivo) {
          const key = fechaStr.slice(0, 7);
          const item = mesesMap.get(key);
          if (item) {
            const fotosBytes = metricas.fotos_por_dia?.[fechaStr] || 0;
            const minutas = metricas.minutas_por_dia?.[fechaStr] || 0;
            const dbBytes = minutas * 1800;
            item.bytesFotos += fotosBytes;
            item.bytesDb += dbBytes;
            item.totalBytes += (fotosBytes + dbBytes);
            item.cantMinutas += minutas;
          }
        }
      });

      mesesMap.forEach((item) => {
        item.cantFotos = promedioPorFotoBytes > 0 ? Math.round(item.bytesFotos / promedioPorFotoBytes) : 0;
      });

      return Array.from(mesesMap.values());
    }

    // ── NIVEL SEMANA ─────────────────────────────────────────────
    if (nivel === 'semana') {
      const semanasList: ItemGraficoStorage[] = [];
      let iter = new Date(inicioEfectivo);
      iter.setHours(0, 0, 0, 0);
      let semIdx = 1;
      let maxIter = 250;

      while (iter <= finEfectivo && maxIter-- > 0) {
        const semStart = new Date(iter);
        semStart.setHours(0, 0, 0, 0);

        const semEnd = new Date(semStart);
        semEnd.setDate(semEnd.getDate() + 6);
        semEnd.setHours(23, 59, 59, 999);

        const alcanzaFin = semEnd >= finEfectivo;
        if (alcanzaFin) {
          semEnd.setTime(finEfectivo.getTime());
        }

        const startStr = semStart.toLocaleDateString('es-CO', { timeZone: ZONA_HORARIA_COLOMBIA, day: 'numeric', month: 'short' }).replace('.', '');
        const endStr = semEnd.toLocaleDateString('es-CO', { timeZone: ZONA_HORARIA_COLOMBIA, day: 'numeric', month: 'short' }).replace('.', '');

        semanasList.push({
          id: `sem-${semIdx}`,
          label: `Semana ${semIdx}`,
          subLabel: `${startStr} - ${endStr}`,
          fechaTexto: `Semana ${semIdx} (${startStr} al ${endStr})`,
          bytesFotos: 0,
          bytesDb: 0,
          totalBytes: 0,
          cantFotos: 0,
          cantMinutas: 0,
          fechaInicio: semStart,
          fechaFin: semEnd
        });

        if (alcanzaFin) break;
        semIdx++;
        iter.setDate(iter.getDate() + 7);
        iter.setHours(0, 0, 0, 0);
      }

      diasActivosSet.forEach((fechaStr) => {
        const [y, m, d] = fechaStr.split('-').map(Number);
        const f = new Date(y, m - 1, d, 12, 0, 0);
        const semItem = semanasList.find((s) => f >= s.fechaInicio && f <= s.fechaFin);
        if (semItem) {
          const fotosBytes = metricas.fotos_por_dia?.[fechaStr] || 0;
          const minutas = metricas.minutas_por_dia?.[fechaStr] || 0;
          const dbBytes = minutas * 1800;
          semItem.bytesFotos += fotosBytes;
          semItem.bytesDb += dbBytes;
          semItem.totalBytes += (fotosBytes + dbBytes);
          semItem.cantMinutas += minutas;
        }
      });

      semanasList.forEach((item) => {
        item.cantFotos = promedioPorFotoBytes > 0 ? Math.round(item.bytesFotos / promedioPorFotoBytes) : 0;
      });

      return semanasList;
    }

    // ── NIVEL DÍA ────────────────────────────────────────────────
    const diasMap = new Map<string, ItemGraficoStorage>();
    let diaIter = new Date(inicioEfectivo);
    diaIter.setHours(0, 0, 0, 0);
    let maxIter = 400;

    while (diaIter <= finEfectivo && maxIter-- > 0) {
      const key = obtenerClaveFechaColombia(diaIter);
      const dStart = new Date(diaIter);
      dStart.setHours(0, 0, 0, 0);
      const dEnd = new Date(diaIter);
      dEnd.setHours(23, 59, 59, 999);

      const dNum = diaIter.getDate();
      const mShort = diaIter.toLocaleDateString('es-CO', { timeZone: ZONA_HORARIA_COLOMBIA, month: 'short' }).replace('.', '');
      const label = `${dNum} de ${mShort}`;
      const subLabel = diaIter.toLocaleDateString('es-CO', { timeZone: ZONA_HORARIA_COLOMBIA, weekday: 'short' });
      const fechaTexto = diaIter.toLocaleDateString('es-CO', { timeZone: ZONA_HORARIA_COLOMBIA, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

      diasMap.set(key, {
        id: key,
        label,
        subLabel,
        fechaTexto,
        bytesFotos: 0,
        bytesDb: 0,
        totalBytes: 0,
        cantFotos: 0,
        cantMinutas: 0,
        fechaInicio: dStart,
        fechaFin: dEnd
      });

      diaIter.setDate(diaIter.getDate() + 1);
      diaIter.setHours(0, 0, 0, 0);
    }

    diasMap.forEach((item, key) => {
      const fotosBytes = metricas.fotos_por_dia?.[key] || 0;
      const minutas = metricas.minutas_por_dia?.[key] || 0;
      const dbBytes = minutas * 1800;
      item.bytesFotos = fotosBytes;
      item.bytesDb = dbBytes;
      item.totalBytes = fotosBytes + dbBytes;
      item.cantMinutas = minutas;
      item.cantFotos = promedioPorFotoBytes > 0 ? Math.round(fotosBytes / promedioPorFotoBytes) : 0;
    });

    return Array.from(diasMap.values());
  }, [metricas, diasActivosSet, promedioPorFotoBytes, fechaInicio, fechaFin, nivel, filtroMes, filtroSemana]);

  // ─── Manejadores de Drill-Down y Drill-Up ─────────────────────
  const handleBarClick = (item: ItemGraficoStorage) => {
    if (nivel === 'mes') {
      setFiltroMes({ id: item.id, label: item.label, start: item.fechaInicio, end: item.fechaFin });
      setNivel('semana');
      setHoveredDiaIdx(null);
    } else if (nivel === 'semana') {
      setFiltroSemana({ id: item.id, label: `${item.label} (${item.subLabel || ''})`, start: item.fechaInicio, end: item.fechaFin });
      setNivel('dia');
      setHoveredDiaIdx(null);
    }
  };

  const handleSubirNivel = () => {
    if (filtroSemana) {
      setFiltroSemana(null);
      setNivel('semana');
    } else if (filtroMes) {
      setFiltroMes(null);
      setNivel('mes');
    } else if (nivel === 'dia') {
      setNivel('semana');
    } else if (nivel === 'semana') {
      setNivel('mes');
    }
  };

  const maxValGrafico = useMemo(() => {
    const max = Math.max(...itemsGrafico.map(d => d.totalBytes), 1024 * 1024);
    return max;
  }, [itemsGrafico]);

  const totalBytesEnPeriodo = useMemo(() => {
    return itemsGrafico.reduce((acc, item) => acc + item.totalBytes, 0);
  }, [itemsGrafico]);

  const tituloNivel = nivel === 'mes'
    ? 'Almacenamiento por Mes'
    : (nivel === 'semana' ? 'Almacenamiento por Semana' : 'Almacenamiento por Día');

  // ─── LÓGICA DE PROYECCIÓN ─────────────────────────────────────
  const diasProyeccion = Math.round(anosProyeccion * 365);

  // Proyección multiplicada por el factor de escalamiento
  const fotosProyectadasBytes = Math.round(tasaDiariaFotosBytes * diasProyeccion * multiplicadorEscalamiento);
  const dbProyectadaBytes = Math.round(tasaDiariaDbBytes * diasProyeccion * multiplicadorEscalamiento);
  const totalProyectadoBytes = fotosProyectadasBytes + dbProyectadaBytes;

  // Minutas y fotos estimadas al final del periodo
  const minutasProyectadas = Math.round((totalMinutasConteo / diasConActividad) * diasProyeccion * multiplicadorEscalamiento);
  const fotosProyectadas = Math.round(((metricas?.total_fotos || 0) / diasConActividad) * diasProyeccion * multiplicadorEscalamiento);

  // Dimensionamiento para el Servidor Independiente
  const totalProyectadoGB = totalProyectadoBytes / (1024 * 1024 * 1024);
  // Recomendación: Datos App + 25% Margen Postgres/WAL + Backups locales (40% de los datos o mín 4 GB)
  const cuotaMinimaSugeridaGB = Math.ceil(totalProyectadoGB * 1.25 + Math.max(4, totalProyectadoGB * 0.4));

  // Redondear a números de cuota estándar de TI (20, 30, 50, 80, 100, 150, 200, 300, 500)
  const cuotaServidorRecomendada = [20, 30, 50, 80, 100, 150, 200, 300, 500].find(c => c >= cuotaMinimaSugeridaGB) || Math.ceil(cuotaMinimaSugeridaGB / 50) * 50;

  // Desglose técnico de la cuota asignada:
  const datosAppGB = Math.max(0.5, Math.round(totalProyectadoGB * 10) / 10);
  const backupsGB = Math.max(3, Math.round(Math.max(4, totalProyectadoGB * 0.4) * 10) / 10);
  const mantenimientoGB = Math.max(2, Math.round(totalProyectadoGB * 0.25 * 10) / 10);
  const reservaTIGB = Math.max(1, Math.round((cuotaServidorRecomendada - datosAppGB - backupsGB - mantenimientoGB) * 10) / 10);

  // Porcentajes para la barra de distribución
  const pctDatos = Math.round((datosAppGB / cuotaServidorRecomendada) * 100);
  const pctBackups = Math.round((backupsGB / cuotaServidorRecomendada) * 100);
  const pctMantenimiento = Math.round((mantenimientoGB / cuotaServidorRecomendada) * 100);
  const pctReserva = Math.max(0, 100 - pctDatos - pctBackups - pctMantenimiento);

  // Manejador para copiar al portapapeles la solicitud formal para TI
  const handleCopiarFichaTecnica = () => {
    const textoFicha = `SOLICITUD FORMAL DE ASIGNACIÓN DE ALMACENAMIENTO - PROYECTO MINUTAS DE VIGILANCIA

Estimado equipo de Infraestructura / TI,

Con base en el uso del sistema de Minutas de Vigilancia y la proyección a ${anosProyeccion} año(s), solicitamos la asignación de cuota de disco en el servidor corporativo:

1. CAPACIDAD RECOMENDADA: ${cuotaServidorRecomendada} GB SSD.

2. ¿EN QUÉ SE DISTRIBUYEN LOS ${cuotaServidorRecomendada} GB SOLICITADOS?:
   - Fotos y Minutas (~${datosAppGB} GB): Almacena las evidencias fotográficas (~${fotosProyectadas.toLocaleString('es-CO')} fotos) y el registro escrito de minutas de ${anosProyeccion} año(s).
   - Copias de Respaldo (~${backupsGB} GB): Copias de seguridad automáticas guardadas en el equipo para no perder información ante cualquier falla o imprevisto.
   - Mantenimiento y Rapidez (~${mantenimientoGB} GB): Espacio de trabajo necesario para que el sistema organice datos, genere reportes rápido y no se ponga lento.
   - Espacio Libre de Seguridad (~${reservaTIGB} GB): Margen preventivo recomendado para que el disco nunca se llene al 100% y la aplicación opere sin bloqueos.

3. RESUMEN:
   - Capacidad calculada para garantizar estabilidad, rapidez y protección de la información durante el periodo estimado.

Quedamos a su disposición para coordinar la ruta de montaje asignada o el volumen correspondiente.
Muchas gracias por su apoyo.`;

    navigator.clipboard.writeText(textoFicha);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 3000);
  };

  return (
    <div className="seccion-almacenamiento">
      {/* Alerta si ocurre un error de conexión */}
      {errorCarga && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.84rem', color: '#991b1b' }}>
            <AlertTriangle size={18} color="#dc2626" />
            <span>{errorCarga}</span>
          </div>
          <button
            onClick={cargarMetricas}
            style={{ background: '#da2d34', color: '#ffffff', border: 'none', padding: '6px 14px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
          >
            Reintentar
          </button>
        </div>
      )}

      {/* ── Barra de Filtros Rápidos con Botón Actualizar Integrado ── */}
      <div className="storage-filters-bar">
        <div className="storage-filters-content">
          <div className="filters-pill-group">
            <button
              className={`filter-range-btn ${rango === 'todos' ? 'active' : ''}`}
              onClick={() => handleToggleRango('todos')}
              title="Mostrar todo el historial de almacenamiento"
            >
              Todo
            </button>
            <button
              className={`filter-range-btn ${rango === 'hoy' ? 'active' : ''}`}
              onClick={() => handleToggleRango('hoy')}
            >
              Hoy
            </button>
            <button
              className={`filter-range-btn ${rango === 'ayer' ? 'active' : ''}`}
              onClick={() => handleToggleRango('ayer')}
            >
              Ayer
            </button>
            <button
              className={`filter-range-btn ${rango === '7d' ? 'active' : ''}`}
              onClick={() => handleToggleRango('7d')}
            >
              7 Días
            </button>
            <button
              className={`filter-range-btn ${rango === 'mes' ? 'active' : ''}`}
              onClick={() => handleToggleRango('mes')}
            >
              Este Mes
            </button>
            <button
              className={`filter-range-btn ${rango === 'mes_pasado' ? 'active' : ''}`}
              onClick={() => handleToggleRango('mes_pasado')}
            >
              Mes Pasado
            </button>
            <button
              className={`filter-range-btn ${rango === '30d' ? 'active' : ''}`}
              onClick={() => handleToggleRango('30d')}
            >
              30 Días
            </button>
            <button
              className={`filter-range-btn ${rango === 'trimestre' ? 'active' : ''}`}
              onClick={() => handleToggleRango('trimestre')}
            >
              Trimestre
            </button>
            <button
              className={`filter-range-btn ${rango === 'custom' ? 'active' : ''}`}
              onClick={() => handleToggleRango('custom')}
            >
              <Calendar size={13} />
              <span>Rango</span>
            </button>
          </div>

          <button
            className="btn-refresh-storage"
            onClick={cargarMetricas}
            disabled={loading}
            title="Actualizar métricas desde la base de datos"
          >
            <RefreshCw size={13} className={loading ? 'spin-icon' : ''} />
            <span>Actualizar</span>
          </button>
        </div>

        {rango === 'custom' && (
          <div className="custom-datepicker-row animate-fade-in">
            <PremiumDatePicker
              key={claveSelectorPersonalizado}
              abiertoPorDefecto={true}
              startDate={fechaCustom.start}
              endDate={fechaCustom.end}
              onChange={(start, end) => setFechaCustom({ start, end })}
            />
          </div>
        )}
      </div>

      {/* ── Fila 1: KPIs Principales de Almacenamiento (Filtrados por Periodo) ── */}
      <div className="storage-kpis-grid">
        {/* KPI 1: Almacenamiento Total en el Periodo */}
        <div className="storage-kpi-card kpi-highlight">
          <div className="storage-kpi-header">
            <span className="storage-kpi-tag">Consumo ({periodoTitulo})</span>
            <div className="storage-kpi-icon-box icon-red">
              <HardDrive size={18} />
            </div>
          </div>
          <div className="storage-kpi-metric">
            <span className="storage-kpi-number">{formatearBytes(totalPeriodoBytes).valor}</span>
            <span className="storage-kpi-unit">{formatearBytes(totalPeriodoBytes).unidad}</span>
          </div>
          <div className="storage-kpi-footer">
            <span>Base de Datos + Evidencias en el periodo</span>
          </div>
        </div>

        {/* KPI 2: Base de Datos PostgreSQL en el Periodo */}
        <div className="storage-kpi-card">
          <div className="storage-kpi-header">
            <span className="storage-kpi-tag">Base de Datos</span>
            <div className="storage-kpi-icon-box icon-blue">
              <Database size={18} />
            </div>
          </div>
          <div className="storage-kpi-metric">
            <span className="storage-kpi-number">{formatearBytes(dbEnPeriodoBytes).valor}</span>
            <span className="storage-kpi-unit">{formatearBytes(dbEnPeriodoBytes).unidad}</span>
          </div>
          <div className="storage-kpi-footer">
            <span className="footer-pill" title="Espacio de minutas e índices registrados en este periodo">
              Registros: {formatearBytes(dbEnPeriodoBytes).full}
            </span>
            <span>• {totalMinutasEnPeriodo} minutas</span>
          </div>
        </div>

        {/* KPI 3: Storage de Fotos de Evidencias en el Periodo */}
        <div className="storage-kpi-card">
          <div className="storage-kpi-header">
            <span className="storage-kpi-tag">Fotos & Evidencias</span>
            <div className="storage-kpi-icon-box icon-amber">
              <ImageIcon size={18} />
            </div>
          </div>
          <div className="storage-kpi-metric">
            <span className="storage-kpi-number">{formatearBytes(fotosEnPeriodoBytes).valor}</span>
            <span className="storage-kpi-unit">{formatearBytes(fotosEnPeriodoBytes).unidad}</span>
          </div>
          <div className="storage-kpi-footer">
            <span className="footer-pill">{Math.round(porcentajeFotosPeriodo)}% del periodo</span>
            <span>• {cantFotosEnPeriodo} fotos ({formatearBytes(promedioPorFotoBytes).full}/foto)</span>
          </div>
        </div>

        {/* KPI 4: Ritmo de Crecimiento Diario en el Periodo */}
        <div className="storage-kpi-card">
          <div className="storage-kpi-header">
            <span className="storage-kpi-tag">Crecimiento Diario</span>
            <div className="storage-kpi-icon-box icon-emerald">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="storage-kpi-metric">
            <span className="storage-kpi-number">{formatearBytes(tasaDiariaPeriodoBytes).valor}</span>
            <span className="storage-kpi-unit">{formatearBytes(tasaDiariaPeriodoBytes).unidad}/día</span>
          </div>
          <div className="storage-kpi-footer">
            <span>Promedio en {diasActivosEnPeriodo} día(s) con actividad</span>
          </div>
        </div>
      </div>

      {/* ── Barra Visual de Proporción (BD vs Fotos) en el Periodo ──── */}
      <div className="storage-proportion-card">
        <div className="proportion-header">
          <span className="proportion-title">Distribución de Capacidad ({periodoTitulo})</span>
          <div className="proportion-legend">
            <div className="legend-item">
              <span className="legend-dot dot-fotos" />
              <span>Fotos de Evidencias ({Math.round(porcentajeFotosPeriodo)}%)</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot dot-db" />
              <span>Base de Datos PostgreSQL ({Math.round(porcentajeDbPeriodo)}%)</span>
            </div>
          </div>
        </div>
        <div className="stacked-proportion-bar">
          <div
            className="proportion-segment segment-fotos"
            style={{ width: `${Math.max(porcentajeFotosPeriodo, 5)}%` }}
            title={`Fotos: ${formatearBytes(fotosEnPeriodoBytes).full} (${Math.round(porcentajeFotosPeriodo)}%)`}
          />
          <div
            className="proportion-segment segment-db"
            style={{ width: `${Math.max(porcentajeDbPeriodo, 2)}%` }}
            title={`Base de Datos: ${formatearBytes(dbEnPeriodoBytes).full} (${Math.round(porcentajeDbPeriodo)}%)`}
          />
        </div>
      </div>

      {/* ── Gráfica Jerárquica Interactiva de Consumo de Almacenamiento ──── */}
      <div className="storage-chart-card">
        {/* Encabezado Unificado y Compacto (Granularidad al lado de la leyenda) */}
        <div className="storage-chart-header">
          <div className="chart-header-left">
            <div className="chart-title-breadcrumb-row">
              <h3>Evolución de Almacenamiento</h3>
              {(filtroMes || filtroSemana) && (
                <button
                  className="btn-drill-up"
                  onClick={handleSubirNivel}
                  title="Subir de nivel"
                >
                  <ArrowUpLeft size={13} />
                  <span>Subir</span>
                </button>
              )}
              {(filtroMes || filtroSemana) && (
                <div className="breadcrumbs-path">
                  <span className="crumb-root">{tituloNivel}</span>
                  {filtroMes && (
                    <>
                      <ChevronRight size={13} className="crumb-sep" />
                      <span className="crumb-active">{filtroMes.label}</span>
                    </>
                  )}
                  {filtroSemana && (
                    <>
                      <ChevronRight size={13} className="crumb-sep" />
                      <span className="crumb-active">{filtroSemana.label}</span>
                    </>
                  )}
                </div>
              )}
            </div>
            <p className="chart-header-desc">
              {filtroMes || filtroSemana ? 'Mostrando desglose del periodo seleccionado' : `${tituloNivel} `}
            </p>
          </div>

          <div className="chart-header-right">
            <span className="section-subtitle">
              {periodoTitulo} • {formatearBytes(totalBytesEnPeriodo).full}
            </span>
            <div className="chart-legend-box">
              <div className="legend-item">
                <span className="legend-dot dot-fotos" />
                <span>Fotos</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot dot-db" />
                <span>Base de Datos</span>
              </div>
            </div>

            {/* Selector de Granularidad (Día / Semana / Mes) ahora aquí al lado de la leyenda */}
            <div className="granularity-toggle-group">
              <button
                className={`btn-granularity ${nivel === 'dia' ? 'active' : ''}`}
                onClick={() => { setNivel('dia'); setFiltroMes(null); setFiltroSemana(null); }}
                title="Ver por Días"
              >
                Día
              </button>
              <button
                className={`btn-granularity ${nivel === 'semana' ? 'active' : ''}`}
                onClick={() => { setNivel('semana'); setFiltroSemana(null); }}
                title="Ver por Semanas"
              >
                Semana
              </button>
              <button
                className={`btn-granularity ${nivel === 'mes' ? 'active' : ''}`}
                onClick={() => { setNivel('mes'); setFiltroMes(null); setFiltroSemana(null); }}
                title="Ver por Meses"
              >
                Mes
              </button>
            </div>
          </div>
        </div>

        {/* Tooltip flotante interactivo al pasar el mouse */}
        {hoveredDiaIdx !== null && itemsGrafico[hoveredDiaIdx] && (
          <div className="storage-tooltip animate-fade-in">
            <div className="tooltip-header-date">
              📅 {itemsGrafico[hoveredDiaIdx].fechaTexto}
            </div>
            <div className="tooltip-row">
              <span className="tooltip-row-label">📸 Fotos de Evidencias:</span>
              <span className="tooltip-row-val" style={{ color: '#ea580c' }}>
                {formatearBytes(itemsGrafico[hoveredDiaIdx].bytesFotos).full} ({itemsGrafico[hoveredDiaIdx].cantFotos} fotos)
              </span>
            </div>
            <div className="tooltip-row">
              <span className="tooltip-row-label">🛢️ Base de Datos:</span>
              <span className="tooltip-row-val" style={{ color: '#60a5fa' }}>
                {formatearBytes(itemsGrafico[hoveredDiaIdx].bytesDb).full} ({itemsGrafico[hoveredDiaIdx].cantMinutas} minutas)
              </span>
            </div>
            <div className="tooltip-row tooltip-total-row">
              <span>Total en el periodo:</span>
              <span>{formatearBytes(itemsGrafico[hoveredDiaIdx].totalBytes).full}</span>
            </div>
            {nivel !== 'dia' && (
              <div className="tooltip-drill-hint">
                <span>👆 Toca para ver {nivel === 'mes' ? 'las semanas' : 'los días'}</span>
              </div>
            )}
          </div>
        )}

        {/* Barras Apiladas */}
        {itemsGrafico.length === 0 ? (
          <div className="grafico-empty">
            <p>No hay registros de consumo para este periodo</p>
          </div>
        ) : (
          <div className="storage-bars-area">
            {itemsGrafico.map((item, idx) => {
              const isHovered = hoveredDiaIdx === idx;
              const isDrillable = nivel !== 'dia';

              const ratio = maxValGrafico > 0 ? (item.totalBytes / maxValGrafico) : 0;
              const alturaTotalPorc = item.totalBytes > 0
                ? Math.min(100, Math.round(14 + Math.pow(ratio, 0.75) * 86))
                : 0;

              let porcDb = 0;
              let porcFotos = 0;
              if (item.totalBytes > 0) {
                if (item.bytesDb > 0 && item.bytesFotos > 0) {
                  const rawDb = (item.bytesDb / item.totalBytes) * 100;
                  porcDb = Math.max(Math.round(rawDb), 8);
                  porcFotos = 100 - porcDb;
                } else if (item.bytesDb > 0) {
                  porcDb = 100;
                } else {
                  porcFotos = 100;
                }
              }

              return (
                <div
                  key={item.id}
                  className={`storage-bar-column ${isHovered ? 'active' : ''} ${isDrillable ? 'is-drillable' : ''}`}
                  onMouseEnter={() => setHoveredDiaIdx(idx)}
                  onMouseLeave={() => setHoveredDiaIdx(null)}
                  onClick={() => {
                    setHoveredDiaIdx(isHovered ? null : idx);
                    if (isDrillable) handleBarClick(item);
                  }}
                >
                  {/* Valor superior con su unidad completa */}
                  <span className="storage-bar-value-top">
                    {item.totalBytes > 0 ? formatearBytes(item.totalBytes).full : ''}
                  </span>

                  {/* Pista vertical flexible de la barra */}
                  <div className="storage-bar-track">
                    {item.totalBytes > 0 ? (
                      <div className="storage-bar-slot" style={{ height: `${alturaTotalPorc}%` }}>
                        {/* Pila DB (abajo, azul) */}
                        {porcDb > 0 && (
                          <div
                            className="bar-stack-db"
                            style={{ height: `${porcDb}%` }}
                          />
                        )}
                        {/* Pila Fotos (arriba, rojo Claro) */}
                        {porcFotos > 0 && (
                          <div
                            className="bar-stack-fotos"
                            style={{ height: `${porcFotos}%` }}
                          />
                        )}
                      </div>
                    ) : (
                      <div className="storage-bar-zero-dot" />
                    )}
                  </div>

                  {/* Etiquetas del eje X */}
                  <div className="bar-axis-labels">
                    <span className="bar-main-label">{item.label}</span>
                    {item.subLabel && (
                      <span className="bar-sub-label">{item.subLabel}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Desglose de Tablas de la Base de Datos ─────────────────── */}
      {metricas?.tablas && metricas.tablas.length > 0 && (
        <div className="tablas-breakdown-card">
          <div className="tablas-breakdown-header">
            <div className="tablas-breakdown-title">
              <Layers size={18} color="#60a5fa" />
              <span>Estructura de la Base de Datos (Tablas e Índices)</span>
            </div>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              Esquema: <strong>"Minuta_seguridad"</strong>
            </span>
          </div>

          <div className="tablas-table-wrapper">
            <table className="tablas-custom-table">
              <thead>
                <tr>
                  <th>Tabla</th>
                  <th>Tamaño de Datos</th>
                  <th>Tamaño de Índices</th>
                  <th>Tamaño Total en Disco</th>
                </tr>
              </thead>
              <tbody>
                {metricas.tablas.map((t) => (
                  <tr key={t.tabla}>
                    <td>
                      <span className="table-name-badge">{t.tabla}</span>
                    </td>
                    <td>{formatearBytes(t.tamano_datos).full}</td>
                    <td>{formatearBytes(t.tamano_indices).full}</td>
                    <td>
                      <strong>{formatearBytes(t.tamano_bytes).full}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── CALCULADORA Y SIMULADOR DE PROYECCIÓN A FUTURO ────────── */}
      <div className="proyeccion-card">
        <div className="proyeccion-header">
          <div className="proyeccion-title-box">
            <h3>
              <Sparkles size={20} color="#ea580c" />
              Calculadora de Proyección de Almacenamiento
            </h3>
            <p>
              Calcula con precisión matemática cuánto almacenamiento necesitarás a 1, 2, 3 o N años según el ritmo real de tu piloto.
            </p>
          </div>
        </div>

        {/* Controles del Simulador */}
        <div className="proyeccion-controls-grid">
          {/* Control 1: Horizonte de Tiempo */}
          <div className="control-panel">
            <div className="control-label">
              <span>Horizonte de Tiempo</span>
              <span className="control-val-tag">
                {anosProyeccion} Año{anosProyeccion > 1 ? 's' : ''}
              </span>
            </div>
            <div className="years-selector-pills">
              <button
                className={`btn-year-pill ${anosProyeccion === 1 ? 'active' : ''}`}
                onClick={() => setAnosProyeccion(1)}
              >
                1 Año
              </button>
              <button
                className={`btn-year-pill ${anosProyeccion === 2 ? 'active' : ''}`}
                onClick={() => setAnosProyeccion(2)}
              >
                2 Años
              </button>
              <button
                className={`btn-year-pill ${anosProyeccion === 3 ? 'active' : ''}`}
                onClick={() => setAnosProyeccion(3)}
              >
                3 Años
              </button>
              <button
                className={`btn-year-pill ${anosProyeccion === 5 ? 'active' : ''}`}
                onClick={() => setAnosProyeccion(5)}
              >
                5 Años
              </button>
            </div>
          </div>

          {/* Control 2: Escalamiento de Operación */}
          <div className="control-panel">
            <div className="control-label">
              <span>Escalamiento de la Operación</span>
              <span className="control-val-tag">
                {multiplicadorEscalamiento === 1 ? 'Ritmo actual del Piloto' : `x${multiplicadorEscalamiento} Sedes/Puestos`}
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={multiplicadorEscalamiento}
              onChange={(e) => setMultiplicadorEscalamiento(parseInt(e.target.value, 10))}
              className="range-slider"
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#64748b' }}>
              <span>Actual (x1)</span>
              <span>x3</span>
              <span>x5</span>
              <span>Expansión x10</span>
            </div>
          </div>
        </div>

        {/* Resultados de la Proyección */}
        <div className="proyeccion-results-banner">
          <div className="result-main-number-box">
            <span className="result-badge">Almacenamiento Neto Requerido</span>
            <div className="result-huge-number">
              {formatearBytes(totalProyectadoBytes, 1).full}
            </div>
            <span className="result-period-sub">
              Proyección para {anosProyeccion} año(s) de operación
            </span>
          </div>

          <div className="result-breakdown-details">
            <div className="breakdown-row">
              <div className="breakdown-row-left">
                <span className="legend-dot dot-fotos" />
                <span>Fotos de Evidencias Proyectadas:</span>
              </div>
              <div className="breakdown-row-right" style={{ color: '#ea580c' }}>
                {formatearBytes(fotosProyectadasBytes, 1).full} (~{fotosProyectadas.toLocaleString('es-CO')} fotos)
              </div>
            </div>

            <div className="breakdown-row">
              <div className="breakdown-row-left">
                <span className="legend-dot dot-db" />
                <span>Base de Datos PostgreSQL Proyectada:</span>
              </div>
              <div className="breakdown-row-right" style={{ color: '#60a5fa' }}>
                {formatearBytes(dbProyectadaBytes, 1).full} (~{minutasProyectadas.toLocaleString('es-CO')} minutas)
              </div>
            </div>

            <div className="breakdown-row" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '8px' }}>
              <div className="breakdown-row-left">
                <Calendar size={14} color="#94a3b8" />
                <span>Tasa Diaria Proyectada:</span>
              </div>
              <div className="breakdown-row-right">
                ~{formatearBytes(tasaDiariaBytes * multiplicadorEscalamiento).full} / día
              </div>
            </div>
          </div>
        </div>

        {/* ── Tarjeta de Recomendación de Cuota de Servidor para TI ─── */}
        <div className="servidor-recomendacion-card">
          <div className="servidor-header">
            <div className="servidor-title">
              <Server size={20} color="#16a34a" />
              <div>
                <span>Cuota de Disco Sugerida para el Servidor Independiente</span>
                <p className="servidor-subtitle">
                  ¿Por qué solicitar {cuotaServidorRecomendada} GB si las fotos y minutas ocupan ~{datosAppGB.toFixed(1)} GB?
                </p>
              </div>
            </div>
            <span className="servidor-quota-highlight">
              {cuotaServidorRecomendada} GB SSD
            </span>
          </div>

          {/* Barra segmentada visual de la cuota */}
          <div className="servidor-distribution-bar" title={`Distribución de los ${cuotaServidorRecomendada} GB`}>
            <div className="dist-segment seg-datos" style={{ width: `${pctDatos}%` }} title={`Fotos y Minutas: ${datosAppGB.toFixed(1)} GB (${pctDatos}%)`} />
            <div className="dist-segment seg-backups" style={{ width: `${pctBackups}%` }} title={`Copias de Respaldo: ${backupsGB.toFixed(1)} GB (${pctBackups}%)`} />
            <div className="dist-segment seg-mantenimiento" style={{ width: `${pctMantenimiento}%` }} title={`Mantenimiento y Rapidez: ${mantenimientoGB.toFixed(1)} GB (${pctMantenimiento}%)`} />
            <div className="dist-segment seg-reserva" style={{ width: `${pctReserva}%` }} title={`Espacio Libre de Seguridad: ${reservaTIGB.toFixed(1)} GB (${pctReserva}%)`} />
          </div>

          {/* Grilla compacta de 4 conceptos en lenguaje sencillo y claro */}
          <div className="servidor-breakdown-grid">
            {/* 1. Fotos y Minutas */}
            <div className="servidor-breakdown-item">
              <div className="breakdown-item-header">
                <div className="breakdown-item-title">
                  <span className="dot-indicator dot-datos" />
                  <span>Fotos y Minutas</span>
                </div>
                <span className="breakdown-item-gb">{datosAppGB.toFixed(1)} GB</span>
              </div>
              <span className="breakdown-item-desc">
                Todas las fotos de evidencias (~{fotosProyectadas.toLocaleString('es-CO')}) y las minutas guardadas en {anosProyeccion} año(s).
              </span>
            </div>

            {/* 2. Copias de Respaldo */}
            <div className="servidor-breakdown-item">
              <div className="breakdown-item-header">
                <div className="breakdown-item-title">
                  <span className="dot-indicator dot-backups" />
                  <span>Copias de Respaldo</span>
                </div>
                <span className="breakdown-item-gb">{backupsGB.toFixed(1)} GB</span>
              </div>
              <span className="breakdown-item-desc">
                Copias automáticas guardadas en el equipo para no perder datos ante cualquier falla o daño.
              </span>
            </div>

            {/* 3. Mantenimiento y Rapidez */}
            <div className="servidor-breakdown-item">
              <div className="breakdown-item-header">
                <div className="breakdown-item-title">
                  <span className="dot-indicator dot-mantenimiento" />
                  <span>Mantenimiento y Rapidez</span>
                </div>
                <span className="breakdown-item-gb">{mantenimientoGB.toFixed(1)} GB</span>
              </div>
              <span className="breakdown-item-desc">
                Espacio de trabajo para que el sistema organice datos, abra reportes rápido y no se ponga lento.
              </span>
            </div>

            {/* 4. Espacio Libre de Seguridad */}
            <div className="servidor-breakdown-item">
              <div className="breakdown-item-header">
                <div className="breakdown-item-title">
                  <span className="dot-indicator dot-reserva" />
                  <span>Espacio Libre Preventivo</span>
                </div>
                <span className="breakdown-item-gb">{reservaTIGB.toFixed(1)} GB</span>
              </div>
              <span className="breakdown-item-desc">
                Margen libre recomendado para que el disco nunca se llene al 100% y la app no se bloquee.
              </span>
            </div>
          </div>

          <button
            className={`btn-copy-formal ${copiado ? 'copied' : ''}`}
            onClick={handleCopiarFichaTecnica}
          >
            {copiado ? <Check size={16} /> : <Copy size={16} />}
            <span>{copiado ? '¡Copiado al Portapapeles!' : 'Copiar Solicitud Formal para TI / Infraestructura'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
