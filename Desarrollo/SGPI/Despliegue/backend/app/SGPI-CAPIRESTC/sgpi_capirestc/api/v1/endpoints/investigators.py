from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
from pydantic import BaseModel
import math
import os
import sys
import re
from datetime import datetime, timezone

from app.db.session import get_db
from app.models.domain import Investigador, HistorialPuntaje, InvestigadorProyecto, InvestigadorPublicacion, Tesis, DepartamentoAcademico
from app.core.logger import logger
from sgpi_capirestc.crud.crud_investigador import investigador
from sgpi_capirestc.schemas.domain_schemas import InvestigadorCreate, InvestigadorUpdate, InvestigadorResponse
from app.core.security import get_current_user
from app.core.audit import log_audit_event
from app.db.errors import handle_db_integrity_error

# Inyección dinámica para importar el conector RENACYT
current_dir = os.path.dirname(os.path.abspath(__file__))
app_dir = os.path.abspath(os.path.join(current_dir, '..', '..', '..', '..', '..'))
csapiren_path = os.path.join(app_dir, 'etl', 'connectors', 'SGPI-CSAPIREN')

if csapiren_path not in sys.path:
    sys.path.insert(0, csapiren_path)

try:
    from renacyt_connector.api import RenacytConnector
except ImportError:
    RenacytConnector = None
router = APIRouter()


def _map_raw_record_to_dict(r: dict) -> dict:
    dni = r.get("numero_documento")
    nombres = r.get("nombres", "").title()
    apellidos = f"{r.get('apellido_paterno', '')} {r.get('apellido_materno', '')}".strip().title()
    return {
        "dni": dni,
        "nombres": nombres,
        "apellidos": apellidos,
        "codigo_interno_vrip": None,
        "condicion_laboral": None,
        "departamento_academico": "Externo (RENACYT)",
        "facultad_dependencia": "Ingeniería de Sistemas e Informática",
        "grado_academico_max": None,
        "institucion_principal": r.get("institucion_laboral_principal"),
        "codigo_renacyt": r.get("codigo_registro"),
        "orcid": r.get("orcid"),
        "categoria_renacyt": r.get("nivel", "Sin nivel"),
        "estado_renacyt": r.get("condicion"),
        "url_cti_vitae": r.get("cti_vitae"),
        "investigador_sm": "SAN MARCOS" in (r.get("institucion_laboral_principal") or "").upper() or "UNMSM" in (r.get("institucion_laboral_principal") or "").upper(),
        "estado_vigencia": "Activo",
        "tiene_deuda_gi": False,
        "tiene_deuda_pi": False,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "is_external": True
    }


