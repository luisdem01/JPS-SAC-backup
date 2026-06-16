from pydantic import BaseModel
from sgpi_cmee.api.v1.schemas import ExcelGenerationRequest, ExcelSheetDef

def adapt_report_to_generic_excel(report_model: BaseModel, tipo_reporte: str, usuario_generador: str) -> ExcelGenerationRequest:
    sheets = []
    
    if tipo_reporte == "Carga No Lectiva":
        headers = ["DNI", "Apellidos", "Nombres", "Departamento", "Hrs. Proyectos", "Hrs. Tesis", "Carga Total", "Excede Max"]
        data = []
        for inv in getattr(report_model, 'investigadores', []):
            data.append([
                inv.dni, inv.apellidos, inv.nombres, inv.departamento,
                inv.horas_proyectos, inv.horas_tesis, inv.carga_total, 
                "Sí" if inv.excede_maximo else "No"
            ])
        sheets.append(ExcelSheetDef(
            sheet_name="Carga No Lectiva",
            title="REPORTE INSTITUCIONAL: CARGA NO LECTIVA",
            headers=headers,
            data=data
        ))
        
    elif tipo_reporte == "Proyectos Activos":
        headers = ["Cód. Proyecto", "Título", "Tipo", "Presupuesto", "GI", "Fecha Inicio", "Estado"]
        data = []
        for proj in getattr(report_model, 'proyectos', []):
            data.append([
                proj.codigo_proyecto, proj.titulo, proj.tipo_proyecto, 
                proj.presupuesto, proj.grupo_investigacion, 
                str(proj.fecha_inicio) if proj.fecha_inicio else "N/A", proj.estado
            ])
        sheets.append(ExcelSheetDef(
            sheet_name="Proyectos Activos",
            title="REPORTE INSTITUCIONAL: PROYECTOS ACTIVOS",
            headers=headers,
            data=data
        ))
        
    elif tipo_reporte == "Produccion Cientifica":
        # Hoja 1: Publicaciones
        headers_pub = ["ID", "DOI", "Título", "Revista", "Tipo", "Cuartil", "Indexación", "Fecha"]
        data_pub = []
        for pub in getattr(report_model, 'publicaciones', []):
            data_pub.append([
                pub.id_publicacion, pub.doi, pub.titulo, pub.revista, 
                pub.tipo, pub.cuartil_impacto, pub.indexacion, 
                str(pub.fecha_publicacion) if pub.fecha_publicacion else "N/A"
            ])
        sheets.append(ExcelSheetDef(
            sheet_name="Publicaciones",
            title="REPORTE INSTITUCIONAL: PRODUCCIÓN CIENTÍFICA (PUBLICACIONES)",
            headers=headers_pub,
            data=data_pub
        ))
        
        # Hoja 2: Tesis
        headers_tesis = ["URL", "Título", "Estudiante", "Asesor", "Nivel", "Año"]
        data_tesis = []
        for tes in getattr(report_model, 'tesis', []):
            data_tesis.append([
                tes.url_cybertesis, tes.titulo, tes.autor_estudiante, 
                tes.asesor, tes.nivel_grado, tes.anio_publicacion
            ])
        sheets.append(ExcelSheetDef(
            sheet_name="Tesis",
            title="REPORTE INSTITUCIONAL: TESIS",
            headers=headers_tesis,
            data=data_tesis
        ))
        
    elif tipo_reporte == "Resumen General":
        metrics_data = [
            ("Total Investigadores Evaluados", getattr(report_model, 'total_investigadores_evaluados', 0)),
            ("Total Proyectos Activos", getattr(report_model, 'total_proyectos_activos', 0)),
            ("Presupuesto Total Proyectos Activos", f"${getattr(report_model, 'presupuesto_total_proyectos_activos', 0.0):,.2f}"),
            ("Total Publicaciones Período", getattr(report_model, 'total_publicaciones_periodo', 0)),
            ("Total Tesis Período", getattr(report_model, 'total_tesis_periodo', 0)),
            ("Promedio Carga No Lectiva", round(getattr(report_model, 'promedio_carga_no_lectiva', 0.0), 2)),
            ("Investigadores que Exceden Carga", getattr(report_model, 'investigadores_exceden_carga_maxima', 0)),
            ("Total Grupos Activos", getattr(report_model, 'total_grupos_activos', 0)),
            ("Investigadores SM", getattr(report_model, 'total_investigadores_sm', 0)),
            ("Convocatorias Abiertas", getattr(report_model, 'convocatorias_abiertas', 0)),
            ("Convocatorias por Vencer", getattr(report_model, 'convocatorias_vencimiento_critico', 0)),
            ("Investigadores con Deuda PI", getattr(report_model, 'investigadores_con_deuda_pi', 0)),
            ("Investigadores con Deuda GI", getattr(report_model, 'investigadores_con_deuda_gi', 0)),
        ]
        
        # Opcional: añadir la tabla de RENACYT como datos tabulares debajo
        headers_renacyt = ["Categoría RENACYT", "Cantidad"]
        data_renacyt = []
        for k, v in getattr(report_model, 'investigadores_por_categoria_renacyt', {}).items():
            data_renacyt.append([k, v])
            
        sheets.append(ExcelSheetDef(
            sheet_name="Resumen General",
            title="REPORTE INSTITUCIONAL: RESUMEN GENERAL",
            metrics=metrics_data,
            headers=headers_renacyt,
            data=data_renacyt
        ))
        
    elif tipo_reporte == "Ficha Grupo":
        # Hoja 1: Resumen de Grupo
        estado_str = getattr(report_model, 'estado_grupo', 'Activo')
        if estado_str == "Activo":
            estado_str = "Validado / Activo"
        elif estado_str == "Inactivo":
            estado_str = "Validado / Inactivo"
        elif estado_str == "Pendiente":
            estado_str = "Pendiente Validar"
            
        metrics_data = [
            ("Código del Grupo", getattr(report_model, 'codigo_grupo', '')),
            ("Nombre del Grupo", getattr(report_model, 'nombre_grupo', '')),
            ("Siglas", getattr(report_model, 'siglas', 'N/A') or 'N/A'),
            ("Estado", estado_str),
            ("Fecha de Registro", getattr(report_model, 'fecha_reconocimiento', 'N/A') or 'N/A'),
            ("Coordinador DNI", getattr(report_model, 'coordinador_dni', 'N/A') or 'N/A'),
            ("Coordinador Nombre", getattr(report_model, 'coordinador_nombre', 'N/A') or 'N/A'),
            ("Líneas de Investigación", ", ".join(getattr(report_model, 'lineas_investigacion', []))),
            ("Total Integrantes", len(getattr(report_model, 'miembros', []))),
            ("Proyectos Activos", len([p for p in getattr(report_model, 'proyectos', []) if p.estado == 'active'])),
            ("Artículos (Scopus)", getattr(report_model, 'articulos_scopus', 0)),
            ("Tesis en Curso", getattr(report_model, 'tesis_en_curso', 0)),
        ]
        
        sheets.append(ExcelSheetDef(
            sheet_name="Resumen de Grupo",
            title=f"FICHA CONSOLIDADA DE GRUPO: {getattr(report_model, 'codigo_grupo', '')}",
            metrics=metrics_data,
            metrics_title="Concepto",
            metrics_value_title="Detalle"
        ))
        
        # Hoja 2: Integrantes
        headers_miembros = ["DNI", "Apellidos y Nombres", "Rol en el Grupo", "Fecha de Incorporación", "Estado"]
        data_miembros = []
        for m in getattr(report_model, 'miembros', []):
            estado_m = "Activo" if m.estado == "activo" else "Inactivo"
            data_miembros.append([
                m.dni, m.nombre, m.rol, m.fecha_incorporacion or "N/A", estado_m
            ])
            
        sheets.append(ExcelSheetDef(
            sheet_name="Integrantes",
            title="INTEGRANTES DE GRUPO DE INVESTIGACIÓN",
            headers=headers_miembros,
            data=data_miembros
        ))
        
        # Hoja 3: Proyectos Vinculados
        headers_proy = ["Código del Proyecto", "Título del Proyecto", "Convocatoria", "Estado"]
        data_proy = []
        for p in getattr(report_model, 'proyectos', []):
            est_p = "En ejecución"
            if p.estado == "pending":
                est_p = "Formulación"
            elif p.estado == "completed":
                est_p = "Concluido"
            elif p.estado == "cancelled":
                est_p = "Cancelado"
                
            data_proy.append([
                p.codigo, p.titulo, p.convocatoria or "N/A", est_p
            ])
            
        sheets.append(ExcelSheetDef(
            sheet_name="Proyectos Vinculados",
            title="PROYECTOS DE INVESTIGACIÓN VINCULADOS",
            headers=headers_proy,
            data=data_proy
        ))
        
    return ExcelGenerationRequest(sheets=sheets, usuario_generador=usuario_generador)
