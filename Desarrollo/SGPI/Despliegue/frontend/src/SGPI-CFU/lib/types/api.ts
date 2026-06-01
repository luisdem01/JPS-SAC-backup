/**
 * @file api.ts
 * @description Tipos TypeScript para las respuestas estándar de la API del SGPI.
 * Toda respuesta del backend sigue el contrato definido en estos tipos.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Respuestas estándar del backend
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Respuesta exitosa genérica del backend.
 * Todas las respuestas de la API envuelven los datos en esta estructura.
 *
 * @template T - Tipo del dato retornado en `data`
 */
export interface ApiSuccess<T = unknown> {
  success:   true;
  data:      T;
  /** Marca temporal ISO 8601 del servidor */
  timestamp: string;
}

/**
 * Respuesta de error del backend.
 * Nunca contiene stack traces ni detalles técnicos visibles al usuario (RNF013).
 */
export interface ApiError {
  success:   false;
  /** Mensaje de error amigable en español */
  error:     string;
  /** Código de error para manejo programático (ej: "AUTH_INVALID", "NOT_FOUND") */
  code:      string;
  /** Marca temporal ISO 8601 del servidor */
  timestamp: string;
}

/**
 * Unión discriminada de respuesta exitosa o errónea.
 * Usar `response.success` como discriminador de tipo.
 *
 * @template T - Tipo del dato en caso de éxito
 */
export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;

// ─────────────────────────────────────────────────────────────────────────────
// Paginación
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Estructura de datos paginados.
 * Usada cuando el backend devuelve listas con paginación.
 *
 * @template T - Tipo de cada ítem en la lista
 */
export interface PaginatedData<T = unknown> {
  /** Lista de ítems de la página actual */
  items:  T[];
  /** Total de registros que coinciden con la consulta */
  total:  number;
  /** Página actual (base 1) */
  page:   number;
  /** Máximo de ítems por página */
  limit:  number;
  /** Total de páginas disponibles */
  pages:  number;
}

/**
 * Respuesta exitosa paginada.
 *
 * @template T - Tipo de cada ítem paginado
 */
export type PaginatedResponse<T = unknown> = ApiSuccess<PaginatedData<T>>;

// ─────────────────────────────────────────────────────────────────────────────
// Parámetros de paginación y filtros
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parámetros de paginación para queries GET con listas.
 */
export interface PaginationParams {
  /** Página a solicitar (base 1, por defecto: 1) */
  page?:  number;
  /** Cantidad de ítems por página (por defecto: 20, máximo: 100) */
  limit?: number;
}

/**
 * Parámetros de búsqueda global.
 */
export interface SearchParams extends PaginationParams {
  /** Texto de búsqueda */
  q:      string;
  /** Tipo de entidad a buscar */
  type?:  SearchType;
}

/**
 * Tipos de entidad disponibles para la búsqueda global.
 */
export type SearchType =
  | 'investigators'
  | 'projects'
  | 'publications'
  | 'tesis';

// ─────────────────────────────────────────────────────────────────────────────
// Jobs asíncronos (importaciones, sync, reportes)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Respuesta inicial al iniciar un job asíncrono.
 * Los endpoints de importación, sync y reportes devuelven este tipo.
 */
export interface JobStarted {
  /** ID del job para consultar su estado posterior */
  job_id: string;
}

/**
 * Estados posibles de un job asíncrono.
 */
export type JobStatus = 'queued' | 'running' | 'completed' | 'failed';

/**
 * Estado de un job de importación de Excel.
 */
export interface ImportJobStatus {
  /** Estado actual del job */
  status:    JobStatus;
  /** Porcentaje de progreso (0-100) */
  progress:  number;
  /** Registros procesados hasta el momento */
  processed: number;
  /** Errores encontrados durante el procesamiento */
  errors:    number;
}

/**
 * Estado de un job de sincronización ETL.
 */
export interface SyncJobStatus {
  /** Estado actual del job */
  status:    JobStatus;
  /** Porcentaje de progreso (0-100) */
  progress:  number;
  /** Fuente que se está sincronizando */
  source:    SyncSource;
  /** Resumen disponible al completarse */
  summary?:  SyncSummary;
}

/**
 * Fuentes de datos para sincronización ETL.
 */
export type SyncSource = 'RENACYT' | 'VRIP' | 'CYBERTESIS' | 'ALL';

/**
 * Resumen de resultados de una sincronización completada.
 */
export interface SyncSummary {
  /** Registros nuevos creados */
  created: number;
  /** Registros existentes actualizados */
  updated: number;
  /** Errores de procesamiento */
  errors:  number;
}

/**
 * Estado de un job de generación de reporte.
 */
export interface ReportJobStatus {
  /** Estado actual del job */
  status:   JobStatus;
  /** Porcentaje de progreso (0-100) */
  progress: number;
  /** ID del reporte generado (disponible cuando status = "completed") */
  reportId?: string;
}

/**
 * Formatos disponibles para descarga de reportes.
 */
export type ReportFormat = 'xlsx' | 'pdf';

// ─────────────────────────────────────────────────────────────────────────────
// Estado del hook useApi
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Estado genérico devuelto por el hook useApi.
 *
 * @template T - Tipo del dato retornado
 */
export interface UseApiState<T = unknown> {
  /** Datos retornados por la última llamada exitosa */
  data:      T | null;
  /** Indica si hay una petición en curso */
  isLoading: boolean;
  /** Mensaje de error amigable, o null si no hay error */
  error:     string | null;
}

/**
 * Configuración opcional de una petición API.
 */
export interface RequestConfig {
  /**
   * Timeout de la petición en milisegundos.
   * Por defecto: 5000ms. Para importaciones/sync: 600000ms (10 min).
   */
  timeout?:      number;
  /** Headers adicionales a incluir en la petición */
  headers?:      Record<string, string>;
  /** Si se debe mostrar el error al usuario (true por defecto) */
  showError?:    boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Códigos de error conocidos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Códigos de error HTTP y de negocio manejados por el cliente API.
 */
export const API_ERROR_CODES = {
  /** Token expirado o inválido — redirige al login */
  UNAUTHORIZED:    'AUTH_UNAUTHORIZED',
  /** Sin permisos para la acción solicitada */
  FORBIDDEN:       'AUTH_FORBIDDEN',
  /** Recurso no encontrado */
  NOT_FOUND:       'NOT_FOUND',
  /** Error de validación de datos */
  VALIDATION:      'VALIDATION_ERROR',
  /** Error interno del servidor */
  SERVER_ERROR:    'SERVER_ERROR',
  /** Timeout de la petición */
  TIMEOUT:         'REQUEST_TIMEOUT',
  /** Error de red (sin conexión) */
  NETWORK:         'NETWORK_ERROR',
} as const;

export type ApiErrorCode = typeof API_ERROR_CODES[keyof typeof API_ERROR_CODES];
