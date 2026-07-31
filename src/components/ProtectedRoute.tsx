import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  allowedRoles?: string[];
}

export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { session, perfil, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100dvh', backgroundColor: '#f4f4f5' }}>
        <Loader2 className="spin-icon" size={32} color="#da2d34" style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Si hay sesión pero aún no tenemos el perfil, mostramos loading en lugar de redirigir
  if (!perfil) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100dvh', backgroundColor: '#f4f4f5' }}>
        <Loader2 className="spin-icon" size={32} color="#da2d34" style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (allowedRoles && !allowedRoles.includes(perfil.rol)) {
    return <Navigate to="/" replace />; // Redirigir si no tiene permisos
  }

  return <Outlet />;
}
