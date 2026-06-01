from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any


class PDFGenerationRequest(BaseModel):
    title: str = Field(..., description="El título principal del reporte o certificado.")
    subtitle: Optional[str] = Field(None, description="El subtítulo secundario del documento.")
    filters_applied: Optional[Dict[str, Any]] = Field(
        None, description="Filtros aplicados en la búsqueda (ej. {'Año': 2026})."
    )
    user_requesting: str = Field(
        "Sistema SGPI", description="Nombre/Identificador del usuario que solicita la descarga (para auditoría)."
    )
    columns: Optional[List[str]] = Field(None, description="Cabeceras de la tabla de datos.")
    data: Optional[List[List[Any]]] = Field(
        None, description="Matriz de datos (filas y celdas) a renderizar en la tabla."
    )
    col_widths: Optional[List[float]] = Field(
        None, description="Ancho de columnas en puntos o pesos porcentuales (ej. [0.2, 0.5, 0.3])."
    )
    doc_type: str = Field("report", description="Tipo de documento a generar: 'report' o 'certificate'.")
