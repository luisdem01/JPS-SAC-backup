import re
import unicodedata
from decimal import Decimal, InvalidOperation
from typing import Optional, Tuple

import pandas as pd

from sgpi_ci.config import FISI_KEYWORDS


# ---------------------------------------------------------------------------
# Filtrado por facultad (FISI)
# ---------------------------------------------------------------------------


def filter_fisi(df: pd.DataFrame, col: str) -> Tuple[pd.DataFrame, int]:
    """
    Filtra el DataFrame conservando solo las filas cuya columna `col`
    contenga al menos una de las palabras clave FISI.

    Returns:
        (df_fisi, n_purged) — DataFrame filtrado y cantidad de registros descartados.
    """
    if col not in df.columns:
        return df, 0

    pattern = "|".join(re.escape(kw) for kw in FISI_KEYWORDS)
    mask = df[col].fillna("").str.contains(pattern, case=False, na=False)

    n_purged = int((~mask).sum())
    return df[mask].copy().reset_index(drop=True), n_purged


# ---------------------------------------------------------------------------
# Normalización de texto
# ---------------------------------------------------------------------------


def normalize_text(series: pd.Series) -> pd.Series:
    """Normaliza Unicode (NFC) y elimina caracteres de control."""

    def _normalize(s) -> str:
        if not isinstance(s, str):
            return s
        s = unicodedata.normalize("NFC", s)
        s = re.sub(r"[\x00-\x1f\x7f]", "", s)  # control chars
        return s.strip()

    return series.apply(_normalize)


def to_title_case(series: pd.Series) -> pd.Series:
    """
    Convierte cadenas de MAYÚSCULAS SOSTENIDAS a Title Case,
    preservando preposiciones comunes en minúsculas.
    """
    # Preposiciones que van en minúsculas salvo al inicio de la cadena
    LOWERCASE_WORDS = {"de", "del", "la", "las", "los", "el", "y", "e", "o", "a"}

    def _title(s) -> str:
        if not isinstance(s, str) or not s.strip():
            return s
        words = s.strip().split()
        result = []
        for i, word in enumerate(words):
            lower = word.lower()
            if i == 0 or lower not in LOWERCASE_WORDS:
                result.append(lower.capitalize())
            else:
                result.append(lower)
        return " ".join(result)

    return series.apply(_title)


# ---------------------------------------------------------------------------
# Separación heurística de nombres
# ---------------------------------------------------------------------------


def split_apellidos_nombres(series: pd.Series) -> Tuple[pd.Series, pd.Series]:
    """
    Separa 'Apellidos y Nombres' en dos columnas.

    Detecta primero el formato institucional peruano con coma:
        "GARCIA LOPEZ, Juan Carlos"  → apellidos="Garcia Lopez", nombres="Juan Carlos"
        "DE LA CRUZ MEZA, Angel"     → apellidos="De La Cruz Meza", nombres="Angel"

    Fallback por espacios (sin coma):
        - 1 bloque  → todo va a apellidos, nombres queda vacío
        - 2 bloques → primer bloque = apellidos, segundo = nombres
        - 3 bloques → primeros dos = apellidos, tercero = nombres
        - 4+ bloques → primeros dos = apellidos, resto = nombres

    Returns:
        (apellidos_series, nombres_series)
    """

    def _split(s) -> Tuple[str, str]:
        if not isinstance(s, str) or not s.strip():
            return ("", "")

        # Formato institucional más común: "APELLIDOS, Nombres"
        if "," in s:
            partes = s.split(",", 1)
            return (partes[0].strip(), partes[1].strip())

        # Fallback: heurística por bloques de espacios
        partes = s.strip().split()
        if len(partes) == 1:
            return (partes[0], "")
        elif len(partes) == 2:
            return (partes[0], partes[1])
        elif len(partes) == 3:
            return (" ".join(partes[:2]), partes[2])
        else:
            return (" ".join(partes[:2]), " ".join(partes[2:]))

    result = series.apply(_split)
    apellidos = result.apply(lambda x: x[0])
    nombres = result.apply(lambda x: x[1])
    return apellidos, nombres


