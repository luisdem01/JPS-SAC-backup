import re
from typing import Optional, Dict
import fitz
from sgpi_parser.core.base_parser import BaseParser
from sgpi_parser.core.models import ResultadosConcurso, MetadataResultados, ProyectoAprobado
from sgpi_parser.utils.pdf_utils import get_plumber_doc, extract_raw_text_fitz, get_fitz_doc
from sgpi_parser.utils.string_utils import clean_text, extract_number, extract_integer

class HeuristicResultadosParser(BaseParser):
    """
    Parser heurístico local y offline para Resultados de Concursos del SGPI.
    """
    
    def __init__(self, default_year: Optional[int] = None):
        self.default_year = default_year

    def parse(self, pdf_path: str) -> ResultadosConcurso:
        # 1. Extraer metadatos generales
        raw_text = extract_raw_text_fitz(pdf_path)
        text_lines = [line.strip() for line in raw_text.split('\n') if line.strip()]
        
        # Intentar extraer el año académico
        detected_year = self.default_year
        if not detected_year:
            for line in text_lines[:15]:  # buscar en las primeras líneas
                year_match = re.search(r'\b(20[12]\d)\b', line)
                if year_match:
                    detected_year = int(year_match.group(1))
                    break
        if not detected_year:
            import datetime
            detected_year = datetime.datetime.now().year

        # Intentar extraer el nombre de la convocatoria
        programa_nombre = ""
        # Buscar en todas las líneas de la primera página
        keywords = ["resultados del concurso", "programa para", "proyectos de investigación", "programa de"]
        for line in text_lines:
            lower_line = line.lower()
            if any(kw in lower_line for kw in keywords) and len(line) > 15:
                # Limpiar prefijos comunes para obtener el nombre del programa
                clean_line = clean_text(line)
                clean_line = re.sub(r'^(?:resultados\s+del\s+concurso\s+del\s+|resultados\s+del\s+concurso\s+de\s+|resultados\s+del\s+)', '', clean_line, flags=re.IGNORECASE)
                programa_nombre = clean_line.strip()
                break
                
        if not programa_nombre:
            # Fallback a palabras clave menos restrictivas en cualquier línea
            keywords_backup = ["resultados", "proyectos", "aprobados", "ganadores", "concurso", "evaluación"]
            for line in text_lines:
                lower_line = line.lower()
                if any(kw in lower_line for kw in keywords_backup) and len(line) > 15:
                    programa_nombre = clean_text(line)
                    break
                    
        if not programa_nombre:
            programa_nombre = f"Concurso de Proyectos de Investigación - Año {detected_year}"

        # 2. Extraer proyectos aprobados desde las tablas
        proyectos_aprobados = []
        
        fitz_doc = get_fitz_doc(pdf_path)
        
        with get_plumber_doc(pdf_path) as pdf:
            for page in pdf.pages:
                fitz_page = fitz_doc[page.page_number - 1]
                tables = page.find_tables()
                for table_obj in tables:
                    table_rows = []
                    for row_obj in table_obj.rows:
                        row_cells = []
                        for cell in row_obj.cells:
                            if cell is None:
                                row_cells.append("")
                            else:
                                rect = fitz.Rect(cell[0], cell[1], cell[2], cell[3])
                                rect = rect + (-1, -1, 1, 1)
                                text = fitz_page.get_text("text", clip=rect).strip()
                                text = text.replace("\n", " ")
                                text = re.sub(r'\s+', ' ', text)
                                row_cells.append(text)
                        table_rows.append(row_cells)
                        
                    if not table_rows or len(table_rows) < 2:
                        continue
                        
                    # Buscar cabecera de la tabla
                    header = table_rows[0]
                    
                    # Mapa de columnas a índices
                    col_map: Dict[str, int] = {
                        "orden_merito": -1,
                        "titulo": -1,
                        "codigo_proyecto": -1,
                        "responsable": -1,
                        "facultad": -1,
                        "nombre_gi": -1,
                        "puntaje": -1
                    }
                    
                    # Mapear nombres de columnas con coincidencia difusa
                    for idx, col_name in enumerate(header):
                        if not col_name:
                            continue
                        col_clean = str(col_name).strip().lower()
                        
                        # Buscar correspondencia
                        if col_clean in ["n°", "n", "nro", "orden", "puesto"] or "merito" in col_clean or "mérito" in col_clean:
                            col_map["orden_merito"] = idx
                        elif "titulo" in col_clean or "tïtulo" in col_clean or "proyecto" in col_clean:
                            col_map["titulo"] = idx
                        elif "codigo" in col_clean or "código" in col_clean:
                            col_map["codigo_proyecto"] = idx
                        elif "responsable" in col_clean or "investigador" in col_clean or "docente" in col_clean:
                            col_map["responsable"] = idx
                        elif "facultad" in col_clean or "fac." in col_clean:
                            col_map["facultad"] = idx
                        elif "gi" in col_clean or "grupo" in col_clean:
                            col_map["nombre_gi"] = idx
                        elif "puntaje" in col_clean or "puntos" in col_clean or "nota" in col_clean or "total" in col_clean:
                            col_map["puntaje"] = idx

                    # Si no encontramos al menos la columna del título, es posible que el header
                    # no sea la fila 0, o que la tabla no sea válida.
                    if col_map["titulo"] == -1:
                        # Fallback a un mapa de índices por defecto basado en una tabla estándar
                        # N°, Título, Responsable, Facultad, GI, [Puntaje]
                        if len(header) >= 5:
                            col_map["orden_merito"] = 0
                            col_map["titulo"] = 1
                            col_map["responsable"] = 2
                            col_map["facultad"] = 3
                            col_map["nombre_gi"] = 4
                            if len(header) >= 6:
                                col_map["puntaje"] = 5
                        else:
                            continue # No se puede procesar esta tabla de forma confiable

                    # Procesar filas de datos
                    for row in table_rows[1:]:
                        # Ignorar si es una cabecera repetida en otra página
                        if any(clean_text(str(cell)).lower() in ["n°", "tïtulo del proyecto", "responsable"] for cell in row):
                            continue
                            
                        # Extraer campos
                        def get_field(key: str) -> Optional[str]:
                            idx = col_map[key]
                            if idx != -1 and idx < len(row) and row[idx] is not None:
                                return clean_text(str(row[idx]))
                            return None

                        titulo = get_field("titulo")
                        if not titulo or len(titulo) < 5 or titulo.lower() in ["tïtulo del proyecto", "titulo"]:
                            continue  # Fila inválida
                            
                        orden_str = get_field("orden_merito")
                        orden_merito = extract_integer(orden_str) if orden_str else None
                        
                        codigo_proyecto = get_field("codigo_proyecto")
                        responsable = get_field("responsable")
                        facultad = get_field("facultad")
                        nombre_gi = get_field("nombre_gi")
                        
                        puntaje_str = get_field("puntaje")
                        puntaje = extract_number(puntaje_str) if puntaje_str else None

                        proyectos_aprobados.append(ProyectoAprobado(
                            orden_merito=orden_merito,
                            titulo=titulo,
                            codigo_proyecto=codigo_proyecto,
                            nombre_gi=nombre_gi,
                            responsable=responsable,
                            facultad=facultad,
                            puntaje=puntaje
                        ))

        # Crear el modelo final
        metadata = MetadataResultados(
            programa_nombre=programa_nombre,
            anio_academico=detected_year
        )
        
        return ResultadosConcurso(
            tipo_documento="resultados",
            metadata=metadata,
            proyectos_aprobados=proyectos_aprobados
        )
