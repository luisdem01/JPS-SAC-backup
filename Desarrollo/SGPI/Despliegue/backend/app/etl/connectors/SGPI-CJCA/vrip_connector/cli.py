import sys
import json
import re
from pathlib import Path
from typing import Optional, List, Dict, Any, Union
import typer
from colorama import Fore, Back, Style, init
from tabulate import tabulate
from datetime import datetime, date
from pydantic import BaseModel

# Initialize colorama
init(autoreset=True)

# Helper function to match text with regex and case sensitivity support
def match_text(value: Optional[str], pattern: Optional[str], case_sensitive: bool = False, is_regex: bool = False) -> bool:
    if not pattern:
        return True
    if not value:
        return False
        
    if is_regex:
        flags = 0 if case_sensitive else re.IGNORECASE
        try:
            return bool(re.search(pattern, value, flags))
        except re.error:
            # Fallback to simple case-insensitive substring search if regex is malformed
            pass
            
    if case_sensitive:
        return pattern in value
    else:
        return pattern.lower() in value.lower()

# Imports inside CLI commands to keep startup fast and prevent imports loops
app = typer.Typer(
    name="vrip-connector",
    help="CLI Premium y adaptable para interactuar con las fuentes en vivo del VRIP y Cybertesis.",
    no_args_is_help=True
)

