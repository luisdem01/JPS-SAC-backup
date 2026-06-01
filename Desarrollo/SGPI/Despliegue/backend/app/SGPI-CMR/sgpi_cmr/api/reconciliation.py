from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from typing import Optional
import os
import sys

current_dir = os.path.dirname(os.path.abspath(__file__))
csapiren_path = os.path.abspath(os.path.join(current_dir, '..', '..', 'etl', 'connectors', 'SGPI-CSAPIREN'))
if csapiren_path not in sys.path:
    sys.path.insert(0, csapiren_path)

try:
    from renacyt_connector.api import RenacytConnector
except ImportError:
    RenacytConnector = None

from app.db.session import get_db
from app.core.security import require_staff
from app.models.domain import Investigador, Proyecto, Publicacion, ReconciliacionPendiente
from sgpi_cmr.schemas.incoming import BulkInvestigadorPayload, BulkProyectoPayload, BulkPublicacionPayload, BulkAsesorTesisPayload, AsesorTesisInput
from sgpi_cmr.services.rules_engine import rules_engine
from sgpi_cmr.services.persister import persister

router = APIRouter()

@router.post("/bulk/investigators", summary="Reconciliar investigadores en bulk", status_code=status.HTTP_202_ACCEPTED)
async def reconcile_investigadores_bulk(
    payload: BulkInvestigadorPayload, 
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_staff)
):
    fuente = payload.fuente_origen
    stats = {"procesados": 0, "resueltos": 0, "cuarentena": 0}
    
    for registro in payload.registros:
        stats["procesados"] += 1
        
        # Leer de DB
        res = await db.execute(select(Investigador).where(Investigador.dni == registro.dni))
        existing_obj = res.scalars().first()
        current_db = existing_obj.__dict__ if existing_obj else None
        # Remove SQLAlchemy internal state
        if current_db and '_sa_instance_state' in current_db:
            del current_db['_sa_instance_state']
        
        merged, requires_quarantine, reason = rules_engine.reconcile_investigador(current_db, registro, fuente)
        
        if requires_quarantine:
            stats["cuarentena"] += 1
            await persister.persist_quarantine(
                db, entidad="investigador", llave_sugerida=registro.dni, 
                fuentes=[fuente], conflicto=merged, motivo=reason
            )
        else:
            stats["resueltos"] += 1
            await persister.persist_resolved(
                db, entidad="investigador", llave_pk=registro.dni, 
                merged_data=merged, fuente_ganadora=fuente
            )
            
    return {"message": "Lote de investigadores procesado", "stats": stats}


@router.post("/bulk/projects", summary="Reconciliar proyectos en bulk", status_code=status.HTTP_202_ACCEPTED)
async def reconcile_proyectos_bulk(
    payload: BulkProyectoPayload, 
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_staff)
):
    fuente = payload.fuente_origen
    stats = {"procesados": 0, "resueltos": 0, "cuarentena": 0}
    
    for registro in payload.registros:
        stats["procesados"] += 1
        
        res = await db.execute(select(Proyecto).where(Proyecto.codigo_proyecto == registro.codigo_proyecto))
        existing_obj = res.scalars().first()
        current_db = existing_obj.__dict__ if existing_obj else None
        if current_db and '_sa_instance_state' in current_db:
            del current_db['_sa_instance_state']
            
        merged, requires_quarantine, reason = rules_engine.reconcile_proyecto(current_db, registro, fuente)
        
        if requires_quarantine:
            stats["cuarentena"] += 1
            await persister.persist_quarantine(
                db, entidad="proyecto", llave_sugerida=registro.codigo_proyecto, 
                fuentes=[fuente], conflicto=merged, motivo=reason
            )
        else:
            stats["resueltos"] += 1
            await persister.persist_resolved(
                db, entidad="proyecto", llave_pk=registro.codigo_proyecto, 
                merged_data=merged, fuente_ganadora=fuente
            )
            
    return {"message": "Lote de proyectos procesado", "stats": stats}


