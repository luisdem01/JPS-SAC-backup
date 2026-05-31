from abc import ABC, abstractmethod
from typing import List, Any
from vrip_connector.config import settings
from vrip_connector.core.client import client


class BaseExtractor(ABC):
    def __init__(self, source_name: str):
        self.source_name = source_name
        self.client = client

        # Select matching configuration
        if source_name == "vrip_convocatorias":
            self.source_config = settings.vrip_convocatorias
        elif source_name == "cybertesis":
            self.source_config = settings.cybertesis
        elif source_name == "vrip_proyectos":
            self.source_config = settings.vrip_proyectos
        else:
            self.source_config = {}

    @abstractmethod
    def extract(self, **kwargs) -> List[Any]:
        """Performs search and extraction. Returns list of parsed models."""
