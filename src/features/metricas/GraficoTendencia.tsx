import { useState, useMemo, useEffect } from 'react';
import { ChevronRight, ArrowUpLeft } from 'lucide-react';

interface MinutaGrafico {
  id: string;
  fecha_hora: string;
  tipo_novedad_id?: string;
  tipos_novedad?: { id: string; nombre: string };
  sedes?: { id: string; nombre: string };
  perfiles?: { id: string; nombre: string };
}

type NivelGranularidad = 'mes' | 'semana' | 'dia';

interface ItemGrafico {
  id: string;              // Clave única (ej. '2026-08', 'sem-3', '2026-08-25')
  label: string;           // Texto visible en eje X (ej. 'Agosto', 'Semana 3', '25 Ago')
  subLabel?: string;       // Texto complementario (ej. '15-21 Ago')
  total: number;
  novedades: number;
  rondas: number;
  fechaInicio: Date;
  fechaFin: Date;
}

interface GraficoTendenciaProps {
  minutas: MinutaGrafico[];
  fechaInicio: Date;
  fechaFin: Date;
  rangoActual: string;
}

const MESES_NOMBRES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export default function GraficoTendencia({ minutas, fechaInicio, fechaFin, rangoActual }: GraficoTendenciaProps) {
  // Nivel de granularidad actual
  const [nivel, setNivel] = useState<NivelGranularidad>('semana');
  
  // Estados de Drill-Down
  const [filtroMes, setFiltroMes] = useState<{ id: string; label: string; start: Date; end: Date } | null>(null);
  const [filtroSemana, setFiltroSemana] = useState<{ id: string; label: string; start: Date; end: Date } | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Sincronizar nivel por defecto según el rango del selector global
  useEffect(() => {
    // Reset drill-down al cambiar filtro global
    setFiltroMes(null);
    setFiltroSemana(null);

    if (rangoActual === 'hoy' || rangoActual === '7d') {
      setNivel('dia');
    } else if (rangoActual === 'trimestre') {
      setNivel('mes');
    } else {
      // 'mes', 'mes_pasado', '30d', 'custom'
      const diffDias = Math.ceil((fechaFin.getTime() - fechaInicio.getTime()) / (24 * 60 * 60 * 1000));
      if (diffDias <= 14) {
        setNivel('dia');
      } else if (diffDias > 45) {
        setNivel('mes');
      } else {
        setNivel('semana');
      }
    }
  }, [rangoActual, fechaInicio, fechaFin]);

  // ─── Generación de datos según el nivel activo ─────────────────
  const itemsGrafico: ItemGrafico[] = useMemo(() => {
    // Determinar rango efectivo considerando drill-down
    const inicioEfectivo = filtroSemana ? filtroSemana.start : (filtroMes ? filtroMes.start : fechaInicio);
    const finEfectivo = filtroSemana ? filtroSemana.end : (filtroMes ? filtroMes.end : fechaFin);

    // Minutas dentro del rango efectivo
    const minutasEnRango = minutas.filter((m) => {
      const f = new Date(m.fecha_hora);
      return f >= inicioEfectivo && f <= finEfectivo;
    });

    // ── NIVEL MES ────────────────────────────────────────────────
    if (nivel === 'mes') {
      const mesesMap = new Map<string, ItemGrafico>();
      
      // Inicializar meses en el rango
      const cur = new Date(inicioEfectivo.getFullYear(), inicioEfectivo.getMonth(), 1);
      const endLimit = new Date(finEfectivo.getFullYear(), finEfectivo.getMonth(), 1);

      while (cur <= endLimit) {
        const y = cur.getFullYear();
        const m = cur.getMonth();
        const key = `${y}-${String(m + 1).padStart(2, '0')}`;
        const mesStart = new Date(y, m, 1, 0, 0, 0);
        const mesEnd = new Date(y, m + 1, 0, 23, 59, 59, 999);
        const label = MESES_NOMBRES[m];

        mesesMap.set(key, {
          id: key,
          label,
          subLabel: String(y),
          total: 0,
          novedades: 0,
          rondas: 0,
          fechaInicio: mesStart,
          fechaFin: mesEnd
        });

        cur.setMonth(cur.getMonth() + 1);
      }

      // Sumar registros
      minutasEnRango.forEach((m) => {
        const f = new Date(m.fecha_hora);
        const key = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}`;
        const item = mesesMap.get(key);
        if (item) {
          item.total++;
          const esNov = (m.tipos_novedad?.nombre || '').toLowerCase().includes('novedad');
          if (esNov) item.novedades++;
          else item.rondas++;
        }
      });

      return Array.from(mesesMap.values());
    }

    // ── NIVEL SEMANA ─────────────────────────────────────────────
    if (nivel === 'semana') {
      const semanasList: ItemGrafico[] = [];
      
      // Agrupar en bloques de 7 días naturales o semanas del periodo
      let semIdx = 1;
      let iter = new Date(inicioEfectivo);
      iter.setHours(0, 0, 0, 0);

      while (iter <= finEfectivo) {
        const semStart = new Date(iter);
        const semEnd = new Date(iter.getTime() + 6 * 24 * 60 * 60 * 1000);
        semEnd.setHours(23, 59, 59, 999);
        if (semEnd > finEfectivo) {
          semEnd.setTime(finEfectivo.getTime());
        }

        const startStr = semStart.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
        const endStr = semEnd.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
        const id = `sem-${semIdx}-${semStart.toISOString().slice(0, 10)}`;

        let total = 0;
        let novedades = 0;
        let rondas = 0;

        minutasEnRango.forEach((m) => {
          const f = new Date(m.fecha_hora);
          if (f >= semStart && f <= semEnd) {
            total++;
            const esNov = (m.tipos_novedad?.nombre || '').toLowerCase().includes('novedad');
            if (esNov) novedades++;
            else rondas++;
          }
        });

        semanasList.push({
          id,
          label: `Semana ${semIdx}`,
          subLabel: `${startStr} - ${endStr}`,
          total,
          novedades,
          rondas,
          fechaInicio: semStart,
          fechaFin: semEnd
        });

        semIdx++;
        iter = new Date(semEnd.getTime() + 1000);
        iter.setHours(0, 0, 0, 0);
      }

      return semanasList;
    }

    // ── NIVEL DÍA ────────────────────────────────────────────────
    const diasMap = new Map<string, ItemGrafico>();
    let diaIter = new Date(inicioEfectivo);
    diaIter.setHours(0, 0, 0, 0);

    while (diaIter <= finEfectivo) {
      const key = diaIter.toISOString().slice(0, 10);
      const dStart = new Date(diaIter);
      dStart.setHours(0, 0, 0, 0);
      const dEnd = new Date(diaIter);
      dEnd.setHours(23, 59, 59, 999);

      const label = diaIter.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
      const subLabel = diaIter.toLocaleDateString('es-CO', { weekday: 'short' });

      diasMap.set(key, {
        id: key,
        label,
        subLabel,
        total: 0,
        novedades: 0,
        rondas: 0,
        fechaInicio: dStart,
        fechaFin: dEnd
      });

      diaIter.setDate(diaIter.getDate() + 1);
    }

    minutasEnRango.forEach((m) => {
      const key = m.fecha_hora.slice(0, 10);
      const item = diasMap.get(key);
      if (item) {
        item.total++;
        const esNov = (m.tipos_novedad?.nombre || '').toLowerCase().includes('novedad');
        if (esNov) item.novedades++;
        else item.rondas++;
      }
    });

    return Array.from(diasMap.values());
  }, [minutas, fechaInicio, fechaFin, nivel, filtroMes, filtroSemana]);

  // ─── Manejo de Clic en Barra (Drill-Down) ──────────────────────
  const handleBarClick = (item: ItemGrafico) => {
    if (nivel === 'mes') {
      // Bajar a Semanas de este mes
      setFiltroMes({ id: item.id, label: item.label, start: item.fechaInicio, end: item.fechaFin });
      setNivel('semana');
      setHoveredIdx(null);
    } else if (nivel === 'semana') {
      // Bajar a Días de esta semana
      setFiltroSemana({ id: item.id, label: `${item.label} (${item.subLabel || ''})`, start: item.fechaInicio, end: item.fechaFin });
      setNivel('dia');
      setHoveredIdx(null);
    }
  };

  // ─── Subir de Nivel (Drill-Up) ─────────────────────────────────
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

  const maxVal = Math.max(...itemsGrafico.map(d => d.total), 1);
  const chartHeight = 155; // altura visual equilibrada

  // Título dinámico del nivel actual
  const tituloNivel = nivel === 'mes' ? 'Registros por Mes' : (nivel === 'semana' ? 'Registros por Semana' : 'Registros por Día');

  return (
    <div className="drilldown-chart-wrapper">
      
      {/* ── Barra Superior de Control de Granularidad y Breadcrumbs ── */}
      <div className="chart-controls-bar">
        {/* Migas de pan de navegación jerárquica */}
        <div className="chart-breadcrumbs">
          {(filtroMes || filtroSemana || (nivel === 'dia' && rangoActual !== 'hoy' && rangoActual !== '7d')) && (
            <button 
              className="btn-drill-up"
              onClick={handleSubirNivel}
              title="Subir de nivel"
            >
              <ArrowUpLeft size={14} />
              <span>Subir</span>
            </button>
          )}

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
        </div>

        {/* Selector de Granularidad (Día / Semana / Mes) */}
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

      {/* ── Contenedor del Gráfico de Barras ──────────────────────── */}
      <div className="grafico-container">
        {/* Tooltip flotante interactivo */}
        {hoveredIdx !== null && itemsGrafico[hoveredIdx] && (
          <div className="grafico-tooltip animate-fade-in">
            <span className="tooltip-date">
              {itemsGrafico[hoveredIdx].label}
              {itemsGrafico[hoveredIdx].subLabel ? ` (${itemsGrafico[hoveredIdx].subLabel})` : ''}
            </span>
            <div className="tooltip-metrics">
              <span className="tooltip-total">{itemsGrafico[hoveredIdx].total} Minutas</span>
              <span className="tooltip-sub">
                🚨 {itemsGrafico[hoveredIdx].novedades} Nov | 🛡️ {itemsGrafico[hoveredIdx].rondas} Rondas
              </span>
              {nivel !== 'dia' && (
                <span className="tooltip-hint">👆 Toca para explorar</span>
              )}
            </div>
          </div>
        )}

        {itemsGrafico.length === 0 ? (
          <div className="grafico-empty">
            <p>No hay registros para este periodo</p>
          </div>
        ) : (
          <div className="drilldown-bars-wrapper" style={{ height: `${chartHeight}px` }}>
            {itemsGrafico.map((item, idx) => {
              const heightPercent = item.total > 0 ? Math.max((item.total / maxVal) * 100, 10) : 0;
              const isHovered = hoveredIdx === idx;
              const isDrillable = nivel !== 'dia';

              return (
                <div
                  key={item.id}
                  className={`drilldown-bar-col ${isHovered ? 'active' : ''} ${isDrillable ? 'is-drillable' : ''}`}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  onClick={() => {
                    setHoveredIdx(isHovered ? null : idx);
                    if (isDrillable) handleBarClick(item);
                  }}
                >
                  {/* Número superior */}
                  <span className="bar-count-number">{item.total > 0 ? item.total : ''}</span>

                  {/* Barra con altura proporcional y gradiente Claro */}
                  <div className="bar-slot">
                    {item.total > 0 ? (
                      <div
                        className={`bar-core ${item.novedades > 0 ? 'has-novedades' : ''}`}
                        style={{ height: `${heightPercent}%` }}
                      />
                    ) : (
                      <div className="bar-zero-dot" />
                    )}
                  </div>

                  {/* Etiquetas en el eje X */}
                  <div className="bar-axis-labels">
                    <span className="bar-main-label">{item.label}</span>
                    {item.subLabel && nivel === 'semana' && (
                      <span className="bar-sub-label">{item.subLabel}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
