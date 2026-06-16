import os
from pathlib import Path
from typing import Optional


# Carga básica de archivo .env de forma manual para evitar dependencias innecesarias
def load_dotenv(dotenv_path: Path):
    if dotenv_path.exists():
        with open(dotenv_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, val = line.split("=", 1)
                    key = key.strip()
                    val = val.strip().strip("'\"")
                    os.environ[key] = val


# Buscar .env en el directorio actual o en la raíz del proyecto
workspace_root = Path(__file__).resolve().parent.parent
load_dotenv(workspace_root / ".env")
load_dotenv(Path.cwd() / ".env")


# Configuraciones globales de la aplicación
class Settings:
    GEMINI_API_KEY: Optional[str] = os.environ.get("GEMINI_API_KEY")

    # Nombre del modelo a usar en el benchmark/validación
    GEMINI_MODEL: str = os.environ.get("GEMINI_MODEL", "gemini-2.5-pro")

    # Configuración de Tesseract OCR
    TESSERACT_CMD: Optional[str] = os.environ.get("TESSERACT_CMD", r"C:\Program Files\Tesseract-OCR\tesseract.exe")
    OCR_DENSITY_THRESHOLD: int = int(os.environ.get("OCR_DENSITY_THRESHOLD", "150"))
    OCR_LANGUAGE: str = os.environ.get("OCR_LANGUAGE", "spa")
    OCR_DPI: int = int(os.environ.get("OCR_DPI", "300"))


settings = Settings()

# Configurar ruta del binario de pytesseract si existe y está instalado
if settings.TESSERACT_CMD:
    try:
        import pytesseract

        pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD
    except Exception:
        pass