@router.post("/bulk/publications", summary="Reconciliar publicaciones en bulk", status_code=status.HTTP_202_ACCEPTED)
async def reconcile_publicaciones_bulk(
    payload: BulkPublicacionPayload, 
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_staff)
):
    fuente = payload.fuente_origen
    stats = {"procesados": 0, "resueltos": 0, "cuarentena": 0}
    
    for registro in payload.registros:
        stats["procesados"] += 1
        
        # Buscar por DOI si existe, sino por Título
        stmt = select(Publicacion)
        if registro.doi_codigo:
            stmt = stmt.where(Publicacion.doi_codigo == registro.doi_codigo)
        else:
            stmt = stmt.where(Publicacion.titulo_articulo.ilike(f"%{registro.titulo_articulo}%"))
            
        res = await db.execute(stmt)
        existing_obj = res.scalars().first()
        current_db = existing_obj.__dict__ if existing_obj else None
        if current_db and '_sa_instance_state' in current_db:
            del current_db['_sa_instance_state']
            
        merged, requires_quarantine, reason = rules_engine.reconcile_publicacion(current_db, registro, fuente)
        llave = registro.doi_codigo if registro.doi_codigo else "NEW"
        
        if requires_quarantine:
            stats["cuarentena"] += 1
            await persister.persist_quarantine(
                db, entidad="publicacion", llave_sugerida=llave, 
                fuentes=[fuente], conflicto=merged, motivo=reason
            )
        else:
            stats["resueltos"] += 1
            await persister.persist_resolved(
                db, entidad="publicacion", llave_pk=llave, 
                merged_data=merged, fuente_ganadora=fuente
            )
            
    return {"message": "Lote de publicaciones procesado", "stats": stats}


@router.post("/bulk/theses_advisors", summary="Reconciliar asesores de tesis (Cybertesis)", status_code=status.HTTP_202_ACCEPTED)
async def reconcile_asesores_tesis(
    payload: BulkAsesorTesisPayload, 
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_staff)
):
    fuente = payload.fuente_origen
    stats = {"procesados": 0, "resueltos": 0, "cuarentena": 0}
    
    # Pre-cargar padrón de investigadores para Fuzzy Matching
    res_inv = await db.execute(select(Investigador.dni, Investigador.nombres, Investigador.apellidos))
    padron = {row.dni: f"{row.nombres} {row.apellidos}" for row in res_inv.all()}
    
    # Crear un único cliente RenacytConnector para reutilizar en el bucle
    renacyt_client = None
    if RenacytConnector:
        try:
            renacyt_client = RenacytConnector(verify_ssl=False)
            renacyt_client.rate_limit_delay = 0.1
        except Exception:
            pass

    for registro in payload.registros:
        stats["procesados"] += 1
        
        merged, requires_quarantine, reason = await rules_engine.reconcile_asesor_tesis(padron, registro, renacyt_client)
        
        if requires_quarantine:
            stats["cuarentena"] += 1
            await persister.persist_quarantine(
                db, entidad="tesis", llave_sugerida=registro.url_cybertesis, 
                fuentes=[fuente], conflicto=merged, motivo=reason
            )
        else:
            stats["resueltos"] += 1
            await persister.persist_resolved(
                db, entidad="tesis", llave_pk=registro.url_cybertesis, 
                merged_data=merged, fuente_ganadora=fuente
            )
            
    return {"message": "Lote de tesis procesado", "stats": stats}


# ==========================================
# ENDPOINTS DE ADMINISTRACIÓN (CUARENTENA)
# ==========================================

@router.get("/quarantine", summary="Obtener registros en cuarentena")
async def get_quarantine_items(
    estado: str = "Pendiente",
    entidad: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_staff)
):
    stmt = select(ReconciliacionPendiente)
    if estado != "todos":
        stmt = stmt.where(ReconciliacionPendiente.estado == estado)
    if entidad:
        stmt = stmt.where(ReconciliacionPendiente.entidad_afectada == entidad)
        
    result = await db.execute(stmt)
    items = result.scalars().all()
    
    return [
        {
            "id_pendiente": item.id_pendiente,
            "entidad_afectada": item.entidad_afectada,
            "llave_primaria_sugerida": item.llave_primaria_sugerida,
            "fuentes_involucradas": item.fuentes_involucradas,
            "datos_conflicto": item.datos_conflicto,
            "motivo_cuarentena": item.motivo_cuarentena,
            "estado": item.estado,
            "fecha_registro": item.fecha_registro
        }
        for item in items
    ]

