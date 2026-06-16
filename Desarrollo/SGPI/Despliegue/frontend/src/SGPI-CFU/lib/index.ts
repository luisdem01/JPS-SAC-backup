/**
 * @file index.ts (SGPI-CFU — raíz)
 * @description Exportador principal del módulo SGPI-CFU (Core Frontend Utils).
 *
 * Agrupa y re-exporta todos los submódulos del sistema:
 * - types:   Tipos TypeScript de toda la aplicación
 * - auth:    JWT, storage y permisos RBAC
 * - api:     Cliente HTTP y endpoints tipados
 * - hooks:   useAuth, useApi, useAsyncJob, useSearch
 * - utils:   Formatters, validators y constantes
 *
 * @example
 * // Importar desde el módulo raíz (recomendado para uso externo)
 * import { useAuth, api, formatDate, canDo, ROUTES } from '@/lib/SGPI-CFU';
 *
 * // Importar desde submódulos (recomendado para imports internos del módulo)
 * import { decodeJwt } from '@/lib/SGPI-CFU/auth/jwt';
 * import type { Project } from '@/lib/SGPI-CFU/types/models';
 */

// ── Tipos ─────────────────────────────────────────────────────────────────────
export * from './types';

// ── Auth ──────────────────────────────────────────────────────────────────────
export * from './auth';

// ── API ───────────────────────────────────────────────────────────────────────
export * from './api';

// ── Hooks ─────────────────────────────────────────────────────────────────────
export * from './hooks';

// ── Utils ─────────────────────────────────────────────────────────────────────
export * from './utils';
