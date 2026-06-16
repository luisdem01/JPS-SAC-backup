'use client';

/**
 * @file page.tsx
 * @route /configuracion/Modulo_de_auditoria
 * @description Pantalla "Auditoría de Logs" enriquecida del módulo de Configuración.
 *
 * - Filtros avanzados y dashboard de métricas en tiempo real.
 * - Resolución de UUIDs a correos institucionales de usuarios.
 * - Tab de Auditoría de Base de Datos con visualizador estructurado de diferencias (diffs).
 * - Tab de Diagnóstico del Servidor con visor de logs en tiempo real y descarga.
 * - Paginación ("Cargar más").
 * - Tema claro alineado con la paleta del sistema.
 *
 * Permisos: Solo rol admin.
 */

import React, { useState, useEffect, useRef } from 'react';
import { MainLayout } from '@/SGPI-CFU/components/layout';
import { PageHeader }  from '@/SGPI-CFU/components/shared';
import { capiacService, LogEntry, UsuarioResponse } from '../_data/capiacService';
import { removeAccents } from '@/SGPI-CFU/lib/utils/formatters';

type EstadoLog = 'EXITO' | 'FALLO' | 'ADVERTENCIA';

const TIPO_EVENTO_OPTIONS = [
  { label: 'Todos los eventos',               value: '' },
  { label: 'Creación de Registro (INSERT)',   value: 'INSERT' },
  { label: 'Modificación de Registro (UPDATE)',value: 'UPDATE' },
  { label: 'Eliminación de Registro (DELETE)',value: 'DELETE' },
  { label: 'Inicio de sesión',                value: 'LOGIN' },
  { label: 'Cierre de sesión',                value: 'LOGOUT' },
  { label: 'Importación Excel (General)',     value: 'IMPORT_EXCEL' },
  { label: 'Importación Excel (CI)',          value: 'IMPORT_EXCEL_CI' },
  { label: 'Sincronización RENACYT',          value: 'SYNC_RENACYT' },
  { label: 'Sincronización Cybertesis',       value: 'SYNC_CYBERTESIS' },
  { label: 'Sincronización VRIP',             value: 'SYNC_VRIP' },
  { label: 'Exportación de Reporte',          value: 'EXPORT_REPORT' },
  { label: 'Snapshot Generado',               value: 'SNAPSHOT_GENERADO' },
  { label: 'Cambio de Configuración',         value: 'CONFIG_CHANGE' },
  { label: 'Usuario Creado',                  value: 'USER_CREATED' },
  { label: 'Usuario Desactivado',             value: 'USER_DEACTIVATED' },
];

