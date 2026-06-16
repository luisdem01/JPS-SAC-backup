from sgpi_capirestc.crud.crud_base import CRUDBase
from app.models.domain import Usuario
from sgpi_capirestc.schemas.domain_schemas import UsuarioBase, UsuarioUpdate
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Any


class CRUDUsuario(CRUDBase[Usuario, UsuarioBase, UsuarioUpdate]):
    async def get_by_id(self, db: AsyncSession, *, id_usuario: Any) -> Usuario:
        return await self.get(db, id=id_usuario)


usuario = CRUDUsuario(Usuario)
