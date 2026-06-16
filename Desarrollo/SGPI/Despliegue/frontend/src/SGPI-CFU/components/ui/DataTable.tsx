import React from 'react';
import { Button } from './Button';

/**
 * @file DataTable.tsx
 * @description Tabla de datos del SGPI — Alta densidad informacional.
 *
 * Según design.md:
 * - Cabecera con label-caps (11px, 700, tracking 0.05em) y fondo surface-container-low
 * - Separadores 1px border-b en outline-variant/40 (no zebra stripes)
 * - Hover en filas: surface-container-low
 * - Columna fija de acciones a la derecha
 * - Paginación compacta
 * - Estado vacío y cargando integrados
 * - Soporte para columnas sortables
 */

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

/** Define una columna de la tabla */
export interface Column<T = Record<string, unknown>> {
  /** Clave del objeto de datos o id único */
  key:          string;
  /** Cabecera visible */
  header:       string;
  /** Función de renderizado de celda. Si se omite usa row[key] */
  cell?:        (row: T, index: number) => React.ReactNode;
  /** Ancho CSS opcional (ej: '120px', '20%') */
  width?:       string;
  /** Alineación del contenido */
  align?:       'left' | 'center' | 'right';
  /** Marca esta columna como ordenable */
  sortable?:    boolean;
  /** Clase CSS extra para las celdas de esta columna */
  className?:   string;
}

/** Acciones para la columna de acciones */
export interface RowAction<T = Record<string, unknown>> {
  label:     string;
  onClick:   (row: T) => void;
  icon?:     React.ReactNode;
  disabled?: (row: T) => boolean;
  danger?:   boolean;
}

export interface DataTableProps<T extends Record<string, unknown>> {
  /** Definición de columnas */
  columns:        Column<T>[];
  /** Datos a mostrar */
  data:           T[];
  /** Clave única de cada fila (default: 'id') */
  rowKey?:        keyof T | ((row: T) => string);
  /** Acciones por fila (columna fija derecha) */
  actions?:       RowAction<T>[];
  /** Estado de carga */
  loading?:       boolean;
  /** Mensaje para estado vacío */
  emptyMessage?:  string;
  /** Paginación */
  pagination?: {
    page:     number;
    total:    number;
    pages:    number;
    limit:    number;
    hasNext:  boolean;
    hasPrev:  boolean;
    onNext:   () => void;
    onPrev:   () => void;
  };
  /** Callback al hacer clic en una columna sortable */
  onSort?:        (key: string, direction: 'asc' | 'desc') => void;
  /** Columna actualmente ordenada */
  sortColumn?:    string;
  /** Dirección de ordenamiento actual */
  sortDirection?: 'asc' | 'desc';
  className?:     string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Íconos
// ─────────────────────────────────────────────────────────────────────────────

const SortAscIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="18 15 12 9 6 15"/>
  </svg>
);
const SortDescIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);
const SortNeutralIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="18 15 12 9 6 15" opacity=".4"/>
    <polyline points="6 9 12 15 18 9" opacity=".4"/>
  </svg>
);

