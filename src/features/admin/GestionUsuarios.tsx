import { useState, useEffect } from 'react';
import { Search, Plus, Eye, EyeOff, Edit2, Loader2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabaseAdmin } from '../../config/supabaseAdmin';
import { supabase } from '../../config/supabase';
import type { Perfil } from '../../types/database';
import ModalUsuario from './ModalUsuario';
import './GestionUsuarios.css';

import { translateError } from '../../utils/errorTranslator';

export default function GestionUsuarios() {
  const navigate = useNavigate();
  const [usuarios, setUsuarios] = useState<Perfil[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estado para visibilidad de contraseñas individualmente (Set de IDs)
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  
  // Estado del Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
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
        .order('fecha_creacion', { ascending: false });
        
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

  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
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
      const { error } = await supabaseAdmin.auth.admin.deleteUser(usuarioToDelete.id);
      if (error) {
        throw error;
      }
      setToastMsg('Usuario eliminado con éxito');
      setTimeout(() => setToastMsg(''), 3000);
      fetchUsuarios();
    } catch (err: any) {
      console.error('Error al eliminar usuario:', err);
      alert(`No se pudo eliminar el usuario:\n${translateError(err)}`);
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

  const filteredUsuarios = usuarios.filter(u => 
    u.cedula.includes(searchTerm) || 
    u.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="gestion-page">
      <header className="admin-header">
        <div className="header-title-row">
          <button className="back-btn" onClick={() => navigate('/')} aria-label="Volver">
            <ArrowLeft size={24} />
          </button>
          <h1>Gestión de Usuarios</h1>
        </div>
      </header>

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
          
          <button className="btn-crear" onClick={() => handleEditClick()}>
            <Plus size={20} />
            Nuevo Usuario
          </button>
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
            filteredUsuarios.map(u => (
              <div key={u.id} className="usuario-card">
                <div className="card-header">
                  <div className="card-title">
                    <span className="user-name">{u.nombre}</span>
                    <span className="user-id">CC: {u.cedula}</span>
                  </div>
                  <div className="card-actions" style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn-icon edit" onClick={() => handleEditClick(u)} title="Editar">
                      <Edit2 size={18} />
                    </button>
                    <button 
                      className="btn-icon btn-delete" 
                      onClick={() => setUsuarioToDelete(u)}
                      title="Eliminar usuario"
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
                        title={`Click para cambiar a ${u.estado === 'activo' ? 'inactivo' : 'activo'}`}
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
      </main>

      <ModalUsuario 
        isOpen={isModalOpen}
        onClose={closeModal}
        onSaved={onSaved}
        usuarioEdit={usuarioToEdit}
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
