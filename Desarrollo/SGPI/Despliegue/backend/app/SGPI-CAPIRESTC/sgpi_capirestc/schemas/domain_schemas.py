from pydantic import BaseModel
from typing import Optional, List, Dict, Any
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

class InvestigadorCreate(InvestigadorBase):
    pass

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

class InvestigadorResponse(InvestigadorBase):
    tiene_deuda_gi: bool
    tiene_deuda_pi: bool
    created_at: datetime
    updated_at: datetime
    is_external: Optional[bool] = False
    
    class Config:
        from_attributes = True

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
    pass

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

class GrupoInvestigacionResponse(GrupoInvestigacionBase):
    created_at: datetime
    
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

class ProyectoCreate(ProyectoBase):
    pass

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

class ProyectoEstadoUpdate(BaseModel):
    estado_proyecto: str
    justificacion: str

class ProyectoResponse(ProyectoBase):
    created_at: datetime
    updated_at: datetime
    
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

class ConvocatoriaResponse(ConvocatoriaBase):
    id_convocatoria: int
    created_at: datetime
    
    class Config:
        from_attributes = True

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
