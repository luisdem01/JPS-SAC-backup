'use client';

/**
 * @file investigador/[id]/page.tsx
 * @route /busqueda/investigador/[id]
 * @description Pantalla de detalle de un Investigador / Docente.
 */

import React, { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { MainLayout }                            from '@/SGPI-CFU/components/layout';
import { getInvestigadorById }                   from '../../_data/service';
import type { SearchInvestigador }               from '../../_data/types';

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
const MailIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
    <polyline points="22,6 12,13 2,6"/>
  </svg>
);
const FolderIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>
);
const BookIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
  </svg>
);
const ExportIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// Página
// ─────────────────────────────────────────────────────────────────────────────

export default function InvestigadorDetailPage() {
  const router       = useRouter();
  const params       = useParams();
  const searchParams = useSearchParams();
  const query        = searchParams.get('q') ?? '';

  const [inv, setInv]         = useState<SearchInvestigador | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    if (!id) { setNotFound(true); return; }
    
    async function loadInvestigador() {
      const found = await getInvestigadorById(id);
      if (found) setInv(found);
      else setNotFound(true);
    }
    loadInvestigador();
  }, [params.id]);

  const handleBack = () =>
    router.push(`/busqueda${query ? `?q=${encodeURIComponent(query)}` : ''}`);

  if (notFound) {
    return (
      <MainLayout title="Sistema de Gestión de Proyectos de Investigación">
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="font-heading font-semibold text-h2 text-on-surface mb-2">Investigador no encontrado</p>
          <button onClick={handleBack} className="font-sans text-[13px] font-medium text-[#2563eb] hover:underline">
            ← Volver a resultados
          </button>
        </div>
      </MainLayout>
    );
  }

  if (!inv) {
    return (
      <MainLayout title="Sistema de Gestión de Proyectos de Investigación">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-surface-container-high rounded w-2/3"/>
          <div className="h-48 bg-surface-container-high rounded"/>
        </div>
      </MainLayout>
    );
  }

  const nivelLabel = inv.nivel === 'No Clasificado' ? 'No Clasificado' : `Nivel ${inv.nivel} RENACYT`;
  const initials   = inv.nombre.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();

  return (
    <MainLayout title="Sistema de Gestión de Proyectos de Investigación">

      {/* ── Breadcrumb + Sync ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <nav className="flex items-center gap-1.5 font-sans text-[12px] text-on-surface-variant" aria-label="Migas de pan">
          <button onClick={handleBack} className="flex items-center gap-1 font-medium text-[#2563eb] hover:underline">
            <BackIcon />Volver a resultados
          </button>
          <ChevronRightIcon />
          <span>Búsqueda</span>
          {query && <><ChevronRightIcon /><span className="text-on-surface">&quot;{query}&quot;</span></>}
          <ChevronRightIcon />
          <span className="text-on-surface font-medium">{inv.nombre}</span>
        </nav>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#f0fdf4] border border-[#bbf7d0] text-[#166534]">
          <SyncIcon />
          <span className="font-sans text-[11px] font-semibold">
            Fuente: {inv.fuente.join(' / ')}
          </span>
          <span className="font-sans text-[11px]">
            &nbsp;· Sincronizado: {inv.ultimaSync}
          </span>
        </div>
      </div>

      {/* ── Tarjeta principal ─────────────────────────────────────────────────── */}
      <div className="bg-surface-container-lowest rounded border border-outline-variant shadow-level-1 overflow-hidden">
        <div className="h-1 bg-[#16a34a]" />

        <div className="p-6">
          {/* Avatar + Nombre + Cargo */}
          <div className="flex items-start gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-[#001631] text-white font-heading font-bold text-[22px] flex items-center justify-center flex-shrink-0">
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-sans font-bold text-[11px] uppercase tracking-wide px-2.5 py-0.5 rounded-full bg-[#f0fdf4] text-[#166534] border border-[#bbf7d0]">
                  {nivelLabel}
                </span>
                {inv.codigoRenacyt && (
                  <span className="font-sans text-[11px] text-on-surface-variant">
                    Cód: {inv.codigoRenacyt}
                  </span>
                )}
              </div>
              <h1 className="font-heading font-bold text-[22px] text-on-surface leading-[28px] mb-0.5">
                {inv.nombre}
              </h1>
              <p className="font-sans text-[13px] text-on-surface-variant">{inv.cargo}</p>
              {inv.facultad && (
                <p className="font-sans text-[12px] text-on-surface-variant italic mt-0.5">{inv.facultad}</p>
              )}
            </div>
          </div>

          {/* Grid de información */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-6">

            {/* ── Izquierda ────────────────────────────────────────────────────── */}
            <div className="flex flex-col gap-5">
              {/* Especialidad */}
              <div>
                <p className="font-sans font-bold text-[10px] text-on-surface-variant uppercase tracking-widest mb-1.5">
                  Área de Especialización
                </p>
                <p className="font-sans text-[14px] text-on-surface font-medium">{inv.especialidad}</p>
              </div>

              {/* Grupo */}
              <div>
                <p className="font-sans font-bold text-[10px] text-on-surface-variant uppercase tracking-widest mb-1.5">
                  Grupo de Investigación
                </p>
                <p className="font-sans text-[13px] text-on-surface">{inv.grupo}</p>
              </div>

              {/* Contacto */}
              {inv.email && (
                <div>
                  <p className="font-sans font-bold text-[10px] text-on-surface-variant uppercase tracking-widest mb-1.5">
                    Correo Institucional
                  </p>
                  <a href={`mailto:${inv.email}`}
                    className="inline-flex items-center gap-1.5 font-sans text-[13px] text-[#2563eb] hover:underline">
                    <MailIcon />{inv.email}
                  </a>
                </div>
              )}

              {/* DNI */}
              <div>
                <p className="font-sans font-bold text-[10px] text-on-surface-variant uppercase tracking-widest mb-1.5">
                  DNI
                </p>
                <p className="font-sans text-[13px] text-on-surface">{inv.dni}</p>
              </div>
            </div>

            {/* ── Derecha ───────────────────────────────────────────────────────── */}
            <div className="flex flex-col gap-4">
              {/* Estadísticas */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded bg-[#dbeafe] border border-[#93c5fd] text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <FolderIcon />
                    <p className="font-sans font-bold text-[10px] text-[#1e40af] uppercase tracking-wide">Proyectos</p>
                  </div>
                  <p className="font-heading font-bold text-[32px] text-[#1d4ed8] leading-tight">{inv.proyectosCount}</p>
                </div>
                <div className="p-4 rounded bg-[#fdf4ff] border border-[#e9d5ff] text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <BookIcon />
                    <p className="font-sans font-bold text-[10px] text-[#7e22ce] uppercase tracking-wide">Publicaciones</p>
                  </div>
                  <p className="font-heading font-bold text-[32px] text-[#7e22ce] leading-tight">{inv.publicacionesCount}</p>
                </div>
              </div>

              {/* Fuentes */}
              <div>
                <p className="font-sans font-bold text-[10px] text-on-surface-variant uppercase tracking-widest mb-2">
                  Bases de Datos
                </p>
                <div className="flex flex-wrap gap-2">
                  {inv.fuente.map((f) => (
                    <span key={f} className="font-sans font-medium text-[11px] px-2 py-0.5 rounded bg-[#f0fdf4] text-[#166534] border border-[#bbf7d0]">
                      {f}
                    </span>
                  ))}
                </div>
              </div>

              {/* Botón exportar */}
              <button className="
                w-full flex items-center justify-center gap-2
                px-4 py-2 rounded
                font-sans font-semibold text-[13px]
                text-[#166534] border border-[#6ee7b7] bg-[#f0fdf4]
                hover:bg-[#dcfce7] transition-colors duration-100
              " aria-label="Exportar perfil del investigador">
                <ExportIcon /> Exportar Perfil
              </button>
            </div>

          </div>
        </div>
      </div>

    </MainLayout>
  );
}
