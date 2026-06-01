from pydantic import BaseModel, computed_field
from typing import Optional, List, Any
from datetime import date, datetime

class InvestigadorBase(BaseModel):
    dni: str
    nombres: str
    apellidos: str
    codigo_interno_vrip: Optional[str] = None
    condicion_laboral: Optional[str] = None
    departamento_academico: str
    facultad_dependencia: Optional[str] = 'Ingeniería de Sistemas e Informática'
    grado_academico_max: Optional[str] = None
    institucion_principal: Optional[str] = None
    codigo_renacyt: Optional[str] = None
    orcid: Optional[str] = None
    categoria_renacyt: Optional[str] = 'No Clasificado'
    estado_renacyt: Optional[str] = None
    url_cti_vitae: Optional[str] = None
    investigador_sm: Optional[bool] = False
    estado_vigencia: Optional[str] = 'Activo'
    correo: Optional[str] = None

class HistorialPuntajeInput(BaseModel):
    anio_evaluacion: int
    puntaje_total: float
    puntaje_revistas: float
    puntaje_tesis: float
    puntaje_proyectos: float
    puntaje_libros: Optional[float] = 0.0
    puntaje_patentes: Optional[float] = 0.0
    puntaje_otros: Optional[float] = 0.0

class HistorialPuntajeResponse(BaseModel):
    id_historial: int
    dni_investigador: Optional[str] = None
    anio_evaluacion: int
    puntaje_total: float
    puntaje_revistas: float
    puntaje_libros: float
    puntaje_proyectos: float
    puntaje_patentes: float
    puntaje_tesis: float
    puntaje_otros: float
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class InvestigadorCreate(InvestigadorBase):
    historial_puntaje: Optional[List[HistorialPuntajeInput]] = None

class InvestigadorUpdate(BaseModel):
    nombres: Optional[str] = None
    apellidos: Optional[str] = None
    codigo_interno_vrip: Optional[str] = None
    condicion_laboral: Optional[str] = None
    departamento_academico: Optional[str] = None
    facultad_dependencia: Optional[str] = None
    grado_academico_max: Optional[str] = None
    institucion_principal: Optional[str] = None
    categoria_renacyt: Optional[str] = None
    estado_renacyt: Optional[str] = None
    url_cti_vitae: Optional[str] = None
    investigador_sm: Optional[bool] = None
    estado_vigencia: Optional[str] = None
    tiene_deuda_gi: Optional[bool] = None
    tiene_deuda_pi: Optional[bool] = None
    correo: Optional[str] = None
    is_external: Optional[bool] = None
    historial_puntaje: Optional[List[HistorialPuntajeInput]] = None

class InvestigadorResponse(InvestigadorBase):
    tiene_deuda_gi: bool
    tiene_deuda_pi: bool
    created_at: datetime
    updated_at: datetime
    is_external: Optional[bool] = False
    historial_puntaje: List[HistorialPuntajeResponse] = []
    proyectos_count: Optional[int] = 0
    publicaciones_count: Optional[int] = 0
    
    class Config:
        from_attributes = True

class MiembroGrupoInput(BaseModel):
    dni: str
    nombre: Optional[str] = None
    nombres: Optional[str] = None
    apellidos: Optional[str] = None
    rol: str
    fechaIncorporacion: Optional[str] = None
    estado: str
    isExternal: Optional[bool] = False
    nivelRenacyt: Optional[str] = None
    departamento: Optional[str] = None
    facultad: Optional[str] = None

class GrupoInvestigacionBase(BaseModel):
    codigo_grupo: str
    nombre_grupo: str
    siglas: Optional[str] = None
    descripcion: Optional[str] = None
    facultad: Optional[str] = 'Ingeniería de Sistemas e Informática'
    dni_coordinador: Optional[str] = None
    correo_coordinador: Optional[str] = None
    lineas_investigacion: Optional[List[str]] = None
    fecha_reconocimiento: Optional[date] = None
    url_vrip: Optional[str] = None
    estado_grupo: Optional[str] = 'Activo'

class GrupoInvestigacionCreate(GrupoInvestigacionBase):
    miembros: Optional[List[MiembroGrupoInput]] = None

