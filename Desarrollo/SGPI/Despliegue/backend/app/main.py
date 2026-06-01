import os
import sys
import uuid
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from starlette.middleware.base import BaseHTTPMiddleware

# ---------------------------------------------------------------------------
# Paths internos de los módulos SGPI
# ---------------------------------------------------------------------------
sys.path.append(os.path.join(os.path.dirname(__file__), "SGPI-CAPIRESTC"))
sys.path.append(os.path.join(os.path.dirname(__file__), "SGPI-CMR"))
sys.path.append(os.path.join(os.path.dirname(__file__), "SGPI-CRAPI"))
sys.path.append(os.path.join(os.path.dirname(__file__), "SGPI-CMEE"))
sys.path.append(os.path.join(os.path.dirname(__file__), "SGPI-CAPIAC"))

from app.core.config import settings  # noqa: E402
from app.core.logger import setup_logging, correlation_id, logger  # noqa: E402

# Inicializar configuración de logging centralizada
setup_logging()

from app.db.session import engine  # noqa: E402
from sgpi_capirestc.api.v1.api import api_router  # noqa: E402
from sgpi_cmr.api.reconciliation import router as cmr_router  # noqa: E402
from sgpi_crapi.api.v1.api import api_router as crapi_router  # noqa: E402
from sgpi_cmee.api.v1.api import api_router as cmee_router  # noqa: E402
from sgpi_capiac.api.v1.api import api_router as capiac_router  # noqa: E402

# Importar rutas de CMEPDF añadiéndolo temporalmente al sys.path por nombre de carpeta
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "SGPI-CMEPDF"))
from api.routes import router as cmepdf_router  # noqa: E402

sys.path.pop(0)


# ---------------------------------------------------------------------------
# Middleware de Correlation ID para rastreo de peticiones
# ---------------------------------------------------------------------------
class CorrelationIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        corr_id = request.headers.get("X-Correlation-ID")
        if not corr_id:
            corr_id = str(uuid.uuid4())

        token = correlation_id.set(corr_id)
        start_time = time.time()
        logger.info(f"Incoming Request: {request.method} {request.url.path}")

        try:
            response = await call_next(request)
            response.headers["X-Correlation-ID"] = corr_id
            duration = time.time() - start_time
            logger.info(
                f"Request Completed: {request.method} {request.url.path} - "
                f"Status: {response.status_code} - Duration: {duration:.3f}s"
            )
            return response
        except Exception as exc:
            duration = time.time() - start_time
            logger.error(
                f"Request Failed: {request.method} {request.url.path} - "
                f"Exception: {type(exc).__name__}: {str(exc)} - Duration: {duration:.3f}s",
                exc_info=True,
            )
            raise exc
        finally:
            correlation_id.reset(token)


# ---------------------------------------------------------------------------
# Lifespan: gestión del ciclo de vida del motor de base de datos
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Abre/cierra el pool de conexiones junto con la aplicación."""
    # startup
    yield
    # shutdown — libera todas las conexiones del pool
    await engine.dispose()

    # Cerrar pool de Redis
    try:
        from app.core.cache import close_redis

        await close_redis()
    except Exception as exc:
        logger.error(f"Error closing Redis connection on shutdown: {exc}", exc_info=True)


# ---------------------------------------------------------------------------
# Instancia principal de FastAPI
# ---------------------------------------------------------------------------
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url="/api/v1/openapi.json",
    lifespan=lifespan,
)

# Registrar middleware de logs y correlación al principio de la pila
app.add_middleware(CorrelationIdMiddleware)

@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError):
    logger.error(f"Database integrity error: {exc}", exc_info=True)
    exc_str = str(exc).lower()
    if "resolucion_aprobacion" in exc_str or "proyecto_resolucion_aprobacion_key" in exc_str:
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "detail": "Ya existe un proyecto registrado con este número de resolución.",
                "code": "DUPLICATE_RESOLUTION"
            }
        )
    return JSONResponse(
        status_code=400,
        content={
            "success": False,
            "detail": "Error de integridad de datos en el servidor.",
            "code": "INTEGRITY_ERROR"
        }
    )

# ---------------------------------------------------------------------------
# Middleware CORS
# Usa la lista de orígenes definida en config (FRONTEND_ORIGINS en .env).
# En producción asegúrate de que FRONTEND_ORIGINS no incluya "*".
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(api_router, prefix="/api/v1")
# CMR — Central de Mapeo y Reconciliación
app.include_router(
    cmr_router,
    prefix="/api/v1/reconciliation",
    tags=["Reconciliación y Normalización"],
)
# CRAPI — Reportes y Snapshots POI
app.include_router(crapi_router, prefix="/api/v1")
# CMEE — Exportación Excel
app.include_router(cmee_router, prefix="/api/v1")
# CMEPDF — Exportación PDF (el prefix /api/pdf ya viene en su router)
app.include_router(cmepdf_router)
# CAPIAC — Configuración y Auditoría
app.include_router(capiac_router, prefix="/api/v1")


# ---------------------------------------------------------------------------
# Health-check
# Verifica conectividad real con la base de datos.
# ---------------------------------------------------------------------------
@app.get("/health", tags=["Infraestructura"])
async def health_check():
    """
    Retorna el estado del servidor y la conexión a la base de datos.
    - status: "ok" si todo funciona, "degraded" si la BD no responde.
    - database: "connected" | "unreachable"
    - environment: entorno actual ("development" | "production")
    """
    db_status = "unreachable"
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as exc:
        db_status = f"unreachable — {type(exc).__name__}: {exc}"

    overall = "ok" if db_status == "connected" else "degraded"

    return {
        "status": overall,
        "database": db_status,
        "environment": settings.ENVIRONMENT,
        "version": settings.VERSION,
    }
