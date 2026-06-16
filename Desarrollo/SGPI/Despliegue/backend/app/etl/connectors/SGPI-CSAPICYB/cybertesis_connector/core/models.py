from typing import Optional, List
from pydantic import BaseModel, Field, HttpUrl


class TesisModel(BaseModel):
    id_handle: str = Field(..., description="Handle único de la tesis en el repositorio, ej: 20.500.12672/18413")
    titulo: str = Field(..., description="Título completo de la tesis académica")
    autores: List[str] = Field(default_factory=list, description="Lista de tesistas / autores (nombres normalizados)")
    asesores: List[str] = Field(
        default_factory=list, description="Lista de asesores de tesis oficiales detectados en metadatos"
    )
    anio_publicacion: int = Field(..., description="Año en que fue emitida/sustentada la tesis")
    fecha_sustentacion: Optional[str] = Field(None, description="Fecha de publicación o emisión en formato YYYY-MM-DD")
    grado_academico: str = Field("Título Profesional", description="Tipo de grado (Licenciatura, Maestría, Doctorado)")
    resumen: Optional[str] = Field(None, description="Resumen o Abstract textual de la investigación")
    palabras_clave: List[str] = Field(default_factory=list, description="Palabras clave o áreas temáticas asociadas")
    url_repositorio: HttpUrl = Field(..., description="Enlace web directo a la tesis en el repositorio oficial")
    publisher: str = Field("Universidad Nacional Mayor de San Marcos", description="Entidad publicadora de la tesis")


class QueryResultsModel(BaseModel):
    tipo_documento: str = Field("tesis_academica", description="Tipo del documento estructurado")
    query: str = Field(..., description="Término de búsqueda consultado")
    total_encontrados: int = Field(..., description="Cantidad total de tesis encontradas en el repositorio")
    paginas_procesadas: int = Field(..., description="Cantidad de páginas de resultados parseadas")
    resultados: List[TesisModel] = Field(
        default_factory=list, description="Colección de tesis validadas y estructuradas extraídas"
    )
