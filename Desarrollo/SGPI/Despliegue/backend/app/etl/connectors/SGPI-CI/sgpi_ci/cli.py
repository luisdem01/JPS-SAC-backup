import json
import sys

import typer

try:
    from colorama import Fore, Style, init as colorama_init
    colorama_init(autoreset=True)
    _COLOR = True
except ImportError:
    _COLOR = False

app = typer.Typer(
    name="sgpi-ci",
    help=(
        "Importador ETL Multientidad — SGPI FISI-UNMSM\n\n"
        "Casos de Uso: CU02 (importación masiva con validación y resolución de conflictos)"
    ),
    no_args_is_help=True,
)

# ---------------------------------------------------------------------------
# Utilidades de presentación
# ---------------------------------------------------------------------------

def _banner() -> None:
    if _COLOR:
        print("=" * 72)
        print(f" {Fore.YELLOW}{Style.BRIGHT}SGPI-CI v2.0  —  Importador ETL Multientidad{Style.RESET_ALL}")
        print(f" {Fore.CYAN}Sistema de Gestión de Proyectos de Investigación · FISI-UNMSM{Style.RESET_ALL}")
        print("=" * 72)
    else:
        print("=" * 72)
        print(" SGPI-CI v2.0  —  Importador ETL Multientidad")
        print(" SGPI FISI-UNMSM")
        print("=" * 72)

# ---------------------------------------------------------------------------
# Comando: import
# ---------------------------------------------------------------------------

@app.command("import")
def import_cmd(
    file: str = typer.Argument(
        ...,
        help="Ruta al archivo de datos (.xlsx o .csv).",
    ),
    quiet: bool = typer.Option(
        False, "--quiet", "-q",
        help="Solo imprime el JSON final a stdout. Ideal para integración con la API.",
    ),
):
    """
    Importa datos masivos al SGPI, enriqueciendo con RENACYT.
    """
    if not quiet:
        _banner()

    try:
        from sgpi_ci.core.processor import EtlProcessor
        import asyncio
        processor = EtlProcessor(file_path=file)
        res = asyncio.run(processor.process(upload_to_db=True))
        if quiet:
            print(json.dumps(res))
        else:
            print(json.dumps(res, indent=2, ensure_ascii=False))
            
    except SystemExit:
        raise
    except Exception as e:
        if not quiet:
            import traceback
            typer.echo(f"\nError inesperado: {e}", err=True)
            traceback.print_exc()
        else:
            print(json.dumps({"status": "error", "message": str(e)}))
        sys.exit(1)


# ---------------------------------------------------------------------------
# Comando: preview  (Dry-Run)
# ---------------------------------------------------------------------------

@app.command("preview")
def preview_cmd(
    file: str = typer.Argument(
        ...,
        help="Ruta al archivo de datos (.xlsx o .csv).",
    ),
    quiet: bool = typer.Option(
        False, "--quiet", "-q",
        help="Solo imprime el JSON de diagnóstico.",
    ),
):
    """
    [Dry-Run] Previsualiza la extracción y enriquecimiento SIN persistir datos en BD.
    """
    if not quiet:
        _banner()
        if _COLOR:
            typer.echo(f"\n{Fore.YELLOW}MODO PREVIEW — No se escribirá nada en la base de datos.{Style.RESET_ALL}\n")
        else:
            typer.echo("\nMODO PREVIEW — No se escribirá nada en la base de datos.\n")

    try:
        from sgpi_ci.core.processor import EtlProcessor
        import asyncio
        processor = EtlProcessor(file_path=file)
        res = asyncio.run(processor.process(upload_to_db=False))
        if quiet:
            print(json.dumps(res))
        else:
            print(json.dumps(res, indent=2, ensure_ascii=False))
            
    except SystemExit:
        raise
    except Exception as e:
        if not quiet:
            import traceback
            typer.echo(f"\nError inesperado: {e}", err=True)
            traceback.print_exc()
        else:
            print(json.dumps({"status": "error", "message": str(e)}))
        sys.exit(1)


# ---------------------------------------------------------------------------
# Punto de entrada
# ---------------------------------------------------------------------------

def main() -> None:
    app()

if __name__ == "__main__":
    main()
