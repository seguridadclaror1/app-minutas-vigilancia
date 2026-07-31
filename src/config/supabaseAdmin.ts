import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('Falta VITE_SUPABASE_URL en el entorno.');
}

// Advertencia en consola si falta la llave (pero no lanzamos error fatal 
// inmediatamente para permitir que el resto de la app cargue sin ella)
if (!supabaseServiceKey) {
  console.warn('Falta VITE_SUPABASE_SERVICE_ROLE_KEY. El panel de administración de usuarios fallará.');
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || 'DUMMY_KEY', {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  },
  db: {
    schema: 'Minuta_seguridad',
  },
});