@app.command("scrape")
def scrape(
    source: str = typer.Option("all", "--source", "-s", help="Fuente a consultar: 'vrip' (convocatorias), 'cybertesis' (tesis), 'rais' (proyectos/resoluciones), o 'all'"),
    query: Optional[str] = typer.Option(None, "--query", "-q", help="Término o palabra clave de búsqueda principal global"),
    exclude_query: Optional[str] = typer.Option(None, "--exclude", help="Excluir registros que contengan este término global"),
    
    # Year Filters
    year: Optional[int] = typer.Option(None, "--year", "-y", help="Filtrar por año académico o publicación específico (ej. 2025)"),
    years: Optional[str] = typer.Option(None, "--years", help="Lista de años separados por comas (ej. 2024,2025,2026)"),
    year_min: Optional[int] = typer.Option(None, "--year-min", help="Límite inferior para filtro de años (ej. 2023)"),
    year_max: Optional[int] = typer.Option(None, "--year-max", help="Límite superior para filtro de años (ej. 2026)"),
    
    # Specific Text Filters (Maximum Personalization)
    title: Optional[str] = typer.Option(None, "--title", help="Filtro específico por título (soporta regex/sensible)"),
    responsable: Optional[str] = typer.Option(None, "--responsable", "--author", help="Filtro específico por Investigador Principal, autor o tesista"),
    coinvestigador: Optional[str] = typer.Option(None, "--coinvestigador", help="Filtro específico por miembro co-investigador (Proyectos)"),
    code: Optional[str] = typer.Option(None, "--code", help="Filtro específico por código de proyecto o resolución"),
    resolution: Optional[str] = typer.Option(None, "--resolution", help="Filtro específico por número de Resolución Rectoral (ej. 014353-2025-R)"),
    
    # Advanced Logical Switches
    case_sensitive: bool = typer.Option(False, "--case-sensitive", help="Habilitar coincidencia exacta distinguiendo mayúsculas y minúsculas"),
    regex: bool = typer.Option(False, "--regex", help="Habilitar evaluación de expresiones regulares en todas las búsquedas de texto"),
    
    # Date Range Filters
    date_since: Optional[str] = typer.Option(None, "--date-since", help="Fecha límite inferior en formato YYYY-MM-DD"),
    date_until: Optional[str] = typer.Option(None, "--date-until", help="Fecha límite superior en formato YYYY-MM-DD"),
    
    # Convocatorias Specific Filters
    status: str = typer.Option("todas", "--status", help="Filtrar convocatorias: 'abierta' (dias_restantes >= 0), 'cerrada' o 'todas'"),
    min_days: Optional[int] = typer.Option(None, "--min-days", help="Días mínimos restantes antes del cierre (Convocatorias)"),
    
    # Program and Faculty Filters
    program: Optional[str] = typer.Option(None, "--program", "-p", help="Código de programa de investigación (ej. PCONFIGI)"),
    programs: Optional[str] = typer.Option(None, "--programs", help="Lista de programas separados por comas (ej. PCONFIGI,PMULTI)"),
    facultad: Optional[str] = typer.Option(None, "--facultad", "-f", help="Filtrar por facultad (ej. FISI)"),
    faculties: Optional[str] = typer.Option(None, "--faculties", help="Lista de facultades separadas por comas (ej. FISI,Medicina)"),
    
    # Financial Filters
    min_budget: Optional[float] = typer.Option(None, "--min-budget", help="Presupuesto mínimo financiado"),
    max_budget: Optional[float] = typer.Option(None, "--max-budget", help="Presupuesto máximo financiado"),
    
    # Field Selection and Display (Maximum Personalization)
    fields: Optional[str] = typer.Option(None, "--fields", help="Lista de campos específicos separados por comas a incluir en el output"),
    
    # Format, Output and Interactive Wizard
    format_type: str = typer.Option("table", "--format", help="Formato de salida: 'table' (consola), 'json' o 'excel'"),
    output: Optional[str] = typer.Option(None, "--output", "-o", help="Ruta de archivo para guardar resultados (JSON o Excel)"),
    quiet: bool = typer.Option(False, "--quiet", help="Silenciar mensajes informativos y enviar únicamente el JSON estructurado a stdout"),
    interactive: bool = typer.Option(False, "--interactive", "-i", help="Activar el asistente de búsqueda interactivo paso a paso"),
    
    # Limits and Sorting
    limit: Optional[int] = typer.Option(None, "--limit", "-l", help="Límite máximo de registros a retornar"),
    sort_by: str = typer.Option("date", "--sort-by", help="Campo de ordenamiento: 'date' (fecha), 'budget' (presupuesto), 'title' (título), 'year' (año) o 'code' (código)"),
    order: str = typer.Option("desc", "--order", help="Dirección del ordenamiento: 'asc' (ascendente) o 'desc' (descendente)")
):
    """
    Scrapea y unifica información en vivo de las plataformas científicas de la UNMSM.
    Ofrece un set extremadamente completo de filtros lógicos y combinables en vivo.
    """
    if interactive:
        run_wizard()
        return

    # Force format to json if quiet mode is active
    if quiet:
        format_type = "json"
        
    try:
        # Import engines and components
        from vrip_connector.engines.vrip_convocatorias import VripConvocatoriasExtractor
        from vrip_connector.engines.vrip_proyectos import VripProyectosExtractor
        from vrip_connector.engines.cybertesis_api import CyberthesisExtractor
        from vrip_connector.core.exporter import export_data
        
        # Parse fields list if specified
        display_fields = []
        if fields:
            display_fields = [f.strip() for f in fields.split(",")]
        
        # Build list of years to filter
        filter_years = []
        if year:
            filter_years.append(year)
        if years:
            for y_str in years.split(","):
                try:
                    filter_years.append(int(y_str.strip()))
                except ValueError:
                    pass
                    
        # Build list of programs to filter
        filter_programs = []
        if program:
            filter_programs.append(program.upper().strip())
        if programs:
            filter_programs.extend([p.upper().strip() for p in programs.split(",")])
            
        # Build list of faculties to filter
        filter_faculties = []
        if facultad:
            filter_faculties.append(facultad.upper().strip())
        if faculties:
            filter_faculties.extend([f.upper().strip() for f in faculties.split(",")])

        # Validate date ranges
        since_date = None
        until_date = None
        if date_since:
            try:
                since_date = datetime.strptime(date_since, "%Y-%m-%d").date()
            except ValueError:
                if not quiet:
                    print(f"{Fore.RED}Advertencia: Formato de '--date-since' inválido. Use YYYY-MM-DD.{Style.RESET_ALL}")
        if date_until:
            try:
                until_date = datetime.strptime(date_until, "%Y-%m-%d").date()
            except ValueError:
                if not quiet:
                    print(f"{Fore.RED}Advertencia: Formato de '--date-until' inválido. Use YYYY-MM-DD.{Style.RESET_ALL}")

        if not quiet:
            print("=" * 100)
            print(f" {Fore.YELLOW}{Style.BRIGHT}CONECTOR CIENTÍFICO VRIP - UNMSM FISI (MÓDULO DE INGESTA)")
            print(f" {Fore.CYAN}Búsqueda e Ingesta Automatizada con Filtros Avanzados en Vivo")
            print("=" * 100)
            print(f" [Búsqueda] Fuente: {source.upper()} | Query: '{query or 'Sin restricción'}'")
            if filter_years:
                print(f" [Filtros] Años: {filter_years}")
            if year_min or year_max:
                print(f" [Filtros] Rango Años: {year_min or '*'} - {year_max or '*'}")
            if title:
                print(f" [Filtros] Título: '{title}' (Regex: {regex}, Sensible: {case_sensitive})")
            if responsable:
                print(f" [Filtros] Investigador/Autor: '{responsable}'")
            if coinvestigador:
                print(f" [Filtros] Co-investigador: '{coinvestigador}'")
            if code:
                print(f" [Filtros] Código: '{code}'")
            if resolution:
                print(f" [Filtros] Resolución: '{resolution}'")
            if since_date or until_date:
                print(f" [Filtros] Fechas límite: {date_since or '*'} a {date_until or '*'}")
            if filter_programs:
                print(f" [Filtros] Programas: {filter_programs}")
            if filter_faculties:
                print(f" [Filtros] Facultades: {filter_faculties}")
            if min_budget or max_budget:
                print(f" [Filtros] Presupuesto: S/. {min_budget or '0'} a S/. {max_budget or 'Max'}")
            if status != "todas" or min_days is not None:
                print(f" [Filtros] Convocatorias - Estado: {status} | Min Días Restantes: {min_days or '*'}")
            if display_fields:
                print(f" [Visualización] Campos seleccionados: {display_fields}")
            print("=" * 100 + "\n")

        # Determine which sources to execute
        sources_to_run = []
        source_clean = source.lower().strip()
        if source_clean == "all":
            sources_to_run = ["vrip", "rais", "cybertesis"]
        elif source_clean in ["vrip", "convocatorias"]:
            sources_to_run = ["vrip"]
        elif source_clean in ["rais", "proyectos", "resoluciones"]:
            sources_to_run = ["rais"]
        elif source_clean in ["cybertesis", "cyberthesis", "tesis"]:
            sources_to_run = ["cybertesis"]
        else:
            if not quiet:
                typer.echo(f"Error: Fuente '{source}' no reconocida.", err=True)
            sys.exit(1)

        # In-memory datasets
        raw_convocatorias = []
        raw_proyectos = []
        raw_tesis = []

        # Execute extraction engines
        if "vrip" in sources_to_run:
            ext = VripConvocatoriasExtractor()
            raw_convocatorias = ext.extract(year=year)
            
        if "rais" in sources_to_run:
            ext = VripProyectosExtractor()
            raw_proyectos = ext.extract(year=year, program=program, query=query)
            
        if "cybertesis" in sources_to_run:
            ext = CyberthesisExtractor()
            search_query = query if query else "FISI"
            raw_tesis = ext.extract(query=search_query, year=year, limit=limit or 100)

        # ----------------------------------------------------
        # APPLY ADVANCED IN-MEMORY LOGICAL FILTERS
        # ----------------------------------------------------
        
        # 1. Filter Convocatorias
        filtered_convocatorias = []
        for item in raw_convocatorias:
            # Date/Year parsing from the plazo_cierre
            item_year = None
            item_date = None
            if item.plazo_cierre:
                try:
                    item_date = datetime.strptime(item.plazo_cierre, "%Y-%m-%d").date()
                    item_year = item_date.year
                except ValueError:
                    pass
            
            # Year filters
            if filter_years and item_year and item_year not in filter_years:
                continue
            if year_min and item_year and item_year < year_min:
                continue
            if year_max and item_year and item_year > year_max:
                continue
                
            # Date boundaries
            if since_date and item_date and item_date < since_date:
                continue
            if until_date and item_date and item_date > until_date:
                continue

            # Convocatorias specific filters (Status / Min Days)
            if min_days is not None and (item.dias_restantes is None or item.dias_restantes < min_days):
                continue
            
            if status == "abierta":
                if item.dias_restantes is None or item.dias_restantes < 0:
                    continue
            elif status == "cerrada":
                if item.dias_restantes is not None and item.dias_restantes >= 0:
                    continue
                    
            # Specific Text Filters
            if title and not match_text(item.titulo, title, case_sensitive, regex):
                continue
            if responsable and not match_text(item.entidad_promotora, responsable, case_sensitive, regex):
                continue
            if coinvestigador or code or resolution:
                # These fields don't exist in convocatorias
                continue

            # Free text query match (Global check)
            if query:
                text_to_search = f"{item.titulo} {item.plazo_cierre_original} {item.entidad_promotora}"
                if not match_text(text_to_search, query, case_sensitive, regex):
                    continue
            
            # Exclusion check
            if exclude_query:
                text_to_search = f"{item.titulo} {item.plazo_cierre_original} {item.entidad_promotora}"
                if match_text(text_to_search, exclude_query, case_sensitive, regex):
                    continue
                    
            filtered_convocatorias.append(item)

        # 2. Filter Proyectos
        filtered_proyectos = []
        for item in raw_proyectos:
            item_year = item.anio_academico
            
            # Year limits
            if filter_years and item_year not in filter_years:
                continue
            if year_min and item_year < year_min:
                continue
            if year_max and item_year > year_max:
                continue
                
            # Date boundaries
            item_date = None
            if item.fecha_aprobacion:
                try:
                    item_date = datetime.strptime(item.fecha_aprobacion, "%Y-%m-%d").date()
                except ValueError:
                    pass
            if since_date and item_date and item_date < since_date:
                continue
            if until_date and item_date and item_date > until_date:
                continue

            # Program codes match
            if filter_programs and not any(p in item.codigo_programa.upper() for p in filter_programs):
                continue
                
            # Faculty match
            if filter_faculties and not any(f in item.facultad.upper() for f in filter_faculties):
                continue
                
            # Financial filters
            if min_budget is not None and (item.monto_financiado is None or item.monto_financiado < min_budget):
                continue
            if max_budget is not None and (item.monto_financiado is None or item.monto_financiado > max_budget):
                continue
                
            # Specific Text Filters
            if title and not match_text(item.titulo, title, case_sensitive, regex):
                continue
            if responsable and not match_text(item.responsable, responsable, case_sensitive, regex):
                continue
            if coinvestigador:
                # Search inside coinvestigadores list
                found_coinv = False
                for c in item.coinvestigadores:
                    if match_text(c, coinvestigador, case_sensitive, regex):
                        found_coinv = True
                        break
                if not found_coinv:
                    continue
            if code and not match_text(item.codigo_proyecto, code, case_sensitive, regex):
                continue
            if resolution and not match_text(item.numero_resolucion, resolution, case_sensitive, regex):
                continue

            # Free text query match (Global check)
            if query:
                combined_fields = f"{item.titulo} {item.responsable} {item.codigo_proyecto or ''} {item.numero_resolucion or ''} {' '.join(item.coinvestigadores)}"
                if not match_text(combined_fields, query, case_sensitive, regex):
                    continue
                    
            if exclude_query:
                combined_fields = f"{item.titulo} {item.responsable} {item.codigo_proyecto or ''} {item.numero_resolucion or ''} {' '.join(item.coinvestigadores)}"
                if match_text(combined_fields, exclude_query, case_sensitive, regex):
                    continue

            filtered_proyectos.append(item)

        # 3. Filter Tesis
        filtered_tesis = []
        for item in raw_tesis:
            item_year = item.anio_publicacion
            
            # Year filters
            if filter_years and item_year not in filter_years:
                continue
            if year_min and item_year < year_min:
                continue
            if year_max and item_year > year_max:
                continue
                
            # Date boundaries mapped to publication year
            if since_date and item_year < since_date.year:
                continue
            if until_date and item_year > until_date.year:
                continue
                
            # Specific Text Filters
            if title and not match_text(item.titulo, title, case_sensitive, regex):
                continue
            if responsable and not match_text(item.autores, responsable, case_sensitive, regex):
                continue
            if coinvestigador or code or resolution:
                # These fields don't exist in thesis
                continue

            # Free text query match
            if query:
                combined = f"{item.titulo} {item.autores} {item.anio_publicacion}"
                if not match_text(combined, query, case_sensitive, regex):
                    continue
            if exclude_query:
                combined = f"{item.titulo} {item.autores} {item.anio_publicacion}"
                if match_text(combined, exclude_query, case_sensitive, regex):
                    continue
                    
            filtered_tesis.append(item)

        # ----------------------------------------------------
        # SORTING AND LIMITS
        # ----------------------------------------------------
        is_desc = order.lower() == "desc"
        
        # Sort Convocatorias
        if sort_by == "date":
            filtered_convocatorias.sort(key=lambda x: x.plazo_cierre or "0000-00-00", reverse=is_desc)
        elif sort_by == "title":
            filtered_convocatorias.sort(key=lambda x: x.titulo.lower(), reverse=is_desc)

        # Sort Proyectos
        if sort_by == "date":
            filtered_proyectos.sort(key=lambda x: x.fecha_aprobacion or "0000-00-00", reverse=is_desc)
        elif sort_by == "budget":
            filtered_proyectos.sort(key=lambda x: x.monto_financiado or 0.0, reverse=is_desc)
        elif sort_by == "title":
            filtered_proyectos.sort(key=lambda x: x.titulo.lower(), reverse=is_desc)
        elif sort_by == "year":
            filtered_proyectos.sort(key=lambda x: x.anio_academico, reverse=is_desc)
        elif sort_by == "code":
            filtered_proyectos.sort(key=lambda x: x.codigo_proyecto or "", reverse=is_desc)

        # Sort Tesis
        if sort_by == "title":
            filtered_tesis.sort(key=lambda x: x.titulo.lower(), reverse=is_desc)
        elif sort_by == "year":
            filtered_tesis.sort(key=lambda x: x.anio_publicacion, reverse=is_desc)

        # Apply Limits
        if limit is not None:
            filtered_convocatorias = filtered_convocatorias[:limit]
            filtered_proyectos = filtered_proyectos[:limit]
            filtered_tesis = filtered_tesis[:limit]

        # ----------------------------------------------------
        # FIELD SELECTION AND PAYLOAD PACKAGING
        # ----------------------------------------------------
        
        # Pack raw models into standard dict dumps if display fields are active
        if display_fields:
            conv_payload = []
            for item in filtered_convocatorias:
                d = item.model_dump()
                conv_payload.append({k: v for k, v in d.items() if k in display_fields})
            
            proj_payload = []
            for item in filtered_proyectos:
                d = item.model_dump()
                proj_payload.append({k: v for k, v in d.items() if k in display_fields})
                
            tesis_payload = []
            for item in filtered_tesis:
                d = item.model_dump()
                tesis_payload.append({k: v for k, v in d.items() if k in display_fields})
        else:
            conv_payload = filtered_convocatorias
            proj_payload = filtered_proyectos
            tesis_payload = filtered_tesis

        if source_clean == "all":
            export_payload = {
                "Convocatorias": conv_payload,
                "Proyectos_Resoluciones": proj_payload,
                "Cybertesis_Tesis": tesis_payload
            }
            total_elements = len(filtered_convocatorias) + len(filtered_proyectos) + len(filtered_tesis)
        else:
            if "vrip" in sources_to_run:
                export_payload = conv_payload
                total_elements = len(filtered_convocatorias)
            elif "rais" in sources_to_run:
                export_payload = proj_payload
                total_elements = len(filtered_proyectos)
            else:
                export_payload = tesis_payload
                total_elements = len(filtered_tesis)

        # ----------------------------------------------------
        # RENDER OUTPUTS
        # ----------------------------------------------------
        
        if format_type.lower() == "table" and not quiet:
            if "vrip" in sources_to_run:
                print(f" {Fore.GREEN}{Style.BRIGHT}CONVOCATORIAS VIGENTES ({len(filtered_convocatorias)})")
                if filtered_convocatorias:
                    # Dynamically determine columns based on fields
                    if display_fields:
                        headers = [f.upper() for f in display_fields]
                        table_data = [[str(item.model_dump().get(f, "-"))[:50] for f in display_fields] for item in filtered_convocatorias]
                    else:
                        headers = ["Título", "Entidad Promotora", "Fecha", "Cierre", "Días Rest."]
                        table_data = [
                            [
                                f"{Fore.WHITE}{Style.BRIGHT}{item.titulo[:50]}...",
                                item.entidad_promotora[:35],
                                item.fecha_publicacion or "-",
                                item.plazo_cierre_original,
                                f"{Fore.GREEN if (item.dias_restantes or 0) > 7 else Fore.RED}{item.dias_restantes if item.dias_restantes is not None else '-'}"
                            ]
                            for item in filtered_convocatorias
                        ]
                    print(tabulate(table_data, headers=headers, tablefmt="fancy_grid"))
                else:
                    print(" No se encontraron convocatorias que cumplan con los filtros.")
                print("\n")
                
            if "rais" in sources_to_run:
                print(f" {Fore.GREEN}{Style.BRIGHT}RESOLUCIONES Y PROYECTOS ({len(filtered_proyectos)})")
                if filtered_proyectos:
                    if display_fields:
                        headers = [f.upper() for f in display_fields]
                        table_data = [[str(item.model_dump().get(f, "-"))[:50] for f in display_fields] for item in filtered_proyectos]
                    else:
                        headers = ["Código", "Prog.", "Título del Proyecto / Resolución", "Responsable", "Monto", "Resolución", "Año"]
                        table_data = [
                            [
                                item.codigo_proyecto or "-",
                                f"{Fore.CYAN}{item.codigo_programa}",
                                item.titulo[:45] + ("..." if len(item.titulo) > 45 else ""),
                                item.responsable[:25],
                                f"S/. {item.monto_financiado:,.2f}" if item.monto_financiado is not None else "-",
                                item.numero_resolucion or "-",
                                item.anio_academico
                            ]
                            for item in filtered_proyectos
                        ]
                    print(tabulate(table_data, headers=headers, tablefmt="fancy_grid"))
                else:
                    print(" No se encontraron proyectos que cumplan con los filtros.")
                print("\n")
 
            if "cybertesis" in sources_to_run:
                print(f" {Fore.GREEN}{Style.BRIGHT}TESIS EN CYBERTESIS ({len(filtered_tesis)})")
                if filtered_tesis:
                    if display_fields:
                        headers = [f.upper() for f in display_fields]
                        table_data = [[str(item.model_dump().get(f, "-"))[:50] for f in display_fields] for item in filtered_tesis]
                    else:
                        headers = ["Título de la Tesis", "Autores / Tesistas", "Año", "Enlace Handle"]
                        table_data = [
                            [
                                f"{Fore.WHITE}{item.titulo[:50]}...",
                                item.autores[:30],
                                item.anio_publicacion,
                                f"{Fore.BLUE}{item.enlace_handle}"
                            ]
                            for item in filtered_tesis
                        ]
                    print(tabulate(table_data, headers=headers, tablefmt="fancy_grid"))
                else:
                    print(" No se encontraron tesis que cumplan con los filtros.")
                print("\n")
                
            print("=" * 100)
            print(f" {Fore.GREEN}{Style.BRIGHT}BÚSQUEDA Y PROCESAMIENTO FINALIZADO CON ÉXITO")
            print(f" {Fore.WHITE}Total unificado de registros recuperados: {total_elements}")
            print("=" * 100)
 
            if output:
                # Deduce format from file extension if possible
                out_ext = Path(output).suffix.lower()
                deduced_format = "excel" if out_ext in [".xlsx", ".xls"] else "json"
                # Exporter needs actual Pydantic models, so we pass the non-dumped payload
                raw_payload = get_raw_payload(source_clean, sources_to_run, filtered_convocatorias, filtered_proyectos, filtered_tesis)
                export_data(raw_payload, output_path=output, format_type=deduced_format, quiet=quiet)
 
        else:
            # Export raw models using core exporter to preserve premium typing
            raw_payload = get_raw_payload(source_clean, sources_to_run, filtered_convocatorias, filtered_proyectos, filtered_tesis)
            if display_fields and format_type == "json":
                # JSON with custom fields can be dumped as dict directly
                export_data(export_payload, output_path=output, format_type=format_type, quiet=quiet)
            else:
                export_data(raw_payload, output_path=output, format_type=format_type, quiet=quiet)
 
    except Exception as e:
        if not quiet:
            import traceback
            print(f"{Fore.RED}Error crítico durante la ejecución del CLI: {e}{Style.RESET_ALL}", file=sys.stderr)
            traceback.print_exc()
        else:
            print(json.dumps({"error": str(e)}))
        sys.exit(1)

