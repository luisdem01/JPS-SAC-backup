# SGPI-CI (Conector de Importación Multientidad)

Este módulo centraliza la ingesta de datos no estructurados de la FISI hacia el Sistema de Gestión de Proyectos de Investigación (SGPI), enriqueciendo automáticamente los perfiles mediante la API nacional de **CONCYTEC (RENACYT)**.

## Arquitectura del Pipeline ETL

1. **Extracción (Parsers):** Lee archivos `.xlsx` y extrae entidades (Proyectos, Publicaciones, Grupos, Docentes) usando heurística de palabras clave. Se detectan automáticamente nombres mal formados, celdas fusionadas y saltos de línea.
2. **Limpieza (Cleaners):** Se ejecutan funciones estrictas para limpiar prefijos (ej. `R_`), títulos académicos (`Dr.`, `Mg.`, `PhD.`) y descartar palabras basura (ej. "Docente", "Miembro", "Co-Responsable") que el personal suele ingresar accidentalmente en las celdas de nombre.
3. **Enriquecimiento (Processor):** Cruza los nombres limpios contra la base nacional de RENACYT para resolver los DNIs automáticamente.
4. **Validación (Pydantic):** Asegura que los datos cumplen con los esquemas de la base de datos `SGPI-DDLS.sql` antes de subirlos.
5. **Carga (Supabase):** Ejecuta subidas masivas mediante la inyección estructurada.

## Algoritmo de Búsqueda Robusta en Renacyt

Dado que la API de Concytec presenta múltiples deficiencias estructurales (solo busca coincidencias de "Primer Nombre" y separa su base de datos en 7 reglamentos independientes), el ETL implementa un algoritmo de compensación:

- **Generación de Candidatos:** Para un docente detectado sin DNI, se prueban hasta 4 combinaciones cruzadas de su nombre para forzar una respuesta de la API y evadir la restricción de búsqueda de primer nombre.
- **Filtro Local:** Una vez que la API responde con un lote de candidatos (hasta 100 resultados), el algoritmo cruza las palabras originales localmente para certificar matemáticamente que sea la persona correcta.
- **Parche de Reglamentos:** Si el docente no está en el "Reglamento 21", el sistema iterará forzosamente los reglamentos 22, 23, 24, 25, 26 y 27 para no perderlo.

## Tiempos de Ejecución (Cuellos de Botella)

Es **completamente normal** que archivos con gran volumen histórico (como `6. Proyectos de investigación 2018-2025.xlsx`) tarden **más de 15 a 20 minutos** en procesarse. Esto NO es un error de código o un bucle infinito, sino una limitación matemática estricta provocada por la latencia del servidor gubernamental:

1. El sistema realiza múltiples peticiones HTTP por cada docente detectado.
2. Si el docente **NO existe en Renacyt** (lo cual es muy común en archivos históricos donde figuran profesores retirados o sin perfil de investigador), el algoritmo no tendrá más remedio que agotar todas sus combinaciones candidatas a lo largo de los **7 reglamentos**.
3. Esto genera hasta 14-28 peticiones HTTP por cada docente "fantasma". Si el servidor de Concytec tarda solo un segundo en procesar cada consulta, cada docente faltante sumará medio minuto al tiempo total de ejecución, bloqueando la consola temporalmente.

**Recomendación:** Se recomienda ejecutar la importación de archivos masivos y pesados (`import`) en segundo plano o fuera de horas pico. Una vez que la base de datos esté nutrida, las actualizaciones incrementales anuales tomarán apenas unos segundos.

## Ejecución

```bash
# Modo de Prueba (Dry-Run): No afecta la base de datos
python main.py preview "Ruta_al_Excel.xlsx"

# Modo de Inserción: Inserta en Supabase (Requiere credenciales .env)
python main.py import "Ruta_al_Excel.xlsx"
```

## Dependencias
- `pandas`
- `pydantic`
- `python-dotenv`
- `supabase`
- `openpyxl`

> Requiere que el módulo `SGPI-CSAPIREN` esté correctamente instalado y ubicado en la estructura de directorios superior para que la inyección de la API funcione adecuadamente.
