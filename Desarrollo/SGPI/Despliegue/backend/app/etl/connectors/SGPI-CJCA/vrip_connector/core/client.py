import time
import random
import requests
from typing import Dict, Any, Optional
from colorama import Fore, Style
from vrip_connector.config import settings


class ResilientHTTPClient:
    def __init__(self):
        self.settings = settings.request_settings
        self.max_retries = self.settings.get("max_retries", 3)
        self.timeout = self.settings.get("timeout", 15)
        self.retry_delay = self.settings.get("retry_delay_seconds", 2)

    def _get_headers(self, custom_headers: Optional[Dict[str, str]] = None) -> Dict[str, str]:
        headers = {
            "User-Agent": random.choice(settings.user_agents),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,application/json,*/*;q=0.8",
            "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
            "Referer": "https://www.google.com/",
        }
        if custom_headers:
            headers.update(custom_headers)
        return headers

    def get(
        self, url: str, params: Optional[Dict[str, Any]] = None, custom_headers: Optional[Dict[str, str]] = None
    ) -> Optional[requests.Response]:
        """Performs a GET request with exponential backoff and random jitter."""
        headers = self._get_headers(custom_headers)

        for attempt in range(1, self.max_retries + 1):
            try:
                # Print debug information unless quiet mode is active
                # We will check an environment variable or class attribute if we want to silence it
                print(
                    f"{Fore.CYAN}[HTTP GET]{Style.RESET_ALL} "
                    f"Conectando a {url} (Intento {attempt}/{self.max_retries})..."
                )
                response = requests.get(url, headers=headers, params=params, timeout=self.timeout)

                # Check status code
                response.raise_for_status()
                return response

            except requests.exceptions.HTTPError as he:
                status_code = getattr(he.response, "status_code", None)
                print(
                    f"{Fore.YELLOW}[Advertencia HTTP]{Style.RESET_ALL} Código de estado {status_code} al conectar: {he}"
                )
                if status_code in [404]:
                    # Not found - retrying won't help
                    break
                if status_code in [403]:
                    # Forbidden, rotate headers and retry
                    headers = self._get_headers(custom_headers)
            except requests.exceptions.RequestException as re:
                print(f"{Fore.YELLOW}[Advertencia de Red]{Style.RESET_ALL} Intento {attempt} fallido: {re}")

            if attempt < self.max_retries:
                # Exponential backoff with jitter
                sleep_time = self.retry_delay * (2 ** (attempt - 1)) + random.uniform(0.2, 1.0)
                print(f"{Fore.BLUE}[Red]{Style.RESET_ALL} Esperando {sleep_time:.2f} segundos antes de reintentar...")
                time.sleep(sleep_time)

        print(
            f"{Fore.RED}[Error]{Style.RESET_ALL} "
            f"No se pudo establecer conexión con {url} después de {self.max_retries} intentos."
        )
        return None


client = ResilientHTTPClient()
