from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, delete
from typing import List, Optional
from pydantic import BaseModel
import math
import time

from app.db.session import get_db
from app.models.domain import Proyecto, Entregable, InvestigadorProyecto, ProyectoEstadoHistorial
from app.core.logger import logger
from sgpi_capirestc.crud.crud_proyecto import proyecto
from sgpi_capirestc.schemas.domain_schemas import ProyectoCreate, ProyectoUpdate, ProyectoResponse, EntregableCreate, EntregableUpdate, EntregableResponse, InvestigadorProyectoCreate, InvestigadorProyectoResponse, ProyectoEstadoUpdate
from app.core.security import get_current_user, require_admin
from app.core.audit import log_audit_event

router = APIRouter()


class PaginatedProyectosResponse(BaseModel):
    items: List[ProyectoResponse]
    total: int
    page: int
    pages: int


@router.get("/", response_model=PaginatedProyectosResponse)
async def list_proyectos(
    buscar: Optional[str] = None,
    estado: Optional[str] = None,
    convocatoria: Optional[str] = None,
    tipo: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Lista y filtra proyectos de investigación con soporte de paginación y logging.
    Parámetros:
    - buscar: texto libre sobre código o título del proyecto
    - estado: 'Aprobado', 'En ejecución' o 'Concluido'
    - convocatoria: año de convocatoria (ej. '2023')
    - tipo: tipo de proyecto ('Básico' o 'Aplicado')
    """
    t_start = time.time()
    logger.info(
        f"[SGPI-CFPI] Search query: buscar={buscar!r}, estado={estado!r}, "
        f"convocatoria={convocatoria!r}, tipo={tipo!r}, page={page}, limit={limit}"
    )

    # Construir consulta base
    stmt = select(Proyecto)
    count_stmt = select(func.count(Proyecto.codigo_proyecto))

    # Aplicar filtros
    filters = []
    if buscar and buscar.strip():
        term = f"%{buscar.strip()}%"
        filters.append(or_(
            Proyecto.codigo_proyecto.ilike(term),
            Proyecto.titulo_proyecto.ilike(term)
        ))
    if estado:
        filters.append(Proyecto.estado_proyecto == estado)
    if convocatoria:
        try:
            filters.append(Proyecto.anio_convocatoria == int(convocatoria))
        except ValueError:
            logger.warning(f"[SGPI-CFPI] Convocatoria inválida recibida: {convocatoria!r}")
    if tipo:
        filters.append(Proyecto.tipo_proyecto == tipo)

    if filters:
        stmt = stmt.where(*filters)
        count_stmt = count_stmt.where(*filters)

    # Ordenar: más recientes primero
    stmt = stmt.order_by(Proyecto.created_at.desc())

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
    duration = time.time() - t_start

    logger.info(
        f"[SGPI-CFPI] Query completed — total={total}, returned={len(items)}, "
        f"pages={pages}, duration={duration:.3f}s"
    )

    return {
        "items": items,
        "total": total,
        "page": page,
        "pages": pages
    }

@router.get("/{codigo}", response_model=ProyectoResponse)
async def get_proyecto(codigo: str, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    logger.info(f"[SGPI-CFPI] Fetching project detail: codigo={codigo!r}")
    p = await proyecto.get_by_codigo(db, codigo=codigo)
    if not p:
        logger.warning(f"[SGPI-CFPI] Project not found: codigo={codigo!r}")
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    logger.info(f"[SGPI-CFPI] Project found: {codigo!r} — estado={p.estado_proyecto!r}")
    return p

@router.post("/", response_model=ProyectoResponse)
async def create_proyecto(obj_in: ProyectoCreate, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    logger.info(f"[SGPI-CFPI] Creating project: codigo={obj_in.codigo_proyecto!r}, user={current_user.get('sub')!r}")
    p = await proyecto.get_by_codigo(db, codigo=obj_in.codigo_proyecto)
    if p:
        logger.warning(f"[SGPI-CFPI] Duplicate project code rejected: {obj_in.codigo_proyecto!r}")
        raise HTTPException(status_code=400, detail="Proyecto with this code already exists")

    # Resolver codigo_grupo → id_grupo si se recibe codigo_grupo
    project_data = obj_in.model_dump()
    codigo_grupo = project_data.pop("codigo_grupo", None)
    if codigo_grupo:
        from app.models.domain import GrupoInvestigacion
        result_grupo = await db.execute(
            select(GrupoInvestigacion).where(GrupoInvestigacion.codigo_grupo == codigo_grupo)
        )
        grupo_obj = result_grupo.scalars().first()
        if grupo_obj:
            project_data["id_grupo"] = grupo_obj.id_grupo
        else:
            logger.warning(f"[SGPI-CFPI] Group not found for codigo_grupo={codigo_grupo!r}, inserting without group")

    db_proyecto = Proyecto(**project_data)
    db.add(db_proyecto)
    await db.flush()  # Obtener el objeto sin commit para poder crear entregables

    # Crear entregables iniciales por defecto
    estado_proyecto = project_data.get("estado_proyecto", "Aprobado")
    fecha_inicio = project_data.get("fecha_inicio")
    if fecha_inicio:
        from datetime import timedelta, date as date_type
        import calendar
        def add_months(d, months):
            month = d.month - 1 + months
            year = d.year + month // 12
            month = month % 12 + 1
            day = min(d.day, calendar.monthrange(year, month)[1])
            return d.replace(year=year, month=month, day=day)

        h1_vence = add_months(fecha_inicio, 12)
        h2_vence = add_months(fecha_inicio, 36)
        estado_h1 = "Pendiente" if estado_proyecto == "En ejecución" else "Bloqueado"

        db.add(Entregable(
            codigo_proyecto=obj_in.codigo_proyecto,
            tipo_entregable="Informe Académico (12 Meses)",
            fecha_limite_programada=h1_vence,
            estado_entregable=estado_h1,
        ))
        db.add(Entregable(
            codigo_proyecto=obj_in.codigo_proyecto,
            tipo_entregable="Productos Entregables (36 Meses)",
            fecha_limite_programada=h2_vence,
            estado_entregable="Bloqueado",
        ))

    # Registrar historial de estado inicial
    db.add(ProyectoEstadoHistorial(
        codigo_proyecto=obj_in.codigo_proyecto,
        estado_anterior=None,
        estado_nuevo=estado_proyecto,
        justificacion="Proyecto creado manualmente en el sistema.",
        id_usuario_responsable=current_user.get("sub"),
    ))

    await db.commit()
    await db.refresh(db_proyecto)
    logger.info(f"[SGPI-CFPI] Project created successfully: {db_proyecto.codigo_proyecto!r}")

    await log_audit_event(
        db=db,
        tipo_evento="INSERT",
        entidad_afectada="proyecto",
        pk_entidad=db_proyecto.codigo_proyecto,
        valor_nuevo=obj_in.model_dump(mode='json'),
        id_usuario=current_user.get("sub"),
    )
    return db_proyecto


@router.put("/{codigo}", response_model=ProyectoResponse)
async def update_proyecto(codigo: str, obj_in: ProyectoUpdate, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    logger.info(f"[SGPI-CFPI] Updating project: codigo={codigo!r}, fields={list(obj_in.model_dump(exclude_unset=True).keys())}, user={current_user.get('sub')!r}")
    p = await proyecto.get_by_codigo(db, codigo=codigo)
    if not p:
        logger.warning(f"[SGPI-CFPI] Update failed — project not found: {codigo!r}")
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    update_data = obj_in.model_dump(exclude_unset=True)
    
    # 1. Resolver codigo_grupo → id_grupo si se recibe
    codigo_grupo = update_data.pop("codigo_grupo", None)
    if codigo_grupo is not None:
        if codigo_grupo:
            from app.models.domain import GrupoInvestigacion
            result_grupo = await db.execute(
                select(GrupoInvestigacion).where(GrupoInvestigacion.codigo_grupo == codigo_grupo)
            )
            grupo_obj = result_grupo.scalars().first()
            if grupo_obj:
                p.id_grupo = grupo_obj.id_grupo
            else:
                logger.warning(f"[SGPI-CFPI] Group not found for codigo_grupo={codigo_grupo!r} during update")
        else:
            p.id_grupo = None

    # 2. Registrar historial si el estado cambia y manejar entregables
    nuevo_estado = update_data.get("estado_proyecto")
    justificacion = update_data.pop("justificacion", None)
    if nuevo_estado and nuevo_estado != p.estado_proyecto:
        estado_anterior = p.estado_proyecto
        p.estado_proyecto = nuevo_estado
        
        hist_just = justificacion or "Validación y actualización de datos técnicos/financieros y equipo."
        db.add(ProyectoEstadoHistorial(
            codigo_proyecto=codigo,
            estado_anterior=estado_anterior,
            estado_nuevo=nuevo_estado,
            justificacion=hist_just,
            id_usuario_responsable=current_user.get("sub"),
        ))
        
        if nuevo_estado == "En ejecución":
            res_d = await db.execute(
                select(Entregable)
                .where(Entregable.codigo_proyecto == codigo)
                .order_by(Entregable.id_entregable.asc())
            )
            deliverables = res_d.scalars().all()
            if deliverables and deliverables[0].estado_entregable.lower() == "bloqueado":
                deliverables[0].estado_entregable = "Pendiente"
                db.add(deliverables[0])
        elif nuevo_estado == "Concluido":
            res_d = await db.execute(
                select(Entregable)
                .where(Entregable.codigo_proyecto == codigo)
            )
            deliverables = res_d.scalars().all()
            for d in deliverables:
                d.estado_entregable = "Completado"
                db.add(d)

    valor_anterior = {k: getattr(p, k) for k in update_data.keys() if hasattr(p, k)}
    updated_p = await proyecto.update(db, db_obj=p, obj_in=update_data)
    logger.info(f"[SGPI-CFPI] Project updated successfully: {codigo!r}")

    await log_audit_event(
        db=db,
        tipo_evento="UPDATE",
        entidad_afectada="proyecto",
        pk_entidad=codigo,
        valor_anterior=valor_anterior,
        valor_nuevo=update_data,
        id_usuario=current_user.get("sub"),
    )
    return updated_p

@router.post("/{codigo}/deliverables", response_model=EntregableResponse)
async def create_deliverable(codigo: str, obj_in: EntregableCreate, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    p = await proyecto.get_by_codigo(db, codigo=codigo)
    if not p:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
        
    db_obj = Entregable(**obj_in.model_dump())
    db_obj.codigo_proyecto = codigo
    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    
    await log_audit_event(
        db=db,
        tipo_evento="INSERT",
        entidad_afectada="entregable",
        pk_entidad=str(db_obj.id_entregable),
        valor_nuevo=obj_in.model_dump(mode='json'),
        id_usuario=current_user.get("sub"),
    )
    return db_obj

@router.post("/{codigo}/investigators", response_model=InvestigadorProyectoResponse)
async def add_investigator(codigo: str, obj_in: InvestigadorProyectoCreate, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    p = await proyecto.get_by_codigo(db, codigo=codigo)
    if not p:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
        
    db_obj = InvestigadorProyecto(**obj_in.model_dump())
    db_obj.codigo_proyecto = codigo
    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    
    await log_audit_event(
        db=db,
        tipo_evento="INSERT",
        entidad_afectada="investigador_proyecto",
        pk_entidad=f"{codigo}-{db_obj.dni_investigador}",
        valor_nuevo=obj_in.model_dump(mode='json'),
        id_usuario=current_user.get("sub"),
    )
    return db_obj

@router.delete("/{codigo}/investigators")
async def delete_project_investigators(codigo: str, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    logger.info(f"[SGPI-CFPI] Removing all investigators from project: codigo={codigo!r}")
    p = await proyecto.get_by_codigo(db, codigo=codigo)
    if not p:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    
    await db.execute(
        delete(InvestigadorProyecto).where(InvestigadorProyecto.codigo_proyecto == codigo)
    )
    await db.commit()
    return {"status": "success", "message": "Investigadores removidos correctamente"}

@router.patch("/{codigo}/deliverables/{id_entregable}", response_model=EntregableResponse)
async def update_deliverable(
    codigo: str,
    id_entregable: int,
    obj_in: EntregableUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    logger.info(f"[SGPI-CFPI] Updating deliverable {id_entregable} for project {codigo!r}")
    result = await db.execute(
        select(Entregable)
        .where(Entregable.id_entregable == id_entregable)
        .where(Entregable.codigo_proyecto == codigo)
    )
    db_obj = result.scalars().first()
    if not db_obj:
        raise HTTPException(status_code=404, detail="Entregable no encontrado")
        
    update_data = obj_in.model_dump(exclude_unset=True)
    
    old_estado = db_obj.estado_entregable
    new_estado = update_data.get("estado_entregable")
    
    for field, value in update_data.items():
        setattr(db_obj, field, value)
        
    db.add(db_obj)
    
    if new_estado == "Completado" and old_estado != "Completado":
        res_deliv = await db.execute(
            select(Entregable)
            .where(Entregable.codigo_proyecto == codigo)
            .order_by(Entregable.id_entregable.asc())
        )
        deliverables = res_deliv.scalars().all()
        
        if deliverables and deliverables[0].id_entregable == id_entregable:
            if len(deliverables) > 1 and deliverables[1].estado_entregable.lower() == "bloqueado":
                deliverables[1].estado_entregable = "Pendiente"
                db.add(deliverables[1])
                
        p = await proyecto.get_by_codigo(db, codigo=codigo)
        current_status = p.estado_proyecto if p else "En ejecución"
        db.add(ProyectoEstadoHistorial(
            codigo_proyecto=codigo,
            estado_anterior=current_status,
            estado_nuevo=current_status,
            justificacion="Recepción registrada para el hito.",
            id_usuario_responsable=current_user.get("sub"),
        ))
        
    await db.commit()
    await db.refresh(db_obj)
    return db_obj

@router.patch("/{codigo}/status", response_model=ProyectoResponse, dependencies=[Depends(require_admin)])
async def update_proyecto_status(codigo: str, obj_in: ProyectoEstadoUpdate, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    logger.info(
        f"[SGPI-CFPI] Status change request: codigo={codigo!r}, "
        f"nuevo_estado={obj_in.estado_proyecto!r}, user={current_user.get('sub')!r}"
    )
    p = await proyecto.get_by_codigo(db, codigo=codigo)
    if not p:
        logger.warning(f"[SGPI-CFPI] Status change failed — project not found: {codigo!r}")
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    estado_anterior = p.estado_proyecto

    # Update project state
    updated_p = await proyecto.update(db, db_obj=p, obj_in={"estado_proyecto": obj_in.estado_proyecto})

    # Create history record
    historial = ProyectoEstadoHistorial(
        codigo_proyecto=codigo,
        estado_anterior=estado_anterior,
        estado_nuevo=obj_in.estado_proyecto,
        justificacion=obj_in.justificacion,
        id_usuario_responsable=current_user.get("sub")
    )
    db.add(historial)
    await db.commit()
    logger.info(
        f"[SGPI-CFPI] Project status changed: {codigo!r} — "
        f"{estado_anterior!r} → {obj_in.estado_proyecto!r}"
    )

    await log_audit_event(
        db=db,
        tipo_evento="UPDATE",
        entidad_afectada="proyecto",
        pk_entidad=codigo,
        valor_anterior={"estado_proyecto": estado_anterior},
        valor_nuevo={"estado_proyecto": obj_in.estado_proyecto, "justificacion": obj_in.justificacion},
        id_usuario=current_user.get("sub"),
    )
    return updated_p