// Spinner compacto para loading state
function TableSpinner() {
  return (
    <tr>
      <td colSpan={999} className="py-12 text-center">
        <div className="flex flex-col items-center gap-3 text-on-surface-variant">
          <svg className="animate-spin w-6 h-6" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          <span className="font-sans text-body-sm">Cargando datos...</span>
        </div>
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  rowKey      = 'id',
  actions,
  loading     = false,
  emptyMessage = 'No se encontraron registros.',
  pagination,
  onSort,
  sortColumn,
  sortDirection,
  className   = '',
}: DataTableProps<T>) {

  /** Obtiene la clave única de una fila */
  const getRowKey = (row: T, i: number): string => {
    if (typeof rowKey === 'function') return rowKey(row);
    return String(row[rowKey] ?? i);
  };

  /** Maneja el clic en una cabecera sortable */
  const handleSort = (col: Column<T>) => {
    if (!col.sortable || !onSort) return;
    const newDir = (sortColumn === col.key && sortDirection === 'asc') ? 'desc' : 'asc';
    onSort(col.key, newDir);
  };

  const hasActions = actions && actions.length > 0;

  return (
    <div className={`flex flex-col gap-0 ${className}`}>
      {/* ── Tabla ──────────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded border border-outline-variant bg-surface-container-lowest">
        <table className="w-full border-collapse text-left" aria-busy={loading}>
          {/* Cabecera */}
          <thead>
            <tr className="bg-surface-container-low border-b border-outline-variant">
              {columns.map((col) => {
                const isSorted = sortColumn === col.key;
                const align    = col.align ?? 'left';

                return (
                  <th
                    key={col.key}
                    style={{ width: col.width }}
                    onClick={() => handleSort(col)}
                    className={`
                      px-3 py-2
                      font-sans text-label-caps text-on-surface-variant uppercase tracking-[0.05em]
                      whitespace-nowrap
                      border-r border-outline-variant/30 last:border-r-0
                      ${align === 'right'  ? 'text-right'  : ''}
                      ${align === 'center' ? 'text-center' : ''}
                      ${col.sortable ? 'cursor-pointer hover:bg-surface-container select-none' : ''}
                    `}
                    aria-sort={
                      isSorted
                        ? (sortDirection === 'asc' ? 'ascending' : 'descending')
                        : (col.sortable ? 'none' : undefined)
                    }
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.header}
                      {col.sortable && (
                        <span className="text-outline">
                          {isSorted
                            ? (sortDirection === 'asc' ? <SortAscIcon /> : <SortDescIcon />)
                            : <SortNeutralIcon />}
                        </span>
                      )}
                    </span>
                  </th>
                );
              })}

              {/* Cabecera de acciones */}
              {hasActions && (
                <th className="
                  px-3 py-2 sticky right-0
                  font-sans text-label-caps text-on-surface-variant uppercase tracking-[0.05em]
                  bg-surface-container-low
                  border-l border-outline-variant/30
                  text-right whitespace-nowrap
                ">
                  Acciones
                </th>
              )}
            </tr>
          </thead>

          {/* Cuerpo */}
          <tbody>
            {loading ? (
              <TableSpinner />
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (hasActions ? 1 : 0)}
                  className="py-12 text-center font-sans text-body-sm text-on-surface-variant"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, rowIndex) => (
                <tr
                  key={getRowKey(row, rowIndex)}
                  className="
                    border-b border-outline-variant/30 last:border-b-0
                    hover:bg-surface-container-low
                    transition-colors duration-75
                  "
                >
                  {/* Celdas de datos */}
                  {columns.map((col) => {
                    const align = col.align ?? 'left';
                    const value = col.cell
                      ? col.cell(row, rowIndex)
                      : String(row[col.key] ?? '—');

                    return (
                      <td
                        key={col.key}
                        className={`
                          px-3 py-2
                          font-sans text-body-md text-on-surface
                          border-r border-outline-variant/20 last:border-r-0
                          ${align === 'right'  ? 'text-right'  : ''}
                          ${align === 'center' ? 'text-center' : ''}
                          ${col.className ?? ''}
                        `}
                      >
                        {value}
                      </td>
                    );
                  })}

                  {/* Celda de acciones */}
                  {hasActions && (
                    <td className="
                      px-3 py-1.5 sticky right-0
                      bg-surface-container-lowest
                      border-l border-outline-variant/30
                      text-right whitespace-nowrap
                    ">
                      <div className="flex items-center justify-end gap-1">
                        {actions!.map((action, ai) => (
                          <button
                            key={ai}
                            onClick={() => action.onClick(row)}
                            disabled={action.disabled?.(row)}
                            title={action.label}
                            className={`
                              inline-flex items-center gap-1
                              px-2 py-1 rounded
                              font-sans text-[12px] font-medium
                              transition-colors duration-100
                              disabled:opacity-40 disabled:cursor-not-allowed
                              ${action.danger
                                ? 'text-error hover:bg-[#ffdad6]'
                                : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                              }
                            `}
                            aria-label={action.label}
                            type="button"
                          >
                            {action.icon}
                            <span className="hidden sm:inline">{action.label}</span>
                          </button>
                        ))}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Paginación ────────────────────────────────────────────────────── */}
      {pagination && pagination.pages > 1 && (
        <div className="
          flex items-center justify-between
          px-3 py-2
          bg-surface-container-lowest
          border border-t-0 border-outline-variant rounded-b
        ">
          {/* Info */}
          <p className="font-sans text-body-sm text-on-surface-variant">
            Página <strong className="text-on-surface">{pagination.page}</strong> de{' '}
            <strong className="text-on-surface">{pagination.pages}</strong>
            {' '}·{' '}
            <strong className="text-on-surface">{pagination.total}</strong> registros
          </p>

          {/* Controles */}
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={pagination.onPrev}
              disabled={!pagination.hasPrev}
              aria-label="Página anterior"
            >
              ← Anterior
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={pagination.onNext}
              disabled={!pagination.hasNext}
              aria-label="Página siguiente"
            >
              Siguiente →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DataTable;
