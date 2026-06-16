from abc import ABC, abstractmethod
from pydantic import BaseModel


class BaseParser(ABC):
    """
    Clase abstracta base para todos los parsers de documentos del SGPI.
    """

    @abstractmethod
    def parse(self, pdf_path: str) -> BaseModel:
        """
        Parsea un archivo PDF y devuelve el modelo estructurado de Pydantic correspondiente.

        Args:
            pdf_path (str): Ruta absoluta al archivo PDF en el sistema de archivos local.

        Returns:
            BaseModel: Una instancia de ResolucionRectoral, Cronograma o ResultadosConcurso.
        """
