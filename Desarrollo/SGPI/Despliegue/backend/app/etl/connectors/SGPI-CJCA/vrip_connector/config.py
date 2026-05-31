import json
from pathlib import Path
from typing import Dict, Any, List


class Settings:
    def __init__(self):
        # Resolve project root (the directory containing vrip_connector)
        self.project_root = Path(__file__).resolve().parent.parent
        self.config_path = self.project_root / "config.json"
        self._config_data = self._load_config()

    def _load_config(self) -> Dict[str, Any]:
        if self.config_path.exists():
            try:
                with open(self.config_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                print(f"[Warning] Failed to load config.json: {e}")

        # Fallback hardcoded configuration if file is missing
        return {
            "vrip_convocatorias": {
                "url": "https://vrip.unmsm.edu.pe/convocatoria-2026/",
                "fallback_urls": [
                    "https://vrip.unmsm.edu.pe/convocatoria-2025/",
                    "https://vrip.unmsm.edu.pe/convocatoria-2024/",
                ],
                "selectors": {
                    "item": "article, .post, .entry, .type-post",
                    "title": "h2.entry-title a, h1.entry-title a, .post-title a, h2 a",
                    "date": ".entry-date, .date, time",
                    "link": "a[href*='bases'], a[href*='bases-y-anexos'], a[href*='pdf'], a.more-link, h2 a",
                },
            },
            "cybertesis": {
                "api_url": "https://cybertesis.unmsm.edu.pe/backend/api/discover/search/objects",
                "web_url": "https://cybertesis.unmsm.edu.pe",
            },
            "vrip_proyectos": {
                "wp_api_url": "https://vrip.unmsm.edu.pe/wp-json/wp/v2/posts",
                "categories_url": "https://vrip.unmsm.edu.pe/wp-json/wp/v2/categories",
                "media_url": "https://vrip.unmsm.edu.pe/wp-json/wp/v2/media",
            },
            "request_settings": {
                "timeout": 15,
                "max_retries": 3,
                "retry_delay_seconds": 2,
                "user_agents": [
                    (
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                    )
                ],
            },
        }

    @property
    def vrip_convocatorias(self) -> Dict[str, Any]:
        return self._config_data.get("vrip_convocatorias", {})

    @property
    def cybertesis(self) -> Dict[str, Any]:
        return self._config_data.get("cybertesis", {})

    @property
    def vrip_proyectos(self) -> Dict[str, Any]:
        return self._config_data.get("vrip_proyectos", {})

    @property
    def request_settings(self) -> Dict[str, Any]:
        return self._config_data.get("request_settings", {})

    @property
    def user_agents(self) -> List[str]:
        return self.request_settings.get(
            "user_agents",
            [
                (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                )
            ],
        )


settings = Settings()