class GrupoInvestigacionUpdate(BaseModel):
    nombre_grupo: Optional[str] = None
    siglas: Optional[str] = None
    descripcion: Optional[str] = None
    facultad: Optional[str] = None
    dni_coordinador: Optional[str] = None
    correo_coordinador: Optional[str] = None
    lineas_investigacion: Optional[List[str]] = None
    fecha_reconocimiento: Optional[date] = None
    url_vrip: Optional[str] = None
    estado_grupo: Optional[str] = None
    miembros: Optional[List[MiembroGrupoInput]] = None

class InvestigadorSimpleResponse(BaseModel):
    nombres: str
    apellidos: str
    
    class Config:
        from_attributes = True

class MiembroGrupoResponse(BaseModel):
    id_membresia: int
    dni_investigador: str
    condicion_miembro: str
    estado_membresia: str
    fecha_incorporacion: Optional[date] = None
    investigador: Optional[InvestigadorSimpleResponse] = None
    
    @computed_field
    def dni(self) -> str:
        return self.dni_investigador

    @computed_field
    def rol(self) -> str:
        if self.condicion_miembro == "Coordinador":
            return "Director"
        elif self.condicion_miembro == "Titular":
            return "Co-Investigador"
        elif self.condicion_miembro == "Estudiante":
            return "Tesista"
        return self.condicion_miembro

    @computed_field
    def nombre(self) -> str:
        if self.investigador:
            return f"{self.investigador.nombres} {self.investigador.apellidos}"
        return self.dni_investigador

    @computed_field
    def estado(self) -> str:
        return "activo" if self.estado_membresia == "Activo" else "inactivo"

    @computed_field
    def fechaIncorporacion(self) -> Optional[str]:
        return self.fecha_incorporacion.isoformat() if self.fecha_incorporacion else None

    class Config:
        from_attributes = True

class ProyectoVinculadoResponse(BaseModel):
    codigo_proyecto: str
    resolucion_aprobacion: Optional[str] = None
    titulo_proyecto: str
    estado_proyecto: str
    anio_convocatoria: Optional[int] = None
    
    @computed_field
    def codigo(self) -> str:
        return self.codigo_proyecto
        
    @computed_field
    def titulo(self) -> str:
        return self.titulo_proyecto
        
    @computed_field
    def convocatoria(self) -> str:
        return str(self.anio_convocatoria or "")
        
    @computed_field
    def estado(self) -> str:
        if self.estado_proyecto == "Formulación":
            return "pending"
        elif self.estado_proyecto == "Concluido":
            return "completed"
        elif self.estado_proyecto == "Cancelado":
            return "cancelled"
        return "active"

    class Config:
        from_attributes = True

class GrupoInvestigacionResponse(GrupoInvestigacionBase):
    id_grupo: int
    created_at: datetime
    miembro_grupo: List[MiembroGrupoResponse] = []
    proyecto: List[ProyectoVinculadoResponse] = []
    coordinador: Optional[InvestigadorSimpleResponse] = None

    @computed_field
    def id(self) -> str:
        return str(self.id_grupo)

    @computed_field
    def code(self) -> str:
        return self.codigo_grupo

    @computed_field
    def name(self) -> str:
        return self.nombre_grupo

    @computed_field
    def acronym(self) -> Optional[str]:
        return self.siglas

    @computed_field
    def description(self) -> Optional[str]:
        return self.descripcion

    @computed_field
    def coordinatorDni(self) -> Optional[str]:
        return self.dni_coordinador

    @computed_field
    def coordinatorName(self) -> Optional[str]:
        if self.coordinador:
            return f"{self.coordinador.nombres} {self.coordinador.apellidos}"
        return None

    @computed_field
    def researchLines(self) -> List[str]:
        return self.lineas_investigacion or []

    @computed_field
    def recognitionDate(self) -> Optional[str]:
        return self.fecha_reconocimiento.isoformat() if self.fecha_reconocimiento else None

    @computed_field
    def status(self) -> str:
        if self.estado_grupo == "Activo":
            return "validado_activo"
        elif self.estado_grupo == "Inactivo":
            return "validado_inactivo"
        return "pendiente_validacion"

    @computed_field
    def fuente(self) -> str:
        return "RAIS" if self.url_vrip else "Manual"

    @computed_field
    def miembros(self) -> List[MiembroGrupoResponse]:
        return self.miembro_grupo

    @computed_field
    def proyectosVinculados(self) -> List[ProyectoVinculadoResponse]:
        return self.proyecto

    class Config:
        from_attributes = True

