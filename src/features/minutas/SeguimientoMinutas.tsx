import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Eye, X, Loader2, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../../config/supabase';
import type { Minuta, Sede, TipoNovedad, Evidencia } from '../../types/database';
import PremiumSelect from '../../components/PremiumSelect';
import PremiumDatePicker from '../../components/PremiumDatePicker';
import './SeguimientoMinutas.css';

interface MinutaConRelaciones extends Omit<Minuta, 'perfiles' | 'sedes' | 'tipos_novedad'> {
  sedes: Sede;
  tipos_novedad: TipoNovedad;
  perfiles: { nombre: string; cedula: string };
}

interface DetalleMinuta extends MinutaConRelaciones {
  evidencias: Evidencia[];
}

const PAGE_SIZE_OPTIONS = [
  { value: '5',   label: '5' },
  { value: '10',  label: '10' },
  { value: '20',  label: '20' },
  { value: '50',  label: '50' },
  { value: '100', label: '100' },
];

export default function SeguimientoMinutas() {
  const navigate = useNavigate();

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
        query = query.gte('fecha_hora', `${fechaFiltro.start}T00:00:00`);
        const endToUse = fechaFiltro.end || fechaFiltro.start;
        query = query.lte('fecha_hora', `${endToUse}T23:59:59`);
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
  const formatFecha = (iso: string) =>
    new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const formatFechaHora = (iso: string) =>
    new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  // ─── Render ───────────────────────────────────────────────────
  return (
    <div className="seg-page">

      {/* ── Header ─────────────────────────── */}
      <header className="seg-header">
        <div className="header-title-row">
          <button className="back-btn" onClick={() => navigate('/')} aria-label="Volver">
            <ArrowLeft size={24} />
          </button>
          <h1>Seguimiento de Minutas</h1>
        </div>
        <button
          className={`seg-filtro-toggle ${hayFiltros ? 'active' : ''}`}
          onClick={() => setShowFiltros(!showFiltros)}
          aria-label="Filtros"
        >
          <ChevronDown
            size={20}
            style={{ transform: showFiltros ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s' }}
          />
          {hayFiltros && <span className="filtro-dot" />}
        </button>
      </header>

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
            <label className="seg-filter-label">Tipo de novedad</label>
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
                        <button className="seg-btn-eye" onClick={() => handleVerDetalle(m)} title="Ver detalle">
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
                <PremiumSelect
                  value={String(pageSize)}
                  onChange={handlePageSizeChange}
                  options={PAGE_SIZE_OPTIONS}
                  placeholder="10"
                  direction="up"
                />
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
                  <span className="seg-detail-label">Tipo de novedad</span>
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
