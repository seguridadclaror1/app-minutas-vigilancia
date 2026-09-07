-- ==============================================================================
-- MIGRACIÓN: Coordenadas GPS y Geocerca para Sedes
-- Esquema: "Minuta_seguridad"
-- ==============================================================================

-- 1. Agregar columnas a la tabla de sedes si aún no existen
ALTER TABLE "Minuta_seguridad".sedes
ADD COLUMN IF NOT EXISTS latitud NUMERIC(10, 7),
ADD COLUMN IF NOT EXISTS longitud NUMERIC(10, 7),
ADD COLUMN IF NOT EXISTS radio_metros INTEGER DEFAULT 150;

-- 2. Asegurar que todas las sedes existan (si no existen las crea, si existen actualiza coordenadas)
INSERT INTO "Minuta_seguridad".sedes (nombre, latitud, longitud, radio_metros)
VALUES 
  ('CCM Cumbre', 10.999116, -74.828614, 150),
  ('ETCS Salgar', 11.021953, -74.928433, 150),
  ('ETCS Marbella', 10.435243, -75.537059, 150),
  ('SDS Boston', 10.993130, -74.796405, 150),
  ('CCM Sincelejo', 9.282810, -75.397967, 150),
  ('CCM Turbaco', 10.339620, -75.419982, 150),
  ('SDS Bosque', 10.404219, -75.521297, 150),
  ('SDS Santa Marta', 11.238904, -74.214060, 150),
  ('CAV Prado', NULL, NULL, 150),
  ('Tienda Santa Marta', NULL, NULL, 150),
  ('SDS Valledupar', NULL, NULL, 150),
  ('CAV Bocagrande', NULL, NULL, 150),
  ('SDS Soledad', NULL, NULL, 150),
  ('CCM Alkarawi', NULL, NULL, 150),
  ('ETCS San Andres', NULL, NULL, 150),
  ('Administrativa Barranquilla', NULL, NULL, 150),
  ('CAV Centro', NULL, NULL, 150),
  ('CAV San Andres', NULL, NULL, 150),
  ('SDS Monteria', NULL, NULL, 150)
ON CONFLICT (nombre) 
DO UPDATE SET 
  latitud = COALESCE(EXCLUDED.latitud, "Minuta_seguridad".sedes.latitud),
  longitud = COALESCE(EXCLUDED.longitud, "Minuta_seguridad".sedes.longitud),
  radio_metros = COALESCE(EXCLUDED.radio_metros, "Minuta_seguridad".sedes.radio_metros, 150);

-- 3. Actualización directa de respaldo por coincidencia de nombre (por si existían con pequeñas variaciones)
UPDATE "Minuta_seguridad".sedes SET latitud = 10.999116, longitud = -74.828614, radio_metros = 150 WHERE TRIM(nombre) ILIKE 'CCM Cumbre%';
UPDATE "Minuta_seguridad".sedes SET latitud = 11.021953, longitud = -74.928433, radio_metros = 150 WHERE TRIM(nombre) ILIKE 'ETCS Salgar%';
UPDATE "Minuta_seguridad".sedes SET latitud = 10.435243, longitud = -75.537059, radio_metros = 150 WHERE TRIM(nombre) ILIKE 'ETCS Marbella%';
UPDATE "Minuta_seguridad".sedes SET latitud = 10.993130, longitud = -74.796405, radio_metros = 150 WHERE TRIM(nombre) ILIKE 'SDS Boston%';
UPDATE "Minuta_seguridad".sedes SET latitud = 9.282810, longitud = -75.397967, radio_metros = 150 WHERE TRIM(nombre) ILIKE 'CCM Sincelejo%';
UPDATE "Minuta_seguridad".sedes SET latitud = 10.339620, longitud = -75.419982, radio_metros = 150 WHERE TRIM(nombre) ILIKE 'CCM Turbaco%';
UPDATE "Minuta_seguridad".sedes SET latitud = 10.404219, longitud = -75.521297, radio_metros = 150 WHERE TRIM(nombre) ILIKE 'SDS Bosque%';
UPDATE "Minuta_seguridad".sedes SET latitud = 11.238904, longitud = -74.214060, radio_metros = 150 WHERE TRIM(nombre) ILIKE 'SDS Santa Marta%';

-- 4. Verificación de resultados
SELECT id, nombre, latitud, longitud, radio_metros 
FROM "Minuta_seguridad".sedes 
ORDER BY nombre;
