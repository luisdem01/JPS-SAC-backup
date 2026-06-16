'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/hooks/useAuth';

export interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/auth/login?reason=sin_sesion');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#eef0f7] dark:bg-[#0f172a] transition-colors duration-300">
        <div className="flex flex-col items-center max-w-sm px-6 text-center">
          {/* Logo animado premium */}
          <div className="relative mb-6">
            <div className="w-16 h-16 rounded-2xl bg-[#0f172a] dark:bg-white flex items-center justify-center shadow-xl animate-bounce">
              <svg className="w-9 h-9 text-white dark:text-[#0f172a]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                <path d="M6 12v5c3 3 9 3 12 0v-5" />
              </svg>
            </div>
            {/* Spinner giratorio alrededor */}
            <div className="absolute -inset-2 rounded-3xl border-2 border-slate-300 dark:border-slate-700 border-t-[#1e3a6e] dark:border-t-white animate-spin pointer-events-none" />
          </div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1 tracking-tight">
            Verificando Sesión
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 animate-pulse">
            Por favor espere un momento...
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Retornamos null o un spinner mientras se ejecuta el useEffect de redirección
    return null;
  }

  return <>{children}</>;
}

export default AuthGuard;
