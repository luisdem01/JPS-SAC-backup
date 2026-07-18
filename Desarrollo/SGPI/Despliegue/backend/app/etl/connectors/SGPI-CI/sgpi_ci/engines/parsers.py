import difflib
import logging
import unicodedata

import pandas as pd
from typing import Dict, List, Any

from sgpi_ci.utils.cleaners import clean_prefix_and_title, split_docentes_cell

def validate_columns(df: pd.DataFrame, required: List[str], context: str) -> None:
    """
    Verifica que todas las columnas requeridas estén presentes en el DataFrame.
    Si falta alguna, lanza ValueError con detalle de qué falta y qué se encontró,
    incluyendo sugerencias de columnas con nombre similar.
    """
    from difflib import get_close_matches

    found = list(df.columns)
    missing = [col for col in required if col not in found]

    if not missing:
        return

    lines = [f"[{context}] Columnas requeridas no encontradas en el Excel:"]
    for col in missing:
        suggestions = get_close_matches(col, found, n=1, cutoff=0.6)
        hint = f"  → ¿Quiso decir: '{suggestions[0]}'?" if suggestions else ""
        lines.append(f"  ✗ '{col}'{hint}")
    lines.append(f"Columnas encontradas: {found}")
    raise ValueError("\n".join(lines))

logger = logging.getLogger(__name__)

def find_header_row(file_path: str, sheet_name: Any = 0, max_rows: int = 15) -> int:
    """
    Busca heurísticamente la fila de cabecera (flotante) saltando filas basura institucionales.
    """
    try:
        df_temp = pd.read_excel(file_path, sheet_name=sheet_name, nrows=max_rows, header=None)
    except Exception:
        return 0

    max_non_null = 0
    header_idx = 0
    for i in range(len(df_temp)):
        non_null_count = df_temp.iloc[i].notna().sum()
        if non_null_count > max_non_null:
            max_non_null = non_null_count
            header_idx = i
    return header_idx


def normalize_str(s: str) -> str:
    """
    Normaliza un string a minúsculas, sin acentos y sin espacios múltiples.
    Usado para comparaciones tolerantes de nombres de hojas Excel.
    """
    s = s.strip().lower()
    s = unicodedata.normalize('NFKD', s)
    s = ''.join(c for c in s if not unicodedata.combining(c))
    s = ' '.join(s.split())  # colapsa múltiples espacios
    return s


def find_sheet_name(
    available_sheets: list,
    target: str,
    cutoff: float = 0.85
) -> 'str | None':
    """
    Busca el nombre de hoja más cercano a ``target`` dentro de ``available_sheets``.

    Estrategia en tres capas:
        1. Coincidencia exacta tras normalización (minúsculas + sin acentos + sin espacios extra).
        2. Si falla, busca la hoja con mayor similitud difusa usando difflib (umbral ``cutoff``).
        3. Si ninguna supera el umbral, loguea un WARNING con las hojas disponibles y retorna None.

    Returns:
        El nombre REAL de la hoja encontrada (sin normalizar), o None si no se encontró.
    """
    norm_target = normalize_str(target)

    # Capa 1: coincidencia exacta normalizada
    for sheet in available_sheets:
        if normalize_str(sheet) == norm_target:
            if sheet != target:
                logger.warning(
                    "Hoja '%s' encontrada como variante de '%s'. "
                    "Considera corregir el nombre en el archivo fuente.",
                    sheet, target
                )
            return sheet

    # Capa 2: similitud difusa
    norm_map = {normalize_str(s): s for s in available_sheets}
    matches = difflib.get_close_matches(norm_target, norm_map.keys(), n=1, cutoff=cutoff)
    if matches:
        real_name = norm_map[matches[0]]
        logger.warning(
            "Hoja '%s' no encontrada exactamente. Usando '%s' como alternativa (fuzzy match).",
            target, real_name
        )
        return real_name

    # Capa 3: no encontrada → warning explícito
    logger.warning(
        "Hoja '%s' no encontrada en el archivo. "
        "Hojas disponibles: %s. Esta sección será omitida.",
        target, available_sheets
    )
    return None


