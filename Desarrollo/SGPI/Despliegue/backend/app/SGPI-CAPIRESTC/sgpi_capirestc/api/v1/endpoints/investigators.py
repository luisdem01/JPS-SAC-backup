from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_
from typing import List, Optional
from pydantic import BaseModel
import math
import os
import sys
import re
from datetime import datetime, timezone

from app.db.session import get_db
from app.models.domain import Investigador
from app.core.logger import logger
from sgpi_capirestc.crud.crud_investigador import investigador
from sgpi_capirestc.schemas.domain_schemas import InvestigadorCreate, InvestigadorUpdate, InvestigadorResponse
from app.core.security import get_current_user
from app.core.audit import log_audit_event

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
                        Investigador.apellidos.ilike(term),
                        Investigador.nombres.ilike(term)
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

    # Fallback a RENACYT si no se encontraron resultados locales y se ingresó un término de búsqueda
    if total == 0 and buscar and buscar.strip() and RenacytConnector:
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


@router.get("/{dni}", response_model=InvestigadorResponse)
async def get_investigador(dni: str, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    clean_term = dni.strip()
    is_dni = re.match(r'^\d{8}$', clean_term)
    
    if is_dni:
        # 1. Buscar localmente por DNI
        inv = await investigador.get_by_dni(db, dni=clean_term)
        if inv:
            return inv
            
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
                        return db_inv
                    
                    return await _persist_external_record(db, cached_data, current_user)
                
                # Cache miss: query conector
                connector = RenacytConnector(verify_ssl=False)
                connector.rate_limit_delay = 0.1
                r = await connector.search_by_dni(clean_term)
                
                if r:
                    # Guardar en Redis (24 horas = 86400 segundos)
                    await cache_set(cache_key, r, 86400)
                    # Persistir localmente
                    return await _persist_external_record(db, r, current_user)
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
                    Investigador.apellidos.ilike(term),
                    Investigador.nombres.ilike(term)
                ))
            stmt = select(Investigador).where(and_(*word_filters)).limit(1)
            result = await db.execute(stmt)
            inv = result.scalar_one_or_none()
            if inv:
                return inv
                
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
                                return db_inv
                            
                            # Si está en el caché pero no en BD por alguna razón, buscar por DNI
                            connector = RenacytConnector(verify_ssl=False)
                            connector.rate_limit_delay = 0.1
                            r = await connector.search_by_dni(dni_val)
                            if r:
                                return await _persist_external_record(db, r, current_user)
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
                        
                        return await _persist_external_record(db, r, current_user)
                else:
                    await cache_set(cache_key, {"total": 0, "items": []}, 86400)
            except Exception as e:
                logger.error(f"Error consultando nombre {clean_term} en conector/caché: {e}", exc_info=True)
                
    raise HTTPException(status_code=404, detail="Investigador no encontrado")


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
