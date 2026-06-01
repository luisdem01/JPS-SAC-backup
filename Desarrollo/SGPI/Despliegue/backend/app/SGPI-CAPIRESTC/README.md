# SGPI-CAPIRESTC

**CAPIRESTC** (Core API REST Controller) es el módulo principal que actúa como Gateway HTTP para el backend del SGPI, exponiendo todos los endpoints necesarios para el frontend en React/Next.js.

## Estructura
- `/api/v1/endpoints/`: Controladores de rutas de la API.
- `/crud/`: Lógica de acceso a base de datos.
- `/schemas/`: Modelos de validación Pydantic.

## Integración Frontend-Backend (Importación de Datos)

El módulo de importación masiva en el frontend (`SGPI-CFIM`) requiere ejecutar lógicas de extracción de datos (ETL) y enriquecimiento con RENACYT que resultan extremadamente pesadas y demoradas. Estas lógicas viven internamente en un paquete Python separado llamado **`SGPI-CI`** (`backend/app/etl/connectors/SGPI-CI`).

Dado que `SGPI-CI` originalmente opera como CLI y no dispone de interfaz web, `CAPIRESTC` incluye el endpoint **`import_ci.py`** como un "puente" para conectar el Frontend con este ETL.

### Flujo de la integración:
1. **Frontend (`SGPI-CFIM/page.tsx`)**: Sube un archivo de Excel llamando a `POST /api/v1/import/excel`.
2. **Backend Puente (`import_ci.py`)**: 
   - Guarda el archivo en un directorio temporal (`/tmp_uploads/`).
   - Importa dinámicamente el `EtlProcessor` del módulo `SGPI-CI` modificando el `sys.path`.
   - Lanza el método de procesamiento `.process(upload_to_db=True)` **dentro de un thread en background** (usando `asyncio.to_thread`) para no bloquear el Event Loop de FastAPI, dado que la carga puede tomar entre 15 y 20 minutos debido a las latencias de las consultas a RENACYT.
   - Devuelve instantáneamente un `job_id` al frontend.
3. **Frontend Polling (`SGPI-CFIM/preview/page.tsx`)**: Consulta cada 2 segundos a `GET /api/v1/import/{job_id}/status`.
4. **Respuesta final**: El endpoint mantiene una estructura en memoria (`_jobs`) que dictamina el estado de la tarea. Al finalizar el ETL, extrae las estadísticas del JSON de resultado (creados, actualizados, errores) y las devuelve al cliente en el estado `completed`, permitiendo que el Frontend avance a la vista de Resultados (`/results`).

*NOTA*: El diccionario de tracking en memoria (`_jobs`) se perderá si el servidor uvicorn se reinicia. En producción con múltiples workers (Gunicorn) será necesario mover este estado a Redis o a una tabla temporal en PostgreSQL.
