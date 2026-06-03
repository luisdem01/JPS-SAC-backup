-- ====================================================================================
-- SISTEMA DE GESTIÓN DE PROYECTOS DE INVESTIGACIÓN (SGPI)
-- Script de Triggers y Automatización - Versión 2.0 (Edición Final de Producción)
-- Autor: Angel De la Cruz (DBA)
-- ====================================================================================


-- ------------------------------------------------------------------------------------
-- T0: ACTUALIZACIÓN AUTOMÁTICA DE 'updated_at'
-- Función genérica reutilizada por todos los triggers de auditoría de modificación.
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.actualizar_campo_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_investigador_upd
    BEFORE UPDATE ON investigador
    FOR EACH ROW EXECUTE FUNCTION public.actualizar_campo_updated_at();

CREATE TRIGGER trg_proyecto_upd
    BEFORE UPDATE ON proyecto
    FOR EACH ROW EXECUTE FUNCTION public.actualizar_campo_updated_at();

CREATE TRIGGER trg_historial_upd
    BEFORE UPDATE ON historial_puntaje
    FOR EACH ROW EXECUTE FUNCTION public.actualizar_campo_updated_at();

CREATE TRIGGER trg_entregable_upd
    BEFORE UPDATE ON entregable
    FOR EACH ROW EXECUTE FUNCTION public.actualizar_campo_updated_at();

-- Agregado: miembro_grupo ahora existe en DDL v5.0
CREATE TRIGGER trg_miembro_upd
    BEFORE UPDATE ON miembro_grupo
    FOR EACH ROW EXECUTE FUNCTION public.actualizar_campo_updated_at();


-- ------------------------------------------------------------------------------------
-- T1: SINCRONIZACIÓN DE IDENTIDAD (AUTH → USUARIO)
-- Crea automáticamente el perfil público cuando Supabase Auth registra un usuario.
-- Rol por defecto: 'Consulta' (mínimo privilegio). El Administrador lo eleva vía CU13.
-- SECURITY DEFINER permite al trigger escribir en el esquema público desde auth.users.
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.usuario (id_usuario, correo_institucional, rol_sistema)
    VALUES (NEW.id, NEW.email, 'Consulta');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- ------------------------------------------------------------------------------------
-- T2: GESTIÓN BIDIRECCIONAL DE DEUDA PI (Mora y Subsanación Automática)
-- Dispara al cambiar estado_entregable. Evalúa si el responsable del proyecto
-- tiene algún entregable vencido en CUALQUIER proyecto donde sea Responsable:
--   → Si tiene al menos uno vencido: tiene_deuda_pi = TRUE  (sanción)
--   → Si no tiene ninguno vencido:  tiene_deuda_pi = FALSE (subsanación automática)
--
-- CORRECCIÓN: Guardia al inicio evita ejecutar el loop costoso para estados
-- intermedios irrelevantes (ej: 'Pendiente' → 'En revisión').
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gestionar_deuda_pi()
RETURNS TRIGGER AS $$
DECLARE
    docente_dni  VARCHAR(15);
    tiene_mora   BOOLEAN;
BEGIN
    -- Guardia: solo actuar cuando el estado cambia a uno que afecta deudas
    IF NEW.estado_entregable NOT IN ('Vencido', 'No Entregado', 'Aprobado') THEN
        RETURN NEW;
    END IF;

    -- Para cada responsable del proyecto de este entregable
    FOR docente_dni IN
        SELECT dni_investigador
        FROM investigador_proyecto
        WHERE codigo_proyecto = NEW.codigo_proyecto
          AND condicion_rol   = 'Responsable'
    LOOP
        -- Evaluar si tiene AL MENOS UN entregable vencido en cualquier proyecto
        -- NOTA: Como el trigger es AFTER UPDATE, NEW ya tiene el estado actualizado,
        -- por lo que la evaluación refleja el estado real actual de la BD.
        SELECT EXISTS (
            SELECT 1
            FROM entregable e
            JOIN investigador_proyecto ip
                ON e.codigo_proyecto = ip.codigo_proyecto
            WHERE ip.dni_investigador = docente_dni
              AND ip.condicion_rol    = 'Responsable'
              AND e.estado_entregable IN ('Vencido', 'No Entregado')
        ) INTO tiene_mora;

        -- Aplicar sanción o perdón según resultado
        UPDATE investigador
        SET tiene_deuda_pi = tiene_mora
        WHERE dni = docente_dni;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_evaluar_deuda_pi
    AFTER UPDATE OF estado_entregable ON entregable
    FOR EACH ROW EXECUTE FUNCTION public.gestionar_deuda_pi();


