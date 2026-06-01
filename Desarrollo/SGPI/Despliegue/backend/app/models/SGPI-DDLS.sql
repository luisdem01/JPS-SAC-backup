-- ====================================================================================
-- SISTEMA DE GESTIÓN DE PROYECTOS DE INVESTIGACIÓN (SGPI)
-- Script DDL 
-- Autor: Angel De la Cruz (DBA)
-- ====================================================================================


-- ------------------------------------------------------------------------------------
-- SECCIÓN 1: ENTIDADES DE CONTROL DE ACCESOS E IDENTIDAD
-- ------------------------------------------------------------------------------------

-- 1. Módulo de Seguridad: Tabla de Usuarios
CREATE TABLE usuario (
    id_usuario           UUID         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    correo_institucional VARCHAR(255) NOT NULL UNIQUE,
    rol_sistema          VARCHAR(50)  NOT NULL CHECK (rol_sistema IN (
                             'Administrador',  -- Acceso total + configuración del sistema
                             'Secretaria',     -- Gestión de datos, importación y reportes
                             'Jefe',           -- Consulta y aprobación de reportes
                             'Consulta'        -- Solo lectura (rol por defecto en Trigger #2)
                         )),
    estado_cuenta        BOOLEAN      DEFAULT TRUE,
    nombre_completo      VARCHAR(255) DEFAULT '',
    created_at           TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);


-- 2. Padrón Central de Investigadores
CREATE TABLE investigador (
    dni                    VARCHAR(15)  PRIMARY KEY,
    nombres                VARCHAR(100) NOT NULL,
    apellidos              VARCHAR(150) NOT NULL,
    codigo_interno_vrip    VARCHAR(50),
    condicion_laboral      VARCHAR(50),
    departamento_academico VARCHAR(100) NOT NULL,
    facultad_dependencia   VARCHAR(100) DEFAULT 'Ingeniería de Sistemas e Informática',
    grado_academico_max    VARCHAR(100),
    institucion_principal  VARCHAR(150),
    codigo_renacyt         VARCHAR(50)  UNIQUE,
    orcid                  VARCHAR(50),
    categoria_renacyt      VARCHAR(50)  DEFAULT 'No Clasificado',
    estado_renacyt         VARCHAR(50),
    url_cti_vitae          VARCHAR(255),
    investigador_sm        BOOLEAN      DEFAULT FALSE,  -- Categoría VRIP (CU04)
    estado_vigencia        VARCHAR(20)  NOT NULL DEFAULT 'Activo',
    tiene_deuda_gi         BOOLEAN      DEFAULT FALSE,
    tiene_deuda_pi         BOOLEAN      DEFAULT FALSE,
    created_at             TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at             TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);


-- 3. Catálogo Oficial de Grupos de Investigación
CREATE TABLE grupo_investigacion (
    id_grupo             SERIAL       PRIMARY KEY,
    codigo_grupo         VARCHAR(50)  UNIQUE NOT NULL,
    nombre_grupo         TEXT         NOT NULL,
    siglas               VARCHAR(20),
    descripcion          TEXT,                     -- Edición descriptiva requerida (CU05)
    facultad             VARCHAR(100) DEFAULT 'Ingeniería de Sistemas e Informática',
    dni_coordinador      VARCHAR(15)  REFERENCES investigador(dni) ON DELETE SET NULL,
    correo_coordinador   VARCHAR(255),
    lineas_investigacion JSONB,                    -- Ej: ["Sistemas Complejos", "IA"]
    fecha_reconocimiento DATE,                     -- Reconocimiento oficial VRIP
    url_vrip             VARCHAR(255),
    estado_grupo         VARCHAR(50)  DEFAULT 'Activo',
    created_at           TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);


CREATE TABLE miembro_grupo (
    id_membresia 	SERIAL PRIMARY KEY,
    id_grupo     	INT REFERENCES grupo_investigacion(id_grupo) ON DELETE CASCADE,
    dni_investigador 	VARCHAR(15) REFERENCES investigador(dni) ON DELETE CASCADE,
    condicion_miembro 	VARCHAR(50) NOT NULL CHECK (condicion_miembro IN ('Coordinador', 'Titular', 'Adherente', 'Estudiante')),
    estado_membresia 	VARCHAR(20) DEFAULT 'Activo' CHECK (estado_membresia IN ('Activo', 'Inactivo')),
    fecha_incorporacion DATE DEFAULT CURRENT_DATE,
    fecha_salida 	DATE,
    created_at 		TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at 		TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE (id_grupo, dni_investigador)
);

-- 4. Convocatorias del VRIP
--    nivel_urgencia se calcula dinámicamente en vista_convocatoria (no se persiste).
CREATE TABLE convocatoria (
    id_convocatoria          SERIAL       PRIMARY KEY,
    resolucion_base          VARCHAR(100) UNIQUE,
    titulo_convocatoria      TEXT         NOT NULL,
    entidad_emisora          VARCHAR(100) DEFAULT 'VRIP-UNMSM',
    presupuesto_maximo       DECIMAL(12,2),
    fecha_inicio_inscripcion DATE,
    fecha_cierre             DATE,
    url_bases_vrip           VARCHAR(255),
    cambios_cronograma       JSONB,                -- Historial de modificaciones de fechas (CU12)
    estado_convocatoria      VARCHAR(50)  DEFAULT 'Abierta',
    created_at               TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);


-- 5. Catálogo General de Publicaciones Científicas
--    PK sintética para soportar publicaciones nacionales sin DOI (SciELO, Latindex).
CREATE TABLE publicacion (
    id_publicacion  SERIAL        PRIMARY KEY,
    doi_codigo      VARCHAR(100),                  -- Nullable, unicidad parcial vía índice
    titulo_articulo TEXT          NOT NULL,
    issn            VARCHAR(50),
    volumen         VARCHAR(50),
    tipo_publicacion VARCHAR(100) NOT NULL,        -- Artículo, Capítulo de libro, Ponencia
    nombre_revista  VARCHAR(255),
    nombre_evento   VARCHAR(255),                  -- Nombre del Congreso, Taller, etc.
    cuartil_impacto VARCHAR(10),                   -- Q1, Q2, Q3, Q4
    indexacion      VARCHAR(100),                  -- Scopus, Web of Science, SciELO
    fecha_publicacion DATE,
    url_documento   VARCHAR(255),
    id_grupo        INT           REFERENCES grupo_investigacion(id_grupo) ON DELETE SET NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE UNIQUE INDEX idx_publicacion_doi_notnull
    ON publicacion(doi_codigo)
    WHERE doi_codigo IS NOT NULL;


-- ------------------------------------------------------------------------------------
-- SECCIÓN 2: ENTIDADES DE OPERACIÓN CIENTÍFICA Y PROYECTOS
-- ------------------------------------------------------------------------------------

-- 6. Historial Anual de Puntajes (Auditoría Académica RAIS)
--    Restricción UNIQUE garantiza un registro por investigador por año.
CREATE TABLE historial_puntaje (
    id_historial     SERIAL       PRIMARY KEY,
    dni_investigador VARCHAR(15)  REFERENCES investigador(dni) ON DELETE CASCADE,
    anio_evaluacion  INT          NOT NULL,
    puntaje_total    DECIMAL(5,2) DEFAULT 0.00,
    puntaje_revistas DECIMAL(5,2) DEFAULT 0.00,
    puntaje_libros   DECIMAL(5,2) DEFAULT 0.00,
    puntaje_proyectos DECIMAL(5,2) DEFAULT 0.00,
    puntaje_patentes DECIMAL(5,2) DEFAULT 0.00,
    puntaje_tesis    DECIMAL(5,2) DEFAULT 0.00,
    puntaje_otros    DECIMAL(5,2) DEFAULT 0.00,
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at       TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(dni_investigador, anio_evaluacion)
);


-- 7. Proyectos Financiados (VRIP)
CREATE TABLE proyecto (
    codigo_proyecto      VARCHAR(50)   PRIMARY KEY,
    resolucion_aprobacion VARCHAR(100) UNIQUE,
    titulo_proyecto      TEXT          NOT NULL,
    tipo_proyecto        VARCHAR(50)   CHECK (tipo_proyecto IN (
                             'Básico', 'Aplicado', 'Tesis'
                         )),
    tipo_programa        VARCHAR(20),  -- PCONFIGI, SINFIN, PMULTIS...
    facultad_proyecto    VARCHAR(100)  DEFAULT 'Ingeniería de Sistemas e Informática',
    presupuesto_asignado DECIMAL(12,2) DEFAULT 0.00,
    id_grupo             INT           REFERENCES grupo_investigacion(id_grupo) ON DELETE SET NULL,
    area_academica       VARCHAR(100),
    anio_convocatoria    INT,
    fecha_inicio         DATE,         -- Fecha de RR / inicio actividades
    fecha_rendicion_35   DATE,
    fecha_rendicion_70   DATE,
    fecha_rendicion_100  DATE,
    fecha_informe_final  DATE,
    estado_proyecto      VARCHAR(50)   NOT NULL DEFAULT 'Aprobado' CHECK (estado_proyecto IN (
                             'Formulación',  -- Estado inicial de propuesta
                             'Aprobado',     -- Resolución emitida
                             'En ejecución', -- Proyecto activo
                             'Concluido',    -- Todos los entregables aprobados (trigger automático)
                             'Cancelado'     -- Cierre administrativo anticipado
                         )),
    observaciones        TEXT,         -- Ampliaciones, notas VRIP
    created_at           TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at           TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);


-- 8. Historial de Transiciones de Estado de Proyectos
--    Trazabilidad fina requerida por CU06: cada cambio de estado queda registrado
--    con justificación y responsable. Complementa el campo estado_proyecto actual.
CREATE TABLE proyecto_estado_historial (
    id_historial          SERIAL      PRIMARY KEY,
    codigo_proyecto       VARCHAR(50) REFERENCES proyecto(codigo_proyecto) ON DELETE CASCADE,
    estado_anterior       VARCHAR(50),
    estado_nuevo          VARCHAR(50) NOT NULL,
    justificacion         TEXT        NOT NULL,
    id_usuario_responsable UUID       REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    fecha_cambio          TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);


-- 9. Tabla Intermedia N:M Docente — Proyecto
CREATE TABLE investigador_proyecto (
    codigo_proyecto  VARCHAR(50) REFERENCES proyecto(codigo_proyecto) ON DELETE CASCADE,
    dni_investigador VARCHAR(15) REFERENCES investigador(dni) ON DELETE CASCADE,
    condicion_rol    VARCHAR(100) NOT NULL,   -- Responsable, Co-investigador, Colaborador
    tipo_vinculo     VARCHAR(100),
    facultad_integrante VARCHAR(100),
    condicion_gi     VARCHAR(100),
    PRIMARY KEY (codigo_proyecto, dni_investigador)
);


-- 10. Tabla Satélite Alumno — Proyecto
CREATE TABLE estudiante_proyecto (
    id_registro      SERIAL       PRIMARY KEY,
    codigo_proyecto  VARCHAR(50)  REFERENCES proyecto(codigo_proyecto) ON DELETE CASCADE,
    codigo_matricula VARCHAR(20),
    apellidos_nombres VARCHAR(200) NOT NULL,
    condicion_rol    VARCHAR(100) NOT NULL,
    tipo_vinculo     VARCHAR(50),
    facultad_integrante VARCHAR(100)
);


-- 11. Monitoreo de Hitos y Entregables del Proyecto
--    El trigger de deuda PI y el trigger de cierre en cascada operan sobre esta tabla.
CREATE TABLE entregable (
    id_entregable          SERIAL      PRIMARY KEY,
    codigo_proyecto        VARCHAR(50) REFERENCES proyecto(codigo_proyecto) ON DELETE CASCADE,
    tipo_entregable        VARCHAR(100) NOT NULL,
    fecha_limite_programada DATE,
    fecha_entrega_real     DATE,
    estado_entregable      VARCHAR(50) DEFAULT 'Pendiente',
    archivo_url            VARCHAR(255),
    updated_at             TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);


-- 12. Producción Científica — Tesis (Cybertesis)
--    PK es la URL canónica de Cybertesis. JSONB para palabras_clave y jurados.
CREATE TABLE tesis (
    url_cybertesis           VARCHAR(255) PRIMARY KEY,
    titulo_tesis             TEXT         NOT NULL,
    resumen_abstract         TEXT,
    cita_apa                 TEXT,
    derechos_licencia        VARCHAR(100),
    url_licencia             VARCHAR(255),
    formato_archivo          VARCHAR(50),
    idioma_iso               VARCHAR(10),
    tipo_recurso             VARCHAR(50),
    anio_publicacion         INT,
    fecha_registro_cybertesis TIMESTAMP,
    fecha_disponibilidad     TIMESTAMP,
    autor_estudiante_texto   VARCHAR(200) NOT NULL,
    dni_tesista              VARCHAR(15),
    asesor_texto             VARCHAR(200) NOT NULL,
    dni_asesor               VARCHAR(15)  REFERENCES investigador(dni) ON DELETE SET NULL,
    orcid_asesor             VARCHAR(255),
    codigo_disciplina        VARCHAR(50),
    nivel_grado              VARCHAR(100),
    tipo_trabajo             VARCHAR(100),
    escuela_profesional      VARCHAR(150),
    grado_obtenido           VARCHAR(150),
    institucion_concedente   VARCHAR(255),
    editorial                VARCHAR(150),
    pais_publicacion         VARCHAR(10),
    palabras_clave           JSONB,        -- Array flexible, búsqueda con @>
    jurados_evaluadores      JSONB,        -- Array de objetos con nombre y grado
    created_at               TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);


-- 13. Tabla Intermedia N:M Investigador — Publicación
CREATE TABLE investigador_publicacion (
    dni_investigador VARCHAR(15) REFERENCES investigador(dni) ON DELETE CASCADE,
    id_publicacion   INT         REFERENCES publicacion(id_publicacion) ON DELETE CASCADE,
    filiacion_unmsm  BOOLEAN     DEFAULT TRUE,
    PRIMARY KEY (dni_investigador, id_publicacion)
);


-- 14. Evidencias de Difusión de Convocatorias (Trazabilidad RQ03)
CREATE TABLE evidencia_difusion (
    id_evidencia     SERIAL       PRIMARY KEY,
    id_convocatoria  INT          REFERENCES convocatoria(id_convocatoria) ON DELETE CASCADE,
    tipo_evidencia   VARCHAR(100),               -- Captura de correo, circular, etc.
    nombre_archivo   VARCHAR(255) NOT NULL,      -- Nombre original para renderizado en UI
    url_archivo      VARCHAR(255) NOT NULL,
    id_usuario_carga UUID         REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    fecha_carga      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);


-- ------------------------------------------------------------------------------------
-- SECCIÓN 3: MÓDULOS INMUTABLES DE AUDITORÍA Y CONTROL (Caja Negra)
-- ------------------------------------------------------------------------------------

-- 15. Log de Auditoría de Aplicación (Append-Only — nunca UPDATE ni DELETE)
--    Cubre tanto eventos de BD (INSERT/UPDATE/DELETE) como eventos de aplicación
--    (LOGIN, IMPORT_EXCEL, SYNC_*, EXPORT_REPORT, etc.) requeridos por RNF019-021.
--    Sin campo updated_at: este registro no debe modificarse jamás.
CREATE TABLE log_auditoria (
    id_log           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo_evento      VARCHAR(50)  NOT NULL CHECK (tipo_evento IN (
                         'INSERT', 'UPDATE', 'DELETE',
                         'LOGIN', 'LOGOUT',
                         'IMPORT_EXCEL', 'IMPORT_EXCEL_CI', 'SYNC_RENACYT', 'SYNC_CYBERTESIS',
                         'SYNC_VRIP', 'EXPORT_REPORT', 'SNAPSHOT_GENERADO',
                         'CONFIG_CHANGE', 'USER_CREATED', 'USER_DEACTIVATED'
                     )),
    entidad_afectada VARCHAR(100),              -- Nombre de la tabla o módulo
    pk_entidad       VARCHAR(100),              -- PK del registro afectado (corregido de pk_entitad)
    valor_anterior   JSONB,                     -- Estado previo (NULL en INSERT o eventos de sesión)
    valor_nuevo      JSONB,                     -- Estado nuevo (NULL en DELETE)
    id_usuario       UUID         REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    ip_origen        VARCHAR(50),
    resultado        VARCHAR(20)  NOT NULL DEFAULT 'Exito' CHECK (resultado IN ('Exito', 'Error')),
    detalle_error    TEXT,                      -- Solo se puebla cuando resultado = 'Error'
    timestamp_evento TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);


-- 16. Snapshots Consolidados del POI (Inmutables para Auditorías Institucionales)
--    Los datos congelados no deben modificarse aunque la información base cambie
--    después del corte (RNF018). Sin campo updated_at por diseño.
CREATE TABLE snapshot_poi (
    id_snapshot          SERIAL       PRIMARY KEY,
    periodo_corte        VARCHAR(50)  NOT NULL,  -- Ej: 'Abril 2026', 'Agosto 2026'
    tipo_reporte         VARCHAR(100) NOT NULL,  -- Proyectos activos, Carga no lectiva, etc.
    id_usuario_emisor    UUID         REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    parametros_aplicados JSONB,                  -- Filtros aplicados al generar el snapshot
    datos_serializados   JSONB        NOT NULL,  -- Resultado completo congelado en el momento exacto
    timestamp_generacion TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);


-- ------------------------------------------------------------------------------------
-- SECCIÓN 4: VISTAS DE NEGOCIO
-- ------------------------------------------------------------------------------------

-- Vista de semaforización de convocatorias (nivel_urgencia calculado al vuelo)
--    Columnas explícitas en lugar de SELECT * para evitar exposición involuntaria
--    de campos futuros vía PostgREST (Supabase expone vistas como endpoints REST).
CREATE OR REPLACE VIEW vista_convocatoria AS
SELECT
    id_convocatoria,
    resolucion_base,
    titulo_convocatoria,
    entidad_emisora,
    presupuesto_maximo,
    fecha_inicio_inscripcion,
    fecha_cierre,
    url_bases_vrip,
    cambios_cronograma,
    estado_convocatoria,
    created_at,
    -- Semáforo calculado en cada consulta, nunca almacenado
    CASE
        WHEN estado_convocatoria = 'Cerrada'       THEN 'Inactiva'
        WHEN fecha_cierre < CURRENT_DATE           THEN 'Vencida'
        WHEN (fecha_cierre - CURRENT_DATE) <= 7    THEN 'Rojo'
        WHEN (fecha_cierre - CURRENT_DATE) <= 21   THEN 'Amarillo'
        ELSE                                            'Verde'
    END AS nivel_urgencia,
    -- Días restantes expuestos para ordenamiento en el dashboard (CU12)
    (fecha_cierre - CURRENT_DATE) AS dias_restantes
FROM convocatoria;


-- ------------------------------------------------------------------------------------
-- SECCIÓN 5: ÍNDICES DE PERFORMANCE
-- ------------------------------------------------------------------------------------

-- Índices core de búsqueda y filtrado
CREATE INDEX idx_investigador_apellidos  ON investigador(apellidos);
CREATE INDEX idx_proyecto_grupo          ON proyecto(id_grupo);
CREATE INDEX idx_proyecto_estado         ON proyecto(estado_proyecto);
CREATE INDEX idx_tesis_asesor            ON tesis(dni_asesor);
CREATE INDEX idx_usuario_correo          ON usuario(correo_institucional);
CREATE INDEX idx_miembro_activo 	 ON miembro_grupo(dni_investigador) WHERE estado_membresia = 'Activo';

-- Índices para la vista de convocatorias y dashboard de alertas (CU12)
CREATE INDEX idx_convocatoria_cierre     ON convocatoria(fecha_cierre);
CREATE INDEX idx_convocatoria_estado     ON convocatoria(estado_convocatoria);

-- Índices de alta performance para el módulo de auditoría (CU14)
--    Cubren los tres filtros principales del panel: tipo de evento, usuario, rango de fechas
CREATE INDEX idx_log_tipo                ON log_auditoria(tipo_evento);
CREATE INDEX idx_log_usuario             ON log_auditoria(id_usuario);
CREATE INDEX idx_log_timestamp           ON log_auditoria(timestamp_evento DESC);
CREATE INDEX idx_log_entidad             ON log_auditoria(entidad_afectada, pk_entidad);  -- typo corregido

-- ------------------------------------------------------------------------------------
-- SECCIÓN 6: MÓDULO DE RECONCILIACIÓN Y NORMALIZACIÓN (MRN)
-- ------------------------------------------------------------------------------------

-- 17. Tabla de Cuarentena para Conflictos de Reconciliación
--     Almacena temporalmente registros ambiguos procedentes del pipeline ETL
--     hasta que el administrador de datos los valide manualmente.
CREATE TABLE reconciliacion_pendientes (
    id_pendiente SERIAL PRIMARY KEY,
    entidad_afectada VARCHAR(50) NOT NULL,
    llave_primaria_sugerida VARCHAR(100),
    fuentes_involucradas JSONB NOT NULL,
    datos_conflicto JSONB NOT NULL,
    motivo_cuarentena TEXT NOT NULL,
    estado VARCHAR(50) DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente', 'Aprobado', 'Rechazado')),
    id_usuario_revisor UUID REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    fecha_registro TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    fecha_revision TIMESTAMPTZ
);

COMMENT ON TABLE reconciliacion_pendientes IS 'Tabla de staging para registros conflictivos detectados por el MRN antes de su persistencia en las tablas maestras.';

-- ------------------------------------------------------------------------------------
-- SECCIÓN 7: CONFIGURACIÓN GLOBAL (CU13)
-- ------------------------------------------------------------------------------------

CREATE TABLE configuracion_global (
    clave VARCHAR(100) PRIMARY KEY,
    valor JSONB NOT NULL,
    descripcion TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE configuracion_global IS 'Almacena variables de entorno técnicas en BD para evitar reinicios del sistema.';

-- Valores semilla (CU13)
INSERT INTO configuracion_global (clave, valor, descripcion) VALUES
('scraping.vrip.url_base', '"https://vrip.unmsm.edu.pe"', 'URL base del VRIP UNMSM para el scraper'),
('scraping.cybertesis.url_base', '"https://cybertesis.unmsm.edu.pe"', 'URL base de Cybertesis para el scraper'),
('scraping.frecuencia_horas', '24', 'Frecuencia de actualización en horas'),
('alertas.semaforo_rojo_dias', '5', 'Margen de días para alerta roja antes del cierre de entregable o convocatoria'),
('alertas.semaforo_amarillo_dias', '10', 'Margen de días para alerta amarilla antes del cierre'),
('carga_no_lectiva.maximo_horas_semanales', '16', 'Límite máximo de horas semanales permitidas (Regla institucional FISI)'),
('reportes.limite_filas_export', '500', 'Límite de seguridad de filas para exportaciones grandes de datos');

-- ------------------------------------------------------------------------------------
-- SECCIÓN 8: DEPARTAMENTOS ACADÉMICOS Y LÍNEAS DE INVESTIGACIÓN
-- ------------------------------------------------------------------------------------

CREATE TABLE departamento_academico (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) UNIQUE NOT NULL,
    estado VARCHAR(30) NOT NULL DEFAULT 'Aprobado'
);

COMMENT ON TABLE departamento_academico IS 'Almacena la lista oficial de departamentos académicos.';

-- Valores semilla para departamentos académicos
INSERT INTO departamento_academico (nombre, estado) VALUES
('Biología Celular', 'Aprobado'),
('Física Teórica', 'Aprobado'),
('Química Orgánica', 'Aprobado'),
('Genética', 'Aprobado'),
('Ingeniería de Sistemas', 'Aprobado'),
('Ingeniería de Software', 'Aprobado'),
('Ciencia de la Computación', 'Aprobado'),
('Ciencias de la Computación', 'Aprobado'),
('Inteligencia Artificial', 'Aprobado'),
('Matemáticas Aplicadas', 'Aprobado'),
('Ingeniería Eléctrica', 'Aprobado'),
('Biotecnología', 'Aprobado'),
('Externo (RENACYT)', 'Aprobado'),
('No Especificado', 'Aprobado');

CREATE TABLE linea_investigacion (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) UNIQUE NOT NULL,
    estado VARCHAR(30) NOT NULL DEFAULT 'Aprobado',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE linea_investigacion IS 'Almacena la lista oficial de líneas de investigación institucionales.';

INSERT INTO linea_investigacion (nombre, estado) VALUES
('L1. Inteligencia Artificial y Aprendizaje Automático', 'Aprobado'),
('L2. Ciberseguridad y Criptografía Aplicada', 'Aprobado'),
('L3. Sistemas Distribuidos y Computación en la Nube', 'Aprobado'),
('L4. Ingeniería de Software y Metodologías Ágiles', 'Aprobado'),
('L5. Procesamiento de Lenguaje Natural', 'Aprobado'),
('L6. Ciencia de Datos y Big Data', 'Aprobado'),
('L7. Internet de las Cosas y Redes de Sensores', 'Aprobado'),
('L8. Computación Gráfica y Realidad Virtual', 'Aprobado');


