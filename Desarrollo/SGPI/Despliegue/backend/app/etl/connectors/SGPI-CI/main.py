import sys
from pathlib import Path

# Configurar encoding UTF-8 para evitar errores con tildes/ñ en Windows
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
if hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Agregar el directorio raíz al path para ejecuciones directas sin instalación
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sgpi_ci.cli import main  # noqa: E402

if __name__ == "__main__":
    main()
