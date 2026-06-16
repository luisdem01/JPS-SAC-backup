/**
 * @file index.ts (hooks)
 * @description Re-exporta todos los hooks del módulo SGPI-CFU.
 *
 * @example
 * import { useAuth, useApi, useAsyncJob, useSearch } from '@/lib/SGPI-CFU/hooks';
 */

export { useApi }       from './useApi';
export { useAuth }      from './useAuth';
export { useAsyncJob }  from './useAsyncJob';
export { useSearch }    from './useSearch';

export type { AsyncJobState, JobType, StatusFetcher } from './useAsyncJob';
export type { SearchState, SearchPagination }          from './useSearch';
