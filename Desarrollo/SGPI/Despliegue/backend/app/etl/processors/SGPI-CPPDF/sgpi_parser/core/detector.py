import re
from typing import Tuple, Optional
from sgpi_parser.utils.pdf_utils import extract_raw_text_fitz
from sgpi_parser.utils.string_utils import clean_for_matching


def detect_pdf_type_and_year(pdf_path: str) -> Tuple[Optional[str], Optional[int]]:
    """
    Analiza el texto de un PDF para determinar de forma heurística y offline
    su categoría ('resolucion', 'cronograma' o 'resultados') y su año académico.

    Returns:
        Tuple[str, int]: (categoria_detectada, anio_detectado)
    """
    raw_text = extract_raw_text_fitz(pdf_path)
    text = clean_for_matching(raw_text)

    if not text:
        return None, None

    # --- 1. Detección de Categoría ---

    # Marcadores de Cronograma
    cronograma_keywords = [
        "cronograma de actividades",
        "cronograma de la convocatoria",
        "cronograma del concurso",
        "cronograma del programa",
        "detalle de actividades",
        "calendario de actividades",
        "etapa de seleccion",
        "cronograma para",
        "fecha de inicio",
        "fecha de fin",
    ]

    # Marcadores de Resultados
    resultados_keywords = [
        "orden de merito",
        "orden de meritob",  # por posibles errores de OCR/parsing
        "orden merito",
        "proyectos aprobados",
        "proyectos seleccionados",
        "puntaje final",
        "puntaje total",
        "lista de ganadores",
        "resultados finales",
        "proyectos aptos",
        "puntaje obtenido",
    ]

    # Marcadores de Resolución Rectoral
    resolucion_keywords = [
        "resolucion rectoral",
        "se resuelve",
        "resuelve",
        "considerando",
        "r.r.",
        "rectoral",
        "el rector",
        "visto el expediente",
        "visto el oficio",
    ]

    # Calcular "puntuación" para cada categoría
    score_crono = sum(2 if kw in text else 0 for kw in cronograma_keywords)
    score_res = sum(2 if kw in text else 0 for kw in resultados_keywords)
    score_rr = sum(2 if kw in text else 0 for kw in resolucion_keywords)

    # Desempates o ponderaciones adicionales basadas en palabras de alta frecuencia
    if "cronograma" in text:
        score_crono += 5
    if "resultados" in text or "resultados de" in text:
        score_res += 5
    if "resolucion" in text or "se resuelve" in text:
        score_rr += 5

    category = None
    max_score = max(score_crono, score_res, score_rr)

    if max_score > 0:
        if max_score == score_crono:
            category = "cronograma"
        elif max_score == score_res:
            category = "resultados"
        else:
            category = "resolucion"

    # --- 2. Detección de Año Académico ---

    # Intentar extraer el año buscando patrones de 4 dígitos entre 2015 y 2030
    years_found = re.findall(r"\b(20[12]\d)\b", text)
    year = None

    if years_found:
        # Contar frecuencias de años encontrados
        year_freq = {}
        for y_str in years_found:
            y = int(y_str)
            if 2017 <= y <= 2030:
                year_freq[y] = year_freq.get(y, 0) + 1

        if year_freq:
            # Ordenar por frecuencia
            sorted_years = sorted(year_freq.items(), key=lambda x: x[1], reverse=True)
            # Primero intentar sacar el año que aparece más veces
            year = sorted_years[0][0]

    # Si es una resolución, el número de resolución suele contener el año, ej: RR_008249-2025-R
    rr_year_match = re.search(r"(?:rr[_-]\d{6}[_-])(20\d{2})", text)
    if rr_year_match:
        year = int(rr_year_match.group(1))

    return category, year
