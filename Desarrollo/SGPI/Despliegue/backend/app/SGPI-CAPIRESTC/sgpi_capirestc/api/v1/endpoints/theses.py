from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
import os
import sys

from app.db.session import get_db
from sgpi_capirestc.crud.crud_tesis import tesis
from sgpi_capirestc.schemas.domain_schemas import TesisBase, TesisResponse
from app.core.security import get_current_user
from app.core.audit import log_audit_event

# Inyección dinámica para importar el conector Cybertesis
current_dir = os.path.dirname(os.path.abspath(__file__))
app_dir = os.path.abspath(os.path.join(current_dir, "..", "..", "..", "..", ".."))
csapicyb_path = os.path.join(app_dir, "etl", "connectors", "SGPI-CSAPICYB")

if csapicyb_path not in sys.path:
    sys.path.insert(0, csapicyb_path)

try:
    from cybertesis_connector.engines.api_engine import CybertesisAPIEngine
except ImportError:
    CybertesisAPIEngine = None

router = APIRouter()


@router.get("/external", response_model=List[dict])
async def search_external_theses(
    q: str = Query(..., description="Término de búsqueda (autor, asesor, etc.)"),
    limit: Optional[int] = Query(10, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    """
    Busca tesis en el repositorio externo de Cybertesis (DSpace 7) usando el conector.
    """
    if not CybertesisAPIEngine:
        raise HTTPException(status_code=500, detail="El conector Cybertesis no está disponible en el sistema.")

    try:
        engine = CybertesisAPIEngine()
        results = engine.search(query=q, limit=limit, quiet=True)

        serialized = []
        for t in results.resultados:
            serialized.append(
                {
                    "url_cybertesis": str(t.url_repositorio),
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
                    "institucion_concedente": t.publisher,
                    "editorial": t.publisher,
                    "pais_publicacion": "PE",
                    "palabras_clave": t.palabras_clave,
                    "jurados_evaluadores": [],
                }
            )
        return serialized
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error consultando Cybertesis: {str(e)}")


@router.get("/", response_model=List[TesisResponse])
async def list_tesis(
    skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)
):
    return await tesis.get_multi(db, skip=skip, limit=limit)


@router.get("/{url:path}", response_model=TesisResponse)
async def get_tesis(url: str, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    t = await tesis.get_by_url(db, url=url)
    if not t:
        raise HTTPException(status_code=404, detail="Tesis no encontrado")
    return t


@router.post("/", response_model=TesisResponse)
async def create_tesis(
    obj_in: TesisBase, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)
):
    new_tesis = await tesis.create(db, obj_in=obj_in)

    await log_audit_event(
        db=db,
        tipo_evento="INSERT",
        entidad_afectada="tesis",
        pk_entidad=new_tesis.url_cybertesis,
        valor_nuevo=obj_in.model_dump(mode="json"),
        id_usuario=current_user.get("sub"),
    )
    return new_tesis
