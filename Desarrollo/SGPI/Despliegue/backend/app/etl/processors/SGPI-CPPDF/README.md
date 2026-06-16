# Guía de Uso: CLI Parser de PDFs Adaptativo (sgpi-parser)

Bienvenido a la guía de uso oficial de **sgpi-parser**, una herramienta CLI moderna escrita en **Python 3.13** para la extracción local, offline y altamente adaptativa de información estructurada a partir de documentos en formato PDF emitidos por sistemas de gestión o dependencias institucionales (como cronogramas, resoluciones y resultados de convocatorias).

---

## 1. Descripción General

`sgpi-parser` resuelve el desafío de estructurar datos de documentos administrativos y académicos que sufren constantes variaciones de formato y diseño año tras año (tales como **Cronogramas de actividades**, **Resultados de convocatorias** y **Resoluciones administrativas con anexos de tablas complejas**).

### Características Clave:
* **100% Local y Offline:** No requiere conexiones a Internet, procesamiento en la nube ni llamadas a APIs de terceros para la extracción productiva.
* **Extracción Híbrida de Tablas de Alta Fidelidad:** Combina la detección geométrica de celdas de `pdfplumber` con el motor avanzado de decodificación tipográfica de `PyMuPDF (fitz)` para neutralizar ruidos, capas de texto invisibles y caracteres intercalados.
* **Formatos de Salida Premium:**
  * **JSON Estructurado:** Con tipos de datos validados estrictamente mediante `Pydantic` (ideal para canalizaciones y API endpoints).
  * **Excel Premium:** Con diseño corporativo sofisticado, formato numérico de moneda, auto-ajuste inteligente del ancho de columnas y separación lógica multitesta para anexos complejos.
* **Intérprete Inteligente de Fechas:** Transforma rangos complejos de fechas (ej. `"del 20 al 27 de noviembre 2025"`) a fechas estandarizadas `YYYY-MM-DD`.

---

## 2. Requisitos del Sistema e Instalación

### Requisitos:
* **Python 3.13** o superior.
* Las siguientes dependencias de Python (se instalan mediante `pip`):
  * `fitz` (PyMuPDF) - Extracción de texto de alta precisión.
  * `pdfplumber` - Detección geométrica de estructuras de tablas.
  * `openpyxl` - Creación y formateo premium de libros Excel.
  * `typer` - Construcción del CLI interactivo.
  * `pydantic` - Validación de esquemas y modelos de datos.

### Instalación Paso a Paso:

1. **Clonar o ubicarse en el directorio del proyecto:**
   ```bash
   cd /ruta/al/proyecto
   ```

2. **Crear y activar un entorno virtual (Recomendado):**
   ```bash
   # En Windows
   python -m venv .venv
   .venv\Scripts\Activate.ps1
   
   # En Linux/macOS
   python -m venv .venv
   source .venv/bin/activate
   ```

3. **Instalar dependencias necesarias:**
   ```bash
   pip install pymupdf pdfplumber openpyxl typer pydantic python-dotenv
   ```

4. **Configurar el entorno de desarrollo (Opcional - Solo para validación con IA):**
   Si desea realizar pruebas comparativas contra la API de Gemini, cree un archivo `.env` en la raíz del proyecto con su clave:
   ```env
   GEMINI_API_KEY=su_clave_api_aqui
   ```

---

## 3. Uso del CLI: Comando `parse`

El comando principal `parse` es el encargado de procesar un PDF y exportar los datos al formato deseado.

### Sintaxis General:
```bash
python sgpi_parser/main.py parse [RUTA_PDF] [OPCIONES]
```

### Opciones Disponibles:
* `-f, --format [json|excel]`: Formato de salida. Por defecto es `json`.
* `-o, --output RUTA`: Ruta del archivo de destino donde se guardarán los datos extraídos (ej. `outputs/mi_reporte.xlsx`).
* `-q, --quiet`: Ejecución silenciosa. Suprime los mensajes informativos en consola y únicamente imprime el JSON final a `stdout` (útil para canalizaciones de comandos con `|` o integración con otros lenguajes de programación).
* `-c, --category [resolucion|cronograma|resultados]`: Fuerza una categoría específica de extracción omitiendo la auto-detección semántica del parser.
* `-y, --year ENTERO`: Fuerza un año específico (ej. `2026`).

---

### Ejemplos Prácticos de Uso:

#### Ejemplo A: Extracción rápida de Resultados a JSON (Consola)
Parsea el PDF de resultados y muestra la estructura JSON validada directamente en el terminal:
```bash
python sgpi_parser/main.py parse ruta/al/documento_resultados.pdf -f json
```

#### Ejemplo B: Guardar Resultados en un Archivo JSON
```bash
python sgpi_parser/main.py parse ruta/al/documento_resultados.pdf -f json -o outputs/resultados.json
```

#### Ejemplo C: Canalización a un Procesador de JSON (Modo Silencioso)
Mediante la opción `-q` o `--quiet`, el comando no emite textos de diagnóstico, permitiendo canalizaciones puras (por ejemplo, usando `jq` en bash o guardando en base de datos):
```bash
python sgpi_parser/main.py parse ruta/al/documento_resultados.pdf -f json --quiet | jq ".metadata"
```

