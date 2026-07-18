from sqlalchemy import text
from sqlalchemy import Column, String, Boolean, Integer, DateTime, Text, ForeignKey, Numeric, JSON, Date
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime, timezone
import uuid

Base = declarative_base()

class Usuario(Base):
    __tablename__ = 'usuario'
    id_usuario = Column(UUID(as_uuid=True), primary_key=True)
    correo_institucional = Column(String(255), nullable=False, unique=True)
    rol_sistema = Column(String(50), nullable=False)
    estado_cuenta = Column(Boolean, default=True)
    nombre_completo = Column(String(255), default='')
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class Investigador(Base):
    __tablename__ = 'investigador'
    dni = Column(String(15), primary_key=True)
    nombres = Column(String(100), nullable=False)
    apellidos = Column(String(150), nullable=False)
    codigo_interno_vrip = Column(String(50))
    condicion_laboral = Column(String(50))
    departamento_academico = Column(String(100), nullable=False)
    facultad_dependencia = Column(String(100), default='Ingeniería de Sistemas e Informática')
    grado_academico_max = Column(String(100))
    institucion_principal = Column(String(150))
    codigo_renacyt = Column(String(50), unique=True)
    orcid = Column(String(50))
    categoria_renacyt = Column(String(50), default='No Clasificado')
    estado_renacyt = Column(String(50))
    url_cti_vitae = Column(String(255))
    investigador_sm = Column(Boolean, default=False)
    estado_vigencia = Column(String(20), nullable=False, default='Activo')
    tiene_deuda_gi = Column(Boolean, default=False)
    tiene_deuda_pi = Column(Boolean, default=False)
    correo = Column(String(255))
    is_external = Column(Boolean, default=False)
    protegido_manualmente = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    historial_puntaje = relationship("HistorialPuntaje", backref="investigador", cascade="all, delete-orphan", lazy="selectin")

class GrupoInvestigacion(Base):
    __tablename__ = 'grupo_investigacion'
    id_grupo = Column(Integer, primary_key=True, autoincrement=True)
    codigo_grupo = Column(String(50), unique=True, nullable=False)
    nombre_grupo = Column(Text, nullable=False)
    siglas = Column(String(20))
    descripcion = Column(Text)
    facultad = Column(String(100), default='Ingeniería de Sistemas e Informática')
    dni_coordinador = Column(String(15), ForeignKey('investigador.dni', ondelete='SET NULL'))
    correo_coordinador = Column(String(255))
    lineas_investigacion = Column(JSON)
    fecha_reconocimiento = Column(Date)
    url_vrip = Column(String(255))
    estado_grupo = Column(String(50), default='Activo')
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    coordinador = relationship("Investigador", foreign_keys=[dni_coordinador], lazy="selectin")
    miembro_grupo = relationship("MiembroGrupo", cascade="all, delete-orphan", lazy="selectin")
    proyecto = relationship("Proyecto", lazy="selectin")

class MiembroGrupo(Base):
    __tablename__ = 'miembro_grupo'
    id_membresia = Column(Integer, primary_key=True, autoincrement=True)
    id_grupo = Column(Integer, ForeignKey('grupo_investigacion.id_grupo', ondelete='CASCADE'))
    dni_investigador = Column(String(15), ForeignKey('investigador.dni', ondelete='CASCADE'))
    condicion_miembro = Column(String(50), nullable=False)
    estado_membresia = Column(String(20), default='Activo')
    fecha_incorporacion = Column(Date)
    fecha_salida = Column(Date)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    investigador = relationship("Investigador", foreign_keys=[dni_investigador], lazy="selectin")

class Proyecto(Base):
    __tablename__ = 'proyecto'
    codigo_proyecto = Column(String(50), primary_key=True)
    resolucion_aprobacion = Column(String(100), unique=True)
    titulo_proyecto = Column(Text, nullable=False)
    tipo_proyecto = Column(String(50))
    tipo_programa = Column(String(20))
    facultad_proyecto = Column(String(100), default='Ingeniería de Sistemas e Informática')
    presupuesto_asignado = Column(Numeric(12, 2), default=0.00)
    id_grupo = Column(Integer, ForeignKey('grupo_investigacion.id_grupo', ondelete='SET NULL'))
    area_academica = Column(String(100))
    anio_convocatoria = Column(Integer)
    fecha_inicio = Column(Date)
    fecha_rendicion_35 = Column(Date)
    fecha_rendicion_70 = Column(Date)
    fecha_rendicion_100 = Column(Date)
    fecha_informe_final = Column(Date)
    estado_proyecto = Column(String(50), nullable=False, default='Aprobado')
    observaciones = Column(Text)
    protegido_manualmente = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

class Entregable(Base):
    __tablename__ = 'entregable'
    id_entregable = Column(Integer, primary_key=True, autoincrement=True)
    codigo_proyecto = Column(String(50), ForeignKey('proyecto.codigo_proyecto', ondelete='CASCADE'))
    tipo_entregable = Column(String(100), nullable=False)
    fecha_limite_programada = Column(Date)
    fecha_entrega_real = Column(Date)
    estado_entregable = Column(String(50), default='Pendiente')
    archivo_url = Column(String(255))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

