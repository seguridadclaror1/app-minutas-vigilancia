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
  latitud?: number | null;
  longitud?: number | null;
  radio_metros?: number | null;
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

// Control y Registro de Activos
export type EstadoCicloActivo = 'en_sede' | 'salido';

export interface MovimientoActivo {
  id: string;
  sede_id: string;
  serial: string;
  tipologia: string;
  responsable: string;
  cedula: string;
  empresa: string;
  motivo_ingreso: string;
  fecha_hora_ingreso: string;
  usuario_ingreso_id: string;
  usuario_ingreso_nombre?: string | null;
  foto_ingreso_url?: string | null;
  estado_ciclo: EstadoCicloActivo;
  motivo_salida?: string | null;
  fecha_hora_salida?: string | null;
  usuario_salida_id?: string | null;
  usuario_salida_nombre?: string | null;
  foto_salida_url?: string | null;
  fecha_creacion: string;
  fecha_actualizacion: string;

  // Joins opcionales
  sedes?: Sede;
  perfil_ingreso?: Perfil;
  perfil_salida?: Perfil;
}
