from pydantic import BaseModel
from typing import Optional, List, Tuple, Any


class ExcelSheetDef(BaseModel):
    sheet_name: str
    title: str
    headers: Optional[List[str]] = None
    data: Optional[List[List[Any]]] = None
    metrics: Optional[List[Tuple[str, Any]]] = None
    metrics_title: Optional[str] = "Métrica"
    metrics_value_title: Optional[str] = "Valor"


class ExcelGenerationRequest(BaseModel):
    sheets: List[ExcelSheetDef]
    usuario_generador: str = "Sistema"
