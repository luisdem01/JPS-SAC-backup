-- ====================================================================================
-- SISTEMA DE GESTIÓN DE PROYECTOS DE INVESTIGACIÓN (SGPI)
-- Script SQL: Funciones RPC de Importación Masiva CI (Antes RAIS)
-- Componente: Capa Transaccional ETL (CU02 / CU03 / CU04)
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
    cnt_inserted    INT := 0;
    cnt_updated     INT := 0;
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
                updated_at            = timezone('utc'::text, now());
                
            -- Nota: No usamos RETURNING xmax para distinguir insert/update por simplicidad de Supabase
            cnt_updated := cnt_updated + 1; 
        EXCEPTION WHEN OTHERS THEN
            cnt_fallidos := cnt_fallidos + 1;
        END;
    END LOOP;

    INSERT INTO public.log_auditoria (tipo_evento, entidad_afectada, valor_nuevo, resultado, id_usuario)
    VALUES ('IMPORT_EXCEL_CI', 'investigador', jsonb_build_object('procesados', cnt_updated, 'fallidos', cnt_fallidos), 'Exito', id_usuario);

    RETURN jsonb_build_object('procesados', cnt_updated, 'fallidos', cnt_fallidos);
END;
$$;


-- ── RPC 2: SINCRONIZACIÓN DE GRUPOS DE INVESTIGACIÓN ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.importar_ci_grupos(payload JSONB, id_usuario UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    elem JSONB;
    v_codigo VARCHAR(50);
    v_id_grupo INT;
    cnt_procesados INT := 0;
    cnt_fallidos INT := 0;
BEGIN
    FOR elem IN SELECT * FROM jsonb_array_elements(payload) LOOP
        -- Si no hay código de grupo, usaremos las siglas o un slug del nombre
        v_codigo := COALESCE(NULLIF(trim((elem->>'codigo_grupo')::VARCHAR), ''), 
                             NULLIF(trim((elem->>'siglas')::VARCHAR), ''), 
                             substring(regexp_replace((elem->>'nombre_grupo')::VARCHAR, '[^a-zA-Z0-9]', '', 'g'), 1, 15));
        
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
                nombre_grupo = EXCLUDED.nombre_grupo,
                correo_coordinador = COALESCE(EXCLUDED.correo_coordinador, grupo_investigacion.correo_coordinador),
                dni_coordinador = COALESCE(EXCLUDED.dni_coordinador, grupo_investigacion.dni_coordinador),
                lineas_investigacion = COALESCE(EXCLUDED.lineas_investigacion, grupo_investigacion.lineas_investigacion)
            RETURNING id_grupo INTO v_id_grupo;
            
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

            cnt_procesados := cnt_procesados + 1;
        EXCEPTION WHEN OTHERS THEN
            cnt_fallidos := cnt_fallidos + 1;
        END;
    END LOOP;

    INSERT INTO public.log_auditoria (tipo_evento, entidad_afectada, valor_nuevo, resultado, id_usuario)
    VALUES ('IMPORT_EXCEL_CI', 'grupo_investigacion', jsonb_build_object('procesados', cnt_procesados, 'fallidos', cnt_fallidos), 'Exito', id_usuario);

    RETURN jsonb_build_object('procesados', cnt_procesados, 'fallidos', cnt_fallidos);
END;
$$;


-- ── RPC 3: SINCRONIZACIÓN DE PROYECTOS ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.importar_ci_proyectos(payload JSONB, id_usuario UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    elem JSONB;
    cnt_procesados INT := 0;
    cnt_fallidos INT := 0;
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
                tipo_programa = COALESCE(EXCLUDED.tipo_programa, proyecto.tipo_programa),
                id_grupo = COALESCE(EXCLUDED.id_grupo, proyecto.id_grupo),
                updated_at = timezone('utc'::text, now());
            
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

            cnt_procesados := cnt_procesados + 1;
        EXCEPTION WHEN OTHERS THEN
            cnt_fallidos := cnt_fallidos + 1;
        END;
    END LOOP;

    INSERT INTO public.log_auditoria (tipo_evento, entidad_afectada, valor_nuevo, resultado, id_usuario)
    VALUES ('IMPORT_EXCEL_CI', 'proyecto', jsonb_build_object('procesados', cnt_procesados, 'fallidos', cnt_fallidos), 'Exito', id_usuario);

    RETURN jsonb_build_object('procesados', cnt_procesados, 'fallidos', cnt_fallidos);
END;
$$;


-- ── RPC 4: SINCRONIZACIÓN DE PUBLICACIONES ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.importar_ci_publicaciones(payload JSONB, id_usuario UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    elem JSONB;
    cnt_procesados INT := 0;
    cnt_fallidos INT := 0;
BEGIN
    FOR elem IN SELECT * FROM jsonb_array_elements(payload) LOOP
        BEGIN
            INSERT INTO public.publicacion (
                titulo_articulo, nombre_revista, doi_codigo, indexacion, 
                tipo_publicacion, nombre_evento, id_grupo
            ) VALUES (
                (elem->>'titulo_articulo')::VARCHAR,
                (elem->>'nombre_revista')::VARCHAR,
                (elem->>'doi_codigo')::VARCHAR,
                (elem->>'indexacion')::VARCHAR,
                (elem->>'tipo_publicacion')::VARCHAR,
                (elem->>'nombre_evento')::VARCHAR,
                (elem->>'id_grupo')::INT
            );

            cnt_procesados := cnt_procesados + 1;
        EXCEPTION WHEN OTHERS THEN
            cnt_fallidos := cnt_fallidos + 1;
        END;
    END LOOP;

    INSERT INTO public.log_auditoria (tipo_evento, entidad_afectada, valor_nuevo, resultado, id_usuario)
    VALUES ('IMPORT_EXCEL_CI', 'publicacion', jsonb_build_object('procesados', cnt_procesados, 'fallidos', cnt_fallidos), 'Exito', id_usuario);

    RETURN jsonb_build_object('procesados', cnt_procesados, 'fallidos', cnt_fallidos);
END;
$$;


-- ── RPC 5: SINCRONIZACIÓN DE TESIS ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.importar_ci_tesis(payload JSONB, id_usuario UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    elem JSONB;
    v_url VARCHAR(255);
    cnt_procesados INT := 0;
    cnt_fallidos INT := 0;
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
                dni_asesor = COALESCE(EXCLUDED.dni_asesor, tesis.dni_asesor);

            cnt_procesados := cnt_procesados + 1;
        EXCEPTION WHEN OTHERS THEN
            cnt_fallidos := cnt_fallidos + 1;
        END;
    END LOOP;

    INSERT INTO public.log_auditoria (tipo_evento, entidad_afectada, valor_nuevo, resultado, id_usuario)
    VALUES ('IMPORT_EXCEL_CI', 'tesis', jsonb_build_object('procesados', cnt_procesados, 'fallidos', cnt_fallidos), 'Exito', id_usuario);

    RETURN jsonb_build_object('procesados', cnt_procesados, 'fallidos', cnt_fallidos);
END;
$$;
