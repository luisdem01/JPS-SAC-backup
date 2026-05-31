from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from sgpi_capiac.crud.crud_configuracion import configuracion
from sgpi_capiac.schemas.capiac_schemas import ConfiguracionGlobalResponse, ConfiguracionGlobalUpdate
from app.core.security import require_admin

router = APIRouter()

@router.get("/", response_model=List[ConfiguracionGlobalResponse])
async def read_configuraciones(
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    Recuperar todas las variables de configuración global.
    """
    configuraciones = await configuracion.get_multi(db, skip=skip, limit=limit)
    return configuraciones

@router.get("/{clave}", response_model=ConfiguracionGlobalResponse)
async def read_configuracion_by_clave(
    clave: str,
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Obtener una variable de configuración global por su clave.
    """
    config_obj = await configuracion.get_by_clave(db, clave=clave)
    if not config_obj:
        raise HTTPException(status_code=404, detail="Configuración no encontrada")
    return config_obj

@router.put("/{clave}", response_model=ConfiguracionGlobalResponse)
async def update_configuracion(
    clave: str,
    config_in: ConfiguracionGlobalUpdate,
    db: AsyncSession = Depends(get_db),
    # Solo el administrador puede modificar la configuración global
    # TODO: Restaurar cuando se integre autenticación de usuarios
    # current_user: dict = Depends(require_admin)
) -> Any:
    """
    Actualizar un valor de configuración global (Solo Administradores).
    """
    config_obj = await configuracion.get_by_clave(db, clave=clave)
    if not config_obj:
        from app.models.domain import ConfiguracionGlobal
        new_config = ConfiguracionGlobal(clave=clave, valor=config_in.valor, descripcion=config_in.descripcion)
        db.add(new_config)
        await db.commit()
        await db.refresh(new_config)
        return new_config
        
    config_obj = await configuracion.update(db, db_obj=config_obj, obj_in=config_in)
    
    # La auditoría se maneja automáticamente en base de datos vía T7 si aplicara, o el backend lo registra
    return config_obj
