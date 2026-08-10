import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fyainghzzxwkshuwamax.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5YWluZ2h6enh3a3NodXdhbWF4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTMzMzc4OCwiZXhwIjoyMTAwOTA5Nzg4fQ.0OXbWCfAslBR7fbOWS7NxrzOtoK-_z33mCml_2z7u18';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  db: { schema: 'Minuta_seguridad' }
});

function toTitleCase(str) {
  if (!str) return '';
  return str
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map(word => (word.length > 0 ? word.charAt(0).toUpperCase() + word.slice(1) : ''))
    .filter(Boolean)
    .join(' ');
}

async function run() {
  console.log('Obteniendo perfiles existentes...');
  const { data: perfiles, error } = await supabase
    .from('perfiles')
    .select('*');

  if (error) {
    console.error('Error al obtener perfiles:', error);
    return;
  }

  console.log(`Se encontraron ${perfiles.length} usuarios. Normalizando nombres...`);

  let count = 0;
  for (const perfil of perfiles) {
    const nombreOriginal = perfil.nombre;
    const nombreFormateado = toTitleCase(nombreOriginal);

    if (nombreOriginal !== nombreFormateado) {
      console.log(`Actualizando: "${nombreOriginal}" -> "${nombreFormateado}"`);

      // Actualizar tabla perfiles
      const { error: updateError } = await supabase
        .from('perfiles')
        .update({ nombre: nombreFormateado })
        .eq('id', perfil.id);

      if (updateError) {
        console.error(`Error actualizando perfil ${perfil.id}:`, updateError.message);
      }

      // Actualizar auth.users metadata
      const { error: authError } = await supabase.auth.admin.updateUserById(perfil.id, {
        user_metadata: { nombre: nombreFormateado }
      });

      if (authError) {
        console.error(`Error actualizando auth metadata ${perfil.id}:`, authError.message);
      }

      count++;
    }
  }

  console.log(`\n✅ Proceso completado: ${count} usuarios fueron corregidos a Formato Título.`);
}

run();
