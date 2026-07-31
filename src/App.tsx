import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Login from './features/auth/Login';
import Inicio from './features/minutas/Inicio';
import NuevaMinuta from './features/minutas/NuevaMinuta';
import SeguimientoMinutas from './features/minutas/SeguimientoMinutas';
import GestionUsuarios from './features/admin/GestionUsuarios';
import ProtectedRoute from './components/ProtectedRoute';

function AppRoutes() {
  const { session, loading } = useAuth();

  if (loading) return null; // El loader principal ya se maneja internamente o podríamos poner uno global aquí

  return (
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
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
