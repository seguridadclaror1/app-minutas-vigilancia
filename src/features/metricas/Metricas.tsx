import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BarChart3,
  Calendar,
  Download,
  Loader2,
  Users,
  Building2,
  AlertTriangle,
  ChevronDown,
  Home,
  ClipboardList,
  Power
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../config/supabase';
import type { Minuta, Sede, TipoNovedad } from '../../types/database';
import PremiumDatePicker from '../../components/PremiumDatePicker';
import ModalConfirmarSalida from '../../components/ModalConfirmarSalida';
import GraficoTendencia from './GraficoTendencia';
import { descargarReporteExcel, type MinutaReporte } from './exportadorReporte';
import './Metricas.css';

interface MinutaAnalitica extends Omit<Minuta, 'perfiles' | 'sedes' | 'tipos_novedad'> {
  sedes: Sede;
  tipos_novedad: TipoNovedad;
  perfiles: { id: string; nombre: string; cedula: string };
}

type RangoPredefinido = 'hoy' | '7d' | 'mes' | 'mes_pasado' | 'trimestre' | '30d' | 'custom';

export default function Metricas() {
  const navigate = useNavigate();
  const { perfil, signOut } = useAuth();

  // Estado del Menú de Perfil
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Cerrar dropdown al hacer clic afuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Estados de datos
  const [minutas, setMinutas] = useState<MinutaAnalitica[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportando, setExportando] = useState(false);

  // Estados de Filtro Temporal
  const [rango, setRango] = useState<RangoPredefinido>('7d');
  const [fechaCustom, setFechaCustom] = useState<{ start: string; end: string }>({ start: '', end: '' });

  // ─── Carga de datos ───────────────────────────────────────────
  const fetchDatos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('minutas')
        .select(`
          id,
          usuario_id,
          sede_id,
          tipo_novedad_id,
          fecha_hora,
          descripcion,
          sedes (id, nombre),
          tipos_novedad (id, nombre),
          perfiles (id, nombre, cedula)
        `)
        .order('fecha_hora', { ascending: false });

      if (error) throw error;
      setMinutas((data as any[]) ?? []);
    } catch (err) {
      console.error('Error cargando minutas para métricas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatos();
  }, []);

  // ─── Filtrado por Rango de Fechas ─────────────────────────────
  const { minutasFiltradas, diasEnRango, periodoTitulo, fechaInicio, fechaFin } = useMemo(() => {
    const ahora = new Date();
    let inicio = new Date();
    let fin = new Date();
    let dias = 7;
    let titulo = 'Últimos 7 días';

    if (rango === 'hoy') {
      inicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 0, 0, 0);
      fin = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 23, 59, 59);
      dias = 1;
      titulo = 'Hoy';
    } else if (rango === '7d') {
      inicio = new Date(ahora.getTime() - 6 * 24 * 60 * 60 * 1000);
      inicio.setHours(0, 0, 0, 0);
      fin.setHours(23, 59, 59, 999);
      dias = 7;
      titulo = 'Últimos 7 días';
    } else if (rango === 'mes') {
      inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1, 0, 0, 0);
      fin.setHours(23, 59, 59, 999);
      dias = Math.max(1, Math.ceil((fin.getTime() - inicio.getTime()) / (24 * 60 * 60 * 1000)));
      titulo = 'Este Mes';
    } else if (rango === 'mes_pasado') {
      inicio = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1, 0, 0, 0);
      fin = new Date(ahora.getFullYear(), ahora.getMonth(), 0, 23, 59, 59, 999);
      dias = Math.max(1, Math.round((fin.getTime() - inicio.getTime()) / (24 * 60 * 60 * 1000)));
      const nombreMesPasado = inicio.toLocaleDateString('es-CO', { month: 'long' });
      titulo = `Mes Pasado (${nombreMesPasado.charAt(0).toUpperCase() + nombreMesPasado.slice(1)})`;
    } else if (rango === '30d') {
      inicio = new Date(ahora.getTime() - 29 * 24 * 60 * 60 * 1000);
      inicio.setHours(0, 0, 0, 0);
      fin.setHours(23, 59, 59, 999);
      dias = 30;
      titulo = 'Últimos 30 días';
    } else if (rango === 'trimestre') {
      inicio = new Date(ahora.getTime() - 89 * 24 * 60 * 60 * 1000);
      inicio.setHours(0, 0, 0, 0);
      fin.setHours(23, 59, 59, 999);
      dias = 90;
      titulo = 'Último Trimestre (90 días)';
    } else if (rango === 'custom') {
      if (fechaCustom.start) {
        const [y, m, d] = fechaCustom.start.split('-').map(Number);
        inicio = new Date(y, m - 1, d, 0, 0, 0);
      } else {
        inicio = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
      if (fechaCustom.end) {
        const [y, m, d] = fechaCustom.end.split('-').map(Number);
        fin = new Date(y, m - 1, d, 23, 59, 59);
      } else {
        fin = new Date();
      }
      dias = Math.max(1, Math.ceil((fin.getTime() - inicio.getTime()) / (24 * 60 * 60 * 1000)));
      titulo = `Personalizado (${fechaCustom.start || '...'} a ${fechaCustom.end || '...'})`;
    }

    const filtradas = minutas.filter((m) => {
      const f = new Date(m.fecha_hora);
      return f >= inicio && f <= fin;
    });

    return { minutasFiltradas: filtradas, diasEnRango: dias, periodoTitulo: titulo, fechaInicio: inicio, fechaFin: fin };
  }, [minutas, rango, fechaCustom]);

  // ─── Cálculos de KPIs ─────────────────────────────────────────
  const {
    totalRegistros,
    promedioDiario,
    totalNovedades,
    totalRondas,
    porcentajeNovedades,
    sedeTop,
    distribucionTipos,
    distribucionSedes,
    topVigilantes
  } = useMemo(() => {
    const total = minutasFiltradas.length;
    const prom = total > 0 ? (total / diasEnRango).toFixed(1) : '0';

    let novedadesCount = 0;
    let rondasCount = 0;

    const sedesMap = new Map<string, number>();
    const tiposMap = new Map<string, number>();
    const vigilantesMap = new Map<string, { nombre: string; count: number }>();

    minutasFiltradas.forEach((m) => {
      const tipoNom = (m.tipos_novedad?.nombre || 'General').trim();
      const sedeNom = (m.sedes?.nombre || 'Sin Sede').trim();
      const vigNom = (m.perfiles?.nombre || 'Desconocido').trim();

      // Conteo por tipo de novedad
      const esNovedad = tipoNom.toLowerCase().includes('novedad');
      if (esNovedad) novedadesCount++;
      else rondasCount++;

      tiposMap.set(tipoNom, (tiposMap.get(tipoNom) || 0) + 1);
      sedesMap.set(sedeNom, (sedesMap.get(sedeNom) || 0) + 1);

      if (vigNom) {
        const actual = vigilantesMap.get(vigNom) || { nombre: vigNom, count: 0 };
        vigilantesMap.set(vigNom, { nombre: vigNom, count: actual.count + 1 });
      }
    });

    const pctNov = total > 0 ? Math.round((novedadesCount / total) * 100) : 0;

    // Sede Top
    let topSedeNombre = '—';
    let topSedeCount = 0;
    sedesMap.forEach((cant, s) => {
      if (cant > topSedeCount) {
        topSedeCount = cant;
        topSedeNombre = s;
      }
    });

    // Distribución de Tipos
    const distTipos = Array.from(tiposMap.entries())
      .map(([nombre, count]) => ({
        nombre,
        count,
        porcentaje: total > 0 ? Math.round((count / total) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count);

    // Distribución Sedes (Top 4)
    const distSedes = Array.from(sedesMap.entries())
      .map(([nombre, count]) => ({
        nombre,
        count,
        porcentaje: total > 0 ? Math.round((count / total) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);

    // Top Vigilantes (Top 4)
    const topVigs = Array.from(vigilantesMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);

    return {
      totalRegistros: total,
      promedioDiario: prom,
      totalNovedades: novedadesCount,
      totalRondas: rondasCount,
      porcentajeNovedades: pctNov,
      sedeTop: { nombre: topSedeNombre, count: topSedeCount, porcentaje: total > 0 ? Math.round((topSedeCount / total) * 100) : 0 },
      distribucionTipos: distTipos,
      distribucionSedes: distSedes,
      topVigilantes: topVigs
    };
  }, [minutasFiltradas, diasEnRango]);

  // ─── Exportar a Excel ─────────────────────────────────────────
  const handleExportarExcel = async () => {
    if (minutasFiltradas.length === 0) {
      alert('No hay registros en el periodo seleccionado para exportar.');
      return;
    }
    setExportando(true);
    try {
      const dataExport: MinutaReporte[] = minutasFiltradas.map((m) => ({
        fecha_hora: m.fecha_hora,
        cedula: m.perfiles?.cedula || '—',
        vigilante: m.perfiles?.nombre || '—',
        sede: m.sedes?.nombre || '—',
        tipo: m.tipos_novedad?.nombre || '—',
        descripcion: m.descripcion || ''
      }));
      await descargarReporteExcel(dataExport, periodoTitulo);
    } catch (err) {
      console.error('Error exportando Excel:', err);
      alert('Hubo un error al generar el archivo Excel.');
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="metricas-page">
      {/* ── Header Corporativo Enterprise ─────────────────────────── */}
      <header className="metricas-header">
        <div className="metricas-header-left">
          <button
            className="metricas-back-pill"
            onClick={() => navigate('/')}
            aria-label="Volver a Inicio"
            data-tooltip="Volver a Inicio"
          >
            <ArrowLeft size={16} />
            <span>Inicio</span>
          </button>

          <div className="metricas-header-divider" />

          <div className="metricas-title-badge">
            <BarChart3 size={18} color="#da2d34" />
            <h1>Métricas y Reportes</h1>
          </div>
        </div>

        <div className="metricas-header-right">
          {/* Botón Descargar Reporte */}
          <button
            className="btn-export-excel"
            onClick={handleExportarExcel}
            disabled={exportando || loading || minutasFiltradas.length === 0}
            data-tooltip="Descargar reporte en Excel"
            data-tooltip-pos="left"
          >
            {exportando ? <Loader2 size={15} className="spin-icon" /> : <Download size={15} />}
            <span>Exportar</span>
          </button>

          {/* Profile Dropdown */}
          <div className="profile-dropdown-wrapper" ref={profileRef}>
            <button
              className={`profile-chip-btn ${isProfileOpen ? 'active' : ''}`}
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              aria-label="Menú de usuario"
              data-tooltip="Mi Cuenta y Opciones"
            >
              <div className="avatar-circle">
                {perfil?.nombre?.charAt(0) || 'S'}
              </div>
              <div className="profile-chip-info">
                <span className="profile-chip-name">{perfil?.nombre?.split(' ')[0] || 'Samir'}</span>
                <span className="profile-chip-role">{perfil?.rol || 'Administrador'}</span>
              </div>
              <ChevronDown size={14} className={`chip-chevron ${isProfileOpen ? 'rotate' : ''}`} />
            </button>

            {isProfileOpen && (
              <div className="profile-menu-dropdown animate-fade-in">
                <div className="dropdown-user-header">
                  <p className="dropdown-user-name">{perfil?.nombre || 'Samir Bolívar'}</p>
                  <p className="dropdown-user-cedula">CC: {perfil?.cedula || '—'}</p>
                  <span className="dropdown-user-badge">{perfil?.rol || 'Administrador'}</span>
                </div>

                <div className="dropdown-divider" />

                <div className="dropdown-menu-list">
                  <button className="dropdown-item" onClick={() => { setIsProfileOpen(false); navigate('/'); }}>
                    <Home size={16} />
                    <span>Página de Inicio</span>
                  </button>
                  <button className="dropdown-item" onClick={() => { setIsProfileOpen(false); navigate('/seguimiento'); }}>
                    <ClipboardList size={16} />
                    <span>Seguimiento de Minutas</span>
                  </button>
                  {perfil?.rol === 'administrador' && (
                    <button className="dropdown-item" onClick={() => { setIsProfileOpen(false); navigate('/admin/usuarios'); }}>
                      <Users size={16} />
                      <span>Gestión de Usuarios</span>
                    </button>
                  )}
                </div>

                <div className="dropdown-divider" />

                <button
                  className="dropdown-item item-danger"
                  onClick={() => {
                    setIsProfileOpen(false);
                    setShowLogoutModal(true);
                  }}
                >
                  <Power size={16} />
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Modal de Confirmación de Cierre de Sesión */}
      <ModalConfirmarSalida
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={() => {
          setShowLogoutModal(false);
          signOut();
        }}
      />

      {/* ── Barra de Filtros Rápidos (Ultra Compacta) ────────────── */}
      <div className="metricas-filters-bar">
        <div className="filters-pill-group">
          <button
            className={`filter-range-btn ${rango === 'hoy' ? 'active' : ''}`}
            onClick={() => setRango('hoy')}
          >
            Hoy
          </button>
          <button
            className={`filter-range-btn ${rango === '7d' ? 'active' : ''}`}
            onClick={() => setRango('7d')}
          >
            7 Días
          </button>
          <button
            className={`filter-range-btn ${rango === 'mes' ? 'active' : ''}`}
            onClick={() => setRango('mes')}
          >
            Este Mes
          </button>
          <button
            className={`filter-range-btn ${rango === 'mes_pasado' ? 'active' : ''}`}
            onClick={() => setRango('mes_pasado')}
          >
            Mes Pasado
          </button>
          <button
            className={`filter-range-btn ${rango === '30d' ? 'active' : ''}`}
            onClick={() => setRango('30d')}
          >
            30 Días
          </button>
          <button
            className={`filter-range-btn ${rango === 'trimestre' ? 'active' : ''}`}
            onClick={() => setRango('trimestre')}
          >
            Trimestre
          </button>
          <button
            className={`filter-range-btn ${rango === 'custom' ? 'active' : ''}`}
            onClick={() => setRango('custom')}
          >
            <Calendar size={13} />
            <span>Rango</span>
          </button>
        </div>

        {rango === 'custom' && (
          <div className="custom-datepicker-row animate-fade-in">
            <PremiumDatePicker
              startDate={fechaCustom.start}
              endDate={fechaCustom.end}
              onChange={(start, end) => setFechaCustom({ start, end })}
            />
          </div>
        )}
      </div>

      {/* ── Contenido Principal del Dashboard ──────────────────────── */}
      <main className="metricas-main">
        {loading ? (
          <div className="metricas-loading">
            <Loader2 size={36} color="#da2d34" className="spin-icon" />
            <p>Calculando métricas del sistema...</p>
          </div>
        ) : (
          <div className="dashboard-grid animate-fade-in">
            
            {/* ── FILA 1: Tarjetas de KPIs Unificadas ── */}
            <div className="kpis-row">
              {/* Tarjeta 1: Total Minutas + Promedio Diario (Unificada) */}
              <div className="kpi-card kpi-primary">
                <div className="kpi-card-header">
                  <span className="kpi-tag">Actividad Total</span>
                  <BarChart3 size={18} className="kpi-icon-primary" />
                </div>
                <div className="kpi-main-metric">
                  <span className="kpi-number">{totalRegistros}</span>
                  <span className="kpi-unit">minutas</span>
                </div>
                <div className="kpi-sub-pill">
                  <span className="kpi-avg-icon">⚡</span>
                  <span className="kpi-avg-text">
                    Promedio: <strong>{promedioDiario}</strong> / día
                  </span>
                </div>
              </div>

              {/* Tarjeta 2: Novedades vs Rondas */}
              <div className="kpi-card">
                <div className="kpi-card-header">
                  <span className="kpi-tag">Novedades y Rondas</span>
                  <AlertTriangle size={18} color="#f59e0b" />
                </div>
                <div className="kpi-main-metric">
                  <span className="kpi-number text-alert">{totalNovedades}</span>
                  <span className="kpi-unit">alertas ({porcentajeNovedades}%)</span>
                </div>
                <div className="kpi-progress-track">
                  <div 
                    className="kpi-progress-bar" 
                    style={{ width: `${porcentajeNovedades}%` }}
                    data-tooltip={`${totalNovedades} Novedades vs ${totalRondas} Rondas`}
                  />
                </div>
                <div className="kpi-split-info">
                  <span>🛡️ {totalRondas} Rondas</span>
                  <span>🚨 {totalNovedades} Novedades</span>
                </div>
              </div>

              {/* Tarjeta 3: Sede Principal */}
              <div className="kpi-card">
                <div className="kpi-card-header">
                  <span className="kpi-tag">Sede Más Activa</span>
                  <Building2 size={18} color="#0284c7" />
                </div>
                <div className="kpi-main-metric">
                  <span className="kpi-sede-name" title={sedeTop.nombre}>
                    {sedeTop.nombre}
                  </span>
                </div>
                <div className="kpi-sub-pill sede-pill">
                  <span>📍 {sedeTop.count} registros ({sedeTop.porcentaje}% del total)</span>
                </div>
              </div>
            </div>

            {/* ── FILA 2: Gráfico de Tendencia Jerárquico ── */}
            <div className="chart-section-card">
              <div className="section-card-header">
                <h3>Evolución de Registros</h3>
                <span className="section-subtitle">{periodoTitulo}</span>
              </div>
              <GraficoTendencia 
                minutas={minutasFiltradas} 
                fechaInicio={fechaInicio} 
                fechaFin={fechaFin} 
                rangoActual={rango} 
              />
            </div>

            {/* ── FILA 3: Distribuciones Compactas (Lado a Lado) ── */}
            <div className="distributions-row">
              {/* Desglose por Tipo de Anotación */}
              <div className="dist-card">
                <div className="section-card-header">
                  <h3>Tipos de Anotación</h3>
                  <span className="section-badge">{distribucionTipos.length} tipos</span>
                </div>
                <div className="dist-list">
                  {distribucionTipos.length === 0 ? (
                    <p className="dist-empty">Sin registros</p>
                  ) : (
                    distribucionTipos.map((t) => (
                      <div key={t.nombre} className="dist-item">
                        <div className="dist-item-top">
                          <span className="dist-item-name">{t.nombre}</span>
                          <span className="dist-item-val">{t.count} ({t.porcentaje}%)</span>
                        </div>
                        <div className="dist-bar-track">
                          <div
                            className={`dist-bar-fill ${t.nombre.toLowerCase().includes('novedad') ? 'bar-red' : 'bar-dark'}`}
                            style={{ width: `${t.porcentaje}%` }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Top Sedes */}
              <div className="dist-card">
                <div className="section-card-header">
                  <h3>Top Sedes con Actividad</h3>
                  <span className="section-badge">{distribucionSedes.length} sedes</span>
                </div>
                <div className="dist-list">
                  {distribucionSedes.length === 0 ? (
                    <p className="dist-empty">Sin registros</p>
                  ) : (
                    distribucionSedes.map((s, idx) => (
                      <div key={s.nombre} className="dist-item">
                        <div className="dist-item-top">
                          <span className="dist-item-name">
                            <strong>#{idx + 1}</strong> {s.nombre}
                          </span>
                          <span className="dist-item-val">{s.count} ({s.porcentaje}%)</span>
                        </div>
                        <div className="dist-bar-track">
                          <div
                            className="dist-bar-fill bar-primary"
                            style={{ width: `${s.porcentaje}%` }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Top Guardias */}
              <div className="dist-card">
                <div className="section-card-header">
                  <h3>Personal Más Activo</h3>
                  <span className="section-badge">Top Guardias</span>
                </div>
                <div className="dist-list">
                  {topVigilantes.length === 0 ? (
                    <p className="dist-empty">Sin registros</p>
                  ) : (
                    topVigilantes.map((v, idx) => (
                      <div key={v.nombre} className="guardia-item">
                        <div className="guardia-rank">#{idx + 1}</div>
                        <div className="guardia-info">
                          <span className="guardia-name">{v.nombre}</span>
                          <span className="guardia-count">{v.count} anotaciones</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}
