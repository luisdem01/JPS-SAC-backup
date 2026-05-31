from typing import Any, List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from sgpi_capiac.crud.crud_log import log
from sgpi_capiac.schemas.capiac_schemas import LogAuditoriaResponse
from app.core.security import require_admin

router = APIRouter()

@router.get("/", response_model=List[LogAuditoriaResponse])
async def read_logs(
    db: AsyncSession = Depends(get_db),
    tipo_evento: Optional[str] = None,
    id_usuario: Optional[str] = None,
    fecha_inicio: Optional[datetime] = None,
    fecha_fin: Optional[datetime] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    # Requiere que el usuario sea administrador para ver logs de sistema
    current_user: dict = Depends(require_admin)
) -> Any:
    """
    Consultar los logs de auditoría del sistema (CU14).
    Solo para el Administrador. Incluye filtros opcionales.
    """
    logs_recuperados = await log.get_multi_filtered(
        db=db,
        tipo_evento=tipo_evento,
        id_usuario=id_usuario,
        fecha_inicio=fecha_inicio,
        fecha_fin=fecha_fin,
        skip=skip,
        limit=limit
    )
    return logs_recuperados


@router.get("/system", response_model=List[str])
async def read_system_logs(
    lines: int = Query(100, ge=1, le=1000),
    level: Optional[str] = None,
    current_user: dict = Depends(require_admin)
) -> Any:
    """
    Recupera las últimas N líneas del archivo de logs de diagnóstico del sistema (sgpi.log).
    Solo accesible para Administradores.
    """
    import os
    from fastapi import HTTPException
    from app.core.config import settings
    
    log_file_path = settings.LOG_FILE_PATH
    if not os.path.exists(log_file_path):
        return ["No se ha generado ningún log de diagnóstico aún."]
        
    try:
        matched_lines = []
        with open(log_file_path, "r", encoding="utf-8") as f:
            all_lines = f.readlines()
            
        filter_level = f"[{level.upper()}]" if level else None
        
        for line in reversed(all_lines):
            line_str = line.strip()
            if not line_str:
                continue
            if filter_level and filter_level not in line_str:
                continue
            matched_lines.append(line_str)
            if len(matched_lines) >= lines:
                break
                
        # Retornamos en orden cronológico (reversando de nuevo el resultado)
        matched_lines.reverse()
        return matched_lines
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Error leyendo logs del sistema: {str(exc)}"
        )


@router.get("/system/download")
async def download_system_logs(
    current_user: dict = Depends(require_admin)
) -> Any:
    """
    Permite descargar el archivo completo de logs de diagnóstico del sistema (sgpi.log).
    Solo accesible para Administradores.
    """
    import os
    from fastapi import HTTPException
    from fastapi.responses import FileResponse
    from app.core.config import settings
    
    log_file_path = settings.LOG_FILE_PATH
    if not os.path.exists(log_file_path):
        raise HTTPException(
            status_code=404,
            detail="Archivo de logs de diagnóstico no encontrado en el servidor."
        )
        
    return FileResponse(
        path=log_file_path,
        filename=os.path.basename(log_file_path),
        media_type="text/plain"
    )
