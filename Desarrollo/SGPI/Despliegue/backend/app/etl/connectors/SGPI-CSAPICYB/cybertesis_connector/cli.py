import sys
import json
from pathlib import Path
from typing import Optional
import typer
from tabulate import tabulate
from colorama import Fore, Style, init

from cybertesis_connector.utils.helpers import format_clean_filename

# Inicializar colorama para coloreado multiplataforma
init(autoreset=True)

app = typer.Typer(
    name="cybertesis-connector",
    help="CLI robusto y modular para consultar y exportar tesis de Cybertesis UNMSM.",
    no_args_is_help=True,
)


def print_banner(quiet: bool = False):
    """Muestra un banner estético en consola."""
    if quiet:
        return
    print("=" * 100)
    print(f" {Fore.YELLOW}{Style.BRIGHT}CONECTOR CYBERTESIS CLI v1.0 - UNMSM FISI")
    print(f" {Fore.CYAN}Ingesta de Producción Científica, Tesistas y Asesores para el SGPI")
    print("=" * 100)


@app.command("search")
def search(
    query: str = typer.Argument(..., help="Término de búsqueda (Nombre de docente, tesista o tema)."),
    output: Optional[str] = typer.Option(
        None, "--output", "-o", help="Ruta de destino para guardar el reporte (JSON o Excel)."
    ),
    format_type: str = typer.Option("json", "--format", "-f", help="Formato de salida deseado: 'json' o 'excel'."),
    quiet: bool = typer.Option(
        False, "--quiet", "-q", help="Silencia logs descriptivos e imprime solo el JSON final a stdout."
    ),
    limit: Optional[int] = typer.Option(None, "--limit", "-l", help="Límite máximo de registros a extraer."),
    degree: Optional[str] = typer.Option(
        None, "--degree", "-g", help="Filtra por grado académico: 'pregrado', 'maestria' o 'doctorado'."
    ),
    year: Optional[int] = typer.Option(None, "--year", "-y", help="Filtra por año exacto de publicación (ej. 2023)."),
    year_start: Optional[int] = typer.Option(None, "--year-start", help="Año de inicio para rango de publicación."),
    year_end: Optional[int] = typer.Option(None, "--year-end", help="Año de fin para rango de publicación."),
    role: Optional[str] = typer.Option(
        None,
        "--role",
        "-r",
        help="Restringe la coincidencia del término de búsqueda según el rol del docente: 'autor' o 'asesor'.",
    ),
    keyword: Optional[str] = typer.Option(
        None, "--keyword", "-k", help="Filtra por palabra clave (keyword) específica."
    ),
    sort_by: str = typer.Option(
        "anio", "--sort-by", help="Campo de ordenamiento: 'anio' (año), 'titulo' (título) o 'autor'."
    ),
    sort_order: str = typer.Option("desc", "--sort-order", help="Dirección de ordenamiento: 'asc' o 'desc'."),
):
    """
    Busca producciones científicas en Cybertesis de forma dinámica, con paginación completa y filtros avanzados.
    """
    try:
        print_banner(quiet)

        # 1. Selección de Motor de Extracción
        if not quiet:
            print(f"{Fore.GREEN}[Live Mode]{Style.RESET_ALL} Conectando a los servidores REST API de Cybertesis...")
        from cybertesis_connector.engines.api_engine import CybertesisAPIEngine

        engine = CybertesisAPIEngine()
        results_model = engine.search(query, limit=limit, quiet=quiet)

        # 2. Aplicar Filtros Avanzados y Ordenamiento Local
        from cybertesis_connector.utils.helpers import filter_and_sort_results

        has_filters = any([degree, year, year_start, year_end, role, keyword])
        if not quiet and has_filters:
            print(f"{Fore.BLUE}[Filtros Activos]{Style.RESET_ALL} Aplicando filtros avanzados solicitados...")

        results_model = filter_and_sort_results(
            results_model,
            degree=degree,
            year=year,
            year_start=year_start,
            year_end=year_end,
            role=role,
            keyword=keyword,
            sort_by=sort_by,
            sort_order=sort_order,
            query_term=query,
        )

        # 2. Renderizado Visual en Consola (si no está en modo quiet)
        if not quiet:
            if results_model.resultados:
                print(
                    f"\n{Fore.GREEN}{Style.BRIGHT}RESULTADOS DE BÚSQUEDA ({len(results_model.resultados)} encontradas):"
                )
                table_data = []
                for idx, t in enumerate(results_model.resultados, 1):
                    # Formatear lista de autores
                    autores_display = ", ".join(t.autores)
                    if len(autores_display) > 35:
                        autores_display = autores_display[:32] + "..."

                    # Formatear asesores
                    asesores_display = ", ".join(t.asesores) if t.asesores else "No registrado"
                    if len(asesores_display) > 35:
                        asesores_display = asesores_display[:32] + "..."

                    table_data.append(
                        [
                            idx,
                            f"{Fore.WHITE}{Style.BRIGHT}{t.titulo[:50]}...",
                            f"{Fore.CYAN}{autores_display}",
                            f"{Fore.YELLOW}{asesores_display}",
                            t.anio_publicacion,
                            t.grado_academico,
                        ]
                    )

                headers = [
                    "N°",
                    "Título de la Investigación",
                    "Tesistas / Autores",
                    "Asesores de Tesis",
                    "Año",
                    "Grado",
                ]
                print(tabulate(table_data, headers=headers, tablefmt="fancy_grid"))
            else:
                print(
                    f"\n{Fore.YELLOW}[Info]{Style.RESET_ALL} "
                    f"No se encontraron tesis registradas en el repositorio para: '{query}'"
                )

        # 3. Exportación
        if results_model.resultados:
            # Si no se define ruta de salida pero se pide Excel, autogenerar nombre
            if format_type.lower() == "excel" and not output:
                clean_q = format_clean_filename(query)
                output = f"outputs/reporte_cybertesis_{clean_q}.xlsx"

            if output:
                out_path = Path(output)
                if format_type.lower() == "excel":
                    if not quiet:
                        print(
                            f"\n{Fore.BLUE}[Exportador]{Style.RESET_ALL} "
                            f"Generando libro de Excel Premium en: {out_path}..."
                        )
                    from cybertesis_connector.utils.excel_generator import export_to_excel

                    export_to_excel(results_model, str(out_path))
                    if not quiet:
                        print(f"{Fore.GREEN}[Éxito]{Style.RESET_ALL} Reporte Excel guardado correctamente.")
                else:
                    if not quiet:
                        print(f"\n{Fore.BLUE}[Exportador]{Style.RESET_ALL} Guardando estructura JSON en: {out_path}...")
                    out_path.parent.mkdir(parents=True, exist_ok=True)
                    with open(out_path, "w", encoding="utf-8") as f:
                        json.dump(results_model.model_dump(), f, indent=2, ensure_ascii=False)
                    if not quiet:
                        print(f"{Fore.GREEN}[Éxito]{Style.RESET_ALL} Archivo JSON exportado correctamente.")

        # 4. Modo Quiet: Escribir el JSON crudo en stdout
        if quiet:
            # Imprimir el modelo validado como string de JSON en stdout para canalización
            print(results_model.model_dump_json(indent=2))

    except Exception as e:
        if not quiet:
            import traceback

            print(f"\n{Fore.RED}[Error Crítico]{Style.RESET_ALL} Ocurrió un fallo general en la ejecución:")
            print(f"{Fore.RED}{str(e)}")
            traceback.print_exc()
        else:
            print(json.dumps({"error": str(e)}))
        sys.exit(1)


def main():
    app()


if __name__ == "__main__":
    main()
