/**
 * @file jwt.ts
 * @description Utilidades para manejar tokens JWT del SGPI.
 * Decodifica, verifica expiración y extrae claims sin librerías externas.
 * No realiza verificación criptográfica (eso lo hace el backend).
 */

import type { JwtPayload, UserRole } from '../types/auth';
import { ROLE_MAP } from '../types/auth';

// ─────────────────────────────────────────────────────────────────────────────
// Decodificación
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Decodifica el payload de un token JWT sin verificar la firma.
 * La verificación de firma siempre la realiza el backend (RNF001).
 *
 * @param token - Token JWT en formato "header.payload.signature"
 * @returns El payload decodificado, o null si el token es inválido
 */
export function decodeJwt(token: string): JwtPayload | null {
  try {
    // Un JWT válido tiene exactamente 3 partes separadas por "."
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    // El payload es la segunda parte, codificada en Base64URL
    const base64Url = parts[1];
    // Convierte Base64URL a Base64 estándar
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    // Decodifica y parsea el JSON
    const jsonStr = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join('')
    );

    return JSON.parse(jsonStr) as JwtPayload;
  } catch {
    // No exponemos detalles del error de parseo (RNF013)
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Verificación de expiración
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verifica si un token JWT ha expirado.
 *
 * @param token - Token JWT a verificar
 * @returns true si el token expiró o es inválido, false si aún es válido
 */
export function isTokenExpired(token: string): boolean {
  const payload = decodeJwt(token);
  if (!payload || !payload.exp) return true;

  // Comparamos en segundos (el claim exp está en Unix epoch en segundos)
  const nowInSeconds = Math.floor(Date.now() / 1000);
  return payload.exp < nowInSeconds;
}

/**
 * Calcula los segundos restantes de validez de un token JWT.
 *
 * @param token - Token JWT
 * @returns Segundos restantes, o 0 si ya expiró o es inválido
 */
export function getTokenRemainingSeconds(token: string): number {
  const payload = decodeJwt(token);
  if (!payload || !payload.exp) return 0;

  const nowInSeconds = Math.floor(Date.now() / 1000);
  const remaining = payload.exp - nowInSeconds;
  return Math.max(0, remaining);
}

/**
 * Devuelve el timestamp de expiración del token en milisegundos (epoch).
 *
 * @param token - Token JWT
 * @returns Timestamp de expiración en ms, o null si el token es inválido
 */
export function getTokenExpiryMs(token: string): number | null {
  const payload = decodeJwt(token);
  if (!payload || !payload.exp) return null;
  return payload.exp * 1000;
}

// ─────────────────────────────────────────────────────────────────────────────
// Extracción de claims
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extrae el ID de usuario (claim `sub`) de un token JWT.
 *
 * @param token - Token JWT
 * @returns UUID del usuario, o null si el token es inválido
 */
export function getUserIdFromToken(token: string): string | null {
  const payload = decodeJwt(token);
  return payload?.sub ?? null;
}

/**
 * Extrae el correo institucional (claim `email`) de un token JWT.
 *
 * @param token - Token JWT
 * @returns Correo del usuario, o null si el token es inválido
 */
export function getEmailFromToken(token: string): string | null {
  const payload = decodeJwt(token);
  return payload?.email ?? null;
}

/**
 * Extrae el rol del sistema del token JWT y lo normaliza al tipo UserRole.
 * El backend puede enviar el rol en español ("Administrador") o en inglés ("admin").
 *
 * @param token - Token JWT
 * @returns Rol normalizado para el frontend, o null si no está en el payload
 */
export function getRoleFromToken(token: string): UserRole | null {
  const payload = decodeJwt(token);
  if (!payload) return null;

  // Intentar obtener el rol en formato interno del frontend
  if (payload.role && isValidRole(payload.role)) {
    return payload.role;
  }

  // Intentar traducir el rol del backend (español → tipo interno)
  if (payload.rol_sistema) {
    const mapped = ROLE_MAP[payload.rol_sistema];
    if (mapped) return mapped;
  }

  return null;
}

/**
 * Verifica si un string es un UserRole válido.
 *
 * @param role - String a verificar
 * @returns true si es un rol válido del sistema
 */
function isValidRole(role: string): role is UserRole {
  return ['admin', 'secretary', 'chief', 'readonly'].includes(role);
}

/**
 * Extrae todos los datos del usuario del token JWT en un objeto unificado.
 * Útil para inicializar el estado de auth sin llamar al backend.
 *
 * @param token - Token JWT
 * @returns Objeto con id, email y role, o null si el token es inválido
 */
export function getUserDataFromToken(
  token: string
): { id: string; email: string; role: UserRole } | null {
  const id    = getUserIdFromToken(token);
  const email = getEmailFromToken(token);
  const role  = getRoleFromToken(token);

  if (!id || !email || !role) return null;
  return { id, email, role };
}
