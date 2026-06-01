'use client';

/**
 * @file useAsyncJob.ts
 * @description Hook para operaciones asíncronas largas del SGPI.
 * Específico para importaciones Excel, sincronización ETL y generación de reportes.
 *
 * Características:
 * - Polling automático cada 2 segundos al endpoint de status
 * - Devuelve: progress (0-100), status, summary, error
 * - Se detiene automáticamente cuando status = "completed" o "failed"
 * - Feedback visual de progreso para el componente (RNF022)
 * - Nunca expone errores técnicos al usuario (RNF013)
 *
 * @example
 * const { startJob, progress, status, summary, error, isRunning } = useAsyncJob('import');
 * // Iniciar un job:
 * await startJob(async () => importEndpoints.uploadExcel(file));
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { JobStatus, SyncSummary }               from '../types/api';
import { ApiClientError }                            from '../api/client';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos del hook
// ─────────────────────────────────────────────────────────────────────────────

/** Tipo de job que maneja el hook */
export type JobType = 'import' | 'sync' | 'report';

/** Estado del hook useAsyncJob */
export interface AsyncJobState {
  /** ID del job actual (null si no hay job activo) */
  jobId:     string | null;
  /** Estado actual del job en el backend */
  status:    JobStatus | null;
  /** Progreso del job (0-100) */
  progress:  number;
  /** Resumen de resultados (disponible al completarse) */
  summary:   SyncSummary | null;
  /** Mensaje de error amigable (null si no hay error) */
  error:     string | null;
  /** true mientras el job está en cola o corriendo */
  isRunning: boolean;
  /** true cuando el job completó exitosamente */
  isSuccess: boolean;
}

/** Función de status que consulta el backend según el tipo de job */
export type StatusFetcher = (jobId: string) => Promise<{
  status:    JobStatus;
  progress:  number;
  summary?:  SyncSummary;
  errors?:   number;
  processed?: number;
  reportId?: string;
}>;

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────

/** Intervalo de polling en milisegundos */
const POLLING_INTERVAL_MS = 2_000;

/** Estados terminales que detienen el polling */
const TERMINAL_STATUSES: JobStatus[] = ['completed', 'failed'];

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hook para gestionar jobs asíncronos con polling automático.
 *
 * @param statusFetcher - Función que consulta el estado del job en el backend
 * @returns Estado del job + función para iniciarlo
 */
