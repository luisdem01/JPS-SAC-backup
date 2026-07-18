"""
SGPI - Orquestador de Sincronización Global
============================================
Endpoint:  POST /api/v1/sync/run
Propósito: Coordina la extracción de datos de múltiples fuentes externas
           (VRIP, Cybertesis, RENACYT) y los envía directamente al motor de
           reconciliación CMR sin intermediarios HTTP, guardando los
           resultados en la base de datos principal.

Flujo por fuente:
  VRIP       → VripConvocatoriasExtractor + VripProyectosExtractor
               → mapper local → persister.persist_resolved()
  Cybertesis → CybertesisAPIEngine.search() (por facultad + docentes existentes)
               → rules_engine.reconcile_asesor_tesis() → persister
  RENACYT    → RenacytConnector.search_by_institution() + search_by_dni()
               → rules_engine.reconcile_investigador() → persister
"""

import os
import sys
import asyncio
import logging
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

import unicodedata
import re

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.db.session import get_db
from app.core.config import settings
from app.core.security import require_staff
from app.models.domain import Investigador
from app.core.faculty_config import FISI_KEYWORDS, CYBERTESIS_QUERIES

logger = logging.getLogger(__name__)
router = APIRouter()

def _normalize_name(name: str) -> str:
    if not name: return ""
    n = unicodedata.normalize('NFKD', name).encode('ASCII', 'ignore').decode('utf-8')
    n = n.lower().replace('.', '').replace(',', '')
    n = re.sub(r'\s+', ' ', n).strip()
    return n

def _is_same_advisor(name1: str, name2: str) -> bool:
    if not name1 or not name2: return False
    n1 = _normalize_name(name1)
    n2 = _normalize_name(name2)
    return n1 in n2 or n2 in n1

# ---------------------------------------------------------------------------
# Inyección de paths para los conectores externos (carpetas con guiones)
# ---------------------------------------------------------------------------
_base = os.path.dirname(os.path.abspath(__file__))
_connectors = os.path.abspath(os.path.join(_base, *(['..'] * 6), 'app', 'etl', 'connectors'))

_vrip_path = os.path.join(_connectors, 'SGPI-CJCA')
_cyb_path  = os.path.join(_connectors, 'SGPI-CSAPICYB')
_ren_path  = os.path.join(_connectors, 'SGPI-CSAPIREN')
_cmr_path  = os.path.abspath(os.path.join(_base, *(['..'] * 6), 'app', 'SGPI-CMR'))

for p in [_vrip_path, _cyb_path, _ren_path, _cmr_path]:
    if p not in sys.path:
        sys.path.insert(0, p)

# ---------------------------------------------------------------------------
# Importaciones condicionales (cada conector puede no estar instalado)
# ---------------------------------------------------------------------------
try:
    from vrip_connector.engines.vrip_convocatorias import VripConvocatoriasExtractor
    from vrip_connector.engines.vrip_proyectos import VripProyectosExtractor
    _vrip_ok = True
except ImportError as e:
    logger.warning(f"[Sync] Conector VRIP no disponible: {e}")
    _vrip_ok = False

try:
    from cybertesis_connector.engines.api_engine import CybertesisAPIEngine
    _cyb_ok = True
except ImportError as e:
    logger.warning(f"[Sync] Conector Cybertesis no disponible: {e}")
    _cyb_ok = False

try:
    from renacyt_connector.api import RenacytConnector
    _ren_ok = True
except ImportError as e:
    logger.warning(f"[Sync] Conector RENACYT no disponible: {e}")
    _ren_ok = False

try:
    from sgpi_cmr.services.rules_engine import rules_engine
    from sgpi_cmr.services.persister import persister
    from sgpi_cmr.schemas.incoming import (
        InvestigadorInput, ProyectoInput, AsesorTesisInput
    )
    _cmr_ok = True
except ImportError as e:
    logger.error(f"[Sync] CMR no disponible — el orquestador no puede funcionar: {e}")
    _cmr_ok = False

# ---------------------------------------------------------------------------
# Palabras clave y queries de Cybertesis centralizados para FISI
# ---------------------------------------------------------------------------
# Importados desde app.core.faculty_config

# ---------------------------------------------------------------------------
# Schemas de entrada
# ---------------------------------------------------------------------------
class SyncFilters(BaseModel):
    expanded_search: bool = True           # Legacy/fallback
    
    # VRIP
    vrip_year: Optional[int] = None
    vrip_program: Optional[str] = None
    vrip_query: Optional[str] = None
    
    # Cybertesis
    year_start: Optional[int] = None
    year_end: Optional[int] = None
    degree: Optional[str] = None           # "pregrado" | "maestria" | "doctorado" | None
    by_docentes: bool = True
    max_docentes_cybertesis: int = 100
    only_reconcile_local: bool = False
    
    # RENACYT
    renacyt_mode: Optional[str] = None         # "update" | "expanded" | "both"
    renacyt_max_update: Optional[int] = None   # límite de investigadores existentes a actualizar (None = todos)
    renacyt_max_new: Optional[int] = None      # límite de nuevos investigadores a descubrir (None = sin límite)

class SyncRequest(BaseModel):
    sources: List[str]                     # ["VRIP", "CYBERTESIS", "RENACYT"]
    filters: SyncFilters = SyncFilters()

# ---------------------------------------------------------------------------
# Estado de Jobs en memoria y DB
# ---------------------------------------------------------------------------
class SyncJobState:
    def __init__(self, job_id: str, sources: List[str], filters: Dict[str, Any] = None, id_usuario: Optional[str] = None):
        self.job_id = job_id
        self.sources = sources
        self.filters = filters or {}
        self.id_usuario = id_usuario
        self.status = "queued"
        self.started_at = datetime.now(timezone.utc).isoformat()
        self.finished_at: Optional[str] = None
        self.error: Optional[str] = None
        self.report: Dict[str, Any] = {}
        self.progress_logs: List[Dict[str, str]] = []
        
        self.add_log("INFO", f"Job creado y en cola. Fuentes seleccionadas: {', '.join(sources)}")

    def add_log(self, level: str, text: str):
        now = datetime.now().strftime("%H:%M:%S")
        self.progress_logs.append({
            "time": now,
            "level": level,
            "text": text
        })

    async def save_to_db(self, db: AsyncSession):
        from app.models.domain import SyncJob
        import uuid as _uuid
        from datetime import datetime as dt, timezone as tz
        
        uuid_obj = _uuid.UUID(self.job_id)
        result = await db.execute(select(SyncJob).where(SyncJob.job_id == uuid_obj))
        db_job = result.scalars().first()
        
        if not db_job:
            user_uuid = _uuid.UUID(self.id_usuario) if self.id_usuario else None
            db_job = SyncJob(
                job_id=uuid_obj,
                sources=self.sources,
                filters=self.filters,
                status=self.status,
                started_at=dt.fromisoformat(self.started_at) if self.started_at else dt.now(tz.utc),
                id_usuario=user_uuid
            )
            db.add(db_job)
            
        db_job.status = self.status
        db_job.progress_logs = self.progress_logs
        db_job.report = self.report
        db_job.error_message = self.error
        
        if self.finished_at:
            db_job.finished_at = dt.fromisoformat(self.finished_at)
            
        await db.commit()

_sync_jobs: Dict[str, SyncJobState] = {}
_sync_tasks: Dict[str, asyncio.Task] = {}

# ---------------------------------------------------------------------------
# Mappers: convierte modelos de conectores → schemas CMR
# ---------------------------------------------------------------------------

