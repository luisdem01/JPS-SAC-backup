from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime


class ConfiguracionGlobalBase(BaseModel):
    clave: str
    valor: Any
    descripcion: Optional[str] = None


class ConfiguracionGlobalUpdate(BaseModel):
    valor: Any
    descripcion: Optional[str] = None


class ConfiguracionGlobalResponse(ConfiguracionGlobalBase):
    updated_at: datetime

    class Config:
        from_attributes = True


class LogAuditoriaResponse(BaseModel):
    id_log: Any
    tipo_evento: str
    entidad_afectada: Optional[str] = None
    pk_entidad: Optional[str] = None
    valor_anterior: Optional[Any] = None
    valor_nuevo: Optional[Any] = None
    id_usuario: Optional[Any] = None
    ip_origen: Optional[str] = None
    resultado: str
    detalle_error: Optional[str] = None
    timestamp_evento: datetime

    class Config:
        from_attributes = True


class UsuarioBase(BaseModel):
    correo_institucional: str
    rol_sistema: str
    estado_cuenta: Optional[bool] = True
    nombre_completo: Optional[str] = ""


class UsuarioCreate(UsuarioBase):
    pass


class UsuarioUpdate(BaseModel):
    rol_sistema: Optional[str] = None
    estado_cuenta: Optional[bool] = None
    nombre_completo: Optional[str] = None
    correo_institucional: Optional[str] = None
    contrasena: Optional[str] = None


class UsuarioResponse(UsuarioBase):
    id_usuario: Any
    created_at: datetime

    class Config:
        from_attributes = True

class CatalogBase(BaseModel):
    nombre: str
    estado: Optional[str] = "Aprobado"

class CatalogCreate(CatalogBase):
    pass

class CatalogUpdate(BaseModel):
    nombre: Optional[str] = None
    estado: Optional[str] = None

class DepartamentoAcademicoResponse(CatalogBase):
    id: int

    class Config:
        from_attributes = True

class LineaInvestigacionResponse(CatalogBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

