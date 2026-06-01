import sys
import os
import json
import time
from typing import Dict, Any, List, Optional

from pydantic import ValidationError
from app.core.logger import logger, log_connector_status

from sgpi_ci.engines.parsers import ParserFactory
from sgpi_ci.core.models import (
    InvestigadorModel, ProyectoModel, PublicacionModel, TesisModel, GrupoInvestigacionModel
)
from sgpi_ci.utils.supabase_uploader import SupabaseUploader

# Inyección del conector RENACYT
csapiren_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', 'SGPI-CSAPIREN'))
if csapiren_path not in sys.path:
    sys.path.insert(0, csapiren_path)

try:
    from renacyt_connector import search_by_name, search_by_lastname, extract_lastnames
    from renacyt_connector.api import RenacytConnector
except ImportError:
    search_by_name = None
    search_by_lastname = None
    extract_lastnames = None
    RenacytConnector = None

import re
import unicodedata

class EtlProcessor:
    def __init__(self, file_path: str):
        self.file_path = file_path
        self.filename = os.path.basename(file_path)
        self.uploader = SupabaseUploader()
        self.failed_rows: List[Dict[str, Any]] = []

    def process(self, upload_to_db: bool = True) -> Dict[str, Any]:
        """Orquesta la extracción, enriquecimiento y carga."""
        start_time = time.time()
        log_connector_status("SGPI-CI", "START", 0.0, details=f"Iniciando procesamiento del archivo {self.filename}")
        
        # 1. Extracción (Parsers Heurísticos)
        try:
            parser = ParserFactory.get_parser(self.filename)
            raw_data = parser.parse(self.file_path)
        except Exception as e:
            duration = time.time() - start_time
            log_connector_status(
                connector_name="SGPI-CI",
                status="FAILED",
                duration=duration,
                details=f"Fallo al parsear el archivo {self.filename}: {str(e)}"
            )
            return {"error": f"Fallo al parsear el archivo: {e}"}

        logger.info(f"[{self.filename}] Datos extraídos. Iniciando enriquecimiento RENACYT...")

        # 2. Enriquecimiento (Extraer nombres únicos y consultar Renacyt)
        unique_names = set()
        for p in raw_data.get('proyectos', []):
            if p.get('docente_nombre'): unique_names.add(p['docente_nombre'])
        for p in raw_data.get('publicaciones', []):
            if p.get('docente_nombre'): unique_names.add(p['docente_nombre'])
        for t in raw_data.get('tesis', []):
            if t.get('docente_nombre'): unique_names.add(t['docente_nombre'])
        for g in raw_data.get('grupos', []):
            if g.get('docente_nombre'): unique_names.add(g['docente_nombre'])
        for m in raw_data.get('miembros_grupo', []):
            if m.get('docente_nombre'): unique_names.add(m['docente_nombre'])

        name_to_dni = {}
        investigadores_validos = []

        if not search_by_name:
            logger.warning(f"[{self.filename}] renacyt_connector no disponible. No se podrá enriquecer.")

        # Función auxiliar de búsqueda robusta
        
        # Instanciar el cliente UNA sola vez y bajar el delay para que no tarde 1 segundo por reglamento
        renacyt_client = RenacytConnector(verify_ssl=False) if RenacytConnector else None
        if renacyt_client:
            renacyt_client.rate_limit_delay = 0.1

        import asyncio

        def run_sync(coro):
            try:
                return asyncio.run(coro)
            except RuntimeError:
                try:
                    loop = asyncio.get_event_loop()
                    if loop.is_running():
                        # If loop is already running, we might need a fallback or nest_asyncio.
                        # But EtlProcessor is synchronous and run in background thread or CLI,
                        # so the event loop in this thread is not running.
                        return loop.run_until_complete(coro)
                    else:
                        return loop.run_until_complete(coro)
                except Exception:
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                    try:
                        return loop.run_until_complete(coro)
                    finally:
                        loop.close()

        def normalize_str(s):
            return unicodedata.normalize('NFKD', s).encode('ASCII', 'ignore').decode('utf-8').upper()

        def robust_renacyt_search(name_str: str):
            if not renacyt_client:
                return None
            # Limpiamos comas y guiones para separar bien las palabras (ej. "Herrera-quispe")
            clean_str = name_str.replace(',', ' ').replace('-', ' ')
            words = [w.strip() for w in clean_str.split() if len(w.strip()) > 2]
            if not words: return None
            original_parts = [normalize_str(w) for w in words]

            # 1. Intentamos buscar usando el nuevo método optimizado en paralelo (search_by_fullname)
            if hasattr(renacyt_client, 'search_by_fullname'):
                try:
                    res = run_sync(renacyt_client.search_by_fullname(name_str, page_size=100))
                    if res and res.get('total', 0) > 0 and res.get('data'):
                        for r in res['data']:
                            c_full = normalize_str(str(r.get('nombre_completo', '')))
                            matches = sum(1 for p in original_parts if p in c_full)
                            if matches >= len(original_parts) - 1:
                                return r
                except Exception as e:
                    logger.warning(f"Error en search_by_fullname para '{name_str}', usando fallback: {e}")

            # 2. Fallback secuencial original: Búsqueda por apellidos (más preciso)
            if extract_lastnames and hasattr(renacyt_client, 'search_by_lastname'):
                try:
                    extracted_lastname = extract_lastnames(name_str)
                    if extracted_lastname:
                        res = run_sync(renacyt_client.search_by_lastname(extracted_lastname, page_size=100))
                        if res and res.get('total', 0) > 0 and res.get('data'):
                            for r in res['data']:
                                c_full = normalize_str(str(r.get('nombre_completo', '')))
                                matches = sum(1 for p in original_parts if p in c_full)
                                if matches >= len(original_parts) - 1:
                                    return r
                except Exception:
                    pass

            # 3. Fallback secuencial original: Búsqueda por nombre iterativa
            candidates = []
            if len(words) >= 2:
                candidates.append(f"{words[-2]} {words[-1]}")
                candidates.append(f"{words[0]} {words[1]}")
            candidates.append(words[-1])
            candidates.append(words[0])

            for cand in candidates:
                try:
                    res = run_sync(renacyt_client.search_by_name(cand, page_size=100))
                    if res and res.get('total', 0) > 0 and res.get('data'):
                        for r in res['data']:
                            c_full = normalize_str(str(r.get('nombre_completo', '')))
                            matches = sum(1 for p in original_parts if p in c_full)
                            if matches >= len(original_parts) - 1:
                                return r
                except Exception:
                    pass
            return None

        for name in unique_names:
            if not name or not search_by_name:
                continue
            
            # Limpiar nombre para la búsqueda (títulos)
            search_name = re.sub(r'^(Dr\.|Mg\.|Mag\.|Ing\.|Lic\.)\s*', '', name, flags=re.IGNORECASE).strip()
            
            try:
                match = robust_renacyt_search(search_name)
                if match:
                    dni = str(match.get('numero_documento', ''))
                    
                    # Guardamos mapeo
                    name_to_dni[name] = dni
                    
                    # Determinar investigador_sm
                    inst = str(match.get('institucion_laboral_principal', '')).upper()
                    is_sm = 'SAN MARCOS' in inst or 'UNMSM' in inst
                    
                    # Generamos InvestigadorModel
                    try:
                        inv = InvestigadorModel(
                            dni=dni,
                            nombres=str(match.get('nombres', '')).title(),
                            apellidos=f"{match.get('apellido_paterno', '')} {match.get('apellido_materno', '')}".title(),
                            institucion_principal=str(match.get('institucion_laboral_principal', '')),
                            codigo_renacyt=str(match.get('codigo_registro', '')),
                            orcid=str(match.get('orcid', '')),
                            categoria_renacyt=str(match.get('nivel', 'No Clasificado')),
                            estado_renacyt=str(match.get('condicion', '')),
                            url_cti_vitae=str(match.get('cti_vitae', '')),
                            investigador_sm=is_sm
                        )
                        investigadores_validos.append(inv.model_dump())
                    except ValidationError:
                        pass
                else:
                    self.failed_rows.append({
                        "tipo": "INCONSISTENCIA_RENACYT",
                        "mensaje": f"No se encontró DNI para el docente '{name}' en RENACYT.",
                        "dato": name
                    })
            except Exception as e:
                self.failed_rows.append({
                    "tipo": "ERROR_API_RENACYT",
                    "mensaje": f"Error buscando a '{name}': {e}",
                    "dato": name
                })

        logger.info(f"[{self.filename}] Enriquecimiento completo. {len(name_to_dni)} DNIs resueltos.")

        # ---------------------------------------------------------
        # MATCHING DE GRUPOS DE INVESTIGACIÓN (Fuzzy / Exacto)
        # ---------------------------------------------------------
        logger.info(f"[{self.filename}] Obteniendo padrón de grupos para Foreign Keys...")
        try:
            from rapidfuzz import process, fuzz
            has_rapidfuzz = True
        except ImportError:
            has_rapidfuzz = False
            logger.warning(f"[{self.filename}] rapidfuzz no instalado, el mapeo de grupos será exacto.")
            
        grupos_db = self.uploader.fetch_grupos()
        
        def match_grupo(query_str: str) -> Optional[int]:
            if not query_str or not grupos_db: return None
            
            # 1. Manejar múltiples grupos en una celda (ej: 'yachay / itdata')
            # Tomamos el primero de forma heurística, ya que la BD solo acepta 1 id_grupo
            first_q = re.split(r'[/,\n]', str(query_str))[0].strip()
            q_upper = first_q.upper()
            
            # 2. Diccionario de mapeo duro para siglas informales (Hoja de Publicaciones)
            MAPEO_SIGLAS = {
                "IOT": "INTERNETDELASCO",
                "INWE": "INGENIERAWEB",
                "INTGARTI": "INNOVANDOSISTEM",
                "BIOMEDIT": "TECNOLOGASDELAI",
                "YACHAY": "YACHAY",
                "ITDATA": "ITDATA"
            }
            translated_q = MAPEO_SIGLAS.get(q_upper, q_upper)
            
            # 3. Búsqueda exacta por siglas, código o nombre
            for g in grupos_db:
                # Comparamos el valor traducido
                if translated_q == (g.get('siglas', '') or '').upper(): return g['id_grupo']
                if translated_q == (g.get('codigo_grupo', '') or '').upper(): return g['id_grupo']
                if translated_q == (g.get('nombre_grupo', '') or '').upper(): return g['id_grupo']
                
                # Comparamos el valor original por si acaso
                if q_upper == (g.get('siglas', '') or '').upper(): return g['id_grupo']
                if q_upper == (g.get('codigo_grupo', '') or '').upper(): return g['id_grupo']
                if q_upper == (g.get('nombre_grupo', '') or '').upper(): return g['id_grupo']
                
            # 4. Búsqueda difusa por nombre
            if has_rapidfuzz:
                nombres = {g['id_grupo']: g['nombre_grupo'] for g in grupos_db if g.get('nombre_grupo')}
                if not nombres: return None
                choices = list(nombres.values())
                # Buscamos usando la versión original, ya que el diccionario ya cubrió los slugs raros
                res = process.extractOne(first_q, choices, scorer=fuzz.partial_ratio)
                if res and res[1] >= 80:
                    best_name = res[0]
                    for g_id, name in nombres.items():
                        if name == best_name: return g_id
            return None

        # 3. Ensamblaje de Modelos Finales
        proyectos_validos, publicaciones_validas, tesis_validas, grupos_validos = [], [], [], []

        # Proyectos
        proyectos_dict = {}
        for p in raw_data.get('proyectos', []):
            codigo = p['codigo_proyecto']
            docente = p.get('docente_nombre')
            dni = name_to_dni.get(docente)
            
            # Resolve group FK
            if p.get('codigo_grupo'):
                p['id_grupo'] = match_grupo(p['codigo_grupo'])
            
            if codigo not in proyectos_dict:
                proyectos_dict[codigo] = p
                proyectos_dict[codigo]['docentes'] = []
            
            if dni:
                proyectos_dict[codigo]['docentes'].append({'dni': dni, 'condicion_rol': p.get('condicion_rol', 'Miembro')})
            elif docente:
                self.failed_rows.append({"tipo": "PROYECTO_DOCENTE_FALTANTE", "dato": p, "mensaje": f"Docente {docente} sin DNI."})

        for p in proyectos_dict.values():
            try:
                proyectos_validos.append(ProyectoModel(**p).model_dump())
            except ValidationError as e:
                self.failed_rows.append({"tipo": "VALIDACION_PROYECTO", "dato": p, "mensaje": str(e)})

        # Publicaciones
        for pub in raw_data.get('publicaciones', []):
            dni = name_to_dni.get(pub.get('docente_nombre'))
            if not dni:
                self.failed_rows.append({"tipo": "PUB_DOCENTE_FALTANTE", "dato": pub, "mensaje": "Autor sin DNI resuelto."})
                continue
            pub['dni_autor'] = dni
            
            if pub.get('codigo_grupo'):
                pub['id_grupo'] = match_grupo(pub['codigo_grupo'])
                
            try:
                publicaciones_validas.append(PublicacionModel(**pub).model_dump())
            except ValidationError as e:
                self.failed_rows.append({"tipo": "VALIDACION_PUB", "dato": pub, "mensaje": str(e)})

        # Tesis
        for tes in raw_data.get('tesis', []):
            dni = name_to_dni.get(tes.get('docente_nombre'))
            if not dni:
                self.failed_rows.append({"tipo": "TESIS_ASESOR_FALTANTE", "dato": tes, "mensaje": "Asesor sin DNI resuelto."})
                continue
            tes['dni_asesor'] = dni
            try:
                tesis_validas.append(TesisModel(**tes).model_dump())
            except ValidationError as e:
                self.failed_rows.append({"tipo": "VALIDACION_TESIS", "dato": tes, "mensaje": str(e)})

        # Grupos de Investigación
        grupos_dict = {}
        for g in raw_data.get('grupos', []):
            nombre = g['nombre_grupo']
            if nombre not in grupos_dict:
                grupos_dict[nombre] = g
                grupos_dict[nombre]['miembros'] = []
                grupos_dict[nombre]['lineas_investigacion'] = []
            dni = name_to_dni.get(g.get('docente_nombre'))
            if dni:
                grupos_dict[nombre]['dni_coordinador'] = dni
                grupos_dict[nombre]['miembros'].append({'dni': dni, 'condicion_miembro': 'Coordinador'})
        
        for m in raw_data.get('miembros_grupo', []):
            nombre = m['nombre_grupo']
            if nombre not in grupos_dict:
                grupos_dict[nombre] = {'nombre_grupo': nombre, 'miembros': [], 'lineas_investigacion': []}
            dni = name_to_dni.get(m.get('docente_nombre'))
            if dni:
                grupos_dict[nombre]['miembros'].append({'dni': dni, 'condicion_miembro': m.get('condicion_miembro', 'Titular')})
            if m.get('lineas_investigacion'):
                grupos_dict[nombre]['lineas_investigacion'].extend(m['lineas_investigacion'])
                
        for g in grupos_dict.values():
            try:
                grupos_validos.append(GrupoInvestigacionModel(**g).model_dump())
            except ValidationError as e:
                self.failed_rows.append({"tipo": "VALIDACION_GRUPO", "dato": g, "mensaje": str(e)})

        # 4. Carga (Supabase)
        resultados_db = {}
        if upload_to_db:
            logger.info(f"[{self.filename}] Cargando a BD...")
            if investigadores_validos:
                resultados_db['investigadores'] = self.uploader.upload('importar_ci_investigadores', investigadores_validos)
            if proyectos_validos:
                resultados_db['proyectos'] = self.uploader.upload('importar_ci_proyectos', proyectos_validos)
            if grupos_validos:
                resultados_db['grupos'] = self.uploader.upload('importar_ci_grupos', grupos_validos)
            if publicaciones_validas:
                resultados_db['publicaciones'] = self.uploader.upload('importar_ci_publicaciones', publicaciones_validas)
            if tesis_validas:
                resultados_db['tesis'] = self.uploader.upload('importar_ci_tesis', tesis_validas)

        duration = time.time() - start_time
        total_records = (
            len(investigadores_validos)
            + len(proyectos_validos)
            + len(publicaciones_validas)
            + len(tesis_validas)
            + len(grupos_validos)
        )
        total_errors = len(self.failed_rows)
        
        log_connector_status(
            connector_name="SGPI-CI",
            status="SUCCESS" if total_errors == 0 else "DEGRADED",
            duration=duration,
            processed_records=total_records,
            errors=total_errors,
            details=f"Procesamiento finalizado para archivo: {self.filename}"
        )

        return {
            "archivo": self.filename,
            "entidades_extraidas": {
                "investigadores": len(investigadores_validos),
                "proyectos": len(proyectos_validos),
                "publicaciones": len(publicaciones_validas),
                "tesis": len(tesis_validas),
                "grupos": len(grupos_validos)
            },
            "detalle_extraccion": {
                "investigadores": investigadores_validos,
                "proyectos": proyectos_validos,
                "publicaciones": publicaciones_validas,
                "tesis": tesis_validas,
                "grupos": grupos_validos
            },
            "resultados_db": resultados_db,
            "conflictos_inconsistencias": len(self.failed_rows),
            "detalle_conflictos": self.failed_rows
        }
