import os
import sys
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, Dict

from fastapi import APIRouter, BackgroundTasks, File, UploadFile, HTTPException, status, Depends
from app.core.security import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

# ---------------------------------------------------------------------------
# Inyección de dependencias para módulos con guiones en el nombre
# ---------------------------------------------------------------------------
# La carpeta SGPI-CI tiene guiones, por lo que no puede ser importada directamente
# usando la sintaxis estándar (import app.etl.connectors.SGPI-CI...). 
# Añadimos su ruta al PYTHONPATH en tiempo de ejecución.
current_dir = os.path.dirname(os.path.abspath(__file__))
sgpi_ci_path = os.path.abspath(os.path.join(current_dir, '..', '..', '..', '..', '..', 'etl', 'connectors', 'SGPI-CI'))

if sgpi_ci_path not in sys.path:
    sys.path.insert(0, sgpi_ci_path)

try:
    from sgpi_ci.core.processor import EtlProcessor
except ImportError as e:
    logger.error(f"Error importando EtlProcessor de SGPI-CI: {e}")
    EtlProcessor = None

# ---------------------------------------------------------------------------
# Estado de Jobs en Memoria (Simple)
# ---------------------------------------------------------------------------
class ImportJobState:
    def __init__(self, job_id: str, filename: str):
        self.job_id     = job_id
        self.filename   = filename
        self.status     = "queued"      # queued | running | completed | failed
        self.progress   = 0             # 0-100
        self.processed  = 0             
        self.errors     = 0             
        self.created    = 0             
        self.updated    = 0             
        self.error_msg: Optional[str] = None
        self.api_renacyt_offline = False
        self.started_at = datetime.now(timezone.utc).isoformat()
        self.finished_at: Optional[str] = None
        self.logs = [
            {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "message": "Archivo en cola de procesamiento...",
                "progress": 0
            }
        ]

    def add_log(self, message: str, progress: int):
        self.progress = progress
        self.logs.append({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "message": message,
            "progress": progress
        })

_jobs: Dict[str, ImportJobState] = {}

# Directorio temporal para los archivos subidos
TEMP_DIR = os.path.abspath(os.path.join(current_dir, '..', '..', '..', '..', '..', '..', 'tmp_uploads'))
os.makedirs(TEMP_DIR, exist_ok=True)

# ---------------------------------------------------------------------------
# Tarea en Background
# ---------------------------------------------------------------------------
async def _run_sgpi_ci(job_id: str, file_path: str, id_usuario: Optional[str] = None) -> None:
    """
    Ejecuta el pipeline de SGPI-CI de manera asíncrona usando EtlProcessor.
    Como EtlProcessor es síncrono y bloqueante, se corre en un hilo separado
    con asyncio.to_thread para no bloquear el event loop de FastAPI.
    """
    job = _jobs.get(job_id)
    if not job:
        return

    job.status = "running"
    job.add_log("Iniciando procesamiento del archivo...", 10)

    if EtlProcessor is None:
        job.status = "failed"
        job.error_msg = "Módulo SGPI-CI no encontrado o error de importación interna."
        job.add_log("Error: Módulo SGPI-CI no disponible.", 10)
        return

    try:
        # EtlProcessor.process() es asíncrono nativo
        processor = EtlProcessor(file_path=file_path, id_usuario=id_usuario)

        def on_progress(msg: str, progress_val: int):
            job.add_log(msg, progress_val)
        
        resultado = await processor.process(upload_to_db=True, on_progress=on_progress)

        if "error" in resultado:
            job.status = "failed"
            job.error_msg = resultado["error"]
            job.add_log(f"Error de procesamiento: {resultado['error']}", job.progress)
        else:
            job.status = "completed"
            job.add_log("Procesamiento finalizado con éxito.", 100)
            
            # Extraer métricas reales de los resultados devueltos por SupabaseUploader
            # Resultados típicos devuelven la lista de diccionarios insertados
            db_res = resultado.get("resultados_db", {})
            total_inserted = 0
            for entity, items in db_res.items():
                if isinstance(items, list):
                    total_inserted += len(items)
                elif isinstance(items, dict):
                    if "procesados" in items:
                        total_inserted += items.get("procesados", 0)
                    else:
                        # Por si devuelve algo estructurado (created, updated)
                        total_inserted += len(items.get("data", []))

            job.created = total_inserted
            job.errors = resultado.get("conflictos_inconsistencias", 0)
            job.processed = sum(resultado.get("entidades_extraidas", {}).values())

            # Detectar si la API de RENACYT estuvo offline/caída
            detalle_conflictos = resultado.get("detalle_conflictos", [])
            for c in detalle_conflictos:
                if c.get("tipo") == "ERROR_API_RENACYT":
                    job.api_renacyt_offline = True
                    break

            logger.info(f"Job {job_id} completado exitosamente: {job.created} creados, {job.errors} errores.")

    except Exception as e:
        logger.error(f"Excepción en pipeline SGPI-CI: {e}", exc_info=True)
        job.status = "failed"
        job.error_msg = f"Error interno en ETL: {str(e)}"
        job.add_log(f"Error inesperado en importación: {str(e)}", job.progress)
    finally:
        job.finished_at = datetime.now(timezone.utc).isoformat()
        # Limpieza del archivo temporal
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception:
                pass


# ---------------------------------------------------------------------------
# Rutas (Endpoints)
# ---------------------------------------------------------------------------

@router.post(
    "/excel",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Inicia importación ETL con SGPI-CI",
)
async def upload_excel(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """
    Recibe un archivo Excel, lo guarda en un directorio temporal y lanza
    el conector SGPI-CI (EtlProcessor) en background. Devuelve un job_id.
    """
    job_id = str(uuid.uuid4())
    filename = file.filename or "archivo_desconocido.xlsx"
    
    file_path = os.path.join(TEMP_DIR, f"{job_id}_{filename}")
    
    # Guardar en disco para que EtlProcessor pueda leerlo usando pd.read_excel
    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())

    _jobs[job_id] = ImportJobState(job_id=job_id, filename=filename)
    
    # Lanzar pipeline
    id_usuario = current_user.get("sub") if current_user else None
    background_tasks.add_task(_run_sgpi_ci, job_id, file_path, id_usuario)

    return {
        "success": True,
        "data": {"job_id": job_id},
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@router.get(
    "/{job_id}/status",
    summary="Estado de la importación",
)
async def get_import_status(job_id: str):
    """
    Endpoint para polling desde React (useAsyncJob). Devuelve el estado actual.
    """
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job no encontrado")

    payload = {
        "status":    job.status,
        "progress":  job.progress,
        "processed": job.processed,
        "errors":    job.errors,
        "logs":      job.logs,
    }

    if job.status == "completed":
        payload["summary"] = {
            "created":  job.created,
            "updated":  job.updated,
            "errors":   job.errors,
            "api_renacyt_offline": job.api_renacyt_offline,
        }

    if job.status == "failed" and job.error_msg:
        payload["error"] = job.error_msg

    return {
        "success": True,
        "data": payload,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
