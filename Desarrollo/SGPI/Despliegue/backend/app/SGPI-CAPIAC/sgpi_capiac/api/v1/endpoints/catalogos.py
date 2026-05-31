from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.models.domain import DepartamentoAcademico, LineaInvestigacion
from sgpi_capiac.schemas.capiac_schemas import (
    CatalogCreate,
    CatalogUpdate,
    DepartamentoAcademicoResponse,
    LineaInvestigacionResponse
)

router = APIRouter()

# --- DEPARTAMENTOS ACADÉMICOS ---

@router.get("/departamentos", response_model=List[DepartamentoAcademicoResponse])
async def read_departamentos(
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Obtener todos los departamentos académicos.
    """
    stmt = select(DepartamentoAcademico)
    res = await db.execute(stmt)
    return res.scalars().all()

@router.post("/departamentos", response_model=DepartamentoAcademicoResponse, status_code=status.HTTP_201_CREATED)
async def create_departamento(
    *,
    db: AsyncSession = Depends(get_db),
    item_in: CatalogCreate
) -> Any:
    """
    Crear un nuevo departamento académico.
    """
    stmt = select(DepartamentoAcademico).where(DepartamentoAcademico.nombre == item_in.nombre)
    res = await db.execute(stmt)
    if res.scalars().first():
        raise HTTPException(status_code=400, detail="El departamento académico ya existe.")
    
    db_obj = DepartamentoAcademico(nombre=item_in.nombre, estado=item_in.estado or "Aprobado")
    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    return db_obj

@router.put("/departamentos/{id}", response_model=DepartamentoAcademicoResponse)
async def update_departamento(
    *,
    db: AsyncSession = Depends(get_db),
    id: int,
    item_in: CatalogUpdate
) -> Any:
    """
    Actualizar un departamento académico.
    """
    stmt = select(DepartamentoAcademico).where(DepartamentoAcademico.id == id)
    res = await db.execute(stmt)
    db_obj = res.scalars().first()
    if not db_obj:
        raise HTTPException(status_code=404, detail="Departamento académico no encontrado.")
    
    if item_in.nombre is not None:
        db_obj.nombre = item_in.nombre
    if item_in.estado is not None:
        db_obj.estado = item_in.estado
        
    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    return db_obj

@router.delete("/departamentos/{id}")
async def delete_departamento(
    *,
    db: AsyncSession = Depends(get_db),
    id: int
) -> Any:
    """
    Eliminar un departamento académico.
    """
    stmt = select(DepartamentoAcademico).where(DepartamentoAcademico.id == id)
    res = await db.execute(stmt)
    db_obj = res.scalars().first()
    if not db_obj:
        raise HTTPException(status_code=404, detail="Departamento académico no encontrado.")
    
    await db.delete(db_obj)
    await db.commit()
    return {"status": "success", "message": "Departamento académico eliminado correctamente."}


# --- LÍNEAS DE INVESTIGACIÓN ---

@router.get("/lineas-investigacion", response_model=List[LineaInvestigacionResponse])
async def read_lineas_investigacion(
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Obtener todas las líneas de investigación.
    """
    stmt = select(LineaInvestigacion)
    res = await db.execute(stmt)
    return res.scalars().all()

@router.post("/lineas-investigacion", response_model=LineaInvestigacionResponse, status_code=status.HTTP_201_CREATED)
async def create_linea_investigacion(
    *,
    db: AsyncSession = Depends(get_db),
    item_in: CatalogCreate
) -> Any:
    """
    Crear una nueva línea de investigación.
    """
    stmt = select(LineaInvestigacion).where(LineaInvestigacion.nombre == item_in.nombre)
    res = await db.execute(stmt)
    if res.scalars().first():
        raise HTTPException(status_code=400, detail="La línea de investigación ya existe.")
    
    db_obj = LineaInvestigacion(nombre=item_in.nombre, estado=item_in.estado or "Aprobado")
    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    return db_obj

@router.put("/lineas-investigacion/{id}", response_model=LineaInvestigacionResponse)
async def update_linea_investigacion(
    *,
    db: AsyncSession = Depends(get_db),
    id: int,
    item_in: CatalogUpdate
) -> Any:
    """
    Actualizar una línea de investigación.
    """
    stmt = select(LineaInvestigacion).where(LineaInvestigacion.id == id)
    res = await db.execute(stmt)
    db_obj = res.scalars().first()
    if not db_obj:
        raise HTTPException(status_code=404, detail="Línea de investigación no encontrada.")
    
    if item_in.nombre is not None:
        db_obj.nombre = item_in.nombre
    if item_in.estado is not None:
        db_obj.estado = item_in.estado
        
    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    return db_obj

@router.delete("/lineas-investigacion/{id}")
async def delete_linea_investigacion(
    *,
    db: AsyncSession = Depends(get_db),
    id: int
) -> Any:
    """
    Eliminar una línea de investigación.
    """
    stmt = select(LineaInvestigacion).where(LineaInvestigacion.id == id)
    res = await db.execute(stmt)
    db_obj = res.scalars().first()
    if not db_obj:
        raise HTTPException(status_code=404, detail="Línea de investigación no encontrada.")
    
    await db.delete(db_obj)
    await db.commit()
    return {"status": "success", "message": "Línea de investigación eliminada correctamente."}