#### Ejemplo D: Generar Excel Premium para una Resolución (Anexos de Integrantes)
Este comando generará un reporte de Excel de calidad corporativa con dos pestañas: una principal con los proyectos y presupuestos formateados, y otra secundaria vinculada conteniendo a todos los miembros y colaboradores.
```bash
python sgpi_parser/main.py parse ruta/al/documento_resolucion.pdf -f excel -o outputs/reporte_resolucion.xlsx
```

---

## 4. Estructura de Datos de Salida (Esquemas JSON)

El parser genera tres modelos estandarizados representados en los siguientes esquemas de salida:

### A. Categoría `cronograma`
```json
{
  "tipo_documento": "cronograma",
  "metadata": {
    "programa_nombre": "NOMBRE DEL PROGRAMA O CONVOCATORIA",
    "anio_academico": 2026
  },
  "actividades": [
    {
      "actividad": "Nombre de la Actividad",
      "dependencia_responsable": "Nombre de la Dependencia (si aplica)",
      "fecha_detalle": "Texto original de la fecha en el PDF",
      "fecha_inicio": "2025-11-19",
      "fecha_fin": "2025-11-27"
    }
  ]
}
```
> [!NOTE]
> Las fechas de inicio o fin se establecen automáticamente como `null` ante plazos abiertos (ej. `"Hasta el 9 de marzo"` establece `fecha_inicio = null` y `fecha_fin = "2026-03-09"`).

### B. Categoría `resultados`
```json
{
  "tipo_documento": "resultados",
  "metadata": {
    "programa_nombre": "NOMBRE DE LA CONVOCATORIA / CONCURSO",
    "anio_academico": 2026
  },
  "proyectos_aprobados": [
    {
      "orden_merito": 1,
      "titulo": "TÍTULO COMPLETO DEL PROYECTO O ITEM",
      "codigo_proyecto": "CODIGO_PROYECTO (o null si no se especifica)",
      "nombre_gi": "NOMBRE DEL GRUPO O ÁREA",
      "responsable": "APELLIDOS Y NOMBRES DEL RESPONSABLE",
      "facultad": "UNIDAD/DEPARTAMENTO CORRESPONDIENTE",
      "puntaje": 94.5
    }
  ]
}
```

### C. Categoría `resolucion` (Resoluciones)
```json
{
  "tipo_documento": "resolucion_administrativa",
  "metadata": {
    "numero_resolucion": "NUMERO_DE_RESOLUCION",
    "anio_academico": 2026,
    "fecha_emision": "2025-11-14"
  },
  "proyectos": [
    {
      "codigo_proyecto": "CODIGO_PROYECTO",
      "titulo": "TÍTULO DEL PROYECTO / INICIATIVA",
      "facultad": "UNIDAD / AREA CORRESPONDIENTE",
      "nombre_gi": "GRUPO DE TRABAJO / GRUPO DE INVESTIGACIÓN",
      "presupuesto": 15000.0,
      "integrantes": [
        {
          "apellidos_nombres": "APELLIDOS Y NOMBRES DEL INTEGRANTE",
          "condicion": "ROL O CONDICIÓN",
          "facultad": "UNIDAD / DEPARTAMENTO",
          "tipo_integrante": "Tipo de Integrante (ej. Docente, Estudiante)"
        }
      ]
    }
  ]
}
```

---

## 5. Uso del CLI: Comando `validate` (QA e Integridad)

El comando `validate` es una herramienta de control de calidad. Permite verificar la exactitud y robustez de los algoritmos heurísticos locales frente a una extracción de referencia generada mediante modelos avanzados (como la API de Gemini con Structured Outputs).

### Sintaxis:
```bash
python sgpi_parser/main.py validate [RUTA_PDF] --output-golden outputs/golden_cronograma.json
```

Este comando:
1. Obtiene la extracción de referencia (Golden Dataset) utilizando un servicio de validación externo (como la API de Gemini).
2. Guarda opcionalmente dicho archivo de referencia en `--output-golden`.
3. Ejecuta el parser local heurístico de manera offline.
4. Realiza una comparación automatizada campo por campo y reporta la **Tasa de Exactitud Global** alcanzada.

---

## 6. Soporte y Solución de Problemas

### 1. Codificación en consolas de Windows (PowerShell/CMD)
Si al ejecutar en consolas antiguas de Windows visualiza caracteres incorrectos en las salidas informativas, fuerce el uso de codificación UTF-8 en su variable de entorno del terminal ejecutando:
* **En CMD:**
  ```cmd
  set PYTHONIOENCODING=utf-8
  ```
* **En PowerShell:**
  ```powershell
  $env:PYTHONIOENCODING="utf-8"
  ```

### 2. Tablas extensas o múltiples páginas
Los parsers locales están diseñados para iterar a través de todas las páginas del PDF. Si un documento posee múltiples páginas con la misma estructura de tabla, el parser continuará la extracción de manera transparente acumulando los registros sin interrupción.
