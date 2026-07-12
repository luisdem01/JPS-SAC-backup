'use client';

import React, { useState, useRef, useEffect } from 'react';
import { getAccessToken } from '@/SGPI-CFU/lib/auth/storage';

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

export function ExportButton({ context, label = "Exportar...", result }: { context: string, label?: string, result?: any }) {
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
        <ExportFlow context={context} result={result} onClose={() => setIsOpen(false)} />
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
export function ExportFlow({ context, result, onClose }: { context: string, result?: any, onClose: () => void }) {
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  // Preparar payload para la generación de PDF
  let pdfTitle = `Reporte ${context}`;
  let pdfSubtitle = 'Generado desde el sistema';
  let pdfColumns = ['Columna', 'Valor'];
  let pdfData = [['Contexto', context], ['Estado', 'Generado']];
  let pdfFilters: Record<string, any> = {};
  let pdfColWidths: number[] | undefined = undefined;

  if (context.startsWith('ficha_grupo_') && result) {
    pdfTitle = `Ficha Consolidada de Grupo`;
    pdfSubtitle = result.name;
    pdfFilters["Código Oficial"] = result.code;
    pdfFilters["Fecha Registro"] = result.recognitionDate || result.createdAt;
    
    let estadoStr = "Pendiente Validar";
    if (result.status === 'validado_active' || result.status === 'validado_activo') estadoStr = "Validado / Activo";
    else if (result.status === 'validado_inactive' || result.status === 'validado_inactivo') estadoStr = "Validado / Inactivo";
    pdfFilters["Estado"] = estadoStr;

    pdfColumns = ["Concepto / Elemento", "Detalle / Información"];
    
    const activeProjectsCount = result.proyectosVinculados ? result.proyectosVinculados.filter((p: any) => p.estado === 'active').length : 0;
    
    pdfData = [
      ["Código Oficial", result.code || "-"],
      ["Nombre del Grupo", result.name || "-"],
      ["Línea de Investigación Principal", result.researchLines ? result.researchLines.join(", ") : "-"],
      ["Proyectos Activos", String(activeProjectsCount)],
      ["Artículos (Scopus)", String(result.articulosScopus || 0)],
      ["Tesis en Curso", String(result.tesisEnCurso || 0)],
      ["<b>INTEGRANTES</b>", ""],
      ...(result.miembros || []).map((m: any) => [
        m.nombre || m.dni,
        `${m.rol} - DNI: ${m.dni} - Incorporación: ${m.fechaIncorporacion || "-"}`
      ]),
      ["<b>PROYECTOS VINCULADOS</b>", ""],
      ...(result.proyectosVinculados || []).map((p: any) => [
        p.codigo || p.codigo_proyecto,
        `${p.titulo || p.titulo_proyecto} (${p.convocatoria}) - Estado: ${p.estado === 'active' ? 'En ejecución' : p.estado === 'pending' ? 'Formulación' : p.estado === 'completed' ? 'Concluido' : 'Cancelado'}`
      ])
    ];
  } else if (result) {
    pdfTitle = result.titulo || pdfTitle;
    pdfSubtitle = result.subtitulo || pdfSubtitle;
    
    pdfFilters["Año Fiscal"] = String(result.params.anioFiscal);
    pdfFilters["Corte"] = result.params.corte.charAt(0).toUpperCase() + result.params.corte.slice(1);
    if (result.params.departamentos.length > 0) {
      pdfFilters["Departamentos"] = result.params.departamentos.join(", ");
    }
    if (result.params.grupoInvestigacion) {
      pdfFilters["Grupo Investigador"] = result.params.grupoInvestigacion;
    }

    switch (result.params.tipo) {
      case 'actividades':
        pdfColumns = ["Nombre del Docente", "DNI", "Departamento", "Hrs Proyectos", "Hrs Asesorías", "Total Carga"];
        pdfColWidths = [0.30, 0.12, 0.28, 0.10, 0.10, 0.10];
        pdfData = result.registros.map((r: any) => [
          r.nombre,
          r.dni,
          r.departamento,
          String(r.hrsProyectos),
          String(r.hrsAsesorias),
          String(r.totalCarga)
        ]);
        break;
      case 'proyectosActivos':
        pdfColumns = ["Código", "Título", "Estado"];
        pdfData = result.registros.map((r: any) => [
          r.id,
          r.nombre,
          r.departamento
        ]);
        break;
      case 'produccionCientifica':
        pdfColumns = ["Título", "Identificador/Tipo", "Revista/Grado"];
        pdfData = result.registros.map((r: any) => [
          r.nombre,
          r.dni,
          r.departamento
        ]);
        break;
      case 'baseDatosPOI':
        pdfColumns = ["Indicador / Métrica", "Valor"];
        pdfData = result.registros.map((r: any) => [
          r.nombre,
          String(r.totalCarga)
        ]);
        break;
      default:
        break;
    }
  }

  const loadPdfPreview = async () => {
    setIsPreviewLoading(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const url = `${API_URL}/api/pdf/generate`;
      const payload = {
        title: pdfTitle,
        subtitle: pdfSubtitle,
        filters_applied: pdfFilters,
        user_requesting: 'Usuario Autorizado',
        doc_type: 'report',
        columns: pdfColumns,
        data: pdfData,
        col_widths: pdfColWidths,
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAccessToken() || ''}`
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      const previewUrl = window.URL.createObjectURL(blob);
      setPdfPreviewUrl(previewUrl);
    } catch (err: any) {
      console.error("Error cargando vista previa PDF:", err);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  useEffect(() => {
    if (format === 'pdf') {
      loadPdfPreview();
    } else {
      if (pdfPreviewUrl) {
        window.URL.revokeObjectURL(pdfPreviewUrl);
        setPdfPreviewUrl(null);
      }
    }
    return () => {
      if (pdfPreviewUrl) {
        window.URL.revokeObjectURL(pdfPreviewUrl);
      }
    };
  }, [format]);

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
        payload = {
          title: pdfTitle,
          subtitle: pdfSubtitle,
          filters_applied: pdfFilters,
          user_requesting: 'Usuario Autorizado',
          doc_type: 'report',
          columns: pdfColumns,
          data: pdfData,
          col_widths: pdfColWidths,
        };
      } else {
        url = `${API_URL}/api/v1/reports/export/excel`;
        
        if (context.startsWith('ficha_grupo_')) {
          const groupId = context.replace('ficha_grupo_', '');
          payload = {
            tipo_reporte: "Ficha Grupo",
            grupo_investigacion: groupId
          };
        } else {
          const validTypes = ["Carga No Lectiva", "Proyectos Activos", "Produccion Cientifica", "Resumen General"];
          const finalTipo = validTypes.includes(context) ? context : "Resumen General";

          if (result) {
            payload = {
              tipo_reporte: finalTipo,
              anio_corte: (finalTipo === 'Produccion Cientifica' || finalTipo === 'Resumen General') ? undefined : result.params.anioFiscal,
              periodo_corte: result.params.corte,
              fecha_inicio_desde: result.params.fechaInicio || undefined,
              fecha_fin_hasta: result.params.fechaFin || undefined,
              departamento_academico: result.params.departamentos.length > 0 ? result.params.departamentos[0] : undefined,
              grupo_investigacion: result.params.grupoInvestigacion || undefined
            };
          } else {
            payload = {
              tipo_reporte: finalTipo
            };
          }
        }
      }

      // IMPORTANTE: En producción usar auth tokens
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAccessToken() || ''}`
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorDetail = "";
        try {
            const errorData = await response.json();
            errorDetail = errorData.detail || await response.text();
        } catch(e) {
            errorDetail = await response.text();
        }
        throw new Error(`Error ${response.status}: Ha ocurrido un error al generar el archivo. Detalle: ${errorDetail}`);
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

  // 1. Panel Izquierdo: Vista Previa Dinámica o Visor de PDF Real
  const renderPreviewPane = () => {
    const filename = `Reporte_${context.replace(/\s+/g, '_')}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;

    return (
      <div className="w-[45%] bg-[#f8fafc] p-8 flex flex-col items-center justify-between rounded-l-lg border-r border-slate-200">
        <h3 className="text-[#475569] font-bold text-lg mb-4 self-start">Vista Previa</h3>
        
        <div className={`w-full flex-1 max-h-[340px] aspect-[1/1.41] bg-white shadow-xl rounded-lg border border-slate-200 flex flex-col relative overflow-hidden transition-all duration-300 hover:shadow-2xl ${pdfPreviewUrl && format === 'pdf' ? 'p-0' : 'p-4'}`}>
          {error ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2 p-4">
              <svg className="w-12 h-12 text-red-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-xs font-semibold text-red-500">Error al cargar vista previa</span>
            </div>
          ) : isPreviewLoading && format === 'pdf' ? (
            // --- CARGANDO PDF REAL ---
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3 p-4">
              <svg className="w-8 h-8 animate-spin text-[#1e3a8a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
              <span className="text-[11px] font-semibold text-[#1e3a8a]">Generando PDF oficial...</span>
            </div>
          ) : format === 'pdf' && pdfPreviewUrl ? (
            // --- VISOR DE PDF REAL (IFRAME) ---
            <iframe 
              src={`${pdfPreviewUrl}#toolbar=0&navpanes=0`} 
              className="w-full h-full border-0" 
              title="Vista previa PDF"
            />
          ) : format === 'pdf' ? (
            // --- FALLBACK: VISTA PREVIA PDF SIMULACIÓN (SI FALLA EL VISOR) ---
            <div className="flex-1 flex flex-col text-[10px]">
              {/* Membrete PDF */}
              <div className="flex justify-between items-start border-b border-slate-300 pb-2 mb-3">
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 bg-[#1e3a8a] rounded-full flex items-center justify-center text-[8px] text-white font-bold">U</div>
                  <span className="font-bold text-[8px] text-[#1e3a8a] tracking-wider">SGPI - UNMSM</span>
                </div>
                <span className="text-[7px] text-slate-400">17/06/2026</span>
              </div>
              
              {/* Título Oficial */}
              <div className="mb-4">
                <h4 className="text-slate-800 font-extrabold text-[12px] leading-tight uppercase tracking-tight">
                  {context}
                </h4>
                <p className="text-[#1e3a8a] font-semibold text-[8px] tracking-wide mt-0.5">
                  Reporte Consolidado del Sistema (Simulado)
                </p>
              </div>

              {/* Contenido / Skeleton de Texto */}
              <div className="space-y-1.5 mb-4">
                <div className="w-full h-1 bg-slate-200 rounded"></div>
                <div className="w-5/6 h-1 bg-slate-200 rounded"></div>
                <div className="w-4/5 h-1 bg-slate-100 rounded"></div>
              </div>

              {/* Tabla Simulación PDF */}
              <div className="border border-slate-200 rounded overflow-hidden mb-3">
                <div className="bg-slate-50 px-2 py-1 border-b border-slate-200 flex justify-between font-bold text-slate-500 text-[7px]">
                  <span>Concepto</span>
                  <span>Indicador</span>
                </div>
                <div className="px-2 py-1 border-b border-slate-100 flex justify-between text-slate-600 text-[6px]">
                  <span>Total Registros</span>
                  <span className="font-semibold text-[#1e3a8a]">Consolidado</span>
                </div>
                <div className="px-2 py-1 flex justify-between text-slate-600 text-[6px]">
                  <span>Estado</span>
                  <span className="text-green-600 font-semibold">Generado</span>
                </div>
              </div>

              {/* Sello/Firma Mock */}
              <div className="mt-auto pt-2 border-t border-dashed border-slate-200 flex justify-between items-end">
                <div className="space-y-0.5">
                  <div className="w-12 h-1 bg-slate-300 rounded"></div>
                  <span className="text-[5px] text-slate-400 block">Firma Autorizada</span>
                </div>
                <div className="w-8 h-8 rounded-full border border-dashed border-red-300 flex items-center justify-center text-[5px] text-red-400 font-bold rotate-12 bg-red-50/50">
                  SGPI
                </div>
              </div>
            </div>
          ) : (
            // --- VISTA PREVIA EXCEL SPREADSHEET ---
            <div className="flex-1 flex flex-col text-[9px] font-sans">
              {/* Barra superior de Excel */}
              <div className="bg-[#107c41] text-white p-1 rounded-t flex justify-between items-center text-[7px] mb-2 -mx-4 -mt-4">
                <div className="flex items-center gap-1.5 pl-2">
                  <span className="font-bold">X</span>
                  <span className="opacity-90 font-medium truncate max-w-[120px]">{filename}</span>
                </div>
                <div className="flex gap-1 pr-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-white/20"></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-white/40"></div>
                </div>
              </div>

              {/* Grid Header A, B, C, D */}
              <div className="grid grid-cols-5 bg-slate-100 border border-slate-200 text-center font-semibold text-slate-500 text-[7px] leading-4">
                <div className="border-r border-slate-200"></div>
                <div className="border-r border-slate-200">A</div>
                <div className="border-r border-slate-200">B</div>
                <div className="border-r border-slate-200">C</div>
                <div>D</div>
              </div>

              {/* Celdas / Filas de Excel */}
              <div className="border-x border-b border-slate-200 flex-1 flex flex-col">
                {/* Fila 1: Título */}
                <div className="grid grid-cols-5 border-b border-slate-100 leading-3">
                  <div className="bg-slate-50 text-slate-400 text-center border-r border-slate-200 text-[6px]">1</div>
                  <div className="col-span-4 pl-1 font-bold text-slate-800 text-[8px] truncate">{context}</div>
                </div>
                {/* Fila 2: Subtítulo */}
                <div className="grid grid-cols-5 border-b border-slate-100 leading-3">
                  <div className="bg-slate-50 text-slate-400 text-center border-r border-slate-200 text-[6px]">2</div>
                  <div className="col-span-4 pl-1 text-slate-500 text-[7px] italic">Generado desde SGPI</div>
                </div>
                {/* Fila 3: Separador */}
                <div className="grid grid-cols-5 border-b border-slate-100 leading-3 bg-slate-50/20">
                  <div className="bg-slate-50 text-slate-400 text-center border-r border-slate-200 text-[6px]">3</div>
                  <div className="col-span-4"></div>
                </div>
                {/* Fila 4: Headers de la tabla */}
                <div className="grid grid-cols-5 border-b border-slate-200 leading-3 bg-[#e1f0e5] font-semibold text-[#107c41]">
                  <div className="bg-slate-50 text-slate-400 text-center border-r border-slate-200 text-[6px]">4</div>
                  <div className="pl-1 border-r border-slate-200">ID</div>
                  <div className="pl-1 border-r border-slate-200">Nombre</div>
                  <div className="pl-1 border-r border-slate-200">Estado</div>
                  <div className="pl-1">Valor</div>
                </div>
                {/* Fila 5: Datos 1 */}
                <div className="grid grid-cols-5 border-b border-slate-100 leading-3 text-slate-600">
                  <div className="bg-slate-50 text-slate-400 text-center border-r border-slate-200 text-[6px]">5</div>
                  <div className="pl-1 border-r border-slate-100">001</div>
                  <div className="pl-1 border-r border-slate-100 truncate">Registro A</div>
                  <div className="pl-1 border-r border-slate-100 text-green-600 font-medium">Activo</div>
                  <div className="pl-1">100%</div>
                </div>
                {/* Fila 6: Datos 2 */}
                <div className="grid grid-cols-5 border-b border-slate-100 leading-3 text-slate-600">
                  <div className="bg-slate-50 text-slate-400 text-center border-r border-slate-200 text-[6px]">6</div>
                  <div className="pl-1 border-r border-slate-100">002</div>
                  <div className="pl-1 border-r border-slate-100 truncate">Registro B</div>
                  <div className="pl-1 border-r border-slate-100 text-green-600 font-medium">Activo</div>
                  <div className="pl-1">95%</div>
                </div>
                {/* Fila 7: Datos 3 */}
                <div className="grid grid-cols-5 border-b border-slate-100 leading-3 text-slate-600">
                  <div className="bg-slate-50 text-slate-400 text-center border-r border-slate-200 text-[6px]">7</div>
                  <div className="pl-1 border-r border-slate-100">003</div>
                  <div className="pl-1 border-r border-slate-100 truncate">Registro C</div>
                  <div className="pl-1 border-r border-slate-100 text-slate-400 font-medium">Inactivo</div>
                  <div className="pl-1">0%</div>
                </div>
              </div>
              
              {/* Pestañas de Excel al fondo */}
              <div className="mt-auto bg-slate-50 border-t border-slate-200 flex items-center text-[7px] -mx-4 -mb-4 px-2 py-1 gap-2 text-slate-500">
                <span className="bg-white px-2 py-0.5 border-t-2 border-[#107c41] font-bold text-slate-800 shadow-sm rounded-t">Reporte</span>
                <span className="opacity-60">Datos</span>
                <span className="opacity-60">Config</span>
              </div>
            </div>
          )}
        </div>
        
        {!error && (
          <p className="mt-4 text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200 select-all tracking-wide shadow-sm truncate max-w-full">
            {filename}
          </p>
        )}
      </div>
    );
  };

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
