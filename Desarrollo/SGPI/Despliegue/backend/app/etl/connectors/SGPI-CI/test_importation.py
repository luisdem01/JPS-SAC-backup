import sys
import os
from pathlib import Path
import pytest
import pandas as pd
from unittest.mock import MagicMock, patch, AsyncMock

# Configurar path para las importaciones del módulo y el backend
current_dir = os.path.dirname(os.path.abspath(__file__))
connectors_dir = str(Path(current_dir).parent)  # backend/app/etl/connectors
backend_dir = str(Path(current_dir).parent.parent.parent.parent)  # backend

if connectors_dir not in sys.path:
    sys.path.insert(0, connectors_dir)
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Importar elementos a probar
from sgpi_ci.engines.parsers import ParserFactory, validate_columns, ProyectosParser, IIFISIParser
from sgpi_ci.core.processor import EtlProcessor

@pytest.fixture
def anyio_backend():
    return 'asyncio'

# =====================================================================
# TEST 1: ParserFactory y nombres de archivo
# =====================================================================
def test_parser_factory_filename_matching():
    # En esta rama, se exige que contenga 'proyectos'
    assert isinstance(ParserFactory.get_parser("6. Proyectos de investigación 2018-2025.xlsx"), ProyectosParser)
    
    # Debe aceptar proyectos de cualquier año
    assert isinstance(ParserFactory.get_parser("proyectos_2026.xlsx"), ProyectosParser)
    
    # Debe fallar si no coincide con ninguna palabra clave
    with pytest.raises(ValueError, match="No se detectó un parser adecuado"):
        ParserFactory.get_parser("archivo_invalido.xlsx")
        
    # Debe coincidir ii-fisi
    assert isinstance(ParserFactory.get_parser("base de datos ii-fisi 2024.xlsx"), IIFISIParser)

# =====================================================================
# TEST 2: Validación estricta de columnas y sugerencias difusas
# =====================================================================
def test_validate_columns_with_fuzzy_suggestions():
    # DataFrame con columnas mal escritas (ej. falta tilde en 'Código Proyecto')
    df = pd.DataFrame(columns=[
        'Codigo Proyecto', 
        'Resolución Rectoral', 
        'Nombre del Proyecto', 
        'Tipo', 
        'Año', 
        'Responsable(R) / Corresponsable(C) / Miembro(M) / Asesor(A)', 
        'Grupo de Investigación'
    ])
    
    required = ProyectosParser.REQUIRED_COLUMNS
    
    with pytest.raises(ValueError) as excinfo:
        validate_columns(df, required, "ProyectosParser")
    
    error_msg = str(excinfo.value)
    # Debe indicar qué columna falta
    assert "Código Proyecto" in error_msg
    # Debe dar la sugerencia difusa inteligente
    assert "¿Quiso decir: 'Codigo Proyecto'?" in error_msg

# =====================================================================
# TEST 3: Resolución de múltiples grupos en una celda
# =====================================================================
@pytest.mark.anyio
@patch('sgpi_ci.core.processor.SupabaseUploader')
@patch('sgpi_ci.core.processor.RenacytConnector')
async def test_match_grupos_resolves_multiple_ids(MockRenacytConnector, MockSupabaseUploader):
    # 1. Configurar mocks de Supabase
    mock_uploader = MockSupabaseUploader.return_value
    # Catálogo de grupos con IDs
    mock_uploader.fetch_grupos.return_value = [
        {'id_grupo': 101, 'siglas': 'YACHAY', 'nombre_grupo': 'Yachay'},
        {'id_grupo': 102, 'siglas': 'ITDATA', 'nombre_grupo': 'Itdata'}
    ]
    mock_uploader.fetch_investigadores.return_value = []
    mock_uploader.fetch_lineas_investigacion.return_value = []
    
    # Mockear conector RENACYT vacío
    mock_renacyt = MockRenacytConnector.return_value
    mock_renacyt.search_by_name = AsyncMock(return_value={'total': 0, 'data': []})
    
    # 2. Crear procesador
    processor = EtlProcessor(file_path="6. Proyectos de investigación 2018-2025.xlsx")
    
    # Mockear el parser para retornar un proyecto con múltiples grupos
    mock_parser = MagicMock()
    mock_parser.parse.return_value = {
        'proyectos': [
            {
                'codigo_proyecto': 'PRO-001',
                'resolucion_aprobacion': 'RR-100',
                'titulo_proyecto': 'Proyecto de Prueba',
                'tipo_programa': 'PROY-INV',
                'anio_convocatoria': 2026,
                'docente_nombre': 'JUAN PEREZ',
                'condicion_rol': 'Responsable',
                'codigo_grupo': 'YACHAY / ITDATA'  # Múltiples grupos
            }
        ]
    }
    
    with patch('sgpi_ci.core.processor.ParserFactory.get_parser', return_value=mock_parser):
        resultado = await processor.process(upload_to_db=False)
        
        # Obtener los proyectos validados
        proyectos = resultado['detalle_extraccion']['proyectos']
        
        # Verificar que se extrajeron ambos IDs de grupo
        assert proyectos[0]['id_grupos'] == [101, 102]

