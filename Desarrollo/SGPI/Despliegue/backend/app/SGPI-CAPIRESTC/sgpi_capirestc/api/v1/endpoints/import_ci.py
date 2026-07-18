import os
import sys
import uuid
import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional, Dict

from fastapi import APIRouter, BackgroundTasks, File, UploadFile, HTTPException, status, Depends
from app.core.security import get_current_user

# Importar excepción de cancelación desde el procesador (si está disponible)
try:
    from sgpi_ci.core.processor import ImportCancelledError
except ImportError:
    ImportCancelledError = None

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
# Estado de Jobs en Memoria
# ---------------------------------------------------------------------------
class ImportJobState:
    def __init__(self, job_id: str, filename: str):
        self.job_id     = job_id
        self.filename   = filename
        self.status     = "queued"      # queued | running | completed | failed | stopped
        self.progress   = 0             # 0-100
        self.processed  = 0             
        self.errors     = 0             
        self.created    = 0             
        self.updated    = 0             
        self.error_msg: Optional[str] = None
        self.detalle_conflictos: list = []
        self.api_renacyt_offline = False
        self.en_cuarentena = 0
        self.detalle_sin_dni: list = []
        self.started_at = datetime.now(timezone.utc).isoformat()
        self.finished_at: Optional[str] = None
        # Bandera de cancelación (capa defensiva secundaria para el bucle interno)
        self.cancel_requested: bool = False
        # Detalle de registros guardados por entidad (para el log detallado del frontend)
        self.detalle_extraccion: Dict[str, list] = {}
        # Conteos por entidad: {investigadores: {insertados, actualizados, fallidos}, ...}
        self.resultados_db_detalle: Dict[str, dict] = {}
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
# Diccionario de tasks asyncio activas — permite llamar task.cancel() para
# interrumpir inmediatamente cualquier await en vuelo (HTTP, to_thread, etc.)
_tasks: Dict[str, asyncio.Task] = {}

# Directorio temporal para los archivos subidos
TEMP_DIR = os.path.abspath(os.path.join(current_dir, '..', '..', '..', '..', '..', '..', 'tmp_uploads'))
os.makedirs(TEMP_DIR, exist_ok=True)

