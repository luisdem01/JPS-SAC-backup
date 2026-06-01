from sgpi_capirestc.crud.crud_base import CRUDBase
from app.models.domain import GrupoInvestigacion
from sgpi_capirestc.schemas.domain_schemas import GrupoInvestigacionCreate, GrupoInvestigacionUpdate
from sqlalchemy.ext.asyncio import AsyncSession


class CRUDGrupoInvestigacion(CRUDBase[GrupoInvestigacion, GrupoInvestigacionCreate, GrupoInvestigacionUpdate]):
    async def get_by_codigo(self, db: AsyncSession, *, codigo: str) -> GrupoInvestigacion:
        from sqlalchemy.future import select
        result = await db.execute(select(GrupoInvestigacion).where(GrupoInvestigacion.codigo_grupo == codigo))
        return result.scalars().first()


grupo = CRUDGrupoInvestigacion(GrupoInvestigacion)
