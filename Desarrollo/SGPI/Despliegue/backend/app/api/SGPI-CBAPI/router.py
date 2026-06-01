from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from app.db.session import get_db
from app.core.security import get_current_user
from .schemas import SearchRequest, SearchResponse
from .search_engine import SearchEngine

router = APIRouter()
search_engine = SearchEngine()


@router.get("/global", response_model=SearchResponse)
@router.get("/", response_model=SearchResponse)
async def advanced_global_search(
    q: str = Query(..., min_length=3, description="Search term (at least 3 characters)"),
    category: Optional[List[str]] = Query(
        None, description="Categories: Investigador, Proyecto, Grupo, Publicacion, Tesis"
    ),
    source: Optional[List[str]] = Query(None, description="Sources: RAIS, RENACYT, Cybertesis, Manual"),
    status: Optional[List[str]] = Query(None, description="States or vigencia of items"),
    anio_inicio: Optional[int] = Query(None, description="Filter from this year (inclusive)"),
    anio_fin: Optional[int] = Query(None, description="Filter until this year (inclusive)"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, le=100, description="Items per page"),
    sort_by: str = Query("relevance", description="Sort by: relevance, date, title"),
    sort_order: str = Query("desc", description="Sort order: asc, desc"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> SearchResponse:
    """
    Exposes the Global Integrated Search Engine (CU08).
    Allows free-text search with combinable parametric filters, relevance/date/title sorting,
    and structured pagination across five core research entities:
    - Investigadores
    - Proyectos
    - Grupos de Investigación
    - Publicaciones
    - Tesis
    """
    # Create request schema
    req = SearchRequest(
        q=q,
        category=category,
        source=source,
        status=status,
        anio_inicio=anio_inicio,
        anio_fin=anio_fin,
        page=page,
        limit=limit,
        sort_by=sort_by,
        sort_order=sort_order,
    )

    try:
        response = await search_engine.search(db, req)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred during global search: {str(e)}")