def _map_vrip_proyecto_to_cmr(proy) -> Optional[ProyectoInput]:
    """Convierte ProyectoModel (VRIP) → ProyectoInput (CMR)."""
    try:
        codigo = proy.codigo_proyecto or f"VRIP-{proy.codigo_programa}-{proy.anio_academico}"
        return ProyectoInput(
            codigo_proyecto=codigo,
            titulo_proyecto=proy.titulo or "Sin Título",
            tipo_programa=proy.codigo_programa,
            resolucion_aprobacion=proy.numero_resolucion,
            presupuesto_asignado=proy.monto_financiado,
            anio_convocatoria=proy.anio_academico,
            fecha_inicio=proy.fecha_aprobacion,
            estado_proyecto="Aprobado",
        )
    except Exception as e:
        logger.warning(f"[Sync/VRIP] Error mapeando proyecto: {e}")
        return None


def _map_tesis_to_cmr(tesis) -> Optional[AsesorTesisInput]:
    """Convierte TesisModel (Cybertesis) → AsesorTesisInput (CMR) por cada asesor."""
    if not tesis.asesores:
        return None
    try:
        return AsesorTesisInput(
            asesor_texto=tesis.asesores[0],
            url_cybertesis=str(tesis.url_repositorio),
            titulo_tesis=tesis.titulo,
            autor_estudiante_texto=", ".join(tesis.autores) if tesis.autores else None,
        )
    except Exception as e:
        logger.warning(f"[Sync/Cybertesis] Error mapeando tesis: {e}")
        return None


def _map_renacyt_to_cmr(record: Dict[str, Any]) -> Optional[InvestigadorInput]:
    """Convierte un registro normalizado de RENACYT → InvestigadorInput (CMR)."""
    try:
        dni = record.get("numero_documento") or record.get("dni")
        if not dni:
            return None
        return InvestigadorInput(
            dni=str(dni).strip(),
            nombres=record.get("nombres", ""),
            apellidos=f"{record.get('apellido_paterno', '')} {record.get('apellido_materno', '')}".strip(),
            codigo_renacyt=record.get("codigo_registro"),
            orcid=record.get("id_orcid"),
            categoria_renacyt=record.get("categoria"),
            estado_renacyt=record.get("estado"),
            url_cti_vitae=record.get("url_cti_vitae"),
            grado_academico_max=record.get("grado_academico"),
            institucion_principal=record.get("institucion_laboral_principal"),
        )
    except Exception as e:
        logger.warning(f"[Sync/RENACYT] Error mapeando investigador: {e}")
        return None

# ---------------------------------------------------------------------------
# Runners por fuente (síncronos, corren en thread para no bloquear event loop)
# ---------------------------------------------------------------------------

def _run_vrip(filters: SyncFilters, job: SyncJobState) -> Dict[str, Any]:
    """Extrae convocatorias y proyectos del VRIP."""
    if not _vrip_ok:
        job.add_log("ERROR", "VRIP: Conector VRIP no instalado en el servidor.")
        return {"error": "Conector VRIP no instalado", "convocatorias": 0, "proyectos": []}

    stats = {"convocatorias": 0, "convocatorias_lista": [], "proyectos": [], "errores": 0}
    year = filters.vrip_year
    program = filters.vrip_program
    query = filters.vrip_query

    try:
        job.add_log("INFO", f"VRIP: Iniciando extracción de convocatorias (Año: {year or 'todos'})...")
        convocatorias_ext = VripConvocatoriasExtractor()
        convocatorias = convocatorias_ext.extract(year=year, program=program, query=query)
        stats["convocatorias"] = len(convocatorias)
        stats["convocatorias_lista"] = convocatorias
        job.add_log("SUCCESS", f"VRIP: Extraídas {len(convocatorias)} convocatorias con éxito.")
        logger.info(f"[Sync/VRIP] {len(convocatorias)} convocatorias extraídas.")
    except Exception as e:
        logger.error(f"[Sync/VRIP] Error en convocatorias: {e}")
        job.add_log("ERROR", f"VRIP: Error extrayendo convocatorias: {str(e)}")
        stats["errores"] += 1

    try:
        job.add_log("INFO", f"VRIP: Iniciando extracción de proyectos (Año: {year or 'todos'})...")
        proyectos_ext = VripProyectosExtractor()
        proyectos = proyectos_ext.extract(year=year, program=program, query=query)
        stats["proyectos"] = proyectos
        job.add_log("SUCCESS", f"VRIP: Extraídos {len(proyectos)} proyectos con éxito.")
        logger.info(f"[Sync/VRIP] {len(proyectos)} proyectos extraídos.")
    except Exception as e:
        logger.error(f"[Sync/VRIP] Error en proyectos: {e}")
        job.add_log("ERROR", f"VRIP: Error extrayendo proyectos: {str(e)}")
        stats["errores"] += 1

    return stats


def _run_cybertesis(filters: SyncFilters, investigadores_padron: List[Dict], job: SyncJobState) -> Dict[str, Any]:
    """Extrae tesis y asesores de Cybertesis."""
    if not _cyb_ok:
        job.add_log("ERROR", "Cybertesis: Conector no instalado en el servidor.")
        return {"error": "Conector Cybertesis no instalado", "tesis": []}

    engine = CybertesisAPIEngine()
    all_tesis = []
    seen_urls = set()

    # Búsqueda expandida por facultad
    for query in CYBERTESIS_QUERIES:
        try:
            job.add_log("INFO", f"Cybertesis: Buscando tesis de '{query}'...")
            logger.info(f"[Sync/Cybertesis] Buscando: '{query}'")
            result = engine.search(query, quiet=True)
            added_count = 0
            for t in result.resultados:
                url = str(t.url_repositorio)
                if url not in seen_urls:
                    # Filtro por rango de años
                    if filters.year_start and t.anio_publicacion < filters.year_start:
                        continue
                    if filters.year_end and t.anio_publicacion > filters.year_end:
                        continue
                    # Filtro por grado
                    if filters.degree:
                        if filters.degree.lower() not in t.grado_academico.lower():
                            continue
                    seen_urls.add(url)
                    all_tesis.append(t)
                    added_count += 1
            job.add_log("SUCCESS", f"Cybertesis: Encontradas {len(result.resultados)} tesis de '{query}' ({added_count} nuevas).")
        except Exception as e:
            logger.warning(f"[Sync/Cybertesis] Error buscando '{query}': {e}")
            job.add_log("WARN", f"Cybertesis: Error buscando '{query}': {str(e)}")

    # Búsqueda adicional por nombres de docentes existentes en BD
    if filters.by_docentes:
        docentes_limit = getattr(filters, "max_docentes_cybertesis", 100)
        docentes_a_buscar = investigadores_padron[:docentes_limit]
        job.add_log("INFO", f"Cybertesis: Buscando asesorías/autorías para {len(docentes_a_buscar)} docentes de la base de datos (límite: {docentes_limit})...")
        for idx, inv in enumerate(docentes_a_buscar):
            nombre_completo = f"{inv.get('nombres', '')} {inv.get('apellidos', '')}".strip()
            if not nombre_completo:
                continue
            try:
                if idx % 5 == 0 or idx == len(docentes_a_buscar) - 1:
                    job.add_log("INFO", f"Cybertesis: Consultando docente ({idx+1}/{len(docentes_a_buscar)}): {nombre_completo}...")
                result = engine.search(nombre_completo, limit=20, quiet=True)
                for t in result.resultados:
                    url = str(t.url_repositorio)
                    if url not in seen_urls:
                        seen_urls.add(url)
                        all_tesis.append(t)
            except Exception as e:
                logger.warning(f"[Sync/Cybertesis] Error buscando docente '{nombre_completo}': {e}")
                job.add_log("WARN", f"Cybertesis: Error buscando docente '{nombre_completo}': {str(e)}")

    job.add_log("SUCCESS", f"Cybertesis: Extracción finalizada. Total tesis únicas: {len(all_tesis)}")
    logger.info(f"[Sync/Cybertesis] Total tesis únicas encontradas: {len(all_tesis)}")
    return {"tesis": all_tesis, "total": len(all_tesis)}