class LogAuditoria(Base):
    __tablename__ = 'log_auditoria'
    id_log = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tipo_evento = Column(String(50), nullable=False)
    entidad_afectada = Column(String(100))
    pk_entidad = Column(String(100))
    valor_anterior = Column(JSON)
    valor_nuevo = Column(JSON)
    id_usuario = Column(UUID(as_uuid=True), ForeignKey('usuario.id_usuario', ondelete='SET NULL'))
    ip_origen = Column(String(50))
    resultado = Column(String(20), nullable=False, default='Exito')
    detalle_error = Column(Text)
    timestamp_evento = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class InvestigadorProyecto(Base):
    __tablename__ = 'investigador_proyecto'
    codigo_proyecto = Column(String(50), ForeignKey('proyecto.codigo_proyecto', ondelete='CASCADE'), primary_key=True)
    dni_investigador = Column(String(15), ForeignKey('investigador.dni', ondelete='CASCADE'), primary_key=True)
    condicion_rol = Column(String(100), nullable=False)
    tipo_vinculo = Column(String(100))
    facultad_integrante = Column(String(100))
    condicion_gi = Column(String(100))

class Convocatoria(Base):
    __tablename__ = 'convocatoria'
    id_convocatoria = Column(Integer, primary_key=True, autoincrement=True)
    resolucion_base = Column(String(100), unique=True)
    titulo_convocatoria = Column(Text, nullable=False)
    entidad_emisora = Column(String(100), default='VRIP-UNMSM')
    presupuesto_maximo = Column(Numeric(12, 2))
    fecha_inicio_inscripcion = Column(Date)
    fecha_cierre = Column(Date)
    url_bases_vrip = Column(String(255))
    cambios_cronograma = Column(JSON)
    cronograma_detallado = Column(JSON)
    estado_convocatoria = Column(String(50), default='Abierta')
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    evidencias = relationship("EvidenciaDifusion", backref="convocatoria", cascade="all, delete-orphan", lazy="selectin")

class Publicacion(Base):
    __tablename__ = 'publicacion'
    id_publicacion = Column(Integer, primary_key=True, autoincrement=True)
    doi_codigo = Column(String(100), unique=True)
    titulo_articulo = Column(Text, nullable=False)
    issn = Column(String(50))
    volumen = Column(String(50))
    tipo_publicacion = Column(String(100), nullable=False)
    nombre_revista = Column(String(255))
    nombre_evento = Column(String(255))
    cuartil_impacto = Column(String(10))
    indexacion = Column(String(100))
    fecha_publicacion = Column(Date)
    url_documento = Column(String(255))
    id_grupo = Column(Integer, ForeignKey('grupo_investigacion.id_grupo', ondelete='SET NULL'))
    estado_validacion = Column(String(50), default='Pendiente')
    fuente_origen = Column(String(50), default='MANUAL')
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class InvestigadorPublicacion(Base):
    __tablename__ = 'investigador_publicacion'
    dni_investigador = Column(String(15), ForeignKey('investigador.dni', ondelete='CASCADE'), primary_key=True)
    id_publicacion = Column(Integer, ForeignKey('publicacion.id_publicacion', ondelete='CASCADE'), primary_key=True)
    filiacion_unmsm = Column(Boolean, default=True)

class Tesis(Base):
    __tablename__ = 'tesis'
    url_cybertesis = Column(String(255), primary_key=True)
    titulo_tesis = Column(Text, nullable=False)
    resumen_abstract = Column(Text)
    cita_apa = Column(Text)
    derechos_licencia = Column(String(100))
    url_licencia = Column(String(255))
    formato_archivo = Column(String(50))
    idioma_iso = Column(String(10))
    tipo_recurso = Column(String(50))
    anio_publicacion = Column(Integer)
    fecha_registro_cybertesis = Column(DateTime)
    fecha_disponibilidad = Column(DateTime)
    autor_estudiante_texto = Column(String(200), nullable=False)
    dni_tesista = Column(String(15))
    asesor_texto = Column(String(200), nullable=False)
    dni_asesor = Column(String(15), ForeignKey('investigador.dni', ondelete='SET NULL'))
    orcid_asesor = Column(String(255))
    codigo_disciplina = Column(String(50))
    nivel_grado = Column(String(100))
    tipo_trabajo = Column(String(100))
    escuela_profesional = Column(String(150))
    grado_obtenido = Column(String(150))
    institucion_concedente = Column(String(255))
    editorial = Column(String(150))
    pais_publicacion = Column(String(10))
    palabras_clave = Column(JSON)
    jurados_evaluadores = Column(JSON)
    estado_validacion = Column(String(50), default='Pendiente')
    fuente_origen = Column(String(50), default='CYBERTESIS')
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class ProyectoEstadoHistorial(Base):
    __tablename__ = 'proyecto_estado_historial'
    id_historial = Column(Integer, primary_key=True, index=True)
    codigo_proyecto = Column(String(50), ForeignKey('proyecto.codigo_proyecto', ondelete='CASCADE'))
    estado_anterior = Column(String(50))
    estado_nuevo = Column(String(50), nullable=False)
    justificacion = Column(Text, nullable=False)
    id_usuario_responsable = Column(UUID(as_uuid=True), ForeignKey('usuario.id_usuario', ondelete='SET NULL'))
    fecha_cambio = Column(DateTime(timezone=True), server_default=text('now()'))

