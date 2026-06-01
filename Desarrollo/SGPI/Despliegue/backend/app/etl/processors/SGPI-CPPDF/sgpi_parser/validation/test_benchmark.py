from pydantic import BaseModel
import typer

from sgpi_parser.core.models import ResolucionRectoral, Cronograma, ResultadosConcurso
from sgpi_parser.engines.heuristic.cronograma_heuristic import HeuristicCronogramaParser
from sgpi_parser.engines.heuristic.resultados_heuristic import HeuristicResultadosParser
from sgpi_parser.engines.heuristic.rr_heuristic import HeuristicRRParser
from sgpi_parser.utils.string_utils import fuzzy_match

def run_accuracy_comparison(pdf_path: str, golden_model: BaseModel):
    """
    Compara el resultado del motor heurístico local con el golden dataset
    generado por Gemini. Imprime una auditoría detallada de exactitud.
    """
    # 1. Determinar categoría y ejecutar parser heurístico local correspondiente
    tipo = golden_model.tipo_documento
    typer.echo("\n[BENCHMARK] Ejecutando motor heurístico local para comparación...")
    
    if tipo == "cronograma":
        local_parser = HeuristicCronogramaParser()
        local_model = local_parser.parse(pdf_path)
        _compare_cronogramas(golden_model, local_model)
    elif tipo == "resultados":
        local_parser = HeuristicResultadosParser()
        local_model = local_parser.parse(pdf_path)
        _compare_resultados(golden_model, local_model)
    elif tipo == "resolucion_rectoral":
        local_parser = HeuristicRRParser()
        local_model = local_parser.parse(pdf_path)
        _compare_resoluciones(golden_model, local_model)
    else:
        typer.echo(f"Error: Tipo de documento '{tipo}' no soportado para comparación.", err=True)

def _compare_cronogramas(golden: Cronograma, local: Cronograma):
    typer.echo("\n" + "=" * 50)
    typer.echo("    PANEL DE BENCHMARK: CRONOGRAMA")
    typer.echo("=" * 50)
    
    total_fields = 2 + len(golden.actividades) * 4
    successes = 0
    
    # Metadatos
    if fuzzy_match(golden.metadata.programa_nombre, local.metadata.programa_nombre) > 0.8:
        successes += 1
    else:
        typer.echo(f"[DIFERENCIA] Programa: \n  Golden: {golden.metadata.programa_nombre}\n  Local:  {local.metadata.programa_nombre}")
        
    if golden.metadata.anio_academico == local.metadata.anio_academico:
        successes += 1
    else:
        typer.echo(f"[DIFERENCIA] Año Académico: Golden={golden.metadata.anio_academico}, Local={local.metadata.anio_academico}")

    # Actividades
    golden_acts = golden.actividades
    local_acts = local.actividades
    
    typer.echo(f"\nActividades en Golden: {len(golden_acts)}")
    typer.echo(f"Actividades en Local:  {len(local_acts)}")
    
    for g_act in golden_acts:
        # Buscar la mejor coincidencia en local
        matched_l_act = None
        best_score = 0.7
        for l_act in local_acts:
            score = fuzzy_match(g_act.actividad, l_act.actividad)
            if score > best_score:
                best_score = score
                matched_l_act = l_act
                
        if not matched_l_act:
            typer.echo(f"[OMISIÓN LOCAL] Actividad no encontrada localmente: '{g_act.actividad}'")
            continue
            
        successes += 1  # Por encontrar la actividad
        
        # Comparar campos
        # 1. fecha_detalle
        if fuzzy_match(g_act.fecha_detalle, matched_l_act.fecha_detalle) > 0.8:
            successes += 1
        else:
            typer.echo(f"[DISCREPANCIA] Actividad '{g_act.actividad[:25]}...' - fecha_detalle: \n  Golden: {g_act.fecha_detalle}\n  Local:  {matched_l_act.fecha_detalle}")
            
        # 2. fecha_inicio
        if g_act.fecha_inicio == matched_l_act.fecha_inicio:
            successes += 1
        else:
            typer.echo(f"[DISCREPANCIA] Actividad '{g_act.actividad[:25]}...' - fecha_inicio: Golden={g_act.fecha_inicio}, Local={matched_l_act.fecha_inicio}")
            
        # 3. fecha_fin
        if g_act.fecha_fin == matched_l_act.fecha_fin:
            successes += 1
        else:
            typer.echo(f"[DISCREPANCIA] Actividad '{g_act.actividad[:25]}...' - fecha_fin: Golden={g_act.fecha_fin}, Local={matched_l_act.fecha_fin}")

    accuracy = (successes / total_fields) * 100 if total_fields > 0 else 0
    typer.echo("\n" + "-" * 50)
    typer.echo(f"TASA DE EXACTITUD GLOBAL: {accuracy:.2f}% ({successes}/{total_fields} aciertos)")
    typer.echo("-" * 50)

