-- ==============================================================================
-- FUNCIÓN: obtener_metricas_almacenamiento
-- UBICACIÓN: public (para acceso directo vía supabase.rpc desde la aplicación)
-- DESCRIPCIÓN: Consulta a nivel de motor físico de PostgreSQL y Supabase Storage:
--              1. Tamaño total real de la base de datos completa (pg_database_size)
--              2. Tamaño del esquema de la app (Minuta_seguridad)
--              3. Tamaño exacto byte por byte de los archivos en storage.objects
--              4. Consumo diario agrupado por día en hora Colombia
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.obtener_metricas_almacenamiento()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, "Minuta_seguridad", storage
AS $$
DECLARE
    v_db_size_total bigint := 0;
    v_schema_size bigint := 0;
    v_storage_size bigint := 0;
    v_total_fotos bigint := 0;
    v_fotos_por_dia jsonb := '{}'::jsonb;
    v_minutas_por_dia jsonb := '{}'::jsonb;
    v_tablas jsonb := '[]'::jsonb;
BEGIN
    -- 1. Tamaño total físico en disco de la base de datos PostgreSQL completa (Exactamente lo que mide el panel Usage de Supabase)
    BEGIN
        SELECT pg_database_size(current_database()) INTO v_db_size_total;
    EXCEPTION WHEN OTHERS THEN
        v_db_size_total := 0;
    END;

    -- 2. Tamaño de las tablas e índices del esquema "Minuta_seguridad"
    BEGIN
        SELECT coalesce(sum(pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(tablename))), 0)
        INTO v_schema_size
        FROM pg_tables
        WHERE schemaname = 'Minuta_seguridad';
    EXCEPTION WHEN OTHERS THEN
        v_schema_size := 0;
    END;

    -- 3. Detalle por tabla individual dentro de "Minuta_seguridad"
    BEGIN
        SELECT coalesce(jsonb_agg(jsonb_build_object(
            'tabla', tablename,
            'tamano_bytes', pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(tablename)),
            'tamano_datos', pg_relation_size(quote_ident(schemaname) || '.' || quote_ident(tablename)),
            'tamano_indices', pg_indexes_size(quote_ident(schemaname) || '.' || quote_ident(tablename))
        ) ORDER BY pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(tablename)) DESC), '[]'::jsonb)
        INTO v_tablas
        FROM pg_tables
        WHERE schemaname = 'Minuta_seguridad';
    EXCEPTION WHEN OTHERS THEN
        v_tablas := '[]'::jsonb;
    END;

    -- 4. Tamaño exacto real byte por byte en Supabase Storage (bucket evidencias_minutas)
    BEGIN
        SELECT 
            coalesce(sum((metadata->>'size')::bigint), 0),
            count(*)
        INTO v_storage_size, v_total_fotos
        FROM storage.objects
        WHERE bucket_id = 'evidencias_minutas';
    EXCEPTION WHEN OTHERS THEN
        v_storage_size := 0;
        v_total_fotos := 0;
    END;

    -- 5. Consumo diario exacto de fotos en Storage (agrupado por fecha en hora de Colombia)
    BEGIN
        SELECT coalesce(jsonb_object_agg(fecha_dia, tamano_dia), '{}'::jsonb)
        INTO v_fotos_por_dia
        FROM (
            SELECT 
                to_char(created_at AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD') AS fecha_dia,
                sum((metadata->>'size')::bigint) AS tamano_dia
            FROM storage.objects
            WHERE bucket_id = 'evidencias_minutas'
            GROUP BY 1
            ORDER BY 1
        ) sub;
    EXCEPTION WHEN OTHERS THEN
        v_fotos_por_dia := '{}'::jsonb;
    END;

    -- 6. Cantidad de minutas por día en zona horaria de Colombia
    BEGIN
        SELECT coalesce(jsonb_object_agg(fecha_dia, conteo_dia), '{}'::jsonb)
        INTO v_minutas_por_dia
        FROM (
            SELECT 
                to_char(fecha_hora AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD') AS fecha_dia,
                count(*) AS conteo_dia
            FROM "Minuta_seguridad".minutas
            GROUP BY 1
            ORDER BY 1
        ) sub_m;
    EXCEPTION WHEN OTHERS THEN
        v_minutas_por_dia := '{}'::jsonb;
    END;

    -- Retornar el objeto JSON unificado
    RETURN jsonb_build_object(
        'db_total_bytes', v_db_size_total,
        'schema_bytes', v_schema_size,
        'storage_bytes', v_storage_size,
        'total_fotos', v_total_fotos,
        'tablas', v_tablas,
        'fotos_por_dia', v_fotos_por_dia,
        'minutas_por_dia', v_minutas_por_dia,
        'fecha_consulta', now()
    );
END;
$$;

-- Permisos de ejecución para la API REST de Supabase
GRANT EXECUTE ON FUNCTION public.obtener_metricas_almacenamiento() TO authenticated;
GRANT EXECUTE ON FUNCTION public.obtener_metricas_almacenamiento() TO anon;
