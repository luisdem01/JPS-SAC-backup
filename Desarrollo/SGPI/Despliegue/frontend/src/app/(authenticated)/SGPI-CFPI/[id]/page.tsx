'use client';

/**
 * @file [id]/page.tsx
 * @route /proyectos/[id]
 * @description Expediente Digital de Proyecto — Vista consolidada del proyecto, hitos e historial de auditoría.
 */

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { MainLayout } from '@/SGPI-CFU/components/layout';
import type { Proyecto } from '../_data/types';
import { getProyectoById, completarHito, verificarHitoConCybertesis } from '../_data/service';

// ─────────────────────────────────────────────────────────────────────────────
// Íconos SVG
// ─────────────────────────────────────────────────────────────────────────────

const BackIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);

const GroupIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
  </svg>
);

const DocumentIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>
);

const ScannerIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/>
    <line x1="7" y1="12" x2="17" y2="12"/>
  </svg>
);

const InfoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
  </svg>
);

const UserIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);

const ReceiptIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// Componente Principal
// ─────────────────────────────────────────────────────────────────────────────

export default function ExpedienteDigitalPage() {
  const router = useRouter();
  const { id } = useParams() as { id: string };

  const [proyecto, setProyecto] = useState<Proyecto | null>(null);
  const [cargando, setCargando] = useState(true);
  const [completandoId, setCompletandoId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('created') === 'true') {
        setToastMsg("Proyecto creado exitosamente.");
        const timer = setTimeout(() => setToastMsg(null), 3000);
        return () => clearTimeout(timer);
      } else if (urlParams.get('validated') === 'true') {
        setToastMsg("Proyecto validado exitosamente.");
        const timer = setTimeout(() => setToastMsg(null), 3000);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  // Estados del modal de Cybertesis
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedHito, setSelectedHito] = useState<any | null>(null);
  const [modalSearchQuery, setModalSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleOpenVerificationModal = (hito: any) => {
    setSelectedHito(hito);
    setSearchResults([]);
    setSearchError(null);
    
    let defaultQuery = '';
    const tesista = proyecto?.miembros?.find(m => (m.rol as string) === 'Tesista vinculado' || (m.rol as string) === 'Tesista');
    if (tesista) {
      defaultQuery = tesista.nombre;
    } else {
      defaultQuery = proyecto?.title || '';
    }
    setModalSearchQuery(defaultQuery);
    setIsModalOpen(true);
    
    if (defaultQuery.trim()) {
      setSearching(true);
      import('@/SGPI-CFU/lib/api/client').then(async ({ apiClient }) => {
        try {
          const results = await apiClient.get<any[]>(`/theses/external?q=${encodeURIComponent(defaultQuery.trim())}`);
          setSearchResults(results || []);
          if (!results || results.length === 0) {
            setSearchError('No se encontró coincidencia automática en Cybertesis. Intente buscar manualmente.');
          }
        } catch (err: any) {
          console.error(err);
          setSearchError('Error al buscar coincidencia automática en Cybertesis.');
        } finally {
          setSearching(false);
        }
      });
    }
  };

  const handleSearchCybertesis = async () => {
    if (!modalSearchQuery.trim()) return;
    setSearching(true);
    setSearchError(null);
    try {
      const { apiClient } = await import('@/SGPI-CFU/lib/api/client');
      const results = await apiClient.get<any[]>(`/theses/external?q=${encodeURIComponent(modalSearchQuery.trim())}`);
      setSearchResults(results || []);
      if (!results || results.length === 0) {
        setSearchError('No se encontraron tesis para el término especificado.');
      }
    } catch (err: any) {
      console.error('Error buscando en Cybertesis:', err);
      setSearchError(err.message || 'Error al conectar con el servidor de Cybertesis.');
    } finally {
      setSearching(false);
    }
  };

  const handleConfirmVerify = async (thesis: any) => {
    if (!proyecto || !selectedHito) return;
    setIsModalOpen(false);
    setCompletandoId(selectedHito.id);
    try {
      const payload = {
        thesis_url: thesis.url_cybertesis,
        titulo_tesis: thesis.titulo_tesis,
        autor_texto: thesis.autor_estudiante_texto,
        anio_publicacion: thesis.anio_publicacion,
        resumen: thesis.resumen_abstract
      };
      const proyActualizado = await verificarHitoConCybertesis(proyecto.id, selectedHito.id, payload);
      setProyecto(proyActualizado);
      alert('✓ Hito verificado y completado exitosamente.');
    } catch (err: any) {
      console.error('Error al verificar hito con Cybertesis:', err);
      alert(err.message || 'Ocurrió un error al verificar el hito.');
    } finally {
      setCompletandoId(null);
    }
  };

  useEffect(() => {
    async function cargar() {
      setCargando(true);
      try {
        const data = await getProyectoById(id);
        if (data) setProyecto(data);
      } catch (err) {
        console.error(err);
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, [id]);

  const handleRegistrarRecepcion = async (hitoId: string) => {
    if (!proyecto) return;
    setCompletandoId(hitoId);
    try {
      const proyActualizado = await completarHito(proyecto.id, hitoId);
      setProyecto(proyActualizado);
    } catch (err) {
      console.error('Error al registrar recepción de hito:', err);
      alert('Ocurrió un error al registrar el hito.');
    } finally {
      setCompletandoId(null);
    }
  };

  const formatearFechaHora = (fechaStr: string) => {
    try {
      const d = new Date(fechaStr);
      const opcionesFecha = { day: '2-digit', month: 'short', year: 'numeric' } as const;
      const opcionesHora = { hour: '2-digit', minute: '2-digit', hour12: false } as const;
      
      const fecha = d.toLocaleDateString('es-PE', opcionesFecha);
      const hora = d.toLocaleTimeString('es-PE', opcionesHora);
      
      // Capitalizar mes (ej. "may" -> "May")
      const fechaParts = fecha.split(' ');
      if (fechaParts[1]) {
        fechaParts[1] = fechaParts[1].charAt(0).toUpperCase() + fechaParts[1].slice(1);
      }
      
      return `${fechaParts.join(' ')}, ${hora}`;
    } catch {
      return fechaStr;
    }
  };

  if (cargando) {
    return (
      <MainLayout title="Expediente Digital de Proyecto" subtitle="">
        <div className="flex flex-col gap-4 animate-pulse">
          <div className="h-8 bg-slate-100 rounded w-1/3"/>
          <div className="h-64 bg-slate-100 rounded"/>
        </div>
      </MainLayout>
    );
  }

  if (!proyecto) {
    return (
      <MainLayout title="Expediente Digital de Proyecto" subtitle="">
        <div className="bg-red-50 text-red-800 p-6 rounded border border-red-200">
          <p className="font-sans font-bold">Proyecto no encontrado.</p>
          <button onClick={() => router.push('/proyectos')} className="mt-3 text-[13px] font-bold text-red-700 underline cursor-pointer">
            Volver a la bandeja
          </button>
        </div>
      </MainLayout>
    );
  }

  const isEnEjecucion = proyecto.status === 'en_ejecucion';
  const isConcluido = proyecto.status === 'concluido';
  const isPendiente = proyecto.status === 'pendiente_validar';

  return (
    <MainLayout
      title="Expediente Digital de Proyecto"
      subtitle="Vista oficial consolidada e historial inmutable para auditorías."
    >
      <div className="flex flex-col gap-5">

        {/* ── Cabecera de Expediente ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2">
          <div>
            <h1 className="font-heading font-semibold text-h1 text-on-surface leading-[38px]">
              Expediente Digital de Proyecto
            </h1>
            <p className="mt-1 font-sans text-body-md text-on-surface-variant">
              Vista oficial consolidada e historial inmutable para auditorías.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => router.push('/proyectos')}
              className="flex items-center gap-1.5 px-4 py-2 rounded font-sans font-bold text-[13px] text-on-surface border border-outline-variant hover:bg-slate-50 transition-colors cursor-pointer"
              aria-label="Volver a la Bandeja"
            >
              <BackIcon />
              Volver a la Bandeja
            </button>
          </div>
        </div>

        {/* ── Layout en Dos Columnas ── */}
        <div className="flex flex-col lg:flex-row gap-5">

          {/* Columna Izquierda (Ancha: Detalle e Historial) */}
          <div className="flex-1 flex flex-col gap-5">

            {/* Tarjeta de Información General */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded p-6 shadow-level-1 relative">
              {/* Badge de Estado en la parte superior derecha de la tarjeta */}
              <div className="absolute top-6 right-6">
                <span className={`
                  inline-flex items-center gap-1 px-3 py-1 rounded font-sans font-bold text-[11px] uppercase tracking-wider
                  ${isEnEjecucion ? 'bg-[#dcfce7] text-[#15803d]' : isConcluido ? 'bg-[#f1f5f9] text-[#334155]' : 'bg-[#fef3c7] text-[#b45309]'}
                `}>
                  <span className={`w-2 h-2 rounded-full ${isEnEjecucion ? 'bg-[#16a34a]' : isConcluido ? 'bg-[#64748b]' : 'bg-[#d97706]'}`} />
                  {isEnEjecucion ? 'En Ejecución' : isConcluido ? 'Concluido' : 'Pendiente Validar'}
                </span>
              </div>

              {/* Contenido Principal */}
              <span className="block font-sans font-bold text-[11px] text-on-surface-variant tracking-wider uppercase mb-1">
                Cód. RAIS: {proyecto.code}
              </span>
              <h2 className="font-heading font-semibold text-[22px] leading-7 text-on-surface max-w-[80%] mb-5">
                {proyecto.title}
              </h2>

              {/* Grid de Metadatos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-6 border-t border-outline-variant pt-5">
                <div>
                  <span className="block font-sans font-bold text-[9px] text-[#64748b] tracking-wider uppercase mb-0.5">
                    RESP. PRINCIPAL
                  </span>
                  <span className="flex items-center gap-1.5 font-sans font-semibold text-[13px] text-on-surface">
                    <span className="text-[#64748b]"><UserIcon /></span>
                    {proyecto.responsablePrincipal}
                  </span>
                </div>

                <div>
                  <span className="block font-sans font-bold text-[9px] text-[#64748b] tracking-wider uppercase mb-0.5">
                    GRUPO VINCULADO
                  </span>
                  <span className="flex items-center gap-1.5 font-sans font-semibold text-[13px] text-on-surface">
                    <span className="text-[#64748b]"><GroupIcon /></span>
                    {proyecto.grupoVinculado}
                  </span>
                </div>

                <div>
                  <span className="block font-sans font-bold text-[9px] text-[#64748b] tracking-wider uppercase mb-0.5">
                    PROG. / CONVOCATORIA
                  </span>
                  <span className="font-sans font-semibold text-[13px] text-on-surface">
                    {proyecto.tipo} · {proyecto.convocatoria}
                  </span>
                </div>

                <div>
                  <span className="block font-sans font-bold text-[9px] text-[#64748b] tracking-wider uppercase mb-0.5">
                    MONTO Y RESPALDO LEGAL
                  </span>
                  <span className="flex items-center gap-1.5 font-sans font-semibold text-[13px] text-[#16a34a]">
                    <span>S/. {proyecto.montoFinanciado.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                    <span className="text-[#64748b] font-normal font-sans border-l border-outline-variant pl-1.5 flex items-center gap-1">
                      <DocumentIcon />
                      {proyecto.resolucion}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* Tarjeta Historial */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded p-6 shadow-level-1">
              <h3 className="font-sans font-bold text-[11px] text-on-surface-variant tracking-wider uppercase mb-6">
                HISTORIAL DE ESTADOS Y AUDITORÍA
              </h3>

              {/* Timeline */}
              <div className="relative pl-6 border-l-2 border-slate-200 flex flex-col gap-6 ml-2.5">
                {proyecto.historial.map((hist, i) => (
                  <div key={hist.id} className="relative">
                    {/* Puntito en la línea vertical */}
                    <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 border-white bg-slate-400 z-10 flex items-center justify-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-white" />
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="font-sans text-[11px] text-[#64748b]">
                        {formatearFechaHora(hist.fecha)} - <strong className="text-on-surface font-semibold">{hist.usuario}</strong>
                      </span>
                      <span className="font-sans font-bold text-[13px] text-on-surface">
                        {hist.cambio}
                      </span>
                      {hist.observacion && (
                        <div className="mt-2 p-3.5 bg-slate-50 border border-slate-100 rounded-lg text-sans text-[12px] text-on-surface-variant font-medium leading-relaxed italic">
                          &ldquo;{hist.observacion}&rdquo;
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Columna Derecha (Estrecha: Hitos e Info) */}
          <div className="w-full lg:w-[320px] shrink-0 flex flex-col gap-5">

            {/* Tarjeta Hitos */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded p-5 shadow-level-1">
              <h3 className="font-sans font-bold text-[11px] text-on-surface-variant tracking-wider uppercase mb-4 flex items-center gap-1.5">
                <ReceiptIcon />
                SEGUIMIENTO DE HITOS
              </h3>

              {/* Lista de Hitos */}
              <div className="flex flex-col gap-5">
                {proyecto.hitos.map((hito) => {
                  const isPendienteHito = hito.estado === 'pendiente';
                  const isCompletadoHito = hito.estado === 'completado';
                  const isBloqueadoHito = hito.estado === 'bloqueado';

                  let statusText = 'Pendiente';
                  let badgeBg = 'bg-[#fef3c7] text-[#92400e]';
                  let progressBg = 'bg-[#e2e8f0]';
                  let progressFill = 'bg-[#d97706]';
                  let progressValue = hito.porcentaje;

                  if (isCompletadoHito) {
                    statusText = 'COMPLETADO';
                    badgeBg = 'bg-[#dcfce7] text-[#166534]';
                    progressFill = 'bg-[#16a34a]';
                    progressValue = 100;
                  } else if (isBloqueadoHito) {
                    statusText = 'BLOQUEADO';
                    badgeBg = 'bg-[#f1f5f9] text-[#64748b]';
                    progressValue = 0;
                  }

                  return (
                    <div key={hito.id} className="border-b border-outline-variant last:border-b-0 pb-4 last:pb-0 flex flex-col gap-3">
                      
                      {/* Cabecera del Hito */}
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex flex-col">
                          <span className="font-sans font-semibold text-[13px] text-on-surface leading-tight">
                            {hito.nombre}
                          </span>
                          {hito.fechaVencimiento && (
                            <span className="font-sans text-[11px] text-[#64748b] mt-0.5">
                              Vence: {new Date(hito.fechaVencimiento).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                          )}
                        </div>
                        <span className={`px-1.5 py-0.5 rounded font-sans font-bold text-[9px] uppercase tracking-wider ${badgeBg}`}>
                          {statusText}
                        </span>
                      </div>

                      {/* Barra de Progreso */}
                      <div className="w-full h-1.5 bg-[#e2e8f0] rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${progressFill}`}
                          style={{ width: `${progressValue}%` }}
                        />
                      </div>

                       {/* Acción del Hito */}
                       {isPendienteHito && (
                         <div className="flex flex-col gap-2">
                           <button
                             type="button"
                             disabled={completandoId === hito.id}
                             onClick={() => handleRegistrarRecepcion(hito.id)}
                             className="flex items-center justify-center gap-1.5 w-full border border-[#001631] text-[#001631] hover:bg-[#001631] hover:text-white font-sans font-bold text-[12px] py-1.5 rounded transition-all cursor-pointer disabled:opacity-40"
                           >
                             <ReceiptIcon />
                             {completandoId === hito.id ? 'Registrando...' : 'Registrar Recepción'}
                           </button>
                           <button
                             type="button"
                             onClick={() => handleOpenVerificationModal(hito)}
                             className="flex items-center justify-center gap-1.5 w-full border border-primary text-primary hover:bg-[#001631] hover:text-white font-sans font-bold text-[12px] py-1.5 rounded transition-all cursor-pointer"
                           >
                             <ScannerIcon />
                             Autoverificar con Cybertesis
                           </button>
                         </div>
                       )}

                      {/* Texto si está bloqueado */}
                      {isBloqueadoHito && (
                        <span className="font-sans text-[11px] text-[#94a3b8] italic">
                          {hito.id === 'hito-2' || hito.id.endsWith('-2')
                            ? 'Requiere informe de 12 meses.'
                            : 'Hito no disponible actualmente.'}
                        </span>
                      )}

                    </div>
                  );
                })}
              </div>

              {/* Caja informativa de reglas de negocio */}
              <div className="mt-5 p-3.5 bg-blue-50/70 border border-blue-100 rounded-lg flex gap-2 items-start text-blue-800 text-[11px] leading-normal font-sans">
                <span className="text-blue-500 shrink-0 mt-0.5">
                  <InfoIcon />
                </span>
                <p className="font-medium">
                  El estado del proyecto no podrá cambiar a &ldquo;Concluido&rdquo; hasta que se registren los productos entregables (Regla RQ06).
                </p>
              </div>

            </div>

          </div>

        </div>

      </div>

      {/* Modal de Verificación con Cybertesis */}
      {isModalOpen && selectedHito && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            
            {/* Header */}
            <div className="px-6 py-4 bg-[#001631] text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <ScannerIcon />
                <h2 id="modal-title" className="font-heading font-semibold text-[16px] tracking-wide uppercase">
                  Verificar con Cybertesis
                </h2>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-white/80 hover:text-white text-[20px] font-bold cursor-pointer"
                aria-label="Cerrar modal"
              >
                &times;
              </button>
            </div>

            {/* Content */}
            <div className="p-6 flex-1 overflow-y-auto flex flex-col gap-4">
              <div className="bg-slate-50 border border-slate-100 rounded-lg p-3.5">
                <span className="block font-sans font-bold text-[9px] text-[#64748b] tracking-wider uppercase mb-0.5">
                  HITO A VERIFICAR
                </span>
                <span className="font-sans font-bold text-[14px] text-on-surface">
                  {selectedHito.nombre}
                </span>
                {selectedHito.fechaVencimiento && (
                  <span className="block font-sans text-[11px] text-[#64748b] mt-0.5">
                    Vence: {new Date(selectedHito.fechaVencimiento).toLocaleDateString('es-PE')}
                  </span>
                )}
              </div>

              {/* Search controls */}
              <div className="flex flex-col gap-2">
                <label htmlFor="cybertesis-search" className="block font-sans font-bold text-[10px] text-on-surface-variant uppercase tracking-widest">
                  TÉRMINO DE BÚSQUEDA (AUTOR, ASESOR O TÍTULO)
                </label>
                <div className="flex gap-2">
                  <input
                    id="cybertesis-search"
                    type="text"
                    value={modalSearchQuery}
                    onChange={(e) => setModalSearchQuery(e.target.value)}
                    placeholder="Nombre del tesista, asesor o título del proyecto..."
                    className="flex-1 px-3 py-2 font-sans text-[13px] text-on-surface bg-surface-container-lowest border border-outline-variant rounded outline-none focus:ring-2 focus:ring-[#a8c8fa]"
                  />
                  <button
                    type="button"
                    onClick={handleSearchCybertesis}
                    disabled={searching}
                    className="bg-[#001631] text-white hover:bg-[#002b54] font-sans font-bold text-[13px] px-4 py-2 rounded transition-colors disabled:opacity-40 cursor-pointer whitespace-nowrap"
                  >
                    {searching ? 'Buscando...' : 'Buscar'}
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {searchError && (
                <div className="bg-red-50 text-red-800 border border-red-100 rounded-lg p-3 text-[12px] font-sans flex gap-2">
                  <span className="text-red-500 font-bold">⚠️</span>
                  <p>{searchError}</p>
                </div>
              )}

              {/* Search Results */}
              <div className="flex-1 flex flex-col gap-3">
                <span className="block font-sans font-bold text-[10px] text-on-surface-variant uppercase tracking-widest">
                  {searching ? 'BUSCANDO REGISTROS...' : searchResults.length > 0 ? `TESIS ENCONTRADAS (${searchResults.length})` : 'SIN RESULTADOS'}
                </span>

                {searching ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <div className="w-8 h-8 border-4 border-slate-200 border-t-[#001631] rounded-full animate-spin" />
                    <span className="font-sans text-[12px] text-[#64748b] font-medium">
                      Consultando repositorio DSpace 7 de Cybertesis...
                    </span>
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="flex flex-col gap-3 max-h-[250px] overflow-y-auto border border-outline-variant rounded divide-y divide-outline-variant">
                    {searchResults.map((thesis) => (
                      <div key={thesis.url_cybertesis} className="p-4 flex flex-col gap-2 hover:bg-slate-50 transition-colors">
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="font-sans font-bold text-[13px] text-on-surface leading-tight">
                            {thesis.titulo_tesis}
                          </h4>
                          <span className="px-1.5 py-0.5 rounded font-sans font-bold text-[9px] uppercase tracking-wider bg-[#dcfce7] text-[#166534] whitespace-nowrap">
                            {thesis.nivel_grado}
                          </span>
                        </div>
                        <div className="font-sans text-[11px] text-[#475569]">
                          <strong>Autor:</strong> {thesis.autor_estudiante_texto} | <strong>Año:</strong> {thesis.anio_publicacion}
                        </div>
                        <div className="flex justify-between items-center mt-1">
                          <a 
                            href={thesis.url_cybertesis} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-[11px] text-[#0066cc] hover:underline font-semibold"
                          >
                            Ver Repositorio &rarr;
                          </a>
                          <button
                            type="button"
                            onClick={() => handleConfirmVerify(thesis)}
                            className="bg-[#16a34a] hover:bg-[#15803d] text-white font-sans font-bold text-[11px] px-3 py-1.5 rounded shadow transition-colors cursor-pointer"
                          >
                            Vincular y Completar Hito
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 border border-dashed border-slate-300 rounded text-center p-4">
                    <span className="text-[24px]">📂</span>
                    <p className="font-sans text-[12px] text-[#64748b] mt-1.5 max-w-[300px]">
                      Realice una búsqueda escribiendo el nombre del estudiante/asesor o palabras clave de la tesis para verificar.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="border border-[#e2e8f0] font-sans text-[13px] text-[#475569] px-4 py-2 rounded hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
      {toastMsg && (
        <div className="fixed bottom-8 right-6 z-[60] flex items-center gap-3 px-5 py-3.5 rounded-lg bg-[#22c55e] text-white shadow-2xl font-sans font-semibold text-[14px]">
          <span className="w-1.5 h-1.5 rounded-full bg-white"/>
          {toastMsg}
        </div>
      )}
    </MainLayout>
  );
}
