'use client';

/**
 * @file [id]/historial/page.tsx
 * @route /investigadores/[id]/historial
 * @description Historial por Docente — Línea de Tiempo de Proyectos.
 *
 * Accesible desde:
 *   - Botón "Ver Historial" en la tarjeta de perfil del investigador
 *     (/investigadores/[id])
 *
 * Flujo:
 *   6. Recupera y despliega la información del investigador y su Línea de Tiempo.
 *   7. Muestra vista cronológica con: CÓD, Título, Rol, Período, Presupuesto,
 *      Entidad Financiadora y Estado.
 *   8. El usuario presiona "Generar Certificado PDF".
 *   9. El sistema muestra un modal de vista previa y confirmación.
 *  10. Al confirmar, descarga el PDF y muestra toast de éxito.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { MainLayout } from '@/SGPI-CFU/components/layout';
import type {
  DocenteInvestigador, ProyectoHistorial, EstadoProyecto,
} from '../../_data/types';
import { getDocenteById, getHistorialProyectos, generarCertificadoPDF } from '../../_data/service';

// ─────────────────────────────────────────────────────────────────────────────
// Configuración visual de estados de proyecto
// ─────────────────────────────────────────────────────────────────────────────

const ESTADO_PROYECTO_CFG: Record<EstadoProyecto, {
  label: string; bg: string; text: string; dot: string;
}> = {
  en_ejecucion:  { label: 'EN EJECUCIÓN',  bg: 'bg-[#dcfce7]', text: 'text-[#166534]', dot: 'bg-[#16a34a]' },
  finalizado:    { label: 'FINALIZADO',    bg: 'bg-[#f1f5f9]', text: 'text-[#475569]', dot: 'bg-[#64748b]' },
  suspendido:    { label: 'SUSPENDIDO',    bg: 'bg-[#fee2e2]', text: 'text-[#991b1b]', dot: 'bg-[#dc2626]' },
  en_evaluacion: { label: 'EN EVALUACIÓN', bg: 'bg-[#fef9c3]', text: 'text-[#854d0e]', dot: 'bg-[#d97706]' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Íconos
// ─────────────────────────────────────────────────────────────────────────────

const BackIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);

const FileDownloadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

const CheckCircleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const CalendarIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);

const BuildingIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);

const MoneyIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23"/>
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
  </svg>
);


// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatPeriodo(p: ProyectoHistorial): string {
  return `${p.anioInicio} – ${p.anioFin ?? 'Presente'}`;
}

function formatPresupuesto(n: number): string {
  return `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Badge de estado
// ─────────────────────────────────────────────────────────────────────────────

function EstadoBadge({ estado }: { estado: EstadoProyecto }) {
  const cfg = ESTADO_PROYECTO_CFG[estado];
  return (
    <span className={`
      inline-flex items-center gap-1.5 px-2.5 py-1 rounded
      font-sans font-bold text-[10px] tracking-wider uppercase whitespace-nowrap
      ${cfg.bg} ${cfg.text}
    `}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} aria-hidden="true"/>
      {cfg.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tarjeta de proyecto (ítem de la línea de tiempo)
// ─────────────────────────────────────────────────────────────────────────────

function ProyectoCard({ proyecto }: { proyecto: ProyectoHistorial }) {
  const isActive = proyecto.estado === 'en_ejecucion';

  return (
    <div className={`
      relative ml-6 bg-surface-container-lowest
      border rounded shadow-level-1
      transition-all duration-200 hover:shadow-level-2
      ${isActive
        ? 'border-l-4 border-l-[#16a34a] border-outline-variant'
        : 'border-outline-variant'}
    `}>
      {/* Header */}
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          {/* Período pill */}
          <span className={`
            inline-flex items-center gap-1.5 px-2.5 py-1 rounded
            font-mono font-bold text-[11px]
            ${isActive
              ? 'bg-[#f0fdf4] text-[#166534] border border-[#86efac]'
              : 'bg-surface-container text-on-surface-variant border border-outline-variant'}
          `}>
            <CalendarIcon />
            {formatPeriodo(proyecto)}
          </span>
          <EstadoBadge estado={proyecto.estado} />
        </div>

        {/* Título */}
        <h3 className="mt-2.5 font-heading font-semibold text-[15px] text-on-surface leading-[22px]">
          {proyecto.titulo}
        </h3>

        {/* Rol + Código */}
        <p className="mt-1 font-sans text-[12px] text-on-surface-variant">
          Rol:{' '}
          <span className="font-bold text-on-surface">{proyecto.rol}</span>
          {' · '}
          <span className="font-mono text-[11px]">CÓD: {proyecto.codigo}</span>
        </p>
      </div>

      {/* Divider */}
      <div className="border-t border-outline-variant mx-5"/>

      {/* Metadatos */}
      <div className="px-5 py-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <p className="font-sans font-bold text-[9px] text-on-surface-variant uppercase tracking-widest mb-1 flex items-center gap-1">
            <MoneyIcon /> Presupuesto Asignado
          </p>
          <p className="font-mono font-bold text-[14px] text-on-surface">
            {formatPresupuesto(proyecto.presupuesto)}
          </p>
        </div>
        <div>
          <p className="font-sans font-bold text-[9px] text-on-surface-variant uppercase tracking-widest mb-1 flex items-center gap-1">
            <BuildingIcon /> Entidad Financiadora
          </p>
          <p className="font-sans text-[13px] text-on-surface">
            {proyecto.entidadFinanciadora}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal de vista previa del certificado
