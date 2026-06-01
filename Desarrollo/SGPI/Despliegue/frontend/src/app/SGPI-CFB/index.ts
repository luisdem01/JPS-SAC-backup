/**
 * @file index.ts
 * @module SGPI-CFB — Core Frontend · Búsqueda
 * @description Punto de entrada principal del módulo de Búsqueda Global.
 *
 * Este módulo gestiona la funcionalidad completa de búsqueda unificada dentro
 * del sistema SGPI: investigadores, proyectos, publicaciones y tesis.
 *
 * Responsabilidades:
 * - Pantalla de búsqueda global con campo de texto y filtros por tipo de entidad
 * - Debounce configurable para reducir peticiones al backend (400 ms por defecto)
 * - Renderizado de resultados en tarjetas/lista con tipo, título y extracto
 * - Paginación de resultados (servidor)
 * - Estado vacío y de carga con feedback visual apropiado
 * - Integración con la barra de búsqueda rápida del TopBar
 *
 * Dependencias de diseño (SGPI-CFU):
 * - Componentes: Input, Badge, DataTable, PageHeader, MainLayout, FilterBar
 * - Lib:         api.search, useSearch, useApi, formatters, constants
 * - Paleta:      primary (#001631), surface (#f9f9ff), surface-container-low para cards
 * - Tipografía:  IBM Plex Sans (headings) · Inter (body) — border-radius 4px
 *
 * Estructura prevista de carpetas:
 * ```
 * SGPI-CFB/
 * ├── index.ts              ← este archivo (barrel raíz)
 * ├── components/           ← componentes específicos del módulo de búsqueda
 * │   ├── SearchBar.tsx         (campo de búsqueda con debounce e icono)
 * │   ├── SearchFilters.tsx     (chips/tabs de filtro por tipo de entidad)
 * │   ├── SearchResultCard.tsx  (tarjeta de un resultado individual)
 * │   ├── SearchResultsList.tsx (lista paginada de resultados)
 * │   ├── SearchEmpty.tsx       (estado vacío — sin resultados o búsqueda inicial)
 * │   └── index.ts
 * ├── hooks/                ← hooks específicos de búsqueda
 * │   ├── useGlobalSearch.ts    (gestiona query, filtros, paginación y llamada API)
 * │   └── index.ts
 * ├── types/                ← tipos locales del módulo (si se necesitan)
 * │   └── index.ts
 * └── views/                ← páginas/vistas del módulo
 *     ├── SearchPage.tsx        (vista principal — ruta /search)
 *     └── index.ts
 * ```
 *
 * Uso (importar desde el módulo):
 * ```tsx
 * import { SearchPage } from '@/SGPI-CFB';
 * ```
 *
 * Endpoints utilizados:
 * - GET /api/v1/search?q=&type=&page=&limit=  → resultados paginados de búsqueda global
 *
 * Parámetros de búsqueda:
 * - q      : texto libre de búsqueda (mínimo 2 caracteres — SEARCH_MIN_LENGTH)
 * - type   : 'investigators' | 'projects' | 'publications' | 'tesis' | undefined (todos)
 * - page   : número de página (base 1)
 * - limit  : ítems por página (por defecto 20 — DEFAULT_PAGE_SIZE)
 *
 * Roles con acceso:
 * - Todos los roles autenticados (admin, secretary, chief, viewer)
 *
 * @see SGPI-CFU/lib/api/endpoints.ts → searchEndpoints
 * @see SGPI-CFU/lib/hooks/useSearch.ts → hook de búsqueda base
 * @see SGPI-CFU/lib/utils/constants.ts → SEARCH_DEBOUNCE_MS, SEARCH_MIN_LENGTH
 * @see SGPI-CFU/lib/types/api.ts → SearchParams, SearchType, SearchResult
 */

// ── Exportaciones del módulo ──────────────────────────────────────────────────
// Se irán habilitando conforme se desarrollen los sub-módulos.

// export * from './components';
// export * from './hooks';
// export * from './views';
