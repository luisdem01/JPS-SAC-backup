from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.db.session import get_db
from sgpi_capirestc.crud.crud_publicacion import publicacion
from app.models.domain import InvestigadorPublicacion
from sgpi_capirestc.schemas.domain_schemas import (
    PublicacionCreate,
    PublicacionUpdate,
    PublicacionResponse,
    InvestigadorPublicacionCreate,
    InvestigadorPublicacionResponse,
)
from app.core.security import get_current_user
from app.core.audit import log_audit_event

router = APIRouter()


@router.get("/", response_model=List[PublicacionResponse])
async def list_publicaciones(
    skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)
):
    return await publicacion.get_multi(db, skip=skip, limit=limit)


@router.get("/{id_publicacion}", response_model=PublicacionResponse)
async def get_publicacion(
    id_publicacion: int, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)
):
    p = await publicacion.get(db, id=id_publicacion)
    if not p:
        raise HTTPException(status_code=404, detail="Publicacion no encontrado")
    return p


@router.post("/", response_model=PublicacionResponse)
async def create_publicacion(
    obj_in: PublicacionCreate, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)
):
    new_publicacion = await publicacion.create(db, obj_in=obj_in)

    await log_audit_event(
        db=db,
        tipo_evento="INSERT",
        entidad_afectada="publicacion",
        pk_entidad=str(new_publicacion.id_publicacion),
        valor_nuevo=obj_in.model_dump(mode="json"),
        id_usuario=current_user.get("sub"),
    )
    return new_publicacion


@router.put("/{id_publicacion}", response_model=PublicacionResponse)
async def update_publicacion(
    id_publicacion: int,
    obj_in: PublicacionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    p = await publicacion.get(db, id=id_publicacion)
    if not p:
        raise HTTPException(status_code=404, detail="Publicacion no encontrado")

    valor_anterior = {k: getattr(p, k) for k in obj_in.model_dump(exclude_unset=True).keys()}

    updated_p = await publicacion.update(db, db_obj=p, obj_in=obj_in)

    await log_audit_event(
        db=db,
        tipo_evento="UPDATE",
        entidad_afectada="publicacion",
        pk_entidad=str(id_publicacion),
        valor_anterior=valor_anterior,
        valor_nuevo=obj_in.model_dump(exclude_unset=True, mode="json"),
        id_usuario=current_user.get("sub"),
    )
    return updated_p


@router.post("/{id_publicacion}/investigators", response_model=InvestigadorPublicacionResponse)
async def add_investigator(
    id_publicacion: int,
    obj_in: InvestigadorPublicacionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    p = await publicacion.get(db, id=id_publicacion)
    if not p:
        raise HTTPException(status_code=404, detail="Publicacion no encontrado")

    if id_publicacion != obj_in.id_publicacion:
        raise HTTPException(status_code=400, detail="Path id does not match body id")

    db_obj = InvestigadorPublicacion(**obj_in.model_dump())
    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)

    await log_audit_event(
        db=db,
        tipo_evento="INSERT",
        entidad_afectada="investigador_publicacion",
        pk_entidad=f"{id_publicacion}-{db_obj.dni_investigador}",
        valor_nuevo=obj_in.model_dump(mode="json"),
        id_usuario=current_user.get("sub"),
    )
    return db_obj
