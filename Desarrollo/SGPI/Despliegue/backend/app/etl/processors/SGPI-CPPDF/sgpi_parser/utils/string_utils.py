import re
import unicodedata
from typing import Tuple, Optional, Dict
from datetime import datetime
import difflib

# Diccionario de meses en español
MESES: Dict[str, int] = {
    "enero": 1,
    "febrero": 2,
    "marzo": 3,
    "abril": 4,
    "mayo": 5,
    "junio": 6,
    "julio": 7,
    "agosto": 8,
    "septiembre": 9,
    "setiembre": 9,
    "octubre": 10,
    "noviembre": 11,
    "diciembre": 12,
}


def remove_accents(text: str) -> str:
    """Elimina acentos y diacríticos de un texto de forma segura."""
    text = unicodedata.normalize("NFD", text)
    return "".join(c for c in text if unicodedata.category(c) != "Mn")


def clean_text(text: str) -> str:
    """Limpia excesos de espacios y normaliza texto para comparaciones."""
    if not text:
        return ""
    text = text.replace("\n", " ").replace("\r", " ")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


GREEK_TO_LATIN = {
    "\u0391": "A",  # Alpha
    "\u0392": "B",  # Beta
    "\u0395": "E",  # Epsilon
    "\u0396": "Z",  # Zeta
    "\u0397": "H",  # Eta
    "\u0399": "I",  # Iota
    "\u039a": "K",  # Kappa
    "\u039c": "M",  # Mu
    "\u039d": "N",  # Nu
    "\u039f": "O",  # Omicron
    "\u03a1": "P",  # Rho
    "\u03a4": "T",  # Tau
    "\u03a7": "X",  # Chi
    "\u03a5": "Y",  # Upsilon
    # Lowercase Greek homoglyphs
    "\u03b1": "a",
    "\u03b2": "b",
    "\u03b5": "e",
    "\u03ba": "k",
    "\u03bf": "o",
    "\u03c5": "y",
    "\u03c7": "x",
}


def clean_for_matching(text: str) -> str:
    """Normaliza un texto para búsqueda difusa (minúsculas, sin acentos)."""
    if not text:
        return ""
    # Traducir homóglifos griegos a latín
    for gk, lt in GREEK_TO_LATIN.items():
        text = text.replace(gk, lt)
    return remove_accents(clean_text(text)).lower()


def fuzzy_match(a: str, b: str) -> float:
    """Retorna un ratio de similitud entre dos textos entre 0.0 y 1.0."""
    return difflib.SequenceMatcher(None, clean_for_matching(a), clean_for_matching(b)).ratio()


def extract_number(text: str) -> Optional[float]:
    """
    Extrae un número float de un texto (presupuestos, montos, puntajes).
    Soporta formatos como: 'S/. 500,000.00', '150 000', '94.50'.
    """
    if not text:
        return None
    # Eliminar símbolos de moneda y espacios
    clean = text.replace("S/.", "").replace("S/", "").replace("$", "")
    # Si contiene comas y puntos, ej 500,000.00 -> quitar comas
    # Si contiene espacios como separador de miles, ej 500 000.00 -> quitar espacios
    clean = re.sub(r"\s+", "", clean)

    # Comprobar si usa coma decimal o punto decimal
    # En el contexto peruano, se usa punto decimal (.) o a veces coma (,)
    # Si hay comas que sirven como separador de miles, las eliminamos
    if "," in clean and "." in clean:
        clean = clean.replace(",", "")
    elif "," in clean and "." not in clean:
        # Si tiene una sola coma y está cerca del final (2 decimales), la volvemos punto
        parts = clean.split(",")
        if len(parts) == 2 and len(parts[1]) <= 2:
            clean = clean.replace(",", ".")
        else:
            # Si no, asumimos que era separador de miles
            clean = clean.replace(",", "")

    # Extraer el patrón numérico básico (dígitos y opcionalmente punto)
    match = re.search(r"-?\d+(?:\.\d+)?", clean)
    if match:
        try:
            return float(match.group(0))
        except ValueError:
            return None
    return None


def extract_integer(text: str) -> Optional[int]:
    """Extrae un entero de un texto (orden de mérito, año)."""
    num = extract_number(text)
    return int(num) if num is not None else None


def parse_spanish_date_range(text: str, default_year: Optional[int] = None) -> Tuple[Optional[str], Optional[str]]:
    """
    Parsea un texto en español que describe un rango de fechas o una fecha única
    y devuelve una tupla (fecha_inicio, fecha_fin) en formato YYYY-MM-DD.

    Ejemplos soportados:
    - "19 de noviembre de 2025" -> ("2025-11-19", "2025-11-19")
    - "del 20 al 27 de noviembre 2025" -> ("2025-11-20", "2025-11-27")
    - "del 28 de noviembre al 12 de diciembre de 2025" -> ("2025-11-28", "2025-12-12")
    - "Del 15 de diciembre de 2025 al 15 de enero de 2026" -> ("2025-12-15", "2026-01-15")
    - "A partir del 10 de marzo 2026" -> ("2026-03-10", "2026-03-10")
    - "Hasta el 31 de mayo 2026" -> ("2026-05-31", "2026-05-31")
    """
    start, end = _parse_spanish_date_range_raw(text, default_year)
    if start and end:
        text_clean = clean_for_matching(text)
        if "hasta" in text_clean:
            start = None
        elif "a partir" in text_clean:
            end = None
    return start, end


