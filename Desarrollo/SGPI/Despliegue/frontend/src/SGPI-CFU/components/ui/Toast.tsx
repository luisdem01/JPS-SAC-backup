import React from 'react';

/**
 * @file Toast.tsx
 * @description Componente Toast (Snackbar) para notificaciones.
 * Muestra el diseño para estados de éxito (Success) según mockup.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Íconos
// ─────────────────────────────────────────────────────────────────────────────

const SuccessIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const ErrorIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="15" y1="9" x2="9" y2="15" />
    <line x1="9" y1="9" x2="15" y2="15" />
  </svg>
);

const WarningIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const InfoIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

export interface ToastProps {
  /** Título principal (ej: "Descarga iniciada correctamente.") */
  title:       string;
  /** Mensaje secundario (ej: "La acción se ha registrado en el log de seguridad.") */
  description?: string;
  /** Tipo de notificación */
  variant?:    'success' | 'error' | 'warning' | 'info';
  className?:  string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Estilos por variante
// ─────────────────────────────────────────────────────────────────────────────

interface VariantConfig {
  bg:   string;
  text: string;
  icon: React.ReactNode;
}

const VARIANTS: Record<string, VariantConfig> = {
  success: {
    bg:   'bg-[#16a34a]', // Verde fuerte
    text: 'text-white',
    icon: <SuccessIcon />,
  },
  error: {
    bg:   'bg-[#dc2626]', // Rojo fuerte
    text: 'text-white',
    icon: <ErrorIcon />,
  },
  warning: {
    bg:   'bg-[#d97706]', // Ámbar fuerte
    text: 'text-white',
    icon: <WarningIcon />,
  },
  info: {
    bg:   'bg-[#0284c7]', // Azul claro
    text: 'text-white',
    icon: <InfoIcon />,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────────────────────────────────────

export function Toast({
  title,
  description,
  variant   = 'success',
  className = '',
}: ToastProps) {
  const config = VARIANTS[variant] || VARIANTS.success;

  return (
    <div
      role="alert"
      className={`
        flex items-start gap-3
        p-4 rounded shadow-lg
        min-w-[320px] max-w-[420px]
        font-sans
        ${config.bg}
        ${config.text}
        ${className}
      `}
    >
      {/* Ícono */}
      <div className="flex-shrink-0 mt-0.5">
        {config.icon}
      </div>

      {/* Contenido (Texto) */}
      <div className="flex flex-col">
        <span className="text-[14px] font-semibold leading-tight">
          {title}
        </span>
        {description && (
          <span className="text-[13px] opacity-90 mt-1 leading-snug">
            {description}
          </span>
        )}
      </div>
    </div>
  );
}

export default Toast;
