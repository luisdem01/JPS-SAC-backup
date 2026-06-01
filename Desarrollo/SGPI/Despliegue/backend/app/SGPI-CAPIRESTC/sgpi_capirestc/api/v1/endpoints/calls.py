from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.db.session import get_db
from sgpi_capirestc.crud.crud_convocatoria import convocatoria
from sgpi_capirestc.schemas.domain_schemas import (
    ConvocatoriaCreate,
    ConvocatoriaUpdate,
    ConvocatoriaResponse,
    EvidenciaDifusionCreate,
    EvidenciaDifusionResponse,
)
from app.core.security import get_current_user
from app.core.audit import log_audit_event
from app.models.domain import EvidenciaDifusion

router = APIRouter()


@router.get("/", response_model=List[ConvocatoriaResponse])
async def list_convocatorias(
    skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)
):
    return await convocatoria.get_multi(db, skip=skip, limit=limit)


@router.get("/{id_convocatoria}", response_model=ConvocatoriaResponse)
async def get_convocatoria(
    id_convocatoria: int, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)
):
    c = await convocatoria.get(db, id=id_convocatoria)
    if not c:
        raise HTTPException(status_code=404, detail="Convocatoria no encontrado")
    return c


@router.post("/", response_model=ConvocatoriaResponse)
async def create_convocatoria(
    obj_in: ConvocatoriaCreate, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)
):
    new_convocatoria = await convocatoria.create(db, obj_in=obj_in)

    await log_audit_event(
        db=db,
        tipo_evento="INSERT",
        entidad_afectada="convocatoria",
        pk_entidad=str(new_convocatoria.id_convocatoria),
        valor_nuevo=obj_in.model_dump(mode="json"),
        id_usuario=current_user.get("sub"),
    )
    return new_convocatoria


@router.put("/{id_convocatoria}", response_model=ConvocatoriaResponse)
async def update_convocatoria(
    id_convocatoria: int,
    obj_in: ConvocatoriaUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    c = await convocatoria.get(db, id=id_convocatoria)
    if not c:
        raise HTTPException(status_code=404, detail="Convocatoria no encontrado")

    valor_anterior = {k: getattr(c, k) for k in obj_in.model_dump(exclude_unset=True).keys()}

    updated_c = await convocatoria.update(db, db_obj=c, obj_in=obj_in)

    await log_audit_event(
        db=db,
        tipo_evento="UPDATE",
        entidad_afectada="convocatoria",
        pk_entidad=str(id_convocatoria),
        valor_anterior=valor_anterior,
        valor_nuevo=obj_in.model_dump(exclude_unset=True, mode="json"),
        id_usuario=current_user.get("sub"),
    )
    return updated_c


@router.post("/{id_convocatoria}/evidence", response_model=EvidenciaDifusionResponse)
async def upload_evidence(
    id_convocatoria: int,
    obj_in: EvidenciaDifusionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    c = await convocatoria.get(db, id=id_convocatoria)
    if not c:
        raise HTTPException(status_code=404, detail="Convocatoria no encontrada")

    db_obj = EvidenciaDifusion(**obj_in.model_dump())
    db_obj.id_convocatoria = id_convocatoria
    db_obj.id_usuario_carga = current_user.get("sub")
    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)

    await log_audit_event(
        db=db,
        tipo_evento="INSERT",
        entidad_afectada="evidencia_difusion",
        pk_entidad=str(db_obj.id_evidencia),
        valor_nuevo=obj_in.model_dump(mode="json"),
        id_usuario=current_user.get("sub"),
    )
    return db_obj
