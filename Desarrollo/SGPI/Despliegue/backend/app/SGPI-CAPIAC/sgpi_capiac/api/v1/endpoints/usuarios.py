from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.db.session import get_db
from sgpi_capiac.crud import crud_usuario
from sgpi_capiac.schemas.capiac_schemas import UsuarioResponse, UsuarioCreate, UsuarioUpdate

router = APIRouter()


@router.get("", response_model=List[UsuarioResponse])
async def read_usuarios(db: AsyncSession = Depends(get_db), skip: int = 0, limit: int = 100) -> Any:
    """
    Recupera todos los usuarios.
    """
    # En el futuro se añadirá paginación, filtros o auth
    usuarios = await crud_usuario.usuario.get_multi(db, skip=skip, limit=limit)
    return usuarios


@router.post("", response_model=UsuarioResponse)
async def create_usuario(
    *,
    db: AsyncSession = Depends(get_db),
    usuario_in: UsuarioCreate,
) -> Any:
    """
    Crea un nuevo usuario en Supabase Auth y en la base de datos SQL.
    """
    # TODO: Integrar current_user
    current_user_id = None

    # Validar si ya existe el correo
    try:
        usuario_creado = await crud_usuario.usuario.create_with_auth(
            db=db, obj_in=usuario_in, current_user_id=current_user_id
        )
        return usuario_creado
    except Exception as e:
        # Aquí capturamos errores de Supabase Auth (e.g. Email is already registered)
        error_msg = str(e)
        if "already registered" in error_msg.lower():
            raise HTTPException(status_code=400, detail="El correo institucional ya está registrado.")
        raise HTTPException(status_code=500, detail=f"Error creando usuario: {error_msg}")


@router.patch("/{id_usuario}/estado", response_model=UsuarioResponse)
async def toggle_estado_usuario(
    *,
    db: AsyncSession = Depends(get_db),
    id_usuario: UUID,
    is_active: bool,
) -> Any:
    """
    Habilita o deshabilita un usuario por su UUID.
    """
    # TODO: Integrar current_user
    current_user_id = None

    usuario_actualizado = await crud_usuario.usuario.update_status(
        db=db, id_usuario=id_usuario, is_active=is_active, current_user_id=current_user_id
    )
    if not usuario_actualizado:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    return usuario_actualizado


@router.put("/{id_usuario}", response_model=UsuarioResponse)
async def update_usuario(
    *,
    db: AsyncSession = Depends(get_db),
    id_usuario: UUID,
    usuario_in: UsuarioUpdate,
) -> Any:
    """
    Actualiza la información de un usuario (rol, estado de cuenta).
    """
    # TODO: Integrar current_user
    current_user_id = None
    
    usuario_obj = await crud_usuario.usuario.get(db, id=id_usuario)
    if not usuario_obj:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
    usuario_actualizado = await crud_usuario.usuario.update_usuario(
        db=db,
        db_obj=usuario_obj,
        obj_in=usuario_in,
        current_user_id=current_user_id
    )
    return usuario_actualizado


@router.delete("/{id_usuario}")
async def delete_usuario(
    *,
    db: AsyncSession = Depends(get_db),
    id_usuario: UUID,
) -> Any:
    """
    Elimina un usuario por su UUID, tanto de Supabase Auth como de la base de datos SQL.
    """
    # TODO: Integrar current_user
    current_user_id = None
    
    eliminado = await crud_usuario.usuario.delete_user(
        db=db,
        id_usuario=id_usuario,
        current_user_id=current_user_id
    )
    if not eliminado:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
    return {"status": "success", "message": "Usuario eliminado correctamente"}
