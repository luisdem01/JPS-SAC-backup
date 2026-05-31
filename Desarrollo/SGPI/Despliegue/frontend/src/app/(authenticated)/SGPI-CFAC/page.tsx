'use client';

/**
 * @file page.tsx
 * @route /convocatorias  (alias: /calls)
 * @description Pantalla principal de Alertas de Convocatorias.
 *
 * Paso 1–6 del Flujo Básico:
 *  - Lista de convocatorias con semaforización visual
 *  - Filtros: búsqueda de texto, estado, ordenamiento
 *  - EX1: panel vacío si no hay convocatorias abiertas
 * Paso 9–12 / EX2:
 *  - Modal "Gestionar Evidencia" con drag-and-drop y validación
 */

import React, {
  useState, useEffect, useCallback, useRef, useMemo,
} from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/SGPI-CFU/components/layout';
import type { Convocatoria, AlertaFiltros, EstadoConvocatoria } from './_data/types';
import {
  getConvocatorias,
  subirEvidencia,
  validarEvidencia,
  diasRestantes,
  nivelAlerta,
  formatFechaCierre,
  EVIDENCIA_MAX_SIZE_MB,
  EVIDENCIA_ALLOWED_EXTS,
} from './_data/service';

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_FILTROS: AlertaFiltros = {
  buscar: '',
  estado: 'Todos',
  orden:  'porDefecto',
};

// ─────────────────────────────────────────────────────────────────────────────
// Paleta de semaforización
// ─────────────────────────────────────────────────────────────────────────────

const SEMAFORO = {
  rojo: {
    border:    'border-l-[4px] border-l-[#dc2626]',
    dot:       'bg-[#dc2626]',
    badgeBg:   'bg-[#fff1f2]',
    badgeText: 'text-[#dc2626]',
    label:     (dias: number) => `VENCE EN ${dias} ${dias === 1 ? 'DÍA' : 'DÍAS'}`,
  },
  amarillo: {
    border:    'border-l-[4px] border-l-[#d97706]',
    dot:       'bg-[#d97706]',
    badgeBg:   'bg-[#fffbeb]',
    badgeText: 'text-[#b45309]',
    label:     (dias: number) => `VENCE EN ${dias} DÍAS`,
  },
  verde: {
    border:    'border-l-[4px] border-l-[#16a34a]',
    dot:       'bg-[#16a34a]',
    badgeBg:   'bg-[#f0fdf4]',
    badgeText: 'text-[#166534]',
    label:     (dias: number) => dias > 60 ? 'VIGENTE' : `VENCE EN ${dias} DÍAS`,
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Íconos
// ─────────────────────────────────────────────────────────────────────────────

const SearchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
  </svg>
);

const FilterIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
  </svg>
);

const ChevronDownIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

const XIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const UploadIcon = ({ className = '' }: { className?: string }) => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"
    className={className} aria-hidden="true">
    <polyline points="16 16 12 12 8 16"/>
    <line x1="12" y1="12" x2="12" y2="21"/>
    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
  </svg>
);

const FileIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>
);

const BellEmptyIcon = () => (
  <svg width="56" height="56" viewBox="0 0 24 24" fill="none"
    stroke="#94a3b8" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);

const EvidenciaIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/>
    <line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
);

const CheckCircleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// Tarjeta de convocatoria
// ─────────────────────────────────────────────────────────────────────────────

interface AlertaCardProps {
  convocatoria: Convocatoria;
  onVerDetalles:      () => void;
  onGestionarEvidencia: () => void;
}

