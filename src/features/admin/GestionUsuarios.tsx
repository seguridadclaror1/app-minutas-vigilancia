import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, 
  Plus, 
  Eye, 
  EyeOff, 
  Edit2, 
  Loader2, 
  ArrowLeft, 
  FileSpreadsheet, 
  ChevronLeft, 
  ChevronRight,
  Users,
  ClipboardList,
  Home,
  BarChart3,
  Power,
  ChevronDown
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { supabaseAdmin } from '../../config/supabaseAdmin';
import { supabase } from '../../config/supabase';
import type { Perfil } from '../../types/database';
import ModalUsuario from './ModalUsuario';
import ModalCargaMasiva from './ModalCargaMasiva';
import ModalConfirmarSalida from '../../components/ModalConfirmarSalida';
import './GestionUsuarios.css';

import { translateError } from '../../utils/errorTranslator';

export default function GestionUsuarios() {
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

  const [usuarios, setUsuarios] = useState<Perfil[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Paginación
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Estado para visibilidad de contraseñas individualmente (Set de IDs)
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  
  // Estado del Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCargaMasivaOpen, setIsCargaMasivaOpen] = useState(false);
  const [usuarioToEdit, setUsuarioToEdit] = useState<Perfil | undefined>(undefined);
  
  // Estado para eliminar
  const [usuarioToDelete, setUsuarioToDelete] = useState<Perfil | undefined>(undefined);
  const [isDeleting, setIsDeleting] = useState(false);

  // Estado del Toast (Mensaje de éxito flotante)
  const [toastMsg, setToastMsg] = useState('');

  const fetchUsuarios = async () => {
    try {
      const { data, error } = await supabase
        .from('perfiles')
        .select('*')
        .order('nombre', { ascending: true }); // Orden alfabético por nombre
        
      if (error) throw error;
      setUsuarios(data as Perfil[]);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsuarios();
  }, []);

  // Reiniciar a la página 1 si cambia la búsqueda o el tamaño de página
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, pageSize]);

  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleEstado = async (usuario: Perfil) => {
    const nuevoEstado = usuario.estado === 'activo' ? 'inactivo' : 'activo';
    
    // Optimistic UI update
    setUsuarios(prev => prev.map(u => u.id === usuario.id ? { ...u, estado: nuevoEstado } : u));
    
    try {
      const { error } = await supabase
        .from('perfiles')
        .update({ estado: nuevoEstado })
        .eq('id', usuario.id);
        
      if (error) throw error;
      setToastMsg('Estado actualizado con éxito');
      setTimeout(() => setToastMsg(''), 3000);
    } catch (err) {
      console.error('Error actualizando estado:', err);
      // Revertir en caso de error
      setUsuarios(prev => prev.map(u => u.id === usuario.id ? { ...u, estado: usuario.estado } : u));
    }
  };

  const handleEditClick = (usuario?: Perfil) => {
    setUsuarioToEdit(usuario);
    setIsModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!usuarioToDelete) return;
    setIsDeleting(true);
    try {
      // 1. Validar si el usuario tiene minutas registradas antes de intentar borrarlo
      const { count, error: countError } = await supabase
        .from('minutas')
        .select('*', { count: 'exact', head: true })
        .eq('usuario_id', usuarioToDelete.id);

      if (countError) throw countError;

      if (count && count > 0) {
        alert(`No se puede eliminar a "${usuarioToDelete.nombre}" porque tiene ${count} minuta(s) registrada(s).\n\nPara revocarle el acceso de forma segura, edítalo y cambia su estado a "Inactivo".`);
        setIsDeleting(false);
        setUsuarioToDelete(undefined);
        return;
      }

      // Borrar de auth.users usando Supabase Admin API
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(usuarioToDelete.id);
      if (authError) throw authError;

      // Borrar de la tabla perfiles
      const { error: dbError } = await supabase
        .from('perfiles')
        .delete()
        .eq('id', usuarioToDelete.id);
      if (dbError) throw dbError;

      setToastMsg('Usuario eliminado correctamente');
      setTimeout(() => setToastMsg(''), 3000);
      fetchUsuarios();
    } catch (err: any) {
      console.error('Error deleting user:', err);
      alert(translateError(err.message || 'Error al eliminar el usuario'));
    } finally {
      setIsDeleting(false);
      setUsuarioToDelete(undefined);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setUsuarioToEdit(undefined);
  };

  const onSaved = (msg?: string) => {
    closeModal();
    fetchUsuarios();
    if (msg) {
      setToastMsg(msg);
      setTimeout(() => setToastMsg(''), 3000);
    }
  };

  // Filtrado local
  const filteredUsuarios = useMemo(() => {
    return usuarios.filter(u => 
      u.cedula.includes(searchTerm) || 
      u.nombre.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [usuarios, searchTerm]);

  // Cálculos de Paginación
  const totalPages = Math.max(1, Math.ceil(filteredUsuarios.length / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedUsuarios = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredUsuarios.slice(start, start + pageSize);
  }, [filteredUsuarios, safePage, pageSize]);

  return (
    <div className="gestion-page">
      {/* ── Header Corporativo Enterprise ─────────────────────────── */}
      <header className="admin-header">
        <div className="admin-header-left">
          <button 
            className="admin-back-pill" 
            onClick={() => navigate('/')} 
            aria-label="Volver a Inicio"
            data-tooltip="Volver a Inicio"
          >
            <ArrowLeft size={16} />
            <span className="back-pill-text">Inicio</span>
          </button>

          <div className="admin-header-divider" />

          <div className="admin-title-badge">
            <Users size={18} color="#da2d34" />
            <h1>
              <span className="title-text-full">Gestión de Usuarios</span>
              <span className="title-text-short">Usuarios</span>
            </h1>
          </div>
        </div>

        <div className="admin-header-right">
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
                  <button className="dropdown-item" onClick={() => { setIsProfileOpen(false); navigate('/metricas'); }}>
                    <BarChart3 size={16} />
                    <span>Métricas y Reportes</span>
                  </button>
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

      <main className="admin-content animate-fade-in">
        <div className="admin-toolbar">
          <div className="search-box">
            <Search className="search-icon" size={18} />
            <input 
              type="text" 
              className="search-input"
              placeholder="Buscar por cédula o nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="toolbar-actions" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button className="btn-crear" onClick={() => handleEditClick()}>
              <Plus size={20} />
              Nuevo Usuario
            </button>

            <button className="btn-crear" style={{ backgroundColor: '#ffffff', color: '#da2d34', border: '1px solid #da2d34' }} onClick={() => setIsCargaMasivaOpen(true)}>
              <FileSpreadsheet size={20} />
              Carga Masiva (Excel)
            </button>
          </div>
        </div>

        <div className="usuarios-list">
          {loading ? (
            <div style={{ padding: '3rem', display: 'flex', justifyContent: 'center' }}>
              <Loader2 className="spin-icon" size={32} color="#da2d34" />
            </div>
          ) : filteredUsuarios.length === 0 ? (
            <div className="empty-state">
              No se encontraron usuarios que coincidan con la búsqueda.
            </div>
          ) : (
            paginatedUsuarios.map(u => (
              <div key={u.id} className="usuario-card">
                <div className="card-header">
                  <div className="card-title">
                    <span className="user-name">{u.nombre}</span>
                    <span className="user-id">CC: {u.cedula}</span>
                  </div>
                  <div className="card-actions" style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      className="btn-icon edit" 
                      onClick={() => handleEditClick(u)} 
                      aria-label="Editar usuario"
                      data-tooltip="Editar usuario"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button 
                      className="btn-icon btn-delete" 
                      onClick={() => setUsuarioToDelete(u)}
                      aria-label="Eliminar usuario"
                      data-tooltip="Eliminar usuario"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                  </div>
                </div>
                
                <div className="card-body">
                  <div className="detail-row">
                    <span className="detail-label">Rol</span>
                    <span className="detail-value">
                      <span className={`badge-rol ${u.rol}`}>{u.rol}</span>
                    </span>
                  </div>
                  
                  <div className="detail-row">
                    <span className="detail-label">Estado</span>
                    <span className="detail-value">
                      <button 
                        className={`btn-estado ${u.estado}`}
                        onClick={() => handleToggleEstado(u)}
                        data-tooltip={`Cambiar a ${u.estado === 'activo' ? 'inactivo' : 'activo'}`}
                      >
                        {u.estado === 'activo' ? 'Activo' : 'Inactivo'}
                      </button>
                    </span>
                  </div>

                  <div className="detail-row">
                    <span className="detail-label">Contraseña</span>
                    <span className="detail-value">
                      {visiblePasswords.has(u.id) ? (u.contrasena || 'No definida') : '••••••••'}
                      {u.contrasena && (
                        <button 
                          className="password-toggle-btn"
                          onClick={() => togglePasswordVisibility(u.id)}
                          aria-label="Ver contraseña"
                          data-tooltip={visiblePasswords.has(u.id) ? 'Ocultar contraseña' : 'Ver contraseña'}
                        >
                          {visiblePasswords.has(u.id) ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ── Control de Paginación ──────── */}
        {!loading && filteredUsuarios.length > 0 && (
          <div className="admin-pagination">
            <div className="admin-page-size">
              <span>Mostrar</span>
              <select 
                className="admin-native-select"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
              <span>por página</span>
            </div>

            <div className="admin-page-nav">
              <button
                className="admin-page-btn"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                aria-label="Página anterior"
              >
                <ChevronLeft size={18} />
              </button>

              <span className="admin-page-info">
                {safePage} / {totalPages}
              </span>

              <button
                className="admin-page-btn"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                aria-label="Página siguiente"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <span className="admin-total-label">
              Total: {filteredUsuarios.length} usuarios
            </span>
          </div>
        )}
      </main>

      <ModalUsuario 
        isOpen={isModalOpen}
        onClose={closeModal}
        onSaved={onSaved}
        usuarioEdit={usuarioToEdit}
      />

      <ModalCargaMasiva
        isOpen={isCargaMasivaOpen}
        onClose={() => setIsCargaMasivaOpen(false)}
        onSaved={(msg) => {
          setIsCargaMasivaOpen(false);
          fetchUsuarios();
          if (msg) {
            setToastMsg(msg);
            setTimeout(() => setToastMsg(''), 3000);
          }
        }}
      />

      {toastMsg && (
        <div className="toast-success animate-slide-up">
          <span className="toast-icon">✓</span>
          {toastMsg}
        </div>
      )}

      {/* Modal de Confirmación de Eliminación */}
      {usuarioToDelete && (
        <div className="modal-overlay">
          <div className="modal-content delete-modal">
            <div className="delete-modal-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
            <h3 className="delete-modal-title">Vas a eliminar el usuario {usuarioToDelete.nombre}</h3>
            <p className="delete-modal-text">
              ¿Estás seguro?
            </p>
            <div className="delete-modal-actions">
              <button 
                className="btn-cancel" 
                onClick={() => setUsuarioToDelete(undefined)}
                disabled={isDeleting}
              >
                Cancelar
              </button>
              <button 
                className="btn-danger" 
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
              >
                {isDeleting ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
