from sgpi_capirestc.crud.crud_base import CRUDBase
from app.models.domain import ConfiguracionGlobal
from sgpi_capiac.schemas.capiac_schemas import ConfiguracionGlobalBase, ConfiguracionGlobalUpdate
from sqlalchemy.ext.asyncio import AsyncSession

class CRUDConfiguracionGlobal(CRUDBase[ConfiguracionGlobal, ConfiguracionGlobalBase, ConfiguracionGlobalUpdate]):
    async def get_by_clave(self, db: AsyncSession, *, clave: str) -> ConfiguracionGlobal:
        return await self.get(db, id=clave)

configuracion = CRUDConfiguracionGlobal(ConfiguracionGlobal)
