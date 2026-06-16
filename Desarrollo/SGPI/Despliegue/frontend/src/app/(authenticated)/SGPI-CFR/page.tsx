'use client';

/**
 * @file page.tsx
 * @route /reportes  (alias: /reports)
 * @description Módulo de Generador de Reportes del SGPI.
 *
 * Estados de pantalla:
 *  'form'    → Formulario de parámetros (pasos 1-6)
 *  'loading' → Modal de carga animado (pasos 7-8)
 *  'results' → Vista de resultados con tabla (pasos 9-10)
 *
 * EX1 (sin registros) → muestra alerta y regresa al formulario (paso 3)
 */

import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from 'react';
import { MainLayout } from '@/SGPI-CFU/components/layout';
import type {
  ReporteParams, ReporteResult, TipoReporte, CortesPOI, NivelDetalle,
} from './_data/types';
import {
  generarReporte, guardarSnapshot, obtenerCatalogos,
  PASOS_CARGA, UMBRAL_ALTO, UMBRAL_BAJO,
} from './_data/service';
import { ExportButton } from '@/SGPI-CFU/components/SGPI-CFE/export/ExportFlow';
import { removeAccents } from '@/SGPI-CFU/lib/utils/formatters';

const getExportContext = (tipo: string) => {
  switch(tipo) {
    case 'actividades': return 'Carga No Lectiva';
    case 'proyectosActivos': return 'Proyectos Activos';
    case 'produccionCientifica': return 'Produccion Cientifica';
    case 'baseDatosPOI': return 'Resumen General';
    default: return 'Resumen General';
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear();
const PER_PAGE     = 10;

const DEFAULT_PARAMS: ReporteParams = {
  tipo:               'actividades',
  anioFiscal:         CURRENT_YEAR,
  corte:              'agosto',
  fechaInicio:        '',
  fechaFin:           '',
  departamentos:      [],
  grupoInvestigacion: '',
  nivelDetalle:       'resumido',
};

// ─────────────────────────────────────────────────────────────────────────────
// Íconos
// ─────────────────────────────────────────────────────────────────────────────

const BarChartIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6"  y1="20" x2="6"  y2="14"/><line x1="2"  y1="20" x2="22" y2="20"/>
  </svg>
);

const FileTextIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10 9 9 9 8 9"/>
  </svg>
);

const UsersIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const CheckCircleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

const ClockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);

const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
  </svg>
);

const ExportIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/>
    <line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
);

const SnapshotIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
);

const ChevronLeft = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);
const ChevronRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);
const ChevronDown = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

const ArrowBack = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// Modal de carga animado
// ─────────────────────────────────────────────────────────────────────────────

