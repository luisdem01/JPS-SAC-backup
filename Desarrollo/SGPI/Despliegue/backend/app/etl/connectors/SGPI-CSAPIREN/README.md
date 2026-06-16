# Conector RENACYT - SGPI Connector

Este módulo es un conector de alta confiabilidad y **sin dependencias externas** (utiliza únicamente la biblioteca estándar de Python) para realizar consultas de investigadores en la base de datos del Registro Nacional de Investigadores en Ciencia, Tecnología y de Innovación Tecnológica (RENACYT) de CONCYTEC, Perú.

Está integrado como conector funcional dentro del backend del **SGPI** bajo la ruta `backend/app/etl/connectors/SGPI-CSAPIREN`.

---

## Características Principales

1. **Cero Dependencias:** Utiliza librerías nativas (`urllib.request`, `ssl`, `json`).
2. **Redundancia y Conmutación por Error (Failover):** Alterna automáticamente entre múltiples endpoints oficiales de CONCYTEC si uno experimenta caídas.
3. **Control de Tasa (Rate Limiting):** Retardo inteligente configurable para prevenir bloqueos de seguridad.
4. **Reintentos Automáticos:** Utiliza retroceso exponencial en errores temporales de red.
5. **Evasión de SSL:** Soporta saltarse la validación estricta de SSL (deshabilitada por defecto) debido a la inestabilidad de certificados en sitios gubernamentales.
6. **Normalización de Datos:** Transforma todas las fechas y campos de la API cruda en un diccionario limpio en formato `snake_case`. La respuesta cruda e idéntica se mantiene en la clave `_raw`.

---

## Estructura del Módulo

El conector funcional está estructurado de la siguiente manera:
```text
SGPI-CSAPIREN/
├── requirements.txt           # Indicación de cero dependencias externas
├── README.md                  # Este documento
└── renacyt_connector/
    ├── __init__.py            # Exportaciones de funciones y cliente
    ├── __main__.py            # Entrada para ejecución con `python -m`
    ├── main.py                # Entrada estándar de ejecución directa
    ├── api.py                 # Cliente principal (RenacytConnector)
    ├── cli.py                 # Lógica de la CLI
    └── utils.py               # Normalización y formateo de datos
```

---

## Integración Programática (En el pipeline ETL)

Para utilizar este conector dentro de otros scripts del backend de SGPI, puede importarlo directamente agregando la ruta al `sys.path` o importando el submódulo:

```python
import sys
from pathlib import Path

# Agregar la ruta del conector al path si no está instalado como paquete
CONNECTOR_PATH = Path(__file__).resolve().parent / "connectors" / "SGPI-CSAPIREN"
sys.path.insert(0, str(CONNECTOR_PATH))

from renacyt_connector import search_by_dni, search_by_orcid

# Buscar por DNI
investigador = search_by_dni("19809928")
if investigador:
    print(f"Nombre: {investigador['nombre_completo']}")
    print(f"Nivel: {investigador['nivel']}")
```

---

## Uso desde Línea de Comandos (CLI)

Puede ejecutar y probar el conector desde la terminal directamente:

### 1. Ejecución con Python module (`-m`)
```bash
python -m renacyt_connector --dni 19809928
```

### 2. Ejecución con Script Directo
```bash
python renacyt_connector/main.py --orcid 0000-0002-8194-7946
```

### Opciones de Búsqueda
- `-d, --dni`: Consulta exacta por DNI o pasaporte.
- `-o, --orcid`: Consulta exacta por ID ORCID.
- `-c, --code`: Consulta exacta por Código RENACYT.
- `-n, --name`: Búsqueda parcial por nombres/apellidos.
- `-i, --institution`: Búsqueda parcial por institución principal.
- `-f, --format`: Formato de salida (`json`, `json-compact`, o `csv`).
- `-out, --output`: Guarda la salida directamente en un archivo local.
