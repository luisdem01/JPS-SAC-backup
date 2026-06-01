import asyncio
from typing import List, Dict, Any, Optional
from sqlalchemy import select, or_, and_, extract
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, date

from app.models.domain import Investigador, Proyecto, GrupoInvestigacion, Publicacion, Tesis
from .schemas import SearchRequest, UnifiedSearchItem, SearchResponse

class SearchEngine:
    @staticmethod
    def _deduce_source_investigador(inv: Investigador) -> str:
        if inv.codigo_renacyt or (inv.categoria_renacyt and inv.categoria_renacyt != "No Clasificado"):
            return "RENACYT"
        elif inv.codigo_interno_vrip:
            return "RAIS"
        return "Manual"

    @staticmethod
    def _deduce_source_proyecto(proj: Proyecto) -> str:
        # If code matches standard patterns
        if proj.codigo_proyecto and (proj.codigo_proyecto.startswith("F") or proj.codigo_proyecto.startswith("A") or len(proj.codigo_proyecto) > 6):
            return "RAIS"
        elif proj.resolucion_aprobacion:
            return "VRIP"
        return "Manual"

    @staticmethod
    def _deduce_source_grupo(grupo: GrupoInvestigacion) -> str:
        if grupo.codigo_grupo and (grupo.codigo_grupo.startswith("GI") or len(grupo.codigo_grupo) > 4):
            return "RAIS"
        elif grupo.url_vrip:
            return "VRIP"
        return "Manual"

    @staticmethod
    def _deduce_source_publicacion(pub: Publicacion) -> str:
        if pub.indexacion or pub.cuartil_impacto:
            return "RENACYT"
        return "Manual"

    @staticmethod
    def _deduce_source_tesis(tesis: Tesis) -> str:
        if tesis.url_cybertesis:
            return "Cybertesis"
        return "Manual"

    @staticmethod
    def _calculate_relevance(q: str, item: UnifiedSearchItem) -> int:
        q_lower = q.lower()
        title_lower = item.title.lower()
        id_lower = item.id.lower()
        
        score = 0
        
        # Match in ID (exact or prefix)
        if id_lower == q_lower:
            score += 100
        elif id_lower.startswith(q_lower):
            score += 50
        elif q_lower in id_lower:
            score += 25
            
        # Match in Title
        if title_lower == q_lower:
            score += 80
        elif title_lower.startswith(q_lower):
            score += 40
        elif q_lower in title_lower:
            score += 20
            
        # Match in specific category or source
        if q_lower in item.category.lower():
            score += 5
        if q_lower in item.source.lower():
            score += 5
            
        # Add points for detailed matches in details dict
        for val in item.details.values():
            if isinstance(val, str) and q_lower in val.lower():
                score += 10
                
        return score

    @staticmethod
    def _extract_date_str(item: UnifiedSearchItem) -> str:
        if item.date:
            return item.date
        return "0000-00-00"

    async def search(self, db: AsyncSession, req: SearchRequest) -> SearchResponse:
        q_term = f"%{req.q}%"
        results: List[UnifiedSearchItem] = []
        
        # Determine which categories to query
        categories_to_query = req.category if req.category else ["Investigador", "Proyecto", "Grupo", "Publicacion", "Tesis"]
        
        # 1. Query Investigadores
        if "Investigador" in categories_to_query:
            # Check source filters (RENACYT or RAIS or Manual)
            # If source is specified, check if we need to query this table at all
            stmt = select(Investigador).where(
                or_(
                    Investigador.nombres.ilike(q_term),
                    Investigador.apellidos.ilike(q_term),
                    Investigador.dni.ilike(q_term),
                    Investigador.departamento_academico.ilike(q_term),
                    Investigador.codigo_renacyt.ilike(q_term)
                )
            )
            
            # Filter by status
            if req.status:
                stmt = stmt.where(Investigador.estado_vigencia.in_(req.status))
                
            db_res = await db.execute(stmt)
            for inv in db_res.scalars().all():
                src = self._deduce_source_investigador(inv)
                # Filter by source
                if req.source and src not in req.source:
                    continue
                
                # Check years (Investigadores don't have explicit years, but we can match created_at year if filter is set)
                inv_year = inv.created_at.year if inv.created_at else None
                if req.anio_inicio and (not inv_year or inv_year < req.anio_inicio):
                    continue
                if req.anio_fin and (not inv_year or inv_year > req.anio_fin):
                    continue

                date_str = inv.created_at.strftime("%Y-%m-%d") if inv.created_at else None
                
                results.append(UnifiedSearchItem(
                    id=inv.dni,
                    title=f"{inv.apellidos}, {inv.nombres}",
                    category="Investigador",
                    source=src,
                    status=inv.estado_vigencia,
                    date=date_str,
                    details={
                        "departamento_academico": inv.departamento_academico,
                        "categoria_renacyt": inv.categoria_renacyt,
                        "codigo_renacyt": inv.codigo_renacyt,
                        "investigador_sm": inv.investigador_sm,
                        "tiene_deuda_gi": inv.tiene_deuda_gi,
                        "tiene_deuda_pi": inv.tiene_deuda_pi,
                        "is_external": inv.is_external
                    }
                ))

        # 2. Query Proyectos
        if "Proyecto" in categories_to_query:
            stmt = select(Proyecto).where(
                or_(
                    Proyecto.titulo_proyecto.ilike(q_term),
                    Proyecto.codigo_proyecto.ilike(q_term),
                    Proyecto.resolucion_aprobacion.ilike(q_term),
                    Proyecto.tipo_proyecto.ilike(q_term),
                    Proyecto.tipo_programa.ilike(q_term),
                    Proyecto.area_academica.ilike(q_term)
                )
            )
            
            # Filter by status
            if req.status:
                stmt = stmt.where(Proyecto.estado_proyecto.in_(req.status))
            
            # Filter by year range (anio_convocatoria or fecha_inicio year)
            if req.anio_inicio:
                stmt = stmt.where(
                    or_(
                        Proyecto.anio_convocatoria >= req.anio_inicio,
                        extract('year', Proyecto.fecha_inicio) >= req.anio_inicio
                    )
                )
            if req.anio_fin:
                stmt = stmt.where(
                    or_(
                        Proyecto.anio_convocatoria <= req.anio_fin,
                        extract('year', Proyecto.fecha_inicio) <= req.anio_fin
                    )
                )
                
            db_res = await db.execute(stmt)
            for proj in db_res.scalars().all():
                src = self._deduce_source_proyecto(proj)
                if req.source and src not in req.source:
                    continue
                
                proj_date = proj.fecha_inicio.strftime("%Y-%m-%d") if proj.fecha_inicio else None
                
                results.append(UnifiedSearchItem(
                    id=proj.codigo_proyecto,
                    title=proj.titulo_proyecto,
                    category="Proyecto",
                    source=src,
                    status=proj.estado_proyecto,
                    date=proj_date,
                    details={
                        "resolucion_aprobacion": proj.resolucion_aprobacion,
                        "tipo_proyecto": proj.tipo_proyecto,
                        "tipo_programa": proj.tipo_programa,
                        "presupuesto_asignado": float(proj.presupuesto_asignado) if proj.presupuesto_asignado else 0.0,
                        "anio_convocatoria": proj.anio_convocatoria
                    }
                ))

        # 3. Query Grupos de Investigacion
        if "Grupo" in categories_to_query:
            stmt = select(GrupoInvestigacion).where(
                or_(
                    GrupoInvestigacion.nombre_grupo.ilike(q_term),
                    GrupoInvestigacion.codigo_grupo.ilike(q_term),
                    GrupoInvestigacion.siglas.ilike(q_term),
                    GrupoInvestigacion.descripcion.ilike(q_term)
                )
            )
            
            # Filter by status
            if req.status:
                stmt = stmt.where(GrupoInvestigacion.estado_grupo.in_(req.status))
            
            # Filter by year range
            if req.anio_inicio:
                stmt = stmt.where(extract('year', GrupoInvestigacion.fecha_reconocimiento) >= req.anio_inicio)
            if req.anio_fin:
                stmt = stmt.where(extract('year', GrupoInvestigacion.fecha_reconocimiento) <= req.anio_fin)
                
            db_res = await db.execute(stmt)
            for grupo in db_res.scalars().all():
                src = self._deduce_source_grupo(grupo)
                if req.source and src not in req.source:
                    continue
                
                grupo_date = grupo.fecha_reconocimiento.strftime("%Y-%m-%d") if grupo.fecha_reconocimiento else None
                
                results.append(UnifiedSearchItem(
                    id=grupo.codigo_grupo,
                    title=grupo.nombre_grupo,
                    category="Grupo",
                    source=src,
                    status=grupo.estado_grupo,
                    date=grupo_date,
                    details={
                        "siglas": grupo.siglas,
                        "descripcion": grupo.descripcion,
                        "correo_coordinador": grupo.correo_coordinador,
                        "lineas_investigacion": grupo.lineas_investigacion
                    }
                ))

        # 4. Query Publicaciones
        if "Publicacion" in categories_to_query:
            stmt = select(Publicacion).where(
                or_(
                    Publicacion.titulo_articulo.ilike(q_term),
                    Publicacion.doi_codigo.ilike(q_term),
                    Publicacion.issn.ilike(q_term),
                    Publicacion.nombre_revista.ilike(q_term),
                    Publicacion.nombre_evento.ilike(q_term),
                    Publicacion.indexacion.ilike(q_term)
                )
            )
            
            # Publicacion does not have status, so skip status check or filter out if status is strictly set to something inapplicable
            if req.status and "Activo" not in req.status:
                # If they explicitly filtered status and 'Activo' is not in it, we skip publications or return them depending on logic.
                # Usually publications are always active.
                pass
                
            # Filter by year range
            if req.anio_inicio:
                stmt = stmt.where(extract('year', Publicacion.fecha_publicacion) >= req.anio_inicio)
            if req.anio_fin:
                stmt = stmt.where(extract('year', Publicacion.fecha_publicacion) <= req.anio_fin)
                
            db_res = await db.execute(stmt)
            for pub in db_res.scalars().all():
                src = self._deduce_source_publicacion(pub)
                if req.source and src not in req.source:
                    continue
                
                pub_date = pub.fecha_publicacion.strftime("%Y-%m-%d") if pub.fecha_publicacion else None
                
                results.append(UnifiedSearchItem(
                    id=str(pub.id_publicacion),
                    title=pub.titulo_articulo,
                    category="Publicacion",
                    source=src,
                    status="Activo",
                    date=pub_date,
                    details={
                        "doi_codigo": pub.doi_codigo,
                        "issn": pub.issn,
                        "tipo_publicacion": pub.tipo_publicacion,
                        "nombre_revista": pub.nombre_revista,
                        "cuartil_impacto": pub.cuartil_impacto,
                        "indexacion": pub.indexacion
                    }
                ))

        # 5. Query Tesis
        if "Tesis" in categories_to_query:
            stmt = select(Tesis).where(
                or_(
                    Tesis.titulo_tesis.ilike(q_term),
                    Tesis.autor_estudiante_texto.ilike(q_term),
                    Tesis.asesor_texto.ilike(q_term),
                    Tesis.escuela_profesional.ilike(q_term),
                    Tesis.grado_obtenido.ilike(q_term)
                )
            )
            
            # Tesis does not have status, assume 'Activo'
            # Filter by year range
            if req.anio_inicio:
                stmt = stmt.where(Tesis.anio_publicacion >= req.anio_inicio)
            if req.anio_fin:
                stmt = stmt.where(Tesis.anio_publicacion <= req.anio_fin)
                
            db_res = await db.execute(stmt)
            for tesis in db_res.scalars().all():
                src = self._deduce_source_tesis(tesis)
                if req.source and src not in req.source:
                    continue
                
                tesis_date = f"{tesis.anio_publicacion}-01-01" if tesis.anio_publicacion else None
                
                results.append(UnifiedSearchItem(
                    id=tesis.url_cybertesis,
                    title=tesis.titulo_tesis,
                    category="Tesis",
                    source=src,
                    status="Activo",
                    date=tesis_date,
                    details={
                        "autor_estudiante": tesis.autor_estudiante_texto,
                        "asesor": tesis.asesor_texto,
                        "escuela_profesional": tesis.escuela_profesional,
                        "nivel_grado": tesis.nivel_grado,
                        "grado_obtenido": tesis.grado_obtenido,
                        "url_cybertesis": tesis.url_cybertesis
                    }
                ))

        # --- Relevance & Sorting ---
        # If sort_by is relevance, calculate and sort by relevance score
        if req.sort_by == "relevance":
            # Precalculate scores
            scored_results = [(self._calculate_relevance(req.q, item), item) for item in results]
            # Sort by score descending (high to low)
            scored_results.sort(key=lambda x: x[0], reverse=(req.sort_order == "desc"))
            results = [item for score, item in scored_results]
        elif req.sort_by == "date":
            results.sort(key=self._extract_date_str, reverse=(req.sort_order == "desc"))
        elif req.sort_by == "title":
            results.sort(key=lambda x: x.title.lower(), reverse=(req.sort_order == "desc"))

        # --- Pagination ---
        total_results = len(results)
        limit = req.limit
        page = req.page
        total_pages = (total_results + limit - 1) // limit if total_results > 0 else 0
        
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit
        paginated_results = results[start_idx:end_idx]

        return SearchResponse(
            total_results=total_results,
            page=page,
            limit=limit,
            total_pages=total_pages,
            results=paginated_results
        )
