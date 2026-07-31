// Tipos TypeScript basados en el esquema de Supabase

export type Rol = 'vigilante' | 'supervisor' | 'administrador';
export type EstadoPerfil = 'activo' | 'inactivo';

export interface Perfil {
  id: string;
  cedula: string;
  nombre: string;
  rol: Rol;
  estado: EstadoPerfil;
  contrasena: string | null;
  fecha_creacion: string;
}

export interface Sede {
  id: string;
  nombre: string;
}

export interface TipoNovedad {
  id: string;
  nombre: string;
}

export interface Minuta {
  id: string;
  usuario_id: string;
  sede_id: string;
  tipo_novedad_id: string;
  descripcion: string;
  fecha_hora: string;
  fecha_creacion: string;
  // Relaciones opcionales (joins)
  sedes?: Sede;
  tipos_novedad?: TipoNovedad;
  perfiles?: Perfil;
}

export interface Evidencia {
  id: string;
  minuta_id: string;
  url_imagen: string;
  fecha: string;
}

// Formulario de nueva minuta
export interface NuevaMinutaForm {
  sede_id: string;
  tipo_novedad_id: string;
  descripcion: string;
  fotos: File[];
}