def _parse_spanish_date_range_raw(text: str, default_year: Optional[int] = None) -> Tuple[Optional[str], Optional[str]]:
    if not text:
        return None, None

    text_clean = clean_for_matching(text)

    # Intentar extraer el año del texto
    year_match = re.findall(r"\b(20\d{2})\b", text_clean)
    year = int(year_match[-1]) if year_match else default_year
    if not year:
        # Por defecto usar el año actual si no se provee
        year = datetime.now().year

    # Helper para formatear fecha a YYYY-MM-DD
    def format_date(d: int, m_str: str, y: int) -> str:
        m = MESES.get(m_str.strip())
        if not m:
            return ""
        return f"{y:04d}-{m:02d}-{d:02d}"

    # Patrón 1: "del {dia_1} al {dia_2} de {mes} [de] {anio}"
    # Ej: "del 20 al 27 de noviembre 2025" o "del 20 al 27 de noviembre del 2025"
    p1 = r"(?:del|desde el)\s+(\d+)\s+al\s+(\d+)\s+de\s+([a-z]+)(?:\s+(?:del?|de)\s+(\d{4}))?"
    m1 = re.search(p1, text_clean)
    if m1:
        d1 = int(m1.group(1))
        d2 = int(m1.group(2))
        mes_str = m1.group(3)
        y_val = int(m1.group(4)) if m1.group(4) else year
        start = format_date(d1, mes_str, y_val)
        end = format_date(d2, mes_str, y_val)
        if start and end:
            return start, end

    # Patrón 2: "del {dia_1} de {mes_1} al {dia_2} de {mes_2} [de] {anio}"
    # Ej: "del 28 de noviembre al 12 de diciembre de 2025"
    p2 = r"(?:del|desde el)\s+(\d+)\s+de\s+([a-z]+)\s+al\s+(\d+)\s+de\s+([a-z]+)(?:\s+(?:del?|de)\s+(\d{4}))?"
    m2 = re.search(p2, text_clean)
    if m2:
        d1 = int(m2.group(1))
        mes1_str = m2.group(2)
        d2 = int(m2.group(3))
        mes2_str = m2.group(4)
        y_val = int(m2.group(5)) if m2.group(5) else year

        # Si mes1 y mes2 son diferentes y el año es fin de año, se maneja el año
        # Ej: "Del 15 de diciembre de 2025 al 15 de enero de 2026"
        # Para este caso, el año del primer mes podría ser diferente si el texto especifica explícitamente dos años.
        # Vamos a comprobar si el texto tiene dos años
        years_in_text = [int(y) for y in year_match]
        y1 = years_in_text[0] if len(years_in_text) >= 2 else y_val
        y2 = years_in_text[-1] if len(years_in_text) >= 1 else y_val

        # Si se cruza el año pero solo se detectó un año al final,
        # y1 podría ser y2 - 1 si mes1 es posterior a mes2 (ej: diciembre al enero de 2026)
        if len(years_in_text) == 1 and MESES.get(mes1_str, 0) > MESES.get(mes2_str, 0):
            y1 = y2 - 1

        start = format_date(d1, mes1_str, y1)
        end = format_date(d2, mes2_str, y2)
        if start and end:
            return start, end

    # Patrón 3: Fecha única "{dia} de {mes} [de] {anio}"
    # Ej: "19 de noviembre de 2025"
    p3 = r"\b(\d+)\s+de\s+([a-z]+)(?:\s+(?:del?|de)\s+(\d{4}))?\b"
    m3 = re.search(p3, text_clean)
    if m3:
        d = int(m3.group(1))
        mes_str = m3.group(2)
        y_val = int(m3.group(3)) if m3.group(3) else year
        date_str = format_date(d, mes_str, y_val)
        if date_str:
            return date_str, date_str

    # Fallback: intentar encontrar al menos un día y un mes si la estructura es más libre
    # Ej: "A partir del 10 de marzo 2026"
    day_match = re.search(r"\b(\d{1,2})\b", text_clean)
    month_found = None
    for mes in MESES:
        if mes in text_clean:
            month_found = mes
            break

    if day_match and month_found:
        d = int(day_match.group(1))
        date_str = format_date(d, month_found, year)
        if date_str:
            return date_str, date_str

    return None, None
