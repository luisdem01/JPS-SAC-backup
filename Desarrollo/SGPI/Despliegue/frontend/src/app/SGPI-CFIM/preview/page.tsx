'use client';

/**
 * @file SGPI-CFIM/preview/page.tsx
 * @route /SGPI-CFIM/preview
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

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/SGPI-CFU/components/layout';
import { Button, Badge } from '@/SGPI-CFU/components/ui';
import { useAsyncJob } from '@/SGPI-CFU/lib/hooks/useAsyncJob';
import { importEndpoints } from '@/SGPI-CFU/lib/api/endpoints';

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

  // Hook de polling que consulta el status del job
  const { startJob, progress, status, isRunning, isSuccess, error, summary, reset } =
    useAsyncJob((jobId) => importEndpoints.getStatus(jobId));

  // Leer metadatos del sessionStorage e iniciar polling inmediatamente
  useEffect(() => {
    const raw = sessionStorage.getItem('import_meta');
    if (!raw) {
      router.replace('/SGPI-CFIM');
      return;
    }
    try {
      const parsed: ImportMeta = JSON.parse(raw);
      setMeta(parsed);

      // Iniciar polling del job_id obtenido en la pantalla anterior
      startJob(async () => ({ job_id: parsed.jobId }));
    } catch {
      router.replace('/SGPI-CFIM');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // solo al montar

  // Cuando el job completa, guardar resultados y navegar a /results
  useEffect(() => {
    if (!isSuccess || !meta) return;

    const results = {
      entity:      meta.entity,
      fileName:    meta.fileName,
      nuevos:      (summary as any)?.created   ?? 0,
      actualizados:(summary as any)?.updated   ?? 0,
      errores:     (summary as any)?.errors    ?? 0,
    };
    sessionStorage.setItem('import_results', JSON.stringify(results));
    router.push('/SGPI-CFIM/results');
  }, [isSuccess, summary, meta, router]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleCancel = useCallback(() => {
    reset();
    sessionStorage.removeItem('import_meta');
    router.push('/SGPI-CFIM');
  }, [reset, router]);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  const entity   = meta?.entity   ?? 'docentes';
  const fileName = meta?.fileName ?? 'archivo.xlsx';

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
          <div className="px-6 py-10 flex flex-col items-center gap-6">

            {/* Spinner animado */}
            <div className="relative w-16 h-16">
              <svg className="animate-spin" viewBox="0 0 50 50" aria-hidden="true">
                <circle cx="25" cy="25" r="20" fill="none" stroke="#e2e8f0" strokeWidth="4" />
                <circle cx="25" cy="25" r="20" fill="none" stroke="#001631" strokeWidth="4"
                  strokeDasharray="80 45" strokeLinecap="round" />
              </svg>
            </div>

            <div className="text-center">
              <p className="font-sans font-semibold text-[15px] text-on-surface mb-1">
                Procesando «{fileName}»
              </p>
              <p className="font-sans text-[13px] text-on-surface-variant">
                {status === 'queued' ? 'En cola de procesamiento…' : 'Importando registros a la base de datos…'}
              </p>
            </div>

            <div className="w-full max-w-[420px]">
              <ProgressBar
                value={progress}
                label={status === 'queued' ? 'En cola...' : 'Procesando registros...'}
              />
            </div>

            <Button
              id="btn-cancelar-importacion-progreso"
              variant="secondary"
              size="md"
              onClick={handleCancel}
              aria-label="Cancelar y volver a la pantalla de carga"
            >
              Cancelar
            </Button>
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

            {/* Pie: contador + acciones */}
            <div className="flex items-center justify-between px-5 py-4 border-t border-outline-variant bg-surface-container-lowest">
              <p className="font-sans text-[13px] text-on-surface-variant italic">
                El proceso ha finalizado.
              </p>
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
                  onClick={() => router.push('/SGPI-CFIM/results')}
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
