from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, extract
from datetime import date

from app.models.domain import (
    Investigador,
    InvestigadorProyecto,
    Proyecto,
    Tesis,
    Publicacion,
    InvestigadorPublicacion,
    GrupoInvestigacion,
    Convocatoria
)
from sgpi_crapi.schemas.report_schemas import (
    ReportParams, 
    WorkloadDetail, 
    WorkloadReportResponse,
    ActiveProjectDetail,
    ActiveProjectMember,
    ActiveProjectsResponse,
    ScientificProductionDetail,
    ScientificAuthor,
    ScientificTesisDetail,
    ScientificProductionResponse,
    GeneralSummaryResponse
)

# Ponderaciones base
HORAS_PROYECTO_ROLES = {
    "Responsable": 10.0,
    "Co-Investigador": 6.0,
    "Colaborador": 3.0
}

HORAS_TESIS_NIVEL = {
    "Posgrado": 2.0,  # Doctorado, Maestría
    "Pregrado": 1.0   # Bachiller, Título Profesional
}

async def generate_report_dispatched(db: AsyncSession, params: ReportParams):
    """
    Dispatcher (Factory) para delegar la generación del reporte al servicio adecuado
    basado en el tipo_reporte.
    """
    # Normalizamos o mapeamos los tipos de reporte que vienen desde el frontend
    tipo_reporte = params.tipo_reporte.strip().lower()
    
    if tipo_reporte == "carga no lectiva":
        return await generate_workload_report(db, params)
    elif tipo_reporte == "proyectos activos":
        return await generate_active_projects_report(db, params)
    elif tipo_reporte in ["produccion cientifica", "producción científica"]:
        return await generate_scientific_production_report(db, params)
    elif tipo_reporte in ["resumen general", "base de datos para poi"]:
        return await generate_general_summary_report(db, params)
    elif tipo_reporte in ["ficha grupo", "ficha de grupo"]:
        return await generate_ficha_grupo_report(db, params)
    else:
        raise ValueError(f"Tipo de reporte '{params.tipo_reporte}' no soportado.")


async def _get_investigadores_base(db: AsyncSession, params: ReportParams):
    stmt = select(Investigador).where(Investigador.estado_vigencia == 'Activo')
    if params.departamento_academico:
        stmt = stmt.where(Investigador.departamento_academico == params.departamento_academico)
    result = await db.execute(stmt)
    return result.scalars().all()


async def _calculate_workloads_batch(db: AsyncSession, params: ReportParams, investigadores: list):
    """
    Realiza el cálculo de carga en batch para evitar N+1 queries.
    Retorna un diccionario:
    { dni: { 'proyectos': [...], 'tesis': [...], 'horas_p': X, 'horas_t': Y, 'total': Z, 'excede': B } }
    """
    dnis = [inv.dni for inv in investigadores]
    workloads = {dni: {
        'detalle_proyectos': [], 'detalle_tesis': [],
        'horas_proyectos': 0.0, 'horas_tesis': 0.0,
        'carga_total': 0.0, 'excede_maximo': False
    } for dni in dnis}
    
    if not dnis:
        return workloads
        
    # Batch Query: Proyectos Activos
    stmt_proj = select(Proyecto, InvestigadorProyecto).join(
        InvestigadorProyecto, Proyecto.codigo_proyecto == InvestigadorProyecto.codigo_proyecto
    ).where(
        InvestigadorProyecto.dni_investigador.in_(dnis),
        Proyecto.estado_proyecto.in_(['Aprobado', 'En ejecución'])
    )
    res_proj = await db.execute(stmt_proj)
    
    for p, ip in res_proj.all():
        horas = HORAS_PROYECTO_ROLES.get(ip.condicion_rol, 0.0)
        dni = ip.dni_investigador
        workloads[dni]['horas_proyectos'] += horas
        workloads[dni]['detalle_proyectos'].append({
            "codigo": p.codigo_proyecto,
            "titulo": p.titulo_proyecto,
            "rol": ip.condicion_rol,
            "horas_asignadas": horas
        })
        
    # Batch Query: Tesis (filtro por año por defecto actual o nulo si no está en bd)
    anio_tesis = params.anio_corte or date.today().year
    stmt_tesis = select(Tesis).where(
        Tesis.dni_asesor.in_(dnis),
        (Tesis.anio_publicacion == anio_tesis) | (Tesis.anio_publicacion.is_(None))
    )
    res_tesis = await db.execute(stmt_tesis)
    
    for t in res_tesis.scalars().all():
        dni = t.dni_asesor
        nivel_str = (t.nivel_grado or "").lower()
        if "doctorado" in nivel_str or "maestr" in nivel_str:
            categoria = "Posgrado"
        else:
            categoria = "Pregrado"
            
        horas = HORAS_TESIS_NIVEL.get(categoria, 1.0)
        workloads[dni]['horas_tesis'] += horas
        workloads[dni]['detalle_tesis'].append({
            "titulo": t.titulo_tesis,
            "tipo_trabajo": t.tipo_trabajo,
            "estudiante": t.autor_estudiante_texto,
            "nivel": categoria,
            "horas_asignadas": horas
        })
        
    # Calcular totales
    for dni, w in workloads.items():
        w['carga_total'] = w['horas_proyectos'] + w['horas_tesis']
        w['excede_maximo'] = w['carga_total'] > 16.0
        
    return workloads


