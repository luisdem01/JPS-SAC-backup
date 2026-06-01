from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


class SearchRequest(BaseModel):
    q: str = Field(..., min_length=3, description="Search query string (at least 3 characters)")
    category: Optional[List[str]] = Field(
        default=None, description="Filter by categories (Investigador, Proyecto, Grupo, Publicacion, Tesis)"
    )
    source: Optional[List[str]] = Field(
        default=None, description="Filter by data sources (RAIS, RENACYT, Cybertesis, Manual)"
    )
    status: Optional[List[str]] = Field(default=None, description="Filter by state / status")
    anio_inicio: Optional[int] = Field(default=None, description="Filter from this year (inclusive)")
    anio_fin: Optional[int] = Field(default=None, description="Filter until this year (inclusive)")
    page: int = Field(default=1, ge=1, description="Page number (starts from 1)")
    limit: int = Field(default=10, ge=1, le=100, description="Records per page (1 to 100)")
    sort_by: str = Field(default="relevance", description="Sort field (relevance, date, title)")
    sort_order: str = Field(default="desc", description="Sort order (asc, desc)")
    live_renacyt: bool = Field(default=False, description="Force live query through RENACYT connector")
    live_cybertesis: bool = Field(default=False, description="Force live query through Cybertesis connector")


class UnifiedSearchItem(BaseModel):
    id: str = Field(..., description="Unique identifier of the entity")
    title: str = Field(..., description="Main title or name of the entity")
    category: str = Field(..., description="Entity type: Investigador, Proyecto, Grupo, Publicacion, Tesis")
    source: str = Field(..., description="Deducted data source: RAIS, RENACYT, Cybertesis, Manual")
    status: Optional[str] = Field(default=None, description="Current operational state or status")
    date: Optional[str] = Field(default=None, description="Associated date (as YYYY-MM-DD or year)")
    details: Dict[str, Any] = Field(default_factory=dict, description="Metadata dictionary specific to each category")


class SearchResponse(BaseModel):
    total_results: int = Field(..., description="Total matching records found")
    page: int = Field(..., description="Current page number")
    limit: int = Field(..., description="Items per page limit")
    total_pages: int = Field(..., description="Total pages of results")
    results: List[UnifiedSearchItem] = Field(..., description="List of paginated results")
    category_counts: Optional[Dict[str, int]] = Field(default=None, description="Counts of matching records per category")

