import re
from datetime import date
from typing import List, Optional
from colorama import Fore, Style

from vrip_connector.engines.base import BaseExtractor
from vrip_connector.core.models import TesisModel


class CyberthesisExtractor(BaseExtractor):
    def __init__(self):
        super().__init__("cybertesis")

    def extract(self, query: str, year: Optional[int] = None, limit: int = 15, **kwargs) -> List[TesisModel]:
        """
        Queries the UNMSM Cybertesis DSpace 7 REST API to retrieve thesis records.
        Applies filtering for name/keyword queries and academic years.
        """
        if not query:
            print(f"{Fore.RED}[Cybertesis] Error: Se requiere un término de búsqueda (query).{Style.RESET_ALL}")
            return []

        api_url = self.source_config.get(
            "api_url", "https://cybertesis.unmsm.edu.pe/backend/api/discover/search/objects"
        )

        # Build search params
        params = {
            "query": query,
            "size": max(limit, 100),  # Request enough rows to filter in-memory if needed
        }

        custom_headers = {"Accept": "application/json", "Referer": "https://cybertesis.unmsm.edu.pe/"}

        print(f"{Fore.GREEN}[Cybertesis]{Style.RESET_ALL} Buscando '{query}' en la API REST de DSpace 7...")

        response = self.client.get(api_url, params=params, custom_headers=custom_headers)
        if not response or response.status_code != 200:
            print(
                f"{Fore.RED}[Cybertesis] Error: Fallo en conexión con la API REST "
                f"(HTTP {response.status_code if response else 'None'}).{Style.RESET_ALL}"
            )
            return []

        try:
            data = response.json()
            search_result = data.get("_embedded", {}).get("searchResult", {})
            objects = search_result.get("_embedded", {}).get("objects", [])

            print(f"[Cybertesis] Recuperados {len(objects)} registros brutos de la API REST.")

            items: List[TesisModel] = []
            for obj in objects:
                try:
                    indexable_object = obj.get("_embedded", {}).get("indexableObject", {})
                    if not indexable_object:
                        continue

                    title = indexable_object.get("name")
                    handle = indexable_object.get("handle")

                    if not title or not handle:
                        continue

                    link = f"https://cybertesis.unmsm.edu.pe/handle/{handle}"
                    metadata = indexable_object.get("metadata", {})

                    # Extract Authors
                    author_list = metadata.get("dc.contributor.author", [])
                    authors = ", ".join([a.get("value") for a in author_list]) if author_list else "Desconocido"

                    # Extract Year
                    date_list = metadata.get("dc.date.issued", [])
                    pub_year = None
                    if date_list:
                        date_str = date_list[0].get("value", "")
                        year_match = re.search(r"\b(19|20)\d{2}\b", date_str)
                        if year_match:
                            pub_year = int(year_match.group(0))

                    if not pub_year:
                        pub_year = date.today().year

                    # Filter by year if specified
                    if year and pub_year != year:
                        continue

                    items.append(
                        TesisModel(titulo=title, autores=authors, anio_publicacion=pub_year, enlace_handle=link)
                    )

                    # Apply local limit early
                    if len(items) >= limit:
                        break

                except Exception:
                    continue

            print(f"[Cybertesis] Búsqueda finalizada. {len(items)} tesis cargadas y validadas.")
            return items

        except Exception as e:
            print(f"{Fore.RED}[Cybertesis] Error decodificando respuesta JSON: {e}{Style.RESET_ALL}")
            return []
