from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from typing import List, Optional
from pydantic import BaseModel
import math

from app.db.session import get_db
from app.models.domain import Investigador
from app.core.logger import logger
from sgpi_capirestc.crud.crud_investigador import investigador
from sgpi_capirestc.schemas.domain_schemas import InvestigadorCreate, InvestigadorUpdate, InvestigadorResponse
from app.core.security import get_current_user
from app.core.audit import log_audit_event

router = APIRouter()


class PaginatedInvestigadoresResponse(BaseModel):
    items: List[InvestigadorResponse]
    total: int
    page: int
    pages: int


@router.get("/", response_model=PaginatedInvestigadoresResponse)
async def list_investigadores(
    buscar: Optional[str] = None,
    departamento: Optional[str] = None,
    nivelRenacyt: Optional[str] = None,
    estado: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Lista y filtra investigadores con soporte de paginación y logging.
    """
    logger.info(
        f"Search query triggered: buscar={buscar}, departamento={departamento}, "
        f"nivelRenacyt={nivelRenacyt}, estado={estado}, page={page}, limit={limit}"
    )

    # Construir consulta base
    stmt = select(Investigador)
    count_stmt = select(func.count(Investigador.dni))

    # Filtros
    filters = []
    if buscar and buscar.strip():
        term = f"%{buscar.strip()}%"
        filters.append(or_(
            Investigador.dni.ilike(term),
            Investigador.apellidos.ilike(term),
            Investigador.nombres.ilike(term)
        ))
    if departamento:
        filters.append(Investigador.departamento_academico == departamento)
    if nivelRenacyt:
        filters.append(Investigador.categoria_renacyt == nivelRenacyt)
    if estado:
        estado_map = {
            "activo": "Activo",
            "inactivo": "Inactivo",
            "por_vencer": "Por Vencer"
        }
        estado_mapped = estado_map.get(estado, estado)
        filters.append(Investigador.estado_vigencia == estado_mapped)

    if filters:
        stmt = stmt.where(*filters)
        count_stmt = count_stmt.where(*filters)

    # Ordenar por apellidos ascendente
    stmt = stmt.order_by(Investigador.apellidos.asc())

    # Conteo total
    total_result = await db.execute(count_stmt)
    total = total_result.scalar_one()

    # Paginación
    skip = (page - 1) * limit
    stmt = stmt.offset(skip).limit(limit)

    # Ejecutar consulta
    result = await db.execute(stmt)
    items = result.scalars().all()

    pages = math.ceil(total / limit) if total > 0 else 1

    return {
        "items": items,
        "total": total,
        "page": page,
        "pages": pages
    }

@router.get("/{dni}", response_model=InvestigadorResponse)
async def get_investigador(dni: str, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    inv = await investigador.get_by_dni(db, dni=dni)
    if not inv:
        raise HTTPException(status_code=404, detail="Investigador no encontrado")
    return inv

@router.post("/", response_model=InvestigadorResponse)
async def create_investigador(obj_in: InvestigadorCreate, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    inv = await investigador.get_by_dni(db, dni=obj_in.dni)
    if inv:
        raise HTTPException(status_code=400, detail="Investigador with this DNI already exists")
    
    new_inv = await investigador.create(db, obj_in=obj_in)
    
    await log_audit_event(
        db=db,
        tipo_evento="INSERT",
        entidad_afectada="investigador",
        pk_entidad=new_inv.dni,
        valor_nuevo=obj_in.model_dump(),
        id_usuario=current_user.get("sub"),
    )
    return new_inv

@router.put("/{dni}", response_model=InvestigadorResponse)
async def update_investigador(dni: str, obj_in: InvestigadorUpdate, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    inv = await investigador.get_by_dni(db, dni=dni)
    if not inv:
        raise HTTPException(status_code=404, detail="Investigador no encontrado")
        
    valor_anterior = {k: getattr(inv, k) for k in obj_in.model_dump(exclude_unset=True).keys()}
    
    updated_inv = await investigador.update(db, db_obj=inv, obj_in=obj_in)
    
    await log_audit_event(
        db=db,
        tipo_evento="UPDATE",
        entidad_afectada="investigador",
        pk_entidad=dni,
        valor_anterior=valor_anterior,
        valor_nuevo=obj_in.model_dump(exclude_unset=True),
        id_usuario=current_user.get("sub"),
    )
    return updated_inv
