-- ==============================================================================
-- SCRIPT DE IDENTIFICACIÓN Y DEPURACIÓN DE FOTOS DE PRUEBA
-- PROYECTO: Minutas de Vigilancia (Supabase Seguridad)
-- DESCRIPCIÓN: Consulta y elimina de forma segura las fotos de prueba
--              del 4 y 5 de agosto (y fechas anteriores al piloto real).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- PASO 1: IDENTIFICAR LAS FOTOS DEL 4 Y 5 DE AGOSTO (Solo Lectura)
-- ------------------------------------------------------------------------------
-- Ejecuta esta consulta para ver la lista exacta de fotos, sus nombres y pesos:

SELECT 
    id,
    name AS ruta_archivo,
    to_char(created_at AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD HH24:MI:SS') AS fecha_colombia,
    round(((metadata->>'size')::bigint / 1024.0), 2) AS tamano_kb,
    round(((metadata->>'size')::bigint / 1000000.0), 2) AS tamano_mb
FROM storage.objects
WHERE bucket_id = 'evidencias_minutas'
  AND created_at >= '2026-08-04 00:00:00 -05'
  AND created_at <  '2026-08-06 00:00:00 -05'
ORDER BY created_at ASC;

-- ------------------------------------------------------------------------------
-- PASO 2: VERIFICAR QUE NO AFECTA NINGUNA MINUTA REAL DE OPERACIÓN
-- ------------------------------------------------------------------------------
-- Esta consulta confirma que en esas fechas NO existen minutas registradas
-- (retornará 0 registros, confirmando que son fotos huérfanas de prueba):

SELECT count(*) AS total_minutas_en_esas_fechas
FROM "Minuta_seguridad".minutas
WHERE fecha_hora >= '2026-08-04 00:00:00 -05'
  AND fecha_hora <  '2026-08-06 00:00:00 -05';

-- ------------------------------------------------------------------------------
-- PASO 3: ELIMINAR LAS FOTOS DEL 4 Y 5 DE AGOSTO
-- ------------------------------------------------------------------------------
-- Cuando estés seguro de querer eliminarlas, ejecuta este bloque:

DELETE FROM storage.objects
WHERE bucket_id = 'evidencias_minutas'
  AND created_at >= '2026-08-04 00:00:00 -05'
  AND created_at <  '2026-08-06 00:00:00 -05';

-- (Opcional) Si también deseas borrar las pruebas anteriores (30-31 jul y 3 ago, ~48 MB más):
-- DELETE FROM storage.objects
-- WHERE bucket_id = 'evidencias_minutas'
--   AND created_at < '2026-08-27 00:00:00 -05';
