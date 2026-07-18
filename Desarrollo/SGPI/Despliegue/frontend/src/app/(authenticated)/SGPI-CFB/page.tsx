'use client';

/**
 * @file page.tsx
 * @route /busqueda  (alias: /search)
 * @description Pantalla de Búsqueda Global Unificada del SGPI.
 *
 * Integra con el motor de búsqueda avanzado del backend a través de useSearch.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams }                       from 'next/navigation';
import { MainLayout }                                       from '@/SGPI-CFU/components/layout';
import { FilterBar }                                        from '@/SGPI-CFU/components/shared';
import { useSearch }                                        from '@/SGPI-CFU/lib/hooks/useSearch';
import type { SearchResult, SearchType }                     from '@/SGPI-CFU/lib/types';

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear();

// ─────────────────────────────────────────────────────────────────────────────
// Íconos
// ─────────────────────────────────────────────────────────────────────────────

const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
  </svg>
);

const FilterIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
  </svg>
);

const ChevronLeftIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);

const ChevronRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

const ChevronDownIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

// Íconos por tipo de registro
const ProjectIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
  </svg>
);

const InvestigadorIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

const PublicacionIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
  </svg>
);

const RaisIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="12" rx="10" ry="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

const SyncIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/>
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
);

const HashIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/>
    <line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// Highlight helper
// ─────────────────────────────────────────────────────────────────────────────

function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts  = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part)
          ? <mark key={i} className="bg-[#fef08a] text-[#78350f] rounded-[2px] px-0.5 not-italic">{part}</mark>
          : <span key={i}>{part}</span>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tarjeta de resultado
// ─────────────────────────────────────────────────────────────────────────────

function ResultCard({ result, query, onClick }: {
  result: SearchResult;
  query:  string;
  onClick: () => void;
}) {
  // ── Proyecto ────────────────────────────────────────────────────────────────
  if (result.type === 'projects') {
    const estadoColors: Record<string, string> = {
      'En Ejecución':  'bg-[#d1fae5] text-[#065f46]',
      'En Evaluación': 'bg-[#fef3c7] text-[#92400e]',
      'Concluido':     'bg-[#dbeafe] text-[#1e40af]',
      'Suspendido':    'bg-[#fee2e2] text-[#991b1b]',
      'Aprobado':      'bg-[#dbeafe] text-[#1e40af]',
      'Activo':        'bg-[#d1fae5] text-[#065f46]',
    };
    return (
      <button
        onClick={onClick}
        className="w-full text-left bg-white border border-[#e2e8f0] rounded hover:shadow-md transition-all duration-150 p-4 group"
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded bg-[#dbeafe] text-[#1e40af] flex items-center justify-center flex-shrink-0">
              <ProjectIcon />
            </span>
            <span className="font-sans font-bold text-[10px] uppercase tracking-widest text-[#1e40af]">
              Proyecto de Investigación
            </span>
          </div>
          {result.status && (
            <span className={`flex-shrink-0 font-sans font-bold text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full ${estadoColors[result.status] ?? 'bg-[#dbeafe] text-[#1e40af]'}`}>
              {result.status}
            </span>
          )}
        </div>

        <h3 className="font-sans font-bold text-[14px] text-[#0f172a] leading-[20px] mb-1 group-hover:text-primary transition-colors">
          <HighlightText text={result.title} query={query} />
        </h3>
        <p className="font-sans text-[12px] text-gray-600 leading-[18px] mb-3">
          <HighlightText text={result.excerpt} query={query} />
        </p>

        <div className="flex items-center gap-3 flex-wrap">
          {result.source && (
            <span className="inline-flex items-center gap-1 font-sans text-[11px] font-medium text-[#1e40af] bg-[#eff6ff] border border-[#bfdbfe] px-2 py-0.5 rounded">
              <RaisIcon />{result.source}
            </span>
          )}
          {result.date && (
            <span className="inline-flex items-center gap-1 font-sans text-[11px] text-gray-500">
              <SyncIcon />Fecha: {result.date}
            </span>
          )}
          <span className="inline-flex items-center gap-1 font-sans text-[11px] text-gray-500">
            <HashIcon />Cód: {result.id}
          </span>
        </div>
      </button>
    );
  }

  // ── Investigador ─────────────────────────────────────────────────────────────
  if (result.type === 'investigators') {
    const d = result.details || {};
    const catRenacyt = d.categoria_renacyt || 'No Clasificado';
    return (
      <button
        onClick={onClick}
        className="w-full text-left bg-white border border-[#e2e8f0] rounded hover:shadow-md transition-all duration-150 p-4 group"
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded bg-[#f0fdf4] text-[#166534] flex items-center justify-center flex-shrink-0">
              <InvestigadorIcon />
            </span>
            <span className="font-sans font-bold text-[10px] uppercase tracking-widest text-[#166534]">
              Investigador
            </span>
          </div>
          <span className="flex-shrink-0 font-sans font-bold text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#f0fdf4] text-[#166534]">
            {catRenacyt}
          </span>
        </div>

        <h3 className="font-sans font-bold text-[15px] text-[#0f172a] leading-[22px] mb-1 group-hover:text-primary transition-colors">
          <HighlightText text={result.title} query={query} />
        </h3>
        <p className="font-sans text-[12px] text-gray-600 leading-[18px] mb-3">
          <HighlightText text={result.excerpt} query={query} />
        </p>

        <div className="flex items-center gap-3 flex-wrap">
          {result.source && (
            <span className="inline-flex items-center gap-1 font-sans text-[11px] font-medium text-[#166534] bg-[#f0fdf4] border border-[#bbf7d0] px-2 py-0.5 rounded">
              <RaisIcon />{result.source}
            </span>
          )}
          {result.date && (
            <span className="inline-flex items-center gap-1 font-sans text-[11px] text-gray-500">
              <SyncIcon />Sincronizado: {result.date}
            </span>
          )}
          <span className="inline-flex items-center gap-1 font-sans text-[11px] text-gray-500">
            <HashIcon />DNI: {result.id}
          </span>
        </div>
      </button>
    );
  }

  // ── Publicación ──────────────────────────────────────────────────────────────
  if (result.type === 'publications') {
    const d = result.details || {};
    return (
      <button
        onClick={onClick}
        className="w-full text-left bg-white border border-[#e2e8f0] rounded hover:shadow-md transition-all duration-150 p-4 group"
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded bg-[#fdf4ff] text-[#7e22ce] flex items-center justify-center flex-shrink-0">
              <PublicacionIcon />
            </span>
            <span className="font-sans font-bold text-[10px] uppercase tracking-widest text-[#7e22ce]">
              {d.tipo_publicacion || 'Publicación'}
            </span>
          </div>
          {d.cuartil_impacto && (
            <span className="flex-shrink-0 font-sans font-bold text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#fdf4ff] text-[#7e22ce]">
              {d.cuartil_impacto}
            </span>
          )}
        </div>

        <h3 className="font-sans font-bold text-[14px] text-[#7e22ce] leading-[20px] mb-1 group-hover:opacity-80 transition-colors">
          <HighlightText text={result.title} query={query} />
        </h3>
        <p className="font-sans text-[12px] text-gray-600 leading-[18px] mb-3">
          <HighlightText text={result.excerpt} query={query} />
        </p>

        <div className="flex items-center gap-3 flex-wrap">
          {result.source && (
            <span className="inline-flex items-center gap-1 font-sans text-[11px] font-medium text-[#7e22ce] bg-[#fdf4ff] border border-[#e9d5ff] px-2 py-0.5 rounded">
              <RaisIcon />{result.source}
            </span>
          )}
          {result.date && (
            <span className="inline-flex items-center gap-1 font-sans text-[11px] text-gray-500">
              <SyncIcon />Publicado: {result.date}
            </span>
          )}
          {d.doi_codigo && (
            <span className="inline-flex items-center gap-1 font-sans text-[11px] text-gray-500">
              <HashIcon />DOI: {d.doi_codigo}
            </span>
          )}
        </div>
      </button>
    );
  }

  // ── Grupo ──────────────────────────────────────────────────────────────────
  if (result.type === 'groups') {
    const d = result.details || {};
    return (
      <button
        onClick={onClick}
        className="w-full text-left bg-white border border-[#e2e8f0] rounded hover:shadow-md transition-all duration-150 p-4 group"
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded bg-[#fff7ed] text-[#c2410c] flex items-center justify-center flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </span>
            <span className="font-sans font-bold text-[10px] uppercase tracking-widest text-[#c2410c]">
              Grupo de Investigación
            </span>
          </div>
          {result.status && (
            <span className="flex-shrink-0 font-sans font-bold text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#fff7ed] text-[#c2410c]">
              {result.status}
            </span>
          )}
        </div>

        <h3 className="font-sans font-bold text-[14px] text-[#0f172a] leading-[20px] mb-1 group-hover:text-primary transition-colors">
          <HighlightText text={result.title} query={query} />
        </h3>
        <p className="font-sans text-[12px] text-gray-600 leading-[18px] mb-3">
          <HighlightText text={result.excerpt} query={query} />
        </p>

        <div className="flex items-center gap-3 flex-wrap">
          {result.source && (
            <span className="inline-flex items-center gap-1 font-sans text-[11px] font-medium text-[#c2410c] bg-[#fff7ed] border border-[#ffedd5] px-2 py-0.5 rounded">
              <RaisIcon />{result.source}
            </span>
          )}
          {result.date && (
            <span className="inline-flex items-center gap-1 font-sans text-[11px] text-gray-500">
              <SyncIcon />Creado: {result.date}
            </span>
          )}
          <span className="inline-flex items-center gap-1 font-sans text-[11px] text-gray-500">
            <HashIcon />Código: {result.id}
          </span>
        </div>
      </button>
    );
  }

  // ── Tesis ──────────────────────────────────────────────────────────────────
  if (result.type === 'tesis') {
    const d = result.details || {};
    return (
      <button
        onClick={onClick}
        className="w-full text-left bg-white border border-[#e2e8f0] rounded hover:shadow-md transition-all duration-150 p-4 group"
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded bg-[#ecfeff] text-[#0891b2] flex items-center justify-center flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
              </svg>
            </span>
            <span className="font-sans font-bold text-[10px] uppercase tracking-widest text-[#0891b2]">
              Tesis UNMSM
            </span>
          </div>
        </div>

        <h3 className="font-sans font-bold text-[14px] text-[#0891b2] leading-[20px] mb-1 group-hover:opacity-80 transition-colors">
          <HighlightText text={result.title} query={query} />
        </h3>
        <p className="font-sans text-[12px] text-gray-600 leading-[18px] mb-3">
          <HighlightText text={result.excerpt} query={query} />
        </p>

        <div className="flex items-center gap-3 flex-wrap">
          {result.source && (
            <span className="inline-flex items-center gap-1 font-sans text-[11px] font-medium text-[#0891b2] bg-[#ecfeff] border border-[#c5f2f7] px-2 py-0.5 rounded">
              <RaisIcon />{result.source}
            </span>
          )}
          {result.date && (
            <span className="inline-flex items-center gap-1 font-sans text-[11px] text-gray-500">
              <SyncIcon />Año: {result.date.substring(0, 4)}
            </span>
          )}
        </div>
      </button>
    );
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Paginación
// ─────────────────────────────────────────────────────────────────────────────

function Pagination({ page, totalPages, onPage }: {
  page: number; totalPages: number; onPage: (p: number) => void;
}) {
  if (totalPages <= 1) return null;

  const pages: (number | '...')[] = [];
  if (totalPages <= 6) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }

  const btnBase = 'inline-flex items-center justify-center w-8 h-8 rounded font-sans text-[13px] transition-colors duration-100';

  return (
    <div className="flex items-center justify-center gap-1 mt-6">
      <button
        onClick={() => onPage(page - 1)} disabled={page === 1}
        className={`${btnBase} text-on-surface-variant hover:bg-surface-container disabled:opacity-30 disabled:cursor-not-allowed`}
        aria-label="Página anterior"
      ><ChevronLeftIcon /></button>

      {pages.map((p, i) =>
        p === '...'
          ? <span key={`e${i}`} className="w-8 text-center text-on-surface-variant font-sans text-[13px]">…</span>
          : <button
              key={p}
              onClick={() => onPage(p as number)}
              className={`${btnBase} font-medium ${p === page ? 'bg-[#001631] text-white' : 'text-on-surface-variant hover:bg-surface-container'}`}
              aria-current={p === page ? 'page' : undefined}
            >{p}</button>
      )}

      <button
        onClick={() => onPage(page + 1)} disabled={page === totalPages}
        className={`${btnBase} text-on-surface-variant hover:bg-surface-container disabled:opacity-30 disabled:cursor-not-allowed`}
        aria-label="Página siguiente"
      ><ChevronRightIcon /></button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Checkbox personalizado
// ─────────────────────────────────────────────────────────────────────────────

function Checkbox({ id, label, checked, count, onChange }: {
  id: string; label: string; checked: boolean; count?: number; onChange: (v: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 cursor-pointer group">
      <input
        id={id} type="checkbox" checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span className={`
        flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors duration-100
        ${checked ? 'bg-[#001631] border-[#001631]' : 'bg-white border-outline-variant group-hover:border-primary'}
      `}>
        {checked && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 3.5 7 9 1"/>
          </svg>
        )}
      </span>
      <span className="font-sans text-[13px] text-on-surface">
        {label}{count !== undefined && <span className="text-on-surface-variant ml-1">({count})</span>}
      </span>
    </label>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────────────────────────────────────

function BusquedaGlobalPageContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  // ── useSearch Hook Integration ─────────────────────────────────────────────
  const {
    query,
    type,
    types,
    results,
    counts,
    isLoading,
    error,
    pagination,
    sources,
    statuses,
    yearStart,
    yearEnd,
    liveRenacyt,
    liveCybertesis,
    setQuery,
    setType,
    setTypes,
    setSources,
    setStatuses,
    setYearStart,
    setYearEnd,
    goToPage,
    clearSearch,
    triggerLiveRenacyt,
    triggerLiveCybertesis,
  } = useSearch();

  const [inputValue, setInputValue] = useState(query);

  // Sync manual input value with URL or initial query
  useEffect(() => {
    const qParam = searchParams.get('q') || '';
    if (qParam && qParam !== query) {
      setQuery(qParam);
      setInputValue(qParam);
    }
  }, [searchParams]);

  useEffect(() => {
    setInputValue(query);
  }, [query]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSearch = () => {
    setQuery(inputValue);
  };

  const handleClearFilters = () => {
    clearSearch();
    setInputValue('');
  };

  const handlePage = (p: number) => {
    goToPage(p);
  };

  const handleResultClick = (result: SearchResult) => {
    const q = encodeURIComponent(query);
    if (result.type === 'projects')
      router.push(`/proyectos/${result.id}?q=${q}`);
    else if (result.type === 'investigators')
      router.push(`/investigadores/${result.id}?q=${q}`);
    else if (result.type === 'publications')
      router.push(`/publicaciones/${result.id}?q=${q}`);
    else if (result.type === 'groups')
      router.push(`/grupos/${result.id}/ficha?q=${q}`);
    else if (result.type === 'tesis')
      router.push(`/publicaciones/${result.id}?q=${q}`);
  };

  // Helper selectors toggles
  const toggleType = (typeVal: SearchType) => {
    if (types.includes(typeVal)) {
      setTypes(types.filter(t => t !== typeVal));
    } else {
      setTypes([...types, typeVal]);
    }
  };

  const toggleSource = (srcVal: string) => {
    if (sources.includes(srcVal)) {
      setSources(sources.filter(s => s !== srcVal));
    } else {
      setSources([...sources, srcVal]);
    }
  };

  const handleStatusChange = (statusVal: string) => {
    if (statusVal === '') {
      setStatuses([]);
    } else {
      setStatuses([statusVal]);
    }
  };

  // Define select filters for FilterBar
  const selectFilters = [
    {
      name: 'type',
      label: 'TIPO DE REGISTRO',
      value: type || '',
      options: [
        { label: 'Todos', value: '' },
        { label: 'Proyectos', value: 'projects' },
        { label: 'Investigadores', value: 'investigators' },
        { label: 'Publicaciones', value: 'publications' },
        { label: 'Grupos de Inv.', value: 'groups' },
        { label: 'Tesis', value: 'tesis' },
      ],
      onChange: (val: string) => {
        setType(val ? (val as SearchType) : undefined);
      }
    },
    {
      name: 'source',
      label: 'FUENTE',
      value: sources[0] || '',
      options: [
        { label: 'Todas', value: '' },
        { label: 'RAIS', value: 'RAIS' },
        { label: 'RENACYT', value: 'RENACYT' },
        { label: 'Conector RENACYT', value: 'RENACYT_LIVE' },
        { label: 'Cybertesis', value: 'Cybertesis' },
        { label: 'VRIP', value: 'VRIP' },
        { label: 'Manual', value: 'Manual' },
      ],
      onChange: (val: string) => {
        setSources(val ? [val] : []);
      }
    },
    {
      name: 'status',
      label: 'ESTADO',
      value: statuses[0] || '',
      options: [
        { label: 'Todos', value: '' },
        { label: 'Activo', value: 'Activo' },
        { label: 'Concluido', value: 'Concluido' },
        { label: 'En Ejecución', value: 'En Ejecución' },
        { label: 'En Evaluación', value: 'En Evaluación' },
        { label: 'Suspendido', value: 'Suspendido' },
      ],
      onChange: (val: string) => {
        setStatuses(val ? [val] : []);
      }
    }
  ];

  return (
    <MainLayout title="Sistema de Gestión de Proyectos de Investigación">

      {/* ── Hero section ─────────────────────────────────────────────────────── */}
      <div className="-mx-6 -mt-6 mb-6 px-6 py-10 bg-[#001631] text-white text-center">
        <h1 className="font-heading font-bold text-[26px] leading-[34px] mb-2">
          Búsqueda Global Unificada
        </h1>
        <p className="font-sans text-[13px] text-[#a8c8fa] mb-2">
          Encuentre investigadores, proyectos, publicaciones, grupos de investigación y tesis en todas las bases de datos de la facultad.
        </p>
      </div>

      {/* ── Barra de filtros horizontal (FilterBar) ── */}
      <div className="mb-6">
        <FilterBar
          searchValue={inputValue}
          onSearchChange={setInputValue}
          searchPlaceholder="Buscar por título, investigador, código (min. 3 caracteres)..."
          selectFilters={selectFilters}
          onFilterSubmit={handleSearch}
        />
      </div>

      {/* ── Cuerpo: filtros + resultados ─────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row gap-6 items-start">

        {/* ── Panel de filtros lateral (Simplificado) ───────────────────────── */}
        <aside className="w-full md:w-[220px] flex-shrink-0">
          <div className="bg-white border border-[#e2e8f0] rounded p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="flex items-center gap-1.5 font-sans font-bold text-[12px] text-on-surface uppercase tracking-wider">
                <FilterIcon /> Filtros Adicionales
              </span>
            </div>
            <button
              onClick={handleClearFilters}
              className="font-sans text-[11px] text-[#2563eb] hover:underline mb-4 block"
            >
              Limpiar todos los filtros
            </button>

            {/* Período */}
            <div className="mb-2">
              <p className="font-sans font-bold text-[11px] text-on-surface uppercase tracking-wider mb-2.5">
                Período (Años)
              </p>
              <div className="flex flex-col gap-2">
                <input
                  type="number" value={yearStart || ''} min={2000} max={yearEnd || CURRENT_YEAR}
                  onChange={(e) => setYearStart(e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="Desde"
                  className="w-full px-2 py-1.5 font-sans text-[12px] text-on-surface border border-[#e2e8f0] rounded outline-none focus:ring-2 focus:ring-[#a8c8fa] transition-all"
                  aria-label="Año desde"
                />
                <input
                  type="number" value={yearEnd || ''} min={yearStart || 2000} max={CURRENT_YEAR + 2}
                  onChange={(e) => setYearEnd(e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="Hasta"
                  className="w-full px-2 py-1.5 font-sans text-[12px] text-on-surface border border-[#e2e8f0] rounded outline-none focus:ring-2 focus:ring-[#a8c8fa] transition-all"
                  aria-label="Año hasta"
                />
              </div>
            </div>

          </div>
        </aside>

        {/* ── Resultados ─────────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          {/* Barra superior resultados */}
          {!isLoading && (
            <div className="flex items-center justify-between mb-4">
              <p className="font-sans text-[13px] text-gray-600">
                {query.trim().length < 3
                  ? 'Ingrese al menos 3 caracteres en el cuadro de búsqueda para comenzar.'
                  : results.length === 0
                    ? `Sin resultados para "${query}"`
                    : <>
                        Se encontraron{' '}
                        <span className="font-bold text-gray-900">{pagination.total}</span>{' '}
                        coincidencias para <span className="font-bold text-gray-900">&ldquo;{query}&rdquo;</span>
                      </>
                }
              </p>
            </div>
          )}

          {/* Estado cargando */}
          {isLoading && (
            <div className="flex flex-col gap-3">
              {[1,2,3].map((i) => (
                <div key={i} className="bg-white border border-[#e2e8f0] rounded p-4 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-1/4 mb-3"/>
                  <div className="h-5 bg-gray-200 rounded w-3/4 mb-2"/>
                  <div className="h-3 bg-gray-200 rounded w-full mb-1"/>
                  <div className="h-3 bg-gray-200 rounded w-2/3"/>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {error && !isLoading && (
            <div className="bg-[#fef2f2] border border-[#fca5a5] text-[#991b1b] p-4 rounded mb-4 font-sans text-[13px]">
              {error}
            </div>
          )}

          {/* Lista de resultados */}
          {!isLoading && results.length > 0 && (
            <>
              <div className="flex flex-col gap-3">
                {results.map((result, i) => (
                  <ResultCard
                    key={`${result.type}-${result.id}-${i}`}
                    result={result}
                    query={query}
                    onClick={() => handleResultClick(result)}
                  />
                ))}
              </div>

              <Pagination
                page={pagination.page}
                totalPages={pagination.pages}
                onPage={handlePage}
              />
            </>
          )}

          {/* Sin resultados */}
          {!isLoading && query.trim().length >= 3 && results.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
                stroke="#94a3b8" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" className="mb-4">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <p className="font-sans font-semibold text-[15px] text-gray-900 mb-1">
                No se encontraron resultados
              </p>
              {types.length === 1 && types[0] === 'investigators' && !liveRenacyt ? (
                <>
                  <p className="font-sans text-[13px] text-gray-500 mb-4">
                    No se encontraron investigadores en la base de datos local.
                  </p>
                  <button
                    onClick={triggerLiveRenacyt}
                    className="px-4 py-2 bg-[#001631] text-white rounded font-sans font-medium text-[13px] hover:bg-[#002855] transition-colors shadow-sm"
                  >
                    Buscar en RENACYT
                  </button>
                </>
              ) : types.length === 1 && types[0] === 'tesis' && !liveCybertesis ? (
                <>
                  <p className="font-sans text-[13px] text-gray-500 mb-4">
                    No se encontraron tesis en la base de datos local.
                  </p>
                  <button
                    onClick={triggerLiveCybertesis}
                    className="px-4 py-2 bg-[#001631] text-white rounded font-sans font-medium text-[13px] hover:bg-[#002855] transition-colors shadow-sm"
                  >
                    Buscar en Cybertesis
                  </button>
                </>
              ) : (types.length === 0 || types.includes('investigators') || types.includes('tesis')) && !liveRenacyt && !liveCybertesis ? (
                <>
                  <p className="font-sans text-[13px] text-gray-500 mb-4">
                    No se encontraron coincidencias en la base de datos local.
                  </p>
                  <div className="mt-2 p-3 bg-gray-50 border border-gray-100 rounded-md max-w-md mx-auto flex flex-col gap-3">
                    {(types.length === 0 || types.includes('investigators')) && (
                      <div>
                        <p className="font-sans text-[12px] text-gray-600 mb-2">
                          ¿Estaba buscando un docente o investigador? Puede intentar buscar en la base de datos externa de RENACYT.
                        </p>
                        <button
                          onClick={triggerLiveRenacyt}
                          className="px-3 py-1.5 bg-[#001631] text-white rounded font-sans font-medium text-[11px] hover:bg-[#002855] transition-colors shadow-sm"
                        >
                          Buscar Investigador en RENACYT
                        </button>
                      </div>
                    )}
                    {(types.length === 0 || types.includes('tesis')) && (
                      <div className={types.length === 0 || types.includes('investigators') ? "border-t border-gray-200 pt-3" : ""}>
                        <p className="font-sans text-[12px] text-gray-600 mb-2">
                          ¿Estaba buscando una tesis de grado o investigación? Puede intentar buscar en Cybertesis (UNMSM).
                        </p>
                        <button
                          onClick={triggerLiveCybertesis}
                          className="px-3 py-1.5 bg-[#001631] text-white rounded font-sans font-medium text-[11px] hover:bg-[#002855] transition-colors shadow-sm"
                        >
                          Buscar Tesis en Cybertesis
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <p className="font-sans text-[13px] text-gray-500">
                  {liveRenacyt
                    ? 'No se encontraron registros del investigador en RENACYT.'
                    : liveCybertesis
                      ? 'No se encontraron tesis del término en Cybertesis.'
                      : 'Pruebe con otras palabras clave o amplíe los filtros.'}
                </p>
              )}
            </div>
          )}

          {/* Estado inicial */}
          {!isLoading && query.trim().length < 3 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
                stroke="#94a3b8" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" className="mb-4">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <p className="font-sans text-[13px] text-gray-500">
                Ingrese un término de búsqueda de al menos 3 caracteres para comenzar.
              </p>
            </div>
          )}
        </div>

      </div>
    </MainLayout>
  );
}

export default function BusquedaGlobalPage() {
  return (
    <React.Suspense fallback={<div className="p-6 text-center text-gray-500 font-sans animate-pulse">Cargando búsqueda...</div>}>
      <BusquedaGlobalPageContent />
    </React.Suspense>
  );
}
