from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, delete
from typing import List, Optional
from pydantic import BaseModel
import math
import time
import os
import sys
from datetime import datetime, date, timezone

from app.db.session import get_db
from app.models.domain import Proyecto, Entregable, InvestigadorProyecto, ProyectoEstadoHistorial
from app.core.logger import logger
from sgpi_capirestc.crud.crud_proyecto import proyecto
from sgpi_capirestc.schemas.domain_schemas import ProyectoCreate, ProyectoUpdate, ProyectoResponse, EntregableCreate, EntregableUpdate, EntregableResponse, InvestigadorProyectoCreate, InvestigadorProyectoResponse, ProyectoEstadoUpdate
from app.core.security import get_current_user, require_admin
from app.core.audit import log_audit_event

from app.db.errors import handle_db_integrity_error

# Inyección dinámica para importar conectores
current_dir = os.path.dirname(os.path.abspath(__file__))
app_dir = os.path.abspath(os.path.join(current_dir, '..', '..', '..', '..', '..'))
cjca_path = os.path.join(app_dir, 'etl', 'connectors', 'SGPI-CJCA')
csapicyb_path = os.path.join(app_dir, 'etl', 'connectors', 'SGPI-CSAPICYB')

if cjca_path not in sys.path:
    sys.path.insert(0, cjca_path)
if csapicyb_path not in sys.path:
    sys.path.insert(0, csapicyb_path)

try:
    from vrip_connector.engines.vrip_proyectos import VripProyectosExtractor
except ImportError:
    VripProyectosExtractor = None

try:
    from cybertesis_connector.engines.api_engine import CybertesisAPIEngine
except ImportError:
    CybertesisAPIEngine = None

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
            func.unaccent(Proyecto.codigo_proyecto).ilike(func.unaccent(term)),
            func.unaccent(Proyecto.titulo_proyecto).ilike(func.unaccent(term))
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

    # Fallback a VRIP Scraper si no se encontraron resultados locales y se ingresó un término de búsqueda
    if total == 0 and buscar and buscar.strip() and VripProyectosExtractor:
        logger.info(f"No se encontraron proyectos locales para '{buscar}'. Consultando conector VRIP Proyectos...")
        try:
            from app.core.cache import normalize_query, cache_get, cache_set
            
            clean_query = buscar.strip()
            normalized = normalize_query(clean_query)
            cache_key = f"vrip:search_projects:{normalized}"
            
            # 1. Verificar cache
            cached_res = await cache_get(cache_key)
            if cached_res is not None:
                logger.info(f"Cache hit para búsqueda de proyectos '{buscar}'")
                return cached_res
            
            # Cache miss: Consultar extractor
            extractor = VripProyectosExtractor()
            records = extractor.extract(query=clean_query)
            
            external_items = []
            for r in records:
                # Map to ProyectoResponse structure
                code_ext = r.codigo_proyecto or f"EXT-{r.numero_resolucion or ''}-{r.anio_academico}".replace(" ", "").replace("/", "-")
                item_dict = {
                    "codigo_proyecto": code_ext,
                    "resolucion_aprobacion": r.numero_resolucion,
                    "titulo_proyecto": r.titulo,
                    "tipo_proyecto": "Aplicado", # Default
                    "tipo_programa": r.codigo_programa,
                    "facultad_proyecto": r.facultad,
                    "presupuesto_asignado": r.monto_financiado or 0.0,
                    "codigo_grupo": None,
                    "area_academica": None,
                    "anio_convocatoria": r.anio_academico,
                    "fecha_inicio": date.fromisoformat(r.fecha_aprobacion) if r.fecha_aprobacion else None,
                    "fecha_rendicion_35": None,
                    "fecha_rendicion_70": None,
                    "fecha_rendicion_100": None,
                    "fecha_informe_final": None,
                    "estado_proyecto": "Aprobado", # Default
                    "observaciones": f"Publicado en: {r.enlace_vrip}. Resumen: {r.resumen_post or ''}",
                    "created_at": datetime.now(timezone.utc),
                    "updated_at": datetime.now(timezone.utc),
                    "is_external": True,
                    # Simulamos el responsable principal para que el frontend lo mapée
                    "investigador_proyecto": [
                        {
                            "condicion_rol": "Responsable",
                            "investigador": {
                                "nombres": r.responsable,
                                "apellidos": "",
                                "dni": "00000000",
                                "departamento_academico": "Externo (VRIP)"
                            },
                            "dni_investigador": "00000000"
                        }
                    ]
                }
                external_items.append(item_dict)
            
            result_payload = {
                "items": external_items,
                "total": len(external_items),
                "page": 1,
                "pages": 1
            }
            
            # Guardar en cache (1 hora)
            await cache_set(cache_key, result_payload, 3600)
            return result_payload
            
        except Exception as e:
            logger.error(f"Error consultando conector VRIP Proyectos / Caché: {e}", exc_info=True)

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

