'use client';

/**
 * @file publicacion/[id]/page.tsx
 * @route /SGPI-CFB/publicacion/[id]
 * @description Pantalla de detalle de una Publicación / Tesis.
 */

import React, { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { MainLayout }                            from '@/SGPI-CFU/components/layout';
import { getPublicacionById }                    from '../../_data/service';
import type { SearchPublicacion }                from '../../_data/types';

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
const ExternalLinkIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
    <polyline points="15 3 21 3 21 9"/>
    <line x1="10" y1="14" x2="21" y2="3"/>
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

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const TIPO_COLORS: Record<string, { badge: string; border: string; accent: string }> = {
  'Artículo ISI':    { badge: 'bg-[#dbeafe] text-[#1e40af] border-[#93c5fd]', border: 'bg-[#2563eb]', accent: 'text-[#1d4ed8]' },
  'Artículo Scopus': { badge: 'bg-[#fdf4ff] text-[#7e22ce] border-[#e9d5ff]', border: 'bg-[#9333ea]', accent: 'text-[#7e22ce]' },
  'Tesis Doctoral':  { badge: 'bg-[#fef3c7] text-[#92400e] border-[#fcd34d]', border: 'bg-[#d97706]', accent: 'text-[#92400e]' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Página
// ─────────────────────────────────────────────────────────────────────────────

export default function PublicacionDetailPage() {
  const router       = useRouter();
  const params       = useParams();
  const searchParams = useSearchParams();
  const query        = searchParams.get('q') ?? '';

  const [pub,      setPub]      = useState<SearchPublicacion | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    if (!id) { setNotFound(true); return; }
    // TODO: reemplazar por GET /api/v1/publications/{id}
    const found = getPublicacionById(id);
    if (found) setPub(found);
    else setNotFound(true);
  }, [params.id]);

  const handleBack = () =>
    router.push(`/SGPI-CFB${query ? `?q=${encodeURIComponent(query)}` : ''}`);

  if (notFound) {
    return (
      <MainLayout title="Sistema de Gestión de Proyectos de Investigación">
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="font-heading font-semibold text-h2 text-on-surface mb-2">Publicación no encontrada</p>
          <button onClick={handleBack} className="font-sans text-[13px] font-medium text-[#2563eb] hover:underline">
            ← Volver a resultados
          </button>
        </div>
      </MainLayout>
    );
  }

  if (!pub) {
    return (
      <MainLayout title="Sistema de Gestión de Proyectos de Investigación">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-surface-container-high rounded w-2/3"/>
          <div className="h-48 bg-surface-container-high rounded"/>
        </div>
      </MainLayout>
    );
  }

  const colors = TIPO_COLORS[pub.tipo] ?? TIPO_COLORS['Artículo ISI'];

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
          {query && <><ChevronRightIcon /><span className="text-on-surface">"{query}"</span></>}
          <ChevronRightIcon />
          <span className="text-on-surface font-medium truncate max-w-[200px]">{pub.id}</span>
        </nav>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#fdf4ff] border border-[#e9d5ff] text-[#7e22ce]">
          <SyncIcon />
          <span className="font-sans text-[11px] font-semibold">Fuente: {pub.fuente}</span>
          <span className="font-sans text-[11px]">&nbsp;· Últ. act: {pub.ultimaAct}</span>
        </div>
      </div>

      {/* ── Tarjeta principal ─────────────────────────────────────────────────── */}
      <div className="bg-surface-container-lowest rounded border border-outline-variant shadow-level-1 overflow-hidden">
        <div className={`h-1 ${colors.border}`} />

        <div className="p-6">
          {/* Tipo + Cuartil */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className={`font-sans font-bold text-[11px] uppercase tracking-wide px-2.5 py-0.5 rounded border ${colors.badge}`}>
              {pub.tipo}
            </span>
            {pub.quartil && (
              <span className={`font-sans font-bold text-[11px] uppercase tracking-wide px-2.5 py-0.5 rounded border ${colors.badge}`}>
                {pub.quartil}
              </span>
            )}
            <span className="font-sans text-[11px] text-on-surface-variant">{pub.anio}</span>
          </div>

          {/* Título */}
          <h1 className={`font-heading font-bold text-[20px] leading-[28px] mb-2 ${colors.accent}`}>
            {pub.titulo}
          </h1>

          {/* Revista */}
          <p className="font-sans text-[13px] text-on-surface-variant italic mb-5">
            {pub.revista}
          </p>

          {/* Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-6">

            {/* ── Izquierda ────────────────────────────────────────────────────── */}
            <div className="flex flex-col gap-5">
              {/* Autores */}
              <div>
                <p className="font-sans font-bold text-[10px] text-on-surface-variant uppercase tracking-widest mb-2">
                  Autores
                </p>
                <div className="flex flex-wrap gap-2">
                  {pub.autores.map((autor) => (
                    <span key={autor} className="inline-flex items-center gap-1.5 font-sans text-[13px] px-3 py-1 rounded-full bg-surface-container border border-outline-variant text-on-surface">
                      {autor}
                    </span>
                  ))}
                </div>
              </div>

              {/* Resumen */}
              {pub.resumen && (
                <div>
                  <p className="font-sans font-bold text-[10px] text-on-surface-variant uppercase tracking-widest mb-2">
                    Resumen
                  </p>
                  <p className="font-sans text-[13px] text-on-surface leading-[20px]">
                    {pub.resumen}
                  </p>
                </div>
              )}
            </div>

            {/* ── Derecha ───────────────────────────────────────────────────────── */}
            <div className="flex flex-col gap-4">
              {/* DOI */}
              {pub.doi && (
                <div className="p-4 rounded bg-surface-container-low border border-outline-variant">
                  <p className="font-sans font-bold text-[10px] text-on-surface-variant uppercase tracking-widest mb-1">
                    DOI
                  </p>
                  <a
                    href={`https://doi.org/${pub.doi}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-sans text-[12px] text-[#2563eb] hover:underline break-all"
                  >
                    {pub.doi} <ExternalLinkIcon />
                  </a>
                </div>
              )}

              {/* Fuente */}
              <div>
                <p className="font-sans font-bold text-[10px] text-on-surface-variant uppercase tracking-widest mb-2">
                  Base de Datos
                </p>
                <span className={`font-sans font-medium text-[12px] px-2.5 py-1 rounded border ${colors.badge}`}>
                  {pub.fuente}
                </span>
              </div>

              {/* Año */}
              <div>
                <p className="font-sans font-bold text-[10px] text-on-surface-variant uppercase tracking-widest mb-1">
                  Año de Publicación
                </p>
                <p className="font-heading font-bold text-[28px] text-on-surface">{pub.anio}</p>
              </div>

              {/* Botones */}
              <div className="flex flex-col gap-2 mt-1">
                {pub.doi && (
                  <a
                    href={`https://doi.org/${pub.doi}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="
                      w-full flex items-center justify-center gap-2
                      px-4 py-2 rounded
                      font-sans font-semibold text-[13px]
                      text-[#2563eb] border border-[#93c5fd] bg-[#eff6ff]
                      hover:bg-[#dbeafe] transition-colors duration-100
                    "
                  >
                    <ExternalLinkIcon /> Ver en línea
                  </a>
                )}
                <button className="
                  w-full flex items-center justify-center gap-2
                  px-4 py-2 rounded
                  font-sans font-semibold text-[13px]
                  bg-[#001631] text-white
                  hover:bg-[#002b54] transition-colors duration-100
                " aria-label="Exportar referencia bibliográfica">
                  <DownloadIcon /> Exportar Referencia
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>

    </MainLayout>
  );
}
