/**
 * @file syncService.ts
 * @description Servicio para los endpoints de Sincronización Global (SGPI-CFSF).
 * Cubre: lanzar sync, consultar estado del job, verificar salud de fuentes y gestionar cuarentena.
 */

import { apiClient, HEAVY_TIMEOUT_MS } from '../api/client';

// ─── Tipos de entrada ─────────────────────────────────────────────────────────

export type SyncSourceId = 'VRIP' | 'CYBERTESIS' | 'RENACYT';

export interface SyncFilters {
  year?: number;
  year_start?: number;
  year_end?: number;
  degree?: string | null;
  expanded_search?: boolean;
}

export interface SyncRequest {
  sources: SyncSourceId[];
  filters?: SyncFilters;
}

// ─── Tipos de respuesta ───────────────────────────────────────────────────────

export interface SyncJobStarted {
  job_id: string;
  sources: SyncSourceId[];
  filters: SyncFilters;
  message: string;
}

export interface SyncSourceReport {
  procesados: number;
  resueltos: number;
  cuarentena: number;
  errores: number;
  convocatorias_extraidas?: number;
  total?: number;
  error?: string;
  registros?: { tipo: string; id: string; titulo: string; estado: string; }[];
}

export interface SyncJobStatusData {
  job_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  sources: SyncSourceId[];
  started_at: string;
  finished_at?: string;
  error?: string;
  report?: Record<SyncSourceId, SyncSourceReport>;
  progress_logs?: { time: string; level: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR'; text: string; }[];
}

export interface SourceHealth {
  available: boolean;
  description: string;
  status: 'online' | 'unavailable' | 'critical_error';
}

export interface SourcesHealthData {
  VRIP: SourceHealth;
  CYBERTESIS: SourceHealth;
  RENACYT: SourceHealth;
  CMR: SourceHealth;
}

// ─── Tipos de Cuarentena ──────────────────────────────────────────────────────

export interface QuarantineItem {
  id_pendiente: number;
  entidad_afectada: string;
  llave_primaria_sugerida: string | null;
  fuentes_involucradas: string[];
  datos_conflicto: Record<string, unknown>;
  motivo_cuarentena: string;
  estado: 'Pendiente' | 'Aprobado' | 'Rechazado';
  fecha_registro: string | null;
  fecha_revision: string | null;
}

export interface QuarantineListData {
  items: QuarantineItem[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface QuarantineResolvePayload {
  action: 'aprobar' | 'rechazar';
  dni_corregido?: string;
  motivo_rechazo?: string;
}

export interface QuarantineResolveResult {
  id_pendiente: number;
  estado: string;
  message: string;
}

// ─── Servicio ─────────────────────────────────────────────────────────────────

export const syncService = {
  /** Lanza una sincronización global en background. */
  run(payload: SyncRequest): Promise<SyncJobStarted> {
    return apiClient.post<SyncJobStarted>('/sync/run', payload, {
      timeout: HEAVY_TIMEOUT_MS,
    });
  },

  /** Consulta el estado actual de un job de sincronización. */
  getJobStatus(jobId: string): Promise<SyncJobStatusData> {
    return apiClient.get<SyncJobStatusData>(`/sync/${jobId}/status`);
  },

  /** Verifica qué conectores están disponibles en el servidor. */
  getSourcesHealth(): Promise<SourcesHealthData> {
    return apiClient.get<SourcesHealthData>('/sync/sources/status');
  },

  // ── Cuarentena ──────────────────────────────────────────────────────────────

  /** Obtiene la lista paginada de registros en cuarentena. */
  listQuarantine(params?: {
    page?: number;
    page_size?: number;
    entidad?: string;
    estado?: string;
  }): Promise<QuarantineListData> {
    const qs = new URLSearchParams();
    if (params?.page)      qs.set('page',      String(params.page));
    if (params?.page_size) qs.set('page_size', String(params.page_size));
    if (params?.entidad)   qs.set('entidad',   params.entidad);
    if (params?.estado)    qs.set('estado',    params.estado);
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return apiClient.get<QuarantineListData>(`/sync/quarantine${query}`);
  },

  /** Obtiene el detalle de un registro en cuarentena. */
  getQuarantineItem(id: number): Promise<QuarantineItem> {
    return apiClient.get<QuarantineItem>(`/sync/quarantine/${id}`);
  },

  /** Aprueba o rechaza un registro en cuarentena. */
  resolveQuarantine(
    id: number,
    payload: QuarantineResolvePayload
  ): Promise<QuarantineResolveResult> {
    return apiClient.post<QuarantineResolveResult>(
      `/sync/quarantine/${id}/resolve`,
      payload
    );
  },
};
