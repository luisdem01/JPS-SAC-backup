import os
import sys
import re
import unicodedata
from typing import List
from sqlalchemy import select, or_, extract, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domain import Investigador, Proyecto, GrupoInvestigacion, Publicacion, Tesis
from .schemas import SearchRequest, UnifiedSearchItem, SearchResponse
from app.core.logger import logger

def remove_accents(s: str) -> str:
    if not s:
        return ""
    return "".join(c for c in unicodedata.normalize('NFKD', s) if not unicodedata.combining(c))


# Import dynamic logic for connectors
current_dir = os.path.dirname(os.path.abspath(__file__))
csapiren_path = os.path.abspath(os.path.join(current_dir, '..', '..', 'etl', 'connectors', 'SGPI-CSAPIREN'))
if csapiren_path not in sys.path:
    sys.path.insert(0, csapiren_path)

csapicyb_path = os.path.abspath(os.path.join(current_dir, '..', '..', 'etl', 'connectors', 'SGPI-CSAPICYB'))
if csapicyb_path not in sys.path:
    sys.path.insert(0, csapicyb_path)

try:
    from renacyt_connector.api import RenacytConnector
except ImportError:
    RenacytConnector = None

try:
    from cybertesis_connector.engines.api_engine import CybertesisAPIEngine
