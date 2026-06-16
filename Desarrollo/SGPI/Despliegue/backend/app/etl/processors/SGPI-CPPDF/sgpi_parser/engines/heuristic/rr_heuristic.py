import re
from typing import Optional, List, Dict, Any
from sgpi_parser.core.base_parser import BaseParser
from sgpi_parser.core.models import ResolucionRectoral, MetadataRR, ProyectoRR, Integrante
from sgpi_parser.utils.pdf_utils import get_fitz_doc, is_page_scanned, extract_page_text_ocr, extract_page_words_ocr
from sgpi_parser.utils.string_utils import clean_text, extract_number

# Listado de roles válidos para filtrado
ROLES_VALIDOS = [
    "responsable",
    "co responsable",
    "co-responsable",
    "miembro docente",
    "tesista",
    "gestor administrativo",
    "colaborador",
    "colaborador externo",
    "asesor",
    "miembro del vrip",
    "coordinador",
    "miembro",
    "estudiante",
    "miembro externo",
    "miembro externo internacional",
]


def is_member_code(token: str) -> bool:
    """Valida si un token tiene el formato de código de docente (6-7 chars) o estudiante (8 chars)."""
    token = token.strip()
    if len(token) not in [6, 7, 8]:
        return False
    if len(token) == 8 and token.isdigit():
        return True
    if len(token) in [6, 7] and any(c.isdigit() for c in token):
        return True
    return False


