import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://fyainghzzxwkshuwamax.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5YWluZ2h6enh3a3NodXdhbWF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzMzM3ODgsImV4cCI6MjEwMDkwOTc4OH0.AOZalcQkm1ABdsFv489bXr_LZF-K_BstxRHqdzOHZZo');

async function createUsers() {
  const users = [
    { cedula: '12345678', nombre: 'Juan Perez (Vigilante)', rol: 'vigilante' },
    { cedula: '87654321', nombre: 'Ana Gomez (Admin)', rol: 'administrador' }
  ];

  for (const u of users) {
    const { data, error } = await supabase.auth.signUp({
      email: `${u.cedula}@minutas.com`,
      password: 'password123',
      options: {
        data: {
          cedula: u.cedula,
          nombre: u.nombre,
          rol: u.rol
        }
      }
    });
    if (error) {
      console.error(`Error creando ${u.nombre}:`, error.message);
    } else {
      console.log(`Usuario ${u.nombre} (${u.cedula}) creado con éxito.`);
    }
  }
}

createUsers();
