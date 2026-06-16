import React from 'react';

/**
 * @file ProjectsTable.tsx
 * @description Tabla de proyectos del SGPI — Implementación pixel-perfect del diseño.
 *
 * Columnas exactas del sistema:
 *   CÓD. RAIS | TÍTULO DEL PROYECTO | RESP. PRINCIPAL | GRUPO INV. | ESTADO / ALERTAS | ACCIONES
 *
 * Características del diseño (del screenshot):
 * - CÓD. RAIS en JetBrains Mono, gris oscuro
 * - TÍTULO en negrita (font-medium) para proyectos activos/pendientes
 * - ESTADO / ALERTAS: badge principal (pill) + sub-alerta opcional apilada
 * - Badges semáforo: PENDIENTE VALIDAR (amber), EN EJECUCIÓN (verde), CONCLUIDO (azul)
 * - Sub-badges: alert rojo "Extracción OCR (III)", alerta naranja "⚠ Xhs Xm Vencida"
 * - ACCIONES: botón "Gestionar" con ícono (admin/secretary) ó ícono ojo (readonly/chief)
 * - Separadores 1px, sin zebra-stripes, hover sutil
 * - Paginación compacta inferior
 */

import type { Project, ProjectStatus } from '../../lib/types/models';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos propios de este componente
// ─────────────────────────────────────────────────────────────────────────────

/** Alerta adicional que puede aparecer bajo el badge de estado */
export interface ProjectAlert {
  /** Texto de la alerta (ej: "Extracción OCR (III)", "4hs 12m Vencida") */
  message: string;
  /** Tipo de alerta para el color */
  type: 'error' | 'warning';
}

/** Fila de proyecto enriquecida con datos para la tabla */
export interface ProjectRow {
  /** Código RAIS/VRIP, ej: "PRJ-26-045" */
  raisCode:      string;
  /** Título del proyecto */
  title:         string;
  /** Nombre del responsable principal */
  responsible:   string;
  /** Nombre del grupo de investigación */
  group:         string;
  /** Estado del proyecto */
  status:        ProjectStatus;
  /** Alertas adicionales bajo el badge de estado */
  alerts?:       ProjectAlert[];
  /** Si el usuario puede gestionar (admin/secretary) o solo ver (chief/readonly) */
  canManage?:    boolean;
  /** Callback al hacer clic en "Gestionar" */
  onManage?:     () => void;
  /** Callback al hacer clic en "Ver" */
  onView?:       () => void;
}

export interface ProjectsTableProps {
  /** Filas de datos */
  data:          ProjectRow[];
  /** Estado de carga */
  loading?:      boolean;
  /** Mensaje vacío personalizado */
  emptyMessage?: string;
  /** Paginación */
  pagination?: {
    page:     number;
    total:    number;
    pages:    number;
    hasNext:  boolean;
    hasPrev:  boolean;
    onNext:   () => void;
    onPrev:   () => void;
  };
  /** Columnas sortables */
  onSort?:        (column: string, dir: 'asc' | 'desc') => void;
  sortColumn?:    string;
  sortDirection?: 'asc' | 'desc';
  className?:     string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuración de estados → estilos de badge
// ─────────────────────────────────────────────────────────────────────────────

interface StatusConfig {
  label: string;
  bg:    string;
  text:  string;
  border:string;
  dot:   string;
}

const STATUS_CONFIG: Record<ProjectStatus, StatusConfig> = {
  pending: {
    label:  'PENDIENTE VALIDAR',
    bg:     '#fef9c3',
    text:   '#854d0e',
    border: '#fde047',
    dot:    '#ca8a04',
  },
  active: {
    label:  'EN EJECUCIÓN',
    bg:     '#dcfce7',
    text:   '#14532d',
    border: '#86efac',
    dot:    '#16a34a',
  },
  completed: {
    label:  'CONCLUIDO',
    bg:     '#dbeafe',
    text:   '#1e3a5f',
    border: '#93c5fd',
    dot:    '#2563eb',
  },
  cancelled: {
    label:  'CANCELADO',
    bg:     '#f1f5f9',
    text:   '#475569',
    border: '#cbd5e1',
    dot:    '#94a3b8',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Íconos SVG inline
// ─────────────────────────────────────────────────────────────────────────────

const EyeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

const ManageIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10 9 9 9 8 9"/>
  </svg>
);

const WarningIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

const SortAscIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="18 15 12 9 6 15"/>
  </svg>
);
const SortDescIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);
const SortNeutralIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="18 15 12 9 6 15" opacity="0.35"/>
    <polyline points="6 9 12 15 18 9" opacity="0.35"/>
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// Sub-componentes de celda
// ─────────────────────────────────────────────────────────────────────────────

/** Badge de estado principal — pill con color semáforo */
function StatusBadge({ status }: { status: ProjectStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-sans font-semibold"
      style={{
        fontSize:       '10px',
        lineHeight:     '16px',
        letterSpacing:  '0.04em',
        background:     cfg.bg,
        color:          cfg.text,
        border:         `1px solid ${cfg.border}`,
        whiteSpace:     'nowrap',
      }}
    >
      {/* Dot de estado */}
      <span
        className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: cfg.dot }}
        aria-hidden="true"
      />
      {cfg.label}
    </span>
  );
}

