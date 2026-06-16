from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings

# ---------------------------------------------------------------------------
# Motor async (asyncpg)
# ---------------------------------------------------------------------------
# Supabase utiliza pgBouncer en modo "transaction pooling", lo que significa
# que las conexiones de servidor preparadas (prepared statements) no están
# soportadas. El parámetro "statement_cache_size=0" deshabilita el caché
# de sentencias de asyncpg para evitar errores con pgBouncer.
# ---------------------------------------------------------------------------
_engine_kwargs = {
    "echo": settings.ENVIRONMENT == "development",  # SQL visible sólo en dev
    "future": True,
    "pool_pre_ping": True,  # Descarta conexiones muertas antes de usarlas
    "pool_size": 5,  # Conexiones mantenidas en el pool
    "max_overflow": 10,  # Conexiones adicionales en pico de carga
    "pool_timeout": 30,  # Segundos de espera antes de lanzar error
    "pool_recycle": 1800,  # Recicla conexiones cada 30 min
    "connect_args": {
        "statement_cache_size": 0,  # Requerido por pgBouncer transaction mode
        "prepared_statement_cache_size": 0,
    },
}

engine = create_async_engine(settings.ASYNC_DATABASE_URL, **_engine_kwargs)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


from fastapi import Request
from jose import jwt
from sqlalchemy import text

# ---------------------------------------------------------------------------
# Dependencia FastAPI — inyección de sesión de base de datos
# ---------------------------------------------------------------------------
async def get_db(request: Request = None) -> AsyncGenerator[AsyncSession, None]:
    """
    Dependencia que provee una sesión async a los endpoints.
    Garantiza el cierre de la sesión incluso si ocurre una excepción.
    Intenta extraer el ID del usuario del JWT para configurar app.current_user_id en Postgres.
    """
    user_id = None
    if request:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            try:
                # Decodifica claims sin verificar firma para evitar fallos de red/caching
                # durante la inicialización de get_db. La seguridad real es validada
                # por Depends(get_current_user) en los endpoints.
                payload = jwt.get_unverified_claims(token)
                user_id = payload.get("sub")
            except Exception:
                pass

    async with AsyncSessionLocal() as session:
        if user_id:
            try:
                await session.execute(
                    text("SELECT set_config('app.current_user_id', :uid, true)"),
                    {"uid": str(user_id)}
                )
            except Exception:
                pass
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
