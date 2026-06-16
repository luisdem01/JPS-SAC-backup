import pandas as pd
from typing import Dict, List, Any

from sgpi_ci.utils.cleaners import clean_prefix_and_title, split_docentes_cell

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

class ProyectosParser:
    """Para '6. Proyectos de investigación 2018-2025'"""
    def parse(self, file_path: str) -> Dict[str, List[dict]]:
        header_row = find_header_row(file_path)
        df = pd.read_excel(file_path, skiprows=header_row)
        
        # Limpiar nombres de columnas (quitar saltos de linea)
        df.columns = [str(c).replace('\n', ' ').strip() for c in df.columns]
        
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
    def parse(self, file_path: str) -> Dict[str, List[dict]]:
        result = {'proyectos': [], 'publicaciones': [], 'tesis': []}
        xl = pd.ExcelFile(file_path)
        
        # 1. Proyectos
        if 'Proyectos con Financiamiento' in xl.sheet_names:
            h_row = find_header_row(file_path, 'Proyectos con Financiamiento')
            df_p = pd.read_excel(file_path, sheet_name='Proyectos con Financiamiento', skiprows=h_row)
            df_p.columns = [str(c).replace('\n', ' ').strip() for c in df_p.columns]
            
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
        if 'Publicación de artículos' in xl.sheet_names:
            h_row = find_header_row(file_path, 'Publicación de artículos')
            df_pub = pd.read_excel(file_path, sheet_name='Publicación de artículos', skiprows=h_row)
            df_pub.columns = [str(c).replace('\n', ' ').strip() for c in df_pub.columns]
            
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
        if 'TESIS' in xl.sheet_names:
            h_row = find_header_row(file_path, 'TESIS')
            df_t = pd.read_excel(file_path, sheet_name='TESIS', skiprows=h_row)
            df_t.columns = [str(c).replace('\n', ' ').strip() for c in df_t.columns]
            
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
    def parse(self, file_path: str) -> Dict[str, List[dict]]:
        header_row = find_header_row(file_path)
        df = pd.read_excel(file_path, skiprows=header_row)
        df.columns = [str(c).replace('\n', ' ').strip() for c in df.columns]
        
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
    def parse(self, file_path: str) -> Dict[str, List[dict]]:
        header_row = find_header_row(file_path)
        df = pd.read_excel(file_path, skiprows=header_row)
        df.columns = [str(c).replace('\n', ' ').strip() for c in df.columns]
        
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
        if 'proyectos' in filename_lower and '2018-2025' in filename_lower:
            return ProyectosParser()
        elif 'ii-fisi' in filename_lower:
            return IIFISIParser()
        elif 'coord' in filename_lower:
            return GICoordinadoresParser()
        elif 'docentes en grupo' in filename_lower:
            return GIDocentesParser()
        else:
            raise ValueError(f"No se detectó un parser adecuado para el archivo: {filename}")
