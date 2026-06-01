from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import date, datetime
from uuid import UUID


class ReportParams(BaseModel):
    fecha_inicio_desde: Optional[date] = None
    fecha_fin_hasta: Optional[date] = None
    departamento_academico: Optional[str] = None
    grupo_investigacion: Optional[str] = None
    periodo_corte: Optional[str] = None
    anio_corte: Optional[int] = None
    tipo_reporte: str  # ej: 'Carga No Lectiva', 'Proyectos Activos', 'Produccion Cientifica', 'Resumen General'


class SnapshotPOICreate(BaseModel):
    periodo_corte: str
    tipo_reporte: str
    id_usuario_emisor: Optional[UUID] = None
    parametros_aplicados: Optional[Dict[str, Any]] = None
    datos_serializados: Dict[str, Any]


class SnapshotPOISummary(BaseModel):
    id_snapshot: int
    periodo_corte: str
    tipo_reporte: str
    id_usuario_emisor: Optional[UUID] = None
    parametros_aplicados: Optional[Dict[str, Any]] = None
    timestamp_generacion: datetime

    class Config:
        from_attributes = True


class SnapshotPOIResponse(SnapshotPOISummary):
    datos_serializados: Dict[str, Any]


# --- 1. Carga No Lectiva ---
class WorkloadDetail(BaseModel):
    dni: str
    nombres: str
    apellidos: str
    departamento: str
    horas_proyectos: float
    horas_tesis: float
    carga_total: float
    excede_maximo: bool
    detalle_proyectos: List[Dict[str, Any]]
    detalle_tesis: List[Dict[str, Any]]


class WorkloadReportResponse(BaseModel):
    parametros: ReportParams
    total_investigadores: int
    investigadores: List[WorkloadDetail]


# --- 2. Proyectos Activos ---
class ActiveProjectMember(BaseModel):
    dni: str
    nombres: str
    apellidos: str
    rol: str


class ActiveProjectDetail(BaseModel):
    codigo_proyecto: str
    titulo: str
    tipo_proyecto: Optional[str]
    presupuesto: float
    grupo_investigacion: Optional[str]
    fecha_inicio: Optional[date]
    estado: str
    integrantes: List[ActiveProjectMember]


class ActiveProjectsResponse(BaseModel):
    parametros: ReportParams
    total_proyectos: int
    presupuesto_total: float
    proyectos: List[ActiveProjectDetail]


# --- 3. Producción Científica ---
class ScientificAuthor(BaseModel):
    dni: str
    nombres: str
    apellidos: str
    filiacion_unmsm: bool


class ScientificProductionDetail(BaseModel):
    id_publicacion: int
    doi: Optional[str]
    titulo: str
    revista: Optional[str]
    tipo: str
    cuartil_impacto: Optional[str]
    indexacion: Optional[str]
    fecha_publicacion: Optional[date]
    autores: List[ScientificAuthor]


class ScientificTesisDetail(BaseModel):
    url_cybertesis: str
    titulo: str
    autor_estudiante: str
    asesor: str
    nivel_grado: Optional[str]
    anio_publicacion: Optional[int]


class ScientificProductionResponse(BaseModel):
    parametros: ReportParams
    total_publicaciones: int
    total_tesis: int
    publicaciones: List[ScientificProductionDetail]
    tesis: List[ScientificTesisDetail]


# --- 4. Resumen General ---
class GeneralSummaryResponse(BaseModel):
    parametros: ReportParams
    total_investigadores_evaluados: int
    total_proyectos_activos: int
    presupuesto_total_proyectos_activos: float
    total_publicaciones_periodo: int
    total_tesis_periodo: int
    promedio_carga_no_lectiva: float
    investigadores_exceden_carga_maxima: int
    investigadores_por_categoria_renacyt: Dict[str, int]
    total_grupos_activos: int
    total_investigadores_sm: int
    convocatorias_abiertas: int
    convocatorias_vencimiento_critico: int
    investigadores_con_deuda_pi: int
    investigadores_con_deuda_gi: int

# --- 5. Ficha Grupo ---
class FichaGrupoMemberDetail(BaseModel):
    dni: str
    nombre: str
    rol: str
    fecha_incorporacion: str
    estado: str

class FichaGrupoProyectoDetail(BaseModel):
    codigo: str
    titulo: str
    convocatoria: str
    estado: str

class FichaGrupoReportResponse(BaseModel):
    parametros: ReportParams
    id_grupo: int
    codigo_grupo: str
    nombre_grupo: str
    siglas: Optional[str] = None
    estado_grupo: str
    fecha_reconocimiento: Optional[str] = None
    lineas_investigacion: List[str] = []
    coordinador_dni: Optional[str] = None
    coordinador_nombre: Optional[str] = None
    articulos_scopus: int
    tesis_en_curso: int
    miembros: List[FichaGrupoMemberDetail] = []
    proyectos: List[FichaGrupoProyectoDetail] = []
