import time
import random
import requests
from typing import Optional, Dict, Any
from cybertesis_connector.config import USER_AGENTS, HTTP_TIMEOUT, MAX_RETRIES, BACKOFF_FACTOR


class BaseClient:
    def __init__(self):
        self.session = requests.Session()

    def get_random_user_agent(self) -> str:
        """Retorna un User-Agent aleatorio de la lista configurada."""
        return random.choice(USER_AGENTS)

    def request(
        self,
        url: str,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
        quiet: bool = False,
    ) -> Optional[requests.Response]:
        """
        Realiza una petición HTTP GET de forma robusta con reintentos,
        backoff exponencial y rotación de User-Agent.
        """
        req_headers = {
            "User-Agent": self.get_random_user_agent(),
            "Accept": "application/json, text/html, */*",
        }
        if headers:
            req_headers.update(headers)

        retries = MAX_RETRIES
        backoff = BACKOFF_FACTOR

        for attempt in range(1, retries + 1):
            try:
                if not quiet and attempt > 1:
                    print(f"[HTTP Client] Reintentando petición a {url} (Intento {attempt}/{retries})...")

                response = self.session.get(url, params=params, headers=req_headers, timeout=HTTP_TIMEOUT)

                # Si es un error del servidor (5xx), reintentar
                if response.status_code >= 500:
                    if not quiet:
                        print(f"[HTTP Client] Error del servidor {response.status_code} en {url}.")
                    if attempt == retries:
                        return response
                    raise requests.RequestException(f"Error {response.status_code}")

                # Para cualquier otra respuesta (incluso 404), retornar inmediatamente sin reintentar
                return response

            except (requests.RequestException, Exception) as e:
                if attempt == retries:
                    if not quiet:
                        print(f"[HTTP Client] Error crítico de conexión tras {retries} intentos: {e}")
                    return None

                # Backoff exponencial con jitter aleatorio
                sleep_time = (backoff ** (attempt - 1)) + random.uniform(0.1, 0.5)
                if not quiet:
                    print(f"[HTTP Client] Fallo de red: {e}. Esperando {sleep_time:.2f}s antes de reintentar...")
                time.sleep(sleep_time)

                # Actualizar User-Agent para el siguiente intento por si es un bloqueo suave
                req_headers["User-Agent"] = self.get_random_user_agent()

        return None