-- ------------------------------------------------------------------------------------
-- T3: CIERRE EN CASCADA DE PROYECTO + REGISTRO EN HISTORIAL
-- Al aprobar un entregable, verifica si todos los del proyecto están aprobados.
-- Si es así, cierra el proyecto a 'Concluido' Y registra la transición en
-- proyecto_estado_historial (id_usuario_responsable = NULL → acción automática del sistema).
--
-- CORRECCIÓN: La versión anterior no registraba en proyecto_estado_historial,
-- dejando el cierre automático sin trazabilidad en el CU06.
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verificar_cierre_proyecto()
RETURNS TRIGGER AS $$
DECLARE
    entregables_totales   INT;
    entregables_aprobados INT;
    estado_anterior_val   VARCHAR(50);
BEGIN
    -- Solo actuar cuando el nuevo estado es 'Aprobado'
    IF NEW.estado_entregable <> 'Aprobado' THEN
        RETURN NEW;
    END IF;

    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE estado_entregable = 'Aprobado')
    INTO entregables_totales, entregables_aprobados
    FROM entregable
    WHERE codigo_proyecto = NEW.codigo_proyecto;

    IF entregables_totales > 0 AND entregables_totales = entregables_aprobados THEN

        -- Capturar estado actual antes de modificarlo
        SELECT estado_proyecto
        INTO estado_anterior_val
        FROM proyecto
        WHERE codigo_proyecto = NEW.codigo_proyecto;

        -- Solo actuar si el proyecto no está ya cerrado (evitar duplicados en historial)
        IF estado_anterior_val <> 'Concluido' THEN

            -- 1. Cerrar el proyecto
            UPDATE proyecto
            SET estado_proyecto = 'Concluido'
            WHERE codigo_proyecto = NEW.codigo_proyecto;

            -- 2. Registrar la transición automática en el historial (CU06)
            --    id_usuario_responsable = NULL indica acción automática del sistema
            INSERT INTO proyecto_estado_historial
                (codigo_proyecto, estado_anterior, estado_nuevo, justificacion, id_usuario_responsable)
            VALUES (
                NEW.codigo_proyecto,
                estado_anterior_val,
                'Concluido',
                'Cierre automático del sistema: todos los entregables han sido aprobados.',
                NULL
            );

        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cierre_proyecto
    AFTER UPDATE OF estado_entregable ON entregable
    FOR EACH ROW EXECUTE FUNCTION public.verificar_cierre_proyecto();


-- ------------------------------------------------------------------------------------
-- T4: AUTOCÁLCULO DE PUNTAJE TOTAL EN HISTORIAL_PUNTAJE
-- Previene inconsistencias del backend calculando el total directamente en la BD.
-- COALESCE maneja componentes NULL sin lanzar errores (carga incremental RAIS).
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calcular_puntaje_total()
RETURNS TRIGGER AS $$
BEGIN
    NEW.puntaje_total :=
        COALESCE(NEW.puntaje_revistas,  0) +
        COALESCE(NEW.puntaje_libros,    0) +
        COALESCE(NEW.puntaje_proyectos, 0) +
        COALESCE(NEW.puntaje_patentes,  0) +
        COALESCE(NEW.puntaje_tesis,     0) +
        COALESCE(NEW.puntaje_otros,     0);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_autocalculo_puntaje
    BEFORE INSERT OR UPDATE ON historial_puntaje
    FOR EACH ROW EXECUTE FUNCTION public.calcular_puntaje_total();


-- ------------------------------------------------------------------------------------
-- T5: BLOQUEO INMUTABLE DE LA CAJA NEGRA (RNF019-021)
-- Nadie —ni el Administrador, ni service_role— puede hacer UPDATE o DELETE
-- en log_auditoria ni snapshot_poi. Opera a nivel de motor, más fuerte que RLS.
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bloquear_modificacion_inmutable()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION
        'Violación de Integridad: Los registros de auditoría y snapshots son '
        'INMUTABLES y no pueden ser modificados ni eliminados. Tabla: %', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bloqueo_log_auditoria
    BEFORE UPDATE OR DELETE ON log_auditoria
    FOR EACH ROW EXECUTE FUNCTION public.bloquear_modificacion_inmutable();