class UsuarioBase(BaseModel):
    correo_institucional: str
    rol_sistema: str
    estado_cuenta: Optional[bool] = True

class UsuarioCreate(UsuarioBase):
    pass

class UsuarioUpdate(BaseModel):
    correo_institucional: Optional[str] = None
    rol_sistema: Optional[str] = None
    estado_cuenta: Optional[bool] = None

class UsuarioResponse(UsuarioBase):
    id_usuario: Any # UUID
    created_at: datetime
    
    class Config:
        from_attributes = True

class ProyectoBase(BaseModel):
    codigo_proyecto: str
    resolucion_aprobacion: Optional[str] = None
    titulo_proyecto: str
    tipo_proyecto: Optional[str] = None
    tipo_programa: Optional[str] = None
    facultad_proyecto: Optional[str] = 'Ingeniería de Sistemas e Informática'
    presupuesto_asignado: Optional[float] = 0.0
    codigo_grupo: Optional[str] = None
    area_academica: Optional[str] = None
    anio_convocatoria: Optional[int] = None
    fecha_inicio: Optional[date] = None
    fecha_rendicion_35: Optional[date] = None
    fecha_rendicion_70: Optional[date] = None
    fecha_rendicion_100: Optional[date] = None
    fecha_informe_final: Optional[date] = None
    estado_proyecto: Optional[str] = 'Aprobado'
    observaciones: Optional[str] = None

class InvestigadorProyectoProyectoCreate(BaseModel):
    dni_investigador: str
    condicion_rol: str
    tipo_vinculo: Optional[str] = 'Docente'
    facultad_integrante: Optional[str] = 'Ingeniería de Sistemas e Informática'

class ProyectoCreate(ProyectoBase):
    investigadores: Optional[List[InvestigadorProyectoProyectoCreate]] = None

class ProyectoUpdate(BaseModel):
    resolucion_aprobacion: Optional[str] = None
    titulo_proyecto: Optional[str] = None
    tipo_proyecto: Optional[str] = None
    tipo_programa: Optional[str] = None
    anio_convocatoria: Optional[int] = None
    fecha_inicio: Optional[date] = None
    fecha_rendicion_35: Optional[date] = None
    fecha_rendicion_70: Optional[date] = None
    fecha_rendicion_100: Optional[date] = None
    fecha_informe_final: Optional[date] = None
    presupuesto_asignado: Optional[float] = None
    estado_proyecto: Optional[str] = None
    codigo_grupo: Optional[str] = None
    observaciones: Optional[str] = None
    justificacion: Optional[str] = None
    investigadores: Optional[List[InvestigadorProyectoProyectoCreate]] = None

class ProyectoEstadoUpdate(BaseModel):
    estado_proyecto: str
    justificacion: str

class ProyectoResponse(ProyectoBase):
    created_at: datetime
    updated_at: datetime
    is_external: Optional[bool] = False
    
    class Config:
        from_attributes = True

class ConvocatoriaBase(BaseModel):
    resolucion_base: Optional[str] = None
    titulo_convocatoria: str
    entidad_emisora: Optional[str] = 'VRIP-UNMSM'
    presupuesto_maximo: Optional[float] = None
    fecha_inicio_inscripcion: Optional[date] = None
    fecha_cierre: Optional[date] = None
    url_bases_vrip: Optional[str] = None
    estado_convocatoria: Optional[str] = 'Abierta'

class ConvocatoriaCreate(ConvocatoriaBase):
    pass

class ConvocatoriaUpdate(BaseModel):
    estado_convocatoria: Optional[str] = None
    fecha_cierre: Optional[date] = None
    url_bases_vrip: Optional[str] = None

class EvidenciaDifusionBase(BaseModel):
    id_convocatoria: int
    tipo_evidencia: Optional[str] = None
    nombre_archivo: str
    url_archivo: str

