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
  ChevronLeft,
  ChevronRight,
  Home,
  ClipboardList,
  Power,
  Search,
  ShieldAlert,
  CheckCircle2,
  Clock,
  User,
  Eye
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../config/supabase';
import type { Minuta, Sede, TipoNovedad } from '../../types/database';
import { formatearFechaHoraColombia } from '../../utils/fechasColombia';
import PremiumDatePicker from '../../components/PremiumDatePicker';
import ModalConfirmarSalida from '../../components/ModalConfirmarSalida';
import GraficoTendencia from './GraficoTendencia';
import { descargarReporteExcel, type MinutaReporte, type PuestoAuditoriaReporte } from './exportadorReporte';
import './Metricas.css';

interface MinutaAnalitica extends Omit<Minuta, 'perfiles' | 'sedes' | 'tipos_novedad'> {
  sedes: Sede;
  tipos_novedad: TipoNovedad;
  perfiles: { id: string; nombre: string; cedula: string };
}

type RangoPredefinido = 'hoy' | '7d' | 'mes' | 'mes_pasado' | 'trimestre' | '30d' | 'custom';

type EstadoPuesto = 'inactivo' | 'bajo' | 'activo';

interface PuestoAuditoria {
  id: string;
  nombre: string;
  totalPeriodo: number;
  promedioDiario: string;
  estado: EstadoPuesto;
  ultimoRegistroFecha: string | null;
  ultimoVigilanteNombre: string | null;
  ultimoVigilanteCedula: string | null;
}

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
  const [todasLasSedes, setTodasLasSedes] = useState<Sede[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportando, setExportando] = useState(false);

  // Estados de Filtro Temporal
  const [rango, setRango] = useState<RangoPredefinido>('7d');
  const [fechaCustom, setFechaCustom] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [claveSelectorPersonalizado, setClaveSelectorPersonalizado] = useState(0);

  // Estados de Filtros de Auditoría de Puestos
  const [filtroEstadoPuesto, setFiltroEstadoPuesto] = useState<'todos' | 'inactivo' | 'bajo' | 'activo'>('todos');
  const [busquedaPuesto, setBusquedaPuesto] = useState('');

  // ─── Carga de datos ───────────────────────────────────────────
  const fetchDatos = async () => {
    setLoading(true);
    try {
      const [minutasRes, sedesRes] = await Promise.all([
        supabase
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
          .order('fecha_hora', { ascending: false }),
        supabase
          .from('sedes')
          .select('id, nombre')
          .order('nombre')
      ]);

      if (minutasRes.error) throw minutasRes.error;
      if (sedesRes.error) throw sedesRes.error;

      setMinutas((minutasRes.data as any[]) ?? []);
      setTodasLasSedes((sedesRes.data as Sede[]) ?? []);
    } catch (err) {
      console.error('Error cargando datos para métricas:', err);
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
      inicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 0, 0, 0, 0);
      fin = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 23, 59, 59, 999);
      dias = 1;
      titulo = 'Hoy';
    } else if (rango === '7d') {
      inicio = new Date(ahora.getTime() - 6 * 24 * 60 * 60 * 1000);
      inicio.setHours(0, 0, 0, 0);
      fin.setHours(23, 59, 59, 999);
      dias = 7;
      titulo = 'Últimos 7 días';
    } else if (rango === 'mes') {
      inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1, 0, 0, 0, 0);
      fin.setHours(23, 59, 59, 999);
      dias = Math.max(1, Math.ceil((fin.getTime() - inicio.getTime()) / (24 * 60 * 60 * 1000)));
      titulo = 'Este Mes';
    } else if (rango === 'mes_pasado') {
      inicio = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1, 0, 0, 0, 0);
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
        inicio = new Date(y, m - 1, d, 0, 0, 0, 0);
      } else {
        inicio = new Date(ahora.getTime() - 29 * 24 * 60 * 60 * 1000);
        inicio.setHours(0, 0, 0, 0);
      }

      if (fechaCustom.end) {
        const [y, m, d] = fechaCustom.end.split('-').map(Number);
        fin = new Date(y, m - 1, d, 23, 59, 59, 999);
      } else if (fechaCustom.start) {
        // Si sólo se ha seleccionado el día de inicio, filtramos ese día completo
        const [y, m, d] = fechaCustom.start.split('-').map(Number);
        fin = new Date(y, m - 1, d, 23, 59, 59, 999);
      } else {
        fin = new Date(ahora);
        fin.setHours(23, 59, 59, 999);
      }

      dias = Math.max(1, Math.round((fin.getTime() - inicio.getTime()) / (24 * 60 * 60 * 1000)));

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
    totalOtros,
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
    let otrosCount = 0;

    const sedesMap = new Map<string, number>();
    const tiposMap = new Map<string, number>();
    const vigilantesMap = new Map<string, { nombre: string; count: number }>();

    minutasFiltradas.forEach((m) => {
      const tipoNom = (m.tipos_novedad?.nombre || 'General').trim();
      const sedeNom = (m.sedes?.nombre || 'Sin Sede').trim();
      const vigNom = (m.perfiles?.nombre || 'Desconocido').trim();

      // Conteo por tipo exacto de anotación
      const tipoLower = tipoNom.toLowerCase();
      if (tipoLower.includes('novedad')) {
        novedadesCount++;
      } else if (tipoLower.includes('ronda')) {
        rondasCount++;
      } else {
        otrosCount++;
      }

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
      totalOtros: otrosCount,
      porcentajeNovedades: pctNov,
      sedeTop: { nombre: topSedeNombre, count: topSedeCount, porcentaje: total > 0 ? Math.round((topSedeCount / total) * 100) : 0 },
      distribucionTipos: distTipos,
      distribucionSedes: distSedes,
      topVigilantes: topVigs
    };
  }, [minutasFiltradas, diasEnRango]);

  // ─── Auditoría y Seguimiento de Puestos ────────────────────────
  const { puestosAuditoria, conteoInactivos, conteoBajos, conteoActivos } = useMemo(() => {
    // 1. Mapeo de minutas por sede en el periodo filtrado
    const conteoPeriodoMap = new Map<string, number>();
    minutasFiltradas.forEach((m) => {
      const sedeId = m.sede_id || m.sedes?.id;
      if (sedeId) {
        conteoPeriodoMap.set(sedeId, (conteoPeriodoMap.get(sedeId) || 0) + 1);
      }
    });

    // 2. Mapeo de última actividad histórica por sede (de la lista total de minutas ya ordenada descendente)
    const ultimaActividadMap = new Map<string, { fecha: string; vigilante: string; cedula: string }>();
    minutas.forEach((m) => {
      const sedeId = m.sede_id || m.sedes?.id;
      if (sedeId && !ultimaActividadMap.has(sedeId)) {
        ultimaActividadMap.set(sedeId, {
          fecha: m.fecha_hora,
          vigilante: m.perfiles?.nombre || '—',
          cedula: m.perfiles?.cedula || '—'
        });
      }
    });

    let inactivos = 0;
    let bajos = 0;
    let activos = 0;

    const lista: PuestoAuditoria[] = todasLasSedes.map((sede) => {
      const totalPeriodo = conteoPeriodoMap.get(sede.id) || 0;
      const prom = totalPeriodo > 0 ? (totalPeriodo / diasEnRango).toFixed(1) : '0';

      let estado: EstadoPuesto = 'activo';
      if (totalPeriodo === 0) {
        estado = 'inactivo';
        inactivos++;
      } else if (diasEnRango === 1 ? totalPeriodo <= 2 : totalPeriodo < diasEnRango) {
        estado = 'bajo';
        bajos++;
      } else {
        estado = 'activo';
        activos++;
      }

      const ult = ultimaActividadMap.get(sede.id);

      return {
        id: sede.id,
        nombre: sede.nombre,
        totalPeriodo,
        promedioDiario: prom,
        estado,
        ultimoRegistroFecha: ult?.fecha || null,
        ultimoVigilanteNombre: ult?.vigilante || null,
        ultimoVigilanteCedula: ult?.cedula || null
      };
    });

    // Ordenar: primero inactivos (0 registros), luego con baja actividad, y dentro por menor cantidad
    lista.sort((a, b) => {
      const ordenEstado: Record<EstadoPuesto, number> = { inactivo: 0, bajo: 1, activo: 2 };
      if (ordenEstado[a.estado] !== ordenEstado[b.estado]) {
        return ordenEstado[a.estado] - ordenEstado[b.estado];
      }
      return a.totalPeriodo - b.totalPeriodo || a.nombre.localeCompare(b.nombre);
    });

    return {
      puestosAuditoria: lista,
      conteoInactivos: inactivos,
      conteoBajos: bajos,
      conteoActivos: activos
    };
  }, [todasLasSedes, minutasFiltradas, minutas, diasEnRango]);

  const puestosFiltrados = useMemo(() => {
    return puestosAuditoria.filter((p) => {
      const coincideEstado = filtroEstadoPuesto === 'todos' || p.estado === filtroEstadoPuesto;
      const coincideBusqueda = !busquedaPuesto.trim() || p.nombre.toLowerCase().includes(busquedaPuesto.trim().toLowerCase());
      return coincideEstado && coincideBusqueda;
    });
  }, [puestosAuditoria, filtroEstadoPuesto, busquedaPuesto]);

  // ─── Paginación de Puestos (Por defecto 10 registros) ────────
  const [tamanoPaginaPuestos, setTamanoPaginaPuestos] = useState(10);
  const [paginaActualPuestos, setPaginaActualPuestos] = useState(1);

  // Reiniciar a la primera página si cambia el filtro o la búsqueda
  useEffect(() => {
    setPaginaActualPuestos(1);
  }, [filtroEstadoPuesto, busquedaPuesto]);

  const totalPaginasPuestos = Math.ceil(puestosFiltrados.length / tamanoPaginaPuestos) || 1;
  const paginaSeguraPuestos = Math.min(Math.max(1, paginaActualPuestos), totalPaginasPuestos);

  const puestosPaginados = useMemo(() => {
    const inicio = (paginaSeguraPuestos - 1) * tamanoPaginaPuestos;
    return puestosFiltrados.slice(inicio, inicio + tamanoPaginaPuestos);
  }, [puestosFiltrados, paginaSeguraPuestos, tamanoPaginaPuestos]);

  // ─── Exportar a Excel ─────────────────────────────────────────
  const handleExportarExcel = async () => {
    if (minutasFiltradas.length === 0 && puestosAuditoria.length === 0) {
      alert('No hay datos en el periodo seleccionado para exportar.');
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

      const puestosExport: PuestoAuditoriaReporte[] = puestosAuditoria.map((p) => ({
        sede: p.nombre,
        estado: p.estado === 'inactivo' ? 'Sin Actividad (0)' : (p.estado === 'bajo' ? 'Baja Actividad' : 'Activo / Conforme'),
        totalPeriodo: p.totalPeriodo,
        promedioDiario: p.promedioDiario,
        ultimaFecha: p.ultimoRegistroFecha ? formatearFechaHoraColombia(p.ultimoRegistroFecha) : 'Sin registros previos',
        ultimoVigilante: p.ultimoVigilanteNombre || '—',
        cedula: p.ultimoVigilanteCedula || '—'
      }));

      await descargarReporteExcel(dataExport, periodoTitulo, puestosExport);
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
            <span className="back-pill-text">Inicio</span>
          </button>

          <div className="metricas-header-divider" />

          <div className="metricas-title-badge">
            <BarChart3 size={18} color="#da2d34" />
            <h1>
              <span className="title-text-full">Métricas y Reportes</span>
              <span className="title-text-short">Métricas</span>
            </h1>
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
            onClick={() => {
              setRango('custom');
              setClaveSelectorPersonalizado((c) => c + 1);
            }}
          >
            <Calendar size={13} />
            <span>Rango</span>
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
                    data-tooltip={`${totalNovedades} Novedades, ${totalRondas} Rondas${totalOtros > 0 ? `, ${totalOtros} Otros tipos` : ''}`}
                  />
                </div>
                <div className="kpi-split-info">
                  <span>🛡️ {totalRondas} Rondas</span>
                  <span>🚨 {totalNovedades} Novedades</span>
                  {totalOtros > 0 && <span>📋 {totalOtros} Otros</span>}
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

              {/* Tarjeta 4: Control y Auditoría de Puestos */}
              <div 
                className={`kpi-card ${conteoInactivos > 0 ? 'kpi-danger' : (conteoBajos > 0 ? 'kpi-warning' : '')}`}
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  const elemento = document.getElementById('seccion-auditoria-puestos');
                  if (elemento) elemento.scrollIntoView({ behavior: 'smooth' });
                  if (conteoInactivos > 0) setFiltroEstadoPuesto('inactivo');
                  else if (conteoBajos > 0) setFiltroEstadoPuesto('bajo');
                  else setFiltroEstadoPuesto('todos');
                }}
                title="Hacer clic para ver auditoría de puestos"
              >
                <div className="kpi-card-header">
                  <span className="kpi-tag">Control de Puestos</span>
                  {conteoInactivos > 0 ? (
                    <ShieldAlert size={18} color="#da2d34" />
                  ) : conteoBajos > 0 ? (
                    <AlertTriangle size={18} color="#f59e0b" />
                  ) : (
                    <CheckCircle2 size={18} color="#00875a" />
                  )}
                </div>
                <div className="kpi-main-metric">
                  <span className={`kpi-number ${conteoInactivos > 0 ? 'text-danger' : (conteoBajos > 0 ? 'text-alert' : 'text-success')}`}>
                    {conteoInactivos + conteoBajos}
                  </span>
                  <span className="kpi-unit">en observación</span>
                </div>
                <div className="kpi-sub-pill">
                  <span>🔴 {conteoInactivos} sin registro • 🟡 {conteoBajos} bajo</span>
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

            {/* ── FILA 4: Auditoría y Seguimiento de Puestos de Vigilancia (Al final) ── */}
            <div id="seccion-auditoria-puestos" className="puestos-section-card">
              <div className="section-card-header">
                <div className="section-header-title-group">
                  <div className="section-icon-badge">
                    <Building2 size={20} color="#da2d34" />
                  </div>
                  <div>
                    <h3>Auditoría y Seguimiento de Puestos de Vigilancia</h3>
                    <span className="section-subtitle">
                      Control de digitación y cumplimiento por sede en: {periodoTitulo}
                    </span>
                  </div>
                </div>

                {/* Badge resumen de alerta */}
                {(conteoInactivos > 0 || conteoBajos > 0) && (
                  <div className="puestos-alert-pill">
                    <AlertTriangle size={14} color="#da2d34" />
                    <span>
                      {conteoInactivos > 0 ? `${conteoInactivos} sin registrar` : ''}
                      {conteoInactivos > 0 && conteoBajos > 0 ? ' • ' : ''}
                      {conteoBajos > 0 ? `${conteoBajos} baja digitación` : ''}
                    </span>
                  </div>
                )}
              </div>

              {/* Barra de Filtros: Buscador a la izquierda, Píldoras a la derecha */}
              <div className="puestos-toolbar">
                <div className="puestos-search-box">
                  <Search size={14} className="search-icon" />
                  <input
                    type="text"
                    placeholder="Buscar puesto o sede..."
                    value={busquedaPuesto}
                    onChange={(e) => setBusquedaPuesto(e.target.value)}
                  />
                  {busquedaPuesto && (
                    <button className="clear-search-btn" onClick={() => setBusquedaPuesto('')} title="Limpiar búsqueda">
                      ✕
                    </button>
                  )}
                </div>

                <div className="puestos-status-pills">
                  <button
                    className={`puesto-filter-pill ${filtroEstadoPuesto === 'todos' ? 'active' : ''}`}
                    onClick={() => setFiltroEstadoPuesto('todos')}
                  >
                    <span>Todos los Puestos</span>
                    <span className="pill-badge">{puestosAuditoria.length}</span>
                  </button>

                  <button
                    className={`puesto-filter-pill pill-danger ${filtroEstadoPuesto === 'inactivo' ? 'active' : ''}`}
                    onClick={() => setFiltroEstadoPuesto('inactivo')}
                  >
                    <span className="status-dot dot-red" />
                    <span>Sin Actividad (0)</span>
                    <span className="pill-badge badge-danger">{conteoInactivos}</span>
                  </button>

                  <button
                    className={`puesto-filter-pill pill-warning ${filtroEstadoPuesto === 'bajo' ? 'active' : ''}`}
                    onClick={() => setFiltroEstadoPuesto('bajo')}
                  >
                    <span className="status-dot dot-yellow" />
                    <span>Baja Digitación</span>
                    <span className="pill-badge badge-warning">{conteoBajos}</span>
                  </button>

                  <button
                    className={`puesto-filter-pill pill-success ${filtroEstadoPuesto === 'activo' ? 'active' : ''}`}
                    onClick={() => setFiltroEstadoPuesto('activo')}
                  >
                    <span className="status-dot dot-green" />
                    <span>Conforme / Activo</span>
                    <span className="pill-badge badge-success">{conteoActivos}</span>
                  </button>
                </div>
              </div>

              {/* Lista / Tabla de Puestos */}
              <div className="puestos-grid-container">
                {puestosFiltrados.length === 0 ? (
                  <div className="puestos-empty-state">
                    <CheckCircle2 size={32} color="#00875a" />
                    <p>No se encontraron puestos bajo este criterio de filtro.</p>
                  </div>
                ) : (
                  <div className="puestos-table-wrapper">
                    <table className="puestos-table">
                      <thead>
                        <tr>
                          <th className="th-sede">Sede</th>
                          <th>Estado</th>
                          <th>Minutas en Periodo</th>
                          <th>Promedio / Día</th>
                          <th>Última Actividad Registrada</th>
                          <th>Último Vigilante</th>
                          <th style={{ textAlign: 'center' }}>Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {puestosPaginados.map((p) => (
                          <tr key={p.id} className={`puesto-row puesto-${p.estado}`}>
                            <td className="puesto-col-name">
                              <Building2 size={16} className="puesto-icon" />
                              <strong>{p.nombre}</strong>
                            </td>
                            <td>
                              {p.estado === 'inactivo' && (
                                <span className="puesto-badge badge-inactivo">
                                  <span className="status-dot dot-red" /> Sin registros
                                </span>
                              )}
                              {p.estado === 'bajo' && (
                                <span className="puesto-badge badge-bajo">
                                  <span className="status-dot dot-yellow" /> Baja digitación
                                </span>
                              )}
                              {p.estado === 'activo' && (
                                <span className="puesto-badge badge-activo">
                                  <span className="status-dot dot-green" /> Conforme
                                </span>
                              )}
                            </td>
                            <td className="puesto-col-count">
                              <span className={`count-number ${p.totalPeriodo === 0 ? 'text-zero' : ''}`}>
                                {p.totalPeriodo}
                              </span>{' '}
                              minutas
                            </td>
                            <td className="puesto-col-avg">
                              {p.promedioDiario} / día
                            </td>
                            <td className="puesto-col-fecha">
                              {p.ultimoRegistroFecha ? (
                                <div className="fecha-vig-wrapper">
                                  <Clock size={13} />
                                  <span>{formatearFechaHoraColombia(p.ultimoRegistroFecha)}</span>
                                </div>
                              ) : (
                                <span className="text-muted">Sin historial previo</span>
                              )}
                            </td>
                            <td className="puesto-col-vig">
                              {p.ultimoVigilanteNombre ? (
                                <div className="vig-info-stacked">
                                  <div className="vig-name-row">
                                    <User size={13} className="vig-icon" />
                                    <span className="vig-name">{p.ultimoVigilanteNombre}</span>
                                  </div>
                                  {p.ultimoVigilanteCedula && p.ultimoVigilanteCedula !== '—' && (
                                    <span className="vig-cc">CC: {p.ultimoVigilanteCedula}</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted">—</span>
                              )}
                            </td>
                            <td className="puesto-col-action" style={{ textAlign: 'center' }}>
                              <button
                                className="btn-seguimiento-puesto"
                                onClick={() => navigate(`/seguimiento?sede=${encodeURIComponent(p.id)}`)}
                                title={`Ver seguimiento de minutas de ${p.nombre}`}
                              >
                                <Eye size={13} />
                                <span>Ver Bitácora</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* ── Barra de paginación de Puestos ──────── */}
                    <div className="puestos-pagination">
                      {/* Selector de filas */}
                      <div className="puestos-page-size">
                        <span>Mostrar</span>
                        <select 
                          className="puestos-native-select"
                          value={tamanoPaginaPuestos}
                          onChange={(e) => {
                            setTamanoPaginaPuestos(Number(e.target.value));
                            setPaginaActualPuestos(1);
                          }}
                        >
                          <option value="5">5</option>
                          <option value="10">10</option>
                          <option value="20">20</option>
                          <option value="50">50</option>
                          <option value="100">100</option>
                        </select>
                        <span>filas</span>
                      </div>

                      {/* Navegación */}
                      <div className="puestos-page-nav">
                        <button
                          className="puestos-page-btn"
                          onClick={() => setPaginaActualPuestos((p) => Math.max(1, p - 1))}
                          disabled={paginaSeguraPuestos === 1}
                          aria-label="Página anterior"
                        >
                          <ChevronLeft size={18} />
                        </button>

                        <span className="puestos-page-info">
                          {paginaSeguraPuestos} / {totalPaginasPuestos}
                        </span>

                        <button
                          className="puestos-page-btn"
                          onClick={() => setPaginaActualPuestos((p) => Math.min(totalPaginasPuestos, p + 1))}
                          disabled={paginaSeguraPuestos === totalPaginasPuestos}
                          aria-label="Página siguiente"
                        >
                          <ChevronRight size={18} />
                        </button>
                      </div>

                      {/* Total */}
                      <span className="puestos-total-label">
                        {puestosFiltrados.length} reg.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}
