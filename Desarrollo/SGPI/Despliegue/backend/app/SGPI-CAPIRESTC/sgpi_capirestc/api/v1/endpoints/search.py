from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any, List, Optional

from app.db.session import get_db
from app.core.security import get_current_user
from app.core.logger import logger
import importlib
from sgpi_capirestc.api.v1.endpoints.cfpt import encode_tesis_id

# Dynamic import to handle hyphenated folder name "SGPI-CBAPI"
_se_module = importlib.import_module("app.api.SGPI-CBAPI.search_engine")
SearchEngine = _se_module.SearchEngine

_schemas_module = importlib.import_module("app.api.SGPI-CBAPI.schemas")
SearchRequest = _schemas_module.SearchRequest

router = APIRouter()
search_engine = SearchEngine()

def parse_list_param(param: Optional[List[str]], single_param: Optional[str] = None) -> Optional[List[str]]:
    res = []
    if param:
        for p in param:
            res.extend([x.strip() for x in p.split(",") if x.strip()])
    if single_param:
        res.extend([x.strip() for x in single_param.split(",") if x.strip()])
    return res if res else None

CATEGORY_MAPPING = {
    "investigators": "Investigador",
    "investigator": "Investigador",
    "projects": "Proyecto",
    "project": "Proyecto",
    "groups": "Grupo",
    "group": "Grupo",
    "publications": "Publicacion",
    "publication": "Publicacion",
    "tesis": "Tesis",
    "thesis": "Tesis",

    # Spanish/singular/plural variations
    "investigadores": "Investigador",
    "proyectos": "Proyecto",
    "grupos": "Grupo",
    "publicaciones": "Publicacion",
}