class EvidenciaDifusionCreate(EvidenciaDifusionBase):
    pass

class EvidenciaDifusionResponse(EvidenciaDifusionBase):
    id_evidencia: int
    fecha_carga: datetime
    
    class Config:
        from_attributes = True

class ConvocatoriaResponse(ConvocatoriaBase):
    id_convocatoria: int
    created_at: datetime
    evidencias: List[EvidenciaDifusionResponse] = []
    
    class Config:
        from_attributes = True

class EntregableBase(BaseModel):
    codigo_proyecto: str
    tipo_entregable: str
    fecha_limite_programada: Optional[date] = None
    fecha_entrega_real: Optional[date] = None
    estado_entregable: Optional[str] = 'Pendiente'
    archivo_url: Optional[str] = None

class EntregableCreate(EntregableBase):
    pass

class EntregableUpdate(BaseModel):
    fecha_entrega_real: Optional[date] = None
    estado_entregable: Optional[str] = None
    archivo_url: Optional[str] = None

class EntregableResponse(EntregableBase):
    id_entregable: int
    updated_at: datetime
    
    class Config:
        from_attributes = True

class InvestigadorProyectoBase(BaseModel):
    codigo_proyecto: str
    dni_investigador: str
    condicion_rol: str
    tipo_vinculo: Optional[str] = None
    facultad_integrante: Optional[str] = None
    condicion_gi: Optional[str] = None

class InvestigadorProyectoCreate(InvestigadorProyectoBase):
    pass

class InvestigadorProyectoResponse(InvestigadorProyectoBase):
    class Config:
        from_attributes = True

class PublicacionBase(BaseModel):
    doi_codigo: Optional[str] = None
    titulo_articulo: str
    issn: Optional[str] = None
    volumen: Optional[str] = None
    tipo_publicacion: str
    nombre_revista: Optional[str] = None
    nombre_evento: Optional[str] = None
    cuartil_impacto: Optional[str] = None
    indexacion: Optional[str] = None
    fecha_publicacion: Optional[date] = None
    url_documento: Optional[str] = None
    codigo_grupo: Optional[str] = None

class PublicacionCreate(PublicacionBase):
    pass

class PublicacionUpdate(BaseModel):
    doi_codigo: Optional[str] = None
    titulo_articulo: Optional[str] = None
    tipo_publicacion: Optional[str] = None
    nombre_revista: Optional[str] = None
    cuartil_impacto: Optional[str] = None

class PublicacionResponse(PublicacionBase):
    id_publicacion: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class InvestigadorPublicacionBase(BaseModel):
    dni_investigador: str
    id_publicacion: int
    filiacion_unmsm: Optional[bool] = True

class InvestigadorPublicacionCreate(InvestigadorPublicacionBase):
    pass

class InvestigadorPublicacionResponse(InvestigadorPublicacionBase):
    class Config:
        from_attributes = True

class TesisBase(BaseModel):
    url_cybertesis: str
    titulo_tesis: str
    resumen_abstract: Optional[str] = None
    cita_apa: Optional[str] = None
    derechos_licencia: Optional[str] = None
    url_licencia: Optional[str] = None
    formato_archivo: Optional[str] = None
    idioma_iso: Optional[str] = None
    tipo_recurso: Optional[str] = None
    anio_publicacion: Optional[int] = None
    fecha_registro_cybertesis: Optional[datetime] = None
    fecha_disponibilidad: Optional[datetime] = None
    autor_estudiante_texto: str
    dni_tesista: Optional[str] = None
    asesor_texto: str
    dni_asesor: Optional[str] = None
    orcid_asesor: Optional[str] = None
    codigo_disciplina: Optional[str] = None
    nivel_grado: Optional[str] = None
    tipo_trabajo: Optional[str] = None
    escuela_profesional: Optional[str] = None
    grado_obtenido: Optional[str] = None
    institucion_concedente: Optional[str] = None
    editorial: Optional[str] = None
    pais_publicacion: Optional[str] = None
    palabras_clave: Optional[List[Any]] = None
    jurados_evaluadores: Optional[List[Any]] = None

class TesisResponse(TesisBase):
    created_at: datetime
    
    class Config:
        from_attributes = True
