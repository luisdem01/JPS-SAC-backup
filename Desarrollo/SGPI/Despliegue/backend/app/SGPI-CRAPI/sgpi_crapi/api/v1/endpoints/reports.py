from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Any, Dict
from sqlalchemy import select
from app.models.domain import Investigador, GrupoInvestigacion

from app.db.session import get_db
from app.core.security import require_staff
from app.core.audit import log_audit_event
from sgpi_crapi.schemas.report_schemas import (
    ReportParams,
    SnapshotPOICreate,
    SnapshotPOISummary,
    SnapshotPOIResponse
)
from sgpi_crapi.services.report_service import generate_report_dispatched
from sgpi_crapi.crud.crud_snapshot import snapshot_poi

router = APIRouter()

@router.post("/generate", response_model=Any)
async def generate_report(
    params: ReportParams,
    db: AsyncSession = Depends(get_db)
):
    """
    Genera un reporte en tiempo real sin guardarlo como Snapshot.
    (El schema de respuesta varía según params.tipo_reporte)
    """
    try:
        report_data = await generate_report_dispatched(db, params)
        return report_data
    except NotImplementedError as e:
        raise HTTPException(status_code=501, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/snapshot", response_model=SnapshotPOIResponse)
async def snapshot_report(
    params: ReportParams,
    db: AsyncSession = Depends(get_db)
):
    """
    Genera un reporte y guarda un Snapshot inmutable para el POI.
    """
    if not params.periodo_corte:
        raise HTTPException(status_code=400, detail="El periodo de corte es obligatorio para generar un Snapshot POI.")
        
    try:
        report_data = await generate_report_dispatched(db, params)
    except NotImplementedError as e:
        raise HTTPException(status_code=501, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    # Crear objeto de Snapshot inmutable
    snapshot_in = SnapshotPOICreate(
        periodo_corte=params.periodo_corte,
        tipo_reporte=params.tipo_reporte,
        id_usuario_emisor=None,
        parametros_aplicados=params.model_dump(mode='json'),
        datos_serializados=report_data.model_dump(mode='json') if hasattr(report_data, 'model_dump') else report_data
    )
    
    db_snapshot = await snapshot_poi.create(db, obj_in=snapshot_in)
    
    # Registrar evento de auditoría
    await log_audit_event(
        db=db,
        tipo_evento="SNAPSHOT_GENERADO",
        entidad_afectada="snapshot_poi",
        pk_entidad=str(db_snapshot.id_snapshot),
        valor_nuevo=snapshot_in.model_dump(mode='json'),
        id_usuario=None,
    )
    
    return db_snapshot


@router.get("/snapshots", response_model=List[SnapshotPOISummary])
async def list_snapshots(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_staff)
):
    """
    Obtiene la lista de Snapshots POI históricos generados (Solo metadata).
    """
    # Al definir response_model=List[SnapshotPOISummary], FastAPI excluirá el campo datos_serializados.
    return await snapshot_poi.get_multi(db, skip=skip, limit=limit)

@router.get("/snapshot/{id_snapshot}", response_model=SnapshotPOIResponse)
async def get_snapshot_detail(
    id_snapshot: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_staff)
):
    """
    Obtiene el detalle completo de un Snapshot incluyendo el payload serializado.
    """
    snap = await snapshot_poi.get(db, id=id_snapshot)
    if not snap:
        raise HTTPException(status_code=404, detail="Snapshot no encontrado")

    # Registrar acceso a datos sensibles (trazabilidad TS-14-01)
    await log_audit_event(
        db=db,
        tipo_evento="EXPORT_REPORT",
        entidad_afectada="snapshot_poi",
        pk_entidad=str(snap.id_snapshot),
        valor_nuevo={"accion": "Lectura completa de payload inmutable"},
        id_usuario=current_user.get("sub"),
    )

    return snap

@router.get("/catalogs", response_model=Dict[str, List[str]])
async def get_catalogs(
    db: AsyncSession = Depends(get_db)
):
    """
    Obtiene los catálogos dinámicos para los filtros del reporte (Departamentos y Grupos).
    """
    # Fetch distinct departments
    dept_stmt = select(Investigador.departamento_academico).filter(Investigador.departamento_academico.isnot(None)).distinct()
    dept_result = await db.execute(dept_stmt)
    
    seen_depts = set()
    departamentos = []
    for row in dept_result.all():
        name = row[0].strip()
        if name and name.lower() not in seen_depts:
            seen_depts.add(name.lower())
            departamentos.append(name)
    
    # Fetch all group names
    group_stmt = select(GrupoInvestigacion.nombre_grupo).filter(GrupoInvestigacion.nombre_grupo.isnot(None))
    group_result = await db.execute(group_stmt)
    
    seen_groups = set()
    grupos = []
    for row in group_result.all():
        name = row[0].strip()
        if name and name.lower() not in seen_groups:
            seen_groups.add(name.lower())
            grupos.append(name)
    
    return {
        "departamentos": sorted(departamentos),
        "grupos": sorted(grupos)
    }