@router.get("/")
async def global_search(
    q: str = Query(..., min_length=3, description="Search query string (at least 3 characters)"),
    category: Optional[List[str]] = Query(None, alias="category"),
    categories: Optional[str] = Query(None, alias="categories"),
    type: Optional[str] = Query(None, alias="type"),
    types: Optional[str] = Query(None, alias="types"),
    source: Optional[List[str]] = Query(None, alias="source"),
    sources: Optional[str] = Query(None, alias="sources"),
    status: Optional[List[str]] = Query(None, alias="status"),
    anio_inicio: Optional[int] = Query(None, alias="anio_inicio"),
    anioDesde: Optional[int] = Query(None, alias="anioDesde"),
    anio_fin: Optional[int] = Query(None, alias="anio_fin"),
    anioHasta: Optional[int] = Query(None, alias="anioHasta"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    perPage: Optional[int] = Query(None, alias="perPage"),
    sort_by: str = Query("relevance", description="Sort by relevance, date, title"),
    sortBy: Optional[str] = Query(None, alias="sortBy"),
    sort_order: str = Query("desc", description="Sort order: asc, desc"),
    live_renacyt: bool = Query(False, description="Force live query through RENACYT connector"),
    live_cybertesis: bool = Query(False, description="Force live query through Cybertesis connector"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Unified global search endpoint utilizing the advanced SearchEngine.
    Exposes pagination, filters (categories, sources, status, date range), and sorting.
    Maps response to match the frontend expectations.
    """
    if isinstance(current_user, dict):
        user_name = current_user.get("username")
    else:
        user_name = str(current_user)

    logger.info(
        f"Búsqueda Global - Usuario: {user_name} - Query: '{q}' - "
        f"category/categories: {category}/{categories} - "
        f"type/types: {type}/{types} - "
        f"source/sources: {source}/{sources} - status: {status} - "
        f"años: {anio_inicio or anioDesde} a {anio_fin or anioHasta} - "
        f"page: {page}, limit: {limit or perPage}, "
        f"sort: {sort_by or sortBy} ({sort_order})"
    )

    if not q or len(q.strip()) < 3:
        logger.warning(f"Búsqueda Global rechazada (query muy corto): '{q}'")
        raise HTTPException(
            status_code=400,
            detail="La consulta debe tener al menos 3 caracteres"
        )

    # 1. Parse categories/types
    cats = parse_list_param(category)
    if categories:
        cats = parse_list_param(cats, categories)
    if type:
        cats = parse_list_param(cats, type)
    if types:
        cats = parse_list_param(cats, types)

    mapped_categories = None
    if cats:
        mapped_categories = []
        for c in cats:
            c_low = c.lower()
            if c_low in CATEGORY_MAPPING:
                mapped_categories.append(CATEGORY_MAPPING[c_low])
            else:
                mapped_categories.append(c)

    # 2. Parse source/sources
    srcs = parse_list_param(source, sources)
    mapped_sources = None
    if srcs:
        mapped_sources = []
        for s in srcs:
            s_low = s.lower()
            if s_low == "cybertesis":
                mapped_sources.append("Cybertesis")
            elif s_low == "rais":
                mapped_sources.append("RAIS")
            elif s_low == "renacyt":
                mapped_sources.append("RENACYT")
            elif s_low == "vrip":
                mapped_sources.append("VRIP")
            elif s_low == "manual":
                mapped_sources.append("Manual")
            else:
                mapped_sources.append(s)

    # 3. Parse years
    start_year = anio_inicio if anio_inicio is not None else anioDesde
    end_year = anio_fin if anio_fin is not None else anioHasta

    # 4. Parse page / limit
    page_num = page
    limit_num = perPage if perPage is not None else limit

    # 5. Parse sort
    sort_field = sortBy if sortBy is not None else sort_by
    if sort_field == "fecha":
        sort_field = "date"
    elif sort_field == "titulo":
        sort_field = "title"

    # Create search request
    req = SearchRequest(
        q=q.strip(),
        category=mapped_categories,
        source=mapped_sources,
        status=status,
        anio_inicio=start_year,
        anio_fin=end_year,
        page=page_num,
        limit=limit_num,
        sort_by=sort_field,
        sort_order=sort_order,
        live_renacyt=live_renacyt,
        live_cybertesis=live_cybertesis
    )

    logger.info(
        f"Ejecutando SearchEngine.search para query: '{req.q}', "
        f"categories={req.category}"
    )
    try:
        response = await search_engine.search(db, req)
        logger.info(
            f"SearchEngine.search completada - matches totales: "
            f"{response.total_results}, devueltos: "
            f"{len(response.results)}, counts: {response.category_counts}"
        )
    except Exception as e:
        logger.error(
            f"Error ejecutando SearchEngine.search para query '{q}': {e}",
            exc_info=True
        )
        raise HTTPException(
            status_code=500,
            detail=f"Error al realizar la búsqueda: {str(e)}"
        )

    # Map categories back to frontend format
    category_back_mapping = {
        "Investigador": "investigators",
        "Proyecto": "projects",
        "Grupo": "groups",
        "Publicacion": "publications",
        "Tesis": "tesis"
    }

    mapped_items = []
    for item in response.results:
        mapped_type = category_back_mapping.get(item.category, "projects")

        # Build a nice excerpt depending on entity details
        excerpt = ""
        if item.category == "Investigador":
            dept = item.details.get("departamento_academico", "")
            cat = item.details.get("categoria_renacyt", "")
            excerpt = f"Investigador en {dept}. Categoría RENACYT: {cat}."
        elif item.category == "Proyecto":
            tipo = item.details.get("tipo_proyecto", "")
            res = item.details.get("resolucion_aprobacion", "")
            excerpt = f"Proyecto de tipo {tipo}. Resolución: {res}."
        elif item.category == "Grupo":
            desc = item.details.get("descripcion", "")
            siglas = item.details.get("siglas", "")
            excerpt = desc if desc else f"Grupo de investigación ({siglas})."
        elif item.category == "Publicacion":
            rev = item.details.get("nombre_revista", "")
            index = item.details.get("indexacion", "")
            excerpt = f"Publicado en {rev}. Indexado en {index}."
        elif item.category == "Tesis":
            escuela = item.details.get("escuela_profesional", "")
            asesor = item.details.get("asesor", "")
            excerpt = f"Tesis de {escuela}. Asesorado por {asesor}."

        mapped_items.append({
            "id": encode_tesis_id(item.id) if item.category == "Tesis" and not item.id.startswith("tes-") else item.id,
            "type": mapped_type,
            "title": item.title,
            "excerpt": excerpt,
            "source": item.source,
            "status": item.status,
            "date": item.date,
            "details": item.details
        })

    # Prepare counts object mapping
    raw_counts = response.category_counts or {}
    counts = {
        "proyecto": raw_counts.get("Proyecto", 0),
        "investigador": raw_counts.get("Investigador", 0),
        "publicacion": raw_counts.get("Publicacion", 0),
        "grupo": raw_counts.get("Grupo", 0),
        "tesis": raw_counts.get("Tesis", 0)
    }

    # Prepare standard paginated response dictionary for the frontend
    return {
        "items": mapped_items,
        "total": response.total_results,
        "page": response.page,
        "limit": response.limit,
        "pages": response.total_pages,
        "counts": counts
    }
