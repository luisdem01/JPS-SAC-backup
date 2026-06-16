from fastapi import HTTPException
from app.core.logger import logger
import re

def handle_db_integrity_error(e: Exception):
    """
    Manejador centralizado de errores de integridad de base de datos (IntegrityError, etc.).
    Inspecciona las propiedades del error original (de asyncpg / psycopg2) de manera robusta
    utilizando códigos SQLSTATE y nombres de restricciones en lugar de depender únicamente
    de parsing de texto plano.
    """
    logger.error(f"Database integrity error caught: {e}", exc_info=True)
    
    # Intentar obtener sqlstate y constraint_name programáticamente
    orig = getattr(e, "orig", None)
    sqlstate = None
    constraint_name = None
    
    if orig:
        sqlstate = getattr(orig, "sqlstate", None)
        if not sqlstate:
            sqlstate = getattr(orig, "pgcode", None)
        constraint_name = getattr(orig, "constraint_name", None)
        
    error_msg = str(e)
    
    # 1. Manejo por códigos SQLSTATE y nombres de restricciones
    if sqlstate:
        # Unique Violation
        if sqlstate == "23505":
            if constraint_name:
                if "resolucion_aprobacion" in constraint_name:
                    raise HTTPException(status_code=400, detail="Ya existe un proyecto registrado con este número de resolución.")
                elif "codigo_proyecto" in constraint_name or "proyecto_pkey" in constraint_name:
                    raise HTTPException(status_code=400, detail="El código único de proyecto ingresado ya existe.")
                elif "investigador_proyecto_pkey" in constraint_name:
                    raise HTTPException(status_code=400, detail="El investigador ya está asignado a este proyecto.")
                elif "grupo_investigacion_pkey" in constraint_name or "codigo_grupo" in constraint_name or "grupo_investigacion_codigo_grupo_key" in constraint_name:
                    raise HTTPException(status_code=400, detail="El código único de grupo ingresado ya existe.")
                elif "investigador_pkey" in constraint_name or "dni" in constraint_name:
                    raise HTTPException(status_code=400, detail="El investigador ya está registrado con este DNI.")
            
            # Fallback en caso de que constraint_name sea None pero esté en el string del error
            if "resolucion_aprobacion" in error_msg:
                raise HTTPException(status_code=400, detail="Ya existe un proyecto registrado con este número de resolución.")
            elif "codigo_proyecto" in error_msg or "proyecto_pkey" in error_msg:
                raise HTTPException(status_code=400, detail="El código único de proyecto ingresado ya existe.")
            elif "investigador_proyecto_pkey" in error_msg:
                raise HTTPException(status_code=400, detail="El investigador ya está asignado a este proyecto.")
            elif "codigo_grupo" in error_msg or "grupo_investigacion" in error_msg:
                raise HTTPException(status_code=400, detail="El código único de grupo ingresado ya existe.")
            elif "investigador_pkey" in error_msg or "dni" in error_msg:
                raise HTTPException(status_code=400, detail="El investigador ya está registrado con este DNI.")
                
        # Foreign Key Violation
        elif sqlstate == "23503":
            if constraint_name:
                if "dni_investigador" in constraint_name:
                    raise HTTPException(status_code=400, detail="Uno o más investigadores no están registrados en el padrón de investigadores.")
                elif "id_usuario_responsable" in constraint_name:
                    raise HTTPException(status_code=400, detail="El usuario responsable no está registrado en el sistema.")
                elif "codigo_grupo" in constraint_name or "id_grupo" in constraint_name:
                    raise HTTPException(status_code=400, detail="El grupo de investigación seleccionado no existe.")
            
            # Fallback string matching
            if "dni_investigador" in error_msg or "investigador_proyecto_dni_investigador_fkey" in error_msg:
                raise HTTPException(status_code=400, detail="Uno o más investigadores no están registrados en el padrón de investigadores.")
            elif "id_usuario_responsable" in error_msg:
                raise HTTPException(status_code=400, detail="El usuario responsable no está registrado en el sistema.")
            elif "codigo_grupo" in error_msg or "id_grupo" in error_msg:
                raise HTTPException(status_code=400, detail="El grupo de investigación seleccionado no existe.")
                
        # Check Violation
        elif sqlstate == "23514":
            if constraint_name:
                if constraint_name == "proyecto_tipo_proyecto_check":
                    raise HTTPException(status_code=400, detail="El tipo de proyecto ingresado no es válido (debe ser Básico o Aplicado).")
                elif constraint_name == "proyecto_estado_proyecto_check":
                    raise HTTPException(status_code=400, detail="El estado de proyecto ingresado no es válido.")
            
            # Fallback string matching
            if "proyecto_tipo_proyecto_check" in error_msg:
                raise HTTPException(status_code=400, detail="El tipo de proyecto ingresado no es válido (debe ser Básico o Aplicado).")
            elif "proyecto_estado_proyecto_check" in error_msg:
                raise HTTPException(status_code=400, detail="El estado de proyecto ingresado no es válido.")

    # 2. Fallbacks basados en expresiones regulares / substrings para excepciones generales
    if "investigador_proyecto_dni_investigador_fkey" in error_msg:
        raise HTTPException(status_code=400, detail="Uno o más investigadores no están registrados en el padrón de investigadores.")
    elif "investigador_proyecto_pkey" in error_msg:
        raise HTTPException(status_code=400, detail="El investigador ya está asignado a este proyecto.")
    elif "proyecto_resolucion_aprobacion_key" in error_msg:
        raise HTTPException(status_code=400, detail="Ya existe un proyecto registrado con este número de resolución.")
    elif "proyecto_pkey" in error_msg or "already exists" in error_msg:
        if "grupo_investigacion" in error_msg or "codigo_grupo" in error_msg:
            raise HTTPException(status_code=400, detail="El código único de grupo ingresado ya existe.")
        raise HTTPException(status_code=400, detail="El código único de proyecto ingresado ya existe.")
    elif "dni" in error_msg and "already exists" in error_msg:
        raise HTTPException(status_code=400, detail="El investigador ya está registrado con este DNI.")
    elif "proyecto_tipo_proyecto_check" in error_msg:
        raise HTTPException(status_code=400, detail="El tipo de proyecto ingresado no es válido (debe ser Básico o Aplicado).")
    elif "proyecto_estado_proyecto_check" in error_msg:
        raise HTTPException(status_code=400, detail="El estado de proyecto ingresado no es válido.")
        
    # Extracción de mensaje de RaiseExceptionError si existe
    raise_match = re.search(r'(?:RaiseExceptionError|RaiseException|exception|CheckViolation|NotNullViolation)[^:\n]*:\s*(.*)', error_msg, re.IGNORECASE)
    if raise_match:
        clean_msg = raise_match.group(1).split('\n')[0].strip()
        clean_msg = re.split(r'\[SQL:', clean_msg, flags=re.IGNORECASE)[0].strip()
        if "violates check constraint" in clean_msg:
            const_match = re.search(r'violates check constraint "([^"]+)"', clean_msg)
            if const_match:
                c_name = const_match.group(1)
                if c_name == "proyecto_tipo_proyecto_check":
                    clean_msg = "El tipo de proyecto ingresado no es válido (debe ser Básico o Aplicado)."
                elif c_name == "proyecto_estado_proyecto_check":
                    clean_msg = "El estado de proyecto ingresado no es válido."
        raise HTTPException(status_code=400, detail=clean_msg)

    # Error genérico por defecto
    raise HTTPException(status_code=400, detail="Error de integridad de datos al procesar la operación.")