except ImportError:
    CybertesisAPIEngine = None


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
        q_clean = remove_accents(q.lower())
        title_clean = remove_accents(item.title.lower())
        id_clean = remove_accents(item.id.lower())
        
        score = 0
        
        # Match in ID (exact or prefix)
        if id_clean == q_clean:
            score += 100
        elif id_clean.startswith(q_clean):
            score += 50
        elif q_clean in id_clean:
            score += 25
            
        # Match in Title
        if title_clean == q_clean:
            score += 80
        elif title_clean.startswith(q_clean):
            score += 40
        elif q_clean in title_clean:
            score += 20
            
        # Match in specific category or source
        if q_clean in remove_accents(item.category.lower()):
            score += 5
        if q_clean in remove_accents(item.source.lower()):
            score += 5
            
        # Add points for detailed matches in details dict
        for val in item.details.values():
            if isinstance(val, str) and q_clean in remove_accents(val.lower()):
                score += 10
                
        return score

    @staticmethod
    def _extract_date_str(item: UnifiedSearchItem) -> str:
        if item.date:
            return item.date
        return "0000-00-00"

    async def search(self, db: AsyncSession, req: SearchRequest) -> SearchResponse:
        logger.info(
            f"SearchEngine.search: Iniciando motor de búsqueda "
            f"para query='{req.q}'"
        )
        q_term = f"%{req.q}%"
        results: List[UnifiedSearchItem] = []
        
        # Determine which categories to query
        categories_to_query = req.category if req.category else ["Investigador", "Proyecto", "Grupo", "Publicacion", "Tesis"]
        
        # 1. Query Investigadores
        if "Investigador" in categories_to_query:
            # Check if we should execute live search
            is_live_renacyt = req.live_renacyt or (req.source and "RENACYT_LIVE" in req.source)
            
            if is_live_renacyt:
                # Query RENACYT connector
                live_results = []
                if RenacytConnector is not None:
                    try:
                        logger.info(f"SearchEngine: Iniciando consulta en vivo a RENACYT para query '{req.q}'")
                        connector = RenacytConnector(verify_ssl=False)
                        connector.rate_limit_delay = 0.1
                        
                        clean_query = req.q.strip()
                        is_dni = bool(re.match(r'^\d{8}$', clean_query))
                        
                        records = []
                        if is_dni:
                            r = await connector.search_by_dni(clean_query)
                            if r:
                                records = [r]
                        else:
                            res = await connector.search_by_fullname(clean_query, page=1, page_size=50)
                            records = res.get("data", []) if res else []
                            
                        for r in records:
                            doc_id = r.get("numero_documento") or r.get("codigo_registro") or str(r.get("id", ""))
                            title = f"{r.get('apellido_paterno', '')} {r.get('apellido_materno', '')}, {r.get('nombres', '')}".strip()
                            title = " ".join(title.split()) # normalize whitespace
                            
                            is_sm = False
                            for inst in [r.get("institucion_laboral_principal"), r.get("institucion_laboral_actual")]:
                                if inst and any(x in str(inst).upper() for x in ["SAN MARCOS", "UNMSM"]):
                                    is_sm = True
                                    break
                                    
                            date_str = r.get("fecha_ingreso_renacyt") or r.get("fecha_inicio_vigencia")
                            
                            # Filter by status if requested
                            status_val = r.get("condicion") or "Activo"
                            if req.status and status_val not in req.status:
                                continue
                                
                            # Filter by years if requested
                            if date_str:
                                try:
                                    year_val = int(date_str.split("-")[0])
                                    if req.anio_inicio and year_val < req.anio_inicio:
                                        continue
                                    if req.anio_fin and year_val > req.anio_fin:
                                        continue
                                except (ValueError, IndexError):
                                    pass
                                    
                            live_results.append(UnifiedSearchItem(
                                id=doc_id,
                                title=title,
                                category="Investigador",
                                source="Conector RENACYT",
                                status=status_val,
                                date=date_str,
                                details={
                                    "departamento_academico": r.get("institucion_laboral_principal") or "Externo (RENACYT)",
                                    "categoria_renacyt": r.get("nivel") or r.get("grupo") or "Sin nivel",
                                    "codigo_renacyt": r.get("codigo_registro"),
                                    "investigador_sm": is_sm,
                                    "tiene_deuda_gi": False,
                                    "tiene_deuda_pi": False,
                                    "is_external": True
                                }
                            ))
                        logger.info(f"SearchEngine: Consulta RENACYT en vivo retornó {len(live_results)} resultados")
                    except Exception as e:
                        logger.error(f"SearchEngine: Error consultando RENACYT en vivo: {e}", exc_info=True)
                else:
                    logger.error("SearchEngine: RenacytConnector no está importado o disponible.")
                
                results.extend(live_results)
            else:
                # Normal database query
                stmt = select(Investigador).where(
                    or_(
                        func.unaccent(Investigador.nombres).ilike(func.unaccent(q_term)),
                        func.unaccent(Investigador.apellidos).ilike(func.unaccent(q_term)),
                        func.unaccent(Investigador.dni).ilike(func.unaccent(q_term)),
                        func.unaccent(Investigador.departamento_academico).ilike(func.unaccent(q_term)),
                        func.unaccent(Investigador.codigo_renacyt).ilike(func.unaccent(q_term))
                    )
                )
                
                # Filter by status
                if req.status:
                    stmt = stmt.where(Investigador.estado_vigencia.in_(req.status))
                    
                db_res = await db.execute(stmt)
                raw_invs = db_res.scalars().all()
                logger.info(
                    f"SearchEngine: Investigadores BD retornó {len(raw_invs)} "
                    f"registros para query '{req.q}'"
                )
                inv_added = 0
                for inv in raw_invs:
                    src = self._deduce_source_investigador(inv)
                    # Filter by source
                    if req.source and src not in req.source:
                        continue

                    # Excluir registros externos (temporal de búsqueda RENACYT previa)
                    # para que sólo aparezcan investigadores formalizados en la BD local.
                    if inv.is_external:
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
                    inv_added += 1
                logger.info(
                    f"SearchEngine: Investigadores filtrados - "
                    f"Agregados: {inv_added}/{len(raw_invs)}"
                )

        # 2. Query Proyectos
        if "Proyecto" in categories_to_query:
            stmt = select(Proyecto).where(
                or_(
                    func.unaccent(Proyecto.titulo_proyecto).ilike(func.unaccent(q_term)),
                    func.unaccent(Proyecto.codigo_proyecto).ilike(func.unaccent(q_term)),
                    func.unaccent(Proyecto.resolucion_aprobacion).ilike(func.unaccent(q_term)),
                    func.unaccent(Proyecto.tipo_proyecto).ilike(func.unaccent(q_term)),
                    func.unaccent(Proyecto.tipo_programa).ilike(func.unaccent(q_term)),
                    func.unaccent(Proyecto.area_academica).ilike(func.unaccent(q_term))
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
            raw_projs = db_res.scalars().all()
            logger.info(
                f"SearchEngine: Proyectos BD retornó {len(raw_projs)} "
                f"registros para query '{req.q}'"
            )
            proj_added = 0
            for proj in raw_projs:
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
                proj_added += 1
            logger.info(
                f"SearchEngine: Proyectos filtrados - "
                f"Agregados: {proj_added}/{len(raw_projs)}"
            )

        # 3. Query Grupos de Investigacion
        if "Grupo" in categories_to_query:
            stmt = select(GrupoInvestigacion).where(
                or_(
                    func.unaccent(GrupoInvestigacion.nombre_grupo).ilike(func.unaccent(q_term)),
                    func.unaccent(GrupoInvestigacion.codigo_grupo).ilike(func.unaccent(q_term)),
                    func.unaccent(GrupoInvestigacion.siglas).ilike(func.unaccent(q_term)),
                    func.unaccent(GrupoInvestigacion.descripcion).ilike(func.unaccent(q_term))
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
            raw_grupos = db_res.scalars().all()
            logger.info(
                f"SearchEngine: Grupos BD retornó {len(raw_grupos)} "
                f"registros para query '{req.q}'"
            )
            grupo_added = 0
            for grupo in raw_grupos:
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
                grupo_added += 1
            logger.info(
                f"SearchEngine: Grupos filtrados - "
                f"Agregados: {grupo_added}/{len(raw_grupos)}"
            )

        # 4. Query Publicaciones
        if "Publicacion" in categories_to_query:
            stmt = select(Publicacion).where(
                or_(
                    func.unaccent(Publicacion.titulo_articulo).ilike(func.unaccent(q_term)),
                    func.unaccent(Publicacion.doi_codigo).ilike(func.unaccent(q_term)),
                    func.unaccent(Publicacion.issn).ilike(func.unaccent(q_term)),
                    func.unaccent(Publicacion.nombre_revista).ilike(func.unaccent(q_term)),
                    func.unaccent(Publicacion.nombre_evento).ilike(func.unaccent(q_term)),
                    func.unaccent(Publicacion.indexacion).ilike(func.unaccent(q_term))
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
            raw_pubs = db_res.scalars().all()
            logger.info(
                f"SearchEngine: Publicaciones BD retornó {len(raw_pubs)} "
                f"registros para query '{req.q}'"
            )
            pub_added = 0
            for pub in raw_pubs:
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
                pub_added += 1
            logger.info(
                f"SearchEngine: Publicaciones filtradas - "
                f"Agregados: {pub_added}/{len(raw_pubs)}"
            )

        # 5. Query Tesis
        if "Tesis" in categories_to_query:
            is_live_cybertesis = req.live_cybertesis or (req.source and "Cybertesis" in req.source)
            
            if is_live_cybertesis and CybertesisAPIEngine is not None:
                live_results = []
                try:
                    logger.info(f"SearchEngine: Iniciando consulta en vivo a Cybertesis para query '{req.q}'")
                    engine = CybertesisAPIEngine()
                    api_res = engine.search(query=req.q, limit=20, quiet=True)
                    
                    from app.core.cache import cache_set
                    import base64
                    
                    def local_encode_id(url: str) -> str:
                        return "tes-" + base64.urlsafe_b64encode(url.encode()).decode().rstrip('=')
                        
                    for t in api_res.resultados:
                        t_url = str(t.url_repositorio)
                        encoded_id = local_encode_id(t_url)
                        
                        # Cache the raw object for cfpt.py fallback
                        cache_key = f"cybertesis:item:{encoded_id}"
                        cache_data = {
                            "url_cybertesis": t_url,
                            "titulo_tesis": t.titulo,
                            "resumen_abstract": t.resumen,
                            "cita_apa": f"{', '.join(t.autores)} ({t.anio_publicacion}). {t.titulo}.",
                            "derechos_licencia": None,
                            "url_licencia": None,
                            "formato_archivo": "PDF",
                            "idioma_iso": "es",
                            "tipo_recurso": "Thesis",
                            "anio_publicacion": t.anio_publicacion,
                            "fecha_registro_cybertesis": None,
                            "fecha_disponibilidad": None,
                            "autor_estudiante_texto": ", ".join(t.autores),
                            "dni_tesista": None,
                            "asesor_texto": ", ".join(t.asesores),
                            "dni_asesor": None,
                            "orcid_asesor": None,
                            "codigo_disciplina": None,
                            "nivel_grado": t.grado_academico,
                            "tipo_trabajo": "Trabajo de investigación",
                            "escuela_profesional": None,
                            "grado_obtenido": t.grado_academico,
                            "institucion_concedente": None,
                            "editorial": None,
                            "pais_publicacion": "PE",
                            "palabras_clave": t.palabras_clave,
                            "jurados_evaluadores": []
                        }
                        try:
                            await cache_set(cache_key, cache_data, 7200)
                        except Exception as cache_err:
                            logger.error(f"SearchEngine: Error cacheando tesis {t_url}: {cache_err}")
                            
                        # Filter by year range if requested
                        if req.anio_inicio and t.anio_publicacion and t.anio_publicacion < req.anio_inicio:
                            continue
                        if req.anio_fin and t.anio_publicacion and t.anio_publicacion > req.anio_fin:
                            continue
                            
                        live_results.append(UnifiedSearchItem(
                            id=t_url,
                            title=t.titulo,
                            category="Tesis",
                            source="Cybertesis",
                            status="Activo",
                            date=f"{t.anio_publicacion}-01-01" if t.anio_publicacion else None,
                            details={
                                "autor_estudiante": ", ".join(t.autores),
                                "asesor": ", ".join(t.asesores),
                                "escuela_profesional": "Ingeniería de Sistemas / Software",
                                "nivel_grado": t.grado_academico,
                                "grado_obtenido": t.grado_academico,
                                "url_cybertesis": t_url,
                                "is_external": True
                            }
                        ))
                    logger.info(f"SearchEngine: Consulta Cybertesis en vivo retornó {len(live_results)} resultados")
                except Exception as e:
                    logger.error(f"SearchEngine: Error consultando Cybertesis en vivo: {e}", exc_info=True)
                results.extend(live_results)
            else:
                stmt = select(Tesis).where(
                    or_(
                        func.unaccent(Tesis.titulo_tesis).ilike(func.unaccent(q_term)),
                        func.unaccent(Tesis.autor_estudiante_texto).ilike(func.unaccent(q_term)),
                        func.unaccent(Tesis.asesor_texto).ilike(func.unaccent(q_term)),
                        func.unaccent(Tesis.escuela_profesional).ilike(func.unaccent(q_term)),
                        func.unaccent(Tesis.grado_obtenido).ilike(func.unaccent(q_term))
                    )
                )
                
                # Tesis does not have status, assume 'Activo'
                # Filter by year range
                if req.anio_inicio:
                    stmt = stmt.where(Tesis.anio_publicacion >= req.anio_inicio)
                if req.anio_fin:
                    stmt = stmt.where(Tesis.anio_publicacion <= req.anio_fin)
                    
                db_res = await db.execute(stmt)
                raw_tesis = db_res.scalars().all()
                logger.info(
                    f"SearchEngine: Tesis BD retornó {len(raw_tesis)} "
                    f"registros para query '{req.q}'"
                )
                tesis_added = 0
                for tesis in raw_tesis:
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
                            "url_cybertesis": tesis.url_cybertesis,
                            "is_external": False
                        }
                    ))
                    tesis_added += 1
                logger.info(
                    f"SearchEngine: Tesis filtradas - "
                    f"Agregados: {tesis_added}/{len(raw_tesis)}"
                )

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
        
        # Calculate counts per category on the filtered results
        category_counts = {
            "Investigador": 0,
            "Proyecto": 0,
            "Grupo": 0,
            "Publicacion": 0,
            "Tesis": 0
        }
        for item in results:
            if item.category in category_counts:
                category_counts[item.category] += 1

        start_idx = (page - 1) * limit
        end_idx = start_idx + limit
        paginated_results = results[start_idx:end_idx]

        return SearchResponse(
            total_results=total_results,
            page=page,
            limit=limit,
            total_pages=total_pages,
            results=paginated_results,
            category_counts=category_counts
        )
