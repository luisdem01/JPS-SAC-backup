import os
from pathlib import Path


# ---------------------------------------------------------------------------
# Carga de variables de entorno
# Busca .env en este directorio, luego en la raíz del backend (SGPI_MAAPI)
# ---------------------------------------------------------------------------
def _load_dotenv(dotenv_path: Path) -> None:
    """Carga manual de .env sin dependencias extra (igual que SGPI-CPPDF)."""
    if not dotenv_path.exists():
        return
    with open(dotenv_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                key, val = line.split("=", 1)
                key = key.strip()
                val = val.strip().strip("\"'")
                # No sobreescribir variables ya definidas en el entorno
                if key not in os.environ:
                    os.environ[key] = val


_module_root = Path(__file__).resolve().parent.parent  # ...SGPI-RAIS/

# 1. .env local del módulo (prioridad máxima)
_load_dotenv(_module_root / ".env")
# 2. .env del backend (SGPI_MAAPI)
_load_dotenv(_module_root.parent.parent.parent / "SGPI_MAAPI" / ".env")
# 3. .env en el directorio de trabajo actual
_load_dotenv(Path.cwd() / ".env")


# ---------------------------------------------------------------------------
# Settings de conexión a Supabase
# ---------------------------------------------------------------------------
class Settings:
    SUPABASE_URL: str = os.environ.get("SUPABASE_URL", "")
    SUPABASE_SERVICE_KEY: str = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY", "")

    @classmethod
    def validate(cls) -> None:
        """Valida que las variables críticas estén configuradas."""
        missing = []
        if not cls.SUPABASE_URL:
            missing.append("SUPABASE_URL")
        if not cls.SUPABASE_SERVICE_KEY:
            missing.append("SUPABASE_SERVICE_KEY")
        if missing:
            raise EnvironmentError(
                f"Faltan variables de entorno requeridas: {', '.join(missing)}\n"
                "Configura un archivo .env o exporta las variables antes de ejecutar."
            )


settings = Settings()


# ---------------------------------------------------------------------------
# Palabras clave para el filtro FISI centralizadas
# Un registro se conserva si su columna de facultad contiene al menos una.
# ---------------------------------------------------------------------------
try:
    from app.core.faculty_config import FISI_KEYWORDS
except ImportError:
    FISI_KEYWORDS = [
        "Ingeniería de Sistemas e Informática",
        "Ingenieria de Sistemas",
        "FISI",
        "Sistemas e Informática",
        "Sistemas e Informatica",
        "ciencia de la computación", "ciencias de la computación",
        "inteligencia artificial"
    ]


# ---------------------------------------------------------------------------
# Mapeo de columnas del Excel RAIS → campos internos del sistema
#
# Cada campo lista sus aliases en orden de probabilidad.
# El sistema usa el primer alias que encuentre en el DataFrame.
#
# NOTA: Estos nombres son INFERIDOS del spec y del DDL.
#       Actualizar la sección "required" cuando se tenga el Excel real.
# ---------------------------------------------------------------------------
COLUMN_MAPS: dict = {
    # ── ENTIDAD: INVESTIGADOR / DOCENTE ───────────────────────────────────
    "investigador": {
        "required": {
            "dni": [
                "DNI",
                "Dni",
                "N° DNI",
                "N.° DNI",
                "Num. DNI",
                "N° de DNI",
                "Doc. Identidad",
                "Documento",
            ],
            "nombre_completo": [
                "Apellidos y Nombres",
                "Apellidos y nombres",
                "Nombres y Apellidos",
                "Nombre Completo",
                "Nombres",
                "APELLIDOS Y NOMBRES",
                "Apellido y Nombre",
            ],
            "facultad_dependencia": [
                "Facultad / Dependencia",
                "Facultad/Dependencia",
                "Facultad - Dependencia",
                "Dependencia",
                "Facultad",
                "FACULTAD / DEPENDENCIA",
                "Fac. / Dependencia",
            ],
        },
        "optional": {
            "condicion_laboral": [
                "Condición",
                "Condicion",
                "Situación",
                "Situacion",
                "Cond.",
                "Condición Laboral",
                "Condicion Laboral",
                "Situación Laboral",
            ],
            "tiene_deuda_gi": [
                "Deuda GI",
                "Deuda_GI",
                "Deuda Grupo Investigación",
                "Deuda Grupo de Investigación",
                "Deuda GI (Sí/No)",
                "En Deuda GI",
            ],
            "tiene_deuda_pi": [
                "Deuda PI",
                "Deuda_PI",
                "Deuda Proyecto Investigación",
                "Deuda Proyecto de Investigación",
                "Deuda PI (Sí/No)",
                "En Deuda PI",
            ],
            "departamento_academico": [
                "Departamento",
                "Depto.",
                "Departamento Académico",
                "Departamento Academico",
                "Dpto. Académico",
                "Depto",
            ],
            "grado_academico_max": [
                "Grado Académico",
                "Grado",
                "Máximo Grado",
                "Grado Máximo",
                "Nivel Académico",
                "Grado Academico",
                "Máx. Grado",
            ],
            "codigo_renacyt": [
                "Código RENACYT",
                "RENACYT",
                "Cod. RENACYT",
                "Código Renacyt",
                "N° RENACYT",
                "Cod Renacyt",
            ],
            "categoria_renacyt": [
                "Categoría RENACYT",
                "Categoria RENACYT",
                "Cat. RENACYT",
                "Nivel RENACYT",
                "Categoría Renacyt",
            ],
            "investigador_sm": [
                "Investigador SM",
                "Inv. SM",
                "SM",
                "Investigador San Marcos",
                "Categoría SM",
                "Inv SM",
            ],
            "codigo_interno_vrip": [
                "Código VRIP",
                "Cod. VRIP",
                "Código Interno VRIP",
                "VRIP",
                "N° VRIP",
                "Cod VRIP",
            ],
            "estado_vigencia": [
                "Estado",
                "Estado Vigencia",
                "Situación Actual",
                "Vigencia",
                "Estado Docente",
                "Activo/Inactivo",
            ],
        },
        "rpc": "importar_padron_rais_investigadores",
        "pk": "dni",
        "fisi_col": "facultad_dependencia",  # Columna usada para filtrar FISI
    },
    # ── ENTIDAD: HISTORIAL DE PUNTAJES ANUALES (CU04) ─────────────────────
    "historial": {
        "required": {
            "dni_investigador": [
                "DNI",
                "Dni",
                "N° DNI",
                "N.° DNI",
                "Num. DNI",
                "N° de DNI",
                "Doc. Identidad",
            ],
        },
        "optional": {
            "puntaje_total": [
                "Puntaje Total",
                "Ptje. Total",
                "Ptje Total",
                "Total Puntaje",
                "TOTAL",
                "Puntaje",
            ],
            "puntaje_revistas": [
                "Puntaje Revistas",
                "Ptje. Revistas",
                "Ptje Revistas",
                "Revistas",
                "Art. Revistas",
                "Artículos de Revistas",
            ],
            "puntaje_libros": [
                "Puntaje Libros",
                "Ptje. Libros",
                "Ptje Libros",
                "Libros",
                "Capítulos de Libro",
                "Libros y Capítulos",
            ],
            "puntaje_proyectos": [
                "Puntaje Proyectos",
                "Ptje. Proyectos",
                "Ptje Proyectos",
                "Proyectos",
                "Proyectos Investigación",
            ],
            "puntaje_patentes": [
                "Puntaje Patentes",
                "Ptje. Patentes",
                "Ptje Patentes",
                "Patentes",
                "Prop. Industrial",
                "Propiedad Industrial",
            ],
            "puntaje_tesis": [
                "Puntaje Tesis",
                "Ptje. Tesis",
                "Ptje Tesis",
                "Tesis",
                "Asesoría de Tesis",
                "Asesoría Tesis",
            ],
            "puntaje_otros": [
                "Puntaje Otros",
                "Ptje. Otros",
                "Ptje Otros",
                "Otros",
                "Otros Productos",
                "Otros Méritos",
            ],
        },
        "rpc": "importar_padron_rais_historial",
        "pk": "dni_investigador",
        "fisi_col": None,  # Historial no tiene columna FISI propia
    },
}

# Tamaño de chunk por defecto para envíos en lote a Supabase
DEFAULT_CHUNK_SIZE = 200
