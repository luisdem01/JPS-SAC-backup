'use client';

/**
 * @file proyecto/[id]/page.tsx
 * @route /SGPI-CFB/proyecto/[id]
 * @description Pantalla de detalle de un Proyecto de Investigación.
 */

import React, { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { MainLayout }                            from '@/SGPI-CFU/components/layout';
import { getProjectById }                        from '../../_data/service';
import type { SearchProject }                    from '../../_data/types';

// ─────────────────────────────────────────────────────────────────────────────
// Íconos
// ─────────────────────────────────────────────────────────────────────────────

const BackIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);

const ChevronRightIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

const SyncIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/>
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
);

const ProjectIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
  </svg>
);

const DownloadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return `S/. ${amount.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  const months    = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${parseInt(d)} ${months[parseInt(m)-1]} ${y}`;
}

const ESTADO_STYLES: Record<string, string> = {
  'En Ejecución':  'bg-[#d1fae5] text-[#065f46] border-[#6ee7b7]',
  'En Evaluación': 'bg-[#fef3c7] text-[#92400e] border-[#fcd34d]',
  'Concluido':     'bg-[#dbeafe] text-[#1e40af] border-[#93c5fd]',
  'Suspendido':    'bg-[#fee2e2] text-[#991b1b] border-[#fca5a5]',
};

// ─────────────────────────────────────────────────────────────────────────────
// Página
// ─────────────────────────────────────────────────────────────────────────────

