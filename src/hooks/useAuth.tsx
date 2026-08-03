import { useState, useEffect, useRef, createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../config/supabase';
import type { Session, User } from '@supabase/supabase-js';
import type { Perfil } from '../types/database';
import { generateUUID } from '../utils/uuid';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  perfil: Perfil | null;
  loading: boolean;
  signIn: (cedula: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  showSessionTerminatedModal: boolean;
  acknowledgeSessionTerminated: () => void;
  showSessionReplacedToast: boolean;
  dismissSessionReplacedToast: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_SESSION_KEY = 'minutas_session_token';
const SESSION_ACTIVITY_KEY = 'minutas-last-activity';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastActivity, setLastActivity] = useState<number | null>(null);

  // Estados para notificaciones de control de sesión única
  const [showSessionTerminatedModal, setShowSessionTerminatedModal] = useState(false);
  const [showSessionReplacedToast, setShowSessionReplacedToast] = useState(false);

  const INACTIVITY_TIMEOUT_SECONDS = 30 * 60;
  const INACTIVITY_TIMEOUT_MS = INACTIVITY_TIMEOUT_SECONDS * 1000;
  const timeoutRef = useRef<number | null>(null);

  const clearSessionTimeout = () => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const updateActivity = (timestamp = Date.now()) => {
    setLastActivity(timestamp);
    localStorage.setItem(SESSION_ACTIVITY_KEY, String(timestamp));
  };

  // Función para verificar si la sesión fue superada desde otro dispositivo
  const checkSessionToken = async () => {
    try {
      const localToken = localStorage.getItem(LOCAL_SESSION_KEY);
      if (!localToken) return;

      const { data: { user: freshUser } } = await supabase.auth.getUser();
      if (!freshUser) return;

      const remoteToken = freshUser.user_metadata?.active_session_token;
      if (remoteToken && remoteToken !== localToken) {
        setShowSessionTerminatedModal(true);
      }
    } catch (err) {
      console.error('Error al verificar token de sesión:', err);
    }
  };

  useEffect(() => {
    const storedActivity = localStorage.getItem(SESSION_ACTIVITY_KEY);
    if (storedActivity) {
      const parsed = Number(storedActivity);
      if (!Number.isNaN(parsed)) {
        setLastActivity(parsed);
      }
    }

    // Obtener sesión actual
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchPerfil(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Escuchar cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchPerfil(session.user.id);
        } else {
          setPerfil(null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Suscripción Realtime y monitoreo periódico para sesión única en dispositivo activo
  useEffect(() => {
    if (!session || !user) return;

    // 1. Asegurar que exista un token de sesión local si no existe
    let localToken = localStorage.getItem(LOCAL_SESSION_KEY);
    if (!localToken) {
      localToken = generateUUID();
      localStorage.setItem(LOCAL_SESSION_KEY, localToken);
    }

    // 2. Canal Realtime para comunicación instantánea entre dispositivos del mismo usuario
    const channel = supabase.channel(`user-session-${user.id}`, {
      config: { broadcast: { self: false } }
    });

    channel
      .on('broadcast', { event: 'LOGIN_NEW_SESSION' }, (payload) => {
        const currentLocal = localStorage.getItem(LOCAL_SESSION_KEY);
        if (payload.payload?.active_session_token && payload.payload.active_session_token !== currentLocal) {
          setShowSessionTerminatedModal(true);
        }
      })
      .subscribe();

    // 3. Verificación solo al regresar la pestaña a primer plano
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkSessionToken();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [session, user?.id]);

  useEffect(() => {
    if (!session) {
      clearSessionTimeout();
      return;
    }

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    const handleActivity = () => updateActivity();
    activityEvents.forEach((eventName) => document.addEventListener(eventName, handleActivity));

    const handleStorage = (event: StorageEvent) => {
      if (event.key === SESSION_ACTIVITY_KEY && event.newValue) {
        const parsed = Number(event.newValue);
        if (!Number.isNaN(parsed)) {
          setLastActivity(parsed);
        }
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      activityEvents.forEach((eventName) => document.removeEventListener(eventName, handleActivity));
      window.removeEventListener('storage', handleStorage);
    };
  }, [session]);

  useEffect(() => {
    if (!session || lastActivity === null) {
      clearSessionTimeout();
      return;
    }

    const elapsed = Date.now() - lastActivity;
    if (elapsed >= INACTIVITY_TIMEOUT_MS) {
      signOut();
      return;
    }

    clearSessionTimeout();
    timeoutRef.current = window.setTimeout(() => {
      signOut();
    }, INACTIVITY_TIMEOUT_MS - elapsed);

    return () => clearSessionTimeout();
  }, [session, lastActivity]);

  async function fetchPerfil(userId: string) {
    try {
      const { data, error } = await supabase
        .from('perfiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setPerfil(data as Perfil);
    } catch (err) {
      console.error('Error cargando perfil:', err);
      setPerfil(null);
    } finally {
      setLoading(false);
    }
  }

  async function signIn(cedula: string, password: string) {
    try {
      const email = `${cedula}@minutas.com`;
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          return { error: 'Número de identificación o contraseña incorrecta.' };
        }
        return { error: error.message };
      }

      if (data.user) {
        const previousToken = data.user.user_metadata?.active_session_token;
        const newToken = generateUUID();

        // Guardar el nuevo token único de este dispositivo
        localStorage.setItem(LOCAL_SESSION_KEY, newToken);

        // Si existía un token registrado anteriormente (otro dispositivo estaba activo), mostramos la notificación en el nuevo dispositivo
        if (previousToken && previousToken !== 'null') {
          setShowSessionReplacedToast(true);
        } else {
          setShowSessionReplacedToast(false);
        }

        // Actualizar metadatos en Supabase con el nuevo token activo
        await supabase.auth.updateUser({
          data: {
            active_session_token: newToken,
            last_active_at: new Date().toISOString()
          }
        });

        // Notificar en tiempo real al dispositivo anterior para que despliegue el modal
        const channel = supabase.channel(`user-session-${data.user.id}`, {
          config: { broadcast: { self: false } }
        });

        channel.subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel.send({
              type: 'broadcast',
              event: 'LOGIN_NEW_SESSION',
              payload: { active_session_token: newToken }
            });
            setTimeout(() => {
              supabase.removeChannel(channel);
            }, 2000);
          }
        });
      }

      return { error: null };
    } catch {
      return { error: 'Error de conexión. Inténtelo de nuevo.' };
    }
  }

  async function signOut() {
    try {
      // Al cerrar sesión voluntariamente, limpiamos el token registrado en Supabase
      await supabase.auth.updateUser({
        data: { active_session_token: null }
      });
      await supabase.auth.signOut({ scope: 'local' });
    } catch (e) {
      console.error('Error al cerrar sesión:', e);
    }
    
    // Limpieza de almacenamiento local
    localStorage.removeItem(SESSION_ACTIVITY_KEY);
    localStorage.removeItem(LOCAL_SESSION_KEY);
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('sb-') && key.includes('-auth-token')) {
        localStorage.removeItem(key);
      }
    }

    setSession(null);
    setUser(null);
    setPerfil(null);
    setLastActivity(null);
    setShowSessionTerminatedModal(false);
    setShowSessionReplacedToast(false);
    clearSessionTimeout();
  }

  function acknowledgeSessionTerminated() {
    setShowSessionTerminatedModal(false);
    // Limpiar ÚNICAMENTE el cliente local del dispositivo 1, sin tocar Supabase API para no desconectar al dispositivo 2
    localStorage.removeItem(SESSION_ACTIVITY_KEY);
    localStorage.removeItem(LOCAL_SESSION_KEY);
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('sb-') && key.includes('-auth-token')) {
        localStorage.removeItem(key);
      }
    }

    setSession(null);
    setUser(null);
    setPerfil(null);
    clearSessionTimeout();
  }

  function dismissSessionReplacedToast() {
    setShowSessionReplacedToast(false);
  }

  return (
    <AuthContext.Provider value={{ 
      session, 
      user, 
      perfil, 
      loading, 
      signIn, 
      signOut,
      showSessionTerminatedModal,
      acknowledgeSessionTerminated,
      showSessionReplacedToast,
      dismissSessionReplacedToast
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  return context;
}
