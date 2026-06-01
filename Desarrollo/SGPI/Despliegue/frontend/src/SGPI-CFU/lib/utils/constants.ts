/**
 * @file constants.ts
 * @description Constantes globales del módulo SGPI-CFU.
 * Centraliza valores de configuración, límites, URLs y etiquetas
 * para evitar números/strings mágicos dispersos por la aplicación.
 */

// ─────────────────────────────────────────────────────────────────────────────
// API y red
// ─────────────────────────────────────────────────────────────────────────────

/**
 * URL base de la API del backend SGPI.
 * Configurable via variable de entorno NEXT_PUBLIC_API_URL.
 */
export const API_BASE_URL =
  (process.env['NEXT_PUBLIC_API_URL'] as string | undefined) ?? 'http://localhost:3000';

/** Prefijo de versión de la API */
export const API_PREFIX = '/api/v1';

/** Timeout por defecto para peticiones normales (5 segundos) */
export const DEFAULT_TIMEOUT_MS = 5_000;

/** Timeout para operaciones pesadas: importaciones, sync, reportes (10 minutos) */
export const HEAVY_OPERATION_TIMEOUT_MS = 10 * 60 * 1_000;

/** Intervalo de polling para jobs asíncronos (2 segundos) */
export const JOB_POLLING_INTERVAL_MS = 2_000;

// ─────────────────────────────────────────────────────────────────────────────
// Sesión y autenticación
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tiempo de inactividad para expirar la sesión: 30 minutos.
 * RNF002: la sesión debe expirar tras 30 min de inactividad.
 */
export const SESSION_INACTIVITY_MS = 30 * 60 * 1_000;

/**
 * Tiempo antes de la expiración para mostrar la advertencia: 5 minutos.
 * La advertencia aparece cuando restan 5 min de sesión activa.
 */
export const SESSION_WARNING_BEFORE_MS = 5 * 60 * 1_000;

/** Tiempo de bloqueo de cuenta tras intentos fallidos: 15 minutos */
export const ACCOUNT_LOCK_DURATION_MS = 15 * 60 * 1_000;

/** Número máximo de intentos de login fallidos antes del bloqueo */
export const MAX_LOGIN_ATTEMPTS = 3;

// ─────────────────────────────────────────────────────────────────────────────
// Paginación
// ─────────────────────────────────────────────────────────────────────────────

/** Número de ítems por página por defecto */
export const DEFAULT_PAGE_SIZE = 20;

/** Número máximo de ítems por página */
export const MAX_PAGE_SIZE = 100;

/** Opciones disponibles para el selector de tamaño de página */
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Búsqueda
// ─────────────────────────────────────────────────────────────────────────────

/** Debounce en ms para la búsqueda global */
export const SEARCH_DEBOUNCE_MS = 400;

/** Longitud mínima del término de búsqueda */
export const SEARCH_MIN_LENGTH = 2;

// ─────────────────────────────────────────────────────────────────────────────
// Archivos
// ─────────────────────────────────────────────────────────────────────────────

/** Tamaño máximo para archivos Excel (10 MB) */
export const MAX_EXCEL_FILE_SIZE = 10 * 1024 * 1024;

/** Tamaño máximo para archivos PDF (50 MB) */
export const MAX_PDF_FILE_SIZE = 50 * 1024 * 1024;

