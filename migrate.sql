-- Create schema
CREATE SCHEMA IF NOT EXISTS "Minuta_seguridad";

-- Create tables in new schema
create table "Minuta_seguridad".perfiles (
    id uuid references auth.users on delete cascade primary key,
    cedula text not null unique,
    nombre text not null,
    rol text not null check (rol in ('vigilante', 'supervisor', 'administrador')) default 'vigilante',
    estado text not null check (estado in ('activo', 'inactivo')) default 'activo',
    fecha_creacion timestamp with time zone default timezone('utc'::text, now()) not null
);

create table "Minuta_seguridad".sedes (
    id uuid default gen_random_uuid() primary key,
    nombre text not null unique
);

create table "Minuta_seguridad".tipos_novedad (
    id uuid default gen_random_uuid() primary key,
    nombre text not null unique
);

create table "Minuta_seguridad".minutas (
    id uuid default gen_random_uuid() primary key,
    usuario_id uuid references "Minuta_seguridad".perfiles(id) on delete restrict not null,
    sede_id uuid references "Minuta_seguridad".sedes(id) on delete restrict not null,
    tipo_novedad_id uuid references "Minuta_seguridad".tipos_novedad(id) on delete restrict not null,
    descripcion text not null,
    fecha_hora timestamp with time zone default timezone('utc'::text, now()) not null,
    fecha_creacion timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Evidencias asociadas a las minutas (Relación opcional 0..N: una minuta puede tener 0 o más evidencias)
create table "Minuta_seguridad".evidencias (
    id uuid default gen_random_uuid() primary key,
    minuta_id uuid references "Minuta_seguridad".minutas(id) on delete cascade not null,
    url_imagen text not null,
    fecha timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Habilitar RLS
alter table "Minuta_seguridad".perfiles enable row level security;
alter table "Minuta_seguridad".sedes enable row level security;
alter table "Minuta_seguridad".tipos_novedad enable row level security;
alter table "Minuta_seguridad".minutas enable row level security;
alter table "Minuta_seguridad".evidencias enable row level security;

-- Ayudante para obtener el rol del usuario actual
create or replace function "Minuta_seguridad".obtener_rol_actual()
returns text as $$
  select rol from "Minuta_seguridad".perfiles where id = auth.uid();
$$ language sql security definer;

-- Políticas
create policy "Los usuarios autenticados pueden ver perfiles" 
on "Minuta_seguridad".perfiles for select to authenticated using (true);

create policy "Solo administradores pueden modificar perfiles" 
on "Minuta_seguridad".perfiles for all to authenticated using ("Minuta_seguridad".obtener_rol_actual() = 'administrador');

create policy "Los usuarios autenticados pueden ver sedes" 
on "Minuta_seguridad".sedes for select to authenticated using (true);

create policy "Solo administradores pueden modificar sedes" 
on "Minuta_seguridad".sedes for all to authenticated using ("Minuta_seguridad".obtener_rol_actual() = 'administrador');

create policy "Los usuarios autenticados pueden ver tipos de novedad" 
on "Minuta_seguridad".tipos_novedad for select to authenticated using (true);

create policy "Solo administradores pueden modificar tipos de novedad" 
on "Minuta_seguridad".tipos_novedad for all to authenticated using ("Minuta_seguridad".obtener_rol_actual() = 'administrador');

create policy "Vigilantes ven sus propias minutas, supervisores/admins ven todo" 
on "Minuta_seguridad".minutas for select to authenticated using (
    auth.uid() = usuario_id or 
    "Minuta_seguridad".obtener_rol_actual() in ('supervisor', 'administrador')
);

create policy "Vigilantes pueden crear minutas" 
on "Minuta_seguridad".minutas for insert to authenticated with check (
    auth.uid() = usuario_id
);

create policy "Solo administradores pueden actualizar o eliminar minutas" 
on "Minuta_seguridad".minutas for all to authenticated using (
    "Minuta_seguridad".obtener_rol_actual() = 'administrador'
);

create policy "Ver evidencias asociadas a minutas permitidas" 
on "Minuta_seguridad".evidencias for select to authenticated using (
    exists (
        select 1 from "Minuta_seguridad".minutas 
        where minutas.id = evidencias.minuta_id
    )
);

create policy "Insertar evidencias si es dueño de la minuta" 
on "Minuta_seguridad".evidencias for insert to authenticated with check (
    exists (
        select 1 from "Minuta_seguridad".minutas 
        where minutas.id = evidencias.minuta_id and minutas.usuario_id = auth.uid()
    )
);

create policy "Solo administradores pueden modificar evidencias" 
on "Minuta_seguridad".evidencias for all to authenticated using (
    "Minuta_seguridad".obtener_rol_actual() = 'administrador'
);

-- Trigger
drop trigger if exists trigger_crear_perfil_nuevo_usuario on auth.users;

create or replace function "Minuta_seguridad".crear_perfil_nuevo_usuario()
returns trigger as $$
begin
  insert into "Minuta_seguridad".perfiles (id, cedula, nombre, rol, estado)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'cedula', 'temporal_' || new.id),
    coalesce(new.raw_user_meta_data->>'nombre', 'Usuario Nuevo'),
    coalesce(new.raw_user_meta_data->>'rol', 'vigilante'),
    'activo'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger trigger_crear_perfil_nuevo_usuario
  after insert on auth.users
  for each row execute procedure "Minuta_seguridad".crear_perfil_nuevo_usuario();

-- Drop public tables
drop table if exists public.evidencias;
drop table if exists public.minutas;
drop table if exists public.tipos_novedad;
drop table if exists public.sedes;
drop table if exists public.perfiles;
drop function if exists public.obtener_rol_actual();
drop function if exists public.crear_perfil_nuevo_usuario();
