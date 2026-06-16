# Módulo SGPI-CAPIRESTC (API REST CRUD)

Bienvenido al módulo **SGPI-CAPIRESTC**. Este componente encapsula de manera modular todos los Endpoints, operaciones a Base de Datos (CRUD) y esquemas de validación (Pydantic) de las tablas maestras del sistema **SGPI** (Sistema de Gestión de Proyectos de Investigación).

## Arquitectura Interna del Módulo

Este módulo está estructurado bajo los principios de **Clean Architecture** (Separación de Responsabilidades):

* **`/api`**: Contiene las rutas (Endpoints) organizadas por entidad (`investigators.py`, `projects.py`, etc.). Es la puerta de entrada para las llamadas HTTP externas y gestiona los códigos de estado HTTP y permisos.
* **`/crud`**: Es la capa de Base de Datos. Implementa herencia genérica (`CRUDBase`) para simplificar la escritura en la BD. Aquí se traducen las órdenes en acciones puras de PostgreSQL de manera asíncrona mediante SQLAlchemy.
* **`/schemas`**: Contiene las definiciones de Pydantic (`domain_schemas.py`). Garantiza que todos los JSON entrantes tengan los tipos de datos correctos antes de entrar al sistema, y dictamina cómo luce la información cuando sale del sistema.

## Entidades Soportadas

Actualmente, las APIs exponen de manera segura operaciones **C**reate, **R**ead, **U**pdate y **D**elete para:
1. **Usuarios**
2. **Investigadores**
3. **Grupos de Investigación**
4. **Proyectos**
5. **Convocatorias**
6. **Publicaciones**
7. **Tesis**

## Motor de Búsqueda Global
Incluye un Endpoint especializado y concurrente (`/search/`) que ejecuta de manera paralela búsquedas sobre 5 entidades distintas al mismo tiempo utilizando `asyncio.gather()`, respondiendo en milisegundos para alimentar la barra de búsqueda universal del Frontend.

## Dependencias Externas (Inyección de Dependencias)

El módulo interactúa de forma transparente con los pilares del proyecto general:
- **`app.db`**: De donde extrae el hilo de conexión asíncrona hacia Supabase (`get_db`).
- **`app.models`**: De donde extrae los mapeos de la estructura relacional de la BD.
- **`app.core`**: Utilizado para proteger todas las rutas (Ej: `Depends(require_admin)`), validando los tokens JWT de Supabase, y emitiendo automáticamente inserciones en la tabla `log_auditoria` con cada inserción o edición.

---
**Componente homologado bajo nomenclatura SGPI-CAPIRESTC - UNMSM.**