class ProyectosParser:
    """Para '6. Proyectos de investigación 2018-2025'"""

    REQUIRED_COLUMNS = [
        'Código Proyecto',
        'Resolución Rectoral',
        'Nombre del Proyecto',
        'Tipo',
        'Año',
        'Responsable(R) / Corresponsable(C) / Miembro(M) / Asesor(A)',
        'Grupo de Investigación',
    ]

    def parse(self, file_path: str) -> Dict[str, List[dict]]:
        header_row = find_header_row(file_path)
        df = pd.read_excel(file_path, skiprows=header_row)

        # Limpiar nombres de columnas (quitar saltos de linea)
        df.columns = [str(c).replace('\n', ' ').strip() for c in df.columns]
        validate_columns(df, self.REQUIRED_COLUMNS, "ProyectosParser")

        # Llenar celdas combinadas (merged cells)
        for col in ['Código Proyecto', 'Resolución Rectoral', 'Nombre del Proyecto', 'Tipo', 'Año', 'Grupo de Investigación']:
            if col in df.columns:
                df[col] = df[col].ffill()
        proyectos = []
        for _, row in df.iterrows():
            codigo = str(row.get('Código Proyecto', '')).strip()
            if not codigo or codigo == 'nan':
                continue
                
            docente_raw = str(row.get('Responsable(R) / Corresponsable(C) / Miembro(M) / Asesor(A)', ''))
            docente_limpio = clean_prefix_and_title(pd.Series([docente_raw])).iloc[0]
            
            # Extraer rol original para usarlo como condicion_rol
            rol = 'Miembro'
            if docente_raw.startswith('R_'): rol = 'Responsable'
            elif docente_raw.startswith('C_'): rol = 'Corresponsable'
            elif docente_raw.startswith('A_'): rol = 'Asesor'

            proyectos.append({
                'codigo_proyecto': codigo,
                'resolucion_aprobacion': str(row.get('Resolución Rectoral', '')).strip(),
                'titulo_proyecto': str(row.get('Nombre del Proyecto', '')).strip(),
                'tipo_programa': str(row.get('Tipo', '')).strip(),
                'anio_convocatoria': row.get('Año', None),
                'docente_nombre': docente_limpio,
                'condicion_rol': rol,
                'codigo_grupo': str(row.get('Grupo de Investigación', '')).strip()
            })
            
        return {'proyectos': proyectos}

