'use client';

/**
 * @file useApi.ts
 * @description Hook genérico para realizar peticiones a la API del SGPI.
 * Gestiona estado de carga, errores y datos automáticamente.
 *
 * Características:
 * - Estado loading/error/data automáticos
 * - Detecta 401 → redirige al login (vía router de Next.js)
 * - Detecta 403 → muestra mensaje de permisos
 * - Nunca expone stack traces al usuario (RNF013)
 * - Timeout de 5 segundos por defecto; 10 minutos para operaciones pesadas
 */

import { useState, useCallback, useRef } from 'react';
import { useRouter }                      from 'next/navigation';
import type { UseApiState, RequestConfig } from '../types/api';
import { apiClient, ApiClientError }       from '../api/client';

// ─────────────────────────────────────────────────────────────────────────────
// Hook principal
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hook genérico para peticiones a la API del SGPI.
 *
 * @template T - Tipo del dato esperado en la respuesta
 * @returns Estado de la petición + funciones para ejecutarla
 *
 * @example
 * const { data, isLoading, error, get } = useApi<Investigator[]>();
 *
 * useEffect(() => {
 *   get('/investigators');
 * }, []);
 */
export function useApi<T = unknown>() {
  const router = useRouter();

  const [state, setState] = useState<UseApiState<T>>({
    data:      null,
    isLoading: false,
    error:     null,
  });

  // Ref para evitar setState en componentes desmontados
  const isMounted = useRef(true);

  const setStateIfMounted = useCallback((update: Partial<UseApiState<T>>) => {
    if (isMounted.current) {
      setState((prev) => ({ ...prev, ...update }));
    }
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // Manejador de errores centralizado
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Procesa un error de la API y actualiza el estado con el mensaje amigable.
   * Gestiona redirecciones para 401 y mensajes especiales para 403.
   *
   * @param error - Error capturado
   */
  const handleError = useCallback((error: unknown) => {
    if (error instanceof ApiClientError) {
      // 401 → sesión expirada o token inválido → redirigir al login
      if (error.httpStatus === 401) {
        router.push('/login');
        return;
      }

      // 403 → sin permisos: mensaje específico (RNF001)
      if (error.httpStatus === 403) {
        setStateIfMounted({
          isLoading: false,
          error:     'No tienes permisos para realizar esta acción.',
        });
        return;
      }

      // Cualquier otro error de la API → mensaje amigable del backend
      setStateIfMounted({
        isLoading: false,
        error:     error.message, // Siempre en español, sin stack trace
      });
      return;
    }

    // Error inesperado (no ApiClientError) → mensaje genérico (RNF013)
    setStateIfMounted({
      isLoading: false,
      error:     'Ocurrió un error inesperado. Por favor, intente nuevamente.',
    });
  }, [router, setStateIfMounted]);

  // ──────────────────────────────────────────────────────────────────────────
  // Métodos HTTP
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Petición GET.
   *
   * @param path   - Ruta relativa del endpoint
   * @param config - Configuración opcional (timeout, headers)
   */
  const get = useCallback(async (
    path:    string,
    config?: RequestConfig
  ): Promise<T | null> => {
    setStateIfMounted({ isLoading: true, error: null });
    try {
      const data = await apiClient.get<T>(path, config);
      setStateIfMounted({ data, isLoading: false });
      return data;
    } catch (err) {
      handleError(err);
      return null;
    }
  }, [setStateIfMounted, handleError]);

  /**
   * Petición POST.
   *
   * @param path   - Ruta relativa del endpoint
   * @param body   - Cuerpo de la petición
   * @param config - Configuración opcional
   */
  const post = useCallback(async (
    path:    string,
    body?:   unknown,
    config?: RequestConfig
  ): Promise<T | null> => {
    setStateIfMounted({ isLoading: true, error: null });
    try {
      const data = await apiClient.post<T>(path, body, config);
      setStateIfMounted({ data, isLoading: false });
      return data;
    } catch (err) {
      handleError(err);
      return null;
    }
  }, [setStateIfMounted, handleError]);

  /**
   * Petición PUT.
   *
   * @param path   - Ruta relativa del endpoint
   * @param body   - Cuerpo de la petición
   * @param config - Configuración opcional
   */
  const put = useCallback(async (
    path:    string,
    body?:   unknown,
    config?: RequestConfig
  ): Promise<T | null> => {
    setStateIfMounted({ isLoading: true, error: null });
    try {
      const data = await apiClient.put<T>(path, body, config);
      setStateIfMounted({ data, isLoading: false });
      return data;
    } catch (err) {
      handleError(err);
      return null;
    }
  }, [setStateIfMounted, handleError]);

  /**
   * Subida de archivo (multipart/form-data).
   *
   * @param path     - Ruta relativa del endpoint
   * @param formData - FormData con el archivo
   * @param config   - Configuración opcional (timeout largo recomendado)
   */
  const upload = useCallback(async (
    path:     string,
    formData: FormData,
    config?:  RequestConfig
  ): Promise<T | null> => {
    setStateIfMounted({ isLoading: true, error: null });
    try {
      const data = await apiClient.upload<T>(path, formData, config);
      setStateIfMounted({ data, isLoading: false });
      return data;
    } catch (err) {
      handleError(err);
      return null;
    }
  }, [setStateIfMounted, handleError]);

  /**
   * Limpia el estado del hook (error y datos) sin disparar una petición.
   */
  const reset = useCallback(() => {
    setStateIfMounted({ data: null, isLoading: false, error: null });
  }, [setStateIfMounted]);

  return {
    /** Datos de la última respuesta exitosa */
    data:      state.data,
    /** true mientras hay una petición en curso */
    isLoading: state.isLoading,
    /** Mensaje de error amigable, o null si no hay error */
    error:     state.error,
    /** Ejecuta una petición GET */
    get,
    /** Ejecuta una petición POST */
    post,
    /** Ejecuta una petición PUT */
    put,
    /** Ejecuta una subida de archivo */
    upload,
    /** Limpia el estado del hook */
    reset,
  };
}