# ---------------------------------------------------------------------------
# Parseo de booleanos (columnas de deuda, investigador SM, etc.)
# ---------------------------------------------------------------------------


def parse_boolean_deuda(series: pd.Series) -> pd.Series:
    """
    Convierte valores de columnas Sí/No a booleanos de Python.
    Acepta: Sí/Si/S/1/True/X/Yes (→ True) y el resto (→ False).
    """
    TRUE_VALUES = {"sí", "si", "s", "1", "true", "verdadero", "x", "yes", "y"}

    def _parse(v) -> bool:
        if pd.isna(v):
            return False
        return str(v).strip().lower() in TRUE_VALUES

    return series.apply(_parse)


# ---------------------------------------------------------------------------
# Parseo de valores numéricos de puntaje
# ---------------------------------------------------------------------------


def parse_decimal_puntaje(series: pd.Series) -> pd.Series:
    """
    Convierte valores de puntaje a Decimal.
    - Celdas vacías / NaN / guiones → Decimal("0.00")
    - Comas como separador decimal → reemplazadas por punto
    - Texto no parseable → None (desencadena EX3 en validación Pydantic)
    """
    EMPTY_VALUES = {"", "-", "n/a", "na", "nd", "n/d", "s/d", "—", "–"}

    def _parse(v) -> Optional[Decimal]:
        if pd.isna(v):
            return Decimal("0.00")

        cleaned = str(v).strip()

        if cleaned.lower() in EMPTY_VALUES:
            return Decimal("0.00")

        # Reemplazar coma decimal y eliminar caracteres no numéricos (excepto punto y signo)
        cleaned = cleaned.replace(",", ".").replace(" ", "")
        cleaned = re.sub(r"[^\d.\-]", "", cleaned)

        if not cleaned:
            return None  # Texto corrupto → EX3

        try:
            return Decimal(cleaned)
        except InvalidOperation:
            return None  # No parseable → EX3

    return series.apply(_parse)


# ---------------------------------------------------------------------------
# Nuevos Cleaners para SGPI-CI (Excels no estructurados)
# ---------------------------------------------------------------------------


def clean_prefix_and_title(series: pd.Series) -> pd.Series:
    """
    Limpia prefijos, títulos académicos, palabras basura y signos de puntuación extra.
    """
    # Palabras genéricas que no son nombres reales
    GARBAGE_WORDS = {
        "DOCENTE",
        "MIEMBRO",
        "RESPONSABLE",
        "CO RESPONSABLE",
        "CORRESPONSABLE",
        "AUTOR",
        "ASESOR",
        "CO-RESPONSABLE",
        "CO-AUTOR",
        "COORDINADOR",
    }

    # Expresión regular para títulos académicos (al inicio o en cualquier parte, seguido de punto o espacio)
    TITLES_REGEX = r"(?i)\b(Dr|Dra|Mg|Mag|Ing|Lic|MSc|Ph\.?D|Prof)\b\.?"

    def _clean(s) -> str:
        if not isinstance(s, str) or not s.strip():
            return s
        s = str(s).strip()

        # Elimina R_, C_, M_, A_ al inicio
        s = re.sub(r"^[A-Z]_", "", s).strip()

        # Elimina títulos académicos
        s = re.sub(TITLES_REGEX, "", s).strip()

        # Elimina caracteres extraños al final como el '/'
        s = re.sub(r"[/\\-]+$", "", s).strip()

        # Verifica si quedó solo una palabra basura
        if s.upper() in GARBAGE_WORDS:
            return ""

        return s

    cleaned_series = series.apply(_clean)
    # Reutiliza el to_title_case existente
    return to_title_case(cleaned_series)


def split_docentes_cell(series: pd.Series) -> pd.Series:
    """
    Convierte una celda con múltiples docentes separados por salto de línea (\n)
    en una lista de docentes. Ideal para ser usado con df.explode().
    """

    def _split(s):
        if not isinstance(s, str) or not s.strip():
            return []
        return [doc.strip() for doc in s.split("\n") if doc.strip()]

    return series.apply(_split)