function LoadingModal() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="status" aria-live="polite" aria-label="Generando reporte">
      {/* Backdrop semitransparente */}
      <div className="absolute inset-0 bg-white/70 backdrop-blur-[3px]" aria-hidden="true"/>

      {/* Tarjeta */}
      <div className="relative w-full max-w-[420px] bg-white rounded-2xl shadow-2xl px-10 py-10 flex flex-col items-center gap-6 border border-[#e2e8f0]">

        {/* Spinner donut */}
        <div className="relative w-[72px] h-[72px]">
          <svg viewBox="0 0 72 72" fill="none" width="72" height="72" className="absolute inset-0">
            <circle cx="36" cy="36" r="28" stroke="#e2e8f0" strokeWidth="8"/>
          </svg>
          <svg viewBox="0 0 72 72" fill="none" width="72" height="72"
            className="absolute inset-0 animate-spin [animation-duration:1.1s]"
            style={{ transformOrigin: 'center' }}>
            <circle cx="36" cy="36" r="28" stroke="#001631" strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 28 * 0.75} ${2 * Math.PI * 28 * 0.25}`}
              strokeDashoffset="0"
            />
          </svg>
        </div>

        {/* Textos */}
        <div className="text-center">
          <h2 className="font-heading font-bold text-[20px] text-on-surface mb-2">
            Generando Reporte
          </h2>
          <p className="font-sans text-[13px] text-on-surface-variant leading-[20px]">
            Procesando información y calculando indicadores dinámicamente.<br/>Por favor, espere.
          </p>
        </div>

        {/* Barra de progreso indeterminada + contador de tiempo */}
        <div className="w-full">
          <div className="w-full h-2 rounded bg-slate-100 overflow-hidden relative">
            <div className="h-full bg-[#001631] rounded animate-pulse w-full" />
          </div>
          <p className="mt-3 font-sans font-medium text-[12px] text-on-surface text-center">
            {seconds} {seconds === 1 ? 'segundo' : 'segundos'} transcurridos...
          </p>
          <p className="mt-1 font-sans text-[11px] text-[#64748b] text-center">
            Consultando la base de datos institucional en tiempo real
          </p>
        </div>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal de confirmación de Snapshot
// ─────────────────────────────────────────────────────────────────────────────

function SnapshotConfirmModal({
  corte, anio, generadoPor, fechaEmision,
  onCancel, onConfirm,
}: {
  corte: string; anio: number; generadoPor: string; fechaEmision: string;
  onCancel: () => void; onConfirm: () => Promise<void>;
}) {
  const [isSaving, setIsSaving] = useState(false);

  const CORTE_LABEL: Record<string, string> = {
    abril: 'Abril', agosto: 'Agosto', noviembre: 'Noviembre',
  };

  const fechaStr = new Date(fechaEmision).toLocaleString('es-PE', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).replace(',', '');

  const handleConfirm = async () => {
    setIsSaving(true);
    await onConfirm();
    setIsSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog" aria-modal="true" aria-labelledby="snapshot-modal-titulo">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onCancel} aria-hidden="true"/>

      {/* Panel */}
      <div className="relative w-full max-w-[520px] bg-white rounded-xl shadow-2xl overflow-hidden border border-[#e2e8f0]">

        {/* Header amarillo */}
        <div className="flex items-center gap-3 px-6 py-4 bg-[#fefce8] border-b border-[#fde68a]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <h2 id="snapshot-modal-titulo" className="font-heading font-bold text-[17px] text-[#92400e]">
            Confirmar Generación de Snapshot
          </h2>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-4">
          <p className="font-sans text-[14px] text-on-surface leading-[22px]">
            ¿Está seguro de generar un Snapshot para el corte de{' '}
            <span className="font-bold">{CORTE_LABEL[corte] ?? corte} {anio}</span>?
          </p>
          <p className="font-sans text-[13px] text-on-surface-variant leading-[20px]">
            Esta acción creará un registro inmutable del estado actual de los datos que no podrá
            ser editado ni eliminado posteriormente. Servirá como anexo oficial para el reporte POI.
          </p>

          {/* Metadatos */}
          <div className="rounded bg-[#f1f5f9] border border-[#e2e8f0] px-4 py-3">
            <p className="font-mono font-bold text-[10px] text-on-surface-variant uppercase tracking-widest mb-2">
              Metadatos del Corte
            </p>
            <p className="font-mono text-[13px] text-on-surface">
              Fecha de captura: {fechaStr} hrs
            </p>
            <p className="font-mono text-[13px] text-on-surface">
              Usuario: {generadoPor}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#e2e8f0] bg-[#f8fafc]">
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="px-6 py-2.5 rounded-lg font-sans font-bold text-[14px] text-on-surface border border-outline-variant hover:bg-surface-container disabled:opacity-40 transition-colors"
            aria-label="Cancelar"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={isSaving}
            className="
              px-6 py-2.5 rounded-lg
              font-sans font-bold text-[14px] text-white
              bg-[#dc2626] hover:bg-[#b91c1c] active:bg-[#991b1b]
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors duration-100
              flex items-center gap-2
            "
            aria-label="Confirmar y congelar datos del snapshot"
          >
            {isSaving ? (
              <>
                <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                Guardando...
              </>
            ) : 'Confirmar y Congelar Datos'}
          </button>
        </div>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tarjeta KPI
// ─────────────────────────────────────────────────────────────────────────────

function KPICard({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: string | number; color: string;
}) {
  return (
    <div className="flex-1 min-w-0 flex items-center gap-3 bg-surface-container-lowest border border-outline-variant rounded shadow-level-1 px-5 py-4">
      <span className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full ${color}`}>
        {icon}
      </span>
      <div>
        <p className="font-sans font-bold text-[10px] text-on-surface-variant uppercase tracking-widest mb-0.5">
          {label}
        </p>
        <p className="font-heading font-bold text-[26px] text-on-surface leading-none">{value}</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Checkbox personalizado