@router.post("/quarantine/{id_pendiente}/resolve", summary="Resolver un item de cuarentena")
async def resolve_quarantine_item(
    id_pendiente: int, 
    action: str, 
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_staff)
):
    if action not in ["aprobar", "rechazar"]:
        raise HTTPException(status_code=400, detail="Acción inválida. Usa 'aprobar' o 'rechazar'.")
        
    try:
        await persister.resolve_quarantine_item(db, id_pendiente, action)
        return {"message": f"Item {id_pendiente} fue {action}do con éxito."}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def run_retry_advisors_background(db_session_factory, user_id: str):
    import logging
    logger = logging.getLogger("sgpi_cmr.retry_advisors")
    logger.info("Iniciando tarea en background para re-intento de matching de asesores en cuarentena...")
    
    # Abrir sesión de base de datos
    async with db_session_factory() as db:
        try:
            # Obtener registros pendientes que tengan que ver con el match de asesor
            stmt = select(ReconciliacionPendiente).where(
                ReconciliacionPendiente.estado == 'Pendiente',
                ReconciliacionPendiente.entidad_afectada == 'tesis'
            )
            res = await db.execute(stmt)
            pendientes = res.scalars().all()
            
            if not pendientes:
                logger.info("No se encontraron registros de tesis en cuarentena pendientes.")
                return
            
            # Pre-cargar padrón
            res_inv = await db.execute(select(Investigador.dni, Investigador.nombres, Investigador.apellidos))
            padron = {row.dni: f"{row.nombres} {row.apellidos}" for row in res_inv.all()}
            
            # Instanciar conector único
            renacyt_client = None
            if RenacytConnector:
                try:
                    renacyt_client = RenacytConnector(verify_ssl=False)
                    renacyt_client.rate_limit_delay = 0.3
                except Exception as ex:
                    logger.error(f"Error instanciando RenacytConnector: {ex}")
            
            stats = {"intentados": 0, "resueltos": 0, "rechazados": 0, "errores": 0}
            
            for item in pendientes:
                stats["intentados"] += 1
                datos = item.datos_conflicto
                
                if not isinstance(datos, dict) or "asesor_texto" not in datos:
                    continue
                
                try:
                    registro_input = AsesorTesisInput(
                        asesor_texto=datos.get("asesor_texto"),
                        url_cybertesis=item.llave_primaria_sugerida,
                        titulo_tesis=datos.get("titulo_tesis", "Sin Título"),
                        dni_asesor=datos.get("dni_asesor"),
                        autor_estudiante_texto=datos.get("autor_estudiante_texto")
                    )
                    
                    merged, requires_quarantine, reason = await rules_engine.reconcile_asesor_tesis(padron, registro_input, renacyt_client)
                    
                    if not requires_quarantine:
                        # Resuelto exitosamente! Persistir en la BD principal
                        await persister.persist_resolved(
                            db, entidad="tesis", llave_pk=item.llave_primaria_sugerida,
                            merged_data=merged, fuente_ganadora="Re-intento Masivo RENACYT"
                        )
                        item.estado = 'Aprobado'
                        item.fecha_revision = func.now()
                        db.add(item)
                        stats["resueltos"] += 1
                    else:
                        # Si falló, pero el motivo indica que se rechaza porque no pertenece a la FISI
                        if reason and reason.startswith("Rechazado"):
                            item.estado = 'Rechazado'
                            item.motivo_cuarentena = reason
                            item.fecha_revision = func.now()
                            db.add(item)
                            stats["rechazados"] += 1
                except Exception as ex:
                    logger.error(f"Error procesando item {item.id_pendiente}: {ex}")
                    stats["errores"] += 1
            
            await db.commit()
            logger.info(f"Tarea en background finalizada con éxito. Stats: {stats}")
            
            # Registrar log de auditoría
            from app.models.domain import LogAuditoria
            log = LogAuditoria(
                tipo_evento='SYNC_CYBERTESIS',
                entidad_afectada='reconciliacion_pendientes',
                pk_entidad='RETRY_ADVISORS',
                valor_nuevo={"stats": stats},
                resultado='Exito',
                detalle_error=f"Re-intento de asesores completado. Resueltos: {stats['resueltos']}, Rechazados: {stats['rechazados']}"
            )
            db.add(log)
            await db.commit()
            
        except Exception as e:
            logger.error(f"Error crítico en la tarea en background: {e}", exc_info=True)


@router.post("/quarantine/retry-advisors", summary="Re-procesar asesores de tesis en cuarentena en segundo plano", status_code=status.HTTP_202_ACCEPTED)
async def retry_quarantine_advisors(
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_staff)
):
    from app.db.session import AsyncSessionLocal
    user_id = current_user.get("id_usuario") if isinstance(current_user, dict) else None
    
    background_tasks.add_task(run_retry_advisors_background, AsyncSessionLocal, str(user_id) if user_id else None)
    
    return {
        "message": "Re-intento masivo de matching de asesores iniciado en segundo plano.",
        "status": "Running"
    }
