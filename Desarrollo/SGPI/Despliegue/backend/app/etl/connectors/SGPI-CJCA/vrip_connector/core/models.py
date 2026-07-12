from pydantic import BaseModel, Field
from typing import Optional, List


class ConvocatoriaModel(BaseModel):
    titulo: str = Field(..., description="Nombre del programa de financiamiento o concurso")
    entidad_promotora: str = Field("Vicerrectorado de Investigación y Posgrado (VRIP) - UNMSM")
    fecha_publicacion: Optional[str] = Field(None, description="Fecha de publicación original del post o anuncio")
    plazo_cierre: Optional[str] = Field(None, description="Fecha de finalización parseada en formato YYYY-MM-DD")
    plazo_cierre_original: str = Field(..., description="Texto original de la fecha de cierre obtenido de la web")
    enlace: str = Field(..., description="Link de descarga directa de directivas/bases o convocatoria")
    dias_restantes: Optional[int] = Field(None, description="Días hasta el cierre respecto a la fecha actual")
    fecha_inicio: Optional[str] = Field(None, description="Fecha de inicio parseada en formato YYYY-MM-DD")
    cronograma_detallado: Optional[List[dict]] = Field(None, description="Cronograma detallado de actividades")


class ProyectoModel(BaseModel):
    codigo_proyecto: Optional[str] = Field(None, description="Código único de proyecto (ej. F2601XX)")
    codigo_programa: str = Field(..., description="Código infiriendo el programa (PCONFIGI, PMULTI, PINVPOS, etc.)")
    titulo: str = Field(..., description="Detalle del proyecto o título de la publicación")
    responsable: str = Field(..., description="Investigador principal")
    coinvestigadores: List[str] = Field(default_factory=list, description="Lista de co-investigadores")
    facultad: str = Field("FISI", description="Facultad a la que pertenece el proyecto")
    monto_financiado: Optional[float] = Field(None, description="Presupuesto aprobado")
    numero_resolucion: Optional[str] = Field(None, description="Número de Resolución Rectoral (ej. 014353-2025-R)")
    fecha_aprobacion: Optional[str] = Field(
        None, description="Fecha de emisión/aprobación de la Resolución (YYYY-MM-DD)"
    )
    anio_academico: int = Field(..., description="Año académico del proyecto")
    enlace_vrip: str = Field(..., description="Enlace al post oficial en el VRIP")
    resumen_post: Optional[str] = Field(None, description="Resumen breve o extracto del contenido del post")


class TesisModel(BaseModel):
    titulo: str = Field(..., description="Título oficial de la tesis de pregrado/posgrado")
    autores: str = Field(..., description="Nombres completos de los tesistas")
    anio_publicacion: int = Field(..., description="Año de sustentación/publicación")
    enlace_handle: str = Field(..., description="Identificador único Handle en el repositorio nacional o Cybertesis")