// ─────────────────────────────────────────────────────────────────────────────

function Checkbox({ id, label, checked, onChange }: {
  id: string; label: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 cursor-pointer select-none group">
      <input id={id} type="checkbox" checked={checked}
        onChange={(e) => onChange(e.target.checked)} className="sr-only"/>
      <span className={`
        flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors duration-100
        ${checked ? 'bg-[#001631] border-[#001631]' : 'bg-white border-outline-variant group-hover:border-primary'}
      `}>
        {checked && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none"
            stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 3.5 7 9 1"/>
          </svg>
        )}
      </span>
      <span className="font-sans text-[13px] text-on-surface">{label}</span>
    </label>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Radio button personalizado
// ─────────────────────────────────────────────────────────────────────────────

function Radio({ id, name, label, checked, onChange }: {
  id: string; name: string; label: string; checked: boolean; onChange: () => void;
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 cursor-pointer group">
      <input id={id} type="radio" name={name} checked={checked}
        onChange={onChange} className="sr-only"/>
      <span className={`
        flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors duration-100
        ${checked ? 'border-[#001631]' : 'border-outline-variant group-hover:border-primary'}
      `}>
        {checked && <span className="w-2 h-2 rounded-full bg-[#001631]"/>}
      </span>
      <span className="font-sans text-[13px] text-on-surface">{label}</span>
    </label>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Select con flecha
// ─────────────────────────────────────────────────────────────────────────────

function Select({ id, value, onChange, options, label }: {
  id: string; value: string | number; onChange: (v: string) => void;
  options: { value: string | number; label: string }[]; label: string;
}) {
  return (
    <div className="relative">
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="w-full appearance-none pl-3 pr-8 py-2 font-sans text-[13px] text-on-surface border border-outline-variant rounded bg-surface-container-lowest outline-none cursor-pointer focus:ring-2 focus:ring-[#a8c8fa] transition-all">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant">
        <ChevronDown />
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Formulario
// ─────────────────────────────────────────────────────────────────────────────

interface FormState { params: ReporteParams; ex1Error: string | null; }

function FormularioReporte({ onGenerar }: { onGenerar: (p: ReporteParams) => void }) {
  const [p, setP] = useState<ReporteParams>(DEFAULT_PARAMS);
  const [ex1, setEx1] = useState<string | null>(null);

  const [departamentosData, setDepartamentosData] = useState<string[] | null>(null);
  const [gruposData, setGruposData] = useState<string[] | null>(null);
  const aniosFiscalesData = useMemo(() => [CURRENT_YEAR - 2, CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1, CURRENT_YEAR + 2], []);

  useEffect(() => {
    obtenerCatalogos().then(data => {
      setDepartamentosData(data.departamentos || []);
      setGruposData(data.grupos || []);
      // Pre-seleccionar los dos primeros departamentos si hay datos
      if (data.departamentos && data.departamentos.length > 0) {
        setP(prev => ({ ...prev, departamentos: data.departamentos.slice(0, 2) }));
      }
    });
  }, []);

  const toggleDept = (dept: string) => {
    setP((prev) => ({
      ...prev,
      departamentos: prev.departamentos.includes(dept)
        ? prev.departamentos.filter((d) => d !== dept)
        : [...prev.departamentos, dept],
    }));
  };

  const handleGenerar = () => {
    setEx1(null);
    onGenerar(p);
  };

  return (
    <div className="max-w-[900px] mx-auto">
      {/* EX1 alert */}
      {ex1 && (
        <div role="alert"
          className="mb-4 flex items-start gap-2 px-4 py-3 rounded bg-[#fffbeb] border border-[#fcd34d] font-sans text-[13px] text-[#92400e]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className="flex-shrink-0 mt-0.5">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          {ex1}
        </div>
      )}

      {/* Tarjeta del formulario */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded shadow-level-1 overflow-hidden">

        {/* Encabezado tarjeta */}
        <div className="flex items-center gap-2 px-6 py-4 border-b border-outline-variant">
          <FileTextIcon />
          <span className="font-sans font-bold text-[14px] text-on-surface">Reporte</span>
        </div>

        <div className="px-6 py-5 flex flex-col gap-6">

          {/* ── Sección 1: Parámetros ──────────────────────────────────────── */}
          <div>
            <p className="font-sans font-bold text-[11px] text-on-surface uppercase tracking-widest mb-4 pb-2 border-b border-outline-variant">
              Parámetros del Reporte
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

              {/* Tipo de reporte */}
              <div>
                <label htmlFor="tipo-reporte"
                  className="block font-sans font-bold text-[11px] text-on-surface uppercase tracking-wider mb-1.5">
                  Tipo de Reporte
                </label>
                <Select
                  id="tipo-reporte" label="Tipo de reporte"
                  value={p.tipo}
                  onChange={(v) => setP({ ...p, tipo: v as TipoReporte })}
                  options={[
                    { value: 'actividades',      label: 'Reporte de Actividades' },
                    { value: 'proyectosActivos',  label: 'Proyectos Activos' },
                    { value: 'produccionCientifica', label: 'Producción Científica' },
                    { value: 'baseDatosPOI',      label: 'Base de Datos para POI' },
                  ]}
                />
              </div>

              {/* Año fiscal */}
              <div>
                <label htmlFor="anio-fiscal"
                  className="block font-sans font-bold text-[11px] text-on-surface uppercase tracking-wider mb-1.5">
                  Año Fiscal
                </label>
                <Select
                  id="anio-fiscal" label="Año fiscal"
                  value={p.anioFiscal}
                  onChange={(v) => setP({ ...p, anioFiscal: Number(v) })}
                  options={aniosFiscalesData.map((a) => ({ value: a, label: String(a) }))}
                />
              </div>

              {/* Tipo de corte */}
              <div>
                <p className="block font-sans font-bold text-[11px] text-on-surface uppercase tracking-wider mb-1.5">
                  Tipo de Corte
                </p>
                <div className="flex flex-col gap-1.5 pt-1">
                  {(['abril', 'agosto', 'noviembre'] as CortesPOI[]).map((c) => (
                    <Radio key={c} id={`corte-${c}`} name="corte"
                      label={c === 'agosto' ? 'Agosto (Actual)' : c.charAt(0).toUpperCase() + c.slice(1)}
                      checked={p.corte === c}
                      onChange={() => setP({ ...p, corte: c })}
                    />
                  ))}
                </div>
              </div>

            </div>

            {/* Fechas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label htmlFor="fecha-inicio"
                  className="block font-sans font-bold text-[11px] text-on-surface uppercase tracking-wider mb-1.5">
                  Fecha Inicio
                </label>
                <input type="date" id="fecha-inicio"
                  value={p.fechaInicio}
                  onChange={(e) => setP({ ...p, fechaInicio: e.target.value })}
                  className="w-full px-3 py-2 font-sans text-[13px] text-on-surface border border-outline-variant rounded outline-none focus:ring-2 focus:ring-[#a8c8fa] transition-all"
                  aria-label="Fecha de inicio del período"
                />
              </div>
              <div>
                <label htmlFor="fecha-fin"
                  className="block font-sans font-bold text-[11px] text-on-surface uppercase tracking-wider mb-1.5">
                  Fecha Fin
                </label>
                <input type="date" id="fecha-fin"
                  value={p.fechaFin}
                  onChange={(e) => setP({ ...p, fechaFin: e.target.value })}
                  className="w-full px-3 py-2 font-sans text-[13px] text-on-surface border border-outline-variant rounded outline-none focus:ring-2 focus:ring-[#a8c8fa] transition-all"
                  aria-label="Fecha de fin del período"
                />
              </div>
            </div>
          </div>

          {/* ── Sección 2: Filtros de población ──────────────────────────── */}
          <div>
            <p className="font-sans font-bold text-[11px] text-on-surface uppercase tracking-widest mb-4 pb-2 border-b border-outline-variant">
              Filtros de Población y Configuración
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

              {/* Departamentos */}
              <div>
                <p className="font-sans font-bold text-[11px] text-on-surface uppercase tracking-wider mb-2">
                  Departamentos Académicos
                </p>
                <div className="border border-outline-variant rounded p-3 flex flex-col gap-2 max-h-[150px] overflow-y-auto">
                  {departamentosData === null ? (
                    <span className="text-[12px] text-on-surface-variant italic">Cargando...</span>
                  ) : departamentosData.length === 0 ? (
                    <span className="text-[12px] text-on-surface-variant italic">No hay departamentos</span>
                  ) : departamentosData.map((d) => (
                    <Checkbox key={d} id={`dept-${d}`} label={d}
                      checked={p.departamentos.includes(d)}
                      onChange={() => toggleDept(d)}
                    />
                  ))}
                </div>
              </div>

              {/* Grupo de investigación */}
              <div>
                <label htmlFor="grupo-inv"
                  className="block font-sans font-bold text-[11px] text-on-surface uppercase tracking-wider mb-2">
                  Grupo de Investigación
                </label>
                <Select
                  id="grupo-inv" label="Grupo de investigación"
                  value={p.grupoInvestigacion}
                  onChange={(v) => setP({ ...p, grupoInvestigacion: v })}
                  options={[
                    { value: '', label: 'Todos los grupos' },
                    ...(gruposData || []).map((g) => ({ value: g, label: g })),
                  ]}
                />
              </div>

              {/* Nivel de detalle */}
              <div>
                <p className="font-sans font-bold text-[11px] text-on-surface uppercase tracking-wider mb-2">
                  Nivel de Detalle
                </p>
                <div className="flex flex-col gap-2">
                  <Radio id="nivel-resumido" name="nivel-detalle" label="Resumido"
                    checked={p.nivelDetalle === 'resumido'}
                    onChange={() => setP({ ...p, nivelDetalle: 'resumido' })}
                  />
                  <Radio id="nivel-detallado" name="nivel-detalle" label="Detallado"
                    checked={p.nivelDetalle === 'detallado'}
                    onChange={() => setP({ ...p, nivelDetalle: 'detallado' })}
                  />
                </div>
              </div>

            </div>
          </div>

        </div>

        {/* Footer del formulario */}
        <div className="flex justify-end px-6 py-4 border-t border-outline-variant">
          <button
            onClick={handleGenerar}
            className="
              flex items-center gap-2
              px-6 py-2.5 rounded
              font-sans font-bold text-[14px] text-white
              bg-[#001631] hover:bg-[#002b54] active:bg-[#001229]
              transition-colors duration-100
            "
            aria-label="Generar reporte con los parámetros seleccionados"
          >
            <BarChartIcon /> Generar Reporte
          </button>
        </div>

      </div>

      {/* guardar referencia al setter de ex1 para que lo pueda llamar la página padre */}
      {/* eslint-disable-next-line react/no-unknown-property */}
      <span data-ex1-setter="true" style={{ display: 'none' }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Vista de resultados
// ─────────────────────────────────────────────────────────────────────────────

function VistaResultados({
  result, onNuevoReporte,
}: { result: ReporteResult; onNuevoReporte: () => void }) {
  const [filtro,            setFiltro]            = useState('');
  const [page,              setPage]              = useState(1);
  const [showSnapshotModal, setShowSnapshotModal] = useState(false);
  const [showToast,         setShowToast]         = useState(false);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);



  // Limpiar timer al desmontar
  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  // ── Filtrado y paginación ──────────────────────────────────────────────────
  const registrosFiltrados = useMemo(() => {
    if (!filtro.trim()) return result.registros;
    const q = removeAccents(filtro);
    return result.registros.filter(
      (r) =>
        removeAccents(r.nombre).includes(q) ||
        r.dni.includes(q) ||
        removeAccents(r.departamento).includes(q)
    );
  }, [filtro, result.registros]);

  const totalPages = Math.max(1, Math.ceil(registrosFiltrados.length / PER_PAGE));
  const pagina     = registrosFiltrados.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const handleFiltro = (v: string) => { setFiltro(v); setPage(1); };

  // ── Snapshot: confirmar → guardar → toast ───────────────────────────────────
  const handleSnapshotConfirm = async () => {
    // TODO (real API): guardarSnapshot ya apunta a POST /api/v1/reportes/snapshots
    await guardarSnapshot(result);
    setShowSnapshotModal(false);
    setShowToast(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setShowToast(false), 2000);
  };



  // ── Color de carga ──────────────────────────────────────────────────────────
  const cargaColor = (total: number) => {
    if (total > UMBRAL_ALTO) return 'text-[#dc2626] font-bold';
    if (total < UMBRAL_BAJO) return 'text-[#d97706] font-bold';
    return 'text-on-surface font-semibold';
  };

  // ── Timestamp ───────────────────────────────────────────────────────────────
  const snapshot = new Date(result.fechaEmision).toLocaleString('es-PE', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <div>
      {/* ── Cabecera resultados ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <button
              onClick={onNuevoReporte}
              className="inline-flex items-center gap-1 font-sans text-[12px] text-on-surface-variant hover:text-on-surface transition-colors"
              aria-label="Nuevo reporte"
            >
              <ArrowBack /> Nuevo reporte
            </button>
          </div>
          <h1 className="font-heading font-semibold text-h1 text-on-surface">{result.titulo}</h1>
          <p className="font-sans text-body-md text-on-surface-variant">{result.subtitulo}</p>
          <p className="font-sans text-[11px] text-on-surface-variant mt-0.5">
            Generado por: <span className="font-medium">{result.generadoPor}</span>
            {' · '}Snapshot: <span className="font-medium">{snapshot}</span>
          </p>
        </div>

        {/* Botones exportar / snapshot */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <ExportButton 
            context={getExportContext(result.params.tipo)} 
            label="Exportar" 
            result={result}
          />

          {/* Guardar snapshot */}
          <button
            onClick={() => setShowSnapshotModal(true)}
            className="
              flex items-center gap-1.5
              px-4 py-2 rounded
              font-sans font-semibold text-[13px] text-white
              bg-[#001631] hover:bg-[#002b54]
              transition-colors duration-100
            "
            aria-label="Guardar snapshot del reporte"
          >
            <SnapshotIcon />
            Guardar Snapshot
          </button>
        </div>
      </div>

      {/* ── KPIs ─────────────────────────────────────────────────────────────── */}
      <div className="flex gap-4 mb-6 flex-wrap">
        {result.params.tipo === 'produccionCientifica' ? (
          <>
            <KPICard
              icon={<FileTextIcon />} label="Total Publicaciones"
              value={result.totalPublicaciones || 0}
              color="bg-[#dbeafe] text-[#1d4ed8]"
            />
            <KPICard
              icon={<CheckCircleIcon />} label="Total Tesis"
              value={result.totalTesis || 0}
              color="bg-[#dcfce7] text-[#166534]"
            />
          </>
        ) : (
          <>
            <KPICard
              icon={<UsersIcon />} label="Total Docentes Evaluados"
              value={result.totalDocentes}
              color="bg-[#dbeafe] text-[#1d4ed8]"
            />
            <KPICard
              icon={<CheckCircleIcon />} label="Proyectos Activos"
              value={result.proyectosActivos}
              color="bg-[#dcfce7] text-[#166534]"
            />
            <KPICard
              icon={<ClockIcon />} label="Promedio Carga No Lectiva"
              value={`${result.promedioCargaNoLectiva} hrs`}
              color="bg-[#fef3c7] text-[#b45309]"
            />
          </>
        )}
      </div>

      {/* ── Tabla ────────────────────────────────────────────────────────────── */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded shadow-level-1 overflow-hidden">

        {/* Barra filtro + conteo */}
        <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-outline-variant flex-wrap">
          <div className="relative w-[220px]">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none">
              <SearchIcon />
            </span>
            <input
              type="text" value={filtro}
              onChange={(e) => handleFiltro(e.target.value)}
              placeholder="Filtrar resultados..."
              className="w-full pl-8 pr-3 py-1.5 font-sans text-[13px] text-on-surface border border-outline-variant rounded outline-none focus:ring-2 focus:ring-[#a8c8fa] transition-all"
              aria-label="Filtrar registros del reporte"
            />
          </div>
          <p className="font-sans text-[12px] text-on-surface-variant">
            Mostrando {Math.min((page - 1) * PER_PAGE + 1, registrosFiltrados.length)} a{' '}
            {Math.min(page * PER_PAGE, registrosFiltrados.length)} de{' '}
            <span className="font-medium text-on-surface">{registrosFiltrados.length}</span> registros
          </p>
        </div>

        {/* Sin resultados (EX1 post-filtro) */}
        {registrosFiltrados.length === 0 && (
          <div className="py-14 text-center">
            <p className="font-sans font-semibold text-[14px] text-on-surface mb-1">
              Sin coincidencias
            </p>
            <p className="font-sans text-[12px] text-on-surface-variant">
              Ajuste el filtro para ver resultados.
            </p>
          </div>
        )}

        {/* Tabla */}
        {registrosFiltrados.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" role="table">
              <thead>
                <tr className="border-b border-outline-variant bg-surface-container-low">
                  {result.params.tipo === 'produccionCientifica' ? (
                    ['Título de Publicación', 'DOI / Tipo', 'Revista / Indexación'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-sans font-bold text-[11px] text-on-surface uppercase tracking-widest whitespace-nowrap">{h}</th>
                    ))
                  ) : result.params.tipo === 'proyectosActivos' ? (
                    ['Título del Proyecto', 'Código', 'Estado'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-sans font-bold text-[11px] text-on-surface uppercase tracking-widest whitespace-nowrap">{h}</th>
                    ))
                  ) : (
                    ['Nombre del Docente', 'DNI', 'Departamento', 'Hrs Proyectos', 'Hrs Asesorías', 'Total Carga'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-sans font-bold text-[11px] text-on-surface uppercase tracking-widest whitespace-nowrap">{h}</th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {pagina.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="px-4 py-3 font-sans font-semibold text-[13px] text-on-surface whitespace-nowrap">
                      {r.nombre}
                    </td>
                    <td className="px-4 py-3 font-sans text-[13px] text-on-surface-variant whitespace-nowrap">
                      {r.dni}
                    </td>
                    <td className="px-4 py-3 font-sans text-[13px] text-on-surface">
                      {r.departamento}
                    </td>
                    {result.params.tipo !== 'produccionCientifica' && result.params.tipo !== 'proyectosActivos' && (
                      <>
                        <td className="px-4 py-3 font-sans text-[13px] text-on-surface text-right">
                          {r.hrsProyectos}
                        </td>
                        <td className="px-4 py-3 font-sans text-[13px] text-on-surface text-right">
                          {r.hrsAsesorias}
                        </td>
                        <td className={`px-4 py-3 font-sans text-[13px] text-right ${cargaColor(r.totalCarga)}`}>
                          {r.totalCarga}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1.5 px-4 py-3 border-t border-outline-variant">
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
              className="w-7 h-7 flex items-center justify-center rounded text-on-surface-variant hover:bg-surface-container disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Página anterior"><ChevronLeft /></button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
              <button key={p} onClick={() => setPage(p)}
                className={`w-7 h-7 flex items-center justify-center rounded font-sans text-[13px] font-medium transition-colors ${p === page ? 'bg-[#001631] text-white' : 'text-on-surface-variant hover:bg-surface-container'}`}
                aria-current={p === page ? 'page' : undefined}>{p}</button>
            ))}
            <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}
              className="w-7 h-7 flex items-center justify-center rounded text-on-surface-variant hover:bg-surface-container disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Página siguiente"><ChevronRight /></button>
          </div>
        )}
      </div>

      {/* ── Modal confirmación snapshot ─────────────────────────────────────── */}
      {showSnapshotModal && (
        <SnapshotConfirmModal
          corte={result.params.corte}
          anio={result.params.anioFiscal}
          generadoPor={result.generadoPor}
          fechaEmision={result.fechaEmision}
          onCancel={() => setShowSnapshotModal(false)}
          onConfirm={handleSnapshotConfirm}
        />
      )}

      {/* ── Toast de éxito (bottom-right, auto-dismiss 2s) ──────────────────── */}
      {showToast && (
        <div
          role="status" aria-live="polite"
          className="
            fixed bottom-8 right-6 z-[60]
            flex items-center gap-3
            px-5 py-3.5 rounded-lg
            bg-[#22c55e] text-white
            shadow-2xl
            font-sans font-semibold text-[14px]
            animate-[slideInRight_0.25s_ease-out]
          "
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          Snapshot POI generado y guardado exitosamente.
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Página principal (orquesta los 3 estados)
// ─────────────────────────────────────────────────────────────────────────────

type Vista = 'form' | 'loading' | 'results';

export default function ReportesPage() {
  const [vista,   setVista]   = useState<Vista>('form');
  const [result,  setResult]  = useState<ReporteResult | null>(null);
  const [ex1Msg,  setEx1Msg]  = useState<string | null>(null);

  const handleGenerar = useCallback(async (params: ReporteParams) => {
    setEx1Msg(null);
    setVista('loading');
    try {
      const r = await generarReporte(params);
      setResult(r);
      setVista('results');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al generar el reporte.';
      // EX1: regresa al formulario con el mensaje
      if (msg.startsWith('EX1:')) {
        setEx1Msg(msg.replace('EX1:', '').trim());
      } else {
        setEx1Msg(msg);
      }
      setVista('form');
    }
  }, []);

  return (
    <MainLayout title="Sistema de Gestión de Proyectos de Investigación">

      {/* ── Encabezado de módulo (solo en form) ─────────────────────────────── */}
      {vista !== 'results' && (
        <div className="mb-6">
          <h1 className="font-heading font-semibold text-h1 text-on-surface leading-[38px]">
            Generador de Reportes
          </h1>
          <p className="mt-1 font-sans text-body-md text-on-surface-variant">
            Carga No Lectiva y Snapshots Institucionales
          </p>
        </div>
      )}

      {/* ── Estados ──────────────────────────────────────────────────────────── */}
      {vista === 'form' && (
        <FormularioReporte onGenerar={handleGenerar} />
      )}

      {vista === 'loading' && (
        <>
          {/* Mantener el form visible detrás del modal */}
          <div className="opacity-20 pointer-events-none select-none">
            <FormularioReporte onGenerar={() => {}} />
          </div>
          <LoadingModal />
        </>
      )}

      {vista === 'results' && result && (
        <VistaResultados
          result={result}
          onNuevoReporte={() => { setResult(null); setVista('form'); }}
        />
      )}

      {/* EX1: alerta inline (se pasa al form) */}
      {ex1Msg && vista === 'form' && (
        <div role="alert"
          className="mt-4 max-w-[900px] mx-auto flex items-start gap-2 px-4 py-3 rounded bg-[#fffbeb] border border-[#fcd34d] font-sans text-[13px] text-[#92400e]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className="flex-shrink-0 mt-0.5">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          {ex1Msg}
        </div>
      )}

    </MainLayout>
  );
}
