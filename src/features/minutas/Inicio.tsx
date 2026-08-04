import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../config/supabase';
import {
  Plus,
  LogOut,
  Users,
  ClipboardList,
} from 'lucide-react';
import './Inicio.css';

export default function Inicio() {
  const { perfil, signOut } = useAuth();
  const navigate = useNavigate();
  const [, setTotalMinutas] = useState(0);

  useEffect(() => {
    fetchTotalMinutas();
  }, []);

  async function fetchTotalMinutas() {
    try {
      const { count } = await supabase
        .from('minutas')
        .select('*', { count: 'exact', head: true });
      setTotalMinutas(count ?? 0);
    } catch (err) {
      console.error('Error contando minutas:', err);
    }
  }

  function getGreeting() {
    return 'Bienvenido';
  }

  async function handleSignOut() {
    await signOut();
  }

  return (
    <div className="inicio-page">
      {/* TopAppBar — fiel a Stitch */}
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
        <div className="topbar-actions">
          {perfil?.rol === 'administrador' && (
            <>
              <button
                className="topbar-admin"
                onClick={() => navigate('/seguimiento')}
                aria-label="Seguimiento de Minutas"
                title="Seguimiento de Minutas"
              >
                <ClipboardList size={20} />
              </button>
              <button
                className="topbar-admin"
                onClick={() => navigate('/admin/usuarios')}
                aria-label="Gestionar usuarios"
                title="Gestión de Usuarios"
              >
                <Users size={20} />
              </button>
            </>
          )}
          <button
            className="topbar-profile"
            onClick={handleSignOut}
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* Main Content — centered como Stitch */}
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