const ENTITY_OPTIONS = [
  { label: 'Proyectos', value: 'proyecto' },
  { label: 'Investigadores', value: 'investigador' },
  { label: 'Usuarios', value: 'usuario' },
  { label: 'Tesis', value: 'tesis' },
  { label: 'Convocatorias', value: 'convocatoria' },
  { label: 'Configuraciones', value: 'configuracion' },
  { label: 'Entregables', value: 'entregable' },
  { label: 'Snapshots', value: 'snapshot_poi' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatFechaHora(iso: string): string {
  const d   = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function syntaxHighlight(json: string): string {
  return json
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      (match) => {
        if (/^"/.test(match)) {
          if (/:$/.test(match)) return `<span style="color:#0284c7">${match}</span>`; // clave (azul)
          return `<span style="color:#059669">${match}</span>`;  // string value (verde)
        }
        if (/true|false/.test(match)) return `<span style="color:#ea580c">${match}</span>`;
        if (/null/.test(match))        return `<span style="color:#64748b">${match}</span>`;
        return `<span style="color:#d97706">${match}</span>`; // número (ocre)
      },
    );
}

interface DiffItem {
  key: string;
  oldVal: any;
  newVal: any;
  status: 'added' | 'removed' | 'modified' | 'unchanged';
}

function computeDiff(oldObj: any, newObj: any): DiffItem[] {
  const diffs: DiffItem[] = [];
  if (!oldObj && !newObj) return [];
  
  const o = typeof oldObj === 'object' && oldObj !== null ? oldObj : {};
  const n = typeof newObj === 'object' && newObj !== null ? newObj : {};
  
  const allKeys = Array.from(new Set([...Object.keys(o), ...Object.keys(n)]));
  
  for (const key of allKeys) {
    const hasOld = key in o;
    const hasNew = key in n;
    const oldVal = o[key];
    const newVal = n[key];
    
    const stringifyValue = (val: any) => {
      if (val === null || val === undefined) return '';
      if (typeof val === 'object') return JSON.stringify(val);
      return String(val);
    };

    const oldStr = stringifyValue(oldVal);
    const newStr = stringifyValue(newVal);
    
    if (hasOld && !hasNew) {
      diffs.push({ key, oldVal, newVal: null, status: 'removed' });
    } else if (!hasOld && hasNew) {
      diffs.push({ key, oldVal: null, newVal, status: 'added' });
    } else if (oldStr !== newStr) {
      diffs.push({ key, oldVal, newVal, status: 'modified' });
    } else {
      diffs.push({ key, oldVal, newVal, status: 'unchanged' });
    }
  }
  
  return diffs.sort((a, b) => a.key.localeCompare(b.key));
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponentes visuales
// ─────────────────────────────────────────────────────────────────────────────

function EstadoBadge({ estado }: { estado: EstadoLog }) {
  const styles: Record<EstadoLog, string> = {
    EXITO:       'text-emerald-700 border-emerald-200 bg-emerald-50',
    FALLO:       'text-rose-700 border-rose-200 bg-rose-50',
    ADVERTENCIA: 'text-amber-700 border-amber-200 bg-amber-50',
  };
  const labels: Record<EstadoLog, string> = {
    EXITO:       'ÉXITO',
    FALLO:       'FALLO',
    ADVERTENCIA: 'ADVERTENCIA',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border font-sans font-semibold text-[11px] tracking-wide ${styles[estado]}`}>
      {labels[estado]}
    </span>
  );
}

function EventBadge({ event }: { event: string }) {
  let badgeColor = 'text-slate-700 border-slate-300 bg-slate-100';
  
  if (event === 'INSERT') {
    badgeColor = 'text-emerald-700 border-emerald-200 bg-emerald-50';
  } else if (event === 'UPDATE') {
    badgeColor = 'text-sky-700 border-sky-200 bg-sky-50';
  } else if (event === 'DELETE') {
    badgeColor = 'text-rose-700 border-rose-200 bg-rose-50';
  } else if (event === 'LOGIN' || event === 'LOGOUT') {
    badgeColor = 'text-violet-700 border-violet-200 bg-violet-50';
  } else if (event.startsWith('SYNC_') || event.startsWith('IMPORT_')) {
    badgeColor = 'text-orange-700 border-orange-200 bg-orange-50';
  } else if (event === 'CONFIG_CHANGE') {
    badgeColor = 'text-teal-700 border-teal-200 bg-teal-50';
  }

  return (
    <span className={`px-2 py-0.5 rounded border text-[11px] font-mono font-semibold tracking-wide uppercase ${badgeColor}`}>
      {event}
    </span>
  );
}

function DateInput({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <input
      id={id}
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="
        h-8 px-2 w-[130px]
        font-sans text-[13px] text-[#0f172a]
        bg-white border border-[#cbd5e1] rounded
        outline-none
        focus:ring-2 focus:ring-[#a8c8fa] focus:border-[#a8c8fa]
        transition-all
      "
    />
  );
}

function MultiSelectDropdown({
  options,
  selected,
  onChange,
  placeholder = "Seleccionar..."
}: {
  options: { label: string; value: string }[];
  selected: string[];
  onChange: (val: string[]) => void;
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggle = (val: string) => {
    if (selected.includes(val)) {
      onChange(selected.filter(item => item !== val));
    } else {
      onChange([...selected, val]);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="
          flex items-center justify-between
          h-8 px-3 w-[220px]
          font-sans text-[13px] text-[#0f172a]
          bg-white border border-[#cbd5e1] rounded
          outline-none cursor-pointer text-left
          focus:ring-2 focus:ring-[#a8c8fa] focus:border-[#a8c8fa]
          transition-all
        "
      >
        <span className="truncate">
          {selected.length === 0
            ? placeholder
            : selected.length === 1
            ? options.find(o => o.value === selected[0])?.label
            : `${selected.length} seleccionados`}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-[#cbd5e1] rounded shadow-lg max-h-[200px] overflow-y-auto py-1">
          {options.map(opt => {
            const isChecked = selected.includes(opt.value);
            return (
              <label
                key={opt.value}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#f1f5f9] cursor-pointer font-sans text-[13px] text-[#334155]"
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => handleToggle(opt.value)}
                  className="rounded border-[#cbd5e1] text-[#001631] focus:ring-[#a8c8fa] h-4 w-4"
                />
                <span className="truncate">{opt.label}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DiffTable({ oldObj, newObj, eventType }: { oldObj: any; newObj: any; eventType: string }) {
  const diffItems = computeDiff(oldObj, newObj);
  
  if (diffItems.length === 0) return null;
  
  const formatVal = (val: any) => {
    if (val === null || val === undefined) return <span className="text-[#94a3b8] italic">nulo</span>;
    if (typeof val === 'object') return <pre className="text-[11px] font-mono leading-tight whitespace-pre-wrap">{JSON.stringify(val, null, 2)}</pre>;
    if (typeof val === 'boolean') return val ? 'true' : 'false';
    return String(val);
  };
  
  return (
    <div className="mt-4 border border-slate-200 rounded overflow-hidden">
      <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
        <span className="font-sans font-bold text-[11px] text-slate-500 tracking-wider uppercase">
          Cambios en el Registro ({eventType})
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left font-sans text-[12px] border-collapse min-w-[500px]">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-200">
              <th className="px-4 py-2 text-slate-500 font-semibold w-[25%] border-r border-slate-200">Campo</th>
              <th className="px-4 py-2 text-slate-500 font-semibold w-[37.5%] border-r border-slate-200">Valor Anterior</th>
              <th className="px-4 py-2 text-slate-500 font-semibold w-[37.5%]">Valor Nuevo</th>
            </tr>
          </thead>
          <tbody>
            {diffItems.map(item => {
              const isRemoved = item.status === 'removed';
              const isAdded = item.status === 'added';
              const isModified = item.status === 'modified';
              const isUnchanged = item.status === 'unchanged';
              
              if (eventType === 'UPDATE' && isUnchanged) return null;
              
              let rowBg = 'bg-transparent';
              let oldBg = 'transparent';
              let newBg = 'transparent';
              
              if (isRemoved) {
                rowBg = 'bg-rose-500/5';
                oldBg = 'bg-rose-50 text-rose-700 font-medium px-2 py-0.5 rounded border border-rose-100';
              } else if (isAdded) {
                rowBg = 'bg-emerald-500/5';
                newBg = 'bg-emerald-50 text-emerald-700 font-medium px-2 py-0.5 rounded border border-emerald-100';
              } else if (isModified) {
                rowBg = 'bg-amber-500/5';
                oldBg = 'bg-rose-50 text-rose-700 px-2 py-0.5 rounded border border-rose-100';
                newBg = 'bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-100';
              }
              
              return (
                <tr key={item.key} className={`${rowBg} border-b border-slate-200 last:border-b-0`}>
                  <td className="px-4 py-2 font-mono font-medium text-slate-800 border-r border-slate-200 truncate">
                    {item.key}
                  </td>
                  <td className="px-4 py-2 border-r border-slate-200">
                    <div className={oldBg}>{isAdded ? '-' : formatVal(item.oldVal)}</div>
                  </td>
                  <td className="px-4 py-2">
                    <div className={newBg}>{isRemoved ? '-' : formatVal(item.newVal)}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface LogDetailModalProps {
  log:       LogEntry;
  userEmail: string;
  onClose:   () => void;
}

function LogDetailModal({ log, userEmail, onClose }: LogDetailModalProps) {
  const [showRaw, setShowRaw] = useState(false);
  const jsonStr  = JSON.stringify(log.detail, null, 2);
  const htmlJson = syntaxHighlight(jsonStr);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-[2px] p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Detalle del log ${log.id}`}
    >
      <div
        className="
          relative w-full max-w-[700px] max-h-[90vh]
          bg-white border border-slate-200
          rounded-lg shadow-2xl
          flex flex-col
          overflow-hidden
        "
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="#001631" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
            </svg>
            <span className="font-sans font-bold text-[14px] text-slate-800 tracking-wide uppercase">
              DETALLE DE LOG: {log.evento}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar detalle"
            className="
              flex items-center justify-center w-7 h-7 rounded-full
              text-slate-400 hover:text-slate-600 hover:bg-slate-100
              transition-colors duration-100
            "
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Cuerpo */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          
          {/* Grid de Metadatos */}
          <div className="grid grid-cols-2 gap-4 bg-slate-50 border border-slate-200 rounded p-4">
            <div>
              <span className="block font-sans text-[10px] text-slate-500 uppercase tracking-wider font-bold">Fecha / Hora</span>
              <span className="font-sans text-[13px] text-slate-800 font-medium">{formatFechaHora(log.fechaHora)}</span>
            </div>
            <div>
              <span className="block font-sans text-[10px] text-slate-500 uppercase tracking-wider font-bold">Usuario</span>
              <span className="font-sans text-[13px] text-slate-800 truncate block font-medium" title={userEmail}>{userEmail}</span>
            </div>
            <div>
              <span className="block font-sans text-[10px] text-slate-500 uppercase tracking-wider font-bold">IP Origen</span>
              <span className="font-sans text-[13px] text-slate-800 font-medium">{log.ipOrigen || 'No disponible'}</span>
            </div>
            <div>
              <span className="block font-sans text-[10px] text-slate-500 uppercase tracking-wider font-bold">Estado</span>
              <div className="mt-0.5"><EstadoBadge estado={log.estado} /></div>
            </div>
            {log.entidadAfectada && (
              <div>
                <span className="block font-sans text-[10px] text-slate-500 uppercase tracking-wider font-bold">Entidad Afectada</span>
                <span className="font-sans text-[13px] text-[#0284c7] font-semibold uppercase">{log.entidadAfectada}</span>
              </div>
            )}
            {log.pkEntidad && (
              <div>
                <span className="block font-sans text-[10px] text-slate-500 uppercase tracking-wider font-bold font-mono">ID Registro (PK)</span>
                <span className="font-mono text-[13px] text-slate-600">{log.pkEntidad}</span>
              </div>
            )}
          </div>

          {/* Diffs */}
          {(log.valorAnterior || log.valorNuevo) && (
            <DiffTable oldObj={log.valorAnterior} newObj={log.valorNuevo} eventType={log.evento} />
          )}

          {/* Error Detail */}
          {log.detalleError && (
            <div className="border border-rose-200 rounded overflow-hidden">
              <div className="bg-rose-50 px-4 py-2 border-b border-rose-200 flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span className="font-sans font-bold text-[11px] text-rose-700 tracking-wider uppercase">
                  Detalle del Error
                </span>
              </div>
              <div className="bg-rose-50/30 px-4 py-3">
                <pre className="font-mono text-[11.5px] text-rose-800 whitespace-pre-wrap max-h-[160px] overflow-y-auto leading-relaxed">
                  {log.detalleError}
                </pre>
              </div>
            </div>
          )}

          {/* Collapsible JSON */}
          <div className="border border-slate-200 rounded">
            <button
              type="button"
              onClick={() => setShowRaw(!showRaw)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 text-left font-sans font-bold text-[11.5px] text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors uppercase tracking-wider"
            >
              <span>Ver Payload JSON Completo</span>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className={`transform transition-transform duration-100 ${showRaw ? 'rotate-180' : ''}`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {showRaw && (
              <div className="p-4 bg-slate-50 border-t border-slate-200 overflow-x-auto max-h-[250px] overflow-y-auto">
                <pre
                  className="font-mono text-[11.5px] leading-relaxed text-slate-800 whitespace-pre"
                  dangerouslySetInnerHTML={{ __html: htmlJson }}
                />
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="flex justify-end px-5 py-4 border-t border-slate-200 bg-slate-50">
          <button
            id="btn-cerrar-detalle"
            onClick={onClose}
            className="
              px-5 py-1.5
              bg-[#001631] text-white
              font-sans font-semibold text-[13px] rounded
              hover:bg-[#002b54] active:bg-[#001229]
              transition-colors duration-100
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a8c8fa]
            "
          >
            Cerrar Detalle
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Íconos
// ─────────────────────────────────────────────────────────────────────────────

const FilterIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────────────────────────────────────

export default function AuditoriaDeLogsPage() {
  const [activeTab, setActiveTab] = useState<'database' | 'system'>('database');

  // ── Resolución de Usuarios ───────────────────────────────────────────────
  const [userMap, setUserMap] = useState<Record<string, string>>({});
  
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const users = await capiacService.getUsuarios();
        const mapping: Record<string, string> = {};
        users.forEach(u => {
          mapping[u.id_usuario] = u.correo_institucional;
        });
        setUserMap(mapping);
      } catch (err) {
        console.error("No se pudo cargar la lista de usuarios para resolución de nombres:", err);
      }
    };
    fetchUsers();
  }, []);

  // ── Filtros del Backend ──────────────────────────────────────────────────
  const [fechaDesde,     setFechaDesde]     = useState('');
  const [fechaHasta,     setFechaHasta]     = useState('');
  const [tipoEvento,     setTipoEvento]     = useState('');
  const [appliedFilters, setAppliedFilters] = useState({ desde: '', hasta: '', evento: '' });

  // ── Filtros Locales (React Client-Side) ───────────────────────────
  const [searchTerm,       setSearchTerm]       = useState('');
  const [selectedStatus,   setSelectedStatus]   = useState('');
  const [selectedEntities, setSelectedEntities] = useState<string[]>([]);

  // ── Paginación y Carga de Logs ───────────────────────────────────────────
  const [allFetchedLogs, setAllFetchedLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [skip, setSkip] = useState(0);
  const LIMIT = 100;
  const [hasMore, setHasMore] = useState(true);

  // ── Modal de detalle ──────────────────────────────────────────────────────
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

  const handleFiltrar = () => {
    setAppliedFilters({ desde: fechaDesde, hasta: fechaHasta, evento: tipoEvento });
  };

  // Carga inicial al aplicar filtros del backend
  useEffect(() => {
    const fetchLogs = async () => {
      setIsLoading(true);
      try {
        const data = await capiacService.getLogsAuditoria({
          fecha_inicio: appliedFilters.desde || undefined,
          fecha_fin: appliedFilters.hasta || undefined,
          tipo_evento: appliedFilters.evento || undefined,
          skip: 0,
          limit: LIMIT
        });
        setAllFetchedLogs(data);
        setSkip(0);
        setHasMore(data.length === LIMIT);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchLogs();
  }, [appliedFilters]);

  // Carga de páginas adicionales
  const handleCargarMas = async () => {
    setIsLoadingMore(true);
    const nextSkip = skip + LIMIT;
    try {
      const data = await capiacService.getLogsAuditoria({
        fecha_inicio: appliedFilters.desde || undefined,
        fecha_fin: appliedFilters.hasta || undefined,
        tipo_evento: appliedFilters.evento || undefined,
        skip: nextSkip,
        limit: LIMIT
      });
      setAllFetchedLogs(prev => [...prev, ...data]);
      setSkip(nextSkip);
      setHasMore(data.length === LIMIT);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // ── Filtros combinados locales ────────────────────────────────────────────
  const displayLogs = allFetchedLogs.filter(log => {
    if (selectedStatus && log.estado !== selectedStatus) return false;
    
    if (selectedEntities.length > 0) {
      const ent = removeAccents(log.entidadAfectada || '');
      if (!selectedEntities.some(e => ent.includes(removeAccents(e)))) {
        return false;
      }
    }
    
    if (searchTerm) {
      const term = removeAccents(searchTerm);
      const resolvedEmail = removeAccents(log.usuario === 'SISTEMA' ? 'sistema' : (userMap[log.usuario] || log.usuario || ''));
      const logEvent = removeAccents(log.evento || '');
      const logEntity = removeAccents(log.entidadAfectada || '');
      const logIp = removeAccents(log.ipOrigen || '');
      const logPk = removeAccents(log.pkEntidad || '');
      
      return resolvedEmail.includes(term) ||
             logEvent.includes(term) ||
             logEntity.includes(term) ||
             logIp.includes(term) ||
             logPk.includes(term);
    }
    
    return true;
  });

  // ── Métricas del Dashboard (Dinámicas) ───────────────────────────────────
  const totalLogsCount = displayLogs.length;
  const successCount = displayLogs.filter(l => l.estado === 'EXITO').length;
  const successRate = totalLogsCount > 0 ? Math.round((successCount / totalLogsCount) * 100) : 100;
  const failureCount = displayLogs.filter(l => l.estado === 'FALLO').length;
  const uniqueUsersCount = new Set(displayLogs.map(l => l.usuario === 'SISTEMA' ? 'SISTEMA' : userMap[l.usuario] || l.usuario)).size;

  // ── Logs de Diagnóstico del Servidor (Tab 2) ─────────────────────────────
  const [systemLogs, setSystemLogs] = useState<string[]>([]);
  const [sysLevel, setSysLevel] = useState('');
  const [sysLines, setSysLines] = useState(100);
  const [isSysLoading, setIsSysLoading] = useState(false);

  useEffect(() => {
    if (activeTab !== 'system') return;
    const fetchSysLogs = async () => {
      setIsSysLoading(true);
      try {
        const linesData = await capiacService.getSystemLogs(sysLines, sysLevel || undefined);
        setSystemLogs(linesData);
      } catch (err) {
        console.error(err);
      } finally {
        setIsSysLoading(false);
      }
    };
    fetchSysLogs();
  }, [activeTab, sysLevel, sysLines]);

  const handleDescargarSysLogs = async () => {
    try {
      const blob = await capiacService.downloadSystemLogs();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `sgpi_diagnostico_${new Date().toISOString().split('T')[0]}.log`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Error al descargar el archivo de diagnóstico.');
    }
  };

  const resolveUserDisplay = (id: string): string => {
    if (id === 'SISTEMA') return 'SISTEMA';
    return userMap[id] || id;
  };

  return (
    <MainLayout
      title="Sistema de Gestión de Proyectos de Investigación"
      subtitle=""
    >
      <PageHeader
        title="Auditoría de Logs"
        description="Panel administrativo para control de auditoría inmutable de transacciones y diagnóstico de salud del servidor."
      />

      {/* ── Tabs del Módulo ──────────────────────────────────────────────── */}
      <div className="mb-5 flex border-b border-slate-200 gap-2">
        <button
          onClick={() => setActiveTab('database')}
          className={`px-4 py-2 font-sans font-semibold text-[13.5px] transition-all duration-300 ease-out border-b-2 -mb-[2px] ${
            activeTab === 'database'
              ? 'text-[#001631] border-[#001631]'
              : 'text-slate-400 border-transparent hover:text-slate-600'
          }`}
        >
          Auditoría de Base de Datos
        </button>
        <button
          onClick={() => setActiveTab('system')}
          className={`px-4 py-2 font-sans font-semibold text-[13.5px] transition-all duration-300 ease-out border-b-2 -mb-[2px] ${
            activeTab === 'system'
              ? 'text-[#001631] border-[#001631]'
              : 'text-slate-400 border-transparent hover:text-slate-600'
          }`}
        >
          Diagnóstico de Servidor (System Logs)
        </button>
      </div>

      <div key={activeTab} className="animate-sweep-in">
        {activeTab === 'database' ? (
        <>
          {/* ── Métricas Dashboard (Tema Claro) ───────────────────────────── */}
          <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
            {/* Total Logs */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col justify-between shadow-sm">
              <span className="font-sans font-bold text-[10px] text-slate-400 uppercase tracking-widest">Eventos Visualizados</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="font-sans text-2xl font-bold text-slate-800">{totalLogsCount}</span>
                <span className="font-sans text-[11px] text-slate-500">operaciones</span>
              </div>
            </div>

            {/* Success Rate */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col justify-between shadow-sm">
              <span className="font-sans font-bold text-[10px] text-slate-400 uppercase tracking-widest">Tasa de Éxito</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="font-sans text-2xl font-bold text-emerald-600">{successRate}%</span>
                <span className="font-sans text-[11px] text-slate-500">ejecutados</span>
              </div>
            </div>

            {/* Error Count */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col justify-between shadow-sm">
              <span className="font-sans font-bold text-[10px] text-slate-400 uppercase tracking-widest">Errores Registrados</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className={`font-sans text-2xl font-bold ${failureCount > 0 ? 'text-rose-600' : 'text-slate-400'}`}>{failureCount}</span>
                <span className="font-sans text-[11px] text-slate-500">fallidos</span>
              </div>
            </div>

            {/* Active Operators */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col justify-between shadow-sm">
              <span className="font-sans font-bold text-[10px] text-slate-400 uppercase tracking-widest">Operadores Activos</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="font-sans text-2xl font-bold text-violet-600">{uniqueUsersCount}</span>
                <span className="font-sans text-[11px] text-slate-500">usuarios</span>
              </div>
            </div>
          </div>

          {/* ── Panel de Filtros de Base de Datos ─────────────────────────── */}
          <div className="mb-4 bg-white border border-slate-200 rounded p-4 space-y-4 shadow-sm">
            
            {/* Fila 1: Filtros del Servidor (Fecha/TipoEvento) */}
            <div className="flex items-end justify-between gap-4 flex-wrap pb-3 border-b border-slate-100">
              <div className="flex items-end gap-5 flex-wrap">
                {/* Rango de Fechas */}
                <div className="flex flex-col gap-1.5">
                  <span className="font-sans font-bold text-[10px] text-slate-400 uppercase tracking-widest">Rango de Fechas (BD)</span>
                  <div className="flex items-center gap-2">
                    <DateInput id="filter-fecha-desde" value={fechaDesde} onChange={setFechaDesde} />
                    <span className="font-sans text-[13px] text-slate-300">–</span>
                    <DateInput id="filter-fecha-hasta" value={fechaHasta} onChange={setFechaHasta} />
                  </div>
                </div>

                {/* Tipo de Evento */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="filter-tipo-evento" className="font-sans font-bold text-[10px] text-slate-400 uppercase tracking-widest">Tipo de Evento</label>
                  <select
                    id="filter-tipo-evento"
                    value={tipoEvento}
                    onChange={(e) => setTipoEvento(e.target.value)}
                    className="
                      h-8 px-3 pr-8 w-[220px]
                      font-sans text-[13px] text-slate-800
                      bg-white border border-slate-200 rounded
                      outline-none appearance-none cursor-pointer
                      focus:ring-2 focus:ring-[#a8c8fa] focus:border-[#a8c8fa]
                      transition-all
                      bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2364748b%22 stroke-width=%222%22><polyline points=%226 9 12 15 18 9%22/></svg>')]
                      bg-no-repeat bg-[right_8px_center]
                    "
                  >
                    {TIPO_EVENTO_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Botón Aplicar Filtros Servidor */}
              <button
                id="btn-filtrar-logs"
                onClick={handleFiltrar}
                className="
                  inline-flex items-center gap-2 flex-shrink-0
                  h-8 px-4 bg-[#001631] text-white
                  font-sans font-semibold text-[13px] rounded
                  hover:bg-[#002b54] active:bg-[#001229]
                  transition-colors duration-100
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#a8c8fa]
                "
              >
                <FilterIcon />
                Aplicar Rango/Evento
              </button>
            </div>

            {/* Fila 2: Filtros Locales (Buscador, Estado, Entidad) */}
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <div className="flex items-end gap-5 flex-wrap">
                
                {/* Buscador de Texto */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="filter-search" className="font-sans font-bold text-[10px] text-slate-400 uppercase tracking-widest">Búsqueda rápida</label>
                  <div className="relative">
                    <input
                      id="filter-search"
                      type="text"
                      placeholder="Correo, IP, PK..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="
                        h-8 pl-8 pr-3 w-[200px]
                        font-sans text-[13px] text-slate-800
                        bg-white border border-slate-200 rounded
                        outline-none
                        focus:ring-2 focus:ring-[#a8c8fa] focus:border-[#a8c8fa]
                        transition-all
                      "
                    />
                    <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                      <SearchIcon />
                    </div>
                  </div>
                </div>

                {/* Filtro Estado */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="filter-estado" className="font-sans font-bold text-[10px] text-slate-400 uppercase tracking-widest">Estado</label>
                  <select
                    id="filter-estado"
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="
                      h-8 px-3 pr-8 w-[140px]
                      font-sans text-[13px] text-slate-800
                      bg-white border border-slate-200 rounded
                      outline-none appearance-none cursor-pointer
                      focus:ring-2 focus:ring-[#a8c8fa] focus:border-[#a8c8fa]
                      transition-all
                      bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2364748b%22 stroke-width=%222%22><polyline points=%226 9 12 15 18 9%22/></svg>')]
                      bg-no-repeat bg-[right_8px_center]
                    "
                  >
                    <option value="">Todos</option>
                    <option value="EXITO">ÉXITO</option>
                    <option value="FALLO">FALLO</option>
                    <option value="ADVERTENCIA">ADVERTENCIA</option>
                  </select>
                </div>

                {/* Filtro Entidad (Multi-Select) */}
                <div className="flex flex-col gap-1.5">
                  <span className="font-sans font-bold text-[10px] text-slate-400 uppercase tracking-widest">Filtrar por Entidad</span>
                  <MultiSelectDropdown
                    options={ENTITY_OPTIONS}
                    selected={selectedEntities}
                    onChange={setSelectedEntities}
                    placeholder="Todas las entidades"
                  />
                </div>
              </div>

              {/* Botón de Limpieza Rápida */}
              {(searchTerm || selectedStatus || selectedEntities.length > 0) && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedStatus('');
                    setSelectedEntities([]);
                  }}
                  className="h-8 px-3 font-sans font-semibold text-[12px] text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-all"
                >
                  Limpiar filtros rápidos
                </button>
              )}
            </div>
          </div>

          {/* ── Tabla de logs (Tema Claro) ───────────────────────────────── */}
          <div className="bg-white rounded overflow-hidden border border-slate-200 shadow-sm">
            {/* Cabecera */}
            <div className="grid grid-cols-[1.5fr_1.5fr_1.8fr_2fr_1fr] px-5 py-3 border-b border-slate-200 bg-slate-50/50">
              {['FECHA/HORA', 'EVENTO', 'ENTIDAD', 'USUARIO / ACTOR', 'ESTADO'].map((col) => (
                <span key={col} className="font-sans font-bold text-[10px] text-slate-500 uppercase tracking-widest">
                  {col}
                </span>
              ))}
            </div>

            {/* Filas */}
            {isLoading ? (
              <div className="px-5 py-12 text-center font-sans text-[13.5px] text-slate-400 flex flex-col items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-[#001631]" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Cargando registros de auditoría...
              </div>
            ) : displayLogs.length === 0 ? (
              <div className="px-5 py-12 text-center font-sans text-[13.5px] text-slate-400">
                No se encontraron registros con los filtros aplicados.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {displayLogs.map((log) => {
                  const resolvedEmail = resolveUserDisplay(log.usuario);
                  return (
                    <button
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      title="Ver detalle de auditoría"
                      className="
                        w-full text-left
                        grid grid-cols-[1.5fr_1.5fr_1.8fr_2fr_1fr] items-center
                        px-5 py-3.5 bg-white hover:bg-slate-50/80
                        transition-all duration-100 cursor-pointer
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#cbd5e1]
                      "
                    >
                      <span className="font-sans text-[12.5px] text-sky-600 font-semibold truncate">
                        {formatFechaHora(log.fechaHora)}
                      </span>
                      <div>
                        <EventBadge event={log.evento} />
                      </div>
                      <span className="font-sans text-[12.5px] text-slate-800 truncate font-semibold uppercase" title={log.entidadAfectada || ''}>
                        {log.entidadAfectada || <span className="text-slate-400 italic text-[11px] font-normal lowercase">no aplica</span>}
                      </span>
                      <span className="font-sans text-[12.5px] text-slate-600 truncate pr-2 font-medium" title={resolvedEmail}>
                        {resolvedEmail}
                      </span>
                      <div>
                        <EstadoBadge estado={log.estado} />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Pie: paginación e información ──────────────────────────────── */}
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="font-sans text-[12.5px] text-slate-500 font-medium">
              Mostrando {displayLogs.length} de {allFetchedLogs.length} logs cargados.
            </span>
            
            {hasMore && !isLoading && (
              <button
                onClick={handleCargarMas}
                disabled={isLoadingMore}
                className="
                  inline-flex items-center justify-center gap-2
                  h-8 px-5 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100
                  font-sans font-semibold text-[12.5px] rounded border border-slate-300 shadow-sm
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-all duration-100
                "
              >
                {isLoadingMore ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Cargando más...
                  </>
                ) : 'Cargar más logs antiguos'}
              </button>
            )}
          </div>
        </>
      ) : (
        /* ── Tab: Diagnóstico del Servidor (System logs) ─────────────────── */
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded p-4 flex flex-wrap items-end justify-between gap-4 shadow-sm">
            <div className="flex gap-4 flex-wrap items-end">
              {/* Nivel de Log */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="sys-level" className="font-sans font-bold text-[10px] text-slate-400 uppercase tracking-widest">Nivel de Filtrado</label>
                <select
                  id="sys-level"
                  value={sysLevel}
                  onChange={(e) => setSysLevel(e.target.value)}
                  className="
                    h-8 px-3 pr-8 w-[150px]
                    font-sans text-[13px] text-slate-800
                    bg-white border border-slate-200 rounded
                    outline-none appearance-none cursor-pointer
                    focus:ring-2 focus:ring-[#a8c8fa] focus:border-[#a8c8fa]
                    transition-all
                    bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2364748b%22 stroke-width=%222%22><polyline points=%226 9 12 15 18 9%22/></svg>')]
                    bg-no-repeat bg-[right_8px_center]
                  "
                >
                  <option value="">Todos los niveles</option>
                  <option value="DEBUG">DEBUG</option>
                  <option value="INFO">INFO</option>
                  <option value="WARNING">WARNING</option>
                  <option value="ERROR">ERROR</option>
                </select>
              </div>

              {/* Límite de líneas */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="sys-lines" className="font-sans font-bold text-[10px] text-slate-400 uppercase tracking-widest font-sans">Líneas de consola</label>
                <select
                  id="sys-lines"
                  value={sysLines}
                  onChange={(e) => setSysLines(Number(e.target.value))}
                  className="
                    h-8 px-3 pr-8 w-[110px]
                    font-sans text-[13px] text-slate-800
                    bg-white border border-slate-200 rounded
                    outline-none appearance-none cursor-pointer
                    focus:ring-2 focus:ring-[#a8c8fa] focus:border-[#a8c8fa]
                    transition-all
                    bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2364748b%22 stroke-width=%222%22><polyline points=%226 9 12 15 18 9%22/></svg>')]
                    bg-no-repeat bg-[right_8px_center]
                  "
                >
                  <option value="50">50 líneas</option>
                  <option value="100">100 líneas</option>
                  <option value="200">200 líneas</option>
                  <option value="500">500 líneas</option>
                </select>
              </div>
            </div>

            {/* Descargar Log Completo */}
            <button
              onClick={handleDescargarSysLogs}
              className="
                inline-flex items-center gap-2
                h-8 px-4 bg-[#001631] text-white hover:bg-[#002b54] active:bg-[#001229]
                font-sans font-semibold text-[13px] rounded transition-all duration-100
              "
            >
              <DownloadIcon />
              Descargar sgpi.log Completo
            </button>
          </div>

          {/* Consola Terminal (Tema Claro/Gris Profesional) */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden flex flex-col">
            <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                <span className="font-mono text-[11px] text-slate-500 ml-2">diagnostic_console ~ logs</span>
              </div>
              <span className="font-mono text-[10px] text-slate-400 uppercase font-semibold">sgpi.log</span>
            </div>
            
            <div className="p-4 bg-slate-50 overflow-y-auto max-h-[500px] min-h-[300px] flex flex-col font-mono text-[12px] leading-relaxed text-slate-700 select-text">
              {isSysLoading ? (
                <div className="flex-1 flex items-center justify-center text-slate-400 gap-2 h-64">
                  <svg className="animate-spin h-4 w-4 text-[#001631]" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Consultando servidor...
                </div>
              ) : systemLogs.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-slate-400 h-64">
                  No se encontraron registros de diagnóstico en el servidor.
                </div>
              ) : (
                <div className="space-y-1">
                  {systemLogs.map((line, index) => {
                    let lineColor = 'text-slate-700';
                    let bgSpan = '';
                    if (line.includes('[ERROR]')) {
                      lineColor = 'text-rose-700 font-semibold';
                      bgSpan = 'bg-rose-50 border border-rose-100 rounded px-1.5 py-0.5 my-0.5 inline-block w-full';
                    } else if (line.includes('[WARNING]')) {
                      lineColor = 'text-amber-700 font-medium';
                      bgSpan = 'bg-amber-50 border border-amber-100 rounded px-1.5 py-0.5 my-0.5 inline-block w-full';
                    } else if (line.includes('[DEBUG]')) {
                      lineColor = 'text-slate-400 font-normal';
                    } else if (line.includes('[INFO]')) {
                      lineColor = 'text-sky-700';
                      bgSpan = 'bg-sky-50/50 rounded px-1 inline-block w-full';
                    }
                    
                    return (
                      <div key={index} className={`whitespace-pre-wrap break-all ${lineColor} ${bgSpan}`}>
                        {line}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      </div>

      {/* ── Modal de detalle de log ───────────────────────────────────────── */}
      {selectedLog && (
        <LogDetailModal
          log={selectedLog}
          userEmail={resolveUserDisplay(selectedLog.usuario)}
          onClose={() => setSelectedLog(null)}
        />
      )}
    </MainLayout>
  );
}
