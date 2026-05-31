'use client';

/**
 * @file useAuth.ts
 * @description Hook y Context Provider de autenticación del SGPI con gestión completa de sesión.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type {
  AuthState, AuthUser, LoginCredentials, PermissionAction,
} from '../types/auth';
import { SESSION_CONFIG, ROLE_MAP } from '../types/auth';
import { decodeJwt } from '../auth/jwt';
import {
  getAccessToken, setAccessToken, removeAccessToken,
  getRefreshToken, setRefreshToken, removeRefreshToken,
  updateLastActivity, getInactivityMs,
  getFailedAttempts, incrementFailedAttempts, resetFailedAttempts,
  setLockUntil, getLockUntil, isAccountLocked, getLockRemainingMinutes,
  clearAllSessionData,
} from '../auth/storage';
import { canDo } from '../auth/permissions';
import { api } from '../api/endpoints';
import { configureApiCallbacks, ApiClientError } from '../api/client';

const initialState: AuthState = {
  user:              null,
  token:             null,
  isLoading:         true,
  isAuthenticated:   false,
  failedAttempts:    0,
  lockedUntil:       null,
  showExpiryWarning: false,
  minutesRemaining:  60,
};

interface AuthContextType {
  user:              AuthUser | null;
  token:             string | null;
  isLoading:         boolean;
  isAuthenticated:   boolean;
  failedAttempts:    number;
  lockedUntil:       number | null;
  showExpiryWarning: boolean;
  minutesRemaining:  number;
  login:             (credentials: LoginCredentials) => Promise<void>;
  logout:            () => Promise<void>;
  refreshToken:      () => Promise<void>;
  dismissWarning:    () => void;
  canDo:             (action: PermissionAction) => boolean;
}

const isClickable = (el: HTMLElement | null): boolean => {
  if (!el) return false;
  
  const tagName = el.tagName.toLowerCase();
  
  // Direct clickable tags
  if (['button', 'a', 'input', 'select', 'textarea', 'option'].includes(tagName)) {
    return true;
  }
  
  // Direct interactive attributes
  if (el.hasAttribute('onclick') || el.getAttribute('role') === 'button' || el.getAttribute('contenteditable') === 'true') {
    return true;
  }
  
  // Check if cursor is pointer (means it's stylistically clickable)
  try {
    const style = window.getComputedStyle(el);
    if (style.cursor === 'pointer') {
      return true;
    }
  } catch (e) {
    // Ignore errors
  }
  
  // Check parent recursively (e.g. click on a span inside a button)
  if (el.parentElement && el.parentElement !== document.body) {
    return isClickable(el.parentElement as HTMLElement);
  }
  
  return false;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<AuthState>(initialState);

  const inactivityTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningIntervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  const updateState = useCallback((update: Partial<AuthState>) => {
    setState((prev) => ({ ...prev, ...update }));
  }, []);

  const logout = useCallback(async (reason?: string) => {
    const token = getAccessToken();
    if (token) {
      try { await api.auth.logout(); } catch { /* ignore */ }
    }

    if (inactivityTimerRef.current)  clearTimeout(inactivityTimerRef.current);
    if (warningTimerRef.current)     clearTimeout(warningTimerRef.current);
    if (warningIntervalRef.current)  clearInterval(warningIntervalRef.current);

    clearAllSessionData(true);

    setState({
      ...initialState,
      isLoading:      false,
      failedAttempts: getFailedAttempts(),
      lockedUntil:    getLockUntil(),
    });

    const params = reason ? `?reason=${encodeURIComponent(reason)}` : '';
    router.push(`/auth/login${params}`);
  }, [router]);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current)  clearTimeout(inactivityTimerRef.current);
    if (warningTimerRef.current)     clearTimeout(warningTimerRef.current);
    if (warningIntervalRef.current)  clearInterval(warningIntervalRef.current);

    updateLastActivity();

    const warningAfterMs =
      SESSION_CONFIG.INACTIVITY_TIMEOUT_MS - SESSION_CONFIG.WARNING_BEFORE_MS;

    warningTimerRef.current = setTimeout(() => {
      updateState({ showExpiryWarning: true, minutesRemaining: 5 });

      let remaining = 5;
      warningIntervalRef.current = setInterval(() => {
        remaining -= 1;
        updateState({ minutesRemaining: remaining });
        if (remaining <= 0) {
          if (warningIntervalRef.current) clearInterval(warningIntervalRef.current);
        }
      }, 60_000);
    }, warningAfterMs);

    inactivityTimerRef.current = setTimeout(() => {
      logout('inactividad');
    }, SESSION_CONFIG.INACTIVITY_TIMEOUT_MS);
  }, [logout, updateState]);

  useEffect(() => {
    if (!state.isAuthenticated) return;

    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

    const handleActivity = (e: Event) => {
      if (['click', 'mousedown', 'touchstart'].includes(e.type)) {
        const target = e.target as HTMLElement | null;
        if (!isClickable(target)) {
          return;
        }
      }
      updateState({ showExpiryWarning: false, minutesRemaining: 60 });
      resetInactivityTimer();
    };

    activityEvents.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

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

  useEffect(() => {
    const initializeSession = async () => {
      configureApiCallbacks({
        onUnauthorized: () => logout('sesion_expirada'),
        onForbidden:    () => {},
      });

      const token = getAccessToken();

      if (!token) {
        updateState({ isLoading: false });
        return;
      }

      const payload = decodeJwt(token);
      if (!payload || (payload.exp && payload.exp * 1000 < Date.now())) {
        clearAllSessionData();
        updateState({ isLoading: false });
        router.push('/auth/login?reason=sesion_expirada');
        return;
      }

      const inactivityMs = getInactivityMs();
      if (inactivityMs > SESSION_CONFIG.INACTIVITY_TIMEOUT_MS) {
        clearAllSessionData();
        updateState({ isLoading: false });
        router.push('/auth/login?reason=inactividad');
        return;
      }

      try {
        const user = await api.auth.me();
        const normalizedRole = ROLE_MAP[user.role as unknown as string] ?? user.role;

        updateState({
          user:            { ...user, role: normalizedRole },
          token,
          isAuthenticated: true,
          isLoading:       false,
          failedAttempts:  getFailedAttempts(),
          lockedUntil:     getLockUntil(),
        });
      } catch (err) {
        clearAllSessionData();
        updateState({ isLoading: false });
        router.push('/auth/login?reason=sesion_expirada');
      }
    };

    initializeSession();
  }, []);

  const login = useCallback(async (credentials: LoginCredentials): Promise<void> => {
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
 
      const remember = !!credentials.rememberDevice;
      setAccessToken(response.accessToken, remember);
      if (response.refreshToken) {
        setRefreshToken(response.refreshToken, remember);
      }

      const normalizedRole = ROLE_MAP[response.user.role as unknown as string] ?? response.user.role;
      const user: AuthUser = { ...response.user, role: normalizedRole };

      resetFailedAttempts();

      updateState({
        user,
        token:           response.accessToken,
        isAuthenticated: true,
        isLoading:       false,
        failedAttempts:  0,
        lockedUntil:     null,
        showExpiryWarning: false,
        minutesRemaining:  60,
      });

      updateLastActivity();

    } catch (error) {
      let message: string;

      if (error instanceof ApiClientError) {
        const attempts = incrementFailedAttempts();

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

  const dismissWarning = useCallback(() => {
    updateState({ showExpiryWarning: false, minutesRemaining: 60 });
    resetInactivityTimer();
  }, [updateState, resetInactivityTimer]);

  const checkPermission = useCallback((action: PermissionAction): boolean => {
    if (!state.user) return false;
    return canDo(state.user.role, action);
  }, [state.user]);

  const value: AuthContextType = {
    user:              state.user,
    token:             state.token,
    isLoading:         state.isLoading,
    isAuthenticated:   state.isAuthenticated,
    failedAttempts:    state.failedAttempts,
    lockedUntil:       state.lockedUntil,
    showExpiryWarning: state.showExpiryWarning,
    minutesRemaining:  state.minutesRemaining,
    login,
    logout:            () => logout(),
    refreshToken,
    dismissWarning,
    canDo:             checkPermission,
  };

  return React.createElement(AuthContext.Provider, { value }, children);
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
