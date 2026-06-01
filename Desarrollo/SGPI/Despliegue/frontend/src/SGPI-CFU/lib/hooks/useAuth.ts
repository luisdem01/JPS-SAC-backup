'use client';

/**
 * @file useAuth.ts
 * @description Hook de autenticación del SGPI con gestión completa de sesión.
 *
 * Características implementadas:
 * - Login y logout con JWT en localStorage
 * - Timer de inactividad: 30 min expira sesión, aviso a los 25 min
 * - Advertencia emergente 5 minutos antes de expirar
 * - Bloqueo de cuenta tras 3 intentos fallidos (15 minutos)
 * - RBAC: verificación de permisos por rol antes de cualquier acción
 * - Renovación automática de tokens
 *
 * RNF002: Sesión expira a 30 min de inactividad.
 * RNF001: RBAC aplicado en el frontend y en cada llamada API.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter }                                  from 'next/navigation';
import type {
  AuthState, AuthUser, LoginCredentials, PermissionAction,
} from '../types/auth';
import { SESSION_CONFIG, ROLE_MAP }                   from '../types/auth';
import { decodeJwt, getUserDataFromToken }            from '../auth/jwt';
import {
  getAccessToken, setAccessToken, removeAccessToken,
  getRefreshToken, setRefreshToken, removeRefreshToken,
  updateLastActivity, getInactivityMs,
  getFailedAttempts, incrementFailedAttempts, resetFailedAttempts,
  setLockUntil, getLockUntil, isAccountLocked, getLockRemainingMinutes,
  clearAllSessionData,
}                                                     from '../auth/storage';
import { canDo }                                      from '../auth/permissions';
import { api }                                        from '../api/endpoints';
import { configureApiCallbacks, ApiClientError }      from '../api/client';

// ─────────────────────────────────────────────────────────────────────────────
// Estado inicial
// ─────────────────────────────────────────────────────────────────────────────

const initialState: AuthState = {
  user:              null,
  token:             null,
  isLoading:         true,  // true en carga inicial para verificar token existente
  isAuthenticated:   false,
  failedAttempts:    0,
  lockedUntil:       null,
  showExpiryWarning: false,
  minutesRemaining:  30,
};

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hook de autenticación del SGPI.
 * Provee estado de sesión + acciones de login, logout y verificación de permisos.
 *
 * @example
 * const { user, isAuthenticated, isLoading, login, logout, canDo } = useAuth();
 */
