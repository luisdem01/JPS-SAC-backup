from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete, func, or_
from sqlalchemy.orm import noload
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

from app.db.session import get_db
from sgpi_capirestc.crud.crud_grupo import grupo
from sgpi_capirestc.schemas.domain_schemas import GrupoInvestigacionCreate, GrupoInvestigacionUpdate, GrupoInvestigacionResponse
from app.core.security import get_current_user
from app.core.audit import log_audit_event
from app.db.errors import handle_db_integrity_error

router = APIRouter()

class PaginatedGruposResponse(BaseModel):
    items: List[GrupoInvestigacionResponse]
    total: int
    page: int
    pages: int

@router.get("/", response_model=PaginatedGruposResponse)
async def list_grupos(
    buscar: Optional[str] = None,
    estado: Optional[str] = None,
    fuente: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=2000),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    from app.models.domain import GrupoInvestigacion
    import math
    
    stmt = select(GrupoInvestigacion).options(
        noload(GrupoInvestigacion.coordinador),
        noload(GrupoInvestigacion.miembro_grupo),
        noload(GrupoInvestigacion.proyecto)
    )
    count_stmt = select(func.count(GrupoInvestigacion.id_grupo))
    
    filters = []
    if buscar and buscar.strip():
        term = f"%{buscar.strip()}%"
        filters.append(
            or_(
                func.unaccent(GrupoInvestigacion.codigo_grupo).ilike(func.unaccent(term)),
                func.unaccent(GrupoInvestigacion.nombre_grupo).ilike(func.unaccent(term)),
                func.unaccent(GrupoInvestigacion.siglas).ilike(func.unaccent(term))
            )
        )
        
    if estado:
        db_estado = None
        if estado == "validado_activo":
            db_estado = "Activo"
        elif estado == "validado_inactivo":
            db_estado = "Inactivo"
        elif estado == "pendiente_validacion":
            db_estado = "Pendiente"
            
        if db_estado:
            filters.append(GrupoInvestigacion.estado_grupo == db_estado)
            
    if fuente:
        if fuente == "RAIS":
            filters.append(GrupoInvestigacion.url_vrip.isnot(None))
        elif fuente == "Manual":
            filters.append(GrupoInvestigacion.url_vrip.is_(None))
            
    if filters:
        stmt = stmt.where(*filters)
        count_stmt = count_stmt.where(*filters)

    # Conteo total
    total_result = await db.execute(count_stmt)
    total = total_result.scalar_one()

    # Paginación
    skip = (page - 1) * limit
    stmt = stmt.order_by(GrupoInvestigacion.created_at.desc()).offset(skip).limit(limit)
    
    res = await db.execute(stmt)
    items = res.scalars().all()
    
    pages = math.ceil(total / limit) if total > 0 else 1
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "pages": pages
    }

