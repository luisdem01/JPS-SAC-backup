import os
from pathlib import Path
from dotenv import load_dotenv

# Cargar variables de entorno desde el archivo .env si existe
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

# Configuración del servidor de Cybertesis
CYBERTESIS_API_URL = os.getenv(
    "CYBERTESIS_API_URL", "https://cybertesis.unmsm.edu.pe/backend/api/discover/search/objects"
)
CYBERTESIS_WEB_URL = os.getenv("CYBERTESIS_WEB_URL", "https://cybertesis.unmsm.edu.pe")

# Parámetros por defecto para peticiones y reintentos
DEFAULT_PAGE_SIZE = int(os.getenv("DEFAULT_PAGE_SIZE", "20"))
HTTP_TIMEOUT = int(os.getenv("HTTP_TIMEOUT", "15"))
MAX_RETRIES = int(os.getenv("MAX_RETRIES", "3"))
BACKOFF_FACTOR = float(os.getenv("BACKOFF_FACTOR", "2.0"))

# Lista de agentes de usuario comunes para rotación en peticiones live
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 "
        "(KHTML, like Gecko) Version/17.3 Safari/605.1.15"
    ),
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
    (
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_3_1 like Mac OS X) AppleWebKit/605.1.15 "
        "(KHTML, like Gecko) Version/17.3.1 Mobile/15E148 Safari/604.1"
    ),
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36",
]
