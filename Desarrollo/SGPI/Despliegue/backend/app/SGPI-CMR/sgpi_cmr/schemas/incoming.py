from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict
from datetime import date

class BaseReconciliationPayload(BaseModel):
    fuente_origen: str = Field(..., description="La fuente desde donde provienen los datos: RAIS, RENACYT, Cybertesis, VRIP")

class InvestigadorInput(BaseModel):
    dni: str
    nombres: str
    apellidos: str
    codigo_interno_vrip: Optional[str] = None
    condicion_laboral: Optional[str] = None
    departamento_academico: Optional[str] = None
    facultad_dependencia: Optional[str] = None
    grado_academico_max: Optional[str] = None
    institucion_principal: Optional[str] = None
    codigo_renacyt: Optional[str] = None
    orcid: Optional[str] = None
    categoria_renacyt: Optional[str] = None
    estado_renacyt: Optional[str] = None
    url_cti_vitae: Optional[str] = None
    investigador_sm: Optional[bool] = None
    estado_vigencia: Optional[str] = None

class BulkInvestigadorPayload(BaseReconciliationPayload):
    registros: List[InvestigadorInput]

class ProyectoInput(BaseModel):
    codigo_proyecto: str
    resolucion_aprobacion: Optional[str] = None
    titulo_proyecto: str
    tipo_proyecto: Optional[str] = None
    tipo_programa: Optional[str] = None
    facultad_proyecto: Optional[str] = None
    presupuesto_asignado: Optional[float] = None
    codigo_grupo: Optional[str] = None
    area_academica: Optional[str] = None
    anio_convocatoria: Optional[int] = None
    fecha_inicio: Optional[date] = None # YYYY-MM-DD
    estado_proyecto: Optional[str] = None

class BulkProyectoPayload(BaseReconciliationPayload):
    registros: List[ProyectoInput]

class PublicacionInput(BaseModel):
    doi_codigo: Optional[str] = None
    titulo_articulo: str
    issn: Optional[str] = None
    volumen: Optional[str] = None
    tipo_publicacion: str
    nombre_revista: Optional[str] = None
    nombre_evento: Optional[str] = None
    cuartil_impacto: Optional[str] = None
    indexacion: Optional[str] = None
    fecha_publicacion: Optional[str] = None

class BulkPublicacionPayload(BaseReconciliationPayload):
    registros: List[PublicacionInput]

class AsesorTesisInput(BaseModel):
    asesor_texto: str
    url_cybertesis: str
    titulo_tesis: str
    dni_asesor: Optional[str] = None # Sometimes they extract it, sometimes they don't
    autor_estudiante_texto: Optional[str] = None

class BulkAsesorTesisPayload(BaseReconciliationPayload):
    registros: List[AsesorTesisInput]