def _compare_resultados(golden: ResultadosConcurso, local: ResultadosConcurso):
    typer.echo("\n" + "=" * 50)
    typer.echo("    PANEL DE BENCHMARK: RESULTADOS DE CONCURSO")
    typer.echo("=" * 50)
    
    total_fields = 2 + len(golden.proyectos_aprobados) * 6
    successes = 0
    
    # Metadatos
    if fuzzy_match(golden.metadata.programa_nombre, local.metadata.programa_nombre) > 0.8:
        successes += 1
    else:
        typer.echo(f"[DIFERENCIA] Programa: \n  Golden: {golden.metadata.programa_nombre}\n  Local:  {local.metadata.programa_nombre}")
        
    if golden.metadata.anio_academico == local.metadata.anio_academico:
        successes += 1
    else:
        typer.echo(f"[DIFERENCIA] Año Académico: Golden={golden.metadata.anio_academico}, Local={local.metadata.anio_academico}")

    # Proyectos
    golden_projs = golden.proyectos_aprobados
    local_projs = local.proyectos_aprobados
    
    typer.echo(f"\nProyectos en Golden: {len(golden_projs)}")
    typer.echo(f"Proyectos en Local:  {len(local_projs)}")
    
    for g_proj in golden_projs:
        # Buscar por título fuzzy (mejor coincidencia)
        matched_l_proj = None
        best_score = 0.85
        for l_proj in local_projs:
            score = fuzzy_match(g_proj.titulo, l_proj.titulo)
            if score > best_score:
                best_score = score
                matched_l_proj = l_proj
                
        if not matched_l_proj:
            typer.echo(f"[OMISIÓN LOCAL] Proyecto no extraído por heurística: '{g_proj.titulo[:40]}...'")
            continue
            
        successes += 1 # Por emparejamiento
        
        # Comparar campos
        # 1. Responsable
        if g_proj.responsable and matched_l_proj.responsable and fuzzy_match(g_proj.responsable, matched_l_proj.responsable) > 0.8:
            successes += 1
        elif not g_proj.responsable and not matched_l_proj.responsable:
            successes += 1
        else:
            typer.echo(f"[DISCREPANCIA] Proyecto '{g_proj.titulo[:25]}...' - Responsable: \n  Golden: {g_proj.responsable}\n  Local:  {matched_l_proj.responsable}")
            
        # 2. Facultad
        if g_proj.facultad and matched_l_proj.facultad and fuzzy_match(g_proj.facultad, matched_l_proj.facultad) > 0.8:
            successes += 1
        elif not g_proj.facultad and not matched_l_proj.facultad:
            successes += 1
        else:
            typer.echo(f"[DISCREPANCIA] Proyecto '{g_proj.titulo[:25]}...' - Facultad: \n  Golden: {g_proj.facultad}\n  Local:  {matched_l_proj.facultad}")
            
        # 3. GI
        if g_proj.nombre_gi and matched_l_proj.nombre_gi and fuzzy_match(g_proj.nombre_gi, matched_l_proj.nombre_gi) > 0.8:
            successes += 1
        elif not g_proj.nombre_gi and not matched_l_proj.nombre_gi:
            successes += 1
        else:
            typer.echo(f"[DISCREPANCIA] Proyecto '{g_proj.titulo[:25]}...' - Grupo GI: \n  Golden: {g_proj.nombre_gi}\n  Local:  {matched_l_proj.nombre_gi}")
            
        # 4. Puntaje
        if g_proj.puntaje == matched_l_proj.puntaje:
            successes += 1
        else:
            typer.echo(f"[DISCREPANCIA] Proyecto '{g_proj.titulo[:25]}...' - Puntaje: Golden={g_proj.puntaje}, Local={matched_l_proj.puntaje}")
            
        # 5. Orden Mérito
        if g_proj.orden_merito == matched_l_proj.orden_merito:
            successes += 1
        else:
            typer.echo(f"[DISCREPANCIA] Proyecto '{g_proj.titulo[:25]}...' - Orden Mérito: Golden={g_proj.orden_merito}, Local={matched_l_proj.orden_merito}")

    accuracy = (successes / total_fields) * 100 if total_fields > 0 else 0
    typer.echo("\n" + "-" * 50)
    typer.echo(f"TASA DE EXACTITUD GLOBAL: {accuracy:.2f}% ({successes}/{total_fields} aciertos)")
    typer.echo("-" * 50)

