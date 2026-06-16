/**
 * @file client.ts
 * @description Cliente HTTP centralizado para la API del SGPI.
 * Maneja autenticación JWT, timeouts diferenciados, errores estandarizados
 * y redireccionamiento automático en casos de 401/403.
 *
 * - Timeout normal: 15 segundos
 * - Timeout para operaciones pesadas (importaciones, sync): 10 minutos
 * - Nunca expone stack traces al usuario (RNF013)
 */

import type {
  ApiResponse,
  ApiSuccess,
  ApiError,
  RequestConfig,
} from '../types/api';
import { getAccessToken, clearAllSessionData } from '../auth/storage';
import { clientCache } from './clientCache';

// ─────────────────────────────────────────────────────────────────────────────
// Configuración base
// ─────────────────────────────────────────────────────────────────────────────

/** URL base de la API del backend SGPI (FastAPI en Render) */
const BASE_URL = (process.env['NEXT_PUBLIC_API_URL'] as string | undefined) ?? 'http://localhost:3000';

/** Prefijo de versión de la API */
const API_PREFIX = '/api/v1';

/** Timeout por defecto en milisegundos para operaciones normales */
const DEFAULT_TIMEOUT_MS = 15_000;

/** Timeout para operaciones pesadas (importación, sync, reportes) */
export const HEAVY_TIMEOUT_MS = 10 * 60 * 1_000; // 10 minutos

// ─────────────────────────────────────────────────────────────────────────────
// Error de la API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Error personalizado para respuestas erróneas de la API del SGPI.
 * Extiende Error estándar con información del código y la respuesta HTTP.
 */
export class ApiClientError extends Error {
  /** Código de error de negocio (ej: "AUTH_UNAUTHORIZED") */
  public readonly code:       string;
  /** Código de estado HTTP (ej: 401, 403, 500) */
  public readonly httpStatus: number;
  /** Timestamp de la respuesta del servidor */
  public readonly timestamp:  string;

