from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from typing import Dict, Any, List
import asyncio
import app.db.session

from app.db.session import get_db
from app.models.domain import Investigador, GrupoInvestigacion, Proyecto, Publicacion, Tesis
from app.core.security import get_current_user

router = APIRouter()

@router.get("/")
async def global_search(q: str, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)) -> Dict[str, List[Any]]:
    if not q or len(q) < 3:
        raise HTTPException(status_code=400, detail="La consulta debe tener al menos 3 caracteres")
        
    term = f"%{q}%"
    
    async def search_investigadores(session: AsyncSession):
        stmt = select(Investigador).where(
            or_(
                Investigador.nombres.ilike(term),
                Investigador.apellidos.ilike(term),
                Investigador.dni.ilike(term)
            )
        ).limit(10)
        result = await session.execute(stmt)
        return [{"tipo": "Investigador", "id": i.dni, "nombres": i.nombres, "apellidos": i.apellidos} for i in result.scalars().all()]
            
    async def search_grupos(session: AsyncSession):
        stmt = select(GrupoInvestigacion).where(
            or_(
                GrupoInvestigacion.nombre_grupo.ilike(term),
                GrupoInvestigacion.codigo_grupo.ilike(term)
            )
        ).limit(10)
        result = await session.execute(stmt)
        return [{"tipo": "Grupo", "id": g.codigo_grupo, "nombre": g.nombre_grupo} for g in result.scalars().all()]
            
    async def search_proyectos(session: AsyncSession):
        stmt = select(Proyecto).where(
            or_(
                Proyecto.titulo_proyecto.ilike(term),
                Proyecto.codigo_proyecto.ilike(term)
            )
        ).limit(10)
        result = await session.execute(stmt)
        return [{"tipo": "Proyecto", "id": p.codigo_proyecto, "titulo": p.titulo_proyecto} for p in result.scalars().all()]
            
    async def search_publicaciones(session: AsyncSession):
        stmt = select(Publicacion).where(Publicacion.titulo_articulo.ilike(term)).limit(10)
        result = await session.execute(stmt)
        return [{"tipo": "Publicacion", "id": str(p.id_publicacion), "titulo": p.titulo_articulo} for p in result.scalars().all()]
            
    async def search_tesis(session: AsyncSession):
        stmt = select(Tesis).where(
            or_(
                Tesis.titulo_tesis.ilike(term),
                Tesis.autor_estudiante_texto.ilike(term)
            )
        ).limit(10)
        result = await session.execute(stmt)
        return [{"tipo": "Tesis", "id": t.url_cybertesis, "titulo": t.titulo_tesis} for t in result.scalars().all()]

    # Execute searches sequentially using the injected session to avoid IllegalStateChangeError
    investigadores = await search_investigadores(db)
    grupos = await search_grupos(db)
    proyectos = await search_proyectos(db)
    publicaciones = await search_publicaciones(db)
    tesis = await search_tesis(db)
    
    return {
        "investigadores": investigadores,
        "grupos": grupos,
        "proyectos": proyectos,
        "publicaciones": publicaciones,
        "tesis": tesis
    }