async def _run_renacyt(filters: SyncFilters, investigadores_padron: List[Dict], job: SyncJobState) -> Dict[str, Any]:
    """Actualiza y descubre investigadores RENACYT de la FISI-UNMSM."""
    if not _ren_ok:
        job.add_log("ERROR", "RENACYT: Conector no instalado en el servidor.")
        return {"error": "Conector RENACYT no instalado", "registros": []}

    connector = RenacytConnector(rate_limit_delay=settings.RENACYT_RATE_LIMIT_SECONDS)
    all_records = []
    seen_dnis = set()
    
    mode = filters.renacyt_mode or ("expanded" if filters.expanded_search else "update")

    # 1. Actualización de investigadores ya registrados
    if mode in ["update", "both"]:
        padron_a_actualizar = investigadores_padron
        if filters.renacyt_max_update is not None:
            padron_a_actualizar = investigadores_padron[:filters.renacyt_max_update]
        total_inv = len(padron_a_actualizar)
        limite_label = f" (límite: {filters.renacyt_max_update})" if filters.renacyt_max_update is not None else ""
        job.add_log("INFO", f"RENACYT: Consultando {total_inv} investigadores registrados por DNI{limite_label}...")
        for idx, inv in enumerate(padron_a_actualizar):
            dni = inv.get("dni")
            if not dni or dni in seen_dnis:
                continue
            try:
                nombre = f"{inv.get('nombres', '')} {inv.get('apellidos', '')}".strip()
                if idx % 10 == 0 or idx == total_inv - 1:
                    job.add_log("INFO", f"RENACYT: Consultando DNI ({idx+1}/{total_inv}): {nombre}...")
                record = await connector.search_by_dni(dni)
                if record:
                    seen_dnis.add(dni)
                    all_records.append(record)
            except Exception as e:
                logger.warning(f"[Sync/RENACYT] Error buscando DNI {dni}: {e}")
                job.add_log("WARN", f"RENACYT: Error buscando DNI {dni}: {str(e)}")

    # 2. Búsqueda expandida por institución UNMSM + filtro FISI
    if mode in ["expanded", "both"]:
        # Calcular límite de páginas según renacyt_max_new (cada página trae 50 registros)
        import math as _math
        if filters.renacyt_max_new is not None:
            MAX_RENACYT_PAGES = max(1, _math.ceil(filters.renacyt_max_new / 50))
            job.add_log("INFO", f"RENACYT: Búsqueda expandida UNMSM con filtro FISI (límite: {filters.renacyt_max_new} nuevos ≈ {MAX_RENACYT_PAGES} páginas)...")
        else:
            MAX_RENACYT_PAGES = 200
            job.add_log("INFO", "RENACYT: Iniciando búsqueda expandida por UNMSM con filtro FISI (sin límite)...")
        logger.info(f"[Sync/RENACYT] Iniciando búsqueda expandida en UNMSM (max páginas: {MAX_RENACYT_PAGES})...")
        nuevos_encontrados = 0
        try:
            for page in range(1, MAX_RENACYT_PAGES + 1):
                # Detener si ya alcanzamos el límite de nuevos
                if filters.renacyt_max_new is not None and nuevos_encontrados >= filters.renacyt_max_new:
                    job.add_log("INFO", f"RENACYT: Límite de {filters.renacyt_max_new} nuevos investigadores alcanzado. Deteniendo búsqueda expandida.")
                    break

                job.add_log("INFO", f"RENACYT: Descargando investigadores UNMSM - página {page}/{MAX_RENACYT_PAGES}...")
                result = await connector.search_by_institution("Universidad Nacional Mayor de San Marcos", page=page, page_size=50)
                registros = result.get("data", [])
                total = result.get("total", 0)

                if not registros:
                    break

                matched_this_page = 0
                for rec in registros:
                    if filters.renacyt_max_new is not None and nuevos_encontrados >= filters.renacyt_max_new:
                        break
                    dni = rec.get("numero_documento") or rec.get("dni")
                    if dni and dni in seen_dnis:
                        continue

                    # Filtro FISI: buscar en campos de departamento/especialidad
                    dep = str(rec.get("departamento_academico", "")).lower()
                    esp = str(rec.get("especialidad", "")).lower()
                    fac = str(rec.get("facultad", "")).lower()
                    inst = str(rec.get("institucion_laboral_principal", "")).lower()
                    all_text = f"{dep} {esp} {fac} {inst}"

                    if any(kw in all_text for kw in FISI_KEYWORDS):
                        if dni:
                            seen_dnis.add(dni)
                        all_records.append(rec)
                        matched_this_page += 1
                        nuevos_encontrados += 1

                job.add_log("INFO", f"RENACYT: Página {page} procesada. {matched_this_page} coinciden con FISI (total nuevos: {nuevos_encontrados}).")

                # Paginación natural
                if page * 50 >= total:
                    break
            else:
                job.add_log("WARN", f"RENACYT: Se alcanzó el límite máximo de páginas ({MAX_RENACYT_PAGES}).")

        except Exception as e:
            logger.error(f"[Sync/RENACYT] Error en búsqueda expandida: {e}")
            job.add_log("ERROR", f"RENACYT: Error en búsqueda expandida: {str(e)}")

    job.add_log("SUCCESS", f"RENACYT: Extracción finalizada. {len(all_records)} investigadores encontrados.")
    logger.info(f"[Sync/RENACYT] Total investigadores encontrados: {len(all_records)}")
    return {"registros": all_records, "total": len(all_records)}

