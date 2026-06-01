from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.db.session import get_db
from sgpi_capirestc.crud.crud_grupo import grupo
from sgpi_capirestc.schemas.domain_schemas import GrupoInvestigacionCreate, GrupoInvestigacionUpdate, GrupoInvestigacionResponse
from app.core.security import get_current_user
from app.core.audit import log_audit_event

router = APIRouter()

@router.get("/", response_model=List[GrupoInvestigacionResponse])
async def list_grupos(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    return await grupo.get_multi(db, skip=skip, limit=limit)

@router.get("/{codigo}", response_model=GrupoInvestigacionResponse)
async def get_grupo(codigo: str, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    g = await grupo.get_by_codigo(db, codigo=codigo)
    if not g:
        raise HTTPException(status_code=404, detail="Grupo de Investigacion no encontrado")
    return g

@router.post("/", response_model=GrupoInvestigacionResponse)
async def create_grupo(obj_in: GrupoInvestigacionCreate, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    g = await grupo.get_by_codigo(db, codigo=obj_in.codigo_grupo)
    if g:
        raise HTTPException(status_code=400, detail="Grupo with this code already exists")
    
    new_grupo = await grupo.create(db, obj_in=obj_in)
    
    await log_audit_event(
        db=db,
        tipo_evento="INSERT",
        entidad_afectada="grupo_investigacion",
        pk_entidad=new_grupo.codigo_grupo,
        valor_nuevo=obj_in.model_dump(mode='json'),
        id_usuario=current_user.get("sub"),
    )
    return new_grupo

@router.put("/{codigo}", response_model=GrupoInvestigacionResponse)
async def update_grupo(codigo: str, obj_in: GrupoInvestigacionUpdate, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    g = await grupo.get_by_codigo(db, codigo=codigo)
    if not g:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")
        
    valor_anterior = {k: getattr(g, k) for k in obj_in.model_dump(exclude_unset=True).keys()}
    
    updated_g = await grupo.update(db, db_obj=g, obj_in=obj_in)
    
    await log_audit_event(
        db=db,
        tipo_evento="UPDATE",
        entidad_afectada="grupo_investigacion",
        pk_entidad=codigo,
        valor_anterior=valor_anterior,
        valor_nuevo=obj_in.model_dump(exclude_unset=True, mode='json'),
        id_usuario=current_user.get("sub"),
    )
    return updated_g
