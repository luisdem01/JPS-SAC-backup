from pydantic import BaseModel, Field, validator
from typing import Optional, List

class InvestigadorModel(BaseModel):
    dni: str = Field(..., min_length=8, max_length=15)
    nombres: str = Field(...)
    apellidos: str = Field(...)
    condicion_laboral: Optional[str] = Field("No Especificado")
    departamento_academico: Optional[str] = Field("No Especificado")
    grado_academico_max: Optional[str] = Field(None)
    institucion_principal: Optional[str] = Field(None)
    codigo_renacyt: Optional[str] = Field(None)
    orcid: Optional[str] = Field(None)
    categoria_renacyt: Optional[str] = Field("No Clasificado")
    estado_renacyt: Optional[str] = Field(None)
    url_cti_vitae: Optional[str] = Field(None)
    investigador_sm: bool = Field(False)
    estado_vigencia: str = Field("Activo")
    
    @validator('dni')
    def validar_dni(cls, v):
        if not v.isalnum():
            raise ValueError("El DNI debe ser alfanumérico")
        return v

class ProyectoModel(BaseModel):
    codigo_proyecto: str = Field(...)
    resolucion_aprobacion: Optional[str] = Field(None)
    titulo_proyecto: str = Field(...)
    tipo_programa: Optional[str] = Field(None)
    anio_convocatoria: Optional[int] = Field(None)
    id_grupos: List[int] = Field(default_factory=list)
    docentes: List[dict] = Field(default_factory=list) # [{'dni': '...', 'condicion_rol': '...'}]

class PublicacionModel(BaseModel):
    titulo_articulo: str = Field(...)
    nombre_revista: Optional[str] = Field(None)
    doi_codigo: Optional[str] = Field(None)
    indexacion: Optional[str] = Field(None)
    tipo_publicacion: str = Field(...)
    nombre_evento: Optional[str] = Field(None)
    id_grupos: List[int] = Field(default_factory=list)
    dni_autor: str = Field(...)

class TesisModel(BaseModel):
    titulo_tesis: str = Field(...)
    autor_estudiante_texto: str = Field(...)
    asesor_texto: str = Field(...)
    dni_asesor: str = Field(...)

class GrupoInvestigacionModel(BaseModel):
    codigo_grupo: Optional[str] = Field(None)
    nombre_grupo: str = Field(...)
    siglas: Optional[str] = Field(None)
    correo_coordinador: Optional[str] = Field(None)
    dni_coordinador: Optional[str] = Field(None)
    lineas_investigacion: List[str] = Field(default_factory=list)
    miembros: List[dict] = Field(default_factory=list) # [{'dni': '...', 'condicion_miembro': '...'}]
