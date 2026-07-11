from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


class Settings(BaseSettings):
    PROJECT_NAME: str = "SGPI - Sistema de Gestión de Proyectos de Investigación"
    VERSION: str = "1.0.0"

    # Entorno: "development" | "production"
    ENVIRONMENT: str = "development"

    # -------------------------------------------------------------------------
    # Base de datos — Supabase (PostgreSQL vía pgBouncer)
    # La variable DATABASE_URL en .env debe usar el driver nativo de postgres:
    #   postgresql://user:pass@host:port/db?pgbouncer=true
    # Aquí derivamos la URL async (asyncpg) automáticamente.
    # -------------------------------------------------------------------------
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/sgpi"

    @property
    def ASYNC_DATABASE_URL(self) -> str:
        """
        Convierte la URL de conexión a formato asyncpg requerido por SQLAlchemy async.

        Nota: El parámetro ?pgbouncer=true es un hint exclusivo del proxy HTTP de
        Supabase (para el cliente JS). asyncpg no lo reconoce como parámetro válido
        de conexión PostgreSQL, por lo que se elimina de la query string.
        """
        from urllib.parse import urlparse, urlencode, parse_qs, urlunparse

        url = self.DATABASE_URL

        # Normalizar el scheme a postgresql+asyncpg
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)

        # Eliminar parámetros que asyncpg no entiende (pgbouncer, sslmode, etc.)
        _UNSUPPORTED_PARAMS = {"pgbouncer"}
        parsed = urlparse(url)
        qs = parse_qs(parsed.query, keep_blank_values=True)
        filtered_qs = {k: v for k, v in qs.items() if k.lower() not in _UNSUPPORTED_PARAMS}
        new_query = urlencode(filtered_qs, doseq=True)
        clean_url = urlunparse(parsed._replace(query=new_query))

        return clean_url

    # -------------------------------------------------------------------------
    # CORS — Orígenes permitidos
    # En .env puede definirse como lista separada por comas:
    #   FRONTEND_ORIGINS=http://localhost:3000,https://mi-dominio.com
    # -------------------------------------------------------------------------
    FRONTEND_ORIGINS: str = "http://localhost:3000"

    @property
    def ALLOWED_ORIGINS(self) -> List[str]:
        """Devuelve la lista de orígenes permitidos para CORS."""
        return [o.strip() for o in self.FRONTEND_ORIGINS.split(",") if o.strip()]

    # -------------------------------------------------------------------------
    # Supabase Auth
    # -------------------------------------------------------------------------
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""
    JWT_SECRET: str = ""

    # -------------------------------------------------------------------------
    # Logging Configuration
    # -------------------------------------------------------------------------
    LOG_LEVEL: str = "INFO"
    LOG_FILE_PATH: str = "logs/sgpi.log"
    LOG_MAX_BYTES: int = 10485760  # 10MB
    LOG_BACKUP_COUNT: int = 5

    # -------------------------------------------------------------------------
    # Redis Cache Configuration
    # -------------------------------------------------------------------------
    REDIS_URL: str = "redis://localhost:6379/0"

    # -------------------------------------------------------------------------
    # Rate Limiting de conectores (segundos)
    # -------------------------------------------------------------------------
    RENACYT_RATE_LIMIT_SECONDS: float = 0.5

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8-sig",
        extra="ignore",
    )


settings = Settings()