async def generate_workload_report(db: AsyncSession, params: ReportParams) -> WorkloadReportResponse:
    investigadores = await _get_investigadores_base(db, params)
    workloads = await _calculate_workloads_batch(db, params, investigadores)
    
    workload_details = []
    for inv in investigadores:
        w = workloads[inv.dni]
        workload_details.append(WorkloadDetail(
            dni=inv.dni,
            nombres=inv.nombres,
            apellidos=inv.apellidos,
            departamento=inv.departamento_academico,
            horas_proyectos=w['horas_proyectos'],
            horas_tesis=w['horas_tesis'],
            carga_total=w['carga_total'],
            excede_maximo=w['excede_maximo'],
            detalle_proyectos=w['detalle_proyectos'],
            detalle_tesis=w['detalle_tesis']
        ))
        
    return WorkloadReportResponse(
        parametros=params,
        total_investigadores=len(workload_details),
        investigadores=workload_details
    )


async def generate_active_projects_report(db: AsyncSession, params: ReportParams) -> ActiveProjectsResponse:
    stmt = select(Proyecto).where(Proyecto.estado_proyecto.in_(['Aprobado', 'En ejecución']))
    
    if params.grupo_investigacion:
        stmt = stmt.join(GrupoInvestigacion, Proyecto.id_grupo == GrupoInvestigacion.id_grupo).where(GrupoInvestigacion.nombre_grupo == params.grupo_investigacion)
    
    if params.departamento_academico:
        subq = select(InvestigadorProyecto.codigo_proyecto).join(
            Investigador, Investigador.dni == InvestigadorProyecto.dni_investigador
        ).where(Investigador.departamento_academico == params.departamento_academico)
        stmt = stmt.where(Proyecto.codigo_proyecto.in_(subq))
        
    result = await db.execute(stmt)
    proyectos = result.scalars().all()
    
    if not proyectos:
        return ActiveProjectsResponse(
            parametros=params, total_proyectos=0, presupuesto_total=0.0, proyectos=[]
        )
        
    # Obtener integrantes
    codigos_proyectos = [p.codigo_proyecto for p in proyectos]
    stmt_miembros = select(InvestigadorProyecto, Investigador).join(
        Investigador, Investigador.dni == InvestigadorProyecto.dni_investigador
    ).where(InvestigadorProyecto.codigo_proyecto.in_(codigos_proyectos))
    
    res_miembros = await db.execute(stmt_miembros)
    miembros_data = res_miembros.all()
    
    miembros_por_proyecto = {}
    for ip, inv in miembros_data:
        if ip.codigo_proyecto not in miembros_por_proyecto:
            miembros_por_proyecto[ip.codigo_proyecto] = []
        miembros_por_proyecto[ip.codigo_proyecto].append(ActiveProjectMember(
            dni=inv.dni,
            nombres=inv.nombres,
            apellidos=inv.apellidos,
            rol=ip.condicion_rol
        ))
        
    detalle_proyectos = []
    presupuesto_total = 0.0
    for p in proyectos:
        presupuesto = float(p.presupuesto_asignado or 0.0)
        presupuesto_total += presupuesto
        detalle_proyectos.append(ActiveProjectDetail(
            codigo_proyecto=p.codigo_proyecto,
            titulo=p.titulo_proyecto,
            tipo_proyecto=p.tipo_proyecto,
            presupuesto=presupuesto,
            grupo_investigacion=str(p.id_grupo) if p.id_grupo else None,
            fecha_inicio=p.fecha_inicio,
            estado=p.estado_proyecto,
            integrantes=miembros_por_proyecto.get(p.codigo_proyecto, [])
        ))
        
    return ActiveProjectsResponse(
        parametros=params,
        total_proyectos=len(detalle_proyectos),
        presupuesto_total=presupuesto_total,
        proyectos=detalle_proyectos
    )


