from fastapi import APIRouter
from sgpi_cmr.api.reconciliation import router as reconciliation_router

api_router = APIRouter()

api_router.include_router(reconciliation_router, prefix="/reconciliacion", tags=["reconciliacion"])
