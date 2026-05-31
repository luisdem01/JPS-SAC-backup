from pydantic import BaseModel
from typing import Optional, List

class InvestigadorVinculadoBase(BaseModel):
    investigadorId: str
    rol: str

class GrupoInvestigacionResumen(BaseModel):
    id: int
    nombre: str
    siglas: Optional[str] = None
    facultad: Optional[str] = None

class RegistroProduccionResponse(BaseModel):
    id: str
    tipo: str  # 'articulo' | 'tesis'
    titulo: str
    autores: str
    fecha: str
    fuente: str
    estado: str
    grupoVinculado: Optional[GrupoInvestigacionResumen] = None
    
    # Especifico de articulo
    doi: Optional[str] = None
    issn: Optional[str] = None
    volNum: Optional[str] = None
    revista: Optional[str] = None
    cuartil: Optional[str] = None
    
    # Especifico de tesis
    tipoTesis: Optional[str] = None
    urlCybertesis: Optional[str] = None
    tesista: Optional[str] = None

class ConfirmarPayload(BaseModel):
    id: str
    tipo: str
    doi: Optional[str] = None
    issn: Optional[str] = None
    volNum: Optional[str] = None
    revista: Optional[str] = None
    cuartil: Optional[str] = None
    id_grupo: Optional[int] = None
    investigadoresVinculados: List[InvestigadorVinculadoBase] = []

class ValidarDoiResponse(BaseModel):
    duplicado: bool
    existenteId: Optional[str] = None