/** Badge de alerta secundaria (Extracción OCR, etc.) */
function AlertBadge({ alert }: { alert: ProjectAlert }) {
  const isError   = alert.type === 'error';
  const isWarning = alert.type === 'warning';

  if (isWarning) {
    // Alerta tipo vencimiento — NO es un pill, es texto con ícono
    return (
      <span
        className="inline-flex items-center gap-1 font-sans font-medium"
        style={{ fontSize: '11px', lineHeight: '16px', color: '#b45309' }}
      >
        <span style={{ color: '#d97706' }}><WarningIcon /></span>
        {alert.message}
      </span>
    );
  }

  // Error badge — pill rojo compacto
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full font-sans font-semibold"
      style={{
        fontSize:    '10px',
        lineHeight:  '16px',
        background:  '#fee2e2',
        color:       '#991b1b',
        border:      '1px solid #fca5a5',
        whiteSpace:  'nowrap',
      }}
    >
      {alert.message}
    </span>
  );
}

/** Celda de ESTADO / ALERTAS — apila badge principal + alertas */
function StatusCell({ status, alerts }: { status: ProjectStatus; alerts?: ProjectAlert[] }) {
  return (
    <div className="flex flex-col items-start gap-1">
      <StatusBadge status={status} />
      {alerts?.map((a, i) => (
        <AlertBadge key={i} alert={a} />
      ))}
    </div>
  );
}

