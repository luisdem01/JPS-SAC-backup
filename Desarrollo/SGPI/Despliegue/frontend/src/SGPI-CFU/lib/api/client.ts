/**
 * @file client.ts
 * @description Cliente HTTP centralizado para la API del SGPI.
 * Maneja autenticación JWT, timeouts diferenciados, errores estandarizados
 * y redireccionamiento automático en casos de 401/403.
 *
 * - Timeout normal: 5 segundos
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

// ─────────────────────────────────────────────────────────────────────────────
// Configuración base
// ─────────────────────────────────────────────────────────────────────────────

/** URL base de la API del backend SGPI (FastAPI en Render) */
const BASE_URL = (process.env['NEXT_PUBLIC_API_URL'] as string | undefined) ?? 'http://localhost:3000';

/** Prefijo de versión de la API */
const API_PREFIX = '/api/v1';

/** Timeout por defecto en milisegundos para operaciones normales */
const DEFAULT_TIMEOUT_MS = 5_000;

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
  const timeoutId  = setTimeout(() => controller.abort(), timeout);

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
        globalCallbacks.onUnauthorized?.();
      }

      // 403 → Sin permisos para la acción
      if (response.status === 403) {
        globalCallbacks.onForbidden?.();
      }

      throw new ApiClientError(
        {
          success:   false,
          error:     typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg),
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

    // Timeout (AbortError)
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiClientError(
        {
          success:   false,
          error:     'La operación tardó demasiado. Verifique su conexión e intente nuevamente.',
          code:      'REQUEST_TIMEOUT',
          timestamp: new Date().toISOString(),
        },
        408
      );
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
export const apiClient = {
  /**
   * Petición GET.
   *
   * @template T - Tipo del dato esperado
   * @param path   - Ruta relativa del endpoint
   * @param config - Configuración opcional
   */
  get<T>(path: string, config?: RequestConfig): Promise<T> {
    return request<T>('GET', path, undefined, config);
  },

  /**
   * Petición POST.
   *
   * @template T - Tipo del dato esperado en la respuesta
   * @param path   - Ruta relativa del endpoint
   * @param body   - Cuerpo de la petición
   * @param config - Configuración opcional
   */
  post<T>(path: string, body?: unknown, config?: RequestConfig): Promise<T> {
    return request<T>('POST', path, body, config);
  },

  /**
   * Petición PUT.
   *
   * @template T - Tipo del dato esperado en la respuesta
   * @param path   - Ruta relativa del endpoint
   * @param body   - Cuerpo de la petición
   * @param config - Configuración opcional
   */
  put<T>(path: string, body?: unknown, config?: RequestConfig): Promise<T> {
    return request<T>('PUT', path, body, config);
  },

  /**
   * Petición PATCH.
   *
   * @template T - Tipo del dato esperado en la respuesta
   * @param path   - Ruta relativa del endpoint
   * @param body   - Cuerpo de la petición
   * @param config - Configuración opcional
   */
  patch<T>(path: string, body?: unknown, config?: RequestConfig): Promise<T> {
    return request<T>('PATCH', path, body, config);
  },

  /**
   * Petición DELETE.
   *
   * @template T - Tipo del dato esperado en la respuesta
   * @param path   - Ruta relativa del endpoint
   * @param config - Configuración opcional
   */
  delete<T>(path: string, config?: RequestConfig): Promise<T> {
    return request<T>('DELETE', path, undefined, config);
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
    const timeoutId  = setTimeout(() => controller.abort(), timeout);

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
          globalCallbacks.onUnauthorized?.();
        }
        if (response.status === 403) {
          globalCallbacks.onForbidden?.();
        }

        throw new ApiClientError(
          {
            success:   false,
            error:     typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg),
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
      if (error instanceof ApiClientError) throw error;

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ApiClientError(
          {
            success:   false,
            error:     'La subida del archivo tardó demasiado. Intente nuevamente.',
            code:      'REQUEST_TIMEOUT',
            timestamp: new Date().toISOString(),
          },
          408
        );
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