def get_raw_payload(source_clean, sources_to_run, conv, proj, tesis):
    if source_clean == "all":
        return {
            "Convocatorias": conv,
            "Proyectos_Resoluciones": proj,
            "Cybertesis_Tesis": tesis
        }
    else:
        if "vrip" in sources_to_run:
            return conv
        elif "rais" in sources_to_run:
            return proj
        else:
            return tesis

# Interactive wizard implementation
@app.command("wizard")
def wizard_command():
    """
    Inicia el Asistente Interactivo de Búsqueda (Search Wizard) guiado por prompts.
    """
    run_wizard()

def run_wizard():
    print("\n" + "=" * 100)
    print(f" {Fore.YELLOW}{Style.BRIGHT}ASISTENTE INTERACTIVO DE BÚSQUEDA Y EXTRACCIÓN (WIZARD)")
    print(f" {Fore.CYAN}Conector Científico VRIP / Cybertesis - UNMSM FISI")
    print("=" * 100)
    
    # 1. Selection of Source
    print(f"\n{Fore.GREEN}[Paso 1] Seleccione la fuente de datos a consultar:{Style.RESET_ALL}")
    print(" 1) Convocatorias vigentes (Portal VRIP)")
    print(" 2) Resoluciones Rectorales de Proyectos Aprobados (RAIS/WP REST API)")
    print(" 3) Tesis y producción académica (Cybertesis API)")
    print(" 4) Todas las fuentes unificadas")
    
    opt_src = input(" Seleccione una opción [1-4, por defecto 4]: ").strip()
    source_map = {"1": "vrip", "2": "rais", "3": "cybertesis", "4": "all"}
    source_val = source_map.get(opt_src, "all")
    
    # 2. General Query
    print(f"\n{Fore.GREEN}[Paso 2] Filtro de búsqueda textual:{Style.RESET_ALL}")
    query_val = input(" Ingrese un término o frase clave global (Opcional): ").strip()
    if query_val == "":
        query_val = None
        
    # 3. Specific Text Filters
    title_val = None
    resp_val = None
    coinv_val = None
    code_val = None
    res_val = None
    exclude_val = None
    case_val = False
    regex_val = False
    
    specific_text = input(f"\n ¿Desea aplicar filtros textuales avanzados por campos? (s/n, por defecto n): ").strip().lower()
    if specific_text in ["s", "si", "yes"]:
        t = input(" - Filtrar por TÍTULO específico: ").strip()
        if t: title_val = t
        
        r = input(" - Filtrar por INVESTIGADOR PRINCIPAL o AUTOR: ").strip()
        if r: resp_val = r
        
        if source_val in ["rais", "all"]:
            c = input(" - Filtrar por CO-INVESTIGADOR: ").strip()
            if c: coinv_val = c
            
            co = input(" - Filtrar por CÓDIGO de proyecto: ").strip()
            if co: code_val = co
            
            re_num = input(" - Filtrar por número de RESOLUCIÓN Rectoral: ").strip()
            if re_num: res_val = re_num
            
        ex = input(" - Excluir registros que contengan el texto: ").strip()
        if ex: exclude_val = ex
        
        cs = input(" - ¿Búsqueda sensible a mayúsculas/minúsculas? (s/n, por defecto n): ").strip().lower()
        if cs in ["s", "si", "yes"]:
            case_val = True
            
        rx = input(" - ¿Habilitar expresiones regulares (Regex)? (s/n, por defecto n): ").strip().lower()
        if rx in ["s", "si", "yes"]:
            regex_val = True
            
    # 4. Year/Time Filters
    year_val = None
    years_val = None
    ymin_val = None
    ymax_val = None
    since_val = None
    until_val = None
    
    time_filt = input(f"\n ¿Desea aplicar filtros de tiempo y rango de años? (s/n, por defecto n): ").strip().lower()
    if time_filt in ["s", "si", "yes"]:
        y_opt = input(" - Ingrese un año específico (ej. 2025) o múltiples separados por comas (ej. 2024,2025): ").strip()
        if y_opt:
            if "," in y_opt:
                years_val = y_opt
            else:
                try:
                    year_val = int(y_opt)
                except ValueError:
                    pass
                    
        ymin = input(" - Año mínimo (ej. 2023): ").strip()
        if ymin:
            try: ymin_val = int(ymin)
            except ValueError: pass
            
        ymax = input(" - Año máximo (ej. 2026): ").strip()
        if ymax:
            try: ymax_val = int(ymax)
            except ValueError: pass
            
        ds = input(" - Fecha de publicación desde (YYYY-MM-DD): ").strip()
        if ds: since_val = ds
        
        du = input(" - Fecha de publicación hasta (YYYY-MM-DD): ").strip()
        if du: until_val = du

    # 5. Advanced filters (programs, faculties, budgets)
    prog_val = None
    fac_val = None
    minb_val = None
    maxb_val = None
    status_val = "todas"
    mind_val = None
    
    adv_filt = input(f"\n ¿Desea aplicar filtros de presupuesto, facultades o vigencia? (s/n, por defecto n): ").strip().lower()
    if adv_filt in ["s", "si", "yes"]:
        if source_val in ["rais", "all"]:
            p = input(" - Código de programa (ej. PCONFIGI, PMULTI): ").strip()
            if p: prog_val = p
            
            f = input(" - Facultad (ej. FISI, Medicina): ").strip()
            if f: fac_val = f
            
            minb = input(" - Presupuesto mínimo financiado: ").strip()
            if minb:
                try: minb_val = float(minb)
                except ValueError: pass
                
            maxb = input(" - Presupuesto máximo financiado: ").strip()
            if maxb:
                try: maxb_val = float(maxb)
                except ValueError: pass
                
        if source_val in ["vrip", "all"]:
            st = input(" - Vigencia de convocatoria (abierta / cerrada / todas): ").strip().lower()
            if st in ["abierta", "cerrada", "todas"]:
                status_val = st
                
            md = input(" - Mínimo de días restantes para el cierre: ").strip()
            if md:
                try: mind_val = int(md)
                except ValueError: pass

    # 6. Fields selection
    fields_val = None
    fld_sel = input(f"\n ¿Desea seleccionar campos/columnas específicas a retornar? (s/n, por defecto n): ").strip().lower()
    if fld_sel in ["s", "si", "yes"]:
        fields_val = input(" Ingrese nombres de campos separados por comas (ej. titulo,responsable,monto_financiado): ").strip()
        if fields_val == "":
            fields_val = None

    # 7. Outputs
    print(f"\n{Fore.GREEN}[Paso 3] Formato de visualización y exportación:{Style.RESET_ALL}")
    print(" 1) Tabla legible en consola")
    print(" 2) Archivo JSON estructurado")
    print(" 3) Libro Excel Corporativo Premium (.xlsx)")
    
    opt_fmt = input(" Seleccione formato [1-3, por defecto 1]: ").strip()
    fmt_map = {"1": "table", "2": "json", "3": "excel"}
    fmt_val = fmt_map.get(opt_fmt, "table")
    
    out_val = None
    if fmt_val in ["json", "excel"] or input(" ¿Desea guardar además los resultados en un archivo? (s/n, por defecto n): ").strip().lower() in ["s", "si", "yes"]:
        out_val = input(" Ingrese la ruta o nombre del archivo de salida: ").strip()
        if out_val == "":
            out_val = None
            
    print(f"\n{Fore.YELLOW}Iniciando consulta científica interactiva con los filtros seleccionados...{Style.RESET_ALL}\n")
    
    # Run scrape command programmatically
    scrape(
        source=source_val,
        query=query_val,
        exclude_query=exclude_val,
        year=year_val,
        years=years_val,
        year_min=ymin_val,
        year_max=ymax_val,
        title=title_val,
        responsable=resp_val,
        coinvestigador=coinv_val,
        code=code_val,
        resolution=res_val,
        case_sensitive=case_val,
        regex=regex_val,
        date_since=since_val,
        date_until=until_val,
        status=status_val,
        min_days=mind_val,
        program=prog_val,
        programs=None,
        facultad=fac_val,
        faculties=None,
        min_budget=minb_val,
        max_budget=maxb_val,
        fields=fields_val,
        format_type=fmt_val,
        output=out_val,
        quiet=False,
        interactive=False,
        limit=None,
        sort_by="date",
        order="desc"
    )

def main():
    # Make sure stdout/stderr are UTF-8 on Windows
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")
        
    app()

if __name__ == "__main__":
    main()
