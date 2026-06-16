from typing import List, Optional
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import desc
from app.models.domain import LogAuditoria


class CRUDLogAuditoria:
    async def get_multi_filtered(
        self,
        db: AsyncSession,
        *,
        tipo_evento: Optional[str] = None,
        id_usuario: Optional[str] = None,
        fecha_inicio: Optional[datetime] = None,
        fecha_fin: Optional[datetime] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> List[LogAuditoria]:

        stmt = select(LogAuditoria)

        if tipo_evento:
            stmt = stmt.where(LogAuditoria.tipo_evento == tipo_evento)
        if id_usuario:
            stmt = stmt.where(LogAuditoria.id_usuario == id_usuario)
        if fecha_inicio:
            stmt = stmt.where(LogAuditoria.timestamp_evento >= fecha_inicio)
        if fecha_fin:
            stmt = stmt.where(LogAuditoria.timestamp_evento <= fecha_fin)

        stmt = stmt.order_by(desc(LogAuditoria.timestamp_evento))
        stmt = stmt.offset(skip).limit(limit)

        result = await db.execute(stmt)
        return result.scalars().all()


log = CRUDLogAuditoria()