CREATE TRIGGER trg_bloqueo_snapshot_poi
    BEFORE UPDATE OR DELETE ON snapshot_poi
    FOR EACH ROW EXECUTE FUNCTION public.bloquear_modificacion_inmutable();


-- ------------------------------------------------------------------------------------
-- T6: EXCLUSIVIDAD DE MEMBRESÍA EN GRUPO DE INVESTIGACIÓN (CU05)
-- Un investigador no puede pertenecer a dos grupos con estado 'Activo' al mismo tiempo.
--
-- CORRECCIÓN: La condición original usaba IS DISTINCT FROM NEW.id_membresia.
-- En INSERT, id_membresia es NULL (SERIAL aún no asignado), por lo que la comparación
-- era ambigua. Ahora se separa por TG_OP para claridad y corrección semántica:
--   → INSERT: la fila aún no existe en la tabla, no hace falta excluirla.
--   → UPDATE: excluimos la fila actual por su id real para permitir editar estado.
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validar_exclusividad_grupo()
RETURNS TRIGGER AS $$
DECLARE
    grupo_activo_existente VARCHAR(50);
BEGIN
    -- Solo validar si la membresía que se intenta guardar es 'Activo'
    IF NEW.estado_membresia <> 'Activo' THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        -- En INSERT: buscar cualquier membresía activa del investigador en otro grupo
        SELECT codigo_grupo INTO grupo_activo_existente
        FROM miembro_grupo
        WHERE dni_investigador  = NEW.dni_investigador
          AND estado_membresia  = 'Activo';

    ELSIF TG_OP = 'UPDATE' THEN
        -- En UPDATE: excluir la fila actual por su id real (ya existe en la tabla)
        SELECT codigo_grupo INTO grupo_activo_existente
        FROM miembro_grupo
        WHERE dni_investigador  = NEW.dni_investigador
          AND estado_membresia  = 'Activo'
          AND id_membresia     != NEW.id_membresia;
    END IF;

    IF grupo_activo_existente IS NOT NULL THEN
        RAISE EXCEPTION
            'Exclusividad violada: El investigador con DNI % ya pertenece '
            'al grupo activo %.', NEW.dni_investigador, grupo_activo_existente;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_exclusividad_grupo
    BEFORE INSERT OR UPDATE ON miembro_grupo
    FOR EACH ROW EXECUTE FUNCTION public.validar_exclusividad_grupo();


-- ------------------------------------------------------------------------------------
-- T7: AUDITORÍA AUTOMÁTICA EN TABLAS CORE (CU14 / RNF019-021)
-- Intercepta INSERT, UPDATE y DELETE en tablas principales e inyecta
-- el evento en log_auditoria automáticamente.
--
-- CORRECCIONES:
--   [a] pk_entidad dinámica: usa COALESCE(NEW.pk, OLD.pk) para capturar la PK
--       correctamente en DELETE (NEW es NULL) e INSERT/UPDATE (OLD puede ser NULL).
--   [b] valor_anterior y valor_nuevo protegidos contra NULL en DELETE/INSERT.
--   [c] Trigger ahora cubre INSERT OR UPDATE OR DELETE (antes solo UPDATE).
--   [d] Función separada por tabla para usar la PK correcta en cada una.
-- ------------------------------------------------------------------------------------

-- Función para la tabla investigador (PK: dni)
CREATE OR REPLACE FUNCTION public.auditar_investigador()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
BEGIN
    BEGIN
        v_user_id := NULLIF(current_setting('app.current_user_id', true), '')::UUID;
    EXCEPTION WHEN OTHERS THEN
        v_user_id := NULL;
    END;
    
    INSERT INTO log_auditoria (
        tipo_evento, entidad_afectada, pk_entidad,
        valor_anterior, valor_nuevo, resultado, id_usuario
    ) VALUES (
        TG_OP,
        TG_TABLE_NAME,
        COALESCE(NEW.dni, OLD.dni),
        CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE row_to_json(OLD)::JSONB END,
        CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE row_to_json(NEW)::JSONB END,
        'Exito',
        COALESCE(auth.uid(), v_user_id)
    );
    -- AFTER trigger: retornar NEW en INSERT/UPDATE, OLD en DELETE
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auditoria_investigador
    AFTER INSERT OR UPDATE OR DELETE ON investigador
    FOR EACH ROW EXECUTE FUNCTION public.auditar_investigador();

