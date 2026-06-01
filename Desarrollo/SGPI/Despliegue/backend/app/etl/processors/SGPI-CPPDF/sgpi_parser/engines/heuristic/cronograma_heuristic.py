import re
from typing import Optional
from sgpi_parser.core.base_parser import BaseParser
from sgpi_parser.core.models import Cronograma, MetadataCronograma, ActividadCronograma
from sgpi_parser.utils.pdf_utils import get_plumber_doc, extract_raw_text_fitz
from sgpi_parser.utils.string_utils import clean_text, parse_spanish_date_range

class HeuristicCronogramaParser(BaseParser):
    """
    Parser heurístico local y offline para Cronogramas de Convocatorias del SGPI.
    """
    
    def __init__(self, default_year: Optional[int] = None):
        self.default_year = default_year

    def parse(self, pdf_path: str) -> Cronograma:
        # 1. Extraer metadatos generales (Nombre del programa y Año académico)
        raw_text = extract_raw_text_fitz(pdf_path)
        text_lines = [line.strip() for line in raw_text.split('\n') if line.strip()]
        
        # Intentar extraer el año
        detected_year = self.default_year
        if not detected_year:
            # Buscar el primer año de 4 dígitos entre 2017 y 2030
            for line in text_lines:
                year_match = re.search(r'\b(20[12]\d)\b', line)
                if year_match:
                    detected_year = int(year_match.group(1))
                    break
        if not detected_year:
            import datetime
            detected_year = datetime.datetime.now().year

        # Intentar extraer el nombre del programa (buscando la línea más relevante con puntuación)
        programa_nombre = ""
        best_line_idx = -1
        best_score = -999999
        
        for idx, line in enumerate(text_lines):
            lower_line = line.lower()
            # Skip noise
            if "fecha" in lower_line or "detalle" in lower_line or "actividad" in lower_line or "dependencia" in lower_line:
                continue
            
            score = 0
            # Exclude activity-like lines
            if any(line.strip().startswith(bullet) for bullet in ["", "\uf076", "•", "*", "-", "·"]):
                score -= 500
            if any(exclude in lower_line for exclude in [
                "inicio del", "término del", "duración del", "presentación de", "publicación de", 
                "registro en", "resultados de", "recepción de", "cierre de", "evaluación de", "vrip", "cronograma"
            ]):
                score -= 300
                
            # Prefer lines with strong keywords
            if "programa para" in lower_line or "programa de" in lower_line:
                score += 200
            elif "programa" in lower_line or "convocatoria" in lower_line or "concurso" in lower_line or "picv" in lower_line:
                score += 100
                
            # Add length of line divided by 2 as minor tie-breaker
            score += len(line) / 2.0
            
            if score > best_score:
                best_score = score
                best_line_idx = idx

        if best_line_idx != -1 and best_score > 0:
            # Let's see if we should join the next line
            parts = [text_lines[best_line_idx]]
            if best_line_idx + 1 < len(text_lines):
                next_line = text_lines[best_line_idx + 1]
                next_lower = next_line.lower()
                # If next line is not an activity, not a bullet, and looks like a
                # continuation (e.g. uppercase or contains years or parentheses)
                if (
                    len(next_line) > 5 and
                    not any(next_line.strip().startswith(bullet) for bullet in ["", "\uf076", "•", "*", "-", "·"]) and
                    not any(exclude in next_lower for exclude in ["inicio", "término", "fecha", "detalle", "cronograma", "dependencia"]) and
                    (next_line.isupper() or any(char.isdigit() for char in next_line) or "(" in next_line)
                ):
                    parts.append(next_line)
            
            programa_nombre = clean_text(" ".join(parts))
                
        if not programa_nombre:
            # Fallback a un nombre genérico con el año
            programa_nombre = f"Programa de Investigación de Convocatoria {detected_year}"

        # 2. Extraer actividades desde la tabla con pdfplumber
        actividades = []
        with get_plumber_doc(pdf_path) as pdf:
            for page in pdf.pages:
                tables = page.extract_tables()
                for table in tables:
                    if not table or len(table) < 2:
                        continue
                        
                    # 2.1 Encontrar la fila de cabecera en las primeras 3 filas
                    header_row_idx = 0
                    header_found = False
                    header = None
                    for idx, row in enumerate(table[:3]):
                        row_lower = [clean_text(str(cell)).lower() if cell is not None else "" for cell in row]
                        # Si contiene palabras claves que identifican cabecera
                        if any("actividad" in cell or "detalle" in cell or "concepto" in cell for cell in row_lower) or \
                           any("fecha" in cell or "plazo" in cell or "cronograma" in cell for cell in row_lower):
                            header_row_idx = idx
                            header = row
                            header_found = True
                            break
                    
                    if not header_found:
                        # Si no se encuentra explícitamente, usar la primera fila no vacía
                        for idx, row in enumerate(table[:3]):
                            if any(row):
                                header = row
                                header_row_idx = idx
                                break
                                
                    if not header:
                        header = table[0]
                        header_row_idx = 0
                        
                    # 2.2 Mapear columnas dinámicamente
                    col_actividad = 0
                    col_dependencia = None
                    col_fecha = 1
                    
                    header_lower = [clean_text(str(cell)).lower() if cell is not None else "" for cell in header]
                    
                    # Intentar encontrar la columna de Actividad
                    for idx, cell in enumerate(header_lower):
                        if "actividad" in cell or "detalle" in cell or "concepto" in cell:
                            col_actividad = idx
                            break
                    
                    # Intentar encontrar la columna de Fecha
                    for idx, cell in enumerate(header_lower):
                        if "fecha" in cell or "plazo" in cell or "cronograma" in cell:
                            col_fecha = idx
                            break
                    
                    # Intentar encontrar la columna de Dependencia / Responsable
                    for idx, cell in enumerate(header_lower):
                        if "dependencia" in cell or "responsable" in cell or "vrip" in cell:
                            col_dependencia = idx
                            break
                            
                    # Si no encontramos columna de fecha o coincide con actividad, y hay múltiples columnas
                    if col_fecha == col_actividad and len(header) >= 2:
                        remaining_indices = [i for i in range(len(header)) if i != col_actividad]
                        if col_dependencia in remaining_indices and len(remaining_indices) > 1:
                            col_fecha = [i for i in remaining_indices if i != col_dependencia][0]
                        else:
                            col_fecha = remaining_indices[-1]
                            
                    # 2.3 Procesar las filas de datos desde la cabecera
                    for row in table[header_row_idx + 1:]:
                        if not row:
                            continue
                            
                        # Si el row tiene menos elementos de los necesarios para las columnas mapeadas
                        max_mapped_idx = max(col_actividad, col_fecha, col_dependencia or 0)
                        if len(row) <= max_mapped_idx:
                            continue
                            
                        actividad_val = row[col_actividad]
                        fecha_val = row[col_fecha]
                        dep_val = row[col_dependencia] if col_dependencia is not None else None
                        
                        actividad_desc = clean_text(str(actividad_val)) if actividad_val is not None else ""
                        fecha_str = clean_text(str(fecha_val)) if fecha_val is not None else ""
                        dep_desc = clean_text(str(dep_val)) if dep_val is not None else ""
                        
                        # Si están completamente vacíos
                        if not actividad_desc and not fecha_str:
                            continue
                            
                        # Limpiar caracteres viñeta comunes como '\uf076', '', '*', '-', '•'
                        actividad_desc = re.sub(r'^[\uf076*•·\-\s]+', '', actividad_desc).strip()
                        
                        # Si quedó vacío o es idéntico a las cabeceras
                        if not actividad_desc or actividad_desc.lower() in ["detalle", "actividad", "actividades", "concepto"]:
                            continue
                            
                        # Convertir fechas
                        fecha_ini, fecha_fin = parse_spanish_date_range(fecha_str, default_year=detected_year)
                        
                        actividades.append(ActividadCronograma(
                            actividad=actividad_desc,
                            dependencia_responsable=dep_desc if dep_desc else None,
                            fecha_detalle=fecha_str,
                            fecha_inicio=fecha_ini,
                            fecha_fin=fecha_fin
                        ))

        # Crear el modelo final
        metadata = MetadataCronograma(
            programa_nombre=programa_nombre,
            anio_academico=detected_year
        )
        
        return Cronograma(
            tipo_documento="cronograma",
            metadata=metadata,
            actividades=actividades
        )