function AlertaCard({ convocatoria: c, onVerDetalles, onGestionarEvidencia }: AlertaCardProps) {
  const dias      = diasRestantes(c.fechaCierre);
  const nivel     = c.estado === 'Abierta' || c.estado === 'Por Vencer'
    ? nivelAlerta(dias)
    : 'verde';
  const semaforo  = SEMAFORO[nivel];
  const badgeLabel = c.estado === 'Abierta' || c.estado === 'Por Vencer'
    ? semaforo.label(dias)
    : c.estado.toUpperCase();

  return (
    <div className={`
      bg-surface-container-lowest
      border border-outline-variant
      ${semaforo.border}
      rounded
      shadow-level-1
      transition-shadow duration-150 hover:shadow-level-2
      flex flex-col
    `}>
      {/* Cabecera badge */}
      <div className={`px-4 pt-3 pb-1.5 flex items-center gap-1.5 ${semaforo.badgeBg} rounded-tr`}>
        <span className={`inline-block w-2 h-2 rounded-full ${semaforo.dot} flex-shrink-0`} aria-hidden="true"/>
        <span className={`font-sans font-bold text-[10px] uppercase tracking-widest ${semaforo.badgeText}`}>
          {badgeLabel}
        </span>
      </div>

      {/* Contenido */}
      <div className="px-4 pt-2 pb-4 flex-1 flex flex-col gap-2">
        <h3 className="font-sans font-bold text-[14px] text-on-surface leading-[20px]">
          {c.nombre}
        </h3>
        <p className="font-sans text-[12px] text-on-surface-variant">
          Estado: <span className="font-medium text-on-surface">{c.estado}</span>
          {' | '}
          Cierre: <span className="font-medium text-on-surface">{formatFechaCierre(c.fechaCierre)}</span>
        </p>
        {c.entidad && (
          <p className="font-sans text-[11px] text-on-surface-variant">{c.entidad}</p>
        )}
      </div>

      {/* Acciones */}
      <div className="px-4 pb-4 flex items-center justify-end gap-2">
        <button
          onClick={onVerDetalles}
          className="
            px-3 py-1.5 rounded
            font-sans font-semibold text-[12px]
            text-on-surface border border-outline-variant
            hover:bg-surface-container transition-colors duration-100
          "
          aria-label={`Ver detalles de ${c.nombre}`}
        >
          Ver Detalles
        </button>
        <button
          onClick={onGestionarEvidencia}
          className="
            px-3 py-1.5 rounded
            font-sans font-semibold text-[12px]
            bg-[#001631] text-white
            hover:bg-[#002b54] active:bg-[#001229]
            transition-colors duration-100
          "
          aria-label={`Gestionar evidencia de ${c.nombre}`}
        >
          Gestionar Evidencia
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal de Gestionar Evidencia
// ─────────────────────────────────────────────────────────────────────────────

interface EvidenciaModalProps {
  convocatoria:  Convocatoria;
  onClose:       () => void;
  onSuccess:     (msg: string) => void;
}

function EvidenciaModal({ convocatoria, onClose, onSuccess }: EvidenciaModalProps) {
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const [file,         setFile]         = useState<File | null>(null);
  const [descripcion,  setDescripcion]  = useState('');
  const [isDragging,   setIsDragging]   = useState(false);
  const [fileError,    setFileError]    = useState<string | null>(null);
  const [isUploading,  setIsUploading]  = useState(false);

  const handleFile = (f: File) => {
    const { valid, error } = validarEvidencia(f);
    if (!valid) { setFileError(error ?? 'Archivo inválido.'); return; }
    setFile(f);
    setFileError(null);
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }, []);

  const handleSubmit = async () => {
    if (!file || !descripcion.trim()) return;
    setIsUploading(true);
    try {
      await subirEvidencia({
        convocatoriaId: convocatoria.id,
        file,
        descripcion: descripcion.trim(),
      });
      onSuccess('Evidencia registrada correctamente y estado actualizado.');
      onClose();
    } catch {
      setFileError('Error al subir la evidencia. Intente nuevamente.');
    } finally {
      setIsUploading(false);
    }
  };

  const canSubmit = file !== null && descripcion.trim().length > 0 && !isUploading;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-evidencia-titulo"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative w-full max-w-[520px] bg-surface-container-lowest rounded shadow-level-3 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant">
          <div>
            <h2 id="modal-evidencia-titulo" className="font-heading font-semibold text-[16px] text-on-surface">
              Cargar Evidencia de Difusión
            </h2>
            <p className="font-sans text-[11px] text-on-surface-variant mt-0.5 line-clamp-1">
              {convocatoria.nombre}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded text-on-surface-variant hover:bg-surface-container transition-colors"
            aria-label="Cerrar modal"
          >
            <XIcon />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 flex flex-col gap-4">

          {/* Zona drag-and-drop */}
          <div
            role="button"
            tabIndex={0}
            aria-label="Zona de carga de archivo de evidencia"
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
            onDrop={handleDrop}
            onClick={() => !file && fileInputRef.current?.click()}
            onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !file) fileInputRef.current?.click(); }}
            className={`
              w-full flex flex-col items-center justify-center gap-2
              min-h-[140px] rounded border-2 border-dashed
              transition-colors duration-150 select-none
              ${isDragging
                ? 'border-primary bg-[#eef2ff] cursor-copy'
                : file
                  ? 'border-outline-variant bg-surface-container-low cursor-default'
                  : 'border-outline-variant bg-surface-container-low hover:border-primary hover:bg-[#f4f6ff] cursor-pointer'
              }
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={EVIDENCIA_ALLOWED_EXTS.join(',')}
              className="sr-only"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              aria-hidden="true"
              tabIndex={-1}
            />

            {file ? (
              <div className="flex flex-col items-center gap-1.5 text-center px-4">
                <span className="text-[#059669]"><FileIcon /></span>
                <p className="font-sans font-semibold text-[13px] text-on-surface">{file.name}</p>
                <p className="font-sans text-[11px] text-on-surface-variant">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB
                </p>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setFile(null); setFileError(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                  className="font-sans text-[11px] text-on-surface-variant hover:text-error mt-0.5"
                >
                  Quitar archivo
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5 text-center pointer-events-none px-4">
                <UploadIcon className={isDragging ? 'text-primary' : 'text-on-surface-variant'} />
                <p className={`font-sans font-semibold text-[13px] ${isDragging ? 'text-primary' : 'text-on-surface'}`}>
                  {isDragging ? 'Suelte el archivo aquí' : 'Arrastre o haga clic para seleccionar'}
                </p>
                <p className="font-sans text-[11px] text-on-surface-variant">
                  Formatos: <span className="font-medium">PDF, JPG, PNG, WEBP</span> — Máx. <span className="font-medium">{EVIDENCIA_MAX_SIZE_MB} MB</span>
                </p>
              </div>
            )}
          </div>

          {/* Error de archivo (EX2) */}
          {fileError && (
            <div
              role="alert"
              className="flex items-start gap-2 px-3 py-2.5 rounded bg-[#fff1f2] border border-[#fca5a5] font-sans text-[12px] text-[#991b1b]"
            >
              <span className="flex-shrink-0 mt-px font-bold">Error:</span>
              {fileError}
            </div>
          )}

          {/* Descripción */}
          <div>
            <label
              htmlFor="evidencia-descripcion"
              className="block font-sans font-bold text-[12px] text-on-surface mb-1.5"
            >
              Descripción de la gestión <span className="text-error">*</span>
            </label>
            <textarea
              id="evidencia-descripcion"
              rows={3}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej: Correo enviado a todos los docentes de la facultad adjuntando la convocatoria..."
              className="
                w-full px-3 py-2
                font-sans text-[13px] text-on-surface
                border border-outline-variant rounded
                outline-none resize-none
                focus:ring-2 focus:ring-[#a8c8fa] focus:border-primary
                transition-all duration-100
                placeholder:text-on-surface-variant
              "
              aria-label="Descripción de la gestión de difusión"
            />
          </div>

          {/* Evidencias ya cargadas */}
          {convocatoria.evidencias.length > 0 && (
            <div>
              <p className="font-sans font-bold text-[11px] text-on-surface-variant uppercase tracking-wider mb-2">
                Evidencias anteriores ({convocatoria.evidencias.length})
              </p>
              <ul className="flex flex-col gap-1.5">
                {convocatoria.evidencias.map((ev) => (
                  <li key={ev.id} className="flex items-center gap-2 px-3 py-2 rounded bg-surface-container-low border border-outline-variant">
                    <span className="text-[#059669] flex-shrink-0"><FileIcon /></span>
                    <div className="min-w-0 flex-1">
                      <p className="font-sans font-medium text-[12px] text-on-surface truncate">{ev.fileName}</p>
                      <p className="font-sans text-[10px] text-on-surface-variant">{ev.fechaCarga} · {ev.cargadoPor}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-outline-variant flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded font-sans font-semibold text-[13px] text-on-surface border border-outline-variant hover:bg-surface-container transition-colors duration-100"
            aria-label="Cancelar carga de evidencia"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="
              px-4 py-2 rounded
              font-sans font-semibold text-[13px]
              bg-[#001631] text-white
              hover:bg-[#002b54] active:bg-[#001229]
              disabled:opacity-40 disabled:cursor-not-allowed
              transition-colors duration-100
              flex items-center gap-2
            "
            aria-label="Confirmar carga de evidencia"
          >
            {isUploading ? (
              <>
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                Cargando...
              </>
            ) : (
              'Confirmar y Guardar'
            )}
          </button>
        </div>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Selector con flecha
// ─────────────────────────────────────────────────────────────────────────────

function Select<T extends string>({ id, value, onChange, options, label }: {
  id: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        aria-label={label}
        className="
          appearance-none pl-3 pr-7 py-2
          font-sans text-[13px] text-on-surface
          bg-surface-container-lowest
          border border-outline-variant rounded
          outline-none cursor-pointer
          focus:ring-2 focus:ring-[#a8c8fa] focus:border-primary
          transition-all duration-100
        "
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant">
        <ChevronDownIcon />
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────────────────────────────────────

export default function AlertasConvocatoriasPage() {
  const router = useRouter();

  const [filtros,         setFiltros]         = useState<AlertaFiltros>(DEFAULT_FILTROS);
  const [tempBuscar,      setTempBuscar]       = useState('');
  const [tempEstado,      setTempEstado]       = useState<EstadoConvocatoria | 'Todos'>('Todos');
  const [tempOrden,       setTempOrden]        = useState<AlertaFiltros['orden']>('porDefecto');
  const [convocatorias,   setConvocatorias]    = useState<Convocatoria[]>([]);
  const [isLoading,       setIsLoading]        = useState(true);
  const [modalConv,       setModalConv]        = useState<Convocatoria | null>(null);
  const [successMsg,      setSuccessMsg]       = useState<string | null>(null);

  // ── Cargar datos ────────────────────────────────────────────────────────────

  const cargar = useCallback(async (f: AlertaFiltros) => {
    setIsLoading(true);
    try {
      const data = await getConvocatorias(f);
      setConvocatorias(data);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { cargar(filtros); }, [cargar, filtros]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleFiltrar = () => {
    const f: AlertaFiltros = {
      buscar: tempBuscar,
      estado: tempEstado,
      orden:  tempOrden,
    };
    setFiltros(f);
    cargar(f);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleFiltrar();
  };

  // ── Toast auto-dismiss ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!successMsg) return;
    const t = setTimeout(() => setSuccessMsg(null), 5000);
    return () => clearTimeout(t);
  }, [successMsg]);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <MainLayout title="Sistema de Gestión de Proyectos de Investigación">

      {/* ── Toast de éxito ─────────────────────────────────────────────────── */}
      {successMsg && (
        <div
          role="status"
          aria-live="polite"
          className="
            fixed top-5 right-5 z-[60]
            flex items-center gap-3
            px-4 py-3 rounded shadow-level-2
            bg-[#f0fdf4] border border-[#86efac]
            font-sans text-[13px] text-[#166534] font-medium
            animate-[fadeIn_0.2s_ease-out]
          "
        >
          <CheckCircleIcon />
          {successMsg}
        </div>
      )}

      {/* ── Encabezado ──────────────────────────────────────────────────────── */}
      <div className="mb-5">
        <h1 className="font-heading font-semibold text-h1 text-on-surface leading-[38px]">
          Alertas de Convocatorias
        </h1>
        <p className="mt-1 font-sans text-body-md text-on-surface-variant">
          Vista inicial: Todas las convocatorias sincronizadas.
        </p>
      </div>

      {/* ── Barra de filtros ────────────────────────────────────────────────── */}
      <div className="
        flex items-end gap-4 flex-wrap
        bg-surface-container-lowest
        border border-outline-variant
        rounded shadow-level-1
        px-4 py-3 mb-6
      ">
        {/* Búsqueda */}
        <div className="flex-1 min-w-[180px]">
          <label htmlFor="buscar-conv" className="block font-sans font-bold text-[11px] text-on-surface uppercase tracking-wider mb-1.5">
            Buscar
          </label>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none">
              <SearchIcon />
            </span>
            <input
              id="buscar-conv"
              type="text"
              value={tempBuscar}
              onChange={(e) => setTempBuscar(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Nombre de convocatoria..."
              className="
                w-full pl-8 pr-3 py-2
                font-sans text-[13px] text-on-surface
                border border-outline-variant rounded
                outline-none
                focus:ring-2 focus:ring-[#a8c8fa] focus:border-primary
                transition-all duration-100
                placeholder:text-on-surface-variant
              "
              aria-label="Buscar convocatoria por nombre"
            />
          </div>
        </div>

        {/* Estado */}
        <div>
          <label htmlFor="filtro-estado" className="block font-sans font-bold text-[11px] text-on-surface uppercase tracking-wider mb-1.5">
            Estado
          </label>
          <Select
            id="filtro-estado"
            value={tempEstado}
            onChange={setTempEstado}
            label="Filtrar por estado"
            options={[
              { value: 'Todos',      label: 'Todos' },
              { value: 'Abierta',    label: 'Abierta' },
              { value: 'Por Vencer', label: 'Por Vencer' },
              { value: 'Cerrada',    label: 'Cerrada' },
              { value: 'Suspendida', label: 'Suspendida' },
            ]}
          />
        </div>

        {/* Orden */}
        <div>
          <label htmlFor="filtro-orden" className="block font-sans font-bold text-[11px] text-on-surface uppercase tracking-wider mb-1.5">
            Orden
          </label>
          <Select
            id="filtro-orden"
            value={tempOrden}
            onChange={setTempOrden}
            label="Ordenar resultados"
            options={[
              { value: 'porDefecto',  label: 'Por Defecto' },
              { value: 'fechaCierre', label: 'Fecha de Cierre' },
              { value: 'alerta',      label: 'Urgencia' },
              { value: 'nombre',      label: 'Nombre' },
            ]}
          />
        </div>

        {/* Botón Filtrar */}
        <button
          onClick={handleFiltrar}
          className="
            flex items-center gap-2
            px-5 py-2 rounded
            font-sans font-semibold text-[13px]
            bg-[#001631] text-white
            hover:bg-[#002b54] active:bg-[#001229]
            transition-colors duration-100
          "
          aria-label="Aplicar filtros"
        >
          <FilterIcon /> Filtrar
        </button>
      </div>

      {/* ── Estado de carga ─────────────────────────────────────────────────── */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-surface-container-lowest border border-outline-variant rounded shadow-level-1 p-4 animate-pulse">
              <div className="h-3 bg-surface-container-high rounded w-1/4 mb-3"/>
              <div className="h-5 bg-surface-container-high rounded w-3/4 mb-2"/>
              <div className="h-3 bg-surface-container-high rounded w-1/2"/>
            </div>
          ))}
        </div>
      )}

      {/* ── Sin resultados (EX1) ────────────────────────────────────────────── */}
      {!isLoading && convocatorias.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <BellEmptyIcon />
          <p className="font-sans font-semibold text-[15px] text-on-surface mt-4 mb-1">
            No hay convocatorias vigentes en este momento.
          </p>
          <p className="font-sans text-[13px] text-on-surface-variant">
            Verifique la última sincronización.
          </p>
        </div>
      )}

      {/* ── Grid de tarjetas ────────────────────────────────────────────────── */}
      {!isLoading && convocatorias.length > 0 && (
        <div
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
          aria-label="Lista de convocatorias"
        >
          {convocatorias.map((conv) => (
            <AlertaCard
              key={conv.id}
              convocatoria={conv}
              onVerDetalles={() => router.push(`/convocatorias/${conv.id}`)}
              onGestionarEvidencia={() => setModalConv(conv)}
            />
          ))}
        </div>
      )}

      {/* ── Modal de evidencia ──────────────────────────────────────────────── */}
      {modalConv && (
        <EvidenciaModal
          convocatoria={modalConv}
          onClose={() => setModalConv(null)}
          onSuccess={(msg) => {
            setModalConv(null);
            setSuccessMsg(msg);
          }}
        />
      )}

    </MainLayout>
  );
}
