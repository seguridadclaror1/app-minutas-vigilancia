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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastActivity, setLastActivity] = useState<number | null>(null);

  const SESSION_ACTIVITY_KEY = 'minutas-last-activity';
  const INACTIVITY_TIMEOUT_SECONDS = 30 * 60; // Cambia este valor para pruebas locales.
  const INACTIVITY_TIMEOUT_MS = INACTIVITY_TIMEOUT_SECONDS * 1000;
  // Para producción usa 30 * 60 (30 minutos).
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
      // Usamos el formato cedula@minutas.com como acordado
      const email = `${cedula}@minutas.com`;
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          return { error: 'Número de identificación o contraseña incorrecta.' };
        }
        return { error: error.message };
      }

      return { error: null };
    } catch {
      return { error: 'Error de conexión. Inténtelo de nuevo.' };
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setPerfil(null);
    setLastActivity(null);
    localStorage.removeItem(SESSION_ACTIVITY_KEY);
    clearSessionTimeout();
  }

  return (
    <AuthContext.Provider value={{ session, user, perfil, loading, signIn, signOut }}>
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