# ---------------------------------------------------------------------------
# Tarea en Background
# ---------------------------------------------------------------------------
async def _run_sgpi_ci(job_id: str, file_path: str, id_usuario: Optional[str] = None) -> None:
    """
    Ejecuta el pipeline de SGPI-CI de manera asíncrona usando EtlProcessor.
    Corre como asyncio.Task para que task.cancel() pueda interrumpirla
    inmediatamente en cualquier punto de await (incluyendo llamadas HTTP a RENACYT).
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
        job.finished_at = datetime.now(timezone.utc).isoformat()
        return

    try:
        # EtlProcessor.process() es asíncrono nativo
        processor = EtlProcessor(file_path=file_path, id_usuario=id_usuario)

        def on_progress(msg: str, progress_val: int, processed_count: int = None, error_count: int = None):
            job.add_log(msg, progress_val)
            if processed_count is not None:
                job.processed = processed_count
            if error_count is not None:
                job.errors = error_count
        
        resultado = await processor.process(
            upload_to_db=True,
            on_progress=on_progress,
            is_cancelled=lambda: job.cancel_requested  # capa defensiva secundaria
        )

        if "error" in resultado:
            job.status = "failed"
            job.error_msg = resultado["error"]
            job.add_log(f"Error de procesamiento: {resultado['error']}", job.progress)
        else:
            job.status = "completed"
            job.add_log("Procesamiento finalizado con éxito.", 100)
            
            # Extraer métricas reales de los resultados devueltos por SupabaseUploader
            # Las RPCs ahora retornan {insertados, actualizados, fallidos} con distinción precisa
            db_res = resultado.get("resultados_db", {})
            total_insertados  = 0
            total_actualizados = 0
            for entity, items in db_res.items():
                if isinstance(items, dict):
                    total_insertados   += items.get("insertados",   0)
                    total_actualizados += items.get("actualizados", 0)
                elif isinstance(items, list):
                    # fallback legacy: si por algún motivo llega lista, contar como insertados
                    total_insertados += len(items)

            job.created = total_insertados
            job.updated = total_actualizados
            job.errors  = resultado.get("conflictos_inconsistencias", 0)
            job.processed = sum(resultado.get("entidades_extraidas", {}).values())

            # Guardar detalle de registros guardados para el log detallado del frontend
            job.detalle_extraccion = resultado.get("detalle_extraccion", {})
            # Guardar conteos por entidad para el desglose en el log
            job.resultados_db_detalle = resultado.get("resultados_db", {})

            # Detectar si la API de RENACYT estuvo offline/caída y guardar detalles
            detalle_conflictos = resultado.get("detalle_conflictos", [])
            job.detalle_conflictos = detalle_conflictos
            
            # --- NUEVA LÓGICA: Imprimir errores detallados en el terminal ---
            if detalle_conflictos:
                logger.warning(f"--- DETALLE DE ERRORES ({len(detalle_conflictos)}) EN EL ARCHIVO {job.filename} ---")
                for c in detalle_conflictos:
                    if c.get("tipo") == "ERROR_API_RENACYT":
                        job.api_renacyt_offline = True
                    
                    # Imprimir cada error específico en consola para el usuario
                    tipo_err = c.get('tipo', 'DESCONOCIDO')
                    msg_err = c.get('mensaje', 'Sin detalle')
                    # Extraer algún dato útil de identificación si es posible (ej. título o docente)
                    dato = c.get('dato', {})
                    if isinstance(dato, dict):
                        identificador = dato.get('titulo') or dato.get('titulo_tesis') or dato.get('docente_nombre') or dato.get('nombre_grupo') or str(dato)[:50]
                    else:
                        identificador = str(dato)[:50]
                        
                    logger.warning(f"  -> [OMITIDO] {tipo_err} | Registro: '{identificador}' | Motivo: {msg_err}")
                logger.warning("-----------------------------------------------------------------")
            # -----------------------------------------------------------------

            job.en_cuarentena = resultado.get("en_cuarentena", 0)
            job.detalle_sin_dni = resultado.get("detalle_sin_dni", [])

            logger.info(f"Job {job_id} completado exitosamente: {job.created} creados, {job.errors} errores.")

    except asyncio.CancelledError:
        # Cancelación real vía task.cancel() — interrumpe en el punto exacto del await
        logger.info(f"[ImportCI] Job {job_id} cancelado (asyncio.CancelledError).")
        job.status = "stopped"
        job.add_log("⛔ Importación detenida por el usuario.", job.progress)
        # No re-raise: el finally se ejecutará y limpiará el archivo
    except Exception as e:
        # Verificar si es una cancelación por bandera (capa secundaria del procesador)
        if ImportCancelledError and isinstance(e, ImportCancelledError):
            logger.info(f"[ImportCI] Job {job_id} cancelado por bandera interna.")
            job.status = "stopped"
            job.add_log("⛔ Importación detenida por el usuario.", job.progress)
        else:
            logger.error(f"Excepción en pipeline SGPI-CI: {e}", exc_info=True)
            job.status = "failed"
            job.error_msg = f"Error interno en ETL: {str(e)}"
            job.add_log(f"Error inesperado en importación: {str(e)}", job.progress)
    finally:
        job.finished_at = datetime.now(timezone.utc).isoformat()
        # Limpiar la referencia de la task
        _tasks.pop(job_id, None)
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
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """
    Recibe un archivo Excel, lo guarda en un directorio temporal y lanza
    el conector SGPI-CI (EtlProcessor) como asyncio.Task. Devuelve un job_id.
    Usar asyncio.create_task (en vez de BackgroundTasks) permite cancelar la
    tarea de inmediato con task.cancel(), interrumpiendo incluso llamadas HTTP
    en vuelo al servidor de RENACYT.
    """
    job_id = str(uuid.uuid4())
    filename = file.filename or "archivo_desconocido.xlsx"
    
    file_path = os.path.join(TEMP_DIR, f"{job_id}_{filename}")
    
    # Guardar en disco para que EtlProcessor pueda leerlo usando pd.read_excel
    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())

    _jobs[job_id] = ImportJobState(job_id=job_id, filename=filename)
    
    # Lanzar pipeline como asyncio.Task para poder cancelarlo después
    id_usuario = current_user.get("sub") if current_user else None
    task = asyncio.create_task(_run_sgpi_ci(job_id, file_path, id_usuario))
    _tasks[job_id] = task

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
            "en_cuarentena": job.en_cuarentena,
            "detalle_sin_dni": job.detalle_sin_dni,
            "detalle_extraccion":    job.detalle_extraccion,
            "resultados_db_detalle": job.resultados_db_detalle,
            "detalle_conflictos": job.detalle_conflictos,
        }

    if job.status == "failed" and job.error_msg:
        payload["error"] = job.error_msg

    return {
        "success": True,
        "data": payload,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@router.post(
    "/{job_id}/stop",
    summary="Detener importación en curso",
    description=(
        "Cancela una importación activa inmediatamente. "
        "Llama a task.cancel() para interrumpir cualquier operación en vuelo "
        "(incluyendo llamadas HTTP al servidor RENACYT/CONCYTEC)."
    ),
)
async def stop_import(job_id: str, current_user: dict = Depends(get_current_user)):
    """
    Permite al usuario detener una importación en curso.
    La cancelación es inmediata: interrumpe incluso peticiones HTTP en vuelo.
    """
    job = _jobs.get(job_id)
    task = _tasks.get(job_id)

    if not job:
        raise HTTPException(status_code=404, detail="Job no encontrado.")

    if job.status not in ("queued", "running"):
        return {
            "success": False,
            "message": f"La importación ya finalizó con estado: '{job.status}'. No se puede cancelar.",
            "status": job.status,
        }

    # Marcar bandera (capa defensiva para el bucle interno del procesador)
    job.cancel_requested = True
    job.add_log("🛑 Solicitud de cancelación recibida. Interrumpiendo...", job.progress)
    logger.info(f"[ImportCI] Cancelación solicitada para job {job_id} por usuario.")

    # Cancelar la task de asyncio: esto envía CancelledError en el próximo await,
    # deteniendo también las llamadas HTTP en vuelo a RENACYT.
    if task and not task.done():
        task.cancel()

    return {
        "success": True,
        "message": "Importación cancelada. El procesamiento se ha detenido.",
        "job_id": job_id,
    }