export default function ProyectoDetailPage() {
  const router       = useRouter();
  const params       = useParams();
  const searchParams = useSearchParams();
  const query        = searchParams.get('q') ?? '';

  const [project, setProject] = useState<SearchProject | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    if (!id) { setNotFound(true); return; }
    // TODO: reemplazar por llamada real: fetch(`/api/v1/projects/${id}`)
    const found = getProjectById(id);
    if (found) setProject(found);
    else setNotFound(true);
  }, [params.id]);

  const handleBack = () => {
    router.push(`/SGPI-CFB${query ? `?q=${encodeURIComponent(query)}` : ''}`);
  };

  // ── 404 ─────────────────────────────────────────────────────────────────────
  if (notFound) {
    return (
      <MainLayout title="Sistema de Gestión de Proyectos de Investigación">
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="font-heading font-semibold text-h2 text-on-surface mb-2">Proyecto no encontrado</p>
          <p className="font-sans text-body-md text-on-surface-variant mb-6">
            El proyecto con el ID indicado no existe o no está disponible.
          </p>
          <button onClick={handleBack} className="font-sans text-[13px] font-medium text-[#2563eb] hover:underline">
            ← Volver a resultados
          </button>
        </div>
      </MainLayout>
    );
  }

  if (!project) {
    return (
      <MainLayout title="Sistema de Gestión de Proyectos de Investigación">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-surface-container-high rounded w-2/3"/>
          <div className="h-48 bg-surface-container-high rounded"/>
        </div>
      </MainLayout>
    );
  }

  const estadoStyle = ESTADO_STYLES[project.estado] ?? 'bg-surface-container text-on-surface-variant border-outline-variant';

  return (
    <MainLayout title="Sistema de Gestión de Proyectos de Investigación">

      {/* ── Breadcrumb + Sync info ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 font-sans text-[12px] text-on-surface-variant" aria-label="Migas de pan">
          <button
            onClick={handleBack}
            className="flex items-center gap-1 font-medium text-[#2563eb] hover:underline"
          >
            <BackIcon />Volver a resultados
          </button>
          <ChevronRightIcon />
          <span>Búsqueda</span>
          {query && <><ChevronRightIcon /><span className="text-on-surface">"{query}"</span></>}
          <ChevronRightIcon />
          <span className="text-on-surface font-medium">{project.codigo}</span>
        </nav>

        {/* Badge fuente + sync */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#eff6ff] border border-[#bfdbfe] text-[#1e40af]">
          <SyncIcon />
          <span className="font-sans text-[11px] font-semibold">
            Fuente: {project.fuente.join(' / ')}
          </span>
          <span className="font-sans text-[11px] text-[#3b82f6]">
            &nbsp;· Última sincronización: {project.ultimaSync}
          </span>
        </div>
      </div>

      {/* ── Tarjeta principal ─────────────────────────────────────────────────── */}
      <div className="bg-surface-container-lowest rounded border border-outline-variant shadow-level-1 overflow-hidden">
        {/* Borde de color superior */}
        <div className="h-1 bg-[#2563eb]" />

        <div className="p-6">
          {/* Código + Estado + Ícono */}
          <div className="flex items-center gap-3 mb-3">
            <span className="w-10 h-10 rounded bg-[#dbeafe] text-[#1e40af] flex items-center justify-center flex-shrink-0">
              <ProjectIcon />
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-sans font-bold text-[12px] text-on-surface-variant">{project.codigo}</span>
              <span className={`font-sans font-bold text-[11px] uppercase tracking-wide px-2.5 py-0.5 rounded border ${estadoStyle}`}>
                {project.estado}
              </span>
            </div>
          </div>

          {/* Título */}
          <h1 className="font-heading font-bold text-[22px] text-on-surface leading-[30px] mb-1">
            {project.titulo}
          </h1>
          <p className="font-sans text-[13px] text-on-surface-variant mb-6">
            Proyecto de {project.tipo} &bull; Convocatoria {project.convocatoria}
          </p>

          {/* Cuerpo de dos columnas */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">

            {/* ── Columna izquierda ─────────────────────────────────────────────── */}
            <div className="flex flex-col gap-5">
              {/* Resumen */}
              <div>
                <p className="font-sans font-bold text-[10px] text-on-surface-variant uppercase tracking-widest mb-2">
                  Resumen Ejecutivo
                </p>
                <p className="font-sans text-[13px] text-on-surface leading-[20px]">
                  {project.resumen}
                </p>
              </div>

              {/* Responsable + Grupo */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="font-sans font-bold text-[10px] text-on-surface-variant uppercase tracking-widest mb-2">
                    Responsable Principal
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-[#001631] text-white font-sans font-bold text-[11px] flex items-center justify-center flex-shrink-0">
                      {project.responsable.initials}
                    </span>
                    <span className="font-sans font-semibold text-[13px] text-on-surface">
                      {project.responsable.nombre}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="font-sans font-bold text-[10px] text-on-surface-variant uppercase tracking-widest mb-2">
                    Grupo de Investigación
                  </p>
                  <div className="flex items-center gap-1.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                      <circle cx="9" cy="7" r="4"/>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                    <span className="font-sans text-[13px] text-on-surface">{project.grupo}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Columna derecha ───────────────────────────────────────────────── */}
            <div className="flex flex-col gap-4">
              {/* Monto financiado */}
              <div className="p-4 rounded bg-surface-container-low border border-outline-variant">
                <p className="font-sans font-bold text-[10px] text-on-surface-variant uppercase tracking-widest mb-1">
                  Monto Financiado
                </p>
                <p className="font-heading font-bold text-[24px] text-[#1d4ed8] leading-tight">
                  {formatCurrency(project.monto)}
                </p>
              </div>

              {/* Respaldo legal */}
              <div>
                <p className="font-sans font-bold text-[10px] text-on-surface-variant uppercase tracking-widest mb-1">
                  Respaldo Legal
                </p>
                <div className="flex items-center gap-1.5">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                  <span className="font-sans text-[13px] text-on-surface font-medium">{project.respaldoLegal}</span>
                </div>
              </div>

              {/* Cronograma */}
              <div>
                <p className="font-sans font-bold text-[10px] text-on-surface-variant uppercase tracking-widest mb-1">
                  Cronograma Planificado
                </p>
                <p className="font-sans text-[13px] text-on-surface">
                  {formatDate(project.inicio)} — {formatDate(project.fin)}
                </p>
              </div>

              {/* Botones */}
              <div className="flex flex-col gap-2 mt-2">
                <button className="
                  w-full flex items-center justify-center gap-2
                  px-4 py-2 rounded
                  font-sans font-semibold text-[13px]
                  text-[#1d4ed8] border border-[#93c5fd] bg-[#eff6ff]
                  hover:bg-[#dbeafe] transition-colors duration-100
                " aria-label="Exportar ficha del proyecto">
                  <DownloadIcon /> Exportar Ficha
                </button>
                <button className="
                  w-full flex items-center justify-center gap-2
                  px-4 py-2 rounded
                  font-sans font-semibold text-[13px]
                  bg-[#001631] text-white
                  hover:bg-[#002b54] transition-colors duration-100
                " aria-label="Editar proyecto en gestión">
                  <EditIcon /> Editar Proyecto (Gestión)
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>

    </MainLayout>
  );
}