/** Celda de ACCIONES — "Gestionar" vs ícono ojo */
function ActionsCell({
  canManage, onManage, onView,
}: Pick<ProjectRow, 'canManage' | 'onManage' | 'onView'>) {
  if (canManage && onManage) {
    return (
      <button
        onClick={onManage}
        type="button"
        className="
          inline-flex items-center gap-1.5
          px-3 py-1 rounded
          font-sans font-medium text-[12px] leading-5
          text-[#374151]
          bg-white border border-[#d1d5db]
          hover:bg-[#f9fafb] hover:border-[#9ca3af]
          active:bg-[#f3f4f6]
          transition-colors duration-100
          whitespace-nowrap
        "
        aria-label="Gestionar proyecto"
      >
        <span className="text-[#6b7280]"><ManageIcon /></span>
        Gestionar
      </button>
    );
  }

  return (
    <button
      onClick={onView}
      type="button"
      className="
        inline-flex items-center justify-center
        w-7 h-7 rounded
        text-[#9ca3af]
        hover:bg-[#f3f4f6] hover:text-[#6b7280]
        transition-colors duration-100
      "
      aria-label="Ver proyecto"
    >
      <EyeIcon />
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Cabecera sortable
// ─────────────────────────────────────────────────────────────────────────────

interface ThProps {
  label:      string;
  colKey?:    string;
  sortable?:  boolean;
  align?:     'left' | 'right' | 'center';
  width?:     string;
  sortColumn?: string;
  sortDir?:   'asc' | 'desc';
  onSort?:    (key: string, dir: 'asc' | 'desc') => void;
}

function Th({ label, colKey, sortable, align = 'left', width, sortColumn, sortDir, onSort }: ThProps) {
  const isSorted = sortable && colKey && sortColumn === colKey;

  const handleClick = () => {
    if (!sortable || !colKey || !onSort) return;
    const newDir = (isSorted && sortDir === 'asc') ? 'desc' : 'asc';
    onSort(colKey, newDir);
  };

  return (
    <th
      style={{ 
        fontSize:      '11px',
        lineHeight:    '16px',
        letterSpacing: '0.05em',
        width }}
      onClick={handleClick}
      className={`
        px-3 py-2
        font-sans font-bold text-[#64748b] uppercase
        border-b border-[#e2e8f0]
        whitespace-nowrap select-none
        ${sortable ? 'cursor-pointer hover:bg-[#f8fafc]' : ''}
        ${align === 'right'  ? 'text-right'  : ''}
        ${align === 'center' ? 'text-center' : ''}
      `}
      aria-sort={
        isSorted
          ? (sortDir === 'asc' ? 'ascending' : 'descending')
          : sortable ? 'none' : undefined
      }
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortable && (
          <span className="text-[#cbd5e1]">
            {isSorted
              ? (sortDir === 'asc' ? <SortAscIcon /> : <SortDescIcon />)
              : <SortNeutralIcon />}
          </span>
        )}
      </span>
    </th>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Spinner / empty
// ─────────────────────────────────────────────────────────────────────────────

function LoadingRows() {
  return (
    <>
      {[1, 2, 3].map((i) => (
        <tr key={i} className="border-b border-[#f1f5f9]">
          {[120, 280, 140, 160, 130, 80].map((w, j) => (
            <td key={j} className="px-3 py-3">
              <div
                className="h-3.5 rounded bg-[#f1f5f9] animate-pulse"
                style={{ width: `${w * 0.6 + Math.random() * w * 0.4}px`, maxWidth: '100%' }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function EmptyRow({ message, colSpan }: { message: string; colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-16 text-center">
        <div className="flex flex-col items-center gap-2">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
            stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <p className="font-sans text-[13px] text-[#94a3b8]">{message}</p>
        </div>
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────

export function ProjectsTable({
  data,
  loading        = false,
  emptyMessage   = 'No se encontraron proyectos.',
  pagination,
  onSort,
  sortColumn,
  sortDirection,
  className      = '',
}: ProjectsTableProps) {

  const thProps = { sortColumn, sortDir: sortDirection, onSort };

  return (
    <div className={`flex flex-col ${className}`}>

      {/* ── Tabla ─────────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded border border-[#e2e8f0] bg-white">
        <table className="w-full border-collapse" aria-busy={loading} aria-label="Tabla de proyectos">

          {/* ── Cabecera ─────────────────────────────────────────────────── */}
          <thead className="bg-[#f8fafc]">
            <tr>
              <Th label="CÓD. RAIS"        colKey="raisCode"    sortable  width="110px"  {...thProps} />
              <Th label="Título del Proyecto" colKey="title"    sortable                 {...thProps} />
              <Th label="Resp. Principal"   colKey="responsible" sortable  width="150px"  {...thProps} />
              <Th label="Grupo Inv."        colKey="group"       sortable  width="170px"  {...thProps} />
              <Th label="Estado / Alertas"  colKey="status"      sortable  width="175px"  {...thProps} />
              <Th label="Acciones"                               align="right" width="110px" />
            </tr>
          </thead>

          {/* ── Cuerpo ───────────────────────────────────────────────────── */}
          <tbody>
            {loading ? (
              <LoadingRows />
            ) : data.length === 0 ? (
              <EmptyRow message={emptyMessage} colSpan={6} />
            ) : (
              data.map((row, idx) => (
                <tr
                  key={row.raisCode + idx}
                  className="
                    border-b border-[#f1f5f9] last:border-b-0
                    hover:bg-[#f8fafc]
                    transition-colors duration-75
                    group
                  "
                >
                  {/* CÓD. RAIS — monospace técnico */}
                  <td className="px-3 py-2.5">
                    <span
                      className="font-mono text-[#374151]"
                      style={{ fontSize: '12px', lineHeight: '18px', letterSpacing: '0.02em' }}
                    >
                      {row.raisCode}
                    </span>
                  </td>

                  {/* Título del proyecto */}
                  <td className="px-3 py-2.5 min-w-[200px] max-w-[320px]">
                    <span
                      className={`
                        font-sans block truncate
                        ${row.status === 'pending' || row.status === 'active'
                          ? 'font-semibold text-[#111c2d]'
                          : 'font-normal text-[#374151]'
                        }
                      `}
                      style={{ fontSize: '13px', lineHeight: '20px' }}
                      title={row.title}
                    >
                      {row.title}
                    </span>
                  </td>

                  {/* Responsable principal */}
                  <td className="px-3 py-2.5">
                    <span
                      className="font-sans text-[#374151] whitespace-nowrap"
                      style={{ fontSize: '13px', lineHeight: '20px' }}
                    >
                      {row.responsible}
                    </span>
                  </td>

                  {/* Grupo de investigación */}
                  <td className="px-3 py-2.5">
                    <span
                      className="font-sans text-[#374151]"
                      style={{ fontSize: '13px', lineHeight: '20px' }}
                    >
                      {row.group}
                    </span>
                  </td>

                  {/* Estado / Alertas */}
                  <td className="px-3 py-2.5">
                    <StatusCell status={row.status} alerts={row.alerts} />
                  </td>

                  {/* Acciones */}
                  <td className="px-3 py-2 text-right">
                    <ActionsCell
                      canManage={row.canManage}
                      onManage={row.onManage}
                      onView={row.onView}
                    />
                  </td>
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
          bg-white
          border border-t-0 border-[#e2e8f0] rounded-b
        ">
          {/* Info */}
          <p className="font-sans text-[#64748b]" style={{ fontSize: '12px' }}>
            Página{' '}
            <strong className="text-[#1e293b] font-semibold">{pagination.page}</strong>
            {' '}de{' '}
            <strong className="text-[#1e293b] font-semibold">{pagination.pages}</strong>
            {' '}·{' '}
            <strong className="text-[#1e293b] font-semibold">{pagination.total}</strong>
            {' '}proyectos
          </p>

          {/* Botones prev/next */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={pagination.onPrev}
              disabled={!pagination.hasPrev}
              type="button"
              className="
                px-3 py-1 rounded border border-[#d1d5db]
                font-sans font-medium text-[12px] text-[#374151]
                bg-white hover:bg-[#f9fafb]
                disabled:opacity-40 disabled:cursor-not-allowed
                transition-colors duration-100
              "
            >
              ← Anterior
            </button>
            <button
              onClick={pagination.onNext}
              disabled={!pagination.hasNext}
              type="button"
              className="
                px-3 py-1 rounded border border-[#d1d5db]
                font-sans font-medium text-[12px] text-[#374151]
                bg-white hover:bg-[#f9fafb]
                disabled:opacity-40 disabled:cursor-not-allowed
                transition-colors duration-100
              "
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProjectsTable;