  constructor(error: ApiError, httpStatus: number) {
    // El mensaje es siempre el error amigable en español (RNF013)
    super(error.error);
    this.name       = 'ApiClientError';
    this.code       = error.code;
    this.httpStatus = httpStatus;
    this.timestamp  = error.timestamp;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Callbacks de eventos globales
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Callbacks globales invocados por el cliente ante eventos especiales.
 * Se configuran desde el hook useAuth para integrar con el estado de React.
 */
export interface ApiClientCallbacks {
  /** Invocado cuando el servidor devuelve 401 (token expirado/inválido) */
  onUnauthorized?: () => void;
  /** Invocado cuando el servidor devuelve 403 (sin permisos) */
  onForbidden?:    () => void;
}

/** Instancia global de callbacks (configurada desde useAuth) */
let globalCallbacks: ApiClientCallbacks = {};

/**
 * Configura los callbacks globales del cliente API.
 * Llamar desde el setup inicial del hook useAuth.
 *
 * @param callbacks - Objeto con callbacks para 401 y 403
 */
export function configureApiCallbacks(callbacks: ApiClientCallbacks): void {
  globalCallbacks = callbacks;
}

/**
 * Formatea el detalle de error del backend (FastAPI o Express)
 * convirtiendo listas de errores de validación a un formato legible en español.
 */
function formatErrorDetail(errorMsg: any): string {
  if (Array.isArray(errorMsg)) {
    return errorMsg.map((err: any) => {
      const field = err.loc && err.loc.length > 0 ? err.loc[err.loc.length - 1] : '';
      let msg = err.msg || 'valor inválido';

      if (msg === 'field required') {
        msg = 'es obligatorio';
      } else if (msg.includes('value is not a valid')) {
        msg = 'tiene un formato incorrecto';
      }

      const translations: Record<string, string> = {
        code: 'El código único del grupo',
        name: 'El nombre oficial del grupo',
        acronym: 'Las siglas del grupo',
        status: 'El estado del grupo',
        researchLines: 'La línea de investigación',
        recognitionDate: 'La fecha de reconocimiento',
        miembros: 'Los miembros del grupo',
        dni: 'El DNI',
        rol: 'El rol',
        tipo_reporte: 'El tipo de reporte',
        anio_corte: 'El año de corte',
        periodo_corte: 'El periodo de corte',
      };

      if (field) {
        const fieldName = translations[field] || `El campo "${field}"`;
        return `${fieldName} ${msg}`;
      }
      return msg;
    }).join('. ');
  }

  if (errorMsg && typeof errorMsg === 'object') {
    return JSON.stringify(errorMsg);
  }

  return typeof errorMsg === 'string' ? errorMsg : 'Ocurrió un error inesperado.';
}

// ─────────────────────────────────────────────────────────────────────────────
// Cliente HTTP
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Realiza una petición HTTP a la API del SGPI con manejo de errores estándar.
 *
 * @template T - Tipo del dato esperado en la respuesta exitosa
 * @param method  - Método HTTP (GET, POST, PUT, DELETE)
 * @param path    - Ruta relativa (sin /api/v1, ej: "/auth/login")
 * @param body    - Cuerpo de la petición (para POST/PUT)
 * @param config  - Configuración opcional (timeout, headers extra)
 * @returns Los datos tipados de la respuesta exitosa
 * @throws ApiClientError si la respuesta es un error o el request falla
 */
async function request<T>(
  method:  'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  path:    string,
  body?:   unknown,
  config?: RequestConfig
): Promise<T> {
  const url     = `${BASE_URL}${API_PREFIX}${path}`;
  const timeout = config?.timeout ?? DEFAULT_TIMEOUT_MS;

  // AbortController para implementar timeout
  const controller = new AbortController();
  let isTimeout = false;
  const timeoutId  = setTimeout(() => {
    isTimeout = true;
    controller.abort();
  }, timeout);

  // Headers base con autenticación JWT
  const token   = getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept':       'application/json',
    ...config?.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      method,
      headers,
      body:   body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Parsear la respuesta JSON del backend
    let json: any;
    try {
      json = await response.json();
    } catch {
      // El servidor devolvió algo que no es JSON (ej: error de red o proxy)
      throw new ApiClientError(
        {
          success:   false,
          error:     'El servidor no respondió correctamente. Intente nuevamente.',
          code:      'SERVER_ERROR',
          timestamp: new Date().toISOString(),
        },
        response.status
      );
    }

    // Manejar respuestas de error del backend (status no-2xx)
    if (!response.ok) {
      // Intentar extraer el detalle del error (FastAPI usa { "detail": "..." })
      const errorMsg = json?.detail || json?.error || 'Error en el servidor.';
      const errorCode = json?.code || 'SERVER_ERROR';

      // 401 → Token inválido o expirado → limpiar sesión y redirigir
      if (response.status === 401) {
        clearAllSessionData();
        if (globalCallbacks.onUnauthorized) {
          // El hook useAuth ya está montado: delegar la redirección al router de Next.js
          globalCallbacks.onUnauthorized();
        } else {
          // El hook aún no se montó (p.ej. sesión expirada antes de hidratar):
          // redirigir directamente con hard navigation para garantizar que se llega al login
          if (typeof window !== 'undefined') {
            window.location.href = '/auth/login?reason=sesion_expirada';
          }
        }
        // Devolver una promesa que nunca se resuelve para evitar que
        // la aplicación React lance un Unhandled Runtime Error mientras el router redirige.
        return new Promise(() => {}) as Promise<T>;
      }

      // 403 → Sin permisos para la acción
      if (response.status === 403) {
        globalCallbacks.onForbidden?.();
      }

      throw new ApiClientError(
        {
          success:   false,
          error:     formatErrorDetail(errorMsg),
          code:      errorCode,
          timestamp: json?.timestamp || new Date().toISOString(),
        },
        response.status
      );
    }

    // Si la respuesta es exitosa (2xx)
    // Caso A: Formato antiguo/Express { success: true, data: ... }
    if (json && typeof json === 'object' && 'success' in json) {
      if (!json.success) {
        throw new ApiClientError(json as ApiError, response.status);
      }
      return json.data;
    }

    // Caso B: Formato nuevo/FastAPI direct payload
    return json as T;

  } catch (error) {
    clearTimeout(timeoutId);

    // Re-lanzar ApiClientError directamente (ya está formateado)
    if (error instanceof ApiClientError) throw error;

    // Timeout o Abort
    if (error instanceof DOMException && error.name === 'AbortError') {
      if (isTimeout) {
        throw new ApiClientError(
          {
            success:   false,
            error:     'La operación tardó demasiado. Verifique su conexión e intente nuevamente.',
            code:      'REQUEST_TIMEOUT',
            timestamp: new Date().toISOString(),
          },
          408
        );
      } else {
        // Aborto manual (ej. al escribir rápido en la búsqueda)
        throw error;
      }
    }

    // Error de red (sin conexión, CORS, etc.)
    throw new ApiClientError(
      {
        success:   false,
        error:     'No se pudo conectar al servidor. Verifique su conexión a internet.',
        code:      'NETWORK_ERROR',
        timestamp: new Date().toISOString(),
      },
      0
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Métodos HTTP del cliente
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cliente API del SGPI con métodos tipados para cada verbo HTTP.
 * Todos los métodos devuelven el dato directamente (no la envoltura ApiResponse).
 */
/**
 * Invalida de forma inteligente la caché del cliente para la entidad afectada
 * basándose en el prefijo del path (ej. al escribir a /groups/*, invalida /groups).
 */
function invalidateRelatedCache(path: string) {
  const parts = path.split('/');
  if (parts.length > 1) {
    const prefix = `/${parts[1]}`;
    clientCache.invalidatePrefix(prefix);
  }
}

export const apiClient = {
  /**
   * Petición GET. Usa caché en memoria del cliente a menos que se indique skipCache.
   *
   * @template T - Tipo del dato esperado
   * @param path   - Ruta relativa del endpoint
   * @param config - Configuración opcional
   */
  async get<T>(path: string, config?: RequestConfig): Promise<T> {
    if (!config?.skipCache) {
      const cached = clientCache.get(path, config?.ttl);
      if (cached !== null) {
        return cached as T;
      }
    }
    const res = await request<T>('GET', path, undefined, config);
    if (!config?.skipCache) {
      clientCache.set(path, res);
    }
    return res;
  },

  /**
   * Petición POST. Al realizar una escritura, invalida la caché de la entidad relacionada.
   *
   * @template T - Tipo del dato esperado en la respuesta
   * @param path   - Ruta relativa del endpoint
   * @param body   - Cuerpo de la petición
   * @param config - Configuración opcional
   */
  async post<T>(path: string, body?: unknown, config?: RequestConfig): Promise<T> {
    const res = await request<T>('POST', path, body, config);
    invalidateRelatedCache(path);
    return res;
  },

  /**
   * Petición PUT. Al realizar una escritura, invalida la caché de la entidad relacionada.
   *
   * @template T - Tipo del dato esperado en la respuesta
   * @param path   - Ruta relativa del endpoint
   * @param body   - Cuerpo de la petición
   * @param config - Configuración opcional
   */
  async put<T>(path: string, body?: unknown, config?: RequestConfig): Promise<T> {
    const res = await request<T>('PUT', path, body, config);
    invalidateRelatedCache(path);
    return res;
  },

  /**
   * Petición PATCH. Al realizar una escritura, invalida la caché de la entidad relacionada.
   *
   * @template T - Tipo del dato esperado en la respuesta
   * @param path   - Ruta relativa del endpoint
   * @param body   - Cuerpo de la petición
   * @param config - Configuración opcional
   */
  async patch<T>(path: string, body?: unknown, config?: RequestConfig): Promise<T> {
    const res = await request<T>('PATCH', path, body, config);
    invalidateRelatedCache(path);
    return res;
  },

  /**
   * Petición DELETE. Al realizar una escritura, invalida la caché de la entidad relacionada.
   *
   * @template T - Tipo del dato esperado en la respuesta
   * @param path   - Ruta relativa del endpoint
   * @param config - Configuración opcional
   */
  async delete<T>(path: string, config?: RequestConfig): Promise<T> {
    const res = await request<T>('DELETE', path, undefined, config);
    invalidateRelatedCache(path);
    return res;
  },

  /**
   * Sube un archivo al backend usando multipart/form-data.
   * Nota: No usa JSON, por lo que no agrega Content-Type (el browser lo pone).
   *
   * @template T - Tipo del dato esperado en la respuesta
   * @param path     - Ruta relativa del endpoint
   * @param formData - FormData con el archivo y metadata
   * @param config   - Configuración opcional (timeout largo recomendado)
   */
  async upload<T>(
    path:     string,
    formData: FormData,
    config?:  RequestConfig
  ): Promise<T> {
    const url     = `${BASE_URL}${API_PREFIX}${path}`;
    const timeout = config?.timeout ?? HEAVY_TIMEOUT_MS;

    const controller = new AbortController();
    let isTimeout = false;
    const timeoutId  = setTimeout(() => {
      isTimeout = true;
      controller.abort();
    }, timeout);

    const token   = getAccessToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const response = await fetch(url, {
        method:  'POST',
        headers,
        body:    formData,
        signal:  controller.signal,
      });

      clearTimeout(timeoutId);

      let json: any;
      try {
        json = await response.json();
      } catch {
        throw new ApiClientError(
          {
            success:   false,
            error:     'Error al procesar la respuesta del servidor.',
            code:      'SERVER_ERROR',
            timestamp: new Date().toISOString(),
          },
          response.status
        );
      }

      // Manejar respuestas de error del backend (status no-2xx)
      if (!response.ok) {
        const errorMsg = json?.detail || json?.error || 'Error al procesar la subida.';
        const errorCode = json?.code || 'SERVER_ERROR';

        if (response.status === 401) {
          clearAllSessionData();
          if (globalCallbacks.onUnauthorized) {
            globalCallbacks.onUnauthorized();
          } else {
            if (typeof window !== 'undefined') {
              window.location.href = '/auth/login?reason=sesion_expirada';
            }
          }
          // Devolver una promesa que nunca se resuelve para evitar que
          // la aplicación React lance un Unhandled Runtime Error mientras el router redirige.
          return new Promise(() => {}) as Promise<T>;
        }
        if (response.status === 403) {
          globalCallbacks.onForbidden?.();
        }

        throw new ApiClientError(
          {
            success:   false,
            error:     formatErrorDetail(errorMsg),
            code:      errorCode,
            timestamp: json?.timestamp || new Date().toISOString(),
          },
          response.status
        );
      }

      // Si la respuesta es exitosa (2xx)
      // Caso A: Formato antiguo/Express { success: true, data: ... }
      if (json && typeof json === 'object' && 'success' in json) {
        if (!json.success) {
          throw new ApiClientError(json as ApiError, response.status);
        }
        const res = json.data;
        invalidateRelatedCache(path);
        return res;
      }

      // Caso B: Formato nuevo/FastAPI direct payload
      const res = json as T;
      invalidateRelatedCache(path);
      return res;

    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof ApiClientError) throw error;

      if (error instanceof DOMException && error.name === 'AbortError') {
        if (isTimeout) {
          throw new ApiClientError(
            {
              success:   false,
              error:     'La subida del archivo tardó demasiado. Intente nuevamente.',
              code:      'REQUEST_TIMEOUT',
              timestamp: new Date().toISOString(),
            },
            408
          );
        } else {
          throw error;
        }
      }

      throw new ApiClientError(
        {
          success:   false,
          error:     'No se pudo conectar al servidor durante la subida del archivo.',
          code:      'NETWORK_ERROR',
          timestamp: new Date().toISOString(),
        },
        0
      );
    }
  },
};