async def generate_scientific_production_report(db: AsyncSession, params: ReportParams) -> ScientificProductionResponse:
    # 1. Publicaciones
    stmt_pub = select(Publicacion)
    
    # anio_corte tiene prioridad sobre las fechas explícitas
    if params.anio_corte:
        stmt_pub = stmt_pub.where(extract('year', Publicacion.fecha_publicacion) == params.anio_corte)
    else:
        if params.fecha_inicio_desde:
            stmt_pub = stmt_pub.where(Publicacion.fecha_publicacion >= params.fecha_inicio_desde)
        if params.fecha_fin_hasta:
            stmt_pub = stmt_pub.where(Publicacion.fecha_publicacion <= params.fecha_fin_hasta)
            
    if params.grupo_investigacion:
        stmt_pub = stmt_pub.join(GrupoInvestigacion, Publicacion.id_grupo == GrupoInvestigacion.id_grupo).where(GrupoInvestigacion.nombre_grupo == params.grupo_investigacion)
        
    if params.departamento_academico:
        subq = select(InvestigadorPublicacion.id_publicacion).join(
            Investigador, Investigador.dni == InvestigadorPublicacion.dni_investigador
        ).where(Investigador.departamento_academico == params.departamento_academico)
        stmt_pub = stmt_pub.where(Publicacion.id_publicacion.in_(subq))
        
    res_pub = await db.execute(stmt_pub)
    publicaciones = res_pub.scalars().all()
    
    publicaciones_detalle = []
    if publicaciones:
        ids_pub = [p.id_publicacion for p in publicaciones]
        stmt_autores = select(InvestigadorPublicacion, Investigador).join(
            Investigador, Investigador.dni == InvestigadorPublicacion.dni_investigador
        ).where(InvestigadorPublicacion.id_publicacion.in_(ids_pub))
        
        res_autores = await db.execute(stmt_autores)
        autores_data = res_autores.all()
        
        autores_por_pub = {}
        for ip, inv in autores_data:
            if ip.id_publicacion not in autores_por_pub:
                autores_por_pub[ip.id_publicacion] = []
            autores_por_pub[ip.id_publicacion].append(ScientificAuthor(
                dni=inv.dni,
                nombres=inv.nombres,
                apellidos=inv.apellidos,
                filiacion_unmsm=ip.filiacion_unmsm
            ))
            
        for p in publicaciones:
            publicaciones_detalle.append(ScientificProductionDetail(
                id_publicacion=p.id_publicacion,
                doi=p.doi_codigo,
                titulo=p.titulo_articulo,
                revista=p.nombre_revista,
                tipo=p.tipo_publicacion,
                cuartil_impacto=p.cuartil_impacto,
                indexacion=p.indexacion,
                fecha_publicacion=p.fecha_publicacion,
                autores=autores_por_pub.get(p.id_publicacion, [])
            ))
            
    # 2. Tesis
    stmt_tesis = select(Tesis)
    if params.anio_corte:
        stmt_tesis = stmt_tesis.where(
            (Tesis.anio_publicacion == params.anio_corte) | (Tesis.anio_publicacion.is_(None))
        )
        
    if params.departamento_academico:
        stmt_tesis = stmt_tesis.join(
            Investigador, Investigador.dni == Tesis.dni_asesor
        ).where(Investigador.departamento_academico == params.departamento_academico)
        
    res_tesis = await db.execute(stmt_tesis)
    tesis = res_tesis.scalars().all()
    
    tesis_detalle = []
    for t in tesis:
        tesis_detalle.append(ScientificTesisDetail(
            url_cybertesis=t.url_cybertesis,
            titulo=t.titulo_tesis,
            autor_estudiante=t.autor_estudiante_texto,
            asesor=t.asesor_texto,
            nivel_grado=t.nivel_grado,
            anio_publicacion=t.anio_publicacion
        ))
        
    return ScientificProductionResponse(
        parametros=params,
        total_publicaciones=len(publicaciones_detalle),
        total_tesis=len(tesis_detalle),
        publicaciones=publicaciones_detalle,
        tesis=tesis_detalle
    )


