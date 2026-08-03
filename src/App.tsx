import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Login from './features/auth/Login';
import Inicio from './features/minutas/Inicio';
import NuevaMinuta from './features/minutas/NuevaMinuta';
import SeguimientoMinutas from './features/minutas/SeguimientoMinutas';
import GestionUsuarios from './features/admin/GestionUsuarios';
import ProtectedRoute from './components/ProtectedRoute';
import { SessionDisplacedModal } from './components/SessionDisplacedModal';
import { SessionNoticeToast } from './components/SessionNoticeToast';
import { ErrorBoundary } from './components/ErrorBoundary';

import { Loader2 } from 'lucide-react';

function AppRoutes() {
  const { 
    session, 
    loading, 
    showSessionTerminatedModal, 
    acknowledgeSessionTerminated,
    showSessionReplacedToast,
    dismissSessionReplacedToast
  } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100dvh', backgroundColor: '#fff8f7' }}>
        <Loader2 className="spin-icon" size={36} color="#da2d34" style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <>
      {showSessionTerminatedModal && (
        <SessionDisplacedModal onAcknowledge={acknowledgeSessionTerminated} />
      )}

      {showSessionReplacedToast && (
        <SessionNoticeToast onClose={dismissSessionReplacedToast} />
      )}

      <Routes>
        <Route 
          path="/login" 
          element={session ? <Navigate to="/" replace /> : <Login />} 
        />
        
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Inicio />} />
          <Route path="/nueva-minuta" element={<NuevaMinuta />} />
        </Route>
        
        <Route element={<ProtectedRoute allowedRoles={['administrador']} />}>
          <Route path="/admin/usuarios" element={<GestionUsuarios />} />
          <Route path="/seguimiento" element={<SeguimientoMinutas />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ErrorBoundary>
  );
}
