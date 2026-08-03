import { useState, useEffect, useRef, createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../config/supabase';
import type { Session, User } from '@supabase/supabase-js';
import type { Perfil } from '../types/database';

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

    // 1. Asegurar que exista un token de sesión local
    let localToken = localStorage.getItem(LOCAL_SESSION_KEY);
    if (!localToken) {
      localToken = crypto.randomUUID();
      localStorage.setItem(LOCAL_SESSION_KEY, localToken);
      supabase.auth.updateUser({
        data: { active_session_token: localToken }
      }).catch(console.error);
    }

    // 2. Canal Realtime para comunicación entre dispositivos del mismo usuario
    const channel = supabase.channel(`user-session-${user.id}`, {
      config: { broadcast: { self: false } }
    });

    channel
      .on('broadcast', { event: 'LOGIN_NEW_SESSION' }, async (payload) => {
        const currentLocal = localStorage.getItem(LOCAL_SESSION_KEY);
        if (payload.payload?.active_session_token && payload.payload.active_session_token !== currentLocal) {
          // Responder al nuevo dispositivo confirmando que una sesión previa estaba activa y fue desplazada
          await channel.send({
            type: 'broadcast',
            event: 'SESSION_ACKNOWLEDGED_DISPLACEMENT',
            payload: { displaced_token: currentLocal }
          });
          // Mostrar modal de sesión finalizada en este dispositivo
          setShowSessionTerminatedModal(true);
        }
      })
      .subscribe();

    // 3. Verificación periódica (cada 5s) y al reenfocar la ventana
    const intervalId = setInterval(() => {
      checkSessionToken();
    }, 5000);

    const handleFocusOrVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkSessionToken();
      }
    };

    window.addEventListener('focus', handleFocusOrVisibility);
    document.addEventListener('visibilitychange', handleFocusOrVisibility);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocusOrVisibility);
      document.removeEventListener('visibilitychange', handleFocusOrVisibility);
    };
  }, [session, user]);

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
        const newToken = crypto.randomUUID();
        localStorage.setItem(LOCAL_SESSION_KEY, newToken);
        setShowSessionReplacedToast(false);

        // Escuchar si algún dispositivo anterior responde que estaba activo
        const channel = supabase.channel(`user-session-${data.user.id}`, {
          config: { broadcast: { self: false } }
        });

        let displacementDetected = false;

        channel.on('broadcast', { event: 'SESSION_ACKNOWLEDGED_DISPLACEMENT' }, () => {
          displacementDetected = true;
          setShowSessionReplacedToast(true);
        });

        channel.subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            // Transmitir evento de nuevo inicio de sesión
            await channel.send({
              type: 'broadcast',
              event: 'LOGIN_NEW_SESSION',
              payload: { active_session_token: newToken }
            });

            // Esperar 1.2 segundos para ver si otro dispositivo activo responde
            setTimeout(() => {
              if (!displacementDetected) {
                setShowSessionReplacedToast(false);
              }
              supabase.removeChannel(channel);
            }, 1200);
          }
        });

        // Actualizar metadatos en Supabase con el nuevo token activo
        await supabase.auth.updateUser({
          data: {
            active_session_token: newToken,
            last_login_at: new Date().toISOString()
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
      // Cerrar la sesión únicamente en este dispositivo local (scope: 'local')
      await supabase.auth.signOut({ scope: 'local' });
    } catch (e) {
      console.error('Error al cerrar sesión local:', e);
    }
    setSession(null);
    setUser(null);
    setPerfil(null);
    setLastActivity(null);
    localStorage.removeItem(SESSION_ACTIVITY_KEY);
    localStorage.removeItem(LOCAL_SESSION_KEY);
    setShowSessionTerminatedModal(false);
    setShowSessionReplacedToast(false);
    clearSessionTimeout();
  }

  function acknowledgeSessionTerminated() {
    setShowSessionTerminatedModal(false);
    // Limpiar únicamente el almacenamiento local de este dispositivo sin alterar los metadatos de Supabase ni cerrar la sesión del nuevo dispositivo
    localStorage.removeItem(SESSION_ACTIVITY_KEY);
    localStorage.removeItem(LOCAL_SESSION_KEY);
    supabase.auth.signOut({ scope: 'local' }).catch(() => {});
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