-- Función para la tabla proyecto (PK: codigo_proyecto)
CREATE OR REPLACE FUNCTION public.auditar_proyecto()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
BEGIN
    BEGIN
        v_user_id := NULLIF(current_setting('app.current_user_id', true), '')::UUID;
    EXCEPTION WHEN OTHERS THEN
        v_user_id := NULL;
    END;
    
    INSERT INTO log_auditoria (
        tipo_evento, entidad_afectada, pk_entidad,
        valor_anterior, valor_nuevo, resultado, id_usuario
    ) VALUES (
        TG_OP,
        TG_TABLE_NAME,
        COALESCE(NEW.codigo_proyecto, OLD.codigo_proyecto),
        CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE row_to_json(OLD)::JSONB END,
        CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE row_to_json(NEW)::JSONB END,
        'Exito',
        COALESCE(auth.uid(), v_user_id)
    );
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auditoria_proyecto
    AFTER INSERT OR UPDATE OR DELETE ON proyecto
    FOR EACH ROW EXECUTE FUNCTION public.auditar_proyecto();


-- ------------------------------------------------------------------------------------
-- T8: LOG AUTOMÁTICO DE TRANSICIONES DE ESTADO DE PROYECTOS (CU06) — NUEVO
-- Registra en proyecto_estado_historial CADA cambio manual de estado_proyecto
-- realizado por cualquier cliente (frontend, API, SQL directo).
-- Esto complementa al T3: T3 cubre el cierre automático del sistema,
-- T8 cubre todos los cambios manuales realizados por usuarios.
--
-- NOTA: id_usuario_responsable ahora lee de auth.uid() o app.current_user_id.
-- El trigger actúa como red de seguridad para cambios directos a la BD.
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_cambio_estado_proyecto()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
BEGIN
    BEGIN
        v_user_id := NULLIF(current_setting('app.current_user_id', true), '')::UUID;
    EXCEPTION WHEN OTHERS THEN
        v_user_id := NULL;
    END;

    -- Solo actuar si el estado realmente cambió
    IF OLD.estado_proyecto IS DISTINCT FROM NEW.estado_proyecto THEN
        INSERT INTO proyecto_estado_historial (
            codigo_proyecto,
            estado_anterior,
            estado_nuevo,
            justificacion,
            id_usuario_responsable
        ) VALUES (
            NEW.codigo_proyecto,
            OLD.estado_proyecto,
            NEW.estado_proyecto,
            'Cambio registrado automáticamente por el sistema (origen: BD directa).',
            COALESCE(auth.uid(), v_user_id)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_log_cambio_estado_proyecto
    AFTER UPDATE OF estado_proyecto ON proyecto
    FOR EACH ROW EXECUTE FUNCTION public.registrar_cambio_estado_proyecto();


-- ------------------------------------------------------------------------------------
-- RESUMEN DE TRIGGERS ACTIVOS
-- ------------------------------------------------------------------------------------
-- T0  trg_investigador_upd      → BEFORE UPDATE investigador        (updated_at)
-- T0  trg_proyecto_upd          → BEFORE UPDATE proyecto            (updated_at)
-- T0  trg_historial_upd         → BEFORE UPDATE historial_puntaje   (updated_at)
-- T0  trg_entregable_upd        → BEFORE UPDATE entregable          (updated_at)
-- T0  trg_miembro_upd           → BEFORE UPDATE miembro_grupo       (updated_at)
-- T1  on_auth_user_created      → AFTER INSERT auth.users           (sync identidad)
-- T2  trg_evaluar_deuda_pi      → AFTER UPDATE entregable           (deuda PI bidireccional)
-- T3  trg_cierre_proyecto       → AFTER UPDATE entregable           (cierre + historial)
-- T4  trg_autocalculo_puntaje   → BEFORE INSERT OR UPDATE historial_puntaje
-- T5  trg_bloqueo_log_auditoria → BEFORE UPDATE OR DELETE log_auditoria
-- T5  trg_bloqueo_snapshot_poi  → BEFORE UPDATE OR DELETE snapshot_poi
-- T6  trg_exclusividad_grupo    → BEFORE INSERT OR UPDATE miembro_grupo
-- T7  trg_auditoria_investigador→ AFTER INSERT OR UPDATE OR DELETE investigador
-- T7  trg_auditoria_proyecto    → AFTER INSERT OR UPDATE OR DELETE proyecto
-- T8  trg_log_cambio_estado     → AFTER UPDATE proyecto (estado_proyecto)
-- ------------------------------------------------------------------------------------