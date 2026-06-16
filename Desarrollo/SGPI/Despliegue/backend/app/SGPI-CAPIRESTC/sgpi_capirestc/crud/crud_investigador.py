from sgpi_capirestc.crud.crud_base import CRUDBase
from app.models.domain import Investigador
from sgpi_capirestc.schemas.domain_schemas import InvestigadorCreate, InvestigadorUpdate
from sqlalchemy.ext.asyncio import AsyncSession

class CRUDInvestigador(CRUDBase[Investigador, InvestigadorCreate, InvestigadorUpdate]):
    async def get_by_dni(self, db: AsyncSession, *, dni: str) -> Investigador:
        return await self.get(db, id=dni)

investigador = CRUDInvestigador(Investigador)