export function useAuth() {
  const router = useRouter();
  const [state, setState] = useState<AuthState>(initialState);

  // Refs para los timers (evitar closures stale)
  const inactivityTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningIntervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  // ──────────────────────────────────────────────────────────────────────────
  // Helpers de estado
  // ──────────────────────────────────────────────────────────────────────────

  const updateState = useCallback((update: Partial<AuthState>) => {
    setState((prev) => ({ ...prev, ...update }));
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // Logout (limpia sesión y redirige)
  // ──────────────────────────────────────────────────────────────────────────

  const logout = useCallback(async (reason?: string) => {
    // Intentar notificar al backend (no bloqueante)
    const token = getAccessToken();
    if (token) {
      try { await api.auth.logout(); } catch { /* ignorar errores de red */ }
    }

    // Limpiar timers
    if (inactivityTimerRef.current)  clearTimeout(inactivityTimerRef.current);
    if (warningTimerRef.current)     clearTimeout(warningTimerRef.current);
    if (warningIntervalRef.current)  clearInterval(warningIntervalRef.current);

    // Limpiar storage
    clearAllSessionData(true); // preservar estado de bloqueo si existe

    // Resetear estado
    setState({
      ...initialState,
      isLoading:      false,
      failedAttempts: getFailedAttempts(),
      lockedUntil:    getLockUntil(),
    });

    // Redirigir al login con el motivo en la URL
    const params = reason ? `?reason=${encodeURIComponent(reason)}` : '';
    router.push(`/login${params}`);
  }, [router]);

  // ──────────────────────────────────────────────────────────────────────────
  // Timer de inactividad
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Reinicia el timer de inactividad.
   * La sesión expira tras 30 min sin actividad.
   * A los 25 min (5 min antes), se muestra la advertencia.
   */
  const resetInactivityTimer = useCallback(() => {
    // Cancelar timers anteriores
    if (inactivityTimerRef.current)  clearTimeout(inactivityTimerRef.current);
    if (warningTimerRef.current)     clearTimeout(warningTimerRef.current);
    if (warningIntervalRef.current)  clearInterval(warningIntervalRef.current);

    updateLastActivity();

    // Timer de advertencia a los 25 minutos
    const warningAfterMs =
      SESSION_CONFIG.INACTIVITY_TIMEOUT_MS - SESSION_CONFIG.WARNING_BEFORE_MS;

    warningTimerRef.current = setTimeout(() => {
      // Mostrar la advertencia con countdown
      updateState({ showExpiryWarning: true, minutesRemaining: 5 });

      // Actualizar el contador cada minuto
      let remaining = 5;
      warningIntervalRef.current = setInterval(() => {
        remaining -= 1;
        updateState({ minutesRemaining: remaining });
        if (remaining <= 0) {
          if (warningIntervalRef.current) clearInterval(warningIntervalRef.current);
        }
      }, 60_000);
    }, warningAfterMs);

    // Timer de expiración a los 30 minutos
    inactivityTimerRef.current = setTimeout(() => {
      logout('inactividad');
    }, SESSION_CONFIG.INACTIVITY_TIMEOUT_MS);
  }, [logout, updateState]);

  // ──────────────────────────────────────────────────────────────────────────
  // Registrar eventos de actividad del usuario
  // ──────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!state.isAuthenticated) return;

    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

    const handleActivity = () => {
      updateState({ showExpiryWarning: false, minutesRemaining: 30 });
      resetInactivityTimer();
    };

    activityEvents.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Iniciar el timer cuando el usuario se autentica
    resetInactivityTimer();

    return () => {
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      if (inactivityTimerRef.current)  clearTimeout(inactivityTimerRef.current);
      if (warningTimerRef.current)     clearTimeout(warningTimerRef.current);
      if (warningIntervalRef.current)  clearInterval(warningIntervalRef.current);
    };
  }, [state.isAuthenticated, resetInactivityTimer, updateState]);

  // ──────────────────────────────────────────────────────────────────────────
  // Verificación de sesión al montar (token existente en localStorage)
  // ──────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const initializeSession = async () => {
      // Configurar callbacks del cliente API para manejar 401/403
      configureApiCallbacks({
        onUnauthorized: () => logout('sesion_expirada'),
        onForbidden:    () => { /* manejado en useApi */ },
      });

      const token = getAccessToken();

      if (!token) {
        updateState({ isLoading: false });
        return;
      }

      // Verificar que el token no haya expirado localmente
      const payload = decodeJwt(token);
      if (!payload || (payload.exp && payload.exp * 1000 < Date.now())) {
        clearAllSessionData();
        updateState({ isLoading: false });
        return;
      }

      // Verificar inactividad acumulada
      const inactivityMs = getInactivityMs();
      if (inactivityMs > SESSION_CONFIG.INACTIVITY_TIMEOUT_MS) {
        clearAllSessionData();
        updateState({ isLoading: false });
        router.push('/login?reason=inactividad');
        return;
      }

      // Token válido: cargar datos del usuario desde el backend
      try {
        const user = await api.auth.me();
        // Normalizar el rol del backend (español) al tipo interno
        const normalizedRole = ROLE_MAP[user.role as unknown as string] ?? user.role;

        updateState({
          user:            { ...user, role: normalizedRole },
          token,
          isAuthenticated: true,
          isLoading:       false,
          failedAttempts:  getFailedAttempts(),
          lockedUntil:     getLockUntil(),
        });
      } catch {
        // Si no podemos obtener el perfil, limpiar la sesión
        clearAllSessionData();
        updateState({ isLoading: false });
      }
    };

    initializeSession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // Login
  // ──────────────────────────────────────────────────────────────────────────

  const login = useCallback(async (credentials: LoginCredentials): Promise<void> => {
    // Verificar si la cuenta está bloqueada antes de intentar login
    if (isAccountLocked()) {
      const minutes = getLockRemainingMinutes();
      updateState({
        lockedUntil: getLockUntil(),
        failedAttempts: SESSION_CONFIG.MAX_FAILED_ATTEMPTS,
      });
      throw new Error(
        `Cuenta bloqueada. Intente nuevamente en ${minutes} minuto${minutes !== 1 ? 's' : ''}.`
      );
    }

    updateState({ isLoading: true });

    try {
      const response = await api.auth.login(credentials);

      // Guardar tokens en localStorage
      setAccessToken(response.accessToken);
      if (response.refreshToken) {
        setRefreshToken(response.refreshToken);
      }

      // Normalizar el rol del backend al tipo interno
      const normalizedRole = ROLE_MAP[response.user.role as unknown as string] ?? response.user.role;
      const user: AuthUser = { ...response.user, role: normalizedRole };

      // Resetear intentos fallidos y bloqueo tras login exitoso
      resetFailedAttempts();

      updateState({
        user,
        token:           response.accessToken,
        isAuthenticated: true,
        isLoading:       false,
        failedAttempts:  0,
        lockedUntil:     null,
        showExpiryWarning: false,
        minutesRemaining:  30,
      });

      // Iniciar el timer de inactividad
      updateLastActivity();

    } catch (error) {
      let message: string;

      if (error instanceof ApiClientError) {
        // Incrementar contador de intentos fallidos
        const attempts = incrementFailedAttempts();

        // Bloquear tras MAX_FAILED_ATTEMPTS intentos
        if (attempts >= SESSION_CONFIG.MAX_FAILED_ATTEMPTS) {
          const lockUntil = Date.now() + SESSION_CONFIG.LOCK_DURATION_MS;
          setLockUntil(lockUntil);

          message = `Demasiados intentos fallidos. Su cuenta ha sido bloqueada por ${SESSION_CONFIG.LOCK_DURATION_MS / 60000} minutos.`;
          updateState({
            isLoading:      false,
            failedAttempts: attempts,
            lockedUntil:    lockUntil,
          });
        } else {
          const remaining = SESSION_CONFIG.MAX_FAILED_ATTEMPTS - attempts;
          message = `Credenciales incorrectas. Le quedan ${remaining} intento${remaining !== 1 ? 's' : ''}.`;
          updateState({ isLoading: false, failedAttempts: attempts });
        }
      } else if (error instanceof Error) {
        message = error.message;
        updateState({ isLoading: false });
      } else {
        message = 'No se pudo iniciar sesión. Por favor, intente nuevamente.';
        updateState({ isLoading: false });
      }

      throw new Error(message);
    }
  }, [updateState]);

  // ──────────────────────────────────────────────────────────────────────────
  // Renovación de token
  // ──────────────────────────────────────────────────────────────────────────

  const refreshToken = useCallback(async (): Promise<void> => {
    const storedRefreshToken = getRefreshToken();
    if (!storedRefreshToken) {
      await logout('sin_refresh_token');
      return;
    }

    try {
      const response = await api.auth.refresh(storedRefreshToken);
      setAccessToken(response.accessToken);
      updateState({ token: response.accessToken });
    } catch {
      await logout('refresh_fallido');
    }
  }, [logout, updateState]);

  // ──────────────────────────────────────────────────────────────────────────
  // Descartar advertencia de expiración
  // ──────────────────────────────────────────────────────────────────────────

  const dismissWarning = useCallback(() => {
    updateState({ showExpiryWarning: false, minutesRemaining: 30 });
    resetInactivityTimer();
  }, [updateState, resetInactivityTimer]);

  // ──────────────────────────────────────────────────────────────────────────
  // Verificación de permisos RBAC
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Verifica si el usuario autenticado tiene permiso para una acción.
   * Atajo para canDo(user.role, action).
   *
   * @param action - Acción a verificar
   * @returns true si el usuario tiene el permiso
   */
  const checkPermission = useCallback((action: PermissionAction): boolean => {
    if (!state.user) return false;
    return canDo(state.user.role, action);
  }, [state.user]);

  // ──────────────────────────────────────────────────────────────────────────
  // Retorno del hook
  // ──────────────────────────────────────────────────────────────────────────

  return {
    // Estado
    user:              state.user,
    token:             state.token,
    isLoading:         state.isLoading,
    isAuthenticated:   state.isAuthenticated,
    failedAttempts:    state.failedAttempts,
    lockedUntil:       state.lockedUntil,
    showExpiryWarning: state.showExpiryWarning,
    minutesRemaining:  state.minutesRemaining,

    // Acciones
    login,
    logout:         () => logout(),
    refreshToken,
    dismissWarning,

    /** Verifica permisos RBAC del usuario actual */
    canDo: checkPermission,
  };
}