export function useAsyncJob(statusFetcher: StatusFetcher) {
  const [state, setState] = useState<AsyncJobState>({
    jobId:     null,
    status:    null,
    progress:  0,
    summary:   null,
    error:     null,
    isRunning: false,
    isSuccess: false,
  });

  // Ref para el intervalo de polling
  const pollingRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  // Ref para el jobId actual (evita closure stale en el intervalo)
  const currentJobIdRef = useRef<string | null>(null);
  // Ref para saber si el componente sigue montado
  const isMountedRef    = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopPolling();
    };
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // Control del polling
  // ──────────────────────────────────────────────────────────────────────────

  /** Detiene el polling inmediatamente */
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  /**
   * Inicia el polling del status del job.
   * Se llama automáticamente después de obtener el job_id.
   */
  const startPolling = useCallback((jobId: string) => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }
    currentJobIdRef.current = jobId;

    const intervalId = setInterval(async () => {
      if (!isMountedRef.current) {
        clearInterval(intervalId);
        return;
      }

      try {
        const result = await statusFetcher(currentJobIdRef.current!);

        if (!isMountedRef.current) return;

        // Actualizar estado con los datos del polling
        setState((prev) => ({
          ...prev,
          status:    result.status,
          progress:  result.progress ?? prev.progress,
          summary:   result.summary ?? prev.summary,
          error:     null,
        }));

        // Detener el polling si el job terminó
        if (TERMINAL_STATUSES.includes(result.status)) {
          clearInterval(intervalId);
          if (pollingRef.current === intervalId) {
            pollingRef.current = null;
          }

          if (!isMountedRef.current) return;

          if (result.status === 'completed') {
            setState((prev) => ({
              ...prev,
              isRunning: false,
              isSuccess: true,
              progress:  100,
            }));
          } else {
            // Job fallido
            setState((prev) => ({
              ...prev,
              isRunning: false,
              isSuccess: false,
              error:     (result as any).error || 'El proceso falló. Por favor, revise los datos e intente nuevamente.',
            }));
          }
        }

      } catch (err) {
        // Error durante el polling (network, etc.)
        if (!isMountedRef.current) return;

        const message = err instanceof ApiClientError
          ? err.message
          : 'Error al verificar el estado del proceso. Intente nuevamente.';

        clearInterval(intervalId);
        if (pollingRef.current === intervalId) {
          pollingRef.current = null;
        }
        
        setState((prev) => ({
          ...prev,
          isRunning: false,
          isSuccess: false,
          error:     message,
        }));
      }
    }, POLLING_INTERVAL_MS);
  }, [statusFetcher, stopPolling]);

  // ──────────────────────────────────────────────────────────────────────────
  // Iniciar job
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Inicia un job asíncrono.
   * Acepta una función que devuelve el job_id del backend.
   *
   * @param starter - Función async que inicia el job y devuelve el job_id
   *
   * @example
   * await startJob(async () => {
   *   return importEndpoints.uploadExcel(file);
   *   // o syncEndpoints.run('RENACYT');
   * });
   */
  const startJob = useCallback(async (
    starter: () => Promise<{ job_id: string }>
  ): Promise<void> => {
    // Cancelar cualquier job anterior
    stopPolling();

    // Resetear estado
    setState({
      jobId:     null,
      status:    'queued',
      progress:  0,
      summary:   null,
      error:     null,
      isRunning: true,
      isSuccess: false,
    });

    try {
      // Iniciar el job en el backend
      const { job_id } = await starter();

      if (!isMountedRef.current) return;

      setState((prev) => ({ ...prev, jobId: job_id }));

      // Comenzar polling de status
      startPolling(job_id);

    } catch (err) {
      if (!isMountedRef.current) return;

      const message = err instanceof ApiClientError
        ? err.message
        : 'No se pudo iniciar el proceso. Por favor, intente nuevamente.';

      setState((prev) => ({
        ...prev,
        status:    'failed',
        isRunning: false,
        isSuccess: false,
        error:     message,
      }));
    }
  }, [startPolling, stopPolling]);

  // ──────────────────────────────────────────────────────────────────────────
  // Reset manual
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Reinicia el estado del hook a su valor inicial.
   * Útil para permitir re-ejecutar el job tras completarse o fallar.
   */
  const reset = useCallback(() => {
    stopPolling();
    currentJobIdRef.current = null;
    setState({
      jobId:     null,
      status:    null,
      progress:  0,
      summary:   null,
      error:     null,
      isRunning: false,
      isSuccess: false,
    });
  }, [stopPolling]);

  // ──────────────────────────────────────────────────────────────────────────
  // Cancelar job activo
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Cancela el polling del job actual (no cancela el proceso en el backend).
   * El proceso sigue corriendo en el servidor pero dejamos de monitorearlo.
   */
  const cancel = useCallback(() => {
    stopPolling();
    setState((prev) => ({
      ...prev,
      isRunning: false,
      error:     'El proceso fue cancelado.',
    }));
  }, [stopPolling]);

  // ──────────────────────────────────────────────────────────────────────────
  // Propiedad derivada: etiqueta de estado en español
  // ──────────────────────────────────────────────────────────────────────────

  const statusLabel: string = (() => {
    switch (state.status) {
      case 'queued':    return 'En cola...';
      case 'running':   return 'Procesando...';
      case 'completed': return 'Completado';
      case 'failed':    return 'Error';
      default:          return 'Inactivo';
    }
  })();

  return {
    // Estado
    jobId:       state.jobId,
    status:      state.status,
    progress:    state.progress,
    summary:     state.summary,
    error:       state.error,
    isRunning:   state.isRunning,
    isSuccess:   state.isSuccess,
    statusLabel,

    // Acciones
    startJob,
    reset,
    cancel,
  };
}
