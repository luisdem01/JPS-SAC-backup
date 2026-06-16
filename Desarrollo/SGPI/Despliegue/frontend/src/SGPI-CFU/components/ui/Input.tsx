import React from 'react';

/**
 * @file Input.tsx
 * @description Inputs del SGPI Design System.
 *
 * Características según el design.md:
 * - Border radius 4px (Soft) — distintos de botones pero en la misma familia
 * - Borde 1px outline-variant en reposo, primary-container al foco
 * - Label en label-caps (11px, 700, tracking wide)
 * - Helper text y mensajes de error en body-sm
 * - Estado error: borde error color + texto de error bajo el campo
 * - Sin shadow en estado normal; outline ring al foco
 * - Variantes: Input de texto, Textarea, Select
 */

// ─────────────────────────────────────────────────────────────────────────────
// Tipos base
// ─────────────────────────────────────────────────────────────────────────────

interface FieldWrapperProps {
  id:          string;
  label?:      string;
  helper?:     string;
  error?:      string;
  required?:   boolean;
  className?:  string;
  children:    React.ReactNode;
}

// ─────────────────────────────────────────────────────────────────────────────
// FieldWrapper — Label + campo + helper/error
// ─────────────────────────────────────────────────────────────────────────────

function FieldWrapper({
  id, label, helper, error, required, className = '', children,
}: FieldWrapperProps) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label
          htmlFor={id}
          className="
            font-sans text-label-caps text-on-surface-variant uppercase tracking-[0.05em]
          "
        >
          {label}
          {required && <span className="ml-0.5 text-error" aria-hidden="true">*</span>}
        </label>
      )}

      {children}

      {/* Error tiene prioridad sobre helper */}
      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="font-sans text-body-sm text-error flex items-center gap-1"
        >
          <span aria-hidden="true">!</span> {error}
        </p>
      ) : helper ? (
        <p id={`${id}-helper`} className="font-sans text-body-sm text-on-surface-variant">
          {helper}
        </p>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Clases de campo compartidas
// ─────────────────────────────────────────────────────────────────────────────

function fieldClasses(error?: string, disabled?: boolean): string {
  return [
    'w-full px-3 py-1.5',
    'font-sans text-body-md text-on-surface',
    'bg-surface-container-lowest',
    'border rounded',
    'outline-none transition-colors duration-100',
    error
      ? 'border-error focus:ring-2 focus:ring-error/30'
      : 'border-outline-variant focus:border-primary-container focus:ring-2 focus:ring-primary-container/20',
    disabled ? 'opacity-50 cursor-not-allowed bg-surface-container-low' : '',
    'placeholder:text-on-surface-variant/50',
  ].filter(Boolean).join(' ');
}

// ─────────────────────────────────────────────────────────────────────────────
// Input de texto
// ─────────────────────────────────────────────────────────────────────────────

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id:          string;
  label?:      string;
  helper?:     string;
  error?:      string;
  /** Ícono a la izquierda (dentro del campo) */
  iconLeft?:   React.ReactNode;
  wrapperClass?: string;
}

export function Input({
  id, label, helper, error,
  iconLeft, wrapperClass,
  className = '',
  disabled,
  required,
  ...props
}: InputProps) {
  return (
    <FieldWrapper
      id={id} label={label} helper={helper} error={error}
      required={required} className={wrapperClass}
    >
      <div className="relative">
        {iconLeft && (
          <span className="
            absolute left-3 top-1/2 -translate-y-1/2
            text-on-surface-variant pointer-events-none
          ">
            {iconLeft}
          </span>
        )}
        <input
          {...props}
          id={id}
          disabled={disabled}
          required={required}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : helper ? `${id}-helper` : undefined}
          className={`
            ${fieldClasses(error, disabled)}
            ${iconLeft ? 'pl-9' : ''}
            ${className}
          `}
        />
      </div>
    </FieldWrapper>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Textarea
// ─────────────────────────────────────────────────────────────────────────────

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  id:          string;
  label?:      string;
  helper?:     string;
  error?:      string;
  wrapperClass?: string;
}

export function Textarea({
  id, label, helper, error, wrapperClass,
  className = '', disabled, required, ...props
}: TextareaProps) {
  return (
    <FieldWrapper
      id={id} label={label} helper={helper} error={error}
      required={required} className={wrapperClass}
    >
      <textarea
        {...props}
        id={id}
        disabled={disabled}
        required={required}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : helper ? `${id}-helper` : undefined}
        className={`
          ${fieldClasses(error, disabled)}
          resize-y min-h-[80px]
          ${className}
        `}
      />
    </FieldWrapper>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Select
// ─────────────────────────────────────────────────────────────────────────────

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  id:          string;
  label?:      string;
  helper?:     string;
  error?:      string;
  /** Opción vacía inicial (placeholder) */
  placeholder?: string;
  wrapperClass?: string;
}

export function Select({
  id, label, helper, error, placeholder,
  wrapperClass, className = '', disabled, required,
  children, ...props
}: SelectProps) {
  return (
    <FieldWrapper
      id={id} label={label} helper={helper} error={error}
      required={required} className={wrapperClass}
    >
      <div className="relative">
        <select
          {...props}
          id={id}
          disabled={disabled}
          required={required}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : helper ? `${id}-helper` : undefined}
          className={`
            ${fieldClasses(error, disabled)}
            appearance-none pr-8 cursor-pointer
            ${className}
          `}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {children}
        </select>

        {/* Chevron decorativo */}
        <span className="
          absolute right-3 top-1/2 -translate-y-1/2
          pointer-events-none text-on-surface-variant
        ">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </span>
      </div>
    </FieldWrapper>
  );
}
