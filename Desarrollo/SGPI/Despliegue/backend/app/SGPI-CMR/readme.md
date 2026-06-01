# SGPI-CMR — Central de Mapeo y Reconciliación

## ¿Qué es este módulo?

`SGPI-CMR` es el **árbitro de datos** del sistema. Su función es recibir lotes de registros provenientes de múltiples fuentes externas (RAIS, RENACYT, VRIP, Cybertesis) y decidir — aplicando reglas de prioridad definidas — qué versión de cada dato es la correcta para persistir en la base de datos principal.

El problema que resuelve es el siguiente: si RENACYT dice que un investigador tiene categoría "Investigador I" y el RAIS dice que tiene "Investigador II", ¿cuál gana? Este módulo define y aplica esas reglas de forma automática, y cuando no puede decidir con seguridad, envía el registro a una **cola de cuarentena** para que un administrador lo resuelva manualmente.

---

## Contenido de la carpeta

```
SGPI-CMR/
└── sgpi_cmr/
    ├── api/
    │   └── reconciliation.py       # Endpoints HTTP que expone el módulo
    ├── schemas/
    │   └── incoming.py             # Modelos Pydantic para validar los payloads entrantes
    └── services/
        ├── rules_engine.py         # Motor de reglas de prioridad por tipo de entidad
        ├── persister.py            # Capa de escritura en BD (INSERT/UPDATE + auditoría)
        └── name_normalizer.py      # Fuzzy matching de nombres de asesores de tesis
```

### `api/reconciliation.py` — La puerta de entrada HTTP

Define 6 endpoints bajo el prefijo `/api/v1/reconciliation/`:

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/bulk/investigators` | Reconcilia un lote de investigadores (fuente: RAIS o RENACYT) |
| `POST` | `/bulk/projects` | Reconcilia un lote de proyectos (fuente: RAIS o VRIP) |
| `POST` | `/bulk/publications` | Reconcilia un lote de publicaciones (fuente: Scopus, WoS, RAIS) |
| `POST` | `/bulk/theses_advisors` | Reconcilia asesores de tesis extraídos de Cybertesis con fuzzy matching |
| `GET`  | `/quarantine` | Lista todos los registros en estado `Pendiente` de revisión humana |
| `POST` | `/quarantine/{id}/resolve?action=aprobar\|rechazar` | Resuelve manualmente un item en cuarentena |

### `schemas/incoming.py` — Contratos de datos

Define los modelos Pydantic que validan los lotes antes de procesarlos. Cada lote incluye:
- `fuente_origen`: string que identifica la fuente (`"RAIS"`, `"RENACYT"`, `"Cybertesis"`, `"VRIP"`)
- `registros`: lista de objetos con los campos específicos de cada entidad

Los modelos disponibles son: `BulkInvestigadorPayload`, `BulkProyectoPayload`, `BulkPublicacionPayload`, `BulkAsesorTesisPayload`.

### `services/rules_engine.py` — Motor de Reglas de Prioridad

Aplica las siguientes reglas al comparar un registro entrante contra el registro ya existente en la BD:

| Entidad | Regla de prioridad |
|---------|-------------------|
| **Investigador** | RENACYT gana a RAIS en campos de categoría, grado y código. RAIS nunca sobreescribe datos ya existentes. |
| **Proyecto** | VRIP gana a RAIS en campos críticos: estado, fecha inicio, resolución y presupuesto. |
| **Publicación** | Fuentes indexadas (Scopus, WoS, SciELO) ganan a RAIS y sobreescriben sus datos. |
| **Tesis / Asesor** | Se intenta cruzar el nombre de texto libre del asesor contra el padrón de investigadores de la BD. Si no hay match con ≥ 85% de confianza, el registro va a cuarentena. |

Regla de Oro (aplica a todas): **Un ingreso manual en la BD nunca es sobreescrito automáticamente por ninguna fuente.**

### `services/persister.py` — Capa de Escritura

Realiza todas las operaciones sobre la base de datos de forma atómica (una sola transacción):
- `persist_resolved()`: hace INSERT o UPDATE de la entidad y registra un `LogAuditoria` en la misma transacción.
- `persist_quarantine()`: crea una fila en `reconciliacion_pendientes` con estado `Pendiente` y registra el evento de auditoría.
- `resolve_quarantine_item()`: aprueba (ejecutando `persist_resolved` con los datos en conflicto) o rechaza un item pendiente.

### `services/name_normalizer.py` — Fuzzy Matching

Usada exclusivamente para el cruce de asesores de tesis de Cybertesis. Normaliza nombres (quita tildes, pone en minúsculas, remueve caracteres especiales) y usa **RapidFuzz Token Set Ratio** para comparar el texto libre del asesor contra todos los investigadores del padrón. El umbral por defecto de aceptación es **85 de similitud**.

---

## Dependencias necesarias

El módulo es una librería Python integrada en el servidor FastAPI principal. No corre de forma independiente.

### Paquetes de Python adicionales

Además de las dependencias del servidor principal (`fastapi`, `sqlalchemy`, `pydantic`), este módulo requiere:

```txt
rapidfuzz>=3.0.0
unidecode>=1.3.0
```

Instálalos asegurándote de que el entorno virtual del backend esté activo:

```bash
# Desde la carpeta raíz del backend
pip install rapidfuzz unidecode
```

### Tablas de base de datos requeridas

El módulo escribe en las siguientes tablas del modelo de dominio. Deben existir antes de ejecutar cualquier llamada:

| Tabla | Modelo Python | Descripción |
|-------|---------------|-------------|
| `investigadores` | `Investigador` | Padrón de investigadores de la FISI |
| `proyectos` | `Proyecto` | Proyectos de investigación |
| `publicaciones` | `Publicacion` | Publicaciones científicas |
| `tesis` | `Tesis` | Tesis de pregrado y posgrado de Cybertesis |
| `reconciliacion_pendientes` | `ReconciliacionPendiente` | Cola de cuarentena para revisión humana |
| `log_auditoria` | `LogAuditoria` | Registro de auditoría de todas las operaciones |

> Las tablas se crean automáticamente con las migraciones de Alembic al ejecutar `alembic upgrade head` desde la carpeta `backend/`.

---

## Cómo ejecutarlo

Este módulo **no tiene su propio servidor**. Se activa automáticamente al levantar el servidor FastAPI principal. El `main.py` lo registra así:

```python
# backend/app/main.py
from sgpi_cmr.api.reconciliation import router as cmr_router

