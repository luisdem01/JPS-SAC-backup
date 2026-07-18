-- ====================================================================================
-- SISTEMA DE GESTIÓN DE PROYECTOS DE INVESTIGACIÓN (SGPI)
-- Script SQL: Funciones RPC de Importación Masiva CI (Antes RAIS)
-- Componente: Capa Transaccional ETL (CU02 / CU03 / CU04)
--
-- NOTA TÉCNICA — Distinción INSERT vs UPDATE:
--   PostgreSQL expone `xmax` en cada fila tras un INSERT...ON CONFLICT DO UPDATE.
--   - xmax = 0  → la fila fue INSERTADA por primera vez (registro nuevo)
--   - xmax <> 0 → la fila existía y fue ACTUALIZADA (registro ya conocido)
--   Usamos esta propiedad del sistema para contar insertados y actualizados de
--   forma precisa sin necesidad de una consulta previa a la tabla.
--
--   Retorno unificado: { "insertados": N, "actualizados": N, "fallidos": N }
-- ====================================================================================

-- ── RPC 1: SINCRONIZACIÓN DE INVESTIGADORES ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.importar_ci_investigadores(payload JSONB, id_usuario UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    elem            JSONB;
    v_dni           VARCHAR(15);
    v_xmax          BIGINT;
    cnt_insertados  INT := 0;
    cnt_actualizados INT := 0;
    cnt_fallidos    INT := 0;
BEGIN
    FOR elem IN SELECT * FROM jsonb_array_elements(payload) LOOP
        v_dni := trim((elem->>'dni')::VARCHAR);
        IF v_dni IS NULL OR v_dni = '' THEN
            cnt_fallidos := cnt_fallidos + 1;
            CONTINUE;
        END IF;

        BEGIN
            INSERT INTO public.investigador (
                dni, nombres, apellidos, condicion_laboral, departamento_academico,
                grado_academico_max, codigo_renacyt, categoria_renacyt, investigador_sm, estado_vigencia,
                orcid, institucion_principal, estado_renacyt, url_cti_vitae
            ) VALUES (
                v_dni,
                (elem->>'nombres')::VARCHAR,
                (elem->>'apellidos')::VARCHAR,
                COALESCE((elem->>'condicion_laboral')::VARCHAR, 'No Especificado'),
                COALESCE((elem->>'departamento_academico')::VARCHAR, 'No Especificado'),
                (elem->>'grado_academico_max')::VARCHAR,
                (elem->>'codigo_renacyt')::VARCHAR,
                COALESCE((elem->>'categoria_renacyt')::VARCHAR, 'No Clasificado'),
                COALESCE((elem->>'investigador_sm')::BOOLEAN, FALSE),
                COALESCE((elem->>'estado_vigencia')::VARCHAR, 'Activo'),
                (elem->>'orcid')::VARCHAR,
                (elem->>'institucion_principal')::VARCHAR,
                (elem->>'estado_renacyt')::VARCHAR,
                (elem->>'url_cti_vitae')::VARCHAR
            )
            ON CONFLICT (dni) DO UPDATE
            SET
                grado_academico_max   = COALESCE(EXCLUDED.grado_academico_max, investigador.grado_academico_max),
                codigo_renacyt        = COALESCE(EXCLUDED.codigo_renacyt, investigador.codigo_renacyt),
                categoria_renacyt     = COALESCE(EXCLUDED.categoria_renacyt, investigador.categoria_renacyt),
                orcid                 = COALESCE(EXCLUDED.orcid, investigador.orcid),
                institucion_principal = COALESCE(EXCLUDED.institucion_principal, investigador.institucion_principal),
                estado_renacyt        = COALESCE(EXCLUDED.estado_renacyt, investigador.estado_renacyt),
                url_cti_vitae         = COALESCE(EXCLUDED.url_cti_vitae, investigador.url_cti_vitae),
                updated_at            = timezone('utc'::text, now())
            RETURNING xmax INTO v_xmax;

            -- xmax = 0 → INSERT nuevo; xmax <> 0 → UPDATE sobre fila existente
            IF v_xmax = 0 THEN
                cnt_insertados := cnt_insertados + 1;
            ELSE
                cnt_actualizados := cnt_actualizados + 1;
            END IF;

        EXCEPTION WHEN OTHERS THEN
            cnt_fallidos := cnt_fallidos + 1;
        END;
    END LOOP;

    INSERT INTO public.log_auditoria (tipo_evento, entidad_afectada, valor_nuevo, resultado, id_usuario)
    VALUES ('IMPORT_EXCEL_CI', 'investigador',
            jsonb_build_object('insertados', cnt_insertados, 'actualizados', cnt_actualizados, 'fallidos', cnt_fallidos),
            'Exito', id_usuario);

    RETURN jsonb_build_object('insertados', cnt_insertados, 'actualizados', cnt_actualizados, 'fallidos', cnt_fallidos);
END;
$$;


-- ── RPC 2: SINCRONIZACIÓN DE GRUPOS DE INVESTIGACIÓN ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.importar_ci_grupos(payload JSONB, id_usuario UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    elem             JSONB;
    v_codigo         VARCHAR(50);
    v_id_grupo       INT;
    v_xmax           BIGINT;
    cnt_insertados   INT := 0;
    cnt_actualizados INT := 0;
    cnt_fallidos     INT := 0;
BEGIN
    FOR elem IN SELECT * FROM jsonb_array_elements(payload) LOOP
        v_codigo := NULLIF(trim((elem->>'codigo_grupo')::VARCHAR), '');

        -- Si no vino código explícito en el Excel, intentamos buscar por nombre exacto primero
        IF v_codigo IS NULL THEN
            SELECT codigo_grupo INTO v_codigo
            FROM public.grupo_investigacion
            WHERE lower(trim(nombre_grupo)) = lower(trim((elem->>'nombre_grupo')::VARCHAR))
            LIMIT 1;
            
            -- Si tampoco se encontró por nombre, generamos un código fallback nuevo
            IF v_codigo IS NULL THEN
                v_codigo := COALESCE(
                    NULLIF(trim((elem->>'siglas')::VARCHAR), ''), 
                    upper(substring(regexp_replace((elem->>'nombre_grupo')::VARCHAR, '[^a-zA-Z0-9]', '', 'g'), 1, 15))
                );
                
                -- Para evitar que el código generado colisione con el código de otro grupo DISTINTO,
                -- le agregamos un sufijo aleatorio en caso de que ya exista en la base de datos
                WHILE EXISTS (SELECT 1 FROM public.grupo_investigacion WHERE codigo_grupo = v_codigo) LOOP
                    v_codigo := v_codigo || floor(random() * 9 + 1)::int::text;
                END LOOP;
            END IF;
        END IF;
        
        IF v_codigo IS NULL OR (elem->>'nombre_grupo') IS NULL THEN
            cnt_fallidos := cnt_fallidos + 1;
            CONTINUE;
        END IF;

        BEGIN
            INSERT INTO public.grupo_investigacion (
                codigo_grupo, nombre_grupo, siglas, correo_coordinador, dni_coordinador, lineas_investigacion
            ) VALUES (
                v_codigo,
                (elem->>'nombre_grupo')::VARCHAR,
                (elem->>'siglas')::VARCHAR,
                (elem->>'correo_coordinador')::VARCHAR,
                (elem->>'dni_coordinador')::VARCHAR,
                (elem->'lineas_investigacion')::JSONB
            )
            ON CONFLICT (codigo_grupo) DO UPDATE
            SET
                nombre_grupo         = EXCLUDED.nombre_grupo,
                correo_coordinador   = COALESCE(EXCLUDED.correo_coordinador, grupo_investigacion.correo_coordinador),
                dni_coordinador      = COALESCE(EXCLUDED.dni_coordinador, grupo_investigacion.dni_coordinador),
                lineas_investigacion = COALESCE(EXCLUDED.lineas_investigacion, grupo_investigacion.lineas_investigacion)
            RETURNING id_grupo, xmax INTO v_id_grupo, v_xmax;

            -- xmax = 0 → INSERT nuevo; xmax <> 0 → UPDATE sobre fila existente
            IF v_xmax = 0 THEN
                cnt_insertados := cnt_insertados + 1;
            ELSE
                cnt_actualizados := cnt_actualizados + 1;
            END IF;
            
            -- Procesar miembros
            IF jsonb_array_length(elem->'miembros') > 0 THEN
                DECLARE
                    miembro JSONB;
                BEGIN
                    FOR miembro IN SELECT * FROM jsonb_array_elements(elem->'miembros') LOOP
                        INSERT INTO public.miembro_grupo (id_grupo, dni_investigador, condicion_miembro)
                        VALUES (v_id_grupo, (miembro->>'dni')::VARCHAR, (miembro->>'condicion_miembro')::VARCHAR)
                        ON CONFLICT (id_grupo, dni_investigador) DO UPDATE
                        SET condicion_miembro = EXCLUDED.condicion_miembro;
                    END LOOP;
                END;
            END IF;

        EXCEPTION WHEN OTHERS THEN
            cnt_fallidos := cnt_fallidos + 1;
        END;
    END LOOP;

    INSERT INTO public.log_auditoria (tipo_evento, entidad_afectada, valor_nuevo, resultado, id_usuario)
    VALUES ('IMPORT_EXCEL_CI', 'grupo_investigacion',
            jsonb_build_object('insertados', cnt_insertados, 'actualizados', cnt_actualizados, 'fallidos', cnt_fallidos),
            'Exito', id_usuario);

    RETURN jsonb_build_object('insertados', cnt_insertados, 'actualizados', cnt_actualizados, 'fallidos', cnt_fallidos);
END;
$$;


-- ── RPC 3: SINCRONIZACIÓN DE PROYECTOS ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.importar_ci_proyectos(payload JSONB, id_usuario UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    elem             JSONB;
    v_xmax           BIGINT;
    cnt_insertados   INT := 0;
    cnt_actualizados INT := 0;
    cnt_fallidos     INT := 0;
BEGIN
    FOR elem IN SELECT * FROM jsonb_array_elements(payload) LOOP
        IF (elem->>'codigo_proyecto') IS NULL THEN
            cnt_fallidos := cnt_fallidos + 1;
            CONTINUE;
        END IF;

        BEGIN
            INSERT INTO public.proyecto (
                codigo_proyecto, titulo_proyecto, resolucion_aprobacion, tipo_programa,
                anio_convocatoria, id_grupo
            ) VALUES (
                (elem->>'codigo_proyecto')::VARCHAR,
                (elem->>'titulo_proyecto')::VARCHAR,
                (elem->>'resolucion_aprobacion')::VARCHAR,
                (elem->>'tipo_programa')::VARCHAR,
                (elem->>'anio_convocatoria')::INT,
                (elem->>'id_grupo')::INT
            )
            ON CONFLICT (codigo_proyecto) DO UPDATE
            SET
                titulo_proyecto = EXCLUDED.titulo_proyecto,
                tipo_programa   = COALESCE(EXCLUDED.tipo_programa, proyecto.tipo_programa),
                id_grupo        = COALESCE(EXCLUDED.id_grupo, proyecto.id_grupo),
                updated_at      = timezone('utc'::text, now())
            RETURNING xmax INTO v_xmax;

            -- xmax = 0 → INSERT nuevo; xmax <> 0 → UPDATE sobre fila existente
            IF v_xmax = 0 THEN
                cnt_insertados := cnt_insertados + 1;
            ELSE
                cnt_actualizados := cnt_actualizados + 1;
            END IF;
            
            -- Procesar docentes asociados al proyecto
            IF jsonb_array_length(elem->'docentes') > 0 THEN
                DECLARE
                    docente JSONB;
                BEGIN
                    FOR docente IN SELECT * FROM jsonb_array_elements(elem->'docentes') LOOP
                        INSERT INTO public.investigador_proyecto (codigo_proyecto, dni_investigador, condicion_rol)
                        VALUES ((elem->>'codigo_proyecto')::VARCHAR, (docente->>'dni')::VARCHAR, (docente->>'condicion_rol')::VARCHAR)
                        ON CONFLICT (codigo_proyecto, dni_investigador) DO UPDATE
                        SET condicion_rol = EXCLUDED.condicion_rol;
                    END LOOP;
                END;
            END IF;

        EXCEPTION WHEN OTHERS THEN
            cnt_fallidos := cnt_fallidos + 1;
        END;
    END LOOP;

    INSERT INTO public.log_auditoria (tipo_evento, entidad_afectada, valor_nuevo, resultado, id_usuario)
    VALUES ('IMPORT_EXCEL_CI', 'proyecto',
            jsonb_build_object('insertados', cnt_insertados, 'actualizados', cnt_actualizados, 'fallidos', cnt_fallidos),
            'Exito', id_usuario);

    RETURN jsonb_build_object('insertados', cnt_insertados, 'actualizados', cnt_actualizados, 'fallidos', cnt_fallidos);
END;
$$;


-- ── RPC 4: SINCRONIZACIÓN DE PUBLICACIONES ───────────────────────────────────────────
-- Estrategia de deduplicación (dos capas):
--   1. Si doi_codigo no es nulo → conflicto por idx_publicacion_doi_notnull (índice parcial único)
--   2. Si doi_codigo es nulo    → conflicto por (titulo_articulo, nombre_revista) vía índice único parcial
-- Se requiere crear primero el índice parcial para títulos sin DOI (ver abajo).
CREATE OR REPLACE FUNCTION public.importar_ci_publicaciones(payload JSONB, id_usuario UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    elem              JSONB;
    v_doi             VARCHAR(100);
    v_titulo          TEXT;
    v_revista         VARCHAR(255);
    v_id_existente    INT;
    v_xmax            BIGINT;
    cnt_insertados    INT := 0;
    cnt_actualizados  INT := 0;
    cnt_fallidos      INT := 0;
BEGIN
    FOR elem IN SELECT * FROM jsonb_array_elements(payload) LOOP
        v_doi    := NULLIF(trim((elem->>'doi_codigo')::VARCHAR), '');
        v_titulo := trim((elem->>'titulo_articulo')::TEXT);
        v_revista:= trim((elem->>'nombre_revista')::VARCHAR);

        BEGIN
            IF v_doi IS NOT NULL THEN
                -- ── Caso A: tiene DOI → upsert por DOI (índice parcial único) ──────
                INSERT INTO public.publicacion (
                    titulo_articulo, nombre_revista, doi_codigo, indexacion,
                    tipo_publicacion, nombre_evento, id_grupo
                ) VALUES (
                    v_titulo,
                    v_revista,
                    v_doi,
                    (elem->>'indexacion')::VARCHAR,
                    (elem->>'tipo_publicacion')::VARCHAR,
                    (elem->>'nombre_evento')::VARCHAR,
                    (elem->>'id_grupo')::INT
                )
                ON CONFLICT (doi_codigo) WHERE doi_codigo IS NOT NULL DO UPDATE
                SET
                    titulo_articulo  = EXCLUDED.titulo_articulo,
                    nombre_revista   = COALESCE(EXCLUDED.nombre_revista, publicacion.nombre_revista),
                    indexacion       = COALESCE(EXCLUDED.indexacion, publicacion.indexacion),
                    tipo_publicacion = COALESCE(EXCLUDED.tipo_publicacion, publicacion.tipo_publicacion),
                    id_grupo         = COALESCE(EXCLUDED.id_grupo, publicacion.id_grupo)
                RETURNING xmax INTO v_xmax;

                IF v_xmax = 0 THEN
                    cnt_insertados := cnt_insertados + 1;
                ELSE
                    cnt_actualizados := cnt_actualizados + 1;
                END IF;

            ELSE
                -- ── Caso B: sin DOI → buscar duplicado por (titulo, revista) ───────
                SELECT id_publicacion INTO v_id_existente
                FROM public.publicacion
                WHERE doi_codigo IS NULL
                  AND lower(trim(titulo_articulo)) = lower(v_titulo)
                  AND lower(trim(nombre_revista))  = lower(COALESCE(v_revista, ''))
                LIMIT 1;

                IF v_id_existente IS NOT NULL THEN
                    -- Ya existe → actualizar
                    UPDATE public.publicacion
                    SET
                        indexacion       = COALESCE((elem->>'indexacion')::VARCHAR, indexacion),
                        tipo_publicacion = COALESCE((elem->>'tipo_publicacion')::VARCHAR, tipo_publicacion),
                        id_grupo         = COALESCE((elem->>'id_grupo')::INT, id_grupo)
                    WHERE id_publicacion = v_id_existente;
                    cnt_actualizados := cnt_actualizados + 1;
                ELSE
                    -- No existe → insertar
                    INSERT INTO public.publicacion (
                        titulo_articulo, nombre_revista, doi_codigo, indexacion,
                        tipo_publicacion, nombre_evento, id_grupo
                    ) VALUES (
                        v_titulo,
                        v_revista,
                        NULL,
                        (elem->>'indexacion')::VARCHAR,
                        (elem->>'tipo_publicacion')::VARCHAR,
                        (elem->>'nombre_evento')::VARCHAR,
                        (elem->>'id_grupo')::INT
                    );
                    cnt_insertados := cnt_insertados + 1;
                END IF;
            END IF;

        EXCEPTION WHEN OTHERS THEN
            cnt_fallidos := cnt_fallidos + 1;
        END;
    END LOOP;

    INSERT INTO public.log_auditoria (tipo_evento, entidad_afectada, valor_nuevo, resultado, id_usuario)
    VALUES ('IMPORT_EXCEL_CI', 'publicacion',
            jsonb_build_object('insertados', cnt_insertados, 'actualizados', cnt_actualizados, 'fallidos', cnt_fallidos),
            'Exito', id_usuario);

    RETURN jsonb_build_object('insertados', cnt_insertados, 'actualizados', cnt_actualizados, 'fallidos', cnt_fallidos);
END;
$$;


-- ── RPC 5: SINCRONIZACIÓN DE TESIS ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.importar_ci_tesis(payload JSONB, id_usuario UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    elem             JSONB;
    v_url            VARCHAR(255);
    v_xmax           BIGINT;
    cnt_insertados   INT := 0;
    cnt_actualizados INT := 0;
    cnt_fallidos     INT := 0;
BEGIN
    FOR elem IN SELECT * FROM jsonb_array_elements(payload) LOOP
        -- Generar un slug temporal para la URL si no viene (ya que es PK)
        v_url := COALESCE(NULLIF(trim((elem->>'url_cybertesis')::VARCHAR), ''), 
                          'import-temp-' || md5((elem->>'titulo_tesis')::VARCHAR));

        BEGIN
            INSERT INTO public.tesis (
                url_cybertesis, titulo_tesis, autor_estudiante_texto, asesor_texto, dni_asesor
            ) VALUES (
                v_url,
                (elem->>'titulo_tesis')::VARCHAR,
                (elem->>'autor_estudiante_texto')::VARCHAR,
                (elem->>'asesor_texto')::VARCHAR,
                (elem->>'dni_asesor')::VARCHAR
            )
            ON CONFLICT (url_cybertesis) DO UPDATE
            SET
                dni_asesor           = COALESCE(EXCLUDED.dni_asesor, tesis.dni_asesor),
                autor_estudiante_texto = COALESCE(EXCLUDED.autor_estudiante_texto, tesis.autor_estudiante_texto),
                asesor_texto         = COALESCE(EXCLUDED.asesor_texto, tesis.asesor_texto)
            RETURNING xmax INTO v_xmax;

            -- xmax = 0 → INSERT nuevo; xmax <> 0 → UPDATE sobre fila existente
            IF v_xmax = 0 THEN
                cnt_insertados := cnt_insertados + 1;
            ELSE
                cnt_actualizados := cnt_actualizados + 1;
            END IF;

        EXCEPTION WHEN OTHERS THEN
            cnt_fallidos := cnt_fallidos + 1;
        END;
    END LOOP;

    INSERT INTO public.log_auditoria (tipo_evento, entidad_afectada, valor_nuevo, resultado, id_usuario)
    VALUES ('IMPORT_EXCEL_CI', 'tesis',
            jsonb_build_object('insertados', cnt_insertados, 'actualizados', cnt_actualizados, 'fallidos', cnt_fallidos),
            'Exito', id_usuario);

    RETURN jsonb_build_object('insertados', cnt_insertados, 'actualizados', cnt_actualizados, 'fallidos', cnt_fallidos);
END;
$$;
