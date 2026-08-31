import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  Plus,
  Power,
  Users,
  ClipboardList,
  ChevronDown,
  BarChart3
} from 'lucide-react';
import ModalConfirmarSalida from '../../components/ModalConfirmarSalida';
import './Inicio.css';

export default function Inicio() {
  const { perfil, signOut } = useAuth();
  const navigate = useNavigate();
  
  // Estado del menú desplegable de perfil
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Estado del modal de confirmación de salida
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Cerrar dropdown al hacer clic afuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function getGreeting() {
    return 'Bienvenido';
  }

  async function handleSignOut() {
    setShowLogoutModal(false);
    await signOut();
  }

  return (
    <div className="inicio-page">
      {/* TopAppBar Corporativo */}
      <header className="inicio-topbar">
        <div className="topbar-left">
          <img
            src={`${import.meta.env.BASE_URL}Logo_Claro-sin fondo.png`}
            alt="Logo Claro"
            className="topbar-logo"
            width={36}
            height={36}
          />
          <span className="topbar-brand">Minutas</span>
        </div>

        {/* Menú de Perfil Desplegable (Enterprise) */}
        <div className="profile-dropdown-wrapper" ref={dropdownRef}>
          <button
            className={`profile-chip-btn ${isDropdownOpen ? 'active' : ''}`}
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
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
            <ChevronDown size={14} className={`chip-chevron ${isDropdownOpen ? 'rotate' : ''}`} />
          </button>

          {isDropdownOpen && (
            <div className="profile-menu-dropdown animate-fade-in">
              <div className="dropdown-user-header">
                <p className="dropdown-user-name">{perfil?.nombre || 'Samir Bolívar'}</p>
                <p className="dropdown-user-cedula">CC: {perfil?.cedula || '—'}</p>
                <span className="dropdown-user-badge">{perfil?.rol || 'Administrador'}</span>
              </div>
              
              <div className="dropdown-divider" />
              
              <div className="dropdown-menu-list">
                {perfil?.rol === 'administrador' && (
                  <>
                    <button className="dropdown-item" onClick={() => { setIsDropdownOpen(false); navigate('/seguimiento'); }}>
                      <ClipboardList size={16} />
                      <span>Seguimiento de Minutas</span>
                    </button>
                    <button className="dropdown-item" onClick={() => { setIsDropdownOpen(false); navigate('/admin/usuarios'); }}>
                      <Users size={16} />
                      <span>Gestión de Usuarios</span>
                    </button>
                    <button className="dropdown-item" onClick={() => { setIsDropdownOpen(false); navigate('/metricas'); }}>
                      <BarChart3 size={16} />
                      <span>Métricas y Reportes</span>
                    </button>
                  </>
                )}
                {perfil?.rol === 'supervisor' && (
                  <button className="dropdown-item" onClick={() => { setIsDropdownOpen(false); navigate('/seguimiento'); }}>
                    <ClipboardList size={16} />
                    <span>Seguimiento de Minutas</span>
                  </button>
                )}
              </div>

              <div className="dropdown-divider" />

              <button 
                className="dropdown-item item-danger" 
                onClick={() => {
                  setIsDropdownOpen(false);
                  setShowLogoutModal(true);
                }}
              >
                <Power size={16} />
                <span>Cerrar Sesión</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Modal de Confirmación de Cierre de Sesión */}
      <ModalConfirmarSalida 
        isOpen={showLogoutModal} 
        onClose={() => setShowLogoutModal(false)} 
        onConfirm={handleSignOut} 
      />

      {/* Main Content — Centered */}
      <main className="inicio-main">
        {/* Welcome Section */}
        <section className="welcome-section">
          <div className="welcome-icon-wrapper">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="40" height="40">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
            </svg>
          </div>
          <h1 className="welcome-title">
            ¡{getGreeting()}, {perfil?.nombre?.split(' ')[0] ?? 'Guardia'}!
          </h1>
          <p className="welcome-subtitle">
            Tu turno está en curso.<br />
            Garantizamos seguridad juntos.
          </p>
        </section>

        {/* Primary Action — Botón grande rojo */}
        <div className="primary-action-area">
          <button
            className="agregar-minuta-btn"
            onClick={() => navigate('/nueva-minuta')}
          >
            <div className="btn-add-icon">
              <Plus size={32} strokeWidth={2} />
            </div>
            <span className="btn-label">Libro de Minutas</span>
          </button>
        </div>

        {/* Status Info */}
        <div className="status-info">
          <div className="status-pill">
            <span className="status-dot" />
            <span>
              {perfil?.rol === 'administrador'
                ? 'Administrador'
                : perfil?.rol === 'supervisor'
                  ? 'Supervisor'
                  : 'Vigilante'} activo
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}


