'use client';

import React, { useState, useRef } from 'react';

/**
 * ============================================================================
 * GUÍA DE INTEGRACIÓN: CÓMO AÑADIR ESTE BOTÓN A CUALQUIER PANTALLA
 * ============================================================================
 * 
 * Para integrar la funcionalidad de exportación en cualquier pantalla,
 * simplemente importa el componente `ExportButton` y colócalo en tu interfaz:
 * 
 * ```tsx
 * import { ExportButton } from '@/SGPI-CFU/components/SGPI-CFE/export/ExportFlow';
 * 
 * export default function MiPantalla() {
 *   return (
 *     <div>
 *       <PageHeader title="Mi Pantalla" />
 *       <div className="flex justify-end p-4">
 *         // 1. Añade el botón aquí.
 *         // 2. La prop 'context' identifica qué se está exportando (ej. 'projects', 'reports').
 *         <ExportButton context="reportes_anuales" />
 *       </div>
 *     </div>
 *   );
 * }
 * ```
 * 
 * El `context` sirve para que la lógica interna pueda diferenciar 
 * de dónde viene la solicitud y aplicar distintos endpoints u opciones.
 * Todo el flujo (selección de formato, opciones y barra de progreso) es 
 * manejado internamente por este componente para mantener limpio tu page.tsx.
 * ============================================================================
 */

