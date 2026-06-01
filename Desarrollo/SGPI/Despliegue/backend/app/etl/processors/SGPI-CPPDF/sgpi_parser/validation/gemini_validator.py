import time
from pathlib import Path
import google.generativeai as genai
from pydantic import BaseModel

from sgpi_parser.config import settings
from sgpi_parser.core.detector import detect_pdf_type_and_year
from sgpi_parser.core.models import ResolucionRectoral, Cronograma, ResultadosConcurso


def clean_and_dereference_schema(schema: dict, defs: dict = None) -> dict:
    """
    Resuelve recursivamente referencias $ref y convierte restricciones 'const'
    a 'enum' para asegurar compatibilidad total con la API de Gemini (que no soporta $ref/const).
    """
    if defs is None:
        defs = schema.get("$defs", schema.get("definitions", {}))

    if isinstance(schema, dict):
        # 0. Resolver anyOf
        if "anyOf" in schema:
            any_of = schema.pop("anyOf")
            non_null_type = None
            for item in any_of:
                resolved_item = clean_and_dereference_schema(item, defs)
                if isinstance(resolved_item, dict) and resolved_item.get("type") != "null":
                    non_null_type = resolved_item
                    break
            if non_null_type:
                for k, v in non_null_type.items():
                    schema[k] = v
                schema["nullable"] = True

        # 1. Resolver $ref
        if "$ref" in schema:
            ref_path = schema["$ref"]
            ref_name = ref_path.split("/")[-1]
            if ref_name in defs:
                resolved = clean_and_dereference_schema(defs[ref_name], defs)
                # Conservar propiedades locales
                for k, v in schema.items():
                    if k != "$ref":
                        resolved[k] = v
                return resolved

        # 2. Convertir const a enum
        if "const" in schema:
            const_val = schema.pop("const")
            schema["type"] = "string"
            schema["enum"] = [const_val]

        # 3. Limpiar recursivamente todos los campos
        cleaned = {}
        for k, v in schema.items():
            if k in ["$defs", "definitions", "title", "additionalProperties", "default", "examples"]:
                continue
            cleaned[k] = clean_and_dereference_schema(v, defs)
        return cleaned

    elif isinstance(schema, list):
        return [clean_and_dereference_schema(item, defs) for item in schema]

    return schema


def generate_golden_dataset(pdf_path: str) -> BaseModel:
    """
    Sube el PDF a la API de Gemini (Multimodal) y extrae de forma 100% precisa
    la estructura de datos correspondiente según su tipo, asegurando que se
    ajuste al esquema Pydantic de salida. (Uso exclusivo en desarrollo).
    """
    if not settings.GEMINI_API_KEY:
        raise ValueError("Se requiere configurar GEMINI_API_KEY en el entorno o .env.")

    # 1. Detectar tipo localmente para determinar el esquema de respuesta
    category, year = detect_pdf_type_and_year(pdf_path)
    if not category:
        raise ValueError(f"No se pudo determinar la categoría del PDF {pdf_path} para validación.")

    # Mapear categoría a su clase de Pydantic
    if category == "cronograma":
        schema_class = Cronograma
        prompt = (
            "Eres un analista de datos experto en investigación universitaria. "
            "Analiza el PDF adjunto que contiene el Cronograma de Actividades de una convocatoria de investigación. "
            "Extrae todas las fases y actividades del cronograma. "
            "Para cada actividad, debes extraer la descripción de la actividad, "
            "la dependencia responsable (si se menciona), "
            "la fecha_detalle original exacta que aparece en el texto, y calcular/formatear de forma precisa "
            "la fecha_inicio y fecha_fin en formato 'YYYY-MM-DD'. Si la fecha es única (ej. 19 de noviembre de 2025), "
            "fecha_inicio y fecha_fin deben ser iguales."
        )
    elif category == "resultados":
        schema_class = ResultadosConcurso
        prompt = (
            "Eres un analista de datos experto en investigación universitaria. "
            "Analiza el PDF adjunto que contiene los Resultados del Concurso de Proyectos de Investigación. "
            "Extrae la lista completa de todos los proyectos aprobados que aparecen en las tablas del documento. "
            "Para cada proyecto, extrae el orden_merito (número), "
            "el título completo del proyecto (limpia los cortes de línea "
            "y hazlo continuo), el código de proyecto (si se menciona, ej. B2510001M), "
            "el nombre de GI (Grupo de Investigación), "
            "el investigador responsable (nombres completos), la facultad de origen, y el puntaje obtenido."
        )
    elif category == "resolucion":
        schema_class = ResolucionRectoral
        prompt = (
            "Eres un analista de datos experto en investigación universitaria. "
            "Analiza el PDF adjunto que es una Resolución Rectoral y sus Anexos de aprobación de proyectos. "
            "Extrae el número de resolución, la fecha de emisión y el año académico en los metadatos. "
            "Extrae la lista completa de todos los proyectos de investigación ganadores y la lista completa de "
            "sus integrantes o miembros participantes de las tablas del anexo. "
            "Para cada integrante, identifica claramente su rol "
            "(ej. Responsable, Co-responsable, Miembro docente, Tesista, etc.), "
            "su código de miembro, nombre completo, tipo de miembro (docente, estudiante, externo, etc.), facultad, "
            "código del grupo de investigación (gi_codigo) al que pertenece, "
            "y su condición en el GI (gi_condicion, ej. Titular, Adherente)."
        )
    else:
        raise ValueError(f"Categoría '{category}' no soportada para validación con IA.")

    # 2. Configurar la API de Gemini
    genai.configure(api_key=settings.GEMINI_API_KEY)

    # Sube el archivo PDF a través de la API File
    pdf_path_resolved = Path(pdf_path).resolve()
    print(f"[Gemini API] Subiendo {pdf_path_resolved.name}...")
    uploaded_file = genai.upload_file(str(pdf_path_resolved), mime_type="application/pdf")

    try:
        # Esperar a que el archivo esté procesado en la API si es necesario
        while uploaded_file.state.name == "PROCESSING":
            print("[Gemini API] Procesando archivo en el servidor...")
            time.sleep(2)
            uploaded_file = genai.get_file(uploaded_file.name)

        if uploaded_file.state.name == "FAILED":
            raise ValueError("El procesamiento del PDF en la API de Gemini falló.")

        print(f"[Gemini API] Enviando consulta con modelo: {settings.GEMINI_MODEL}...")
        model = genai.GenerativeModel(settings.GEMINI_MODEL)

        # Limpiar y resolver el esquema Pydantic para Gemini
        cleaned_schema = clean_and_dereference_schema(schema_class.model_json_schema())

        # Ejecutar generación con Structured Output
        response = model.generate_content(
            [uploaded_file, prompt],
            generation_config={
                "response_mime_type": "application/json",
                "response_schema": cleaned_schema,
                "temperature": 0.1,
            },
        )

        # Validar y cargar de vuelta con Pydantic para certificar la estructura
        parsed_json = response.text
        return schema_class.model_validate_json(parsed_json)

    finally:
        # Limpieza: eliminar el archivo subido de la API de Gemini
        print("[Gemini API] Limpiando archivo temporal del servidor...")
        try:
            genai.delete_file(uploaded_file.name)
        except Exception:
            pass