class HeuristicRRParser(BaseParser):
    """
    Parser heurístico local y offline para Resoluciones Rectorales y sus Anexos tabulares.
    """

    def __init__(self, default_year: Optional[int] = None):
        self.default_year = default_year

    def parse(self, pdf_path: str) -> ResolucionRectoral:
        # 1. Extraer metadatos globales del documento completo
        doc = get_fitz_doc(pdf_path)

        numero_resolucion = ""
        fecha_emision = None
        anio_academico = self.default_year
        facultad_detectada = None
        area_detectada = None

        # Escanear las primeras páginas para metadatos rectorales
        # (únicamente páginas 0 y 1 para evitar fechas de reportes)
        for p_idx in range(min(2, len(doc))):
            page = doc[p_idx]
            if is_page_scanned(page):
                try:
                    text = extract_page_text_ocr(page)
                except Exception:
                    text = page.get_text()
            else:
                text = page.get_text()

            # Buscar número de resolución rectoral
            # Buscar todos en la primera página para tomar el último (que es el real, no los históricos citados antes)
            rr_matches = re.findall(
                r"\b(?:R\.?R\.?|RESOLUCIÓN RECTORAL)\b\s*(?:N°|N.º)?\s*"
                r"(\d{5,6}[_-](?:R[_-])?\d{2,4}[_-]?R?(?:/UNMSM)?)",
                text,
                re.IGNORECASE,
            )
            if rr_matches:
                numero_resolucion = rr_matches[-1].replace(" ", "_")

            # Buscar fecha de emisión
            # 1. Buscar en formato texto: Lima, 15 de Diciembre del 2025
            date_text_match = re.search(r"Lima,\s*(\d{1,2})\s*de\s*([A-Za-z]+)\s*del?\s*(20\d{2})", text, re.IGNORECASE)
            if date_text_match:
                day = int(date_text_match.group(1))
                month_str = date_text_match.group(2).lower()
                year_str = date_text_match.group(3)
                month = {
                    "enero": "01",
                    "febrero": "02",
                    "marzo": "03",
                    "abril": "04",
                    "mayo": "05",
                    "junio": "06",
                    "julio": "07",
                    "agosto": "08",
                    "septiembre": "09",
                    "setiembre": "09",
                    "octubre": "10",
                    "noviembre": "11",
                    "diciembre": "12",
                }.get(month_str, "01")
                fecha_emision = f"{year_str}-{month}-{day:02d}"

            # 2. Buscar en formato digital signature Fecha: 15.12.2025
            if not fecha_emision:
                fecha_match = re.search(r"Fecha:\s*(\d{2})[./](\d{2})[./](\d{4})", text, re.IGNORECASE)
                if fecha_match:
                    day, month, year_str = fecha_match.groups()
                    fecha_emision = f"{year_str}-{month}-{day}"

            # Buscar año académico
            if not anio_academico:
                year_match = re.search(r"\b(20[12]\d)\b", text)
                if year_match:
                    anio_academico = int(year_match.group(1))

            # Buscar Facultad (si se menciona)
            # Ej: "Facultad: Ingeniería de Sistemas e Informática"
            fac_match = re.search(r"Facultad:\s*([A-Za-z\s]+)(?:\n|$)", text, re.IGNORECASE)
            if fac_match and not facultad_detectada:
                facultad_detectada = fac_match.group(1).strip()

            # Buscar Área (si se menciona)
            area_match = re.search(r"Área:\s*([A-Za-z\s]+)(?:\n|$)", text, re.IGNORECASE)
            if area_match and not area_detectada:
                area_detectada = area_match.group(1).strip()

        # Fallbacks si no se encontró en el texto
        if not numero_resolucion:
            # Intentar del nombre del archivo
            file_name = pdf_path.split("\\")[-1].split("/")[-1]
            name_match = re.search(r"(?:RR[_-])?(\d{5,6}[_-]\d{4}[_-]R)", file_name, re.IGNORECASE)
            if name_match:
                numero_resolucion = name_match.group(1)
            else:
                numero_resolucion = "SIN_NUMERO"

        if not anio_academico:
            import datetime

            anio_academico = datetime.datetime.now().year

        # 2. Procesamiento de páginas para proyectos y miembros
        proyectos: List[ProyectoRR] = []

        project_code_regex = r"\b([A-Z]\d{7,8}[A-Z]?)\b"

        current_project: Optional[Dict[str, Any]] = None
        current_role: Optional[str] = None
        last_added_member: Optional[Dict[str, Any]] = None

        for p_idx in range(len(doc)):
            page = doc[p_idx]
            scanned = is_page_scanned(page)
            if scanned:
                try:
                    text = extract_page_text_ocr(page)
                except Exception:
                    text = page.get_text()
            else:
                text = page.get_text()

            # Solo procesar páginas de Anexos (que contienen tablas de miembros)
            if not ("Apellidos" in text or "Condición" in text or "Miembro" in text):
                continue

            if scanned:
                try:
                    words = extract_page_words_ocr(page)
                except Exception:
                    words = page.get_text("words")
            else:
                words = page.get_text("words")

            if not words:
                continue

            # A. Agrupar palabras por Y (tolerancia de 6 puntos) para formar líneas físicas
            lines = []
            for w in words:
                x0, y0, x1, _, word = w[0], w[1], w[2], w[3], w[4]
                found = False
                for line in lines:
                    if abs(line["y"] - y0) < 6:
                        line["words"].append((x0, x1, y0, word))
                        # Actualizar la y promedio
                        line["y"] = (line["y"] * len(line["words"]) + y0) / (len(line["words"]) + 1)
                        found = True
                        break
                if not found:
                    lines.append({"y": y0, "words": [(x0, x1, y0, word)]})

            lines.sort(key=lambda x: x["y"])

            # B. Procesar las líneas de la página de forma secuencial
            for line_data in lines:
                line_words = line_data["words"]
                line_words.sort(key=lambda x: x[0])
                line_str = " ".join(w[3] for w in line_words)

                # Ignorar cabeceras institucionales u horarios redundantes del RAIS
                if any(
                    k in line_str
                    for k in [
                        "Universidad Nacional",
                        "Vicerrectorado",
                        "Hora:",
                        "Usuario:",
                        "Fecha:",
                        "©RAIS",
                        "Firmado digitalmente",
                    ]
                ):
                    found_role = None
                    for r in [
                        "Asesor",
                        "Estudiante",
                        "Responsable",
                        "Co-responsable",
                        "Co responsable",
                        "Miembro docente",
                    ]:
                        if r in line_str:
                            found_role = r
                            break
                    if found_role:
                        line_str = found_role
                    else:
                        continue

                # Si vemos una cabecera de proyectos, resetear el proyecto activo para evitar polución de integrantes
                if any(h in line_str for h in ["Nro", "Código", "Título del proyecto", "Presupuesto"]):
                    current_project = None
                    last_added_member = None
                    continue

                # Detectar si es una línea de proyecto (contiene un código de proyecto)
                proj_match = re.search(project_code_regex, line_str)
                if proj_match and not any(
                    h in line_str for h in ["Nro", "Código", "Título del proyecto", "Presupuesto"]
                ):
                    # Creamos un nuevo proyecto
                    code = proj_match.group(1)

                    # Extraer presupuesto (monto float al final de la línea)
                    budget = None
                    # Buscar patrones de números con comas/puntos decimales en esta línea o vecinas (rango de Y +/- 10)
                    num_matches = re.findall(r"\b\d{1,3}(?:,\d{3})*(?:\.\d{2})?\b", line_str)
                    for n_str in reversed(num_matches):
                        if "." in n_str or "," in n_str:
                            budget = extract_number(n_str)
                            break

                    if budget is None:
                        for other_line in lines:
                            if abs(other_line["y"] - line_data["y"]) <= 10.0:
                                other_words = other_line["words"]
                                other_words.sort(key=lambda x: x[0])
                                other_str = " ".join(w[3] for w in other_words)
                                if any(
                                    h in other_str
                                    for h in [
                                        "Nro",
                                        "Código",
                                        "Título del proyecto",
                                        "Presupuesto",
                                        "Condición",
                                        "Apellidos y nombres",
                                    ]
                                ):
                                    continue
                                num_matches = re.findall(r"\b\d{1,3}(?:,\d{3})*(?:\.\d{2})?\b", other_str)
                                for n_str in reversed(num_matches):
                                    if "." in n_str or "," in n_str:
                                        budget = extract_number(n_str)
                                        break
                                if budget is not None:
                                    break

                    # Encontrar todas las líneas en la misma página que pertenecen
                    # al bloque del título (rango de Y +/- 10)
                    title_lines = []
                    for other_line in lines:
                        other_y = other_line["y"]
                        if abs(other_y - line_data["y"]) <= 10.0:
                            other_words = other_line["words"]
                            other_words.sort(key=lambda x: x[0])
                            other_str = " ".join(w[3] for w in other_words)

                            # Ignorar cabeceras y redundancias
                            if any(
                                k in other_str
                                for k in [
                                    "Universidad Nacional",
                                    "Vicerrectorado",
                                    "Hora:",
                                    "Usuario:",
                                    "Fecha:",
                                    "©RAIS",
                                    "Firmado digitalmente",
                                ]
                            ):
                                continue
                            if any(
                                h in other_str
                                for h in [
                                    "Nro",
                                    "Código",
                                    "Título del proyecto",
                                    "Presupuesto",
                                    "Condición",
                                    "Apellidos y nombres",
                                ]
                            ):
                                continue

                            title_lines.append((other_y, other_words))

                    # Ordenar por Y de arriba a abajo
                    title_lines.sort(key=lambda x: x[0])

                    # Extraer y concatenar las palabras de las líneas limpiando código, orden y presupuesto
                    title_parts = []
                    for _, words_in_line in title_lines:
                        line_tokens = []
                        for w in words_in_line:
                            w_text = w[3]
                            if w_text == code:
                                continue
                            if w_text.isdigit() and len(w_text) < 4:
                                continue
                            if budget and str(int(budget)) in w_text.replace(",", ""):
                                continue
                            if w_text in ["S/", "S", "/"]:
                                continue
                            line_tokens.append(w_text)

                        part_str = " ".join(line_tokens).strip()
                        if part_str:
                            title_parts.append(part_str)

                    full_title = " ".join(title_parts)
                    full_title = re.sub(r"^\s*S/\s*", "", full_title)
                    full_title = re.sub(r"\s*S/\s*$", "", full_title)
                    full_title = clean_text(full_title)

                    current_project = {
                        "codigo_proyecto": code,
                        "titulo": full_title,
                        "presupuesto": budget,
                        "nombre_gi": None,
                        "integrantes": [],
                    }
                    proyectos.append(current_project)
                    current_role = None
                    last_added_member = None
                    continue

                # Si tenemos un proyecto activo, procesar su contenido
                if current_project:
                    # Detectar si llegamos a la cabecera de la tabla de integrantes
                    if "Condición" in line_str or "Apellidos" in line_str:
                        continue

                    # Verificar si la línea es un indicador de Rol / Condición en el proyecto
                    clean_line = line_str.lower().strip()
                    if any(clean_line == role or clean_line.startswith(role) for role in ROLES_VALIDOS):
                        # Guardar el rol actual
                        current_role = line_str.strip()
                        last_added_member = None
                        continue

                    # Utilizar el gap-based splitter para dividir la línea en celdas visuales
                    cells = []
                    current_cell = []
                    prev_w = None
                    for w in line_words:
                        x0, x1, y0, text = w[0], w[1], w[2], w[3]
                        if prev_w and (x0 - prev_w[1]) > 8:  # gap de más de 8 puntos
                            current_cell.sort(key=lambda item: (item[2], item[0]))
                            cells.append(
                                {
                                    "x0": current_cell[0][0],
                                    "x1": current_cell[-1][1],
                                    "text": " ".join(item[3] for item in current_cell),
                                }
                            )
                            current_cell = [w]
                        else:
                            current_cell.append(w)
                        prev_w = w
                    if current_cell:
                        current_cell.sort(key=lambda item: (item[2], item[0]))
                        cells.append(
                            {
                                "x0": current_cell[0][0],
                                "x1": current_cell[-1][1],
                                "text": " ".join(item[3] for item in current_cell),
                            }
                        )

                    if not cells:
                        continue

                    # Detectar si la línea representa a un integrante (empieza con código)
                    first_cell_text = cells[0]["text"]
                    if is_member_code(first_cell_text) or (len(cells) > 1 and is_member_code(cells[1]["text"])):
                        # Si el código está en la celda 1 en lugar de 0 (por alineación visual), rotar
                        if not is_member_code(first_cell_text) and is_member_code(cells[1]["text"]):
                            # Esto puede pasar si el rol está en la celda 0
                            role_from_cell = cells[0]["text"]
                            if any(role_from_cell.lower() in r for r in ROLES_VALIDOS):
                                current_role = role_from_cell
                            cells = cells[1:]
                            first_cell_text = cells[0]["text"]

                        # Mapear celdas al Integrante
                        # 2025: Código, Nombre, Tipo, Facultad, GI, Condición GI (6 celdas)
                        # 2024: Código, Nombre, Tipo (Rol), Facultad, Condición GI (5 celdas)
                        member_code = first_cell_text
                        nombre = cells[1]["text"] if len(cells) > 1 else ""
                        tipo = cells[2]["text"] if len(cells) > 2 else None
                        facultad = cells[3]["text"] if len(cells) > 3 else None

                        gi_codigo = None
                        gi_condicion = None

                        if len(cells) == 5:
                            # 2024: No hay gi_codigo en la tabla, el 5to elemento es la condición en GI
                            gi_condicion = cells[4]["text"]
                        elif len(cells) >= 6:
                            # 2025: Cabecera con GI y Condición GI
                            gi_codigo = cells[4]["text"]
                            gi_condicion = cells[5]["text"]

                        # Si no hay rol explícito en la cabecera, usar el "tipo" como rol si coincide
                        member_role = current_role
                        if not member_role and tipo and any(tipo.lower() in r for r in ROLES_VALIDOS):
                            member_role = tipo

                        if tipo and "estudiante" in tipo.lower():
                            if not member_role or member_role in [
                                "Asesor",
                                "Responsable",
                                "Co-responsable",
                                "Co responsable",
                                "Miembro docente",
                                "Integrante",
                            ]:
                                member_role = "Estudiante"

                        # Crear integrante
                        member = {
                            "codigo_miembro": member_code,
                            "nombre_completo": nombre,
                            "tipo_miembro": tipo,
                            "rol_proyecto": member_role or "Integrante",
                            "facultad": facultad,
                            "gi_codigo": gi_codigo,
                            "gi_condicion": gi_condicion,
                            # Guardar las posiciones X de cada celda mapeada para manejar envolturas
                            "_col_positions": [(c["x0"], c["x1"]) for c in cells],
                        }

                        current_project["integrantes"].append(member)
                        last_added_member = member

                        # Extraer GI global si no se ha detectado y se encuentra en la tabla
                        if gi_codigo and not current_project["nombre_gi"]:
                            current_project["nombre_gi"] = gi_codigo

                    elif last_added_member and len(line_str) > 2:
                        # Representa una envoltura de fila (wrapped row) del integrante anterior!
                        col_positions = last_added_member.get("_col_positions", [])

                        # Asociar cada celda de esta línea con las columnas del miembro anterior
                        for cell in cells:
                            cx0, cx1 = cell["x0"], cell["x1"]
                            cell_text = cell["text"]

                            # Buscar a qué columna del miembro se alinea
                            matched_idx = -1
                            min_dist = 999.0
                            for idx, (px0, px1) in enumerate(col_positions):
                                # Comprobar solapamiento horizontal
                                overlap = max(0, min(cx1, px1) - max(cx0, px0))
                                if overlap > 0:
                                    matched_idx = idx
                                    break
                                # Fallback a distancia mínima
                                dist = min(abs(cx0 - px0), abs(cx1 - px1))
                                if dist < min_dist:
                                    min_dist = dist
                                    matched_idx = idx

                            if matched_idx != -1 and min_dist < 20:  # tolerancia de 20 puntos
                                # Mapear al campo correspondiente de last_added_member
                                if matched_idx == 1:  # Nombre
                                    last_added_member["nombre_completo"] = clean_text(
                                        last_added_member["nombre_completo"] + " " + cell_text
                                    )
                                elif matched_idx == 2:  # Tipo
                                    last_added_member["tipo_miembro"] = clean_text(
                                        (last_added_member["tipo_miembro"] or "") + " " + cell_text
                                    )
                                elif matched_idx == 3:  # Facultad
                                    last_added_member["facultad"] = clean_text(
                                        (last_added_member["facultad"] or "") + " " + cell_text
                                    )
                                elif matched_idx == 4 and len(col_positions) >= 6:  # GI
                                    last_added_member["gi_codigo"] = clean_text(
                                        (last_added_member["gi_codigo"] or "") + " " + cell_text
                                    )
                                elif matched_idx == 5 or (matched_idx == 4 and len(col_positions) == 5):  # Condición GI
                                    last_added_member["gi_condicion"] = clean_text(
                                        (last_added_member["gi_condicion"] or "") + " " + cell_text
                                    )

        # 3. Transformar diccionarios intermedios a modelos Pydantic
        proyectos_pydantic = []
        for p in proyectos:
            integrantes_pydantic = []
            for i in p["integrantes"]:
                # Eliminar campos privados auxiliares de coordenadas
                i.pop("_col_positions", None)
                integrantes_pydantic.append(Integrante(**i))

            p["integrantes"] = integrantes_pydantic
            proyectos_pydantic.append(ProyectoRR(**p))

        metadata = MetadataRR(
            numero_resolucion=numero_resolucion,
            fecha_emision=fecha_emision,
            anio_academico=anio_academico,
            area=area_detectada,
            facultad=facultad_detectada,
        )

        return ResolucionRectoral(tipo_documento="resolucion_rectoral", metadata=metadata, proyectos=proyectos_pydantic)