export function ExportButton({ context, label = "Exportar..." }: { context: string, label?: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-[#1e3a8a] text-white rounded font-medium hover:bg-[#1e3a8a]/90 transition-colors flex items-center gap-2 text-sm shadow-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        {label}
      </button>

      {isOpen && (
        <ExportFlow context={context} onClose={() => setIsOpen(false)} />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tipos Internos
// ─────────────────────────────────────────────────────────────────────────────
type ExportFormat = 'pdf' | 'excel';

// ─────────────────────────────────────────────────────────────────────────────
// Componente Modal del Flujo de Exportación
// ─────────────────────────────────────────────────────────────────────────────
export function ExportFlow({ context, onClose }: { context: string, onClose: () => void }) {
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStartExport = async (selectedFormat: ExportFormat) => {
    setFormat(selectedFormat);
    setIsRunning(true);
    setProgress(10);
    setError(null);
    setIsSuccess(false);

    // Progreso visual mientras esperamos la descarga (flujo síncrono)
    const progressInterval = setInterval(() => {
      setProgress((prev) => (prev < 90 ? prev + 10 : prev));
    }, 500);

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      let url = '';
      let payload: any = {};

      if (selectedFormat === 'pdf') {
        url = `${API_URL}/api/pdf/generate`;
        // Payload mínimo genérico esperado por CMEPDF
        payload = {
          title: `Reporte ${context}`,
          subtitle: 'Generado desde el sistema',
          user_requesting: 'Usuario Autorizado',
          doc_type: 'report',
          columns: ['Columna', 'Valor'],
          data: [['Contexto', context], ['Estado', 'Generado']],
        };
      } else {
        url = `${API_URL}/api/v1/reports/export/excel`;
        
        // El backend CRAPI exige tipos de reporte exactos, mapeamos o usamos default
        const validTypes = ["Carga No Lectiva", "Proyectos Activos", "Produccion Cientifica", "Resumen General"];
        const finalTipo = validTypes.includes(context) ? context : "Resumen General";

        // Payload esperado por CMEE (ReportParams)
        payload = {
          tipo_reporte: finalTipo
        };
      }

      // IMPORTANTE: En producción usar auth tokens
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('sgpi_access_token') || ''}`
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
         throw new Error(`Error ${response.status}: Ha ocurrido un error al generar el archivo.`);
      }

      const blob = await response.blob();
      
      // Intentar obtener el filename del header
      const disposition = response.headers.get('Content-Disposition');
      let filename = `Reporte_${context}.${selectedFormat === 'excel' ? 'xlsx' : 'pdf'}`;
      if (disposition && disposition.includes('filename=')) {
        const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
        if (matches != null && matches[1]) { 
          filename = matches[1].replace(/['"]/g, '');
        }
      }

      // Descargar el archivo binario síncronamente
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      setProgress(100);
      setIsSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Ha ocurrido un error al preparar el archivo.');
    } finally {
      clearInterval(progressInterval);
      setIsRunning(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Renders de los Paneles
  // ─────────────────────────────────────────────────────────────────────────────

  // 1. Panel Izquierdo: Vista Previa
  const renderPreviewPane = () => (
    <div className="w-[45%] bg-[#f4f7fc] p-8 flex flex-col items-center justify-center rounded-l-lg border-r border-slate-200">
      <h3 className="text-[#64748b] font-bold text-xl mb-8">Vista Previa</h3>
      <div className="w-full aspect-[1/1.4] bg-white shadow-md rounded border border-slate-200 p-6 flex flex-col relative overflow-hidden">
        {/* Cabecera común a ambos estados */}
        <div className="flex justify-between items-center mb-4">
          <div className="w-1/4 h-3 bg-slate-100 rounded"></div>
          <div className="w-1/4 h-3 bg-slate-100 rounded"></div>
        </div>
        <div className="w-full h-4 bg-slate-100 rounded mb-2"></div>
        <div className="w-3/4 h-4 bg-slate-100 rounded mb-4"></div>
        <div className="w-5/6 h-3 bg-slate-50 rounded mb-6"></div>

        {error ? (
          <div className="flex-1 flex items-center justify-center">
            {/* Ícono de imagen rota */}
            <svg className="w-16 h-16 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 3l18 18M4 16l4-4 4 4 4-4 4 4M4 8h16" />
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeWidth="1.5" />
            </svg>
          </div>
        ) : (
          <>
            {/* Mockup de Tabla */}
            <div className="mt-2 border border-slate-100 rounded flex flex-col">
              <div className="h-6 border-b border-slate-100 flex">
                <div className="w-1/2 border-r border-slate-100"></div>
                <div className="w-1/2"></div>
              </div>
              <div className="h-6 border-b border-slate-100 flex">
                <div className="w-1/2 border-r border-slate-100"></div>
                <div className="w-1/2"></div>
              </div>
              <div className="h-6 flex">
                <div className="w-1/2 border-r border-slate-100"></div>
                <div className="w-1/2"></div>
              </div>
            </div>

            {/* Mockup de Gráfico */}
            <div className="mt-8 flex items-end justify-around h-16 border-b border-slate-100 pb-1">
              <div className="w-5 h-8 bg-slate-300 rounded-t"></div>
              <div className="w-5 h-12 bg-slate-400 rounded-t"></div>
              <div className="w-5 h-6 bg-slate-200 rounded-t"></div>
              <div className="w-5 h-14 bg-[#1e3a8a] rounded-t"></div>
            </div>

            {/* Footer */}
            <div className="mt-auto flex justify-between items-center pt-4 border-t border-slate-50">
              <div className="w-1/4 h-2 bg-slate-100 rounded"></div>
              <div className="w-1/12 h-2 bg-slate-100 rounded"></div>
            </div>
          </>
        )}
      </div>
      {!error && (
        <p className="mt-6 text-sm font-medium text-slate-500">
          Reporte Anual SGPI 2023.{format === 'pdf' ? 'pdf' : 'xlsx'}
        </p>
      )}
    </div>
  );

  // 2. Panel Derecho: Selección y Estado de Carga
  const renderRightPanel = () => {
    // Si terminó exitosamente
    if (isSuccess) {
      return (
        <div className="w-[55%] p-10 bg-white flex flex-col rounded-r-lg justify-center relative text-center">
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="inline-flex p-4 rounded-full bg-green-50 mb-6">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-[#0f172a] mb-3">¡Exportación Exitosa!</h2>
            <p className="text-slate-500 text-base mb-8">El documento ha sido generado y descargado a su dispositivo de forma segura.</p>

            <button onClick={onClose} className="px-8 py-3 bg-[#1e3a8a] text-white font-bold rounded-md hover:bg-[#1e3a8a]/90 transition-colors w-full shadow-sm">
              Cerrar y Volver
            </button>
          </div>
        </div>
      );
    }

    // Estado principal: Selección de Formato (con carga inline)
    const isPdfLoading = isRunning && format === 'pdf';
    const isExcelLoading = isRunning && format === 'excel';

    // SVG Loading spinner
    const SpinnerIcon = (
      <svg className="w-7 h-7 animate-spin text-[#64748b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
      </svg>
    );
    // SVG Download icon
    const DownloadIcon = (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
    );

    return (
      <div className="w-[55%] p-10 bg-white flex flex-col rounded-r-lg overflow-y-auto">
        <div className="flex justify-between items-start mb-4 shrink-0">
          <h2 className="text-2xl font-bold text-[#0f172a]">Exportar Reporte</h2>
          <button onClick={onClose} disabled={isRunning} className="text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50 disabled:pointer-events-none">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {error ? (
          <div className="mb-6 border-l-4 border-red-600 bg-red-50 p-4 rounded-r flex gap-3 items-start animate-in fade-in slide-in-from-top-2 duration-300">
            <svg className="w-6 h-6 text-red-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h4 className="text-red-700 font-bold mb-1">Exportación fallida</h4>
              <p className="text-red-600 text-sm leading-relaxed pr-2">
                {error}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-slate-500 text-base mb-10 leading-relaxed pr-8">
            Seleccione el formato deseado para descargar el reporte consolidado.
          </p>
        )}

        <div className="flex flex-col gap-5 flex-1">
          {/* Opcion PDF */}
          <button
            onClick={() => !isRunning && !error && handleStartExport('pdf')}
            disabled={isExcelLoading || !!error}
            className={`
              text-left w-full rounded-lg p-5 flex items-center gap-5 transition-all bg-white relative overflow-hidden
              ${isPdfLoading ? 'border-[#0f172a] border-2 shadow-sm' : 'border border-slate-200'}
              ${!isRunning && !error ? 'hover:border-slate-300 hover:shadow-sm hover:-translate-y-0.5 group cursor-pointer' : ''}
              ${isExcelLoading || error ? 'opacity-40 grayscale-[0.5] cursor-not-allowed' : ''}
            `}
          >
            {isPdfLoading && (
              <div className="absolute top-0 left-0 h-1 bg-[#1e3a8a] transition-all duration-500" style={{ width: `${progress}%` }}></div>
            )}
            <div className={`w-14 h-14 rounded flex items-center justify-center shrink-0 ${error ? 'bg-red-50 text-red-400' : 'bg-red-50 text-red-600'}`}>
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-[#0f172a] font-bold text-lg">
                {isPdfLoading ? 'Preparando documento...' : 'Exportar a PDF'}
              </h3>
              <p className="text-slate-500 text-sm mt-1">
                {isPdfLoading ? 'Renderizando PDF y aplicando firmas institucionales.' : 'Documento formateado para impresión con membretes institucionales.'}
              </p>
            </div>
            <div className={`transition-colors ${isPdfLoading ? '' : 'text-slate-300 group-hover:text-red-500'}`}>
              {isPdfLoading ? SpinnerIcon : DownloadIcon}
            </div>
          </button>

          {/* Opcion Excel */}
          <button
            onClick={() => !isRunning && !error && handleStartExport('excel')}
            disabled={isPdfLoading || !!error}
            className={`
              text-left w-full rounded-lg p-5 flex items-center gap-5 transition-all bg-white relative overflow-hidden
              ${isExcelLoading ? 'border-[#0f172a] border-2 shadow-sm' : 'border border-slate-200'}
              ${!isRunning && !error ? 'hover:border-slate-300 hover:shadow-sm hover:-translate-y-0.5 group cursor-pointer' : ''}
              ${isPdfLoading || error ? 'opacity-40 grayscale-[0.5] cursor-not-allowed' : ''}
            `}
          >
            {isExcelLoading && (
              <div className="absolute top-0 left-0 h-1 bg-[#1e3a8a] transition-all duration-500" style={{ width: `${progress}%` }}></div>
            )}
            <div className={`w-14 h-14 rounded flex items-center justify-center shrink-0 ${error ? 'bg-slate-50 text-slate-400' : 'bg-[#f0f4fa] text-[#1e3a8a]'}`}>
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-[#0f172a] font-bold text-lg">
                {isExcelLoading ? 'Preparando documento...' : 'Exportar a Excel'}
              </h3>
              <p className="text-slate-500 text-sm mt-1">
                {isExcelLoading ? 'Recopilando y estructurando registros de base de datos.' : 'Datos crudos estructurados para análisis profundo.'}
              </p>
            </div>
            <div className={`transition-colors ${isExcelLoading ? '' : 'text-slate-300 group-hover:text-[#1e3a8a]'}`}>
              {isExcelLoading ? SpinnerIcon : DownloadIcon}
            </div>
          </button>
        </div>

        <div className="mt-auto pt-6 border-t border-slate-200 flex justify-end shrink-0">
          {error ? (
            <button 
              onClick={() => handleStartExport(format)} 
              className="w-full px-6 py-3 bg-[#0f172a] text-white font-bold rounded flex items-center justify-center gap-2 hover:bg-[#0f172a]/90 transition-colors shadow-sm"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Volver a generar reporte
            </button>
          ) : (
            <button 
              onClick={() => { onClose(); }} 
              className={`px-6 py-2.5 font-bold rounded transition-colors text-base ${isRunning ? 'text-slate-400 hover:text-slate-500' : 'text-[#0f172a] hover:bg-slate-100'}`}
            >
              Cancelar
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      onClick={() => {
        if (error) {
          onClose();
        }
      }}
    >
      {/* Container del Modal: fijo para que no salte de tamaño al cambiar pasos */}
      <div
        className="w-full max-w-4xl h-[520px] flex rounded-lg shadow-2xl bg-white animate-in fade-in zoom-in-95 duration-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {renderPreviewPane()}
        {renderRightPanel()}
      </div>
    </div>
  );
}
