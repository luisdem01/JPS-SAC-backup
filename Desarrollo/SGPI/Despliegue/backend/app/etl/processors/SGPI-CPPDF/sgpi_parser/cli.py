import sys
import json
from pathlib import Path
from typing import Optional
import typer

app = typer.Typer(
    name="sgpi-parser",
    help="CLI adaptativo y local para extraer información estructurada de PDFs de investigación de la FISI-UNMSM.",
    no_args_is_help=True,
)


@app.command("parse")
def parse(
    pdf_path: str = typer.Argument(..., help="Ruta al archivo PDF a parsear."),
    output: Optional[str] = typer.Option(
        None, "--output", "-o", help="Ruta de destino para guardar el archivo procesado (JSON o Excel)."
    ),
    format_type: str = typer.Option("json", "--format", "-f", help="Formato de salida deseado: 'json' o 'excel'."),
    quiet: bool = typer.Option(
        False, "--quiet", "-q", help="Silencia mensajes informativos y solo envía el resultado JSON a stdout."
    ),
    category: Optional[str] = typer.Option(
        None,
        "--category",
        "-c",
        help="Forzar una categoría de documento específica: 'resolucion', 'cronograma' o 'resultados'.",
    ),
    year: Optional[int] = typer.Option(None, "--year", "-y", help="Forzar el año académico del documento (ej. 2025)."),
):
    """
    Parsea un documento PDF de forma local e offline, extrayendo datos estructurados a JSON o Excel Premium.
    """
    try:
        # Resolver ruta absoluta
        pdf_path_resolved = Path(pdf_path).resolve()
        if not pdf_path_resolved.exists():
            if not quiet:
                typer.echo(f"Error: El archivo {pdf_path} no existe.", err=True)
            sys.exit(1)

        if not quiet:
            typer.echo(f"Procesando: {pdf_path_resolved.name} ...")

        # IMPORTACIONES DENTRO DEL COMANDO para evitar importaciones circulares y fallos rápidos
        from sgpi_parser.core.detector import detect_pdf_type_and_year
        from sgpi_parser.engines.heuristic.cronograma_heuristic import HeuristicCronogramaParser
        from sgpi_parser.engines.heuristic.resultados_heuristic import HeuristicResultadosParser
        from sgpi_parser.engines.heuristic.rr_heuristic import HeuristicRRParser
        from sgpi_parser.core.exporter import export_data

        # 1. Detección automática (si no se especifica override)
        detected_category, detected_year = detect_pdf_type_and_year(str(pdf_path_resolved))

        final_category = category.lower() if category else detected_category
        final_year = year if year else detected_year

        if not final_category:
            if not quiet:
                typer.echo(
                    "Error: No se pudo auto-detectar el tipo de documento. Por favor, especifícalo con --category",
                    err=True,
                )
            sys.exit(1)

        if not quiet:
            typer.echo(f"Categoría: {final_category.upper()} | Año: {final_year or 'No detectado'}")

        # 2. Selección de motor heurístico
        if final_category == "cronograma":
            parser = HeuristicCronogramaParser(default_year=final_year)
        elif final_category == "resultados":
            parser = HeuristicResultadosParser(default_year=final_year)
        elif final_category == "resolucion":
            parser = HeuristicRRParser(default_year=final_year)
        else:
            if not quiet:
                typer.echo(f"Error: Categoría '{final_category}' no reconocida.", err=True)
            sys.exit(1)

        # 3. Extracción
        parsed_model = parser.parse(str(pdf_path_resolved))

        # 4. Exportación
        export_data(model=parsed_model, output_path=output, format_type=format_type.lower(), quiet=quiet)

    except Exception as e:
        if not quiet:
            import traceback

            typer.echo(f"Error crítico durante el procesamiento: {str(e)}", err=True)
            traceback.print_exc()
        else:
            # En modo quiet, retornar un JSON con el error para no romper la canalización
            print(json.dumps({"error": str(e)}))
        sys.exit(1)


@app.command("validate")
def validate(
    pdf_path: str = typer.Argument(..., help="Ruta al archivo PDF a validar."),
    output_golden: Optional[str] = typer.Option(
        None, "--output-golden", "-g", help="Ruta para guardar el JSON dorado generado por Gemini."
    ),
    run_benchmark: bool = typer.Option(
        True, "--benchmark/--no-benchmark", help="Ejecutar comparación Heurística vs IA."
    ),
):
    """
    [Desarrollo / QA] Valida el parser heurístico local comparándolo contra la API de Gemini (requiere GEMINI_API_KEY).
    """
    from sgpi_parser.config import settings

    if not settings.GEMINI_API_KEY:
        typer.echo(
            "Error: Se requiere configurar GEMINI_API_KEY en el entorno "
            "o en un archivo .env para este comando de desarrollo.",
            err=True,
        )
        sys.exit(1)

    typer.echo("Iniciando suite de validación con Gemini...")
    try:
        from sgpi_parser.validation.gemini_validator import generate_golden_dataset
        from sgpi_parser.validation.test_benchmark import run_accuracy_comparison

        # 1. Generar dataset dorado usando Gemini
        typer.echo("Generando extracción dorada mediante Gemini API...")
        golden_model = generate_golden_dataset(pdf_path)

        # Guardar si se solicita
        if output_golden:
            golden_path = Path(output_golden)
            golden_path.parent.mkdir(parents=True, exist_ok=True)
            with open(golden_path, "w", encoding="utf-8") as f:
                f.write(golden_model.model_dump_json(indent=2))
            typer.echo(f"Dataset dorado guardado en: {golden_path}")

        # 2. Ejecutar benchmark comparativo
        if run_benchmark:
            typer.echo("Ejecutando benchmark heurística vs IA...")
            run_accuracy_comparison(pdf_path, golden_model)

    except Exception as e:
        typer.echo(f"Error en validación: {str(e)}", err=True)
        import traceback

        traceback.print_exc()
        sys.exit(1)


def main():
    app()


if __name__ == "__main__":
    main()