async def _persist_external_record(db: AsyncSession, r: dict, current_user: dict) -> Investigador:
    dni = r.get("numero_documento")
    nombres = r.get("nombres", "").title()
    apellidos = f"{r.get('apellido_paterno', '')} {r.get('apellido_materno', '')}".strip().title()
    
    db_item = await db.get(Investigador, dni)
    if not db_item:
        db_item = Investigador(
            dni=dni,
            nombres=nombres,
            apellidos=apellidos,
            codigo_interno_vrip=None,
            condicion_laboral=None,
            departamento_academico="Externo (RENACYT)",
            facultad_dependencia="Ingeniería de Sistemas e Informática",
            grado_academico_max=None,
            institucion_principal=r.get("institucion_laboral_principal"),
            codigo_renacyt=r.get("codigo_registro"),
            orcid=r.get("orcid"),
            categoria_renacyt=r.get("nivel", "Sin nivel"),
            estado_renacyt=r.get("condicion"),
            url_cti_vitae=r.get("cti_vitae"),
            investigador_sm="SAN MARCOS" in (r.get("institucion_laboral_principal") or "").upper() or "UNMSM" in (r.get("institucion_laboral_principal") or "").upper(),
            estado_vigencia="Activo",
            tiene_deuda_gi=False,
            tiene_deuda_pi=False,
            is_external=True
        )
        db.add(db_item)
        await db.commit()
        logger.info(f"Persistido investigador externo con DNI {dni} en base de datos local")
        
        await log_audit_event(
            db=db,
            tipo_evento="INSERT",
            entidad_afectada="investigador",
            pk_entidad=dni,
            valor_nuevo={
                "dni": dni,
                "nombres": nombres,
                "apellidos": apellidos,
                "is_external": True,
                "estado_vigencia": "Activo"
            },
            id_usuario=current_user.get("sub") if current_user else None,
        )
    return db_item


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
    live_renacyt: bool = Query(False),
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
        clean_term = buscar.strip()
        if re.match(r'^\d{8}$', clean_term):
            filters.append(Investigador.dni == clean_term)
        else:
            words = [word.strip() for word in clean_term.split() if word.strip()]
            if words:
                word_filters = []
                for word in words:
                    term = f"%{word}%"
                    word_filters.append(or_(
                        func.unaccent(Investigador.apellidos).ilike(func.unaccent(term)),
                        func.unaccent(Investigador.nombres).ilike(func.unaccent(term))
                    ))
                filters.append(and_(*word_filters))
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

    # Excluir registros externos (captados del conector RENACYT pero no formalizados)
    # cuando no se pide búsqueda en vivo. Así sólo aparecen los investigadores
    # que están registrados oficialmente en la base de datos local.
    if not live_renacyt:
        filters.append(
            or_(Investigador.is_external == False, Investigador.is_external == None)  # noqa: E711, E712
        )

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

    # Fallback a RENACYT si se solicita búsqueda en vivo y no se encontraron resultados locales
    if live_renacyt and total == 0 and buscar and buscar.strip() and RenacytConnector:
        logger.info(f"No se encontraron resultados locales para '{buscar}'. Consultando caché/RENACYT...")
        try:
            from app.core.cache import normalize_query, cache_get, cache_set
            
            clean_query = buscar.strip()
            normalized = normalize_query(clean_query)
            cache_key = f"renacyt:search:{normalized}:p{page}:l{limit}"
            
            # 1. Verificar si existe en Redis
            cached_data = await cache_get(cache_key)
            if cached_data is not None:
                logger.info(f"Cache hit para búsqueda '{buscar}' (key: {cache_key})")
                cached_items = cached_data.get("items", [])
                cached_total = cached_data.get("total", 0)
                return {
                    "items": cached_items,
                    "total": cached_total,
                    "page": page,
                    "pages": math.ceil(cached_total / limit) if cached_total > 0 else 1
                }
            
            # Cache miss: Consultar conector
            logger.info(f"Cache miss para búsqueda '{buscar}'. Llamando a conector RENACYT...")
            connector = RenacytConnector(verify_ssl=False)
            connector.rate_limit_delay = 0.1
            
            is_dni = re.match(r'^\d{8}$', clean_query)
            
            records = []
            external_total = 0
            if is_dni:
                r = await connector.search_by_dni(clean_query)
                if r:
                    records = [r]
                    external_total = 1
            else:
                res = await connector.search_by_fullname(clean_query, page=page, page_size=limit)
                records = res.get("data", []) if res else []
                external_total = res.get("total", 0) if res else 0
            
            external_items = []
            for r in records:
                item_dict = _map_raw_record_to_dict(r)
                external_items.append(item_dict)
                
                # Persistencia Local Proactiva
                try:
                    await _persist_external_record(db, r, current_user)
                except Exception as db_err:
                    logger.error(f"Error al guardar investigador externo {r.get('numero_documento')} en DB local: {db_err}")
            
            # Guardar en Redis
            cache_val = {"total": external_total, "items": external_items}
            if external_items:
                # 1 hora para resultados válidos (3600 segundos)
                await cache_set(cache_key, cache_val, 3600)
                logger.info(f"Guardados {len(external_items)} resultados en Redis para clave: {cache_key} (TTL 1h)")
            else:
                # 24 horas para búsquedas vacías (86400 segundos)
                await cache_set(cache_key, {"total": 0, "items": []}, 86400)
                logger.info(f"Guardado resultado vacío en Redis para clave: {cache_key} (TTL 24h)")
                
            return {
                "items": external_items,
                "total": external_total,
                "page": page,
                "pages": math.ceil(external_total / limit) if external_total > 0 else 1
            }
        except Exception as e:
            logger.error(f"Error consultando el conector RENACYT / Caché: {e}", exc_info=True)

    return {
        "items": items,
        "total": total,
        "page": page,
        "pages": pages
    }


