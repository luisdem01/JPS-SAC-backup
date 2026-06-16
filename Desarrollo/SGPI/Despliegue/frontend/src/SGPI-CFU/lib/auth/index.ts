/**
 * @file index.ts (auth)
 * @description Re-exporta todos los módulos de autenticación del SGPI-CFU.
 *
 * @example
 * import { decodeJwt, canDo, getToken } from '@/lib/SGPI-CFU/auth';
 */

export * from './jwt';
export * from './storage';
export * from './permissions';