app.include_router(
    cmr_router,
    prefix="/api/v1/reconciliation",
    tags=["Reconciliación y Normalización"],
)
```

### Pasos para levantar el entorno completo

1. **Activar el entorno virtual** (desde la carpeta `backend/`):
   ```bash
   # Windows
   .venv\Scripts\activate

   # Linux / macOS
   source .venv/bin/activate
   ```

2. **Verificar que las dependencias estén instaladas**:
   ```bash
   pip install -r requirements.txt
   # O manualmente si falta alguna:
   pip install rapidfuzz unidecode
   ```

3. **Aplicar migraciones de base de datos** (solo si es la primera vez o hay cambios de esquema):
   ```bash
   alembic upgrade head
   ```

4. **Levantar el servidor**:
   ```bash
   # Desde la carpeta Despliegue/
   npm run dev
   # O directamente:
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

5. **Verificar que el módulo está activo** abriendo en el navegador:
   ```
   http://localhost:8000/api/v1/openapi.json
   ```
   Deben aparecer los endpoints bajo la sección **"Reconciliación y Normalización"**.

---

## Flujo de uso típico

```
Pipeline ETL (ej. importación RAIS)
        │
        │ POST /api/v1/reconciliation/bulk/investigators
        │ Body: { "fuente_origen": "RAIS", "registros": [...] }
        ▼
   rules_engine.reconcile_investigador()
        │
        ├── Si no hay conflicto ──► persister.persist_resolved() → INSERT/UPDATE en BD
        │                                                         → LogAuditoria registrado
        │
        └── Si hay conflicto ────► persister.persist_quarantine() → Fila en reconciliacion_pendientes
                                                                   → LogAuditoria registrado
                                         │
                                         ▼
                              Administrador revisa en la pantalla
                              GET /api/v1/reconciliation/quarantine
                                         │
                              POST /api/v1/reconciliation/{id}/resolve?action=aprobar
                                         │
                              persister.resolve_quarantine_item() → persist_resolved()
```

---

## Notas de seguridad

- Todos los endpoints requieren un usuario autenticado con rol `staff` o superior (`require_staff`). Un token JWT válido debe enviarse en el header `Authorization: Bearer <token>`.
- Todas las operaciones de escritura y cuarentena quedan registradas en `log_auditoria` con `tipo_evento`, `entidad_afectada`, `pk_entidad` y `valor_nuevo`, cumpliendo los requisitos de trazabilidad del sistema.