class IIFISIParser:
    """Para 'Base de datos del II-FISI 2024.xlsx' (Multishoja)"""

    REQUIRED_PROYECTOS = [
        'Codigo del Proyecto', 'Título del Proyecto', 'Resolucion Rectoral',
        'Grupo de Investigación', 'Responsable', 'Co responsable', 'Miembro Docente',
    ]
    REQUIRED_PUBLICACIONES = [
        'Título del artículo', 'Revista de Investigación', 'DOI',
        'Indexado en, nivel', 'GI', 'Primer autor Filiación',
    ]
    REQUIRED_TESIS = [
        'Título de la Tesis', 'Apellidos y Nombre del Tesista', 'Asesores',
    ]

    def parse(self, file_path: str) -> Dict[str, List[dict]]:
        result = {'proyectos': [], 'publicaciones': [], 'tesis': []}
        xl = pd.ExcelFile(file_path)

        # 1. Proyectos
        sheet_proy = find_sheet_name(xl.sheet_names, 'Proyectos con Financiamiento')
        if sheet_proy:
            h_row = find_header_row(file_path, sheet_proy)
            df_p = pd.read_excel(file_path, sheet_name=sheet_proy, skiprows=h_row)
            df_p.columns = [str(c).replace('\n', ' ').strip() for c in df_p.columns]
            validate_columns(df_p, self.REQUIRED_PROYECTOS, "IIFISIParser / Proyectos con Financiamiento")

            # Llenar celdas combinadas (merged cells)
            for col in ['Codigo del Proyecto', 'Título del Proyecto', 'Resolucion Rectoral', 'Grupo de Investigación']:
                if col in df_p.columns:
                    df_p[col] = df_p[col].ffill()
            for _, row in df_p.iterrows():
                codigo = str(row.get('Codigo del Proyecto', '')).strip()
                if not codigo or codigo == 'nan': continue
                
                # Para miembros que están en un arreglo oculto (\n)
                miembros_raw = str(row.get('Miembro Docente', ''))
                miembros = split_docentes_cell(pd.Series([miembros_raw])).iloc[0]
                
                # Agregamos Responsable y Co responsable
                resp = str(row.get('Responsable', '')).strip()
                coresp = str(row.get('Co responsable', '')).strip()
                if resp and resp != 'nan': miembros.append(f"R_{resp}")
                if coresp and coresp != 'nan': miembros.append(f"C_{coresp}")
                
                for m in miembros:
                    rol = 'Miembro'
                    if m.startswith('R_'): 
                        rol = 'Responsable'
                        m = m[2:]
                    elif m.startswith('C_'):
                        rol = 'Corresponsable'
                        m = m[2:]
                    
                    docente_limpio = clean_prefix_and_title(pd.Series([m])).iloc[0]
                    result['proyectos'].append({
                        'codigo_proyecto': codigo,
                        'titulo_proyecto': str(row.get('Título del Proyecto', '')).strip(),
                        'resolucion_aprobacion': str(row.get('Resolucion Rectoral', '')).strip(),
                        'codigo_grupo': str(row.get('Grupo de Investigación', '')).replace('\n', ' ').strip(),
                        'docente_nombre': docente_limpio,
                        'condicion_rol': rol
                    })
                    
        # 2. Publicaciones
        sheet_pub = find_sheet_name(xl.sheet_names, 'Publicación de artículos')
        if sheet_pub:
            h_row = find_header_row(file_path, sheet_pub)
            df_pub = pd.read_excel(file_path, sheet_name=sheet_pub, skiprows=h_row)
            df_pub.columns = [str(c).replace('\n', ' ').strip() for c in df_pub.columns]
            validate_columns(df_pub, self.REQUIRED_PUBLICACIONES, "IIFISIParser / Publicación de artículos")

            for _, row in df_pub.iterrows():
                titulo = str(row.get('Título del artículo', '')).strip()
                if not titulo or titulo == 'nan': continue
                
                result['publicaciones'].append({
                    'titulo_articulo': titulo,
                    'nombre_revista': str(row.get('Revista de Investigación', '')).strip(),
                    'doi_codigo': str(row.get('DOI', '')).strip(),
                    'indexacion': str(row.get('Indexado en, nivel', '')).strip(),
                    'codigo_grupo': str(row.get('GI', '')).strip(),
                    'tipo_publicacion': 'Artículo Científico',
                    'docente_nombre': clean_prefix_and_title(pd.Series([str(row.get('Primer autor Filiación', '')).split('\n')[0]])).iloc[0]
                })

        # 3. Tesis
        sheet_tesis = find_sheet_name(xl.sheet_names, 'TESIS')
        if sheet_tesis:
            h_row = find_header_row(file_path, sheet_tesis)
            df_t = pd.read_excel(file_path, sheet_name=sheet_tesis, skiprows=h_row)
            df_t.columns = [str(c).replace('\n', ' ').strip() for c in df_t.columns]
            validate_columns(df_t, self.REQUIRED_TESIS, "IIFISIParser / TESIS")

            if 'Título de la Tesis' in df_t.columns:
                df_t['Título de la Tesis'] = df_t['Título de la Tesis'].ffill()
            for _, row in df_t.iterrows():
                titulo = str(row.get('Título de la Tesis', '')).strip()
                if not titulo or titulo == 'nan': continue
                
                result['tesis'].append({
                    'titulo_tesis': titulo,
                    'autor_estudiante_texto': str(row.get('Apellidos y Nombre del Tesista', '')).strip(),
                    'asesor_texto': str(row.get('Asesores', '')).strip(),
                    'docente_nombre': clean_prefix_and_title(pd.Series([str(row.get('Asesores', ''))])).iloc[0]
                })

        return result

