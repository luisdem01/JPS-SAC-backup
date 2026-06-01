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
  // Se pueden agregar las demás variantes luego (error, warning, info)
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