@router.get("/stats")
async def get_projects_stats(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    from app.models.domain import Proyecto
    stmt = select(
        Proyecto.estado_proyecto,
        func.count(Proyecto.codigo_proyecto)
    ).group_by(Proyecto.estado_proyecto)
    res = await db.execute(stmt)
    rows = res.all()
    
    total = 0
    en_ejecucion = 0
    concluidos = 0
    aprobados = 0
    
    for estado, count in rows:
        total += count
        if estado == "En ejecución":
            en_ejecucion = count
        elif estado == "Concluido":
            concluidos = count
        elif estado == "Aprobado":
            aprobados = count
            
    return {
        "totalProyectos": total,
        "pendientesValidar": aprobados,
        "enEjecucion": en_ejecucion,
        "concluidos": concluidos
    }

@router.get("/{codigo}", response_model=ProyectoResponse)
async def get_proyecto(codigo: str, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    logger.info(f"[SGPI-CFPI] Fetching project detail: codigo={codigo!r}")
    p = await proyecto.get_by_codigo(db, codigo=codigo)
    if not p:
        logger.warning(f"[SGPI-CFPI] Project not found in DB: codigo={codigo!r}. Consultando VRIP...")
        if VripProyectosExtractor:
            try:
                # Intentamos buscar en el extractor usando el código del proyecto
                extractor = VripProyectosExtractor()
                records = extractor.extract(query=codigo)
                for r in records:
                    code_ext = r.codigo_proyecto or f"EXT-{r.numero_resolucion or ''}-{r.anio_academico}".replace(" ", "").replace("/", "-")
                    if code_ext == codigo or r.codigo_proyecto == codigo:
                        # Encontramos la coincidencia externa
                        return {
                            "codigo_proyecto": code_ext,
                            "resolucion_aprobacion": r.numero_resolucion,
                            "titulo_proyecto": r.titulo,
                            "tipo_proyecto": "Aplicado",
                            "tipo_programa": r.codigo_programa,
                            "facultad_proyecto": r.facultad,
                            "presupuesto_asignado": r.monto_financiado or 0.0,
                            "codigo_grupo": None,
                            "area_academica": None,
                            "anio_convocatoria": r.anio_academico,
                            "fecha_inicio": date.fromisoformat(r.fecha_aprobacion) if r.fecha_aprobacion else None,
                            "fecha_rendicion_35": None,
                            "fecha_rendicion_70": None,
                            "fecha_rendicion_100": None,
                            "fecha_informe_final": None,
                            "estado_proyecto": "Aprobado",
                            "observaciones": f"Publicado en: {r.enlace_vrip}. Resumen: {r.resumen_post or ''}",
                            "created_at": datetime.now(timezone.utc),
                            "updated_at": datetime.now(timezone.utc),
                            "is_external": True,
                            "investigador_proyecto": [
                                {
                                    "condicion_rol": "Responsable",
                                    "investigador": {
                                        "nombres": r.responsable,
                                        "apellidos": "",
                                        "dni": "00000000",
                                        "departamento_academico": "Externo (VRIP)"
                                    },
                                    "dni_investigador": "00000000"
                                }
                            ]
                        }
            except Exception as e:
                logger.error(f"Error consultando conector VRIP Proyectos en get_proyecto: {e}", exc_info=True)
        
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    logger.info(f"[SGPI-CFPI] Project found: {codigo!r} — estado={p.estado_proyecto!r}")
    return p

@router.post("/", response_model=ProyectoResponse)
async def create_proyecto(
    obj_in: ProyectoCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    logger.info(f"[SGPI-CFPI] Creating project: codigo={obj_in.codigo_proyecto!r}, user={current_user.get('sub')!r}")
    p = await proyecto.get_by_codigo(db, codigo=obj_in.codigo_proyecto)
    if p:
        logger.warning(f"[SGPI-CFPI] Duplicate project code rejected: {obj_in.codigo_proyecto!r}")
        raise HTTPException(status_code=400, detail="Proyecto with this code already exists")

    # Validar duplicado de resolución
    if obj_in.resolucion_aprobacion and obj_in.resolucion_aprobacion.strip():
        result_res = await db.execute(
            select(Proyecto).where(Proyecto.resolucion_aprobacion == obj_in.resolucion_aprobacion)
        )
        existing_res = result_res.scalars().first()
        if existing_res:
            logger.warning(f"[SGPI-CFPI] Duplicate resolution rejected: {obj_in.resolucion_aprobacion!r}")
            raise HTTPException(
                status_code=400,
                detail="Ya existe un proyecto registrado con este número de resolución."
            )

    # Resolver codigo_grupo → id_grupo si se recibe codigo_grupo
    project_data = obj_in.model_dump()
    investigadores_data = project_data.pop("investigadores", None)
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

    try:
        db_proyecto = Proyecto(**project_data)
        db.add(db_proyecto)
        await db.flush()  # Obtener el objeto sin commit para poder crear entregables

        # Crear entregables iniciales por defecto
        estado_proyecto = project_data.get("estado_proyecto", "Aprobado")
        fecha_inicio = project_data.get("fecha_inicio")
        if fecha_inicio:
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

        # Insertar investigadores asociados
        if investigadores_data:
            for inv_data in investigadores_data:
                db_inv = InvestigadorProyecto(
                    codigo_proyecto=obj_in.codigo_proyecto,
                    dni_investigador=inv_data["dni_investigador"],
                    condicion_rol=inv_data["condicion_rol"],
                    tipo_vinculo=inv_data.get("tipo_vinculo", "Docente"),
                    facultad_integrante=inv_data.get("facultad_integrante", "Ingeniería de Sistemas e Informática"),
                    condicion_gi=inv_data.get("condicion_gi", None)
                )
                db.add(db_inv)

        await db.commit()
    except Exception as e:
        await db.rollback()
        handle_db_integrity_error(e)

    await db.refresh(db_proyecto)
    logger.info(f"[SGPI-CFPI] Project created successfully: {db_proyecto.codigo_proyecto!r}")

    background_tasks.add_task(
        log_audit_event,
        db=None,
        tipo_evento="INSERT",
        entidad_afectada="proyecto",
        pk_entidad=db_proyecto.codigo_proyecto,
        valor_nuevo=obj_in.model_dump(mode='json'),
        id_usuario=current_user.get("sub"),
    )
    return db_proyecto


@router.put("/{codigo}", response_model=ProyectoResponse)
async def update_proyecto(
    codigo: str,
    obj_in: ProyectoUpdate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    logger.info(f"[SGPI-CFPI] Updating project: codigo={codigo!r}, fields={list(obj_in.model_dump(exclude_unset=True).keys())}, user={current_user.get('sub')!r}")
    p = await proyecto.get_by_codigo(db, codigo=codigo)
    if not p:
        logger.warning(f"[SGPI-CFPI] Update failed — project not found: {codigo!r}")
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    update_data = obj_in.model_dump(exclude_unset=True)
    investigadores = update_data.pop("investigadores", None)
    
    # Validar duplicado de resolución
    if "resolucion_aprobacion" in update_data and update_data["resolucion_aprobacion"] and update_data["resolucion_aprobacion"].strip():
        result_res = await db.execute(
            select(Proyecto).where(
                Proyecto.resolucion_aprobacion == update_data["resolucion_aprobacion"],
                Proyecto.codigo_proyecto != codigo
            )
        )
        existing_res = result_res.scalars().first()
        if existing_res:
            logger.warning(f"[SGPI-CFPI] Duplicate resolution rejected during update: {update_data['resolucion_aprobacion']!r}")
            raise HTTPException(
                status_code=400,
                detail="Ya existe un proyecto registrado con este número de resolución."
            )
    
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
    
    try:
        for field, value in update_data.items():
            setattr(p, field, value)
        db.add(p)
        await db.flush()

        if investigadores is not None:
            await db.execute(delete(InvestigadorProyecto).where(InvestigadorProyecto.codigo_proyecto == codigo))
            for inv_data in investigadores:
                db_inv = InvestigadorProyecto(
                    codigo_proyecto=codigo,
                    dni_investigador=inv_data["dni_investigador"],
                    condicion_rol=inv_data["condicion_rol"],
                    tipo_vinculo=inv_data.get("tipo_vinculo", "Docente"),
                    facultad_integrante=inv_data.get("facultad_integrante", "Ingeniería de Sistemas e Informática"),
                    condicion_gi=inv_data.get("condicion_gi", None)
                )
                db.add(db_inv)

        await db.commit()
        await db.refresh(p)
        logger.info(f"[SGPI-CFPI] Project updated successfully: {codigo!r}")

        background_tasks.add_task(
            log_audit_event,
            db=None,
            tipo_evento="UPDATE",
            entidad_afectada="proyecto",
            pk_entidad=codigo,
            valor_anterior=valor_anterior,
            valor_nuevo=update_data,
            id_usuario=current_user.get("sub"),
        )
        return p

    except Exception as e:
        await db.rollback()
        handle_db_integrity_error(e)

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

class HitoVerifyCybertesisRequest(BaseModel):
    thesis_url: Optional[str] = None
    titulo_tesis: Optional[str] = None
    autor_texto: Optional[str] = None
    anio_publicacion: Optional[int] = None
    resumen: Optional[str] = None

@router.post("/{codigo}/deliverables/{id_entregable}/verify-cybertesis", response_model=EntregableResponse)
async def verify_deliverable_cybertesis(
    codigo: str,
    id_entregable: int,
    obj_in: Optional[HitoVerifyCybertesisRequest] = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    logger.info(f"[SGPI-CFPI] Verifying deliverable {id_entregable} for project {codigo!r} with Cybertesis")
    
    p = await proyecto.get_by_codigo(db, codigo=codigo)
    if not p:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
        
    result = await db.execute(
        select(Entregable)
        .where(Entregable.id_entregable == id_entregable)
        .where(Entregable.codigo_proyecto == codigo)
    )
    db_obj = result.scalars().first()
    if not db_obj:
        raise HTTPException(status_code=404, detail="Entregable no encontrado")
        
    thesis_url = obj_in.thesis_url if obj_in else None
    
    if not thesis_url:
        queries = []
        res_miembros = await db.execute(
            select(InvestigadorProyecto)
            .where(InvestigadorProyecto.codigo_proyecto == codigo)
            .where(or_(InvestigadorProyecto.condicion_rol == "Tesista", InvestigadorProyecto.condicion_rol == "Tesista vinculado"))
        )
        tesistas = res_miembros.scalars().all()
        for t in tesistas:
            from app.models.domain import Investigador
            res_inv = await db.execute(
                select(Investigador).where(Investigador.dni == t.dni_investigador)
            )
            inv = res_inv.scalars().first()
            if inv:
                queries.append(f"{inv.nombres} {inv.apellidos}")
                
        if not queries:
            queries.append(p.titulo_proyecto)
            
        if not CybertesisAPIEngine:
            raise HTTPException(status_code=500, detail="El conector Cybertesis no está configurado.")
            
        engine = CybertesisAPIEngine()
        found_thesis = None
        for q in queries:
            try:
                results = engine.search(query=q, limit=5, quiet=True)
                if results and results.resultados:
                    for t in results.resultados:
                        found_thesis = t
                        break
                if found_thesis:
                    break
            except Exception as e:
                logger.error(f"Error consultando Cybertesis para query '{q}': {e}")
                
        if not found_thesis:
            raise HTTPException(
                status_code=400, 
                detail="No se encontró una coincidencia automática en Cybertesis. Intente buscar de forma manual."
            )
            
        thesis_url = str(found_thesis.url_repositorio)
        thesis_title = found_thesis.titulo
        thesis_author = ", ".join(found_thesis.autores)
        thesis_year = found_thesis.anio_publicacion
        thesis_abstract = found_thesis.resumen
    else:
        thesis_title = obj_in.titulo_tesis or "Tesis importada"
        thesis_author = obj_in.autor_texto or "Desconocido"
        thesis_year = obj_in.anio_publicacion or datetime.now().year
        thesis_abstract = obj_in.resumen or ""

    from app.models.domain import Tesis
    try:
        res_tesis = await db.execute(
            select(Tesis).where(Tesis.url_cybertesis == thesis_url)
        )
        local_tesis = res_tesis.scalars().first()
        if not local_tesis:
            new_tesis = Tesis(
                url_cybertesis=thesis_url,
                titulo_tesis=thesis_title,
                resumen_abstract=thesis_abstract,
                autor_estudiante_texto=thesis_author,
                asesor_texto="No especificado",
                anio_publicacion=thesis_year,
                created_at=datetime.now(timezone.utc)
            )
            db.add(new_tesis)
            await db.flush()
            logger.info(f"Persistida tesis '{thesis_title}' localmente en DB.")
    except Exception as e:
        logger.error(f"Error persistiendo tesis '{thesis_url}' en DB local: {e}")

    old_estado = db_obj.estado_entregable
    db_obj.estado_entregable = "Completado"
    db_obj.fecha_entrega_real = date.today()
    db_obj.archivo_url = thesis_url
    db.add(db_obj)
    
    res_deliv = await db.execute(
        select(Entregable)
        .where(Entregable.codigo_proyecto == codigo)
        .order_by(Entregable.id_entregable.asc())
    )
    deliverables = res_deliv.scalars().all()
    if deliverables:
        current_idx = -1
        for idx, d in enumerate(deliverables):
            if d.id_entregable == id_entregable:
                current_idx = idx
                break
        if current_idx != -1 and current_idx + 1 < len(deliverables):
            next_d = deliverables[current_idx + 1]
            if next_d.estado_entregable.lower() == "bloqueado":
                next_d.estado_entregable = "Pendiente"
                db.add(next_d)

    p_status = p.estado_proyecto if p else "En ejecución"
    db.add(ProyectoEstadoHistorial(
        codigo_proyecto=codigo,
        estado_anterior=p_status,
        estado_nuevo=p_status,
        justificacion=f"Autoverificación con Cybertesis completada. Tesis asociada: {thesis_url}",
        id_usuario_responsable=current_user.get("sub"),
    ))

    await db.commit()
    await db.refresh(db_obj)
    
    await log_audit_event(
        db=db,
        tipo_evento="UPDATE",
        entidad_afectada="entregable",
        pk_entidad=str(id_entregable),
        valor_anterior={"estado_entregable": old_estado},
        valor_nuevo={"estado_entregable": "Completado", "archivo_url": thesis_url},
        id_usuario=current_user.get("sub"),
    )
    
    return db_obj
