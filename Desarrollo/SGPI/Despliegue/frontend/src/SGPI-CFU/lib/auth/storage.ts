/**
 * @file storage.ts
 * @description Capa de abstracción para el almacenamiento de tokens JWT en localStorage.
 * Centraliza el acceso para facilitar cambios futuros (ej: migrar a httpOnly cookies).
 *
 * NOTA DE SEGURIDAD: Los tokens se almacenan en localStorage según el requisito
 * del sistema. En producción considerar httpOnly cookies si el backend lo soporta.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Claves de almacenamiento
// ─────────────────────────────────────────────────────────────────────────────

/** Clave para el token de acceso en localStorage */
const ACCESS_TOKEN_KEY  = 'sgpi_access_token';

/** Clave para el token de refresco en localStorage */
const REFRESH_TOKEN_KEY = 'sgpi_refresh_token';

/** Clave para el timestamp del último evento de actividad del usuario */
const LAST_ACTIVITY_KEY = 'sgpi_last_activity';

/** Clave para el conteo de intentos fallidos de login */
const FAILED_ATTEMPTS_KEY = 'sgpi_failed_attempts';

/** Clave para el timestamp de bloqueo de cuenta */
const LOCK_UNTIL_KEY = 'sgpi_lock_until';

// ─────────────────────────────────────────────────────────────────────────────
// Token de acceso
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Obtiene el token de acceso JWT almacenado en localStorage.
 *
 * @returns El token de acceso, o null si no existe
 */
export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null; // SSR guard
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

/**
 * Almacena el token de acceso JWT en localStorage.
 *
 * @param token - Token de acceso JWT
 */
export function setAccessToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

/**
 * Elimina el token de acceso de localStorage.
 */
export function removeAccessToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
}

// Alias semántico para compatibilidad
/** @alias getAccessToken */
export const getToken    = getAccessToken;
/** @alias setAccessToken */
export const setToken    = setAccessToken;
/** @alias removeAccessToken */
export const removeToken = removeAccessToken;

// ─────────────────────────────────────────────────────────────────────────────
// Token de refresco
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Obtiene el token de refresco almacenado en localStorage.
 *
 * @returns El token de refresco, o null si no existe
 */
export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

/**
 * Almacena el token de refresco en localStorage.
 *
 * @param token - Token de refresco
 */
export function setRefreshToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

/**
 * Elimina el token de refresco de localStorage.
 */
export function removeRefreshToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

// ─────────────────────────────────────────────────────────────────────────────
// Control de actividad e inactividad
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Actualiza el timestamp del último evento de actividad del usuario.
 * Debe llamarse en cada interacción (click, keypress, scroll) para
 * reiniciar el contador de inactividad de 30 minutos.
 */
export function updateLastActivity(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
}

/**
 * Obtiene el timestamp del último evento de actividad registrado.
 *
 * @returns Timestamp en milisegundos, o null si no hay registro
 */
export function getLastActivity(): number | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(LAST_ACTIVITY_KEY);
  return stored ? parseInt(stored, 10) : null;
}

/**
 * Calcula los milisegundos desde el último evento de actividad.
 *
 * @returns Milisegundos de inactividad, o Infinity si no hay registro
 */
export function getInactivityMs(): number {
  const lastActivity = getLastActivity();
  if (!lastActivity) return Infinity;
  return Date.now() - lastActivity;
}

// ─────────────────────────────────────────────────────────────────────────────
// Control de intentos fallidos y bloqueo de cuenta
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Obtiene el número de intentos fallidos de login consecutivos.
 *
 * @returns Número de intentos fallidos (0 si no hay registro)
 */
export function getFailedAttempts(): number {
  if (typeof window === 'undefined') return 0;
  const stored = localStorage.getItem(FAILED_ATTEMPTS_KEY);
  return stored ? parseInt(stored, 10) : 0;
}

/**
 * Incrementa el contador de intentos fallidos de login.
 *
 * @returns El nuevo número de intentos fallidos
 */
export function incrementFailedAttempts(): number {
  const current = getFailedAttempts();
  const next    = current + 1;
  if (typeof window !== 'undefined') {
    localStorage.setItem(FAILED_ATTEMPTS_KEY, next.toString());
  }
  return next;
}

/**
 * Reinicia el contador de intentos fallidos a 0.
 * Debe llamarse tras un login exitoso.
 */
export function resetFailedAttempts(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(FAILED_ATTEMPTS_KEY);
}

/**
 * Registra el timestamp hasta cuando la cuenta está bloqueada.
 *
 * @param untilMs - Timestamp en milisegundos hasta cuando dura el bloqueo
 */
export function setLockUntil(untilMs: number): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCK_UNTIL_KEY, untilMs.toString());
}

/**
 * Obtiene el timestamp de expiración del bloqueo de cuenta.
 *
 * @returns Timestamp en ms del fin del bloqueo, o null si no está bloqueada
 */
export function getLockUntil(): number | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(LOCK_UNTIL_KEY);
  return stored ? parseInt(stored, 10) : null;
}

/**
 * Verifica si la cuenta está actualmente bloqueada.
 *
 * @returns true si el bloqueo sigue vigente, false en caso contrario
 */
export function isAccountLocked(): boolean {
  // DEV OVERRIDE: Desactivar bloqueo en desarrollo para facilitar pruebas
  if (process.env.NODE_ENV === 'development') {
    clearLock();
    return false;
  }

  const lockUntil = getLockUntil();
  if (!lockUntil) return false;

  if (Date.now() < lockUntil) return true;

  // El bloqueo expiró: limpiamos el estado
  clearLock();
  return false;
}

/**
 * Calcula los minutos restantes de bloqueo.
 *
 * @returns Minutos restantes de bloqueo, o 0 si no está bloqueada
 */
export function getLockRemainingMinutes(): number {
  const lockUntil = getLockUntil();
  if (!lockUntil || Date.now() >= lockUntil) return 0;
  return Math.ceil((lockUntil - Date.now()) / 60000);
}

/**
 * Limpia el estado de bloqueo de la cuenta.
 */
export function clearLock(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(LOCK_UNTIL_KEY);
  localStorage.removeItem(FAILED_ATTEMPTS_KEY);
}

// ─────────────────────────────────────────────────────────────────────────────
// Limpieza total de sesión
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Limpia todos los datos de sesión del localStorage.
 * Debe llamarse en logout, expiración de sesión y errores 401.
 *
 * @param preserveLockState - Si true, no limpia el estado de bloqueo (default: false)
 */
export function clearAllSessionData(preserveLockState = false): void {
  if (typeof window === 'undefined') return;

  removeAccessToken();
  removeRefreshToken();
  localStorage.removeItem(LAST_ACTIVITY_KEY);

  if (!preserveLockState) {
    clearLock();
  }
}
