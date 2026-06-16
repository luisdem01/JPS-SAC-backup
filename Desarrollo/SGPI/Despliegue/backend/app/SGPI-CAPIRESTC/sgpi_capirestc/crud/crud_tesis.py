from sgpi_capirestc.crud.crud_base import CRUDBase
from app.models.domain import Tesis
from sgpi_capirestc.schemas.domain_schemas import TesisBase
from sqlalchemy.ext.asyncio import AsyncSession


class CRUDTesis(CRUDBase[Tesis, TesisBase, TesisBase]):
    async def get_by_url(self, db: AsyncSession, *, url: str) -> Tesis:
        return await self.get(db, id=url)


tesis = CRUDTesis(Tesis)