/** Tipos MIME aceptados para archivos Excel */
export const EXCEL_MIME_TYPES = [
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const;

/** Extensiones aceptadas para archivos Excel */
export const EXCEL_EXTENSIONS = ['.xlsx', '.xls'] as const;

/** Tipos MIME aceptados para archivos PDF */
export const PDF_MIME_TYPES = ['application/pdf'] as const;

// ─────────────────────────────────────────────────────────────────────────────
// localStorage — claves de almacenamiento
// ─────────────────────────────────────────────────────────────────────────────

/** Prefijo para todas las claves de localStorage del SGPI */
export const STORAGE_PREFIX = 'sgpi_';

/** Clave del token de acceso en localStorage */
export const STORAGE_KEY_ACCESS_TOKEN   = `${STORAGE_PREFIX}access_token`;
/** Clave del token de refresco en localStorage */
export const STORAGE_KEY_REFRESH_TOKEN  = `${STORAGE_PREFIX}refresh_token`;
/** Clave del timestamp de última actividad */
export const STORAGE_KEY_LAST_ACTIVITY  = `${STORAGE_PREFIX}last_activity`;
/** Clave del contador de intentos fallidos */
export const STORAGE_KEY_FAILED_ATTEMPTS = `${STORAGE_PREFIX}failed_attempts`;
/** Clave del timestamp de bloqueo de cuenta */
export const STORAGE_KEY_LOCK_UNTIL     = `${STORAGE_PREFIX}lock_until`;

// ─────────────────────────────────────────────────────────────────────────────
// Rutas de navegación (Next.js App Router)
// ─────────────────────────────────────────────────────────────────────────────

/** Rutas principales de la aplicación */
export const ROUTES = {
  /** Página de inicio de sesión */
  LOGIN:          '/login',
  /** Dashboard principal */
  DASHBOARD:      '/dashboard',
  /** Módulo de investigadores */
  INVESTIGATORS:  '/investigators',
  /** Detalle de un investigador */
  INVESTIGATOR:   (id: string) => `/investigators/${id}`,
  /** Módulo de proyectos */
  PROJECTS:       '/projects',
  /** Detalle de un proyecto */
  PROJECT:        (id: string) => `/projects/${id}`,
  /** Módulo de publicaciones */
  PUBLICATIONS:   '/publications',
  /** Módulo de convocatorias */
  CALLS:          '/calls',
  /** Módulo de importación */
  IMPORT:         '/import',
  /** Módulo de sincronización ETL */
  SYNC:           '/sync',
  /** Módulo de reportes */
  REPORTS:        '/reports',
  /** Panel de administración de usuarios */
  USERS:          '/admin/users',
  /** Panel de logs de auditoría */
  LOGS:           '/admin/logs',
  /** Búsqueda global */
  SEARCH:         '/search',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Mensajes del sistema (en español)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mensajes estándar del sistema para mostrar al usuario.
 * Centraliza los textos para facilitar traducción futura.
 */
export const MESSAGES = {
  /** Error genérico de red */
  NETWORK_ERROR:         'No se pudo conectar al servidor. Verifique su conexión a internet.',
  /** Error genérico del servidor */
  SERVER_ERROR:          'Ocurrió un error en el servidor. Por favor, intente nuevamente.',
  /** Sesión expirada por inactividad */
  SESSION_EXPIRED:       'Su sesión ha expirado por inactividad. Por favor, inicie sesión nuevamente.',
  /** Sin permisos para la acción */
  FORBIDDEN:             'No tiene permisos para realizar esta acción.',
  /** Advertencia de sesión por vencer */
  SESSION_WARNING:       (minutes: number) =>
    `Su sesión expirará en ${minutes} minuto${minutes !== 1 ? 's' : ''}. ¿Desea extenderla?`,
  /** Cuenta bloqueada */
  ACCOUNT_LOCKED:        (minutes: number) =>
    `Su cuenta ha sido bloqueada. Intente nuevamente en ${minutes} minuto${minutes !== 1 ? 's' : ''}.`,
  /** Login exitoso */
  LOGIN_SUCCESS:         'Inicio de sesión exitoso. Bienvenido al SGPI.',
  /** Logout exitoso */
  LOGOUT_SUCCESS:        'Sesión cerrada correctamente.',
  /** Importación iniciada */
  IMPORT_STARTED:        'El archivo ha sido cargado. Procesando importación...',
  /** Importación completada */
  IMPORT_COMPLETED:      (created: number, updated: number) =>
    `Importación completada: ${created} registros nuevos, ${updated} actualizados.`,
  /** Sincronización iniciada */
  SYNC_STARTED:          (source: string) => `Sincronización con ${source} iniciada.`,
  /** Sincronización completada */
  SYNC_COMPLETED:        'Sincronización completada exitosamente.',
  /** Reporte generado */
  REPORT_GENERATED:      'El reporte ha sido generado y está listo para descargar.',
  /** Datos guardados */
  SAVED:                 'Los cambios han sido guardados correctamente.',
  /** Datos eliminados */
  DEACTIVATED:           'El registro ha sido desactivado correctamente.',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Configuración del sistema
// ─────────────────────────────────────────────────────────────────────────────

/** Nombre completo del sistema */
export const SYSTEM_NAME = 'Sistema de Gestión de Proyectos de Investigación';

/** Siglas del sistema */
export const SYSTEM_ACRONYM = 'SGPI';

/** Institución propietaria */
export const INSTITUTION_NAME = 'Facultad de Ingeniería de Sistemas e Informática';

/** Universidad */
export const UNIVERSITY_NAME = 'Universidad Nacional Mayor de San Marcos';

/** Año de implementación */
export const SYSTEM_YEAR = 2024;

// ─────────────────────────────────────────────────────────────────────────────
// Fuentes de sincronización ETL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Etiquetas legibles para cada fuente de sincronización ETL.
 */
export const SYNC_SOURCE_LABELS: Record<string, string> = {
  RENACYT:    'RENACYT (CONCYTEC)',
  VRIP:       'VRIP - UNMSM',
  CYBERTESIS: 'Cybertesis UNMSM',
  ALL:        'Todas las fuentes',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Niveles de urgencia de convocatorias
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Umbrales en días para calcular el nivel de urgencia de una convocatoria.
 * Coinciden con los valores de la vista vista_convocatoria en PostgreSQL.
 */
export const URGENCY_THRESHOLDS = {
  /** 7 días o menos → ROJO (Urgente) */
  RED:    7,
  /** 8-21 días → AMARILLO (Próxima) */
  YELLOW: 21,
  /** Más de 21 días → VERDE (Normal) */
} as const;