class GICoordinadoresParser:
    """Para 'BD coord de GI FISI'"""

    REQUIRED_COLUMNS = [
        'Nombre del GI',
        'Nombre del coordinador',
        'Correo electrónico',
    ]

    def parse(self, file_path: str) -> Dict[str, List[dict]]:
        header_row = find_header_row(file_path)
        df = pd.read_excel(file_path, skiprows=header_row)
        df.columns = [str(c).replace('\n', ' ').strip() for c in df.columns]
        validate_columns(df, self.REQUIRED_COLUMNS, "GICoordinadoresParser")

        grupos = []
        for _, row in df.iterrows():
            nombre = str(row.get('Nombre del GI', '')).strip()
            if not nombre or nombre == 'nan': continue
            
            coord_raw = str(row.get('Nombre del coordinador', ''))
            docente_limpio = clean_prefix_and_title(pd.Series([coord_raw])).iloc[0]
            
            grupos.append({
                'nombre_grupo': nombre,
                'docente_nombre': docente_limpio,
                'correo_coordinador': str(row.get('Correo electrónico', '')).strip()
            })
        return {'grupos': grupos}

class GIDocentesParser:
    """Para 'Docentes en grupo de investigación con LI'"""

    REQUIRED_COLUMNS = [
        'Nombre de Grupo de Investigación',
        'Docente',
        'Condición',
        'Líneas de Investigación',
        'Nombre Corto',
    ]

    def parse(self, file_path: str) -> Dict[str, List[dict]]:
        header_row = find_header_row(file_path)
        df = pd.read_excel(file_path, skiprows=header_row)
        df.columns = [str(c).replace('\n', ' ').strip() for c in df.columns]
        validate_columns(df, self.REQUIRED_COLUMNS, "GIDocentesParser")

        # Llenar celdas combinadas (merged cells) hacia abajo
        if 'Nombre de Grupo de Investigación' in df.columns:
            df['Nombre de Grupo de Investigación'] = df['Nombre de Grupo de Investigación'].ffill()
        if 'Nombre Corto' in df.columns:
            df['Nombre Corto'] = df['Nombre Corto'].ffill()
        miembros_grupo = []
        for _, row in df.iterrows():
            nombre_gi = str(row.get('Nombre de Grupo de Investigación', '')).strip()
            if not nombre_gi or nombre_gi == 'nan': continue
            
            docente_raw = str(row.get('Docente', ''))
            docente_limpio = clean_prefix_and_title(pd.Series([docente_raw])).iloc[0]
            
            lineas = str(row.get('Líneas de Investigación', '')).split(',')
            lineas = [linea.strip() for linea in lineas if linea.strip()]
            
            miembros_grupo.append({
                'nombre_grupo': nombre_gi,
                'siglas': str(row.get('Nombre Corto', '')).strip(),
                'docente_nombre': docente_limpio,
                'condicion_miembro': str(row.get('Condición', '')).strip(),
                'lineas_investigacion': lineas
            })
        return {'miembros_grupo': miembros_grupo}

class ParserFactory:
    @staticmethod
    def get_parser(filename: str):
        filename_lower = filename.lower()
        if 'proyectos' in filename_lower:
            return ProyectosParser()
        elif 'ii-fisi' in filename_lower:
            return IIFISIParser()
        elif 'coord' in filename_lower:
            return GICoordinadoresParser()
        elif 'docentes en grupo' in filename_lower:
            return GIDocentesParser()
        else:
            raise ValueError(f"No se detectó un parser adecuado para el archivo: {filename}")
