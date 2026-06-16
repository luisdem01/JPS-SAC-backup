'use client';
 
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/hooks/useAuth';
 
export function LoginForm() {
  const router = useRouter();
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
 
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner(null);
    try {
      await login({ email, password, rememberDevice });
      router.replace('/busqueda');
    } catch (err: any) {
      setErrorBanner(err.message || 'Error al iniciar sesión. Intente nuevamente.');
    }
  };

  return (
    <div className="w-full max-w-md mx-auto px-8 py-8 bg-white rounded-xl shadow-lg border border-slate-100">

      {/* Encabezado */}
      <div className="flex flex-col items-center mb-6">
        <div className="w-14 h-14 rounded-xl bg-[#0f172a] flex items-center justify-center mb-4">
          <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
            <path d="M6 12v5c3 3 9 3 12 0v-5" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-[#0f172a] mb-0.5">SGPI</h1>
        <p className="text-slate-500 text-sm text-center">
          Sistema de Gestión de Proyectos de Investigación
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">

        {/* Correo */}
        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-[11px] font-bold tracking-widest uppercase text-slate-500">
            Correo Institucional
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
            </span>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="investigador.fisi@unmsm.edu.pe"
              disabled={isLoading}
              className="w-full pl-9 pr-3 py-2 text-sm text-slate-800 bg-white border border-slate-200 rounded outline-none placeholder:text-slate-300 focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {/* Contraseña */}
        <div className="flex flex-col gap-1">
          <label htmlFor="password" className="text-[11px] font-bold tracking-widest uppercase text-slate-500">
            Contraseña
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </span>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={isLoading}
              className="w-full pl-9 pr-10 py-2 text-sm text-slate-800 bg-white border border-slate-200 rounded outline-none placeholder:text-slate-300 focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              disabled={isLoading}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-60"
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {showPassword ? (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Recordar dispositivo + ¿Olvidó su contraseña? */}
        <div className="flex items-center justify-between mt-0.5">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              id="remember-device"
              type="checkbox"
              checked={rememberDevice}
              onChange={(e) => setRememberDevice(e.target.checked)}
              disabled={isLoading}
              className="w-3.5 h-3.5 rounded border-slate-300 accent-[#0f172a] cursor-pointer disabled:opacity-60"
            />
            <span className="text-xs text-slate-600">Recordar dispositivo</span>
          </label>
          <a href="#" className="text-xs font-semibold text-[#1e3a6e] hover:underline">
            ¿Olvidó su contraseña?
          </a>
        </div>

        {/* Banner de error */}
        {errorBanner && (
          <div className="p-3 text-xs font-semibold text-red-600 bg-red-50 rounded-lg border border-red-200">
            {errorBanner}
          </div>
        )}

        {/* Botón */}
        <button
          type="submit"
          disabled={isLoading}
          className={`w-full mt-1 py-2.5 rounded-lg bg-[#0f172a] hover:bg-[#1e293b] text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed`}
        >
          {isLoading ? 'Iniciando Sesión...' : 'Iniciar Sesión'}
        </button>
      </form>

      {/* Footer */}
      <p className="mt-6 text-center text-[11px] text-slate-400">
        Soporte técnico de la FISI · Unidad de Investigación
      </p>
    </div>
  );
}
