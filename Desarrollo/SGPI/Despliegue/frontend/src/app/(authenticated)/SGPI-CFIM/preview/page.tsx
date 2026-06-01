'use client';

/**
 * @file SGPI-CFIM/preview/page.tsx
 * @route /importacion/preview
 * @description Pantalla de progreso y vista previa de importación.
 *
 * Flujo real:
 *  - Lee {entity, fileName, fileSize, jobId} del sessionStorage
 *  - Usa useAsyncJob → polling cada 2s a GET /api/v1/import/{jobId}/status
 *  - Muestra barra de progreso animada mientras status = queued|running
 *  - Al completarse: muestra tabla de previsualización (primeras filas)
 *    y guarda el resumen en sessionStorage para /results
 *  - Al fallar: muestra banner de error con botón de reintentar
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/SGPI-CFU/components/layout';
import { Button, Badge } from '@/SGPI-CFU/components/ui';
import { useAsyncJob } from '@/SGPI-CFU/lib/hooks/useAsyncJob';
import { importEndpoints } from '@/SGPI-CFU/lib/api/endpoints';

const AlertCircleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const InfoCircleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

interface ImportMeta {
  entity:   string;
  fileName: string;
  fileSize: number;
  jobId:    string;
}

// ─────────────────────────────────────────────────────────────────────────────
// (Las tablas de previsualización se han removido debido a que la 
// importación determina automáticamente las entidades a insertar)
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Barra de progreso animada
// ─────────────────────────────────────────────────────────────────────────────

function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <div className="w-full" aria-label={`Progreso: ${value}%`}>
      <div className="flex justify-between items-center mb-1.5">
        <span className="font-sans text-[13px] text-on-surface-variant">{label}</span>
        <span className="font-sans font-semibold text-[13px] text-on-surface">{value}%</span>
      </div>
      <div className="w-full h-2 bg-surface-container-low rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
          style={{ width: `${value}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────────────────────────────────────

export default function ImportPreviewPage() {
  const router = useRouter();
  const [meta, setMeta] = useState<ImportMeta | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  // Hook de polling que consulta el status del job
  const { startJob, progress, status, isRunning, isSuccess, error, summary, reset, logs, processed, errors, statusLabel } =
    useAsyncJob((jobId) => importEndpoints.getStatus(jobId));

  const consoleRef = useRef<HTMLDivElement>(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);

  // Auto-scroll del timeline de logs
  useEffect(() => {
    const el = consoleRef.current;
    if (!el || userScrolledUp) return;
    el.scrollTop = el.scrollHeight;
  }, [logs, userScrolledUp]);

  const handleConsoleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 15;
    if (isAtBottom) {
      setUserScrolledUp(false);
    } else {
      setUserScrolledUp(true);
    }
  }, []);

  // Leer metadatos del sessionStorage e iniciar polling inmediatamente
  useEffect(() => {
    const raw = sessionStorage.getItem('import_meta');
    if (!raw) {
      router.replace('/importacion');
      return;
    }
    try {
      const parsed: ImportMeta = JSON.parse(raw);
      setMeta(parsed);

      // Iniciar polling del job_id obtenido en la pantalla anterior
      startJob(async () => ({ job_id: parsed.jobId }));
    } catch {
      router.replace('/importacion');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // solo al montar

  // Cuando el job completa, guardar resultados y navegar a /results con un retraso amigable
  useEffect(() => {
    if (!isSuccess || !meta) return;

    const results = {
      entity:      meta.entity,
      fileName:    meta.fileName,
      nuevos:      (summary as any)?.created   ?? 0,
      actualizados:(summary as any)?.updated   ?? 0,
      errores:     (summary as any)?.errors    ?? 0,
      apiRenacytOffline: (summary as any)?.api_renacyt_offline ?? false,
    };
    sessionStorage.setItem('import_results', JSON.stringify(results));
    
    setRedirecting(true);
    const t = setTimeout(() => {
      router.push('/importacion/results');
    }, 1500);

    return () => clearTimeout(t);
  }, [isSuccess, summary, meta, router]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleCancel = useCallback(() => {
    reset();
    sessionStorage.removeItem('import_meta');
    router.push('/importacion');
  }, [reset, router]);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  const entity   = meta?.entity   ?? 'docentes';
  const fileName = meta?.fileName ?? 'archivo.xlsx';

  // Geometría del progreso circular SVG
  const radius = 68;
  const strokeWidth = 8;
  const normalizedRadius = radius - strokeWidth * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <MainLayout title="Sistema de Gestión de Proyectos de Investigación">

      {/* ── Título ──────────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <h1 className="font-heading font-semibold text-h1 text-on-surface leading-[38px]">
          {isRunning
            ? 'Procesando Importación…'
            : isSuccess
              ? 'Vista Previa de Importación'
              : error
                ? 'Error en la Importación'
                : 'Vista Previa de Importación'
          }
        </h1>
      </div>

      <div className="w-full bg-surface-container-lowest rounded border border-outline-variant shadow-level-1 overflow-hidden">

        {/* ── Estado: Procesando (queued | running) ───────────────────────────── */}
        {isRunning && (
          <div className="p-6 flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
              
              {/* Columna Izquierda: Indicador Circular */}
              <div className="md:col-span-5 flex flex-col items-center justify-center p-6 bg-surface-container-low rounded border border-outline-variant text-center gap-4">
                <div className="relative flex items-center justify-center">
                  
                  {/* Círculo radial SVG */}
                  <svg height={radius * 2} width={radius * 2} className="transform -rotate-90">
                    {/* Fondo */}
                    <circle
                      stroke="var(--md-sys-color-surface-container-high, #e2e8f0)"
                      fill="transparent"
                      strokeWidth={strokeWidth}
                      r={normalizedRadius}
                      cx={radius}
                      cy={radius}
                    />
                    {/* Progreso */}
                    <circle
                      stroke="url(#progressGradient)"
                      fill="transparent"
                      strokeWidth={strokeWidth}
                      strokeDasharray={circumference + ' ' + circumference}
                      style={{ strokeDashoffset }}
                      strokeLinecap="round"
                      r={normalizedRadius}
                      cx={radius}
                      cy={radius}
                      className="transition-all duration-500 ease-out"
                    />
                    <defs>
                      <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#002d62" />
                        <stop offset="100%" stopColor="#3b82f6" />
                      </linearGradient>
                    </defs>
                  </svg>
                  
                  {/* Porcentaje en el centro */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[28px] font-bold font-heading text-on-surface leading-none">
                      {progress}%
                    </span>
                    <span className="text-[9px] font-sans text-on-surface-variant uppercase tracking-wider font-bold mt-1.5">
                      Progreso
                    </span>
                  </div>
                </div>

                <div>
                  <h3 className="font-heading font-semibold text-[15px] text-on-surface line-clamp-1">
                    {fileName}
                  </h3>
                  <p className="font-sans text-[12px] text-on-surface-variant mt-1">
                    {status === 'queued'
                      ? 'Espera en cola del servidor...'
                      : 'Ejecutando importación inteligente...'}
                  </p>
                </div>

                {/* Contadores en tiempo real */}
                <div className="grid grid-cols-2 gap-3 w-full mt-2">
                  <div className="bg-surface-container-highest p-3 rounded flex flex-col items-center border border-outline-variant/30">
                    <span className="text-[18px] font-bold text-primary leading-none">
                      {processed}
                    </span>
                    <span className="text-[11px] text-on-surface-variant font-medium mt-1">
                      Leídos
                    </span>
                  </div>
                  <div className="bg-surface-container-highest p-3 rounded flex flex-col items-center border border-outline-variant/30">
                    <span className="text-[18px] font-bold text-[#b91c1c] leading-none">
                      {errors}
                    </span>
                    <span className="text-[11px] text-on-surface-variant font-medium mt-1">
                      Inconsistencias
                    </span>
                  </div>
                </div>
              </div>

              {/* Columna Derecha: Timeline animado */}
              <div className="md:col-span-7 flex flex-col bg-surface-container-lowest border border-outline-variant rounded overflow-hidden min-h-[300px] h-[340px] md:h-auto">
                
                {/* Header de consola */}
                <div className="px-4 py-2.5 bg-surface-container-low border-b border-outline-variant flex items-center justify-between">
                  <span className="text-[12px] font-bold font-sans text-on-surface">
                    Actividad de la Importación
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    <span className="text-[10px] font-mono text-on-surface-variant uppercase font-semibold">
                      {statusLabel}
                    </span>
                  </span>
                </div>

                {/* Contenedor de logs */}
                <div className="relative flex-1 overflow-hidden">
                  <div
                    ref={consoleRef}
                    onScroll={handleConsoleScroll}
                    className="h-full overflow-y-auto p-4 flex flex-col gap-3 scroll-smooth"
                  >
                    {logs && logs.length > 0 ? (
                      logs.map((log, idx) => {
                        const isLast = idx === logs.length - 1;
                        const isErr = log.message.toLowerCase().includes('error');
                        return (
                          <div
                            key={idx}
                            className={`flex items-start gap-3 p-3 rounded border transition-all duration-300 ${
                              isLast
                                ? 'bg-[#eff6ff] border-[#bfdbfe] animate-sweep-in log-shimmer-sweep'
                                : 'bg-surface-container-low/40 border-transparent opacity-80 hover:opacity-100'
                            }`}
                          >
                            {/* Icono indicador */}
                            <div className="mt-0.5 flex-shrink-0">
                              {isLast ? (
                                <span className="relative flex h-2.5 w-2.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#3b82f6] opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#3b82f6]"></span>
                                </span>
                              ) : isErr ? (
                                <div className="w-2.5 h-2.5 rounded-full bg-error" />
                              ) : (
                                <svg className="w-4 h-4 text-[#059669]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <p className={`font-sans text-[13px] leading-[18px] ${
                                isLast ? 'text-primary font-semibold' : 'text-on-surface'
                              }`}>
                                {log.message}
                              </p>
                              <span className="text-[10px] text-on-surface-variant font-mono mt-1 block">
                                {new Date(log.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="flex items-center justify-center h-full text-on-surface-variant text-[13px] italic">
                        Iniciando la lectura del archivo...
                      </div>
                    )}
                  </div>

                  {userScrolledUp && (
                    <button
                      onClick={() => {
                        setUserScrolledUp(false);
                        if (consoleRef.current) {
                          consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
                        }
                      }}
                      className="absolute bottom-3 right-3 bg-[#1e293b] hover:bg-[#334155] text-white text-[11px] font-semibold px-2.5 py-1.5 rounded shadow-lg flex items-center gap-1.5 transition-all duration-200"
                    >
                      <span>Ir al final</span>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 13l-7 7-7-7m14-6l-7 7-7-7" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Acciones del progreso */}
            <div className="flex justify-center border-t border-outline-variant pt-4 mt-2">
              <Button
                id="btn-cancelar-importacion-progreso"
                variant="secondary"
                size="md"
                onClick={handleCancel}
                aria-label="Cancelar y volver a la pantalla de carga"
              >
                Cancelar Importación
              </Button>
            </div>
          </div>
        )}

        {/* ── Estado: Error ───────────────────────────────────────────────────── */}
        {!isRunning && error && (
          <div className="px-6 py-10 flex flex-col items-center gap-5">
            <div className="flex items-start gap-3 px-5 py-4 bg-[#fff1f1] border border-[#fca5a5] rounded w-full max-w-[520px]">
              <span className="text-error"><AlertCircleIcon /></span>
              <p className="font-sans text-[13px] leading-[20px] text-error">
                <span className="font-bold">Error al procesar la importación.</span>{' '}
                {error}
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                id="btn-reintentar"
                variant="primary"
                size="md"
                onClick={handleCancel}
                aria-label="Volver a intentar con otro archivo"
              >
                Intentar con otro archivo
              </Button>
            </div>
          </div>
        )}

        {/* ── Estado: Completado — tabla de preview ───────────────────────────── */}
        {isSuccess && (
          <>
            {/* Banner de éxito */}
            <div className="flex items-start gap-3 px-5 py-4 bg-[#eff6ff] border-b border-[#bfdbfe] text-[#1e40af]">
              <InfoCircleIcon />
              <p className="font-sans text-[13px] leading-[20px]">
                <span className="font-bold">Procesamiento completado.</span>{' '}
                Se han procesado <span className="font-bold">{(summary as any)?.created ?? 0} registros nuevos</span>{' '}
                y <span className="font-bold">{(summary as any)?.updated ?? 0} actualizados</span>{' '}
                del archivo <span className="font-bold">«{fileName}»</span>.
                {(summary as any)?.errors > 0 && (
                  <> Con <span className="font-bold text-[#d97706]">{(summary as any)?.errors} errores</span>.</>
                )}
              </p>
            </div>

            <div className="flex items-center justify-between px-5 py-4 border-t border-outline-variant bg-surface-container-lowest">
              <div className="flex items-center gap-2">
                {redirecting && (
                  <svg className="animate-spin h-4 w-4 text-[#1e40af]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                <p className="font-sans text-[13px] text-on-surface-variant font-medium">
                  {redirecting ? '¡Completado! Redirigiendo al resumen...' : 'El proceso ha finalizado.'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  id="btn-nueva-importacion"
                  variant="secondary"
                  size="md"
                  onClick={handleCancel}
                  aria-label="Iniciar una nueva importación"
                >
                  Nueva importación
                </Button>
                <Button
                  id="btn-ver-resultados"
                  variant="primary"
                  size="md"
                  onClick={() => router.push('/importacion/results')}
                  aria-label="Ver resumen completo de resultados"
                  className="!bg-[#059669] hover:!bg-[#047857] active:!bg-[#065f46]"
                >
                  Ver resumen de resultados
                </Button>
              </div>
            </div>
          </>
        )}

      </div>

    </MainLayout>
  );
}