async def generate_general_summary_report(db: AsyncSession, params: ReportParams) -> GeneralSummaryResponse:
    # 1. Obtener métricas de carga usando la función batch (sin instanciar modelos Pydantic completos)
    investigadores = await _get_investigadores_base(db, params)
    workloads = await _calculate_workloads_batch(db, params, investigadores)
    
    total_evaluados = len(investigadores)
    total_carga = sum(w['carga_total'] for w in workloads.values())
    promedio_carga = total_carga / total_evaluados if total_evaluados > 0 else 0.0
    investigadores_exceden = sum(1 for w in workloads.values() if w['excede_maximo'])
    
    # 2. Conteo de proyectos activos
    stmt_proj = select(func.count(Proyecto.codigo_proyecto)).where(
        Proyecto.estado_proyecto.in_(['Aprobado', 'En ejecución'])
    )
    stmt_presupuesto = select(func.sum(Proyecto.presupuesto_asignado)).where(
        Proyecto.estado_proyecto.in_(['Aprobado', 'En ejecución'])
    )
    total_proyectos = (await db.execute(stmt_proj)).scalar() or 0
    presupuesto_total = (await db.execute(stmt_presupuesto)).scalar() or 0.0
    
    # 3. Publicaciones y tesis
    stmt_pub = select(func.count(Publicacion.id_publicacion))
    if params.anio_corte:
        stmt_pub = stmt_pub.where(extract('year', Publicacion.fecha_publicacion) == params.anio_corte)
    else:
        if params.fecha_inicio_desde:
            stmt_pub = stmt_pub.where(Publicacion.fecha_publicacion >= params.fecha_inicio_desde)
        if params.fecha_fin_hasta:
            stmt_pub = stmt_pub.where(Publicacion.fecha_publicacion <= params.fecha_fin_hasta)
            
    total_pub = (await db.execute(stmt_pub)).scalar() or 0
    
    stmt_tesis = select(func.count(Tesis.url_cybertesis))
    anio_tesis = params.anio_corte or date.today().year
    stmt_tesis = stmt_tesis.where(Tesis.anio_publicacion == anio_tesis)
    total_tesis = (await db.execute(stmt_tesis)).scalar() or 0
    
    # 4. Categoría RENACYT
    stmt_renacyt = select(Investigador.categoria_renacyt, func.count(Investigador.dni)).group_by(Investigador.categoria_renacyt)
    res_renacyt = await db.execute(stmt_renacyt)
    cat_renacyt = {row[0] or "No Clasificado": row[1] for row in res_renacyt.all()}
    
    # 5. Grupos activos
    total_grupos = (await db.execute(select(func.count(GrupoInvestigacion.codigo_grupo)).where(GrupoInvestigacion.estado_grupo == 'Activo'))).scalar() or 0
    
    # 6. Investigadores SM y Deudas
    total_sm = (await db.execute(select(func.count(Investigador.dni)).where(Investigador.investigador_sm))).scalar() or 0
    deuda_pi = (await db.execute(select(func.count(Investigador.dni)).where(Investigador.tiene_deuda_pi))).scalar() or 0
    deuda_gi = (await db.execute(select(func.count(Investigador.dni)).where(Investigador.tiene_deuda_gi))).scalar() or 0
    
    # 7. Convocatorias
    res_convocatorias = (await db.execute(select(Convocatoria.fecha_cierre).where(Convocatoria.estado_convocatoria == 'Abierta'))).scalars().all()
    convocatorias_abiertas = len(res_convocatorias)
    
    # Validar fechas de cierre críticas en python para agnosticismo de base de datos
    today = date.today()
    vencimiento_critico = sum(1 for fc in res_convocatorias if fc and (fc - today).days <= 7)
    
    return GeneralSummaryResponse(
        parametros=params,
        total_investigadores_evaluados=total_evaluados,
        total_proyectos_activos=total_proyectos,
        presupuesto_total_proyectos_activos=float(presupuesto_total),
        total_publicaciones_periodo=total_pub,
        total_tesis_periodo=total_tesis,
        promedio_carga_no_lectiva=promedio_carga,
        investigadores_exceden_carga_maxima=investigadores_exceden,
        investigadores_por_categoria_renacyt=cat_renacyt,
        total_grupos_activos=total_grupos,
        total_investigadores_sm=total_sm,
        convocatorias_abiertas=convocatorias_abiertas,
        convocatorias_vencimiento_critico=vencimiento_critico,
        investigadores_con_deuda_pi=deuda_pi,
        investigadores_con_deuda_gi=deuda_gi
    )


