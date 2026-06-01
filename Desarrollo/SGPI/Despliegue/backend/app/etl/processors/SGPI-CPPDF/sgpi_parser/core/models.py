from typing import List, Optional, Literal
from pydantic import BaseModel, Field

# --- RESOLUCIONES RECTORALES ---


class Integrante(BaseModel):
    codigo_miembro: Optional[str] = Field(None, description="Código único del docente o miembro")
    nombre_completo: str = Field(..., description="Nombre y apellidos del integrante")
    tipo_miembro: Optional[str] = Field(None, description="Ej. DOCENTE PERMANENTE, ESTUDIANTE, etc.")
    rol_proyecto: Optional[str] = Field(
        None, description="Rol del integrante en el proyecto (ej. Responsable, Miembro, Co-investigador)"
    )
    facultad: Optional[str] = Field(None, description="Facultad a la que pertenece el integrante")
    gi_codigo: Optional[str] = Field(None, description="Código del Grupo de Investigación al que pertenece")
    gi_condicion: Optional[str] = Field(None, description="Condición en el GI (ej. Titular, Adherente)")


class ProyectoRR(BaseModel):
    codigo_proyecto: str = Field(..., description="Código único del proyecto de investigación")
    titulo: str = Field(..., description="Título del proyecto")
    presupuesto: Optional[float] = Field(None, description="Monto de presupuesto asignado")
    nombre_gi: Optional[str] = Field(None, description="Nombre o siglas del Grupo de Investigación")
    integrantes: List[Integrante] = Field(
        default_factory=list, description="Lista de miembros participantes en el proyecto"
    )


class MetadataRR(BaseModel):
    numero_resolucion: str = Field(..., description="Número de resolución rectoral (ej. RR_008249-2025-R)")
    fecha_emision: Optional[str] = Field(None, description="Fecha de emisión del documento")
    anio_academico: int = Field(..., description="Año académico al que pertenece la resolución")
    area: Optional[str] = Field(None, description="Área del conocimiento (ej. Ciencias de la Salud, Ingenierías)")
    facultad: Optional[str] = Field(None, description="Facultad del concurso (ej. FISI)")


class ResolucionRectoral(BaseModel):
    tipo_documento: Literal["resolucion_rectoral"] = "resolucion_rectoral"
    metadata: MetadataRR
    proyectos: List[ProyectoRR] = Field(default_factory=list)


# --- CRONOGRAMAS ---


class ActividadCronograma(BaseModel):
    actividad: str = Field(..., description="Descripción de la actividad o fase")
    dependencia_responsable: Optional[str] = Field(None, description="Entidad o rol encargado de la actividad")
    fecha_detalle: str = Field(
        ..., description="Detalle textual original de la fecha o rango (ej. 'Del 20 al 27 de noviembre 2025')"
    )
    fecha_inicio: Optional[str] = Field(None, description="Fecha de inicio calculada en formato YYYY-MM-DD")
    fecha_fin: Optional[str] = Field(None, description="Fecha de fin calculada en formato YYYY-MM-DD")


class MetadataCronograma(BaseModel):
    programa_nombre: str = Field(..., description="Nombre del programa de investigación / convocatoria")
    anio_academico: int = Field(..., description="Año académico de la convocatoria")


class Cronograma(BaseModel):
    tipo_documento: Literal["cronograma"] = "cronograma"
    metadata: MetadataCronograma
    actividades: List[ActividadCronograma] = Field(default_factory=list)


# --- RESULTADOS DE CONCURSOS ---


class ProyectoAprobado(BaseModel):
    orden_merito: Optional[int] = Field(None, description="Puesto u orden de mérito obtenido")
    titulo: str = Field(..., description="Título del proyecto aprobado")
    codigo_proyecto: Optional[str] = Field(None, description="Código asignado al proyecto (si existe)")
    nombre_gi: Optional[str] = Field(None, description="Nombre o siglas del Grupo de Investigación")
    responsable: Optional[str] = Field(None, description="Nombre completo del investigador responsable")
    facultad: Optional[str] = Field(None, description="Facultad de origen")
    puntaje: Optional[float] = Field(None, description="Puntaje de evaluación final")


class MetadataResultados(BaseModel):
    programa_nombre: str = Field(..., description="Nombre de la convocatoria o concurso")
    anio_academico: int = Field(..., description="Año académico evaluado")


class ResultadosConcurso(BaseModel):
    tipo_documento: Literal["resultados"] = "resultados"
    metadata: MetadataResultados
    proyectos_aprobados: List[ProyectoAprobado] = Field(default_factory=list)