class StatsResponse(BaseModel):
    totalDocentes: int
    deltaEsteMes: int
    investigadoresRenacyt: int
    porcentajeRenacyt: int
    vigenciasPorVencer: int
    proyectosActivos: int
    cicloAcademico: str

@router.get("/stats", response_model=StatsResponse)
async def get_investigators_stats(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    # Total docentes (excluding is_external)
    stmt_total = select(func.count(Investigador.dni)).where(or_(Investigador.is_external == False, Investigador.is_external == None))  # noqa: E711, E712
    res_total = await db.execute(stmt_total)
    total = res_total.scalar_one()

    # Investigadores Renacyt (excluding is_external)
    stmt_renacyt = select(func.count(Investigador.dni)).where(
        and_(
            or_(Investigador.is_external == False, Investigador.is_external == None),  # noqa: E711, E712
            Investigador.categoria_renacyt != 'No Clasificado',
            Investigador.categoria_renacyt != 'Sin nivel'
        )
    )
    res_renacyt = await db.execute(stmt_renacyt)
    renacyt = res_renacyt.scalar_one()

    # Vigencias por vencer (excluding is_external)
    stmt_vencer = select(func.count(Investigador.dni)).where(
        and_(
            or_(Investigador.is_external == False, Investigador.is_external == None),  # noqa: E711, E712
            Investigador.estado_vigencia == 'Por Vencer'
        )
    )
    res_vencer = await db.execute(stmt_vencer)
    vencer = res_vencer.scalar_one()

    # Proyectos activos
    from app.models.domain import Proyecto
    stmt_proy = select(func.count(Proyecto.codigo_proyecto)).where(Proyecto.estado_proyecto == 'En ejecución')
    res_proy = await db.execute(stmt_proy)
    proyectos_activos = res_proy.scalar_one()

    porcentaje = round((renacyt / total) * 100) if total > 0 else 0

    return {
        "totalDocentes": total,
        "deltaEsteMes": 0,
        "investigadoresRenacyt": renacyt,
        "porcentajeRenacyt": porcentaje,
        "vigenciasPorVencer": vencer,
        "proyectosActivos": proyectos_activos,
        "cicloAcademico": "2026-I"
    }

@router.get("/catalogos/departamentos", response_model=List[str])
async def get_departamentos(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    stmt = select(DepartamentoAcademico.nombre).where(DepartamentoAcademico.estado == "Aprobado")
    res = await db.execute(stmt)
    results = res.scalars().all()
    return sorted(list({r for r in results if r}))


@router.get("/catalogos/niveles-renacyt", response_model=List[str])
async def get_niveles_renacyt(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    stmt = select(Investigador.categoria_renacyt).distinct().where(
        Investigador.categoria_renacyt != None  # noqa: E711
    )
    res = await db.execute(stmt)
    results = res.scalars().all()
    
    default_niveles = [
        'NIVEL I', 'NIVEL II', 'NIVEL III', 'NIVEL IV',
        'NIVEL V', 'NIVEL VI', 'NIVEL VII', 'DISTINGUIDO', 'Sin nivel'
    ]
    
    niveles_set = {r for r in results if r}
    for nivel in default_niveles:
        niveles_set.add(nivel)
        
    order_map = {nivel: i for i, nivel in enumerate(default_niveles)}
    return sorted(list(niveles_set), key=lambda x: order_map.get(x, 999))

@router.get("/{dni}/exists")
async def check_dni_exists(
    dni: str,
    exclude: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    clean_dni = dni.strip()
    stmt = select(Investigador.dni).where(Investigador.dni == clean_dni)
    if exclude:
        stmt = stmt.where(Investigador.dni != exclude.strip())
    res = await db.execute(stmt)
    existing_dni = res.scalar_one_or_none()
    return {"duplicado": existing_dni is not None, "existenteId": existing_dni}

class ProyectoHistorialResponse(BaseModel):
    id: str
    codigo: str
    titulo: str
    rol: str
    anioInicio: int
    anioFin: Optional[int] = None
    presupuesto: float
    entidadFinanciadora: str
    estado: str

@router.get("/{dni}/projects", response_model=List[ProyectoHistorialResponse])
async def get_investigator_projects(
    dni: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    from app.models.domain import InvestigadorProyecto, Proyecto
    stmt = select(InvestigadorProyecto, Proyecto).join(
        Proyecto, InvestigadorProyecto.codigo_proyecto == Proyecto.codigo_proyecto
    ).where(InvestigadorProyecto.dni_investigador == dni)
    
    res = await db.execute(stmt)
    rows = res.all()
    
    result = []
    for inv_proj, proj in rows:
        fecha_ini = proj.fecha_inicio
        anio_inicio = fecha_ini.year if fecha_ini else datetime.now().year
        
        estado_mapped = 'en_evaluacion'
        if proj.estado_proyecto == 'En ejecución':
            estado_mapped = 'en_ejecucion'
        elif proj.estado_proyecto == 'Concluido':
            estado_mapped = 'finalizado'
            
        result.append({
            "id": f"{proj.codigo_proyecto}-{dni}",
            "codigo": proj.codigo_proyecto,
            "titulo": proj.titulo_proyecto,
            "rol": inv_proj.condicion_rol,
            "anioInicio": anio_inicio,
            "anioFin": None,
            "presupuesto": float(proj.presupuesto_asignado or 0.0),
            "entidadFinanciadora": "VRIP-UNMSM",
            "estado": estado_mapped
        })
    return result

async def _populate_investigador_counts(db: AsyncSession, inv: Investigador) -> Investigador:
    if not inv:
        return inv
    
    # Contar proyectos
    stmt_proy = select(func.count(InvestigadorProyecto.codigo_proyecto)).where(
        InvestigadorProyecto.dni_investigador == inv.dni
    )
    res_proy = await db.execute(stmt_proy)
    inv.proyectos_count = res_proy.scalar_one()
    
    # Contar publicaciones (artículos + tesis)
    stmt_pub = select(func.count(InvestigadorPublicacion.id_publicacion)).where(
        InvestigadorPublicacion.dni_investigador == inv.dni
    )
    res_pub = await db.execute(stmt_pub)
    pub_count = res_pub.scalar_one()
    
    stmt_tesis = select(func.count(Tesis.url_cybertesis)).where(
        Tesis.dni_asesor == inv.dni
    )
    res_tesis = await db.execute(stmt_tesis)
    tesis_count = res_tesis.scalar_one()
    
    inv.publicaciones_count = pub_count + tesis_count
    return inv

@router.get("/{dni}", response_model=InvestigadorResponse)
async def get_investigador(dni: str, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    clean_term = dni.strip()
    is_dni = re.match(r'^\d{8}$', clean_term)
    
    if is_dni:
        # 1. Buscar localmente por DNI
        inv = await investigador.get_by_dni(db, dni=clean_term)
        if inv:
            return await _populate_investigador_counts(db, inv)
            
        # 2. Fallback a RENACYT por DNI
        if RenacytConnector:
            logger.info(f"DNI '{clean_term}' no encontrado localmente. Consultando caché/RENACYT...")
            try:
                from app.core.cache import cache_get, cache_set
                
                cache_key = f"renacyt:dni:{clean_term}"
                
                # Check Redis
                cached_data = await cache_get(cache_key)
                if cached_data is not None:
                    if not cached_data: # empty cache hit
                        raise HTTPException(status_code=404, detail="Investigador no encontrado")
                    
                    # Check if already saved in local DB
                    db_inv = await db.get(Investigador, clean_term)
                    if db_inv:
                        return await _populate_investigador_counts(db, db_inv)
                    
                    inv = await _persist_external_record(db, cached_data, current_user)
                    return await _populate_investigador_counts(db, inv)
                
                # Cache miss: query conector
                connector = RenacytConnector(verify_ssl=False)
                connector.rate_limit_delay = 0.1
                r = await connector.search_by_dni(clean_term)
                
                if r:
                    # Guardar en Redis (24 horas = 86400 segundos)
                    await cache_set(cache_key, r, 86400)
                    # Persistir localmente
                    inv = await _persist_external_record(db, r, current_user)
                    return await _populate_investigador_counts(db, inv)
                else:
                    # Guardar exclusion cache en Redis (24 horas = 86400 segundos)
                    await cache_set(cache_key, {}, 86400)
            except Exception as e:
                logger.error(f"Error consultando DNI {clean_term} en conector/caché: {e}", exc_info=True)
                
    else:
        # No es DNI, buscar por nombre
        # 1. Buscar localmente por nombre
        words = [word.strip() for word in clean_term.split() if word.strip()]
        if words:
            word_filters = []
            for word in words:
                term = f"%{word}%"
                word_filters.append(or_(
                    func.unaccent(Investigador.apellidos).ilike(func.unaccent(term)),
                    func.unaccent(Investigador.nombres).ilike(func.unaccent(term))
                ))
            stmt = select(Investigador).where(and_(*word_filters)).limit(1)
            result = await db.execute(stmt)
            inv = result.scalar_one_or_none()
            if inv:
                return await _populate_investigador_counts(db, inv)
                
        # 2. Fallback a RENACYT por nombre (traer 1 resultado)
        if RenacytConnector:
            logger.info(f"Nombre '{clean_term}' no encontrado localmente. Consultando caché/RENACYT...")
            try:
                from app.core.cache import normalize_query, cache_get, cache_set
                normalized = normalize_query(clean_term)
                cache_key = f"renacyt:search:{normalized}:p1:l1"
                
                # Check Redis
                cached_data = await cache_get(cache_key)
                if cached_data is not None:
                    cached_items = cached_data.get("items", [])
                    if cached_items:
                        first_item = cached_items[0]
                        dni_val = first_item.get("dni")
                        if dni_val:
                            db_inv = await db.get(Investigador, dni_val)
                            if db_inv:
                                return await _populate_investigador_counts(db, db_inv)
                            
                            # Si está en el caché pero no en BD por alguna razón, buscar por DNI
                            connector = RenacytConnector(verify_ssl=False)
                            connector.rate_limit_delay = 0.1
                            r = await connector.search_by_dni(dni_val)
                            if r:
                                inv = await _persist_external_record(db, r, current_user)
                                return await _populate_investigador_counts(db, inv)
                    else:
                        raise HTTPException(status_code=404, detail="Investigador no encontrado")
                        
                # Cache miss: query conector
                connector = RenacytConnector(verify_ssl=False)
                connector.rate_limit_delay = 0.1
                res = await connector.search_by_fullname(clean_term, page=1, page_size=1)
                records = res.get("data", []) if res else []
                
                if records:
                    r = records[0]
                    dni_val = r.get("numero_documento")
                    if dni_val:
                        mapped_item = _map_raw_record_to_dict(r)
                        cache_val = {"total": res.get("total", 1), "items": [mapped_item]}
                        await cache_set(cache_key, cache_val, 3600)
                        
                        # Guardar también caché de DNI
                        dni_cache_key = f"renacyt:dni:{dni_val}"
                        await cache_set(dni_cache_key, r, 86400)
                        
                        inv = await _persist_external_record(db, r, current_user)
                        return await _populate_investigador_counts(db, inv)
                else:
                    await cache_set(cache_key, {"total": 0, "items": []}, 86400)
            except Exception as e:
                logger.error(f"Error consultando nombre {clean_term} en conector/caché: {e}", exc_info=True)
                
    raise HTTPException(status_code=404, detail="Investigador no encontrado")


@router.post("/", response_model=InvestigadorResponse)
async def create_investigador(
    obj_in: InvestigadorCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    inv = await db.get(Investigador, obj_in.dni)
    if inv:
        raise HTTPException(status_code=400, detail="Investigador with this DNI already exists")
    
    # Extraer historial
    historial_in = obj_in.historial_puntaje
    
    # Crear modelo de Investigador
    dump_data = obj_in.model_dump(exclude={"historial_puntaje"})
    new_inv = Investigador(**dump_data)
    
    try:
        db.add(new_inv)
        await db.flush() # para asegurarnos de que la FK no falle
        
        if historial_in:
            for hp in historial_in:
                db_hp = HistorialPuntaje(
                    dni_investigador=new_inv.dni,
                    anio_evaluacion=hp.anio_evaluacion,
                    puntaje_total=hp.puntaje_total,
                    puntaje_revistas=hp.puntaje_revistas,
                    puntaje_libros=hp.puntaje_libros,
                    puntaje_proyectos=hp.puntaje_proyectos,
                    puntaje_patentes=hp.puntaje_patentes,
                    puntaje_tesis=hp.puntaje_tesis,
                    puntaje_otros=hp.puntaje_otros
                )
                db.add(db_hp)
        
        await db.commit()
        
        # Recargar para devolver con la relación lazy selectin cargada
        await db.refresh(new_inv)
        
        background_tasks.add_task(
            log_audit_event,
            db=None,
            tipo_evento="INSERT",
            entidad_afectada="investigador",
            pk_entidad=new_inv.dni,
            valor_nuevo=obj_in.model_dump(),
            id_usuario=current_user.get("sub") if current_user else None,
        )
        return new_inv
    except IntegrityError as e:
        await db.rollback()
        handle_db_integrity_error(e)
    except Exception as e:
        await db.rollback()
        logger.error(f"Error al crear investigador: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=f"Error al crear investigador: {str(e)}")

@router.put("/{dni}", response_model=InvestigadorResponse)
async def update_investigador(
    dni: str,
    obj_in: InvestigadorUpdate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    inv = await db.get(Investigador, dni)
    if not inv:
        raise HTTPException(status_code=404, detail="Investigador no encontrado")
        
    valor_anterior = {k: getattr(inv, k) for k in obj_in.model_dump(exclude_unset=True, exclude={"historial_puntaje"}).keys() if hasattr(inv, k)}
    
    # Extraer historial
    historial_in = obj_in.historial_puntaje
    
    # Actualizar campos de Investigador
    update_data = obj_in.model_dump(exclude_unset=True, exclude={"historial_puntaje"})
    for field, value in update_data.items():
        setattr(inv, field, value)
        
    try:
        db.add(inv)
        
        # Si se incluye historial_puntaje en la petición (aunque sea lista vacía), sincronizarlo
        if historial_in is not None:
            # Eliminar existentes
            stmt_del = select(HistorialPuntaje).where(HistorialPuntaje.dni_investigador == dni)
            res_del = await db.execute(stmt_del)
            for existing_hp in res_del.scalars().all():
                await db.delete(existing_hp)
            await db.flush()
            
            # Insertar nuevos
            for hp in historial_in:
                db_hp = HistorialPuntaje(
                    dni_investigador=dni,
                    anio_evaluacion=hp.anio_evaluacion,
                    puntaje_total=hp.puntaje_total,
                    puntaje_revistas=hp.puntaje_revistas,
                    puntaje_libros=hp.puntaje_libros,
                    puntaje_proyectos=hp.puntaje_proyectos,
                    puntaje_patentes=hp.puntaje_patentes,
                    puntaje_tesis=hp.puntaje_tesis,
                    puntaje_otros=hp.puntaje_otros
                )
                db.add(db_hp)
                
        await db.commit()
        await db.refresh(inv)
        
        background_tasks.add_task(
            log_audit_event,
            db=None,
            tipo_evento="UPDATE",
            entidad_afectada="investigador",
            pk_entidad=dni,
            valor_anterior=valor_anterior,
            valor_nuevo=obj_in.model_dump(exclude_unset=True),
            id_usuario=current_user.get("sub") if current_user else None,
        )
        return inv
    except IntegrityError as e:
        await db.rollback()
        handle_db_integrity_error(e)
    except Exception as e:
        await db.rollback()
        logger.error(f"Error al actualizar investigador: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=f"Error al actualizar investigador: {str(e)}")

@router.patch("/{dni}/protect", response_model=InvestigadorResponse)
async def toggle_investigador_protection(
    dni: str,
    protect: bool = Query(..., description="Establece si el investigador está protegido manualmente"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    inv = await db.get(Investigador, dni)
    if not inv:
        raise HTTPException(status_code=404, detail="Investigador no encontrado")
        
    valor_anterior = {"protegido_manualmente": inv.protegido_manualmente}
    inv.protegido_manualmente = protect
    
    try:
        db.add(inv)
        await db.commit()
        await db.refresh(inv)
        
        background_tasks.add_task(
            log_audit_event,
            db=None,
            tipo_evento="UPDATE",
            entidad_afectada="investigador",
            pk_entidad=dni,
            valor_anterior=valor_anterior,
            valor_nuevo={"protegido_manualmente": protect},
            id_usuario=current_user.get("sub") if current_user else None,
        )
        return inv
    except Exception as e:
        await db.rollback()
        logger.error(f"Error al cambiar protección manual del investigador: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=f"Error al cambiar protección del investigador: {str(e)}")