async def generate_ficha_grupo_report(db: AsyncSession, params: ReportParams):
    from app.models.domain import GrupoInvestigacion, Publicacion, Tesis
    from sgpi_crapi.schemas.report_schemas import (
        FichaGrupoReportResponse,
        FichaGrupoMemberDetail,
        FichaGrupoProyectoDetail
    )
    
    id_grupo_str = params.grupo_investigacion
    if not id_grupo_str:
        raise ValueError("Se requiere especificar el grupo_investigacion para este reporte.")
        
    if id_grupo_str.isdigit():
        stmt = select(GrupoInvestigacion).where(GrupoInvestigacion.id_grupo == int(id_grupo_str))
    else:
        stmt = select(GrupoInvestigacion).where(GrupoInvestigacion.codigo_grupo == id_grupo_str)
        
    res = await db.execute(stmt)
    g = res.scalar_one_or_none()
    if not g:
        raise ValueError(f"Grupo de Investigación '{id_grupo_str}' no encontrado.")
        
    # Artículos Scopus
    stmt_pub = select(func.count(Publicacion.id_publicacion)).where(
        Publicacion.id_grupo == g.id_grupo,
        func.lower(Publicacion.indexacion).like('%scopus%')
    )
    pub_count = (await db.execute(stmt_pub)).scalar() or 0
    
    # Tesis en Curso
    member_dnis = [m.dni_investigador for m in g.miembro_grupo]
    if member_dnis:
        stmt_tesis = select(func.count(Tesis.url_cybertesis)).where(
            Tesis.dni_asesor.in_(member_dnis)
        )
        tesis_count = (await db.execute(stmt_tesis)).scalar() or 0
    else:
        tesis_count = 0
        
    # Miembros
    miembros_list = []
    for m in g.miembro_grupo:
        nombre = f"{m.investigador.nombres} {m.investigador.apellidos}" if m.investigador else m.dni_investigador
        
        # Mapeo del rol
        rol = m.condicion_miembro
        if m.condicion_miembro == "Coordinador":
            rol = "Director"
        elif m.condicion_miembro == "Titular":
            rol = "Co-Investigador"
        elif m.condicion_miembro == "Estudiante":
            rol = "Tesista"
            
        estado = "activo" if m.estado_membresia == "Activo" else "inactivo"
        fecha_inc = m.fecha_incorporacion.isoformat() if m.fecha_incorporacion else ""
        
        miembros_list.append(FichaGrupoMemberDetail(
            dni=m.dni_investigador,
            nombre=nombre,
            rol=rol,
            fecha_incorporacion=fecha_inc,
            estado=estado
        ))
        
    # Proyectos
    proyectos_list = []
    for p in g.proyecto:
        estado_p = "active"
        if p.estado_proyecto == "Formulación":
            estado_p = "pending"
        elif p.estado_proyecto == "Concluido":
            estado_p = "completed"
        elif p.estado_proyecto == "Cancelado":
            estado_p = "cancelled"
            
        proyectos_list.append(FichaGrupoProyectoDetail(
            codigo=p.codigo_proyecto,
            titulo=p.titulo_proyecto,
            convocatoria=str(p.anio_convocatoria or ""),
            estado=estado_p
        ))
        
    coordinador_nombre = None
    if g.coordinador:
        coordinador_nombre = f"{g.coordinador.nombres} {g.coordinador.apellidos}"
        
    return FichaGrupoReportResponse(
        parametros=params,
        id_grupo=g.id_grupo,
        codigo_grupo=g.codigo_grupo,
        nombre_grupo=g.nombre_grupo,
        siglas=g.siglas,
        estado_grupo=g.estado_grupo,
        fecha_reconocimiento=g.fecha_reconocimiento.isoformat() if g.fecha_reconocimiento else None,
        lineas_investigacion=g.lineas_investigacion or [],
        coordinador_dni=g.dni_coordinador,
        coordinador_nombre=coordinador_nombre,
        articulos_scopus=pub_count,
        tesis_en_curso=tesis_count,
        miembros=miembros_list,
        proyectos=proyectos_list
    )
