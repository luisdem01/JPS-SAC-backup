import React from 'react';
import { Button } from '../ui/Button';

/**
 * @file PageHeader.tsx
 * @description Encabezado común de páginas del SGPI.
 *
 * Posición: Justo debajo del TopBar (ya tiene 56px de padding-top).
 * No está fijo — se mueve con el scroll junto al contenido.
 *
 * Contiene:
 * - Título principal de la página (h1, IBM Plex Sans)
 * - Descripción opcional
 * - Badge de cantidad de registros (opcional)
 * - Slot de acciones a la derecha (botones CTA)
 * - Divisor inferior 1px
 *
 * Uso:
 * ```tsx
 * <PageHeader
 *   title="Proyectos de Investigación"
 *   description="Gestión y seguimiento de proyectos activos e históricos."
 *   count={152}
 *   actions={
 *     <Button variant="primary" iconLeft={<PlusIcon />}>
 *       Nuevo Proyecto
 *     </Button>
 *   }
 * />
 * ```
 */

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

export interface PageHeaderProps {
  /** Título principal de la sección (h1) */
  title:         string;
  /** Descripción breve de la sección */
  description?:  string;
  /** Número de registros (se muestra como pill junto al título) */
  count?:        number;
  /** Elementos a mostrar en el lado derecho (botones, filtros, etc.) */
  actions?:      React.ReactNode;
  /** Elimina el divisor inferior */
  noBorder?:     boolean;
  className?:    string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────────────────────────────────────

export function PageHeader({
  title,
  description,
  count,
  actions,
  noBorder  = false,
  className = '',
}: PageHeaderProps) {
  return (
    <div
      className={`
        flex items-start justify-between gap-4
        pb-4
        ${!noBorder ? 'border-b border-outline-variant mb-6' : 'mb-4'}
        ${className}
      `}
    >
      {/* ── Izquierda: Título + desc ──────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        {/* Título + counter */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="font-heading font-semibold text-h1 text-on-surface leading-[38px]">
            {title}
          </h1>

          {/* Pill de cantidad */}
          {count !== undefined && (
            <span className="
              inline-flex items-center
              px-2.5 py-0.5 rounded-full
              bg-surface-container-high
              font-sans text-[12px] font-semibold
              text-on-surface-variant
              border border-outline-variant
              translate-y-0.5
            ">
              {count.toLocaleString('es-PE')}
            </span>
          )}
        </div>

        {/* Descripción */}
        {description && (
          <p className="mt-1 font-sans text-body-md text-on-surface-variant max-w-2xl">
            {description}
          </p>
        )}
      </div>

      {/* ── Derecha: Acciones ────────────────────────────────────────────── */}
      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0 pt-1">
          {actions}
        </div>
      )}
    </div>
  );
}

export default PageHeader;
