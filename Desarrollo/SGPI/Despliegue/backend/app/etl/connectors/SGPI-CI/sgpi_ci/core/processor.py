import sys
import os
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


class ImportCancelledError(Exception):
    """Excepción lanzada cuando el usuario cancela la importación en curso."""
    pass


class EtlProcessor:
    def __init__(self, file_path: str, id_usuario: Optional[str] = None):
        self.file_path = file_path
        self.filename = os.path.basename(file_path)
        self.uploader = SupabaseUploader()
        self.failed_rows: List[Dict[str, Any]] = []
        self.id_usuario = id_usuario

    async def process(self, upload_to_db: bool = True, on_progress: Optional[Any] = None, is_cancelled: Optional[Any] = None) -> Dict[str, Any]:
        """Orquesta la extracción, enriquecimiento y carga."""
        import asyncio
        start_time = time.time()
        log_connector_status("SGPI-CI", "START", 0.0, details=f"Iniciando procesamiento del archivo {self.filename}")

        def update_progress(msg: str, progress_val: int, processed_count: int = None, error_count: int = None):
            if on_progress:
                try:
                    on_progress(msg, progress_val, processed_count=processed_count, error_count=error_count)
                except Exception as ex:
                    logger.warning(f"Error in progress callback: {ex}")
            logger.info(f"[{self.filename}] {msg} ({progress_val}%)")

        update_progress("Analizando formato y estructura del archivo...", 15)
        
        # 1. Extracción (Parsers Heurísticos)
        try:
            parser = ParserFactory.get_parser(self.filename)
            raw_data = await asyncio.to_thread(parser.parse, self.file_path)
        except Exception as e:
            duration = time.time() - start_time
            log_connector_status(
                connector_name="SGPI-CI",
                status="FAILED",
                duration=duration,
                details=f"Fallo al parsear el archivo {self.filename}: {str(e)}"
            )
            return {"error": f"Fallo al parsear el archivo: {e}"}

        update_progress("Archivo leído con éxito. Identificando investigadores...", 22)

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

        update_progress(f"Se identificaron {len(unique_names)} investigadores únicos. Consultando padrón local...", 26)
        investigadores_db = await asyncio.to_thread(self.uploader.fetch_investigadores)
        
        # Instanciar el conector una sola vez y bajar el delay
        # Se pasa cancel_check para que el conector verifique cancelación antes de cada petición HTTP
        renacyt_client = RenacytConnector(verify_ssl=False, cancel_check=is_cancelled) if RenacytConnector else None
        if renacyt_client:
            renacyt_client.rate_limit_delay = 0.1

        # ---------------------------------------------------------------------------
        # PRE-FLIGHT CHECK: Verificar disponibilidad de RENACYT antes de comenzar
        # Si la API no responde en RENACYT_PREFLIGHT_TIMEOUT segundos, se desactiva
        # el conector y se avisa al usuario en vez de quedar colgado por 15-20 min.
        # ---------------------------------------------------------------------------
        RENACYT_PREFLIGHT_TIMEOUT = 8  # segundos máximos para el chequeo inicial
        if renacyt_client and unique_names:
            update_progress("Verificando disponibilidad del servidor RENACYT (CONCYTEC)...", 28)
            try:
                _probe_name = next(iter(unique_names))
                _probe_clean = re.sub(r'^(Dr\.|Mg\.|Mag\.|Ing\.|Lic\.)\s*', '', _probe_name, flags=re.IGNORECASE).strip()
                _probe_words = [w for w in _probe_clean.split() if len(w) > 2]
                _probe_query = _probe_words[-1] if _probe_words else _probe_clean
                await asyncio.wait_for(
                    renacyt_client.search_by_name(_probe_query, page_size=1),
                    timeout=RENACYT_PREFLIGHT_TIMEOUT
                )
                update_progress("Servidor RENACYT disponible. Iniciando enriquecimiento de datos...", 29)
            except asyncio.TimeoutError:
                logger.error(
                    f"[{self.filename}] Pre-flight RENACYT TIMEOUT ({RENACYT_PREFLIGHT_TIMEOUT}s). "
                    "El servidor de CONCYTEC no respondió. Se procederá sin enriquecimiento RENACYT."
                )
                update_progress(
                    f"⚠️ AVISO: El servidor RENACYT (CONCYTEC) no respondió en {RENACYT_PREFLIGHT_TIMEOUT} segundos. "
                    "Se omitirá la consulta a RENACYT y los investigadores no podrán resolverse por DNI en este proceso.",
                    29
                )
                self.failed_rows.append({
                    "tipo": "ERROR_API_RENACYT",
                    "mensaje": f"El servidor de RENACYT (CONCYTEC) no respondió al pre-chequeo "
                               f"en {RENACYT_PREFLIGHT_TIMEOUT} segundos. La API parece estar caída o muy lenta. "
                               "Los investigadores no pudieron ser enriquecidos con datos de RENACYT en esta importación.",
                    "dato": "pre-flight-check"
                })
                renacyt_client = None  # Desactivar para no intentar más llamadas
            except Exception as e_preflight:
                logger.error(f"[{self.filename}] Pre-flight RENACYT ERROR: {e_preflight}. Se procederá sin RENACYT.")
                update_progress(
                    f"⚠️ AVISO: Error al contactar el servidor RENACYT: {str(e_preflight)[:120]}. Se omitirá el enriquecimiento RENACYT.",
                    29
                )
                self.failed_rows.append({
                    "tipo": "ERROR_API_RENACYT",
                    "mensaje": f"Error al contactar el servidor RENACYT: {str(e_preflight)}",
                    "dato": "pre-flight-check"
                })
                renacyt_client = None

        try:
            from app.core.cache import cache_get, cache_set, normalize_query
        except ImportError:
            cache_get = None
            cache_set = None
            normalize_query = None

        def normalize_str(s):
            return unicodedata.normalize('NFKD', s).encode('ASCII', 'ignore').decode('utf-8').upper()

        # Construir mapa local en memoria de investigadores por nombre y apellido
        local_db_by_name = {}
        for inv in investigadores_db:
            full_name_1 = f"{inv['nombres']} {inv['apellidos']}"
            full_name_2 = f"{inv['apellidos']} {inv['nombres']}"
            local_db_by_name[normalize_str(full_name_1)] = inv
            local_db_by_name[normalize_str(full_name_2)] = inv

        import json
        import os
        padron_fisi_path = os.path.join(os.path.dirname(__file__), "..", "..", "padron_fisi.json")
        padron_fisi_db = []
        if os.path.exists(padron_fisi_path):
            with open(padron_fisi_path, 'r', encoding='utf-8') as f:
                padron_fisi_db = json.load(f)

        padron_by_name = {}
        for inv in padron_fisi_db:
            padron_by_name[normalize_str(inv.get("nombre_completo", ""))] = inv

        def match_padron_fisi(name_str: str) -> Optional[Dict[str, Any]]:
            clean_str = name_str.replace(',', ' ').replace('-', ' ')
            words = [w.strip() for w in clean_str.split() if len(w.strip()) > 2]
            if not words: return None
            normalized_parts = [normalize_str(w) for w in words]
            
            norm_q = normalize_str(name_str)
            if norm_q in padron_by_name:
                return padron_by_name[norm_q]
                
            for inv in padron_fisi_db:
                db_full = normalize_str(inv.get("nombre_completo", ""))
                matches = sum(1 for p in normalized_parts if p in db_full)
                if matches >= len(normalized_parts) - 1:
                    return inv
            return None

        def match_local_db(name_str: str) -> Optional[Dict[str, Any]]:
            clean_str = name_str.replace(',', ' ').replace('-', ' ')
            words = [w.strip() for w in clean_str.split() if len(w.strip()) > 2]
            if not words: return None
            normalized_parts = [normalize_str(w) for w in words]
            
            # 1. Coincidencia exacta de nombre completo
            norm_q = normalize_str(name_str)
            if norm_q in local_db_by_name:
                return local_db_by_name[norm_q]
                
            # 2. Coincidencia parcial/heurística
            for inv in investigadores_db:
                db_full = normalize_str(f"{inv['nombres']} {inv['apellidos']}")
                matches = sum(1 for p in normalized_parts if p in db_full)
                if matches >= len(normalized_parts) - 1:
                    return inv
            return None

        async def robust_renacyt_search(name_str: str, _is_cancelled=None):
            # 1. Comprobación local en memoria (Base de Datos)
            db_match = match_local_db(name_str)
            if db_match:
                logger.info(f"Coincidencia local en BD para '{name_str}': DNI {db_match.get('dni')}")
                dni = db_match.get('dni')
                
                # Nueva lógica: Usar el Padrón como diccionario de DNIs para buscar en RENACYT
                if dni and renacyt_client and hasattr(renacyt_client, 'search_by_dni'):
                    try:
                        logger.info(f"Enriqueciendo DNI {dni} ('{name_str}') con RENACYT...")
                        ren_match = await renacyt_client.search_by_dni(dni)
                        if ren_match:
                            logger.info(f"¡Éxito! Perfil enriquecido desde RENACYT para DNI {dni}.")
                            return ren_match
                        else:
                            logger.info(f"RENACYT no encontró perfil calificado para DNI {dni}. Usando datos básicos del padrón.")
                    except Exception as e:
                        logger.warning(f"Error al buscar DNI {dni} en RENACYT: {e}. Usando datos básicos.")

                # Fallback: Datos básicos del padrón (No Clasificado si no se encontró en RENACYT)
                return {
                    "numero_documento": db_match.get("dni"),
                    "nombres": db_match.get("nombres"),
                    "apellido_paterno": db_match.get("apellidos", "").split()[0] if db_match.get("apellidos") else "",
                    "apellido_materno": " ".join(db_match.get("apellidos", "").split()[1:]) if db_match.get("apellidos") and len(db_match.get("apellidos", "").split()) > 1 else "",
                    "institucion_laboral_principal": db_match.get("institucion_principal"),
                    "codigo_registro": db_match.get("codigo_renacyt"),
                    "orcid": db_match.get("orcid"),
                    "nivel": db_match.get("categoria_renacyt", "No Clasificado"),
                    "condicion": db_match.get("estado_renacyt"),
                    "cti_vitae": db_match.get("url_cti_vitae"),
                    "nombre_completo": f"{db_match.get('apellidos', '')}, {db_match.get('nombres', '')}"
                }

            # 1.5 Comprobación en el Padrón Maestro FISI (JSON Local)
            padron_match = match_padron_fisi(name_str)
            if padron_match:
                logger.info(f"Coincidencia en Padrón FISI Maestro para '{name_str}': DNI {padron_match.get('dni')}")
                dni_padron = padron_match.get("dni")
                
                # Intentar enriquecer usando el DNI del Padrón FISI
                if dni_padron and renacyt_client and hasattr(renacyt_client, 'search_by_dni'):
                    try:
                        logger.info(f"Enriqueciendo DNI {dni_padron} del Padrón FISI ('{name_str}') con RENACYT...")
                        ren_match = await renacyt_client.search_by_dni(dni_padron)
                        if ren_match:
                            logger.info(f"Perfil enriquecido desde RENACYT para DNI {dni_padron}.")
                            return ren_match
                        else:
                            logger.info(f"RENACYT no encontró perfil calificado para DNI {dni_padron} del Padrón FISI. Usando datos básicos del padrón.")
                    except Exception as e:
                        logger.warning(f"Error al buscar DNI {dni_padron} en RENACYT: {e}. Usando datos básicos.")

                return {
                    "numero_documento": dni_padron,
                    "nombres": padron_match.get("nombre_completo", ""),
                    "apellido_paterno": "",
                    "apellido_materno": "",
                    "institucion_laboral_principal": "UNIVERSIDAD NACIONAL MAYOR DE SAN MARCOS",
                    "codigo_registro": "No Clasificado",
                    "orcid": None,
                    "nivel": "No Clasificado",
                    "condicion": "Activo",
                    "cti_vitae": None,
                    "nombre_completo": padron_match.get("nombre_completo", "")
                }

            # 2. Comprobación en caché de Redis
            if cache_get and normalize_query:
                norm_name = normalize_query(name_str)
                cache_key = f"renacyt:search:{norm_name}:p1:l1"
                try:
                    cached_data = await cache_get(cache_key)
                    if cached_data is not None:
                        cached_items = cached_data.get("items", [])
                        if cached_items:
                            cached_item = cached_items[0]
                            logger.info(f"Coincidencia en caché de Redis para '{name_str}': DNI {cached_item.get('dni')}")
                            return {
                                "numero_documento": cached_item.get("dni"),
                                "nombres": cached_item.get("nombres"),
                                "apellido_paterno": cached_item.get("apellidos", "").split()[0] if cached_item.get("apellidos") else "",
                                "apellido_materno": " ".join(cached_item.get("apellidos", "").split()[1:]) if cached_item.get("apellidos") and len(cached_item.get("apellidos", "").split()) > 1 else "",
                                "institucion_laboral_principal": cached_item.get("institucion_principal"),
                                "codigo_registro": cached_item.get("codigo_renacyt"),
                                "orcid": cached_item.get("orcid"),
                                "nivel": cached_item.get("categoria_renacyt", "No Clasificado"),
                                "condicion": cached_item.get("estado_renacyt"),
                                "cti_vitae": cached_item.get("url_cti_vitae"),
                                "nombre_completo": f"{cached_item.get('apellidos', '')}, {cached_item.get('nombres', '')}"
                            }
                except Exception as cache_err:
                    logger.warning(f"Error al leer caché de Redis en ETL: {cache_err}")

            if not renacyt_client:
                return None

            # --- Verificar cancelación antes de cualquier llamada a RENACYT ---
            if _is_cancelled and _is_cancelled():
                raise ImportCancelledError("Importación cancelada por el usuario.")
                
            # Limpiamos comas y guiones para separar bien las palabras (ej. "Herrera-quispe")
            clean_str = name_str.replace(',', ' ').replace('-', ' ')
            words = [w.strip() for w in clean_str.split() if len(w.strip()) > 2]
            if not words: return None
            original_parts = [normalize_str(w) for w in words]

            match = None

            # 3.1. Intentamos buscar usando el nuevo método optimizado en paralelo (search_by_fullname)
            if hasattr(renacyt_client, 'search_by_fullname'):
                try:
                    res = await renacyt_client.search_by_fullname(name_str, page_size=100)
                    if res and res.get('total', 0) > 0 and res.get('data'):
                        for r in res['data']:
                            c_full = normalize_str(str(r.get('nombre_completo', '')))
                            matches = sum(1 for p in original_parts if p in c_full)
                            if matches >= len(original_parts) - 1:
                                match = r
                                break
                except ImportCancelledError:
                    raise  # Propagar cancelación sin suprimirla
                except Exception as e:
                    logger.warning(f"Error en search_by_fullname para '{name_str}', usando fallback: {e}")

            # --- Verificar cancelación antes del fallback ---
            if _is_cancelled and _is_cancelled():
                raise ImportCancelledError("Importación cancelada por el usuario.")

            # 3.2. Fallback secuencial original: Búsqueda por apellidos (más preciso)
            if not match and extract_lastnames and hasattr(renacyt_client, 'search_by_lastname'):
                try:
                    extracted_lastname = extract_lastnames(name_str)
                    if extracted_lastname:
                        res = await renacyt_client.search_by_lastname(extracted_lastname, page_size=100)
                        if res and res.get('total', 0) > 0 and res.get('data'):
                            for r in res['data']:
                                c_full = normalize_str(str(r.get('nombre_completo', '')))
                                matches = sum(1 for p in original_parts if p in c_full)
                                if matches >= len(original_parts) - 1:
                                    match = r
                                    break
                except ImportCancelledError:
                    raise  # Propagar cancelación sin suprimirla
                except Exception:
                    pass

            # --- Verificar cancelación antes del segundo fallback ---
            if _is_cancelled and _is_cancelled():
                raise ImportCancelledError("Importación cancelada por el usuario.")

            # 3.3. Fallback secuencial original: Búsqueda por nombre iterativa
            if not match:
                candidates = []
                if len(words) >= 2:
                    candidates.append(f"{words[-2]} {words[-1]}")
                    candidates.append(f"{words[0]} {words[1]}")
                candidates.append(words[-1])
                candidates.append(words[0])

                for cand in candidates:
                    # --- Verificar cancelación antes de cada búsqueda individual ---
                    if _is_cancelled and _is_cancelled():
                        raise ImportCancelledError("Importación cancelada por el usuario.")
                    try:
                        res = await renacyt_client.search_by_name(cand, page_size=100)
                        if res and res.get('total', 0) > 0 and res.get('data'):
                            for r in res['data']:
                                c_full = normalize_str(str(r.get('nombre_completo', '')))
                                matches = sum(1 for p in original_parts if p in c_full)
                                if matches >= len(original_parts) - 1:
                                    match = r
                                    break
                            if match:
                                break
                    except ImportCancelledError:
                        raise  # Propagar cancelación sin suprimirla
                    except Exception:
                        pass

            # 4. Escribir resultados encontrados en caché de Redis
            if match and cache_set and normalize_query:
                try:
                    dni_val = match.get("numero_documento")
                    if dni_val:
                        # Cache DNI (24h)
                        dni_key = f"renacyt:dni:{dni_val}"
                        await cache_set(dni_key, match, 86400)
                        
                        # Cache búsqueda (1h)
                        mapped_item = {
                            "dni": dni_val,
                            "nombres": str(match.get('nombres', '')).title(),
                            "apellidos": f"{match.get('apellido_paterno', '')} {match.get('apellido_materno', '')}".strip().title(),
                            "codigo_interno_vrip": None,
                            "condicion_laboral": None,
                            "departamento_academico": "Externo (RENACYT)",
                            "facultad_dependencia": "Ingeniería de Sistemas e Informática",
                            "grado_academico_max": None,
                            "institucion_principal": match.get("institucion_laboral_principal"),
                            "codigo_renacyt": match.get("codigo_registro"),
                            "orcid": match.get("orcid"),
                            "categoria_renacyt": match.get("nivel", "Sin nivel"),
                            "estado_renacyt": match.get("condicion"),
                            "url_cti_vitae": match.get("cti_vitae"),
                            "investigador_sm": "SAN MARCOS" in (match.get("institucion_laboral_principal") or "").upper() or "UNMSM" in (match.get("institucion_laboral_principal") or "").upper(),
                            "estado_vigencia": "Activo",
                            "tiene_deuda_gi": False,
                            "tiene_deuda_pi": False,
                            "is_external": True
                        }
                        norm_name = normalize_query(name_str)
                        search_key = f"renacyt:search:{norm_name}:p1:l1"
                        await cache_set(search_key, {"total": 1, "items": [mapped_item]}, 3600)
                except Exception as cache_err:
                    logger.warning(f"Error al escribir en caché de Redis en ETL: {cache_err}")

            if match:
                logger.info(f"[ÉXITO] Se encontró a '{name_str}' en RENACYT (DNI: {match.get('numero_documento', 'N/A')}).")
            else:
                logger.warning(f"[FALLO] No se encontró a '{name_str}' en RENACYT tras intentar todas las combinaciones.")

            return match

        total_names = len(unique_names)
        for index, name in enumerate(unique_names, 1):
            # Verificar cancelación al inicio de cada iteración
            if is_cancelled and is_cancelled():
                logger.info(f"[{self.filename}] Importación cancelada por el usuario en el paso de enriquecimiento RENACYT.")
                raise ImportCancelledError("Importación cancelada por el usuario.")

            if not name or not search_by_name:
                continue
            
            # Limpiar nombre para la búsqueda (títulos)
            search_name = re.sub(r'^(Dr\.|Mg\.|Mag\.|Ing\.|Lic\.)\s*', '', name, flags=re.IGNORECASE).strip()
            
            pct = 30 + int((index / total_names) * 45) if total_names > 0 else 75
            update_progress(f"Buscando en RENACYT: {search_name} ({index}/{total_names})", pct, processed_count=len(name_to_dni), error_count=len(self.failed_rows))
            
            try:
                match = await robust_renacyt_search(search_name, _is_cancelled=is_cancelled)
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
            except ImportCancelledError:
                raise  # No atrapar la cancelación — dejar que detenga el bucle
            except Exception as e:
                self.failed_rows.append({
                    "tipo": "ERROR_API_RENACYT",
                    "mensaje": f"Error buscando a '{name}': {e}",
                    "dato": name
                })

        update_progress(f"Búsqueda finalizada. Se resolvieron {len(name_to_dni)} investigadores con DNI.", 75)

        # ---------------------------------------------------------
        # MATCHING DE GRUPOS DE INVESTIGACIÓN (Fuzzy / Exacto)
        # ---------------------------------------------------------
        update_progress("Obteniendo padrón de grupos de investigación para validación...", 78)
        try:
            from rapidfuzz import process, fuzz
            has_rapidfuzz = True
        except ImportError:
            has_rapidfuzz = False
            logger.warning(f"[{self.filename}] rapidfuzz no instalado, el mapeo de grupos será exacto.")
            
        grupos_db = await asyncio.to_thread(self.uploader.fetch_grupos)
        
        MAPEO_SIGLAS = {
            "IOT": "INTERNETDELASCO",
            "INWE": "INGENIERAWEB",
            "INTGARTI": "INNOVANDOSISTEM",
            "BIOMEDIT": "TECNOLOGASDELAI",
            "YACHAY": "YACHAY",
            "ITDATA": "ITDATA"
        }

        def _match_single_grupo(token: str) -> Optional[int]:
            """Resuelve un único token de grupo a su id_grupo."""
            q_upper = token.upper()
            translated_q = MAPEO_SIGLAS.get(q_upper, q_upper)

            for g in grupos_db:
                if translated_q == (g.get('siglas', '') or '').upper(): return g['id_grupo']
                if translated_q == (g.get('codigo_grupo', '') or '').upper(): return g['id_grupo']
                if translated_q == (g.get('nombre_grupo', '') or '').upper(): return g['id_grupo']
                if q_upper == (g.get('siglas', '') or '').upper(): return g['id_grupo']
                if q_upper == (g.get('codigo_grupo', '') or '').upper(): return g['id_grupo']
                if q_upper == (g.get('nombre_grupo', '') or '').upper(): return g['id_grupo']

            if has_rapidfuzz:
                nombres = {g['id_grupo']: g['nombre_grupo'] for g in grupos_db if g.get('nombre_grupo')}
                if nombres:
                    res = process.extractOne(token, list(nombres.values()), scorer=fuzz.partial_ratio)
                    if res and res[1] >= 80:
                        for g_id, name in nombres.items():
                            if name == res[0]:
                                return g_id
            return None

        def match_grupos(query_str: str) -> List[int]:
            """Resuelve una celda con uno o varios grupos (separados por / , o salto de línea)."""
            if not query_str or not grupos_db:
                return []
            tokens = [t.strip() for t in re.split(r'[/,\n]', str(query_str)) if t.strip()]
            ids: List[int] = []
            seen: set = set()
            for token in tokens:
                gid = _match_single_grupo(token)
                if gid is not None and gid not in seen:
                    ids.append(gid)
                    seen.add(gid)
            return ids

        # 3. Ensamblaje de Modelos Finales
        update_progress("Validando y relacionando registros de proyectos, publicaciones y tesis...", 83)
        proyectos_validos, publicaciones_validas, tesis_validas, grupos_validos = [], [], [], []
        sin_dni: List[Dict[str, Any]] = []  # nombres que no pudieron resolverse

        # Proyectos
        proyectos_dict = {}
        for p in raw_data.get('proyectos', []):
            codigo = p['codigo_proyecto']
            docente = p.get('docente_nombre')
            dni = name_to_dni.get(docente)

            if p.get('codigo_grupo'):
                p['id_grupos'] = match_grupos(p['codigo_grupo'])

            if codigo not in proyectos_dict:
                proyectos_dict[codigo] = p
                proyectos_dict[codigo]['docentes'] = []

            if dni:
                proyectos_dict[codigo]['docentes'].append({'dni': dni, 'condicion_rol': p.get('condicion_rol', 'Miembro')})
            elif docente:
                # Registrar nombre no resuelto pero NO descartar el proyecto
                sin_dni.append({"nombre": docente, "contexto": f"Proyecto {codigo}"})

        for p in proyectos_dict.values():
            try:
                proyectos_validos.append(ProyectoModel(**p).model_dump())
            except ValidationError as e:
                self.failed_rows.append({"tipo": "VALIDACION_PROYECTO", "dato": p, "mensaje": str(e)})

        # Publicaciones
        for pub in raw_data.get('publicaciones', []):
            docente = pub.get('docente_nombre')
            dni = name_to_dni.get(docente)

            if pub.get('codigo_grupo'):
                pub['id_grupos'] = match_grupos(pub['codigo_grupo'])

            if not dni:
                # Enviar a cuarentena en vez de descartar
                sin_dni.append({"nombre": docente or "Desconocido", "contexto": f"Publicación: {pub.get('titulo_articulo', '')[:60]}"})
                await asyncio.to_thread(
                    self.uploader.send_to_quarantine,
                    "publicacion",
                    pub.get('doi_codigo') or pub.get('titulo_articulo', '')[:100],
                    pub,
                    f"Autor '{docente}' no encontrado en RENACYT ni en la base de datos local. Requiere asignación manual de DNI.",
                )
                continue
            pub['dni_autor'] = dni
            try:
                publicaciones_validas.append(PublicacionModel(**pub).model_dump())
            except ValidationError as e:
                self.failed_rows.append({"tipo": "VALIDACION_PUB", "dato": pub, "mensaje": str(e)})

        # Tesis
        for tes in raw_data.get('tesis', []):
            docente = tes.get('docente_nombre')
            dni = name_to_dni.get(docente)

            if not dni:
                # Enviar a cuarentena en vez de descartar
                sin_dni.append({"nombre": docente or "Desconocido", "contexto": f"Tesis: {tes.get('titulo_tesis', '')[:60]}"})
                await asyncio.to_thread(
                    self.uploader.send_to_quarantine,
                    "tesis",
                    tes.get('titulo_tesis', '')[:100],
                    tes,
                    f"Asesor '{docente}' no encontrado en RENACYT ni en la base de datos local. Requiere asignación manual de DNI.",
                )
                continue
            tes['dni_asesor'] = dni
            try:
                tesis_validas.append(TesisModel(**tes).model_dump())
            except ValidationError as e:
                self.failed_rows.append({"tipo": "VALIDACION_TESIS", "dato": tes, "mensaje": str(e)})

        # Obtener catálogo de líneas oficiales de configuracion_global para normalización dinámica
        lineas_oficiales = await asyncio.to_thread(self.uploader.fetch_lineas_investigacion)
        mapa_lineas = {linea.lower().strip(): linea for linea in lineas_oficiales}

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
                # Normalizar dinámicamente con case-insensitive matching
                normalizadas = []
                for linea in m['lineas_investigacion']:
                    linea_clean = linea.strip()
                    linea_lower = linea_clean.lower()
                    if linea_lower in mapa_lineas:
                        normalizadas.append(mapa_lineas[linea_lower])
                    else:
                        normalizadas.append(linea_clean)
                        # Registrar línea no reconocida como 'Pendiente' de forma asíncrona
                        await asyncio.to_thread(self.uploader.upsert_linea_investigacion, linea_clean, 'Pendiente')
                grupos_dict[nombre]['lineas_investigacion'].extend(normalizadas)
                
        for g in grupos_dict.values():
            # Eliminar duplicados manteniendo orden
            unique_lines = []
            for linea in g.get('lineas_investigacion', []):
                if linea not in unique_lines:
                    unique_lines.append(linea)
            g['lineas_investigacion'] = unique_lines
            try:
                grupos_validos.append(GrupoInvestigacionModel(**g).model_dump())
            except ValidationError as e:
                self.failed_rows.append({"tipo": "VALIDACION_GRUPO", "dato": g, "mensaje": str(e)})


        # 4. Carga (Supabase)
        resultados_db = {}
        if upload_to_db:
            # Verificar cancelación antes de comenzar la carga a la BD
            if is_cancelled and is_cancelled():
                logger.info(f"[{self.filename}] Importación cancelada por el usuario antes de la carga a la base de datos.")
                raise ImportCancelledError("Importación cancelada por el usuario.")

            update_progress("Guardando cambios en la base de datos...", 90)
            if investigadores_validos:
                update_progress("Guardando nuevos investigadores y datos de RENACYT...", 92)
                resultados_db['investigadores'] = await asyncio.to_thread(self.uploader.upload, 'importar_ci_investigadores', investigadores_validos, id_usuario=self.id_usuario)
            if proyectos_validos:
                if is_cancelled and is_cancelled():
                    raise ImportCancelledError("Importación cancelada por el usuario.")
                update_progress("Guardando proyectos de investigación...", 94)
                resultados_db['proyectos'] = await asyncio.to_thread(self.uploader.upload, 'importar_ci_proyectos', proyectos_validos, id_usuario=self.id_usuario)
            if grupos_validos:
                if is_cancelled and is_cancelled():
                    raise ImportCancelledError("Importación cancelada por el usuario.")
                update_progress("Guardando grupos de investigación...", 96)
                resultados_db['grupos'] = await asyncio.to_thread(self.uploader.upload, 'importar_ci_grupos', grupos_validos, id_usuario=self.id_usuario)
            if publicaciones_validas:
                if is_cancelled and is_cancelled():
                    raise ImportCancelledError("Importación cancelada por el usuario.")
                update_progress("Guardando publicaciones científicas...", 98)
                resultados_db['publicaciones'] = await asyncio.to_thread(self.uploader.upload, 'importar_ci_publicaciones', publicaciones_validas, id_usuario=self.id_usuario)
            if tesis_validas:
                if is_cancelled and is_cancelled():
                    raise ImportCancelledError("Importación cancelada por el usuario.")
                update_progress("Guardando tesis de grado y posgrado...", 99)
                resultados_db['tesis'] = await asyncio.to_thread(self.uploader.upload, 'importar_ci_tesis', tesis_validas, id_usuario=self.id_usuario)

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

        update_progress("Procesamiento y persistencia finalizados correctamente.", 100)
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
            "detalle_conflictos": self.failed_rows,
            "en_cuarentena": len(sin_dni),
            "detalle_sin_dni": sin_dni,
        }
