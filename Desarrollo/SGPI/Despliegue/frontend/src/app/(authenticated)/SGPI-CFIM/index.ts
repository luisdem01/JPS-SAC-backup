/**
 * @file index.ts
 * @module SGPI-CFIM — Core Frontend · Importación de Módulo
 * @description Punto de entrada principal del módulo de Importación de Datos.
 *
 * Este módulo gestiona la funcionalidad completa de importación masiva de datos
 * al sistema SGPI mediante archivos Excel (.xlsx / .xls).
 *
 * Responsabilidades:
 * - Pantalla principal de importación (upload de archivos Excel)
 * - Seguimiento en tiempo real del progreso del job asíncrono
 * - Visualización del resumen de resultados (creados / actualizados / errores)
 * - Validación de formato y tamaño del archivo antes del envío
 * - Registro de historial de importaciones realizadas
 *
 * Dependencias de diseño (SGPI-CFU):
 * - Componentes: Button, Input, Badge, Toast, DataTable, PageHeader, MainLayout
 * - Lib:         api.import, useAsyncJob, useAuth, formatters, validators, constants
 * - Paleta:      primary (#001631), surface (#f9f9ff), success/warning/error semáforo
 * - Tipografía:  IBM Plex Sans (headings) · Inter (body) — border-radius 4px
 *
 * Estructura prevista de carpetas:
 * ```
 * SGPI-CFIM/
 * ├── index.ts              ← este archivo (barrel raíz)
 * ├── components/           ← componentes específicos del módulo de importación
 * │   ├── ImportUploader.tsx    (zona drag-and-drop + selector de archivo)
 * │   ├── ImportProgress.tsx    (barra de progreso del job asíncrono)
 * │   ├── ImportSummary.tsx     (resumen al completarse: creados/actualizados/errores)
 * │   ├── ImportHistory.tsx     (tabla de importaciones pasadas)
 * │   └── index.ts
 * ├── hooks/                ← hooks específicos de importación
 * │   ├── useImport.ts          (orquesta upload + polling de estado)
 * │   └── index.ts
 * ├── types/                ← tipos locales del módulo (si se necesitan)
 * │   └── index.ts
 * └── views/                ← páginas/vistas del módulo
 *     ├── ImportPage.tsx        (vista principal — ruta /import)
 *     └── index.ts
 * ```
 *
 * Uso (importar desde el módulo):
 * ```tsx
 * import { ImportPage } from '@/SGPI-CFIM';
 * ```
 *
 * Endpoints utilizados:
 * - POST /api/v1/import/excel     → sube el archivo, devuelve job_id
 * - GET  /api/v1/import/{id}/status → consulta progreso del job
 *
 * Roles con acceso:
 * - admin, secretary
 *
 * @see SGPI-CFU/lib/api/endpoints.ts → importEndpoints
 * @see SGPI-CFU/lib/hooks/useAsyncJob.ts → polling de jobs asíncronos
 * @see SGPI-CFU/lib/utils/constants.ts → MAX_EXCEL_FILE_SIZE, EXCEL_MIME_TYPES
 */

// ── Exportaciones del módulo ──────────────────────────────────────────────────
// Se irán habilitando conforme se desarrollen los sub-módulos.

// export * from './components';
// export * from './hooks';
// export * from './views';
