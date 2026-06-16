from fastapi import APIRouter
from sgpi_cmee.api.v1.endpoints import exports

api_router = APIRouter()
api_router.include_router(exports.router, prefix="/reports", tags=["Exportación Excel CMEE"])