def _compare_resoluciones(golden: ResolucionRectoral, local: ResolucionRectoral):
    typer.echo("\n" + "=" * 50)
    typer.echo("    PANEL DE BENCHMARK: RESOLUCIONES RECTORALES")
    typer.echo("=" * 50)
    
    total_fields = 3
    successes = 0
    
    # Metadatos
    if golden.metadata.numero_resolucion == local.metadata.numero_resolucion:
        successes += 1
    else:
        typer.echo(f"[DIFERENCIA] Número de Resolución: Golden='{golden.metadata.numero_resolucion}', Local='{local.metadata.numero_resolucion}'")
        
    if golden.metadata.anio_academico == local.metadata.anio_academico:
        successes += 1
    else:
        typer.echo(f"[DIFERENCIA] Año Académico: Golden={golden.metadata.anio_academico}, Local={local.metadata.anio_academico}")
        
    if golden.metadata.fecha_emision == local.metadata.fecha_emision:
        successes += 1
    else:
        typer.echo(f"[DIFERENCIA] Fecha Emisión: Golden={golden.metadata.fecha_emision}, Local={local.metadata.fecha_emision}")

    # Proyectos
    golden_projs = golden.proyectos
    local_projs = local.proyectos
    
    typer.echo(f"\nProyectos en Golden: {len(golden_projs)}")
    typer.echo(f"Proyectos en Local:  {len(local_projs)}")
    
    for g_proj in golden_projs:
        total_fields += 4 + len(g_proj.integrantes) * 6
        
        # Buscar por código de proyecto
        matched_l_proj = None
        for l_proj in local_projs:
            if g_proj.codigo_proyecto == l_proj.codigo_proyecto:
                matched_l_proj = l_proj
                break
                
        if not matched_l_proj:
            typer.echo(f"[OMISIÓN LOCAL] Proyecto no extraído por heurística: Code={g_proj.codigo_proyecto}")
            continue
            
        successes += 1 # Por encontrar el proyecto
        
        # Comparar título fuzzy
        if fuzzy_match(g_proj.titulo, matched_l_proj.titulo) > 0.8:
            successes += 1
        else:
            typer.echo(f"[DISCREPANCIA] Proyecto {g_proj.codigo_proyecto} - Título: \n  Golden: {g_proj.titulo}\n  Local:  {matched_l_proj.titulo}")
            
        # Presupuesto
        if g_proj.presupuesto == matched_l_proj.presupuesto:
            successes += 1
        else:
            typer.echo(f"[DISCREPANCIA] Proyecto {g_proj.codigo_proyecto} - Presupuesto: Golden={g_proj.presupuesto}, Local={matched_l_proj.presupuesto}")
            
        # Grupo GI
        if g_proj.nombre_gi == matched_l_proj.nombre_gi:
            successes += 1
        else:
            typer.echo(f"[DISCREPANCIA] Proyecto {g_proj.codigo_proyecto} - GI: Golden={g_proj.nombre_gi}, Local={matched_l_proj.nombre_gi}")

        # Integrantes
        g_ints = g_proj.integrantes
        l_ints = matched_l_proj.integrantes
        
        for g_int in g_ints:
            # Buscar integrante por código
            matched_l_int = None
            for l_int in l_ints:
                if g_int.codigo_miembro == l_int.codigo_miembro:
                    matched_l_int = l_int
                    break
            # Si no hay código (externo) o no se encuentra por código, buscar por nombre fuzzy (mejor coincidencia)
            if not matched_l_int:
                best_score = 0.85
                for l_int in l_ints:
                    score = fuzzy_match(g_int.nombre_completo, l_int.nombre_completo)
                    if score > best_score:
                        best_score = score
                        matched_l_int = l_int
                        
            if not matched_l_int:
                typer.echo(f"  [OMISIÓN LOCAL] Integrante no extraído: '{g_int.nombre_completo}' ({g_int.rol_proyecto})")
                continue
                
            successes += 1 # Por emparejamiento
            
            # Comparar campos del integrante
            # 1. Nombre completo
            if fuzzy_match(g_int.nombre_completo, matched_l_int.nombre_completo) > 0.85:
                successes += 1
            else:
                typer.echo(f"  [DISCREPANCIA] Integrante '{g_int.codigo_miembro}' - Nombre: \n    Golden: {g_int.nombre_completo}\n    Local:  {matched_l_int.nombre_completo}")
                
            # 2. Rol en proyecto
            if g_int.rol_proyecto and matched_l_int.rol_proyecto and fuzzy_match(g_int.rol_proyecto, matched_l_int.rol_proyecto) > 0.7:
                successes += 1
            elif not g_int.rol_proyecto and not matched_l_int.rol_proyecto:
                successes += 1
            else:
                typer.echo(f"  [DISCREPANCIA] Integrante '{g_int.nombre_completo}' - Rol: Golden={g_int.rol_proyecto}, Local={matched_l_int.rol_proyecto}")
                
            # 3. Tipo miembro
            if g_int.tipo_miembro and matched_l_int.tipo_miembro and fuzzy_match(g_int.tipo_miembro, matched_l_int.tipo_miembro) > 0.7:
                successes += 1
            elif not g_int.tipo_miembro and not matched_l_int.tipo_miembro:
                successes += 1
            else:
                typer.echo(f"  [DISCREPANCIA] Integrante '{g_int.nombre_completo}' - Tipo Miembro: Golden={g_int.tipo_miembro}, Local={matched_l_int.tipo_miembro}")
                
            # 4. Facultad
            if g_int.facultad and matched_l_int.facultad and fuzzy_match(g_int.facultad, matched_l_int.facultad) > 0.7:
                successes += 1
            elif not g_int.facultad and not matched_l_int.facultad:
                successes += 1
            else:
                typer.echo(f"  [DISCREPANCIA] Integrante '{g_int.nombre_completo}' - Facultad: Golden={g_int.facultad}, Local={matched_l_int.facultad}")
                
            # 5. Condición GI
            if g_int.gi_condicion and matched_l_int.gi_condicion and fuzzy_match(g_int.gi_condicion, matched_l_int.gi_condicion) > 0.7:
                successes += 1
            elif not g_int.gi_condicion and not matched_l_int.gi_condicion:
                successes += 1
            else:
                typer.echo(f"  [DISCREPANCIA] Integrante '{g_int.nombre_completo}' - Condición GI: Golden={g_int.gi_condicion}, Local={matched_l_int.gi_condicion}")

    accuracy = (successes / total_fields) * 100 if total_fields > 0 else 0
    typer.echo("\n" + "-" * 50)
    typer.echo(f"TASA DE EXACTITUD GLOBAL: {accuracy:.2f}% ({successes}/{total_fields} aciertos)")
    typer.echo("-" * 50)
