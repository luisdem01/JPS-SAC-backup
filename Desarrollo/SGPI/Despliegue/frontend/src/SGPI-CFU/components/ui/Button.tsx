import React from 'react';

/**
 * @file Button.tsx
 * @description Componente Button del SGPI Design System.
 *
 * Variantes:
 * - primary   → Navy sólido (acción principal)
 * - secondary → Contorno outline (acción secundaria)
 * - ghost     → Transparente con texto (terciario)
 * - danger    → Rojo (acciones destructivas)
 *
 * Tamaños:
 * - sm  → compacto para tablas
 * - md  → estándar (default)
 * - lg  → acciones prominentes
 *
 * Border radius: 4px (Soft — diseño institucional)
 */

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize    = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:   ButtonVariant;
  size?:      ButtonSize;
  /** Ícono a la izquierda del texto */
  iconLeft?:  React.ReactNode;
  /** Ícono a la derecha del texto */
  iconRight?: React.ReactNode;
  /** Muestra spinner de carga y deshabilita el botón */
  loading?:   boolean;
  /** Ancho completo del contenedor */
  fullWidth?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Estilos base
// ─────────────────────────────────────────────────────────────────────────────

const BASE = `
  inline-flex items-center justify-center gap-2
  font-sans font-medium
  border rounded
  transition-colors duration-100
  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#a8c8fa]
  select-none
`.trim();

const DISABLED_CLASSES = `
  !bg-transparent !text-[#cbd5e1] !border-[#e2e8f0] cursor-not-allowed
`.trim();

const VARIANTS: Record<ButtonVariant, string> = {
  primary: `
    bg-[#001631] text-white border-transparent
    hover:bg-[#002b54] active:bg-[#001229]
  `.trim(),

  secondary: `
    bg-transparent text-primary-container border-primary-container
    hover:bg-surface-container-low active:bg-surface-container
  `.trim(),

  ghost: `
    bg-transparent text-on-surface-variant border-transparent
    hover:bg-surface-container-low active:bg-surface-container
  `.trim(),

  danger: `
    bg-error text-on-error border-transparent
    hover:bg-[#9b1616] active:bg-[#7d1212]
  `.trim(),
};

const SIZES: Record<ButtonSize, string> = {
  sm:  'px-3 py-1   text-[12px] leading-[18px] h-7',
  md:  'px-4 py-1.5 text-[13px] leading-[20px] h-8',
  lg:  'px-5 py-2   text-[14px] leading-[20px] h-10',
};

// ─────────────────────────────────────────────────────────────────────────────
// Spinner inline
// ─────────────────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg
      className="animate-spin"
      width="14" height="14" viewBox="0 0 24 24" fill="none"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────────────────────────────────────

export function Button({
  variant   = 'primary',
  size      = 'md',
  iconLeft,
  iconRight,
  loading   = false,
  fullWidth = false,
  children,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  const classes = [
    BASE,
    (disabled || loading) ? DISABLED_CLASSES : VARIANTS[variant],
    SIZES[size],
    fullWidth ? 'w-full' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={classes}
    >
      {loading ? <Spinner /> : iconLeft}
      {children}
      {!loading && iconRight}
    </button>
  );
}

export default Button;