// ─────────────────────────────────────────────────────────────────────────────

function CertificadoModal({
  docente,
  onCancel,
  onConfirm,
}: {
  docente: DocenteInvestigador;
  onCancel: () => void;
  onConfirm: (incluirMontos: boolean) => Promise<void>;
}) {
  const [incluirMontos, setIncluirMontos] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleConfirm = async () => {
    setIsGenerating(true);
    await onConfirm(incluirMontos);
    setIsGenerating(false);
  };

  // Cerrar con Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cert-modal-titulo"
    >
      {/* Backdrop semitransparente (como en exportaciones) */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Panel del modal */}
      <div className="relative w-full max-w-[540px] bg-white rounded-xl shadow-2xl overflow-hidden border border-[#e2e8f0]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2e8f0]">
          <h2
            id="cert-modal-titulo"
            className="font-heading font-bold text-[17px] text-on-surface"
          >
            Vista Previa del Certificado
          </h2>
          <button
            onClick={onCancel}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-container transition-colors text-on-surface-variant"
            aria-label="Cerrar modal"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Body — preview del documento */}
        <div className="px-6 pt-5 pb-4">
          {/* Área de preview (simulación del PDF) */}
          <div className="bg-[#e8eef7] rounded-lg p-6 flex items-center justify-center min-h-[280px]">
            <div className="bg-white rounded shadow-md w-[220px] min-h-[300px] px-5 py-6 flex flex-col gap-3">
              {/* Header del documento */}
              <div className="flex items-center gap-2.5 pb-3 border-b border-gray-200">
                <div className="w-8 h-8 rounded-full bg-[#001631] flex-shrink-0"/>
                <div className="flex-1">
                  <div className="h-2 bg-gray-300 rounded w-full mb-1.5"/>
                  <div className="h-1.5 bg-gray-200 rounded w-3/4"/>
                </div>
              </div>

              {/* Título */}
              <div className="h-2 bg-gray-300 rounded w-5/6 mx-auto"/>

              {/* Cuerpo */}
              <div className="border border-dashed border-gray-300 rounded p-3 flex flex-col gap-1.5 mt-2 flex-1">
                <div className="h-1.5 bg-gray-200 rounded w-full"/>
                <div className="h-1.5 bg-gray-200 rounded w-11/12"/>
                <div className="h-1.5 bg-gray-200 rounded w-10/12"/>
                <div className="h-1.5 bg-blue-100 rounded w-full mt-1"/>
                <div className="h-1.5 bg-blue-100 rounded w-9/12"/>
                <div className="h-1.5 bg-blue-100 rounded w-10/12"/>
                <div className="h-1.5 bg-blue-100 rounded w-8/12"/>
                <div className="h-1.5 bg-blue-100 rounded w-9/12"/>
                <div className="h-1.5 bg-gray-200 rounded w-7/12 mt-2"/>
              </div>

              {/* Footer del documento */}
              <div className="h-1.5 bg-gray-200 rounded w-4/5 mx-auto mt-1"/>
            </div>
          </div>

          {/* Opción: incluir montos */}
          <div className="mt-4">
            <label
              htmlFor="cert-incluir-montos"
              className="flex items-center gap-3 cursor-pointer select-none group"
            >
              <div
                className={`
                  flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center
                  transition-colors duration-100
                  ${incluirMontos
                    ? 'bg-[#001631] border-[#001631]'
                    : 'bg-white border-[#94a3b8] group-hover:border-[#001631]'}
                `}
              >
                {incluirMontos && (
                  <svg width="11" height="9" viewBox="0 0 11 9" fill="none"
                    stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="1 4.5 4 7.5 10 1"/>
                  </svg>
                )}
              </div>
              <input
                id="cert-incluir-montos"
                type="checkbox"
                checked={incluirMontos}
                onChange={(e) => setIncluirMontos(e.target.checked)}
                className="sr-only"
              />
              <span className="font-sans text-[14px] text-on-surface">
                Incluir montos de financiamiento en el reporte
              </span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#e2e8f0] bg-[#f8fafc]">
          <button
            onClick={onCancel}
            disabled={isGenerating}
            className="px-6 py-2.5 rounded-lg font-sans font-bold text-[14px] text-on-surface border border-outline-variant hover:bg-surface-container disabled:opacity-40 transition-colors"
            aria-label="Cancelar generación"
          >
            Cancelar
          </button>
          <button
            id="cert-confirmar-descargar"
            onClick={handleConfirm}
            disabled={isGenerating}
            className="
              flex items-center gap-2
              px-6 py-2.5 rounded-lg
              font-sans font-bold text-[14px] text-white
              bg-[#001631] hover:bg-[#002b54] active:bg-[#001229]
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors duration-100
            "
            aria-label="Confirmar y descargar certificado PDF"
          >
            {isGenerating ? (
              <>
                <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                Generando...
              </>
            ) : (
              <>
                <FileDownloadIcon />
                Confirmar y Descargar
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}



// ─────────────────────────────────────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────────────────────────────────────

export default function HistorialDocentePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';

  const [docente,       setDocente]       = useState<DocenteInvestigador | null>(null);
  const [proyectos,     setProyectos]     = useState<ProyectoHistorial[]>([]);
  const [isLoading,     setIsLoading]     = useState(true);
  const [notFound,      setNotFound]      = useState(false);
  const [showModal,     setShowModal]     = useState(false);
  const [showToast,     setShowToast]     = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Cargar datos ───────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const [doc, hist] = await Promise.all([
        getDocenteById(id),
        getHistorialProyectos(id),
      ]);
      if (!doc) { setNotFound(true); setIsLoading(false); return; }
      setDocente(doc);
      setProyectos(hist);
      setIsLoading(false);
    }
    load();
  }, [id]);

  // Limpiar timer al desmontar
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  // ── Generar certificado ───────────────────────────────────────────────────
  const handleCertificado = async (incluirMontos: boolean) => {
    await generarCertificadoPDF(id, incluirMontos);
    setShowModal(false);
    setShowToast(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setShowToast(false), 3000);
  };

  // ── Agrupar proyectos por año de inicio (desc) ─────────────────────────────
  const proyectosOrdenados = [...proyectos].sort(
    (a, b) => b.anioInicio - a.anioInicio,
  );

  // Construir grupos por año
  const grupos: { anio: number; items: ProyectoHistorial[] }[] = [];
  for (const p of proyectosOrdenados) {
    const existing = grupos.find((g) => g.anio === p.anioInicio);
    if (existing) { existing.items.push(p); }
    else           { grupos.push({ anio: p.anioInicio, items: [p] }); }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Estados de carga / not found
  // ─────────────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <MainLayout title="Sistema de Gestión de Proyectos de Investigación">
        <div className="animate-pulse flex flex-col gap-4 max-w-[860px]">
          <div className="h-6 w-48 bg-surface-container-high rounded"/>
          <div className="h-[120px] bg-surface-container-high rounded"/>
          <div className="h-[200px] bg-surface-container-high rounded"/>
          <div className="h-[200px] bg-surface-container-high rounded"/>
        </div>
      </MainLayout>
    );
  }

  if (notFound || !docente) {
    return (
      <MainLayout title="Sistema de Gestión de Proyectos de Investigación">
        <div className="text-center py-20">
          <p className="font-sans font-semibold text-[14px] text-on-surface mb-2">
            Docente no encontrado.
          </p>
          <button
            onClick={() => router.push('/investigadores')}
            className="font-sans text-[13px] text-[#2563eb] hover:underline"
          >
            Volver al directorio
          </button>
        </div>
      </MainLayout>
    );
  }

  const estadoDoc = docente.estado;
  const estadoCfg = {
    activo:      { dot: 'bg-[#16a34a]', text: 'text-[#166534]', label: 'Activo' },
    inactivo:    { dot: 'bg-[#dc2626]', text: 'text-[#991b1b]', label: 'Inactivo' },
    por_vencer:  { dot: 'bg-[#d97706]', text: 'text-[#92400e]', label: 'Por Vencer' },
  }[estadoDoc];

  const totalProyectos = proyectos.length;

  // ─────────────────────────────────────────────────────────────────────────
  // Render principal
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <MainLayout title="Sistema de Gestión de Proyectos de Investigación">

      <div className="max-w-[860px] mx-auto w-full">

        {/* ── Encabezado ──────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
          <div>
            <button
              onClick={() => router.push(`/investigadores/${id}`)}
              className="
                inline-flex items-center gap-1 mb-2
                font-sans text-[12px] text-on-surface-variant hover:text-on-surface
                transition-colors
              "
              aria-label="Volver al perfil del investigador"
            >
              <BackIcon /> Volver al perfil
            </button>
            <h1 className="font-heading font-semibold text-h1 text-on-surface">
              Historial por Docente
            </h1>
            <p className="mt-0.5 font-sans text-body-md text-on-surface-variant">
              Consulte el historial de proyectos y roles de los investigadores.
            </p>
          </div>

          {/* Botón generar certificado */}
          <button
            id="btn-generar-certificado"
            onClick={() => setShowModal(true)}
            className="
              flex items-center gap-2 px-4 py-2.5 rounded
              font-sans font-semibold text-[13px] text-white
              bg-[#001631] hover:bg-[#002b54] active:bg-[#001229]
              transition-colors flex-shrink-0
            "
            aria-label="Generar certificado PDF del investigador"
          >
            <FileDownloadIcon />
            Generar Certificado PDF
          </button>
        </div>

        {/* ── Tarjeta de perfil del investigador ──────────────────────────────── */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded shadow-level-1 mb-6">
          <div className="px-6 py-5">

            {/* Nombre + estado */}
            <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
              <div>
                <h2 className="font-heading font-bold text-[20px] text-on-surface">
                  {docente.condicionSM === 'SM' ? 'Dr. ' : ''}{docente.nombres} {docente.apellidos}
                </h2>
                <p className="mt-0.5 font-sans text-[12px] text-on-surface-variant">
                  DNI: {docente.dni}
                  {' | '}
                  Categoría: {docente.nivelRenacyt}
                  {docente.condicionSM === 'SM' && ' · Investigador San Marcos'}
                </p>
              </div>
              <span className={`
                inline-flex items-center gap-1.5 px-3 py-1.5 rounded
                font-sans font-bold text-[11px] uppercase
                bg-white border border-outline-variant
                ${estadoCfg.text}
              `}>
                <span className={`w-2 h-2 rounded-full ${estadoCfg.dot}`} aria-hidden="true"/>
                {estadoCfg.label}
              </span>
            </div>

            {/* Metadatos del docente */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-outline-variant">
              <div>
                <p className="font-sans font-bold text-[9px] text-on-surface-variant uppercase tracking-widest mb-0.5">
                  Departamento Académico
                </p>
                <p className="font-sans text-[13px] text-on-surface">{docente.departamento}</p>
              </div>
              <div>
                <p className="font-sans font-bold text-[9px] text-on-surface-variant uppercase tracking-widest mb-0.5">
                  Grupo de Investigación
                </p>
                <p className="font-sans text-[13px] text-on-surface">
                  {docente.departamento.includes('Sistemas') || docente.departamento.includes('Computación')
                    ? 'Data Science & AI Lab (DSAIL)'
                    : `Lab. de ${docente.departamento.split(' ').slice(0, 2).join(' ')}`}
                </p>
              </div>
              <div>
                <p className="font-sans font-bold text-[9px] text-on-surface-variant uppercase tracking-widest mb-0.5">
                  Total de Proyectos
                </p>
                <p className="font-heading font-bold text-[22px] text-on-surface">{totalProyectos}</p>
              </div>
            </div>

          </div>
        </div>

        {/* ── Línea de Tiempo de Proyectos ──────────────────────────────────── */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded shadow-level-1">
          <div className="px-6 py-4 border-b border-outline-variant">
            <h2 className="font-heading font-semibold text-[15px] text-on-surface">
              Línea de Tiempo de Proyectos
            </h2>
          </div>

          <div className="px-6 py-6">
            {grupos.length === 0 ? (
              <div className="py-12 text-center">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
                  stroke="#94a3b8" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"
                  className="mx-auto mb-3">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <p className="font-sans font-semibold text-[14px] text-on-surface mb-1">
                  Sin proyectos registrados.
                </p>
                <p className="font-sans text-[12px] text-on-surface-variant">
                  Este investigador aún no tiene proyectos en el historial.
                </p>
              </div>
            ) : (
              <div>
                {grupos.map((grupo, idx) => (
                  <div key={grupo.anio} className="relative">
                    {/* Etiqueta del año */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`
                        flex-shrink-0 w-6 h-6 rounded-full border-2 z-10
                        flex items-center justify-center
                        ${grupo.items.some((p) => p.estado === 'en_ejecucion')
                          ? 'bg-[#16a34a] border-[#16a34a]'
                          : 'bg-white border-[#94a3b8]'}
                      `}>
                        {grupo.items.some((p) => p.estado === 'en_ejecucion') ? (
                          <span className="w-2.5 h-2.5 rounded-full bg-white"/>
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-[#94a3b8]"/>
                        )}
                      </div>
                      <span className="font-heading font-bold text-[13px] text-on-surface-variant uppercase tracking-widest">
                        {grupo.anio}{grupo.items.some((p) => !p.anioFin) ? ' – Presente' : ''}
                      </span>
                    </div>

                    {/* Proyectos del grupo */}
                    <div className="ml-3 pl-6 border-l-2 border-outline-variant flex flex-col gap-3 pb-6">
                      {grupo.items.map((p) => (
                        <ProyectoCard key={p.id} proyecto={p} />
                      ))}
                    </div>

                    {/* Línea terminadora al final */}
                    {idx === grupos.length - 1 && (
                      <div className="ml-3 flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-surface-container border-2 border-outline-variant flex items-center justify-center flex-shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#cbd5e1]"/>
                        </div>
                        <span className="font-sans text-[11px] text-on-surface-variant italic">
                          Inicio del historial registrado
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Espaciado inferior */}
        <div className="h-8"/>

      </div>

      {/* ── Modal de certificado ────────────────────────────────────────────── */}
      {showModal && (
        <CertificadoModal
          docente={docente}
          onCancel={() => setShowModal(false)}
          onConfirm={handleCertificado}
        />
      )}

      {/* ── Toast de éxito (bottom-right, auto-dismiss 3s) ─────────────────── */}
      {showToast && (
        <div
          role="status"
          aria-live="polite"
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
          <CheckCircleIcon />
          Certificado generado y descargado con éxito.
        </div>
      )}

    </MainLayout>
  );
}