class EvidenciaDifusion(Base):
    __tablename__ = 'evidencia_difusion'
    id_evidencia = Column(Integer, primary_key=True, index=True)
    id_convocatoria = Column(Integer, ForeignKey('convocatoria.id_convocatoria', ondelete='CASCADE'))
    tipo_evidencia = Column(String(100))
    nombre_archivo = Column(String(255), nullable=False)
    url_archivo = Column(String(255), nullable=False)
    id_usuario_carga = Column(UUID(as_uuid=True), ForeignKey('usuario.id_usuario', ondelete='SET NULL'))
    fecha_carga = Column(DateTime(timezone=True), server_default=text('now()'))

class ReconciliacionPendiente(Base):
    __tablename__ = 'reconciliacion_pendientes'
    id_pendiente = Column(Integer, primary_key=True, autoincrement=True)
    entidad_afectada = Column(String(50), nullable=False) # e.g., investigador, proyecto
    llave_primaria_sugerida = Column(String(100)) # e.g., DNI, DOI
    fuentes_involucradas = Column(JSON, nullable=False) # ej. ["RAIS", "RENACYT"]
    datos_conflicto = Column(JSON, nullable=False) # payload completo con la diferencia
    motivo_cuarentena = Column(Text, nullable=False) # por qué no se reconcilió
    estado = Column(String(50), default='Pendiente') # Pendiente, Aprobado, Rechazado
    id_usuario_revisor = Column(UUID(as_uuid=True), ForeignKey('usuario.id_usuario', ondelete='SET NULL'))
    fecha_registro = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    fecha_revision = Column(DateTime(timezone=True))

class SnapshotPOI(Base):
    __tablename__ = 'snapshot_poi'
    id_snapshot = Column(Integer, primary_key=True, autoincrement=True)
    periodo_corte = Column(String(50), nullable=False)
    tipo_reporte = Column(String(100), nullable=False)
    id_usuario_emisor = Column(UUID(as_uuid=True), ForeignKey('usuario.id_usuario', ondelete='SET NULL'))
    parametros_aplicados = Column(JSON)
    datos_serializados = Column(JSON, nullable=False)
    timestamp_generacion = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class ConfiguracionGlobal(Base):
    __tablename__ = 'configuracion_global'
    clave = Column(String(100), primary_key=True)
    valor = Column(JSON, nullable=False)
    descripcion = Column(Text)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

class DepartamentoAcademico(Base):
    __tablename__ = 'departamento_academico'
    id = Column(Integer, primary_key=True, autoincrement=True)
    nombre = Column(String(100), unique=True, nullable=False)
    estado = Column(String(30), nullable=False, default="Aprobado")

class LineaInvestigacion(Base):
    __tablename__ = 'linea_investigacion'
    id = Column(Integer, primary_key=True, autoincrement=True)
    nombre = Column(String(100), unique=True, nullable=False)
    estado = Column(String(30), nullable=False, default="Aprobado")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

class HistorialPuntaje(Base):
    __tablename__ = 'historial_puntaje'
    id_historial = Column(Integer, primary_key=True, autoincrement=True)
    dni_investigador = Column(String(15), ForeignKey('investigador.dni', ondelete='CASCADE'))
    anio_evaluacion = Column(Integer, nullable=False)
    puntaje_total = Column(Numeric(10, 2), default=0.0)
    puntaje_revistas = Column(Numeric(10, 2), default=0.0)
    puntaje_libros = Column(Numeric(10, 2), default=0.0)
    puntaje_proyectos = Column(Numeric(10, 2), default=0.0)
    puntaje_patentes = Column(Numeric(10, 2), default=0.0)
    puntaje_tesis = Column(Numeric(10, 2), default=0.0)
    puntaje_otros = Column(Numeric(10, 2), default=0.0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

class SyncJob(Base):
    __tablename__ = 'sync_job'
    job_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sources = Column(JSON, nullable=False)
    filters = Column(JSON, nullable=False, default=dict)
    status = Column(String(20), nullable=False, default='queued')
    started_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    finished_at = Column(DateTime(timezone=True))
    error_message = Column(Text)
    report = Column(JSON)
    progress_logs = Column(JSON, nullable=False, default=list)
    id_usuario = Column(UUID(as_uuid=True), ForeignKey('usuario.id_usuario', ondelete='SET NULL'))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
