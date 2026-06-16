import re
import unicodedata
from typing import Optional


def clean_text(text: Optional[str]) -> str:
    """Limpia espacios en blanco múltiples y normaliza el espaciado del texto."""
    if not text:
        return ""
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def strip_accents(text: str) -> str:
    """Remueve tildes y diéresis de una cadena de texto (ej. Félix -> Felix)."""
    return "".join(c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn")


def normalize_name(name_str: str, strip_tildes: bool = False) -> str:
    """
    Normaliza el nombre de un autor o asesor.
    - Transforma 'Apellido, Nombre' a 'Nombre Apellido'.
    - Quita espacios redundantes.
    - Aplica Title Case (ej. 'MARCO ANTONIO' a 'Marco Antonio').
    - Opcionalmente remueve acentos.
    """
    if not name_str:
        return ""

    # Limpiar espaciados
    name = clean_text(name_str)

    # Manejar formatos separados por coma 'Apellidos, Nombres'
    if "," in name:
        parts = name.split(",", 1)
        # Invertir el orden: Nombres Apellidos
        name = f"{parts[1].strip()} {parts[0].strip()}"

    # Convertir a mayúsculas capitales en cada palabra (respetando conectores como 'de', 'la' si se desea)
    # Por simplicidad y robustez, usaremos .title() o capitalización de palabras
    words = name.split()
    capitalized_words = []
    for w in words:
        # Si w es un conector de apellido en minúscula, mantenerlo o capitalizar
        w_lower = w.lower()
        if w_lower in ["de", "la", "las", "y", "del", "e"]:
            capitalized_words.append(w_lower)
        else:
            # Capitalizar w
            capitalized_words.append(w.capitalize())

    name = " ".join(capitalized_words)

    if strip_tildes:
        name = strip_accents(name)

    return clean_text(name)


def clean_author_list(authors_str: str) -> list[str]:
    """
    Toma una cadena de autores separados por comas o punto y coma,
    los separa y normaliza cada uno individualmente.
    """
    if not authors_str or authors_str.lower() in ["desconocido", "n/a", "none"]:
        return []

    # Separar por punto y coma (común en DSpace y metadatos múltiples) o coma (si no separa apellidos)
    # En DSpace 7 usualmente ya viene como una lista, pero si se recibe un string plano:
    separators = [";", "|"]
    pattern = "|".join(map(re.escape, separators))

    if re.search(pattern, authors_str):
        parts = re.split(pattern, authors_str)
    else:
        # Si tiene comas pero no tiene punto y coma, hay que tener cuidado de no separar 'Apellido, Nombre'
        # Si hay más de una coma, podría ser una lista de nombres simples o múltiples 'Apellido, Nombre'
        # Por seguridad, si hay una sola coma en todo el string, probablemente es un solo autor 'Apellido, Nombre'.
        if authors_str.count(",") > 1:
            # Intentar separar heurísticamente
            parts = authors_str.split(",")
        else:
            parts = [authors_str]

    results = []
    for p in parts:
        cleaned = normalize_name(p)
        if cleaned:
            results.append(cleaned)

    return results
