import json
import unicodedata
from datetime import datetime, date
from typing import Optional, Any
import redis.asyncio as redis

from app.core.config import settings
from app.core.logger import logger

# Active Redis client instance
_redis_client: Optional[redis.Redis] = None


class DateTimeEncoder(json.JSONEncoder):
    """
    Custom JSON encoder that serializes datetime and date objects to ISO 8601 strings.
    """

    def default(self, obj):
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        return super().default(obj)


def get_redis_client() -> redis.Redis:
    """
    Returns the active Redis client connection. Initializes it if not already connected.
    """
    global _redis_client
    if _redis_client is None:
        logger.info(f"Initializing Redis client with URL: {settings.REDIS_URL}")
        _redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis_client


async def close_redis() -> None:
    """
    Closes the Redis client connection pool on application shutdown.
    """
    global _redis_client
    if _redis_client is not None:
        logger.info("Closing Redis connection pool...")
        await _redis_client.close()
        _redis_client = None
        logger.info("Redis connection pool closed.")


def normalize_query(query: str) -> str:
    """
    Normalizes a search query string:
    - Strips leading/trailing whitespace
    - Lowercases the text
    - Removes accents/diacritics (e.g. á -> a, ñ remains or is simplified, standard NFD normalization)
    - Replaces multiple consecutive spaces with a single space
    """
    if not query:
        return ""

    # Trim and lowercase
    q = query.strip().lower()

    # Remove accents using NFD normalization
    normalized_chars = []
    for c in unicodedata.normalize("NFD", q):
        # Keep non-spacing marks out of the string to strip accents
        if unicodedata.category(c) != "Mn":
            normalized_chars.append(c)

    q = "".join(normalized_chars)

    # Condense spaces
    q = " ".join(q.split())
    return q


async def cache_get(key: str) -> Optional[Any]:
    """
    Retrieves and deserializes a JSON value from Redis by key.
    Returns None if the key does not exist or on failure.
    """
    try:
        client = get_redis_client()
        val = await client.get(key)
        if val is not None:
            return json.loads(val)
    except Exception as e:
        logger.debug(f"Redis cache no disponible (lectura omitida): {e}")
    return None


async def cache_set(key: str, value: Any, expire_seconds: int) -> bool:
    """
    Serializes a value to JSON and stores it in Redis with the given expiration TTL.
    Returns True on success, False on failure.
    """
    try:
        client = get_redis_client()
        serialized = json.dumps(value, cls=DateTimeEncoder)
        await client.set(key, serialized, ex=expire_seconds)
        return True
    except Exception as e:
        logger.debug(f"Redis cache no disponible (escritura omitida): {e}")
        return False
