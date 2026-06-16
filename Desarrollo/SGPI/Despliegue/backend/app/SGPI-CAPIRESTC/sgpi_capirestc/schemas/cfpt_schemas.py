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

class InvestigadorResumen(BaseModel):
    id: str
    nombre: str
    dni: str
    departamento: str
    grupo: Optional[str] = None

class InvestigadorVinculado(BaseModel):
    investigador: InvestigadorResumen
    rol: str

class RegistroProduccionResponse(BaseModel):
    id: str
    tipo: str  # 'articulo' | 'tesis'
    titulo: str
    autores: str
    fecha: str
    fuente: str
    estado: str
    isExternal: Optional[bool] = False
    grupoVinculado: Optional[GrupoInvestigacionResumen] = None
    investigadoresVinculados: List[InvestigadorVinculado] = []
    
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
