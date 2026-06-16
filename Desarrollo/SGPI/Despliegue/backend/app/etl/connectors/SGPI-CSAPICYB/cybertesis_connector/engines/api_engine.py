import re
from typing import List, Dict, Any, Optional
from pydantic import HttpUrl
from cybertesis_connector.config import CYBERTESIS_API_URL, CYBERTESIS_WEB_URL, DEFAULT_PAGE_SIZE
from cybertesis_connector.core.base_client import BaseClient
from cybertesis_connector.core.models import TesisModel, QueryResultsModel
from cybertesis_connector.core.normalizer import normalize_name


class CybertesisAPIEngine:
    def __init__(self, base_client: Optional[BaseClient] = None):
        self.client = base_client or BaseClient()

    def clean_date_and_get_year(self, date_str: str) -> tuple[Optional[str], int]:
        """Extrae el año y normaliza la fecha al formato YYYY-MM-DD si es posible."""
        if not date_str:
            return None, 1900

        # Intentar extraer año (4 dígitos)
        year_match = re.search(r"\b(19|20)\d{2}\b", date_str)
        year = int(year_match.group(0)) if year_match else 1900

        # Intentar formatear YYYY-MM-DD
        # Caso 1: YYYY-MM-DD
        match_iso = re.match(r"^(\d{4})-(\d{2})-(\d{2})", date_str)
        if match_iso:
            return f"{match_iso.group(1)}-{match_iso.group(2)}-{match_iso.group(3)}", year

        # Caso 2: YYYY-MM
        match_month = re.match(r"^(\d{4})-(\d{2})$", date_str)
        if match_month:
            return f"{match_month.group(1)}-{match_month.group(2)}-01", year

        # Caso 3: Sólo año o texto
        return date_str, year

    def map_degree_type(self, metadata: Dict[str, List[Dict[str, Any]]]) -> str:
        """Determina el tipo de grado académico a partir de los metadatos de DSpace 7."""
        # Buscar en dc.type y dc.description.degree
        type_fields = metadata.get("dc.type", [])
        degree_fields = metadata.get("dc.description.degree", [])

        search_texts = [f.get("value", "").lower() for f in (type_fields + degree_fields)]

        for text in search_texts:
            if any(k in text for k in ["doctoral", "doctorado", "doctor", "phd"]):
                return "Doctorado"
            if any(k in text for k in ["master", "maestria", "maestría", "magister", "magíster"]):
                return "Maestría"
            if any(k in text for k in ["bachelor", "licenciatura", "pregrado", "ingeniero", "titulo", "título"]):
                return "Pregrado / Licenciatura"

        return "Pregrado / Licenciatura"  # Fallback por defecto en UNMSM

    def parse_metadata_list(self, metadata_entry: Optional[List[Dict[str, Any]]]) -> List[str]:
        """Toma un campo de metadatos de DSpace 7 y extrae la lista de valores normalizados."""
        if not metadata_entry:
            return []
        return [normalize_name(item.get("value", "")) for item in metadata_entry if item.get("value")]

    def search(self, query: str, limit: Optional[int] = None, quiet: bool = False) -> QueryResultsModel:
        """
        Busca tesis académicas asociadas a un término (ej. nombre del docente o alumno)
        en Cybertesis utilizando la API REST de DSpace 7 con paginación completa.
        """
        if not query:
            raise ValueError("El término de búsqueda (query) no puede estar vacío.")

        page = 0
        total_elements = 0
        total_pages = 1
        processed_pages = 0
        all_tesis = []

        if not quiet:
            print(f"[Cybertesis API] Iniciando búsqueda para '{query}' en modo live...")

        # Loop de paginación completa
        while page < total_pages:
            params = {"query": query, "size": DEFAULT_PAGE_SIZE, "page": page}

            response = self.client.request(CYBERTESIS_API_URL, params=params, quiet=quiet)
            if not response or response.status_code != 200:
                if not quiet:
                    print(f"[Cybertesis API] Error de conexión o respuesta fallida en página {page}. Abortando ciclo.")
                break

            try:
                data = response.json()
            except Exception as e:
                if not quiet:
                    print(f"[Cybertesis API] Error al parsear JSON en página {page}: {e}")
                break

            # Cargar información de paginación de DSpace 7
            page_info = data.get("page", {})
            total_elements = page_info.get("totalElements", total_elements)
            total_pages = page_info.get("totalPages", total_pages)

            # Obtener objetos embebidos
            search_result = data.get("_embedded", {}).get("searchResult", {})
            objects = search_result.get("_embedded", {}).get("objects", [])

            if not quiet:
                print(
                    f"[Cybertesis API] Procesando página {page + 1}/{total_pages} "
                    f"(Encontrados {len(objects)} registros)..."
                )

            for obj in objects:
                try:
                    indexable_object = obj.get("_embedded", {}).get("indexableObject", {})
                    if not indexable_object:
                        continue

                    title = indexable_object.get("name")
                    handle = indexable_object.get("handle")

                    if not title or not handle:
                        continue

                    link = f"{CYBERTESIS_WEB_URL}/handle/{handle}"
                    metadata = indexable_object.get("metadata", {})

                    # 1. Autores (dc.contributor.author)
                    autores = self.parse_metadata_list(metadata.get("dc.contributor.author"))
                    if not autores:
                        autores = ["Desconocido"]

                    # 2. Asesores (dc.contributor.advisor)
                    asesores = self.parse_metadata_list(metadata.get("dc.contributor.advisor"))

                    # 3. Fecha y Año (dc.date.issued)
                    date_list = metadata.get("dc.date.issued", [])
                    raw_date = date_list[0].get("value", "") if date_list else ""
                    fecha_norm, anio = self.clean_date_and_get_year(raw_date)

                    # 4. Grado Académico
                    grado = self.map_degree_type(metadata)

                    # 5. Resumen (dc.description.abstract)
                    resumen_list = metadata.get("dc.description.abstract", [])
                    resumen = resumen_list[0].get("value", "").strip() if resumen_list else None

                    # 6. Palabras clave / Temas (dc.subject)
                    palabras_clave = [
                        item.get("value", "").strip() for item in metadata.get("dc.subject", []) if item.get("value")
                    ]

                    # Instanciar modelo Pydantic para validación estricta
                    tesis = TesisModel(
                        id_handle=handle,
                        titulo=title.strip(),
                        autores=autores,
                        asesores=asesores,
                        anio_publicacion=anio,
                        fecha_sustentacion=fecha_norm,
                        grado_academico=grado,
                        resumen=resumen,
                        palabras_clave=palabras_clave,
                        url_repositorio=HttpUrl(link),
                    )
                    all_tesis.append(tesis)

                    # Si el usuario especificó un límite de extracción estricto y lo superamos, parar
                    if limit and len(all_tesis) >= limit:
                        break

                except Exception:
                    # Si falla un registro individual, continuar para no abortar toda la página
                    continue

            processed_pages += 1
            page += 1

            # Detener si superamos el límite total
            if limit and len(all_tesis) >= limit:
                if not quiet:
                    print(f"[Cybertesis API] Límite de {limit} registros alcanzado.")
                break

        # Si el límite cortó la lista, recortar para cumplir exactamente
        if limit and len(all_tesis) > limit:
            all_tesis = all_tesis[:limit]

        return QueryResultsModel(
            tipo_documento="tesis_academica",
            query=query,
            total_encontrados=total_elements if limit is None or total_elements < limit else len(all_tesis),
            paginas_procesadas=processed_pages,
            resultados=all_tesis,
        )