# ---------------------------------------------------------------------------
# Tarea de background: orquesta todo y persiste en BD
# ---------------------------------------------------------------------------
async def _run_sync_job(job_id: str, request: SyncRequest):
    """Tarea principal del orquestador. Corre en background."""
    from app.db.session import AsyncSessionLocal

    job = _sync_jobs.get(job_id)
    if not job:
        return

    try:
        job.status = "running"
        job.add_log("INFO", "Iniciando ejecución en segundo plano...")
        async with AsyncSessionLocal() as db:
            await job.save_to_db(db)

        report = {s: {"procesados": 0, "resueltos": 0, "cuarentena": 0, "errores": 0, "registros": []} for s in request.sources}

        if not _cmr_ok:
            job.status = "failed"
            job.error = "El módulo CMR no está disponible. Imposible reconciliar."
            job.add_log("ERROR", "Fallo: El módulo CMR no está disponible en el servidor.")
            job.finished_at = datetime.now(timezone.utc).isoformat()
            async with AsyncSessionLocal() as db:
                await job.save_to_db(db)
            return

        async with AsyncSessionLocal() as db:
            # Pre-cargar padrón de investigadores para fuzzy matching y búsquedas
            try:
                job.add_log("INFO", "Cargando padrón de investigadores desde la base de datos local...")
                res = await db.execute(select(Investigador.dni, Investigador.nombres, Investigador.apellidos))
                padron_rows = res.all()
                padron_dict = {row.dni: f"{row.nombres} {row.apellidos}" for row in padron_rows}
                padron_list = [{"dni": row.dni, "nombres": row.nombres, "apellidos": row.apellidos} for row in padron_rows]
                job.add_log("INFO", f"Padrón cargado. {len(padron_rows)} investigadores encontrados en la base de datos.")
            except Exception as e:
                logger.error(f"[Sync] Error cargando padrón: {e}")
                job.add_log("WARN", f"Error cargando padrón: {str(e)}")
                padron_dict = {}
                padron_list = []

            await job.save_to_db(db)

            # ---- VRIP ----
            if "VRIP" in request.sources:
                try:
                    job.add_log("INFO", "VRIP: Iniciando extracción de datos desde VRIP...")
                    await job.save_to_db(db)
                    vrip_data = await asyncio.to_thread(_run_vrip, request.filters, job)

                    from app.models.domain import Proyecto, Convocatoria
                    from sqlalchemy.future import select as sa_select
                    from datetime import date, timedelta

                    convocatorias_lista = vrip_data.get("convocatorias_lista", [])
                    # Reconciliar convocatorias (Upsert sin CMR)
                    job.add_log("INFO", f"VRIP: Reconciliando {len(convocatorias_lista)} convocatorias con la base de datos...")
                    for conv in convocatorias_lista:
                        report["VRIP"]["procesados"] += 1
                        try:
                            parsed_close_date = None
                            if conv.plazo_cierre:
                                try:
                                    parsed_close_date = date.fromisoformat(conv.plazo_cierre)
                                except ValueError:
                                    pass
                            
                            if parsed_close_date:
                                estado_resuelto = "Abierta" if parsed_close_date >= date.today() else "Cerrada"
                            else:
                                estado_resuelto = "Abierta"
                            
                            res = await db.execute(sa_select(Convocatoria).where(
                                (Convocatoria.titulo_convocatoria == conv.titulo) |
                                (Convocatoria.url_bases_vrip == conv.enlace)
                            ))
                            existing_conv = res.scalars().first()
                            
                            if existing_conv:
                                if existing_conv.fecha_cierre != parsed_close_date:
                                    historial = existing_conv.cambios_cronograma or []
                                    motivo = "Modificación de cronograma detectada en sincronización."
                                    historial.append({
                                        "fecha_anterior": existing_conv.fecha_cierre.isoformat() if existing_conv.fecha_cierre else None,
                                        "fecha_nueva": parsed_close_date.isoformat(),
                                        "motivo": motivo,
                                        "fecha_cambio": datetime.now(timezone.utc).isoformat()
                                    })
                                    existing_conv.cambios_cronograma = historial
                                    existing_conv.fecha_cierre = parsed_close_date
                                if conv.fecha_inicio:
                                    try:
                                        parsed_start_date = date.fromisoformat(conv.fecha_inicio)
                                        if existing_conv.fecha_inicio_inscripcion != parsed_start_date:
                                            existing_conv.fecha_inicio_inscripcion = parsed_start_date
                                    except ValueError:
                                        pass
                                existing_conv.url_bases_vrip = conv.enlace
                                existing_conv.estado_convocatoria = estado_resuelto
                                existing_conv.cronograma_detallado = conv.cronograma_detallado
                                report["VRIP"]["resueltos"] += 1
                                report["VRIP"]["registros"].append({
                                    "tipo": "Convocatoria",
                                    "id": str(existing_conv.id_convocatoria) if existing_conv.id_convocatoria else conv.titulo,
                                    "titulo": conv.titulo,
                                    "estado": "Actualizado"
                                })
                                
                                # Log audit event for updated convocatoria
                                from app.models.domain import LogAuditoria
                                import uuid as _uuid
                                user_uuid = _uuid.UUID(job.id_usuario) if job.id_usuario else None
                                audit_log = LogAuditoria(
                                    tipo_evento="SYNC_VRIP",
                                    entidad_afectada="convocatoria",
                                    pk_entidad=str(existing_conv.id_convocatoria) if existing_conv.id_convocatoria else conv.titulo[:100],
                                    valor_nuevo={
                                        "titulo": conv.titulo,
                                        "fecha_cierre": parsed_close_date.isoformat() if parsed_close_date else None,
                                        "estado": estado_resuelto,
                                        "accion": "UPDATE"
                                    },
                                    id_usuario=user_uuid,
                                    resultado="Exito",
                                    detalle_error=f"Convocatoria actualizada por sync VRIP. Job: {job_id}"
                                )
                                db.add(audit_log)
                            else:
                                new_conv = Convocatoria(
                                    titulo_convocatoria=conv.titulo,
                                    entidad_emisora="VRIP-UNMSM",
                                    fecha_inicio_inscripcion=date.fromisoformat(conv.fecha_inicio) if conv.fecha_inicio else date.today(),
                                    fecha_cierre=parsed_close_date,
                                    url_bases_vrip=conv.enlace,
                                    cambios_cronograma=[],
                                    cronograma_detallado=conv.cronograma_detallado,
                                    estado_convocatoria=estado_resuelto
                                )
                                db.add(new_conv)
                                report["VRIP"]["resueltos"] += 1
                                report["VRIP"]["registros"].append({
                                    "tipo": "Convocatoria",
                                    "id": conv.titulo,
                                    "titulo": conv.titulo,
                                    "estado": "Nuevo"
                                })
                                
                                # Log audit event for new convocatoria
                                from app.models.domain import LogAuditoria
                                import uuid as _uuid
                                user_uuid = _uuid.UUID(job.id_usuario) if job.id_usuario else None
                                audit_log = LogAuditoria(
                                    tipo_evento="SYNC_VRIP",
                                    entidad_afectada="convocatoria",
                                    pk_entidad=conv.titulo[:100],
                                    valor_nuevo={
                                        "titulo": conv.titulo,
                                        "fecha_cierre": parsed_close_date.isoformat() if parsed_close_date else None,
                                        "estado": estado_resuelto,
                                        "accion": "INSERT"
                                    },
                                    id_usuario=user_uuid,
                                    resultado="Exito",
                                    detalle_error=f"Nueva convocatoria ingresada por sync VRIP. Job: {job_id}"
                                )
                                db.add(audit_log)
                        except Exception as e:
                            logger.warning(f"[Sync/VRIP] Error procesando convocatoria: {e}")
                            report["VRIP"]["errores"] += 1

                    # Reconciliar proyectos
                    proyectos_lista = vrip_data.get("proyectos", [])
                    job.add_log("INFO", f"VRIP: Reconciliando {len(proyectos_lista)} proyectos a través del motor CMR...")
                    for proy in proyectos_lista:
                        cmr_input = _map_vrip_proyecto_to_cmr(proy)
                        if not cmr_input:
                            report["VRIP"]["errores"] += 1
                            continue

                        report["VRIP"]["procesados"] += 1
                        try:
                            res = await db.execute(sa_select(Proyecto).where(Proyecto.codigo_proyecto == cmr_input.codigo_proyecto))
                            existing = res.scalars().first()
                            current_db = {c.name: getattr(existing, c.name) for c in existing.__table__.columns} if existing else None

                            merged, quarantine, reason = rules_engine.reconcile_proyecto(current_db, cmr_input, "VRIP")

                            if quarantine:
                                await persister.persist_quarantine(db, "proyecto", cmr_input.codigo_proyecto, ["VRIP"], merged, reason)
                                report["VRIP"]["cuarentena"] += 1
                                report["VRIP"]["registros"].append({
                                    "tipo": "Proyecto",
                                    "id": cmr_input.codigo_proyecto,
                                    "titulo": merged.get("titulo_proyecto", ""),
                                    "estado": "En Cuarentena"
                                })
                            else:
                                await persister.persist_resolved(db, "proyecto", cmr_input.codigo_proyecto, merged, "VRIP")
                                report["VRIP"]["resueltos"] += 1
                                report["VRIP"]["registros"].append({
                                    "tipo": "Proyecto",
                                    "id": cmr_input.codigo_proyecto,
                                    "titulo": merged.get("titulo_proyecto", ""),
                                    "estado": "Resuelto"
                                })
                        except Exception as e:
                            logger.warning(f"[Sync/VRIP] Error reconciliando proyecto: {e}")
                            report["VRIP"]["errores"] += 1

                    report["VRIP"]["convocatorias_extraidas"] = vrip_data.get("convocatorias", 0)
                    job.add_log("SUCCESS", "VRIP: Sincronización y reconciliación de VRIP completada.")
                    await job.save_to_db(db)

                except Exception as e:
                    logger.error(f"[Sync/VRIP] Fallo general: {e}")
                    job.add_log("ERROR", f"VRIP: Fallo general en el proceso: {str(e)}")
                    report["VRIP"]["errores"] += 1
                    await job.save_to_db(db)

            # ---- CYBERTESIS ----
            if "CYBERTESIS" in request.sources:
                try:
                    job.add_log("INFO", "Cybertesis: Iniciando extracción de tesis...")
                    await job.save_to_db(db)
                    cyb_data = await asyncio.to_thread(_run_cybertesis, request.filters, padron_list, job)

                    # Instanciar cliente RENACYT único para este bucle de sincronización
                    renacyt_client = None
                    if _ren_ok and RenacytConnector:
                        try:
                            renacyt_client = RenacytConnector(verify_ssl=False, rate_limit_delay=settings.RENACYT_RATE_LIMIT_SECONDS)
                        except Exception:
                            pass

                    tesis_lista = cyb_data.get("tesis", [])
                    total_tesis = len(tesis_lista)
                    job.add_log("INFO", f"Cybertesis: Reconciliando asesores de {total_tesis} tesis en motor CMR...")
                    await job.save_to_db(db)

                    for idx, tesis in enumerate(tesis_lista):
                        if request.filters.only_reconcile_local:
                            has_local_advisor = False
                            from sgpi_cmr.services.name_normalizer import normalizer
                            for asesor_nombre in (tesis.asesores or []):
                                try:
                                    match = normalizer.find_best_match(asesor_nombre, padron_dict)
                                    if match:
                                        has_local_advisor = True
                                        break
                                except Exception:
                                    pass
                            if not has_local_advisor:
                                continue

                        # Log progress periodically
                        if idx % 25 == 0 or idx == total_tesis - 1:
                            porcentaje = int((idx + 1) * 100 / total_tesis)
                            job.add_log("INFO", f"Cybertesis: Reconciliando tesis {idx + 1}/{total_tesis} ({porcentaje}%)...")
                            await job.save_to_db(db)

                        if not tesis.asesores:
                            # Tesis sin asesores: enviar a cuarentena por datos incompletos
                            report["CYBERTESIS"]["procesados"] += 1
                            report["CYBERTESIS"]["cuarentena"] += 1
                            report["CYBERTESIS"]["registros"].append({
                                "tipo": "AsesorTesis",
                                "id": str(tesis.url_repositorio),
                                "titulo": tesis.titulo or "Sin Título",
                                "estado": "En Cuarentena (Sin Asesores)"
                            })
                            await persister.persist_quarantine(
                                db,
                                entidad="tesis",
                                llave_sugerida=str(tesis.url_repositorio),
                                fuentes=["Cybertesis"],
                                conflicto={
                                    "url_cybertesis": str(tesis.url_repositorio),
                                    "titulo_tesis": tesis.titulo,
                                    "autor_estudiante_texto": ", ".join(tesis.autores) if tesis.autores else None,
                                    "asesor_texto": None
                                },
                                motivo="Tesis sin asesores registrados en Cybertesis. Requiere revisión manual."
                            )
                            continue

                        # Cada asesor de la tesis es un registro para reconciliar
                        for asesor_nombre in (tesis.asesores or []):
                            try:
                                # Pre-check matching against local padrón to log RENACYT query
                                match = None
                                from sgpi_cmr.services.name_normalizer import normalizer
                                try:
                                    match = normalizer.find_best_match(asesor_nombre, padron_dict)
                                except Exception:
                                    pass

                                if not match:
                                    # Not found locally, will query RENACYT
                                    job.add_log("INFO", f"Cybertesis: Consultando asesor '{asesor_nombre}' en RENACYT (Tesis {idx + 1}/{total_tesis})...")
                                    await job.save_to_db(db)

                                cmr_input = AsesorTesisInput(
                                    asesor_texto=asesor_nombre,
                                    url_cybertesis=str(tesis.url_repositorio),
                                    titulo_tesis=tesis.titulo,
                                    autor_estudiante_texto=", ".join(tesis.autores) if tesis.autores else None,
                                )
                                report["CYBERTESIS"]["procesados"] += 1
                                merged, quarantine, reason = await rules_engine.reconcile_asesor_tesis(
                                    padron_dict, cmr_input, renacyt_client
                                )

                                if quarantine:
                                    await persister.persist_quarantine(
                                        db, "tesis", str(tesis.url_repositorio), ["Cybertesis"], merged, reason
                                    )
                                    report["CYBERTESIS"]["cuarentena"] += 1
                                    report["CYBERTESIS"]["registros"].append({
                                        "tipo": "AsesorTesis",
                                        "id": str(tesis.url_repositorio),
                                        "titulo": merged.get("titulo_tesis", ""),
                                        "estado": "En Cuarentena"
                                    })
                                else:
                                    await persister.persist_resolved(
                                        db, "tesis", str(tesis.url_repositorio), merged, "Cybertesis"
                                    )
                                    report["CYBERTESIS"]["resueltos"] += 1
                                    report["CYBERTESIS"]["registros"].append({
                                        "tipo": "AsesorTesis",
                                        "id": str(tesis.url_repositorio),
                                        "titulo": merged.get("titulo_tesis", ""),
                                        "estado": "Resuelto"
                                    })
                            except Exception as e:
                                logger.warning(f"[Sync/Cybertesis] Error procesando asesor: {e}")
                                report["CYBERTESIS"]["errores"] += 1

                    job.add_log("SUCCESS", "Cybertesis: Reconciliación de tesis completada.")
                    await job.save_to_db(db)

                except Exception as e:
                    logger.error(f"[Sync/Cybertesis] Fallo general: {e}")
                    job.add_log("ERROR", f"Cybertesis: Fallo general en el proceso: {str(e)}")
                    report["CYBERTESIS"]["errores"] += 1
                    await job.save_to_db(db)

            # ---- RENACYT ----
            if "RENACYT" in request.sources:
                try:
                    job.add_log("INFO", "RENACYT: Iniciando extracción de investigadores...")
                    await job.save_to_db(db)
                    ren_data = await _run_renacyt(request.filters, padron_list, job)

                    from app.models.domain import Investigador as InvModel
                    from sqlalchemy.future import select as sa_select

                    registros_ren = ren_data.get("registros", [])
                    job.add_log("INFO", f"RENACYT: Reconciliando {len(registros_ren)} investigadores en motor CMR...")
                    for rec in registros_ren:
                        cmr_input = _map_renacyt_to_cmr(rec)
                        if not cmr_input:
                            report["RENACYT"]["errores"] += 1
                            continue

                        report["RENACYT"]["procesados"] += 1
                        try:
                            res = await db.execute(sa_select(InvModel).where(InvModel.dni == cmr_input.dni))
                            existing = res.scalars().first()
                            current_db = {c.name: getattr(existing, c.name) for c in existing.__table__.columns} if existing else None

                            merged, quarantine, reason = rules_engine.reconcile_investigador(current_db, cmr_input, "RENACYT")

                            if quarantine:
                                await persister.persist_quarantine(db, "investigador", cmr_input.dni, ["RENACYT"], merged, reason)
                                report["RENACYT"]["cuarentena"] += 1
                                report["RENACYT"]["registros"].append({
                                    "tipo": "Investigador",
                                    "id": cmr_input.dni,
                                    "titulo": f"{merged.get('nombres', '')} {merged.get('apellidos', '')}".strip(),
                                    "estado": "En Cuarentena"
                                })
                            else:
                                await persister.persist_resolved(db, "investigador", cmr_input.dni, merged, "RENACYT")
                                report["RENACYT"]["resueltos"] += 1
                                report["RENACYT"]["registros"].append({
                                    "tipo": "Investigador",
                                    "id": cmr_input.dni,
                                    "titulo": f"{merged.get('nombres', '')} {merged.get('apellidos', '')}".strip(),
                                    "estado": "Resuelto"
                                })
                        except Exception as e:
                            logger.warning(f"[Sync/RENACYT] Error reconciliando investigador {cmr_input.dni}: {e}")
                            report["RENACYT"]["errores"] += 1

                    job.add_log("SUCCESS", "RENACYT: Reconciliación de investigadores completada.")
                    await job.save_to_db(db)

                except Exception as e:
                    logger.error(f"[Sync/RENACYT] Fallo general: {e}")
                    job.add_log("ERROR", f"RENACYT: Fallo general en el proceso: {str(e)}")
                    report["RENACYT"]["errores"] += 1
                    await job.save_to_db(db)

            # Final success save
            job.status = "completed"
            job.report = report
            job.finished_at = datetime.now(timezone.utc).isoformat()
            job.add_log("SUCCESS", "Sincronización global finalizada con éxito.")
            await job.save_to_db(db)
            logger.info(f"[Sync] Job {job_id} completado. Reporte: {report}")

    except asyncio.CancelledError:
        logger.info(f"[Sync] Job {job_id} fue cancelado por el usuario.")
        job.status = "stopped"
        job.finished_at = datetime.now(timezone.utc).isoformat()
        job.add_log("WARN", "Sincronización cancelada por el usuario.")
        async with AsyncSessionLocal() as db:
            await job.save_to_db(db)
    except Exception as e:
        logger.error(f"[Sync] Fallo crítico en el background execution de job {job_id}: {e}", exc_info=True)
        job.status = "failed"
        job.error = str(e)
        job.finished_at = datetime.now(timezone.utc).isoformat()
        job.add_log("ERROR", f"Fallo crítico: {str(e)}")
        async with AsyncSessionLocal() as db:
            await job.save_to_db(db)
    finally:
        _sync_jobs.pop(job_id, None)
        _sync_tasks.pop(job_id, None)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/run",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Lanzar sincronización global",
    description=(
        "Inicia la extracción y reconciliación de datos desde las fuentes seleccionadas "
        "(VRIP, CYBERTESIS, RENACYT). El proceso corre en background y se puede consultar "
        "con GET /sync/{job_id}/status."
    ),
)
async def run_sync(
    request: SyncRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_staff),
):
    if not _cmr_ok:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="El módulo CMR no está disponible. Revisa la instalación del servidor.",
        )

    valid_sources = {"VRIP", "CYBERTESIS", "RENACYT"}
    invalid = [s for s in request.sources if s.upper() not in valid_sources]
    if invalid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Fuentes inválidas: {invalid}. Opciones válidas: {list(valid_sources)}",
        )

    # C3.2 check active job in DB
    from app.models.domain import SyncJob
    active_stmt = select(SyncJob).where(SyncJob.status.in_(["queued", "running"])).limit(1)
    active_res = await db.execute(active_stmt)
    active_job = active_res.scalars().first()
    if active_job:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "Ya hay una sincronización activa en curso.",
                "job_id": str(active_job.job_id),
                "status": active_job.status
            }
        )

    import uuid
    job_id = str(uuid.uuid4())
    user_id = current_user.get("id_usuario") if isinstance(current_user, dict) else None
    
    job = SyncJobState(
        job_id=job_id,
        sources=request.sources,
        filters=request.filters.model_dump(),
        id_usuario=str(user_id) if user_id else None
    )
    _sync_jobs[job_id] = job
    
    # Persist initially to DB as queued
    await job.save_to_db(db)
    
    # Desacoplar la ejecución usando asyncio.create_task para evitar que Starlette/uvicorn
    # mantengan la conexión del request HTTP abierta o interfieran con la respuesta.
    task = asyncio.create_task(_run_sync_job(job_id, request))
    _sync_tasks[job_id] = task

    return {
        "success": True,
        "data": {
            "job_id": job_id,
            "sources": request.sources,
            "filters": request.filters.model_dump(),
            "message": "Sincronización iniciada en background. Consulta el estado con GET /sync/{job_id}/status.",
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.post(
    "/{job_id}/stop",
    summary="Detener sincronización activa",
    description="Detiene una sincronización activa en curso cancelando la tarea asíncrona.",
)
async def stop_sync(
    job_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_staff),
):
    task = _sync_tasks.get(job_id)
    job = _sync_jobs.get(job_id)
    
    if not task or not job:
        # Buscar en base de datos si de pronto ya terminó
        from app.models.domain import SyncJob
        import uuid as _uuid
        try:
            uuid_obj = _uuid.UUID(job_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="ID de job inválido.")
            
        result = await db.execute(select(SyncJob).where(SyncJob.job_id == uuid_obj))
        db_job = result.scalars().first()
        if not db_job:
            raise HTTPException(status_code=404, detail="Job no encontrado.")
        if db_job.status in ["completed", "failed", "stopped"]:
            return {
                "success": False,
                "message": f"El job ya finalizó con estado: {db_job.status}",
                "status": db_job.status
            }
        
        # Si estaba en queued/running pero no en memoria (e.g. reinicio)
        db_job.status = "stopped"
        db_job.finished_at = datetime.now(timezone.utc)
        
        progress = list(db_job.progress_logs or [])
        progress.append({
            "time": datetime.now().strftime("%H:%M:%S"),
            "level": "WARN",
            "text": "Sincronización marcada como detenida (no estaba activa en memoria)."
        })
        db_job.progress_logs = progress
        await db.commit()
        return {
            "success": True,
            "message": "Sincronización marcada como detenida."
        }

    # Cancelar la tarea asíncrona
    task.cancel()
    return {
        "success": True,
        "message": "Sincronización cancelada correctamente."
    }


@router.get(
    "/sources/status",
    summary="Estado de salud de las fuentes externas",
    description="Verifica la disponibilidad de los conectores instalados (VRIP, Cybertesis, RENACYT).",
)
async def get_sources_health():
    """
    Retorna qué conectores están disponibles (instalados y con sus dependencias en orden).
    No realiza llamadas reales a las plataformas externas para no consumir recursos.
    """
    return {
        "success": True,
        "data": {
            "VRIP": {
                "available": _vrip_ok,
                "description": "Convocatorias y proyectos del Vicerrectorado de Investigación (UNMSM)",
                "status": "online" if _vrip_ok else "unavailable",
            },
            "CYBERTESIS": {
                "available": _cyb_ok,
                "description": "Repositorio de tesis académicas de la UNMSM (DSpace 7)",
                "status": "online" if _cyb_ok else "unavailable",
            },
            "RENACYT": {
                "available": _ren_ok,
                "description": "Registro Nacional de Investigadores Científicos (CONCYTEC)",
                "status": "online" if _ren_ok else "unavailable",
            },
            "CMR": {
                "available": _cmr_ok,
                "description": "Motor de Reconciliación interno (requerido para persistencia)",
                "status": "online" if _cmr_ok else "critical_error",
            },
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get(
    "/active/job",
    summary="Obtener job activo",
    description="Retorna el job que se encuentra actualmente en cola o en ejecución, si existe.",
)
async def get_active_job(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_staff),
):
    active_job = None
    # 1. Buscar primero en memoria
    for jid, job in _sync_jobs.items():
        if job.status in ["queued", "running"]:
            active_job = {
                "job_id": job.job_id,
                "status": job.status,
                "sources": job.sources,
                "started_at": job.started_at,
                "progress_logs": job.progress_logs,
                "filters": getattr(job, "filters", {}),
            }
            break

    if not active_job:
        # 2. Si no está en memoria, buscar en la BD
        from app.models.domain import SyncJob
        stmt = select(SyncJob).where(SyncJob.status.in_(["queued", "running"])).limit(1)
        res = await db.execute(stmt)
        db_job = res.scalars().first()
        if db_job:
            active_job = {
                "job_id": str(db_job.job_id),
                "status": db_job.status,
                "sources": db_job.sources,
                "started_at": db_job.started_at.isoformat() if db_job.started_at else None,
                "progress_logs": db_job.progress_logs,
                "filters": getattr(db_job, "filters", {}),
            }

    return {
        "success": True,
        "data": active_job,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get(
    "/{job_id}/status",
    summary="Estado de la sincronización",
    description="Retorna el estado actual de un job de sincronización por su ID.",
)
async def get_sync_status(
    job_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_staff),
):
    job = _sync_jobs.get(job_id)
    if job:
        payload = {
            "job_id": job.job_id,
            "status": job.status,
            "sources": job.sources,
            "started_at": job.started_at,
            "finished_at": job.finished_at,
            "progress_logs": job.progress_logs,
        }
        if job.status == "completed":
            payload["report"] = job.report
        elif job.status == "failed":
            payload["error"] = job.error
    else:
        # Check database
        from app.models.domain import SyncJob
        import uuid as _uuid
        try:
            uuid_obj = _uuid.UUID(job_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="ID de job inválido.")
            
        result = await db.execute(select(SyncJob).where(SyncJob.job_id == uuid_obj))
        db_job = result.scalars().first()
        if not db_job:
            raise HTTPException(status_code=404, detail="Job no encontrado.")
            
        payload = {
            "job_id": str(db_job.job_id),
            "status": db_job.status,
            "sources": db_job.sources,
            "started_at": db_job.started_at.isoformat() if db_job.started_at else None,
            "finished_at": db_job.finished_at.isoformat() if db_job.finished_at else None,
            "progress_logs": db_job.progress_logs,
        }
        if db_job.status == "completed":
            payload["report"] = db_job.report
        elif db_job.status == "failed":
            payload["error"] = db_job.error_message

    return {
        "success": True,
        "data": payload,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.delete(
    "/jobs/cleanup",
    summary="Limpiar jobs antiguos",
    description="Elimina de la base de datos los jobs completados o fallidos con más de N días de antigüedad."
)
async def cleanup_old_jobs(
    days_old: int = 30,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_staff)
):
    from app.models.domain import SyncJob
    from datetime import datetime, timezone, timedelta
    
    cutoff = datetime.now(timezone.utc) - timedelta(days=days_old)
    
    # Query to count first
    select_stmt = select(SyncJob).where(
        SyncJob.status.in_(["completed", "failed"]),
        SyncJob.created_at < cutoff
    )
    result = await db.execute(select_stmt)
    jobs_to_delete = result.scalars().all()
    count = len(jobs_to_delete)
    
    if count > 0:
        from sqlalchemy import delete as sa_delete
        delete_stmt = sa_delete(SyncJob).where(
            SyncJob.status.in_(["completed", "failed"]),
            SyncJob.created_at < cutoff
        )
        await db.execute(delete_stmt)
        await db.commit()
        
    return {
        "success": True,
        "message": f"Se eliminaron {count} jobs antiguos con más de {days_old} días.",
        "deleted_count": count
    }


# ---------------------------------------------------------------------------
# Endpoints de Cuarentena / Reconciliación Pendiente
# ---------------------------------------------------------------------------

class QuarantineResolveRequest(BaseModel):
    action: str                          # "aprobar" | "rechazar"
    dni_corregido: Optional[str] = None  # DNI del asesor corregido manualmente
    motivo_rechazo: Optional[str] = None
    resolucion_masiva: Optional[bool] = False


@router.get(
    "/quarantine",
    summary="Listar registros en cuarentena",
    description="Retorna la lista paginada de registros pendientes de revisión manual.",
)
async def list_quarantine(
    page: int = 1,
    page_size: int = 20,
    entidad: Optional[str] = None,
    estado: str = "Pendiente",
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_staff),
):
    from app.models.domain import ReconciliacionPendiente
    from sqlalchemy import func

    stmt = select(ReconciliacionPendiente)
    if estado != "todos":
        stmt = stmt.where(ReconciliacionPendiente.estado == estado)
    if entidad:
        stmt = stmt.where(ReconciliacionPendiente.entidad_afectada == entidad)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total_result = await db.execute(count_stmt)
    total = total_result.scalar_one()

    stmt = stmt.order_by(ReconciliacionPendiente.fecha_registro.desc())
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    items = result.scalars().all()

    # Calculate masiva counts for tesis
    masiva_counts = {}
    if any(i.entidad_afectada == 'tesis' and i.estado == 'Pendiente' for i in items):
        # Fetch all pending tesis to calculate counts
        stmt_all_tesis = select(ReconciliacionPendiente).where(
            ReconciliacionPendiente.estado == 'Pendiente',
            ReconciliacionPendiente.entidad_afectada == 'tesis'
        )
        res_all = await db.execute(stmt_all_tesis)
        all_pend_tesis = res_all.scalars().all()

        for item in items:
            if item.entidad_afectada == 'tesis' and item.estado == 'Pendiente':
                item_asesor = (item.datos_conflicto or {}).get("asesor_texto", "")
                related_items = []
                for otro in all_pend_tesis:
                    if otro.id_pendiente != item.id_pendiente:
                        otro_asesor = (otro.datos_conflicto or {}).get("asesor_texto", "")
                        if _is_same_advisor(otro_asesor, item_asesor):
                            related_items.append({
                                "id_pendiente": otro.id_pendiente,
                                "titulo_tesis": (otro.datos_conflicto or {}).get("titulo_tesis", "Sin Título"),
                                "autor": (otro.datos_conflicto or {}).get("autor_estudiante_texto", "Desconocido")
                            })
                masiva_counts[item.id_pendiente] = related_items

    def serialize(item):
        base = {
            "id_pendiente": item.id_pendiente,
            "entidad_afectada": item.entidad_afectada,
            "llave_primaria_sugerida": item.llave_primaria_sugerida,
            "fuentes_involucradas": item.fuentes_involucradas,
            "datos_conflicto": item.datos_conflicto,
            "motivo_cuarentena": item.motivo_cuarentena,
            "estado": item.estado,
            "fecha_registro": item.fecha_registro.isoformat() if item.fecha_registro else None,
            "fecha_revision": item.fecha_revision.isoformat() if item.fecha_revision else None,
        }
        if item.id_pendiente in masiva_counts:
            base["related_count"] = len(masiva_counts[item.id_pendiente])
            base["related_items"] = masiva_counts[item.id_pendiente]
        return base

    return {
        "success": True,
        "data": {
            "items": [serialize(i) for i in items],
            "total": total,
            "page": page,
            "page_size": page_size,
            "pages": (total + page_size - 1) // page_size,
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get(
    "/quarantine/{id_pendiente}",
    summary="Detalle de un registro en cuarentena",
)
async def get_quarantine_item(
    id_pendiente: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_staff),
):
    from app.models.domain import ReconciliacionPendiente

    result = await db.execute(
        select(ReconciliacionPendiente).where(ReconciliacionPendiente.id_pendiente == id_pendiente)
    )
    item = result.scalars().first()
    if not item:
        raise HTTPException(status_code=404, detail="Registro de cuarentena no encontrado.")

    return {
        "success": True,
        "data": {
            "id_pendiente": item.id_pendiente,
            "entidad_afectada": item.entidad_afectada,
            "llave_primaria_sugerida": item.llave_primaria_sugerida,
            "fuentes_involucradas": item.fuentes_involucradas,
            "datos_conflicto": item.datos_conflicto,
            "motivo_cuarentena": item.motivo_cuarentena,
            "estado": item.estado,
            "fecha_registro": item.fecha_registro.isoformat() if item.fecha_registro else None,
            "fecha_revision": item.fecha_revision.isoformat() if item.fecha_revision else None,
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.post(
    "/quarantine/{id_pendiente}/resolve",
    summary="Resolver un registro en cuarentena",
    description=(
        "Aprueba o rechaza un registro pendiente. "
        "Para 'aprobar' una tesis, envía dni_corregido con el DNI del asesor identificado. "
        "Para 'rechazar', indica opcionalmente el motivo."
    ),
)
async def resolve_quarantine(
    id_pendiente: int,
    payload: QuarantineResolveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_staff),
):
    if payload.action not in ("aprobar", "rechazar"):
        raise HTTPException(status_code=400, detail="La acción debe ser 'aprobar' o 'rechazar'.")
    if not _cmr_ok:
        raise HTTPException(status_code=503, detail="El módulo CMR no está disponible.")

    from app.models.domain import ReconciliacionPendiente
    from sgpi_cmr.services.persister import persister

    result = await db.execute(
        select(ReconciliacionPendiente).where(ReconciliacionPendiente.id_pendiente == id_pendiente)
    )
    item = result.scalars().first()
    if not item:
        raise HTTPException(status_code=404, detail="Registro de cuarentena no encontrado.")
    if item.estado != "Pendiente":
        raise HTTPException(status_code=409, detail=f"El registro ya fue procesado: '{item.estado}'.")

    registros_resueltos = 0
    try:
        if payload.action == "aprobar":
            registros_resueltos = 1
            merged_data = dict(item.datos_conflicto)
            asesor_texto_original = merged_data.get("asesor_texto")
            
            if payload.dni_corregido:
                merged_data["dni_asesor"] = payload.dni_corregido
                merged_data.pop("dni_asesor_reconciliado", None)

            await persister.persist_resolved(
                db,
                entidad=item.entidad_afectada,
                llave_pk=item.llave_primaria_sugerida,
                merged_data=merged_data,
                fuente_ganadora="Resolución Manual Admin",
                auto_commit=False
            )
            item.estado = "Aprobado"
            
            # --- RESOLUCIÓN MASIVA PARA TESIS CON EL MISMO ASESOR ---
            if payload.resolucion_masiva and payload.dni_corregido and item.entidad_afectada == "tesis" and asesor_texto_original:
                stmt = select(ReconciliacionPendiente).where(
                    ReconciliacionPendiente.estado == "Pendiente",
                    ReconciliacionPendiente.entidad_afectada == "tesis",
                    ReconciliacionPendiente.id_pendiente != id_pendiente
                )
                res = await db.execute(stmt)
                otros_pendientes = res.scalars().all()
                
                from datetime import datetime as _dt, timezone as _tz
                for otro in otros_pendientes:
                    otro_datos = dict(otro.datos_conflicto) if otro.datos_conflicto else {}
                    otro_asesor = otro_datos.get("asesor_texto", "")
                    
                    if _is_same_advisor(otro_asesor, asesor_texto_original):
                        otro_datos["dni_asesor"] = payload.dni_corregido
                        otro_datos.pop("dni_asesor_reconciliado", None)
                        
                        await persister.persist_resolved(
                            db,
                            entidad=otro.entidad_afectada,
                            llave_pk=otro.llave_primaria_sugerida,
                            merged_data=otro_datos,
                            fuente_ganadora="Resolución Manual Admin (Masiva)",
                            auto_commit=False
                        )
                        otro.estado = "Aprobado"
                        otro.fecha_revision = _dt.now(_tz.utc)
                        db.add(otro)
                        
                        # Log auditoría para la resolución masiva en reconciliacion_pendientes
                        from app.models.domain import LogAuditoria
                        import uuid as _uuid
                        user_uuid = _uuid.UUID(current_user.get("id_usuario")) if isinstance(current_user, dict) and current_user.get("id_usuario") else None
                        
                        audit_log_masivo = LogAuditoria(
                            tipo_evento="UPDATE",
                            entidad_afectada="reconciliacion_pendientes",
                            pk_entidad=str(otro.id_pendiente),
                            valor_nuevo={
                                "accion": "aprobar (masivo)",
                                "nuevo_estado": "Aprobado",
                                "dni_corregido": payload.dni_corregido,
                            },
                            id_usuario=user_uuid,
                            resultado="Exito",
                            detalle_error=f"Cuarentena resuelta automáticamente por resolución masiva del administrador."
                        )
                        db.add(audit_log_masivo)
                        
                        registros_resueltos += 1
        else:
            item.estado = "Rechazado"
            if payload.motivo_rechazo:
                item.motivo_cuarentena = f"{item.motivo_cuarentena} | Rechazo: {payload.motivo_rechazo}"

        from datetime import datetime as _dt, timezone as _tz
        item.fecha_revision = _dt.now(_tz.utc)
        db.add(item)
        await db.commit()

        # Log audit event for quarantine resolution
        from app.models.domain import LogAuditoria
        import uuid as _uuid
        user_uuid = _uuid.UUID(current_user.get("id_usuario")) if isinstance(current_user, dict) and current_user.get("id_usuario") else None
        audit_log = LogAuditoria(
            tipo_evento="UPDATE",
            entidad_afectada="reconciliacion_pendientes",
            pk_entidad=str(id_pendiente),
            valor_nuevo={
                "accion": payload.action,
                "nuevo_estado": item.estado,
                "motivo_rechazo": payload.motivo_rechazo,
                "dni_corregido": payload.dni_corregido,
            },
            id_usuario=user_uuid,
            resultado="Exito",
            detalle_error=f"Cuarentena resuelta manualmente por administrador. Acción: {payload.action}"
        )
        db.add(audit_log)
        await db.commit()

    except Exception as e:
        await db.rollback()
        logger.error(f"[Quarantine] Error resolviendo id={id_pendiente}: {e}")
        raise HTTPException(status_code=500, detail=f"Error al procesar la acción: {str(e)}")

    return {
        "success": True,
        "data": {
            "id_pendiente": id_pendiente,
            "estado": item.estado,
            "message": (
                f"Registro aprobado e integrado a la base de datos. (Se resolvieron {registros_resueltos} tesis automáticamente)"
                if payload.action == "aprobar"
                else "Registro rechazado correctamente."
            ),
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.post(
    "/quarantine/retry-advisors",
    summary="Re-procesar asesores de tesis en cuarentena en segundo plano",
    status_code=status.HTTP_202_ACCEPTED
)
async def retry_quarantine_advisors(
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_staff)
):
    from app.db.session import AsyncSessionLocal
    from sgpi_cmr.api.reconciliation import run_retry_advisors_background
    user_id = current_user.get("id_usuario") if isinstance(current_user, dict) else None
    
    background_tasks.add_task(run_retry_advisors_background, AsyncSessionLocal, str(user_id) if user_id else None)
    
    return {
        "message": "Re-intento masivo de matching de asesores iniciado en segundo plano.",
        "status": "Running"
    }