# =====================================================================
# TEST 4: Envío a cuarentena de registros con docentes sin DNI
# =====================================================================
@pytest.mark.anyio
@patch('sgpi_ci.core.processor.SupabaseUploader')
@patch('sgpi_ci.core.processor.RenacytConnector')
async def test_unresolved_dni_sends_to_quarantine(MockRenacytConnector, MockSupabaseUploader):
    # 1. Configurar mocks de Supabase (BD vacía)
    mock_uploader = MockSupabaseUploader.return_value
    mock_uploader.fetch_investigadores.return_value = []
    mock_uploader.fetch_grupos.return_value = []
    mock_uploader.fetch_lineas_investigacion.return_value = []
    mock_uploader.send_to_quarantine = MagicMock()
    
    # 2. Configurar mock del conector RENACYT (No encuentra nada en CONCYTEC)
    mock_renacyt = MockRenacytConnector.return_value
    mock_renacyt.search_by_name = AsyncMock(return_value={'total': 0, 'data': []})
    
    # 3. Crear procesador
    processor = EtlProcessor(file_path="6. Proyectos de investigación 2018-2025.xlsx")
    
    # Mockear parser para retornar un proyecto, una publicación y una tesis
    # cuyos docentes no podrán resolverse
    mock_parser = MagicMock()
    mock_parser.parse.return_value = {
        'proyectos': [
            {
                'codigo_proyecto': 'PROY-X',
                'resolucion_aprobacion': 'RR-01',
                'titulo_proyecto': 'Proyecto X',
                'tipo_programa': 'PROY-INV',
                'anio_convocatoria': 2026,
                'docente_nombre': 'DOCENTE INEXISTENTE 1',
                'condicion_rol': 'Responsable',
                'codigo_grupo': None
            }
        ],
        'publicaciones': [
            {
                'titulo_articulo': 'Articulo X',
                'nombre_revista': 'Revista X',
                'doi_codigo': '10.1000/xyz123',
                'indexacion': 'Scopus',
                'codigo_grupo': None,
                'tipo_publicacion': 'Artículo Científico',
                'docente_nombre': 'DOCENTE INEXISTENTE 2'
            }
        ],
        'tesis': [
            {
                'titulo_tesis': 'Tesis X',
                'autor_estudiante_texto': 'Estudiante X',
                'asesor_texto': 'DOCENTE INEXISTENTE 3',
                'docente_nombre': 'DOCENTE INEXISTENTE 3'
            }
        ]
    }
    
    with patch('sgpi_ci.core.processor.ParserFactory.get_parser', return_value=mock_parser):
        resultado = await processor.process(upload_to_db=False)
        
        # Verificar contadores de cuarentena
        assert resultado['en_cuarentena'] == 3
        
        # Debe haber registrado los 3 docentes no resueltos en detalle_sin_dni
        detalles_sin_dni = resultado['detalle_sin_dni']
        nombres = [item['nombre'] for item in detalles_sin_dni]
        assert 'DOCENTE INEXISTENTE 1' in nombres
        assert 'DOCENTE INEXISTENTE 2' in nombres
        assert 'DOCENTE INEXISTENTE 3' in nombres
        
        # Las publicaciones y tesis sin DNI no deben haberse agregado a válidos
        assert len(resultado['detalle_extraccion']['publicaciones']) == 0
        assert len(resultado['detalle_extraccion']['tesis']) == 0
        
        # El proyecto sí se crea (con lista de docentes vacía)
        assert len(resultado['detalle_extraccion']['proyectos']) == 1
        assert len(resultado['detalle_extraccion']['proyectos'][0]['docentes']) == 0
        
        # Verificar que se llamó a send_to_quarantine para la publicación y la tesis
        assert mock_uploader.send_to_quarantine.call_count == 2
        
        # Primer llamado: Publicación
        mock_uploader.send_to_quarantine.assert_any_call(
            "publicacion",
            "10.1000/xyz123",
            mock_parser.parse.return_value['publicaciones'][0],
            "Autor 'DOCENTE INEXISTENTE 2' no encontrado en RENACYT ni en la base de datos local. Requiere asignación manual de DNI."
        )
        
        # Segundo llamado: Tesis
        mock_uploader.send_to_quarantine.assert_any_call(
            "tesis",
            "Tesis X",
            mock_parser.parse.return_value['tesis'][0],
            "Asesor 'DOCENTE INEXISTENTE 3' no encontrado en RENACYT ni en la base de datos local. Requiere asignación manual de DNI."
        )
