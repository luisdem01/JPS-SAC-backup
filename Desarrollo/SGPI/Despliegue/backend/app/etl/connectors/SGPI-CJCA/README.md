# Guía de Desarrollo - Módulo de Semaforización de Alertas y Conector VRIP (SGPI-CJCA)

Este directorio contiene la versión funcional consolidada del **Job de Semaforización de Alertas** y el motor de scraping **vrip_connector** para el Vicerrectorado de Investigación y Posgrado (VRIP). Ha sido empaquetado de forma limpia para su distribución y despliegue en entornos de staging o producción.

---

## 📂 Estructura del Módulo

* **`main.py`**: Servidor/API FastAPI. Orquesta la sincronización asíncrona bajo demanda (CU03) en segundo plano para no bloquear el flujo del cliente.
* **`cron_runner.py`**: Interfaz de Línea de Comandos (CLI) que actúa como punto de entrada para planificadores automáticos de tareas externas (ej. Tareas Programadas de Windows, Render Cron, etc.).
* **`requirements.txt`**: Listado de dependencias necesarias del módulo de Python.
* **`config.json`**: Parámetros de selectores CSS y lista rotativa de User-Agents para el scraper de Playwright/BeautifulSoup.
- **`db/`**:
  - `connection.py`: Proveedor de sesiones SQLAlchemy (`get_db`) que maneja las conexiones y liberaciones de recursos relacionales.
  - `models.py`: Mapeo exacto de las entidades físicas relacionales `convocatoria` y `log_auditoria` conformes con el esquema de base de datos de producción.
- **`jobs/`**:
  - `alerts_job.py`: Núcleo de control de sincronización, conciliación de registros, reglas de negocio e inserción segura de logs de auditoría.
- **`vrip_connector/`**: Motor autónomo de extracción web (scraped) en vivo de convocatorias activas.

---

## ⚙️ Configuración y Variables de Entorno

Este entregable ha sido empaquetado **sin archivos de configuración local `.env`**. Para que el módulo funcione correctamente en producción, la plataforma de hosting o el servidor debe proveer las siguientes variables de entorno:

1. **`DATABASE_URL`** *(Obligatorio)*: Cadena de conexión JDBC/SQLAlchemy para la base de datos relacional (ej. PostgreSQL en producción).
   * *Ejemplo*: `postgresql://usuario:password@host:5432/sgpi_db`
   * *Fallback en desarrollo*: Soporta cadenas SQLite locales para pruebas rápidas (ej. `sqlite:///test.db`).

2. **`VRIP_CONNECTOR_PATH`** *(Opcional)*: Ruta al conector VRIP. 
   * *Nota*: `alerts_job.py` ha sido optimizado con una estrategia de resolución relativa inteligente. Si la carpeta `vrip_connector` se ubica exactamente en este directorio (comportamiento por defecto del empaquetado), el job la priorizará automáticamente sin necesidad de configurar esta variable.

---

## 💻 Modos de Ejecución

### 1. Modo API asíncrona (FastAPI)
Adecuado para integraciones Web bajo demanda (CU03). 

1. Levantar el servidor:
   ```bash
   pip install -r requirements.txt
   uvicorn main:app --host 0.0.0.0 --port 8000
   ```
2. Ejecutar la sincronización mediante petición HTTP POST. Devuelve `202 Accepted` de forma inmediata (latencia $<2$ segundos) liberando al cliente mientras el scraper se ejecuta en segundo plano:
   ```bash
   curl -X POST http://localhost:8000/sync/vrip -H "X-User-Id: <UUID_DEL_ADMINISTRADOR>"
   ```
3. Endpoint de Keep-Alive / Health Check:
   ```bash
   curl http://localhost:8000/health
   ```

### 2. Modo CLI (Cron Job)
Ideal para ejecuciones automáticas programadas de madrugada.

* Sincronizar el año actual de forma desatendida por el sistema:
  ```bash
  python cron_runner.py
  ```
* Sincronizar un año específico simulando que lo ejecuta un administrador en particular (para trazabilidad en auditoría):
  ```bash
  python cron_runner.py --user-id "8717d788-1aeb-407e-b30b-80e04c9400d2" --year 2026
  ```

---

## ⚠️ Consideraciones de Desarrollo y Reglas de Negocio

Para mantener la consistencia del sistema en futuras iteraciones de mantenimiento, el equipo de desarrollo debe respetar los siguientes puntos clave:

### A. Regla de Reconciliación no Destructiva (Upsert Seguro)
Durante la sincronización automatizada, las convocatorias que ya existen en la base de datos se actualizan (`is_modified`), pero **nunca** deben sobrescribirse campos administrados manualmente. Por lo tanto, campos como el presupuesto asignado, resoluciones físicas cargadas por Secretaría o evidencias de difusión cargadas en tablas relacionadas deben quedar intactos y protegidos ante ejecuciones repetitivas del scraper.

### B. Historización del Cronograma (CU12)
Cuando el scraper detecta una alteración en la fecha física de cierre (`fecha_cierre`) de una convocatoria existente:
1. Se actualiza el campo `fecha_cierre` en el modelo.
2. Se registra de manera incremental el cambio en el campo `cambios_cronograma` (mapeado como JSONB en producción).
3. Se calcula de manera lógica y descriptiva si el desplazamiento constituye una **Ampliación** (extensión de la fecha límite) o un **Adelanto** del cronograma original para enriquecer la trazabilidad del proceso en base de datos.

### C. Restricción de Inmutabilidad de Auditoría (Trigger T5)
La base de datos de producción cuenta con una regla estricta (Trigger T5) sobre la tabla `log_auditoria` que prohíbe cualquier operación de `UPDATE` o `DELETE` para evitar manipulación de logs de sistema. El código de `alerts_job.py` respeta esto estrictamente realizando únicamente sentencias directas de inserción (`INSERT`) a través de SQLAlchemy. **Nunca modifique un registro de auditoría existente**.

### D. La trampa de Afinidad Numérica en SQLite (Para Desarrolladores Locales)
Si utiliza SQLite localmente para pruebas rápidas de desarrollo, recuerde que SQLite no tiene un tipo `UUID` nativo y aplica reglas de afinidad por defecto (`NUMERIC` en este caso). 
* *Advertencia*: Si utiliza UUIDs compuestos puramente de dígitos y guiones (ej. `"11111111-2222-3333-4444-555555555555"`), SQLite intentará convertir la cadena hexadecimal limpia a un valor numérico (`REAL`), causando una corrupción del valor y rompiendo el tipado en Python (`uuid.UUID`).
* *Solución*: Para pruebas locales, use siempre identificadores con caracteres hexadecimales mixtos (que incluyan al menos una letra, ej. `"11111111-2222-3333-4444-55555555555a"` o `uuid.uuid4()`).

### E. Semaforización Dinámica
La semaforización de alertas (Verde, Amarillo, Rojo, Inactiva, Vencida) **no se almacena físicamente** como columnas en la tabla `convocatoria`. Esto evita redundancias y es resuelto dinámicamente en tiempo de ejecución por la base de datos a través de la vista relacional `vista_convocatoria` (calculada basándose en `fecha_cierre` y `estado_convocatoria`), garantizando el rendimiento global de las consultas.
