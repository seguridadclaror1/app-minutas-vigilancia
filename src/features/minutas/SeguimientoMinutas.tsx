import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Search, 
  Eye, 
  X, 
  Loader2, 
  ChevronDown, 
  ChevronLeft, 
  ChevronRight,
  ClipboardList,
  Users,
  Power,
  Home,
  BarChart3
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../config/supabase';
import type { Minuta, Sede, TipoNovedad, Evidencia } from '../../types/database';
import { 
  obtenerRangoUtcParaFiltroColombia, 
  formatearFechaColombia, 
  formatearFechaHoraColombia 
} from '../../utils/fechasColombia';
import PremiumSelect from '../../components/PremiumSelect';
import PremiumDatePicker from '../../components/PremiumDatePicker';
import ModalConfirmarSalida from '../../components/ModalConfirmarSalida';
import './SeguimientoMinutas.css';

interface MinutaConRelaciones extends Omit<Minuta, 'perfiles' | 'sedes' | 'tipos_novedad'> {
  sedes: Sede;
  tipos_novedad: TipoNovedad;
  perfiles: { nombre: string; cedula: string };
}

interface DetalleMinuta extends MinutaConRelaciones {
  evidencias: Evidencia[];
}

export default function SeguimientoMinutas() {
  const navigate = useNavigate();
  const { perfil, signOut } = useAuth();

  // Estado del Dropdown de Perfil
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Estado del modal de confirmación de salida
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

  // Datos base
  const [minutas, setMinutas]         = useState<MinutaConRelaciones[]>([]);
  const [sedes, setSedes]             = useState<Sede[]>([]);
  const [tiposNovedad, setTiposNovedad] = useState<TipoNovedad[]>([]);
  const [loading, setLoading]         = useState(true);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [fechaFiltro, setFechaFiltro] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [sedeFiltro, setSedeFiltro] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('');
  const [showFiltros, setShowFiltros] = useState(false);

  // Paginación
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Modal de detalle
  const [minutaDetalle, setMinutaDetalle]   = useState<DetalleMinuta | null>(null);
  const [loadingDetalle, setLoadingDetalle] = useState(false);

  // ─── Fetch catálogos con datos reales ────────────────────────
  const fetchCatalogos = useCallback(async () => {
    // Solo traemos sedes y tipos que realmente tienen minutas
    const [{ data: minutasRaw }] = await Promise.all([
      supabase
        .from('minutas')
        .select('sede_id, tipo_novedad_id, sedes(id,nombre), tipos_novedad(id,nombre)'),
    ]);

    if (minutasRaw) {
      const sedesMap = new Map<string, Sede>();
      const tiposMap = new Map<string, TipoNovedad>();
      for (const m of minutasRaw as any[]) {
        if (m.sedes)         sedesMap.set(m.sedes.id, m.sedes);
        if (m.tipos_novedad) tiposMap.set(m.tipos_novedad.id, m.tipos_novedad);
      }
      setSedes([...sedesMap.values()].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setTiposNovedad([...tiposMap.values()].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    }
  }, []);

  // ─── Fetch minutas ────────────────────────────────────────────
  const fetchMinutas = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('minutas')
        .select(`*, sedes(id,nombre), tipos_novedad(id,nombre), perfiles(nombre,cedula)`)
        .order('fecha_hora', { ascending: false });

      if (fechaFiltro.start) {
        const { desde, hasta } = obtenerRangoUtcParaFiltroColombia(fechaFiltro.start, fechaFiltro.end);
        query = query.gte('fecha_hora', desde);
        query = query.lte('fecha_hora', hasta);
      }
      if (sedeFiltro)  query = query.eq('sede_id', sedeFiltro);
      if (tipoFiltro)  query = query.eq('tipo_novedad_id', tipoFiltro);

      const { data, error } = await query;
      if (error) throw error;
      setMinutas((data as MinutaConRelaciones[]) ?? []);
    } catch (err) {
      console.error('Error cargando minutas:', err);
    } finally {
      setLoading(false);
    }
  }, [fechaFiltro, sedeFiltro, tipoFiltro]);

  useEffect(() => { fetchCatalogos(); }, [fetchCatalogos]);
  useEffect(() => { fetchMinutas(); setCurrentPage(1); }, [fetchMinutas]);

  // ─── Filtro local (nombre / cédula) ──────────────────────────
  const minutasFiltradas = useMemo(() =>
    minutas.filter((m) => {
      if (!searchTerm) return true;
      const t = searchTerm.toLowerCase();
      return m.perfiles?.nombre?.toLowerCase().includes(t) || m.perfiles?.cedula?.includes(t);
    }),
    [minutas, searchTerm]
  );

  // ─── Paginación ───────────────────────────────────────────────
  const totalPages  = Math.max(1, Math.ceil(minutasFiltradas.length / pageSize));
  const safePage    = Math.min(currentPage, totalPages);
  const pageRecords = minutasFiltradas.slice((safePage - 1) * pageSize, safePage * pageSize);

  const handlePageSizeChange = (val: string) => {
    setPageSize(Number(val));
    setCurrentPage(1);
  };

  // ─── Ver detalle ──────────────────────────────────────────────
  const handleVerDetalle = async (minuta: MinutaConRelaciones) => {
    setLoadingDetalle(true);
    setMinutaDetalle({ ...minuta, evidencias: [] });
    try {
      const { data } = await supabase.from('evidencias').select('*').eq('minuta_id', minuta.id);
      setMinutaDetalle({ ...minuta, evidencias: (data as Evidencia[]) ?? [] });
    } catch {
      setMinutaDetalle({ ...minuta, evidencias: [] });
    } finally {
      setLoadingDetalle(false);
    }
  };

  const limpiarFiltros = () => {
    setSearchTerm(''); setFechaFiltro({ start: '', end: '' }); setSedeFiltro(''); setTipoFiltro('');
    setCurrentPage(1);
  };

  const hayFiltros = !!(searchTerm || fechaFiltro.start || fechaFiltro.end || sedeFiltro || tipoFiltro);

  // ─── Helpers ──────────────────────────────────────────────────
  const formatFecha = (iso: string) => formatearFechaColombia(iso);

  const formatFechaHora = (iso: string) => formatearFechaHoraColombia(iso);

  // ─── Render ───────────────────────────────────────────────────
  return (
    <div className="seg-page">

      {/* ── Header Corporativo Enterprise ─────────────────────────── */}
      <header className="seg-header">
        <div className="seg-header-left">
          <button 
            className="seg-back-pill" 
            onClick={() => navigate('/')} 
            aria-label="Volver a Inicio"
            data-tooltip="Volver a Inicio"
          >
            <ArrowLeft size={16} />
            <span className="back-pill-text">Inicio</span>
          </button>

          <div className="seg-header-divider" />

          <div className="seg-title-badge">
            <ClipboardList size={18} color="#da2d34" />
            <h1>
              <span className="title-text-full">Seguimiento de Minutas</span>
              <span className="title-text-short">Seguimiento</span>
            </h1>
          </div>
        </div>

        <div className="seg-header-right">
          <button
            className={`seg-btn-filter-pill ${hayFiltros ? 'active' : ''} ${showFiltros ? 'open' : ''}`}
            onClick={() => setShowFiltros(!showFiltros)}
            aria-label="Filtros"
            data-tooltip={showFiltros ? 'Ocultar panel de filtros' : 'Abrir filtros de búsqueda'}
          >
            <Search size={15} />
            <span>Filtros</span>
            {hayFiltros && <span className="filtro-dot" />}
            <ChevronDown size={14} className={`filtro-chevron ${showFiltros ? 'rotate' : ''}`} />
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
                  {perfil?.rol === 'administrador' && (
                    <>
                      <button className="dropdown-item" onClick={() => { setIsProfileOpen(false); navigate('/admin/usuarios'); }}>
                        <Users size={16} />
                        <span>Gestión de Usuarios</span>
                      </button>
                      <button className="dropdown-item" onClick={() => { setIsProfileOpen(false); navigate('/metricas'); }}>
                        <BarChart3 size={16} />
                        <span>Métricas y Reportes</span>
                      </button>
                    </>
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

      {/* ── Panel de Filtros ───────────────── */}
      <div className={`seg-filtros-panel ${showFiltros ? 'open' : ''}`}>
        <div className="seg-filtros-inner">

          {/* Fecha — Premium Custom */}
          <div className="seg-filter-group">
            <label className="seg-filter-label">Fecha</label>
            <PremiumDatePicker 
              startDate={fechaFiltro.start}
              endDate={fechaFiltro.end}
              onChange={(start, end) => { setFechaFiltro({ start, end }); setCurrentPage(1); }} 
            />
          </div>

          {/* Buscador */}
          <div className="seg-filter-group">
            <label className="seg-filter-label">Nombre o cédula</label>
            <div className="seg-search-box">
              <Search size={16} className="seg-search-icon" />
              <input
                type="text"
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="seg-search-input"
              />
            </div>
          </div>

          {/* Sede */}
          <div className="seg-filter-group">
            <label className="seg-filter-label">Sede</label>
            <PremiumSelect
              value={sedeFiltro}
              onChange={(v) => { setSedeFiltro(v); setCurrentPage(1); }}
              options={[
                { value: '', label: 'Todas las sedes' },
                ...sedes.map((s) => ({ value: s.id, label: s.nombre })),
              ]}
              placeholder="Todas las sedes"
              searchable
            />
          </div>

          {/* Tipo de novedad */}
          <div className="seg-filter-group">
            <label className="seg-filter-label">Tipo de anotación</label>
            <PremiumSelect
              value={tipoFiltro}
              onChange={(v) => { setTipoFiltro(v); setCurrentPage(1); }}
              options={[
                { value: '', label: 'Todos los tipos' },
                ...tiposNovedad.map((t) => ({ value: t.id, label: t.nombre })),
              ]}
              placeholder="Todos los tipos"
            />
          </div>

          {hayFiltros && (
            <button className="seg-clear-btn" onClick={limpiarFiltros}>Limpiar filtros</button>
          )}
        </div>
      </div>

      {/* ── Main ───────────────────────────── */}
      <main className="seg-main">
        {loading ? (
          <div className="seg-loading">
            <Loader2 className="spin-icon" size={32} color="#da2d34" />
          </div>
        ) : minutasFiltradas.length === 0 ? (
          <div className="seg-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#e4bdba" strokeWidth="1.5">
              <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
              <rect x="9" y="3" width="6" height="4" rx="1"/>
            </svg>
            <p>No se encontraron minutas</p>
            {hayFiltros && <button className="seg-clear-btn" onClick={limpiarFiltros}>Limpiar filtros</button>}
          </div>
        ) : (
          <>
            {/* Tabla */}
            <div className="seg-table-wrapper">
              <table className="seg-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Cédula</th>
                    <th>Sede</th>
                    <th>Novedad</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pageRecords.map((m) => (
                    <tr key={m.id}>
                      <td className="seg-td-fecha">{formatFecha(m.fecha_hora)}</td>
                      <td className="seg-td-cedula">{m.perfiles?.cedula ?? '—'}</td>
                      <td className="seg-td-sede">{m.sedes?.nombre ?? '—'}</td>
                      <td className="seg-td-novedad">
                        <span className="novedad-badge">{m.tipos_novedad?.nombre ?? '—'}</span>
                      </td>
                      <td>
                        <button 
                          className="seg-btn-eye" 
                          onClick={() => handleVerDetalle(m)} 
                          aria-label="Ver detalle"
                          data-tooltip="Ver detalle"
                          data-tooltip-pos="left"
                        >
                          <Eye size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Barra de paginación ──────── */}
            <div className="seg-pagination">
              {/* Selector de filas */}
              <div className="seg-page-size">
                <span>Mostrar</span>
                <select 
                  className="seg-native-select"
                  value={pageSize}
                  onChange={(e) => handlePageSizeChange(e.target.value)}
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
              <div className="seg-page-nav">
                <button
                  className="seg-page-btn"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  aria-label="Página anterior"
                >
                  <ChevronLeft size={18} />
                </button>

                <span className="seg-page-info">
                  {safePage} / {totalPages}
                </span>

                <button
                  className="seg-page-btn"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  aria-label="Página siguiente"
                >
                  <ChevronRight size={18} />
                </button>
              </div>

              {/* Total */}
              <span className="seg-total-label">
                {minutasFiltradas.length} reg.
              </span>
            </div>
          </>
        )}
      </main>

      {/* ── Modal Detalle ──────────────────── */}
      {minutaDetalle && (
        <div className="modal-overlay" onClick={() => setMinutaDetalle(null)}>
          <div className="seg-modal" onClick={(e) => e.stopPropagation()}>
            <div className="seg-modal-header">
              <h2>Detalle de Minuta</h2>
              <button className="seg-modal-close" onClick={() => setMinutaDetalle(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="seg-modal-body">
              {loadingDetalle && (
                <div className="seg-loading" style={{ height: 80 }}>
                  <Loader2 className="spin-icon" size={24} color="#da2d34" />
                </div>
              )}

              <div className="seg-detail-grid">
                <div className="seg-detail-item">
                  <span className="seg-detail-label">Vigilante</span>
                  <span className="seg-detail-value">{minutaDetalle.perfiles?.nombre ?? '—'}</span>
                </div>
                <div className="seg-detail-item">
                  <span className="seg-detail-label">Cédula</span>
                  <span className="seg-detail-value">{minutaDetalle.perfiles?.cedula ?? '—'}</span>
                </div>
                <div className="seg-detail-item">
                  <span className="seg-detail-label">Fecha y hora</span>
                  <span className="seg-detail-value">{formatFechaHora(minutaDetalle.fecha_hora)}</span>
                </div>
                <div className="seg-detail-item">
                  <span className="seg-detail-label">Sede</span>
                  <span className="seg-detail-value">{minutaDetalle.sedes?.nombre ?? '—'}</span>
                </div>
                <div className="seg-detail-item">
                  <span className="seg-detail-label">Tipo de anotación</span>
                  <span className="seg-detail-value">
                    <span className="novedad-badge">{minutaDetalle.tipos_novedad?.nombre ?? '—'}</span>
                  </span>
                </div>
                <div className="seg-detail-item seg-detail-full">
                  <span className="seg-detail-label">Descripción</span>
                  <p className="seg-detail-desc">{minutaDetalle.descripcion}</p>
                </div>
              </div>

              {!loadingDetalle && (
                <div className="seg-evidencias">
                  <h3 className="seg-evidencias-title">Evidencias fotográficas</h3>
                  {minutaDetalle.evidencias.length === 0 ? (
                    <p className="seg-evidencias-empty">Sin evidencias adjuntas</p>
                  ) : (
                    <div className="seg-fotos-grid">
                      {minutaDetalle.evidencias.map((ev) => (
                        <a key={ev.id} href={ev.url_imagen} target="_blank" rel="noopener noreferrer">
                          <img src={ev.url_imagen} alt="Evidencia" className="seg-foto" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