@router.get("/validate-code")
async def validate_group_code(
    code: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    from app.models.domain import GrupoInvestigacion
    uppercase_code = code.strip().upper()
    stmt = select(GrupoInvestigacion.id_grupo).where(GrupoInvestigacion.codigo_grupo == uppercase_code)
    res = await db.execute(stmt)
    existing = res.scalar_one_or_none()
    return {"unico": existing is None}

@router.get("/stats")
async def get_groups_stats(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    from app.models.domain import GrupoInvestigacion
    stmt = select(
        GrupoInvestigacion.estado_grupo,
        func.count(GrupoInvestigacion.id_grupo)
    ).group_by(GrupoInvestigacion.estado_grupo)
    res = await db.execute(stmt)
    rows = res.all()
    
    total = 0
    pending = 0
    active = 0
    inactive = 0
    
    for estado, count in rows:
        total += count
        if estado == "Activo":
            active = count
        elif estado == "Inactivo":
            inactive = count
        else:
            pending += count
            
    return {
        "totalGrupos": total,
        "pendientesValidar": pending,
        "validadosActivos": active,
        "validadosInactivos": inactive
    }

@router.get("/{codigo}", response_model=GrupoInvestigacionResponse)
async def get_grupo(codigo: str, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    from app.models.domain import GrupoInvestigacion
    if codigo.isdigit():
        g = await db.get(GrupoInvestigacion, int(codigo))
    else:
        g = await grupo.get_by_codigo(db, codigo=codigo)
    if not g:
        raise HTTPException(status_code=404, detail="Grupo de Investigacion no encontrado")
    return g

@router.post("/", response_model=GrupoInvestigacionResponse)
async def create_grupo(
    obj_in: GrupoInvestigacionCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    g = await grupo.get_by_codigo(db, codigo=obj_in.codigo_grupo)
    if g:
        raise HTTPException(status_code=400, detail="Grupo with this code already exists")
    
    try:
        # A. Upsert de investigadores externos
        if obj_in.miembros:
            from app.models.domain import Investigador
            for m in obj_in.miembros:
                if m.isExternal:
                    result_inv = await db.execute(select(Investigador).where(Investigador.dni == m.dni))
                    existing_inv = result_inv.scalars().first()
                    
                    nombres = m.nombres
                    apellidos = m.apellidos
                    if not nombres and not apellidos and m.nombre:
                        parts = m.nombre.strip().split(" ", 1)
                        if len(parts) > 1:
                            apellidos, nombres = parts[0], parts[1]
                        else:
                            nombres = parts[0]
                            apellidos = "RENACYT"
                    
                    if not nombres:
                        nombres = "Externo"
                    if not apellidos:
                        apellidos = "RENACYT"

                    if not existing_inv:
                        new_inv = Investigador(
                            dni=m.dni,
                            nombres=nombres,
                            apellidos=apellidos,
                            departamento_academico=m.departamento or "Externo (RENACYT)",
                            facultad_dependencia=m.facultad or "Ingeniería de Sistemas e Informática",
                            categoria_renacyt=m.nivelRenacyt or "Sin nivel",
                            estado_vigencia="Activo",
                            investigador_sm=False,
                            tiene_deuda_gi=False,
                            tiene_deuda_pi=False,
                            is_external=True
                        )
                        db.add(new_inv)
                    else:
                        existing_inv.nombres = nombres
                        existing_inv.apellidos = apellidos
                        if m.departamento:
                            existing_inv.departamento_academico = m.departamento
                        if m.facultad:
                            existing_inv.facultad_dependencia = m.facultad
                        if m.nivelRenacyt:
                            existing_inv.categoria_renacyt = m.nivelRenacyt
                        existing_inv.is_external = True
                        db.add(existing_inv)
            
            await db.flush()

        # B. Crear el grupo de investigación
        from app.models.domain import GrupoInvestigacion
        grupo_data = obj_in.model_dump(exclude={"miembros"})
        new_grupo = GrupoInvestigacion(**grupo_data)
        db.add(new_grupo)
        await db.flush()
        
        # C. Insertar los miembros del grupo
        if obj_in.miembros:
            from app.models.domain import MiembroGrupo
            for m in obj_in.miembros:
                condicion = "Adherente"
                if m.rol == "Director":
                    condicion = "Coordinador"
                elif m.rol == "Co-Investigador":
                    condicion = "Titular"
                elif m.rol == "Tesista":
                    condicion = "Estudiante"
                elif m.rol in ["Colaborador", "Adherente", "Coordinador", "Titular", "Estudiante"]:
                    condicion = m.rol

                estado_m = "Activo"
                if m.estado in ["inactivo", "Inactivo"]:
                    estado_m = "Inactivo"

                fecha_inc = None
                if m.fechaIncorporacion:
                    try:
                        fecha_inc = datetime.strptime(m.fechaIncorporacion, "%Y-%m-%d").date()
                    except ValueError:
                        fecha_inc = datetime.now().date()
                else:
                    fecha_inc = datetime.now().date()

                db_miembro = MiembroGrupo(
                    id_grupo=new_grupo.id_grupo,
                    dni_investigador=m.dni,
                    condicion_miembro=condicion,
                    estado_membresia=estado_m,
                    fecha_incorporacion=fecha_inc
                )
                db.add(db_miembro)

        await db.commit()
        await db.refresh(new_grupo)
        
        background_tasks.add_task(
            log_audit_event,
            db=None,
            tipo_evento="INSERT",
            entidad_afectada="grupo_investigacion",
            pk_entidad=new_grupo.codigo_grupo,
            valor_nuevo=obj_in.model_dump(mode='json'),
            id_usuario=current_user.get("sub"),
        )
        return new_grupo

    except Exception as e:
        await db.rollback()
        handle_db_integrity_error(e)

@router.put("/{codigo}", response_model=GrupoInvestigacionResponse)
async def update_grupo(
    codigo: str,
    obj_in: GrupoInvestigacionUpdate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    from app.models.domain import GrupoInvestigacion
    if codigo.isdigit():
        g = await db.get(GrupoInvestigacion, int(codigo))
    else:
        g = await grupo.get_by_codigo(db, codigo=codigo)
    if not g:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")
        
    try:
        # A. Upsert de investigadores externos
        if obj_in.miembros is not None:
            from app.models.domain import Investigador
            for m in obj_in.miembros:
                if m.isExternal:
                    result_inv = await db.execute(select(Investigador).where(Investigador.dni == m.dni))
                    existing_inv = result_inv.scalars().first()
                    
                    nombres = m.nombres
                    apellidos = m.apellidos
                    if not nombres and not apellidos and m.nombre:
                        parts = m.nombre.strip().split(" ", 1)
                        if len(parts) > 1:
                            apellidos, nombres = parts[0], parts[1]
                        else:
                            nombres = parts[0]
                            apellidos = "RENACYT"
                    
                    if not nombres:
                        nombres = "Externo"
                    if not apellidos:
                        apellidos = "RENACYT"

                    if not existing_inv:
                        new_inv = Investigador(
                            dni=m.dni,
                            nombres=nombres,
                            apellidos=apellidos,
                            departamento_academico=m.departamento or "Externo (RENACYT)",
                            facultad_dependencia=m.facultad or "Ingeniería de Sistemas e Informática",
                            categoria_renacyt=m.nivelRenacyt or "Sin nivel",
                            estado_vigencia="Activo",
                            investigador_sm=False,
                            tiene_deuda_gi=False,
                            tiene_deuda_pi=False,
                            is_external=True
                        )
                        db.add(new_inv)
                    else:
                        existing_inv.nombres = nombres
                        existing_inv.apellidos = apellidos
                        if m.departamento:
                            existing_inv.departamento_academico = m.departamento
                        if m.facultad:
                            existing_inv.facultad_dependencia = m.facultad
                        if m.nivelRenacyt:
                            existing_inv.categoria_renacyt = m.nivelRenacyt
                        existing_inv.is_external = True
                        db.add(existing_inv)
            
            await db.flush()

        # B. Actualizar grupo
        valor_anterior = {k: getattr(g, k) for k in obj_in.model_dump(exclude_unset=True).keys() if hasattr(g, k)}
        
        update_data = obj_in.model_dump(exclude_unset=True, exclude={"miembros"})
        for field, value in update_data.items():
            setattr(g, field, value)
        db.add(g)
        await db.flush()

        # C. Reemplazar miembros
        if obj_in.miembros is not None:
            from app.models.domain import MiembroGrupo
            await db.execute(delete(MiembroGrupo).where(MiembroGrupo.id_grupo == g.id_grupo))
            
            for m in obj_in.miembros:
                condicion = "Adherente"
                if m.rol == "Director":
                    condicion = "Coordinador"
                elif m.rol == "Co-Investigador":
                    condicion = "Titular"
                elif m.rol == "Tesista":
                    condicion = "Estudiante"
                elif m.rol in ["Colaborador", "Adherente", "Coordinador", "Titular", "Estudiante"]:
                    condicion = m.rol

                estado_m = "Activo"
                if m.estado in ["inactivo", "Inactivo"]:
                    estado_m = "Inactivo"

                fecha_inc = None
                if m.fechaIncorporacion:
                    try:
                        fecha_inc = datetime.strptime(m.fechaIncorporacion, "%Y-%m-%d").date()
                    except ValueError:
                        fecha_inc = datetime.now().date()
                else:
                    fecha_inc = datetime.now().date()

                db_miembro = MiembroGrupo(
                    id_grupo=g.id_grupo,
                    dni_investigador=m.dni,
                    condicion_miembro=condicion,
                    estado_membresia=estado_m,
                    fecha_incorporacion=fecha_inc
                )
                db.add(db_miembro)

        await db.commit()
        await db.refresh(g)
        
        background_tasks.add_task(
            log_audit_event,
            db=None,
            tipo_evento="UPDATE",
            entidad_afectada="grupo_investigacion",
            pk_entidad=codigo,
            valor_anterior=valor_anterior,
            valor_nuevo=obj_in.model_dump(exclude_unset=True, mode='json'),
            id_usuario=current_user.get("sub"),
        )
        return g

    except Exception as e:
        await db.rollback()
        handle_db_integrity_error(e)
