from fastapi import APIRouter

from sgpi_capirestc.api.v1.endpoints import investigators
from sgpi_capirestc.api.v1.endpoints import groups
from sgpi_capirestc.api.v1.endpoints import projects
from sgpi_capirestc.api.v1.endpoints import calls
from sgpi_capirestc.api.v1.endpoints import users
from sgpi_capirestc.api.v1.endpoints import publications
from sgpi_capirestc.api.v1.endpoints import theses
from sgpi_capirestc.api.v1.endpoints import search
from sgpi_capirestc.api.v1.endpoints import import_ci
from sgpi_capirestc.api.v1.endpoints import sync
from sgpi_capirestc.api.v1.endpoints import cfpt

api_router = APIRouter()

api_router.include_router(investigators.router, prefix="/investigators", tags=["Investigadores"])
api_router.include_router(groups.router, prefix="/groups", tags=["Grupos de Investigación"])
api_router.include_router(projects.router, prefix="/projects", tags=["Proyectos"])
api_router.include_router(calls.router, prefix="/calls", tags=["Convocatorias"])
api_router.include_router(users.router, prefix="/users", tags=["Usuarios"])
api_router.include_router(publications.router, prefix="/publications", tags=["Publicaciones"])
api_router.include_router(theses.router, prefix="/theses", tags=["Tesis"])
api_router.include_router(search.router, prefix="/search", tags=["Búsqueda Global"])
api_router.include_router(import_ci.router, prefix="/import", tags=["Importación de Datos SGPI-CI"])
api_router.include_router(sync.router, prefix="/sync", tags=["Sincronización Global"])
api_router.include_router(cfpt.router, prefix="/cfpt", tags=["CFPT - Gestión de Producción"])
