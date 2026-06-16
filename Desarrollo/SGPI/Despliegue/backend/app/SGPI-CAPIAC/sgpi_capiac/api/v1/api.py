from fastapi import APIRouter

from sgpi_capiac.api.v1.endpoints import configuracion
from sgpi_capiac.api.v1.endpoints import logs
from sgpi_capiac.api.v1.endpoints import usuarios
from sgpi_capiac.api.v1.endpoints import catalogos

api_router = APIRouter()

api_router.include_router(configuracion.router, prefix="/configuracion", tags=["Configuración Global"])
api_router.include_router(logs.router, prefix="/logs", tags=["Auditoría y Logs"])
api_router.include_router(usuarios.router, prefix="/usuarios", tags=["Gestión de Usuarios"])
api_router.include_router(catalogos.router, prefix="/catalogos", tags=["Catálogos"])
