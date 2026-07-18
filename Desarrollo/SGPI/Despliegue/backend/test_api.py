import sys, asyncio
sys.path.append('app')
from app.db.session import async_session_maker
from app.SGPI_CAPIRESTC.sgpi_capirestc.api.v1.endpoints.sync import get_active_job, _sync_jobs
async def main():
    async with async_session_maker() as db:
        res = await get_active_job(db, {'id_usuario': 'test'})
        print(res)
asyncio.run(main())
