import React from 'react';

/**
 * @file Badge.tsx
 * @description Pills de estado del SGPI — Totalmente redondeados (pill-shape).
 *
 * El design.md especifica que los status indicators deben ser
 * pill-shaped (border-radius: full) para distinguirlos de botones.
 *
 * Variantes semáforo:
 * - success  → Emerald  (proyecto activo, sincronizado, aprobado)
 * - warning  → Amber    (pendiente, en proceso, próxima convocatoria)
 * - error    → Rose     (error, rechazado, urgente)
 * - info     → Blue     (información general)
 * - neutral  → Slate    (inactivo, cancelado, sin datos)
 *
 * Variantes de estado de proyecto (del modelo):
 * - active, completed, pending, cancelled → mapean a semáforo
 */

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

export type BadgeVariant =
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'neutral'
  | 'primary';

export type BadgeSize = 'sm' | 'md';

export interface BadgeProps {
  variant?:   BadgeVariant;
  size?:      BadgeSize;
  /** Muestra un círculo de status (8px) antes del texto */
  dot?:       boolean;
  children:   React.ReactNode;
  className?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Estilos
// ─────────────────────────────────────────────────────────────────────────────

const VARIANT_STYLES: Record<BadgeVariant, { pill: string; dot: string }> = {
  success: {
    pill: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
    dot:  'bg-emerald-500',
  },
  warning: {
    pill: 'bg-amber-50 text-amber-800 border border-amber-200',
    dot:  'bg-amber-500',
  },
  error: {
    pill: 'bg-[#ffdad6] text-[#93000a] border border-[#ffb4ab]',
    dot:  'bg-[#ba1a1a]',
  },
  info: {
    pill: 'bg-[#d0e1fb] text-[#1a3050] border border-[#a8c8fa]',
    dot:  'bg-[#40608b]',
  },
  neutral: {
    pill: 'bg-slate-100 text-slate-600 border border-slate-200',
    dot:  'bg-slate-400',
  },
  primary: {
    pill: 'bg-primary-container/10 text-primary-container border border-primary-container/30',
    dot:  'bg-primary-container',
  },
};

const SIZE_STYLES: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-[10px] leading-[16px] font-semibold',
  md: 'px-2.5 py-1 text-[11px] leading-[16px] font-bold tracking-wide',
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers para mapear estados del modelo a variante
// ─────────────────────────────────────────────────────────────────────────────

/** Mapea el estado de un proyecto (en inglés o español) a la variante correcta */
export function projectStatusVariant(status: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    active:      'success',
    completed:   'info',
    pending:     'warning',
    cancelled:   'neutral',
    'En ejecución': 'success',
    'Concluido':    'info',
    'Formulación':  'warning',
    'Aprobado':     'warning',
    'Cancelado':    'neutral',
  };
  return map[status] ?? 'neutral';
}

/** Mapea la urgencia de convocatoria a variante */
export function urgencyVariant(urgency: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    red:    'error',
    yellow: 'warning',
    green:  'success',
  };
  return map[urgency] ?? 'neutral';
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────────────────────────────────────

export function Badge({
  variant   = 'neutral',
  size      = 'sm',
  dot       = false,
  children,
  className = '',
}: BadgeProps) {
  const { pill, dot: dotColor } = VARIANT_STYLES[variant];

  return (
    <span
      className={`
        inline-flex items-center gap-1.5
        rounded-full font-sans uppercase tracking-wide
        ${pill}
        ${SIZE_STYLES[size]}
        ${className}
      `}
    >
      {dot && (
        <span
          className={`inline-block flex-shrink-0 w-2 h-2 rounded-full ${dotColor}`}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}

export default Badge;
