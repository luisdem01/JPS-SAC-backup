'use client';

/**
 * @file [id]/page.tsx
 * @route /SGPI-CFPI/[id]
 * @description Expediente Digital de Proyecto — Vista consolidada del proyecto, hitos e historial de auditoría.
 */

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { MainLayout } from '@/SGPI-CFU/components/layout';
import type { Proyecto } from '../_data/types';
import { getProyectoById, completarHito } from '../_data/service';
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
          <button onClick={() => router.push('/SGPI-CFPI')} className="mt-3 text-[13px] font-bold text-red-700 underline cursor-pointer">
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
              onClick={() => router.push('/SGPI-CFPI')}
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
                          "{hist.observacion}"
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
                        <button
                          type="button"
                          disabled={completandoId === hito.id}
                          onClick={() => handleRegistrarRecepcion(hito.id)}
                          className="flex items-center justify-center gap-1.5 w-full border border-[#001631] text-[#001631] hover:bg-[#001631] hover:text-white font-sans font-bold text-[12px] py-1.5 rounded transition-all cursor-pointer disabled:opacity-40"
                        >
                          <ReceiptIcon />
                          {completandoId === hito.id ? 'Registrando...' : 'Registrar Recepción'}
                        </button>
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
                  El estado del proyecto no podrá cambiar a "Concluido" hasta que se registren los productos entregables (Regla RQ06).
                </p>
              </div>

            </div>

          </div>

        </div>

      </div>
    </MainLayout>
  );
}
