from fastapi import APIRouter
from sgpi_crapi.api.v1.endpoints import reports

api_router = APIRouter()
api_router.include_router(reports.router, prefix="/reports", tags=["Reportes y Snapshots POI"])
