import sys
import asyncio
sys.path.append('app')
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from app.core.config import settings

async def main():
    engine = create_async_engine(settings.ASYNC_DATABASE_URL)
    async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with async_session() as session:
        res = await session.execute(text('SELECT filters FROM sync_job ORDER BY created_at DESC LIMIT 1'))
        filters = res.scalar()
        print('DB FILTERS:', filters)

asyncio.run(main())
