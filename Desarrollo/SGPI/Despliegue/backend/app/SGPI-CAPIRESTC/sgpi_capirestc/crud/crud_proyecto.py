from sgpi_capirestc.crud.crud_base import CRUDBase
from app.models.domain import Proyecto
from sgpi_capirestc.schemas.domain_schemas import ProyectoCreate, ProyectoUpdate
from sqlalchemy.ext.asyncio import AsyncSession


class CRUDProyecto(CRUDBase[Proyecto, ProyectoCreate, ProyectoUpdate]):
    async def get_by_codigo(self, db: AsyncSession, *, codigo: str) -> Proyecto:
        return await self.get(db, id=codigo)


proyecto = CRUDProyecto(Proyecto)
