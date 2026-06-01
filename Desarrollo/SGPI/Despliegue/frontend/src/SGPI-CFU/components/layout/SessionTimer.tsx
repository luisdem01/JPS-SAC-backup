'use client';

import React, { useEffect, useState } from 'react';
import { getLastActivity } from '../../lib/auth/storage';
import { SESSION_CONFIG } from '../../lib/types/auth';

/**
 * Componente SessionTimer
 * Muestra una cuenta regresiva visual y no interactiva del tiempo restante de la sesión.
 * El tiempo se actualiza segundo a segundo leyendo del storage compartido y se reinicia
 * automáticamente por cualquier interacción registrada en el sistema.
 */
export function SessionTimer() {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const lastActivity = getLastActivity();
      if (!lastActivity) return 0;
      const elapsed = Date.now() - lastActivity;
      const remaining = Math.max(0, SESSION_CONFIG.INACTIVITY_TIMEOUT_MS - elapsed);
      return Math.ceil(remaining / 1000); // Retorna segundos
    };

    // Establecer valor inicial
    setTimeLeft(calculateTimeLeft());

    // Actualizar cada segundo
    const interval = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Formatea el tiempo restante (segundos) a formato MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (timeLeft <= 0) return null;

  // Tiempo máximo de sesión en segundos (60 minutos)
  const maxSecs = SESSION_CONFIG.INACTIVITY_TIMEOUT_MS / 1000;
  const percentage = (timeLeft / maxSecs) * 100;

  // Definición de colores según tiempo restante
  let statusClasses = 'text-slate-600 bg-slate-50 border-slate-200';
  let ringColorClass = 'text-slate-700';
  let ringBgClass = 'text-slate-200';
  let dotColorClass = 'bg-slate-700';
  
  if (timeLeft <= 60) {
    // Menos de 1 minuto: Crítico
    statusClasses = 'text-red-700 bg-red-50 border-red-200 animate-pulse';
    ringColorClass = 'text-red-600';
    ringBgClass = 'text-red-100';
    dotColorClass = 'bg-red-600';
  } else if (timeLeft <= 300) {
    // Menos de 5 minutos: Advertencia
    statusClasses = 'text-amber-700 bg-amber-50 border-amber-200';
    ringColorClass = 'text-amber-500';
    ringBgClass = 'text-amber-100';
    dotColorClass = 'bg-amber-500';
  }

  // Matemáticas para el anillo de progreso circular SVG
  // r = 6, circunferencia = 2 * PI * 6 = 37.7
  const circumference = 37.7;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div 
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`
          flex items-center gap-2
          h-8 px-3 rounded-full border
          font-sans text-[12px] font-semibold
          transition-all duration-200 ease-in-out
          select-none shadow-sm
          ${statusClasses}
        `}
      >
        {/* Anillo de Progreso y Punto central */}
        <div className="relative flex items-center justify-center w-4 h-4">
          <svg className="absolute w-4 h-4 -rotate-90" viewBox="0 0 16 16">
            <circle
              className={ringBgClass}
              strokeWidth="2"
              stroke="currentColor"
              fill="transparent"
              r="6"
              cx="8"
              cy="8"
            />
            <circle
              className={`${ringColorClass} transition-all duration-1000 ease-linear`}
              strokeWidth="2"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              stroke="currentColor"
              fill="transparent"
              r="6"
              cx="8"
              cy="8"
            />
          </svg>
          <div className={`w-1 h-1 rounded-full ${dotColorClass}`} />
        </div>

        {/* Texto del Cronómetro */}
        <span className="tabular-nums">
          {formatTime(timeLeft)}
        </span>
      </div>

      {/* Tooltip Informativo Premium */}
      {isHovered && (
        <div className="
          absolute right-0 top-10 z-50
          w-56 p-2.5 rounded-lg border border-[#e2e8f0]
          bg-white shadow-lg text-[11px] text-[#64748b] font-sans leading-normal
          animate-in fade-in slide-in-from-top-1 duration-150
        ">
          <p className="font-bold text-[#001631] mb-0.5">
            Tiempo de sesión por inactividad
          </p>
          <p>
            Su sesión se mantendrá activa automáticamente mientras interactúe con el sistema (clic, escribir o hacer scroll).
          </p>
        </div>
      )}
    </div>
  );
}

export default SessionTimer;
