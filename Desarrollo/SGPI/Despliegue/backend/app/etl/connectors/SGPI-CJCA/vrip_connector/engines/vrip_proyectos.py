import re
import html
from datetime import date
from typing import List, Optional
from bs4 import BeautifulSoup
from colorama import Fore, Style

from vrip_connector.engines.base import BaseExtractor
from vrip_connector.core.models import ProyectoModel
from vrip_connector.utils.date_parser import parse_spanish_date


class VripProyectosExtractor(BaseExtractor):
    def __init__(self):
        super().__init__("vrip_proyectos")

    def extract(
        self, year: Optional[int] = None, program: Optional[str] = None, query: Optional[str] = None, **kwargs
    ) -> List[ProyectoModel]:
        """
        Queries the VRIP WordPress REST API to retrieve official posts and resolutions (RR)
        of approved research projects. Extracts objective details (resolutions, budget, names)
        directly from the API response and page contents.
        """
        wp_api_url = self.source_config.get("wp_api_url", "https://vrip.unmsm.edu.pe/wp-json/wp/v2/posts")

        # Determine terms to search for based on parameters or defaults
        search_terms = ["proyecto", "PCONFIGI", "PMULTI", "resolucion"]
        if program:
            # If program is provided, search for it specifically
            search_terms = [program]
        if query:
            search_terms.append(query)

        collected_posts = {}  # id -> post dict to deduplicate

        print(f"{Fore.GREEN}[Proyectos VRIP]{Style.RESET_ALL} Consultando WordPress REST API del VRIP...")

        for term in search_terms:
            try:
                params = {"per_page": 20, "search": term, "_fields": "id,title,date,link,excerpt,content"}
                response = self.client.get(wp_api_url, params=params)
                if not response or response.status_code != 200:
                    continue

                posts = response.json()
                print(f"[Proyectos VRIP] Búsqueda de '{term}' retornó {len(posts)} entradas.")

                for post in posts:
                    post_id = post.get("id")
                    if post_id and post_id not in collected_posts:
                        collected_posts[post_id] = post

            except Exception as e:
                print(f"{Fore.YELLOW}[Proyectos VRIP] Advertencia al buscar '{term}': {e}{Style.RESET_ALL}")

        print(f"[Proyectos VRIP] Total de {len(collected_posts)} entradas únicas recuperadas para análisis.")

        projects: List[ProyectoModel] = []

        for post_id, post in collected_posts.items():
            try:
                title_raw = post.get("title", {}).get("rendered", "Sin título")
                title = html.unescape(title_raw)

                # Get post publish date
                post_date_str = post.get("date", "")[:10]  # YYYY-MM-DD
                parsed_post_date = parse_spanish_date(post_date_str)

                link = post.get("link", "")

                # Retrieve content and excerpt
                content_raw = post.get("content", {}).get("rendered", "")
                excerpt_raw = post.get("excerpt", {}).get("rendered", "")

                content_soup = BeautifulSoup(content_raw, "html.parser")
                excerpt_soup = BeautifulSoup(excerpt_raw, "html.parser")

                full_text = content_soup.get_text(" ", strip=True)
                excerpt_text = excerpt_soup.get_text(" ", strip=True)

                # 1. Infer/Extract academic year
                # Look for year in title first (e.g. "PCONFIGI 2025" or "Año 2026")
                academic_year = None
                year_match = re.search(r"\b(202\d|201\d)\b", title)
                if year_match:
                    academic_year = int(year_match.group(1))
                elif parsed_post_date:
                    academic_year = parsed_post_date.year
                else:
                    academic_year = date.today().year

                # Apply year filter early if specified
                if year and academic_year != year:
                    continue

                # 2. Extract program code
                program_code = self._infer_program_code(title)
                if program and program.upper() not in program_code:
                    continue

                # 3. Extract Resolution details (Number and Date)
                # Look for R.R. N° 014353-2025-R or similar
                resolution_num = None
                res_match = re.search(
                    r"R\.?R\.?\s*(?:N°|No|Nro\.?)?\s*(\d{5,6}-\d{4}-R|\d{5,6}\s*-\s*\d{4}\s*-\s*R)",
                    full_text,
                    re.IGNORECASE,
                )
                if res_match:
                    resolution_num = res_match.group(1).replace(" ", "")
                else:
                    # Try short code in title or post date
                    res_title_match = re.search(r"(?:RR|R\.R\.)\s*(?:N°|No)?\s*(\d{5,6}-\d{4}-R)", title, re.IGNORECASE)
                    if res_title_match:
                        resolution_num = res_title_match.group(1)

                # Extract explicit budget/monto if present
                budget = None
                # S/. 15,000 or S/ 12000
                budget_match = re.search(
                    r"(?:S/\.?|soles|presupuesto de)\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)", full_text, re.IGNORECASE
                )
                if budget_match:
                    try:
                        budget_str = budget_match.group(1).replace(",", "")
                        budget = float(budget_str)
                    except ValueError:
                        pass

                # Try to parse the table if projects are in the post content!
                tables = content_soup.find_all("table")
                if tables:
                    print(
                        f"[Proyectos VRIP] Se encontró una tabla en el post {post_id}. "
                        "Extrayendo proyectos estructurados..."
                    )
                    for table in tables:
                        rows = table.find_all("tr")
                        # Analyze headers
                        headers = [cell.get_text(strip=True).lower() for cell in rows[0].find_all(["td", "th"])]

                        # Find column indices
                        code_idx, title_idx, resp_idx, budget_idx = -1, -1, -1, -1
                        for idx, h in enumerate(headers):
                            if any(k in h for k in ["código", "codigo", "nro", "n°"]):
                                code_idx = idx
                            elif any(k in h for k in ["título", "titulo", "proyecto", "denominacion", "denominación"]):
                                title_idx = idx
                            elif any(k in h for k in ["responsable", "docente", "investigador", "autor", "director"]):
                                resp_idx = idx
                            elif any(
                                k in h for k in ["monto", "presupuesto", "financiamiento", "subvencion", "subvención"]
                            ):
                                budget_idx = idx

                        # Extract from rows
                        for row in rows[1:]:
                            cells = row.find_all("td")
                            if len(cells) < 2:
                                continue
                            try:
                                proj_code = cells[code_idx].get_text(strip=True) if code_idx != -1 else None
                                proj_title = cells[title_idx].get_text(strip=True) if title_idx != -1 else None
                                proj_resp = (
                                    cells[resp_idx].get_text(strip=True) if resp_idx != -1 else "No especificado"
                                )

                                proj_budget = None
                                if budget_idx != -1:
                                    raw_b = cells[budget_idx].get_text(strip=True)
                                    b_match = re.search(r"(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)", raw_b)
                                    if b_match:
                                        proj_budget = float(b_match.group(1).replace(",", ""))

                                if proj_title:
                                    # Apply search query filter if applicable
                                    if (
                                        query
                                        and query.lower() not in proj_title.lower()
                                        and query.lower() not in proj_resp.lower()
                                    ):
                                        continue

                                    projects.append(
                                        ProyectoModel(
                                            codigo_proyecto=proj_code,
                                            codigo_programa=program_code,
                                            titulo=proj_title,
                                            responsable=proj_resp,
                                            coinvestigadores=[],
                                            facultad="FISI",
                                            monto_financiado=proj_budget or budget,
                                            numero_resolucion=resolution_num,
                                            fecha_aprobacion=post_date_str,
                                            anio_academico=academic_year,
                                            enlace_vrip=link,
                                            resumen_post=excerpt_text[:200],
                                        )
                                    )
                            except Exception:
                                continue
                else:
                    # If there's no table, extract details from text / post fields
                    # Try to extract responsible name from excerpt or content
                    responsible = "Unidad de Investigación de la FISI"

                    # Regex to find name patterns: e.g. "docente responsable: Dr. Juan Perez"
                    resp_match = re.search(
                        r"(?:responsable|investigador principal|director|dr\.|dra\.)\s*:?\s*([a-zA-Z\s]{10,40})",
                        full_text,
                        re.IGNORECASE,
                    )
                    if resp_match:
                        responsible = resp_match.group(1).strip()

                    # Apply search query filter if applicable
                    if query and query.lower() not in title.lower() and query.lower() not in full_text.lower():
                        continue

                    # Fallback single project entry for this resolution post
                    projects.append(
                        ProyectoModel(
                            codigo_proyecto=None,
                            codigo_programa=program_code,
                            titulo=title,
                            responsable=responsible,
                            coinvestigadores=[],
                            facultad="FISI",
                            monto_financiado=budget,
                            numero_resolucion=resolution_num,
                            fecha_aprobacion=post_date_str,
                            anio_academico=academic_year,
                            enlace_vrip=link,
                            resumen_post=excerpt_text[:200],
                        )
                    )

            except Exception as e:
                print(f"{Fore.YELLOW}[Proyectos VRIP] Error procesando post {post_id}: {e}{Style.RESET_ALL}")
                continue

        # Sort projects by year descending
        projects.sort(key=lambda x: x.anio_academico, reverse=True)
        return projects

    def _infer_program_code(self, title: str) -> str:
        title_upper = title.upper()
        if "PCONFIGI-INV" in title_upper or ("INNOVACI" in title_upper and "PCONFIGI" in title_upper):
            return "PCONFIGI-INV"
        elif "PCONFIGI" in title_upper:
            return "PCONFIGI"
        elif "PMULTI" in title_upper:
            return "PMULTI"
        elif "PINVPOS" in title_upper or "TALLERES" in title_upper or "POSGRADO" in title_upper:
            return "PINVPOS"
        elif "PSINFINV" in title_upper or "SIN FINANCIAMIENTO" in title_upper:
            return "PSINFINV"
        elif "COVID" in title_upper:
            return "PMULTI-COVID"
        elif "FIDUCIARIO" in title_upper or "PÉREZ" in title_upper or "PEREZ" in title_upper:
            return "PGTF"
        elif "MIGRACI" in title_upper:
            return "PROG-EXT"
        else:
            return "VRIP"
