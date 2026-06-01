import os
from typing import Optional, List
from cybertesis_connector.core.normalizer import strip_accents
from cybertesis_connector.core.models import QueryResultsModel


def format_clean_filename(query: str) -> str:
    """Transforma una cadena de consulta en un nombre de archivo seguro y limpio (slug)."""
    if not query:
        return "reporte"
    # Convertir a minúsculas y reemplazar espacios/no-alfanuméricos
    slug = query.lower().strip()
    slug = slug.replace(" ", "_")
    slug = "".join(c for c in slug if c.isalnum() or c == "_")
    return slug


def ensure_dir(path: str):
    """Asegura la existencia de un directorio de destino."""
    directory = os.path.dirname(os.path.abspath(path))
    if directory:
        os.makedirs(directory, exist_ok=True)


def filter_and_sort_results(
    results: "QueryResultsModel",
    degree: Optional[str] = None,
    year: Optional[int] = None,
    year_start: Optional[int] = None,
    year_end: Optional[int] = None,
    role: Optional[str] = None,
    keyword: Optional[str] = None,
    sort_by: Optional[str] = "anio",
    sort_order: str = "desc",
    query_term: Optional[str] = None,
) -> "QueryResultsModel":
    """
    Filtra y ordena dinámicamente un objeto QueryResultsModel según criterios avanzados.
    - degree: Filtra por grado académico ('pregrado', 'maestria', 'doctorado').
    - year: Filtra por año exacto de publicación.
    - year_start: Filtra por año mínimo (inclusive).
    - year_end: Filtra por año máximo (inclusive).
    - role: Filtra el término de búsqueda ('query_term') según sea 'autor' o 'asesor'.
    - keyword: Filtra tesis que tengan la palabra clave especificada en 'palabras_clave'.
    - sort_by: Atributo de ordenamiento ('anio', 'titulo', 'autor').
    - sort_order: Dirección del orden ('asc' o 'desc').
    """
    filtered_list = list(results.resultados)

    # 1. Filtro por Grado Académico (Caso insensitivo, substring)
    if degree:
        deg_lower = strip_accents(degree.lower())
        filtered_list = [t for t in filtered_list if deg_lower in strip_accents(t.grado_academico.lower())]

    # 2. Filtro por Año Exacto
    if year is not None:
        filtered_list = [t for t in filtered_list if t.anio_publicacion == year]

    # 3. Filtro por Rango de Años
    if year_start is not None:
        filtered_list = [t for t in filtered_list if t.anio_publicacion >= year_start]
    if year_end is not None:
        filtered_list = [t for t in filtered_list if t.anio_publicacion <= year_end]

    # 4. Filtro por Rol (Autor o Asesor)
    if role and query_term:
        role_norm = role.lower().strip()
        term_norm = strip_accents(query_term.lower().strip())

        def name_matches(names: List[str]) -> bool:
            for n in names:
                if term_norm in strip_accents(n.lower()):
                    return True
            return False

        if role_norm in ["autor", "author"]:
            filtered_list = [t for t in filtered_list if name_matches(t.autores)]
        elif role_norm in ["asesor", "advisor"]:
            filtered_list = [t for t in filtered_list if name_matches(t.asesores)]

    # 5. Filtro por Palabra Clave
    if keyword:
        kw_norm = strip_accents(keyword.lower().strip())
        filtered_list = [
            t for t in filtered_list if any(kw_norm in strip_accents(kw.lower()) for kw in t.palabras_clave)
        ]

    # 6. Ordenamiento de Resultados
    reverse_sort = sort_order.lower() == "desc"

    if sort_by == "anio":
        filtered_list.sort(key=lambda t: t.anio_publicacion, reverse=reverse_sort)
    elif sort_by == "titulo":
        filtered_list.sort(key=lambda t: t.titulo.lower(), reverse=reverse_sort)
    elif sort_by == "autor":
        filtered_list.sort(key=lambda t: t.autores[0].lower() if t.autores else "", reverse=reverse_sort)

    # Crear una nueva instancia de QueryResultsModel con los datos filtrados
    # Para evitar importación circular en tiempo de carga, importamos aquí
    from cybertesis_connector.core.models import QueryResultsModel

    return QueryResultsModel(
        tipo_documento=results.tipo_documento,
        query=results.query,
        total_encontrados=len(filtered_list),
        paginas_procesadas=results.paginas_procesadas,
        resultados=filtered_list,
    )
