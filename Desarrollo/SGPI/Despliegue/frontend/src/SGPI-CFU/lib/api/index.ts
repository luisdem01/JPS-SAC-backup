/**
 * @file index.ts (api)
 * @description Re-exporta el cliente API y todos los endpoints del SGPI-CFU.
 *
 * @example
 * import { api, apiClient, ApiClientError } from '@/lib/SGPI-CFU/api';
 * const investigators = await api.investigators.list({ page: 1, limit: 20 });
 */

export { apiClient, ApiClientError, configureApiCallbacks, HEAVY_TIMEOUT_MS } from './client';
export { api } from './endpoints';
export type {
  ProjectFilters,
  CallFilters,
  LogFilters,
  ReportParams,
  CreateUserPayload,
  PublicationAction,
} from './endpoints';
