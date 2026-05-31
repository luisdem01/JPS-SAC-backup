'use client';

/**
 * @file page.tsx
 * @route /SGPI-CFB  (alias: /search)
 * @description Pantalla de Búsqueda Global Unificada del SGPI.
 *
 * Permite buscar y filtrar Proyectos, Investigadores y Publicaciones.
 * Cada resultado lleva a su pantalla de detalle.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams }                       from 'next/navigation';
import { MainLayout }                                       from '@/SGPI-CFU/components/layout';
import type { SearchFilters, SearchResponse, RecordType, FuenteDatos } from './_data/types';
import { searchRecords }                                    from './_data/service';
import { GRUPOS_INVESTIGACION }                             from './_data/mock';

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear();
const PER_PAGE     = 5;

const DEFAULT_FILTERS: SearchFilters = {
  query:      '',
  categories: ['proyecto', 'investigador', 'publicacion'],
  sources:    ['RAIS', 'RENACYT', 'CyberTesis'],
  anioDesde:  2020,
  anioHasta:  CURRENT_YEAR,
  grupo:      '',
  sortBy:     'relevancia',
  page:       1,
  perPage:    PER_PAGE,
};

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
  result: import('./_data/types').SearchResult;
  query:  string;
  onClick: () => void;
}) {
  // ── Proyecto ────────────────────────────────────────────────────────────────
  if (result.type === 'proyecto') {
    const d = result.data;
    const estadoColors: Record<string, string> = {
      'En Ejecución':  'bg-[#d1fae5] text-[#065f46]',
      'En Evaluación': 'bg-[#fef3c7] text-[#92400e]',
      'Concluido':     'bg-[#dbeafe] text-[#1e40af]',
      'Suspendido':    'bg-[#fee2e2] text-[#991b1b]',
    };
    return (
      <button
        onClick={onClick}
        className="w-full text-left bg-surface-container-lowest border border-outline-variant rounded hover:shadow-level-2 transition-all duration-150 p-4 group"
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
          <span className={`flex-shrink-0 font-sans font-bold text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full ${estadoColors[d.estado] ?? 'bg-surface-container text-on-surface-variant'}`}>
            {d.estado}
          </span>
        </div>

        <h3 className="font-sans font-bold text-[14px] text-on-surface leading-[20px] mb-1 group-hover:text-primary transition-colors">
          <HighlightText text={d.titulo} query={query} />
        </h3>
        <p className="font-sans text-[12px] text-on-surface-variant leading-[18px] line-clamp-2 mb-3">
          <HighlightText text={d.resumen} query={query} />
          {' '}Responsable: <span className="font-medium">{d.responsable.nombre}</span>.
        </p>

        <div className="flex items-center gap-3 flex-wrap">
          {d.fuente.map((f) => (
            <span key={f} className="inline-flex items-center gap-1 font-sans text-[11px] font-medium text-[#1e40af] bg-[#eff6ff] border border-[#bfdbfe] px-2 py-0.5 rounded">
              <RaisIcon />{f}
            </span>
          ))}
          <span className="inline-flex items-center gap-1 font-sans text-[11px] text-on-surface-variant">
            <SyncIcon />Últ. act: {d.ultimaSync}
          </span>
          <span className="inline-flex items-center gap-1 font-sans text-[11px] text-on-surface-variant">
            <HashIcon />Cód: {d.codigo}
          </span>
        </div>
      </button>
    );
  }

  // ── Investigador ─────────────────────────────────────────────────────────────
  if (result.type === 'investigador') {
    const d = result.data;
    const nivelLabel = d.nivel === 'No Clasificado' ? 'No Clasificado' : `Nivel ${d.nivel}`;
    return (
      <button
        onClick={onClick}
        className="w-full text-left bg-surface-container-lowest border border-outline-variant rounded hover:shadow-level-2 transition-all duration-150 p-4 group"
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded bg-[#f0fdf4] text-[#166534] flex items-center justify-center flex-shrink-0">
              <InvestigadorIcon />
            </span>
            <span className="font-sans font-bold text-[10px] uppercase tracking-widest text-[#166534]">
              Investigador RENACYT
            </span>
          </div>
          <span className="flex-shrink-0 font-sans font-bold text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#f0fdf4] text-[#166534]">
            {nivelLabel}
          </span>
        </div>

        <h3 className="font-sans font-bold text-[15px] text-on-surface leading-[22px] mb-1 group-hover:text-primary transition-colors">
          <HighlightText text={d.nombre} query={query} />
        </h3>
        <p className="font-sans text-[12px] text-on-surface-variant leading-[18px] mb-3">
          {d.cargo}. Especialista en{' '}
          <HighlightText text={d.especialidad} query={query} />.{' '}
          Directora del Grupo "<HighlightText text={d.grupo} query={query} />".
        </p>

        <div className="flex items-center gap-3 flex-wrap">
          {d.fuente.map((f) => (
            <span key={f} className="inline-flex items-center gap-1 font-sans text-[11px] font-medium text-[#166534] bg-[#f0fdf4] border border-[#bbf7d0] px-2 py-0.5 rounded">
              <RaisIcon />{f}
            </span>
          ))}
          <span className="inline-flex items-center gap-1 font-sans text-[11px] text-on-surface-variant">
            <SyncIcon />Sincronizado: {d.ultimaSync}
          </span>
          <span className="inline-flex items-center gap-1 font-sans text-[11px] text-on-surface-variant">
            <HashIcon />DN: {d.dni}
          </span>
        </div>
      </button>
    );
  }

  // ── Publicación ──────────────────────────────────────────────────────────────
  const d = result.data;
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-surface-container-lowest border border-outline-variant rounded hover:shadow-level-2 transition-all duration-150 p-4 group"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded bg-[#fdf4ff] text-[#7e22ce] flex items-center justify-center flex-shrink-0">
            <PublicacionIcon />
          </span>
          <span className="font-sans font-bold text-[10px] uppercase tracking-widest text-[#7e22ce]">
            {d.tipo}
          </span>
        </div>
        {d.quartil && (
          <span className="flex-shrink-0 font-sans font-bold text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#fdf4ff] text-[#7e22ce]">
            {d.quartil}
          </span>
        )}
      </div>

      <h3 className="font-sans font-bold text-[14px] text-[#7e22ce] leading-[20px] mb-1 group-hover:opacity-80 transition-colors">
        <HighlightText text={d.titulo} query={query} />
      </h3>
      <p className="font-sans text-[12px] text-on-surface-variant leading-[18px] mb-3">
        Autores: {d.autores.join(', ')}. Publicado en <span className="italic">{d.revista}</span>.
      </p>

      <div className="flex items-center gap-3 flex-wrap">
        <span className="inline-flex items-center gap-1 font-sans text-[11px] font-medium text-[#7e22ce] bg-[#fdf4ff] border border-[#e9d5ff] px-2 py-0.5 rounded">
          <RaisIcon />{d.fuente} API
        </span>
        <span className="inline-flex items-center gap-1 font-sans text-[11px] text-on-surface-variant">
          <SyncIcon />Últ. act: {d.ultimaAct}
        </span>
        {d.doi && (
          <span className="inline-flex items-center gap-1 font-sans text-[11px] text-on-surface-variant">
            <HashIcon />DOI: {d.doi}
          </span>
        )}
      </div>
    </button>
  );
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

  // ── Estado ─────────────────────────────────────────────────────────────────

  const [inputValue,  setInputValue]  = useState(searchParams.get('q') ?? '');
  const [filters,     setFilters]     = useState<SearchFilters>({
    ...DEFAULT_FILTERS,
    query: searchParams.get('q') ?? '',
  });
  const [response,    setResponse]    = useState<SearchResponse | null>(null);
  const [isLoading,   setIsLoading]   = useState(false);

  // Estado temporal de filtros en el panel (se aplican solo al darle clic a "Filtrar")
  const [tempCategories, setTempCategories] = useState<RecordType[]>(DEFAULT_FILTERS.categories);
  const [tempSources,    setTempSources]    = useState<FuenteDatos[]>(DEFAULT_FILTERS.sources);
  const [tempAnioDesde,  setTempAnioDesde]  = useState(DEFAULT_FILTERS.anioDesde);
  const [tempAnioHasta,  setTempAnioHasta]  = useState(DEFAULT_FILTERS.anioHasta);
  const [tempGrupo,      setTempGrupo]      = useState(DEFAULT_FILTERS.grupo);
  const [sortBy,         setSortBy]         = useState<SearchFilters['sortBy']>('relevancia');

  const firstRender = useRef(true);

  // ── Búsqueda ───────────────────────────────────────────────────────────────

  const doSearch = useCallback(async (f: SearchFilters) => {
    setIsLoading(true);
    try {
      const res = await searchRecords(f);
      setResponse(res);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Búsqueda inicial (si hay query en URL o siempre al montar)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      doSearch(filters);
    }
  }, []);

  // Re-buscar cuando cambia sortBy o página
  useEffect(() => {
    if (!firstRender.current) {
      doSearch({ ...filters, sortBy });
    }
  }, [sortBy, filters.page]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSearch = () => {
    const newFilters: SearchFilters = {
      ...filters,
      query:      inputValue,
      categories: tempCategories,
      sources:    tempSources,
      anioDesde:  tempAnioDesde,
      anioHasta:  tempAnioHasta,
      grupo:      tempGrupo,
      sortBy,
      page: 1,
    };
    setFilters(newFilters);
    doSearch(newFilters);
  };

  const handleClearFilters = () => {
    setTempCategories(DEFAULT_FILTERS.categories);
    setTempSources(DEFAULT_FILTERS.sources);
    setTempAnioDesde(DEFAULT_FILTERS.anioDesde);
    setTempAnioHasta(DEFAULT_FILTERS.anioHasta);
    setTempGrupo('');
  };

  const handlePage = (p: number) => {
    setFilters((f) => ({ ...f, page: p }));
  };

  const handleResultClick = (result: import('./_data/types').SearchResult) => {
    const q = encodeURIComponent(filters.query);
    if (result.type === 'proyecto')
      router.push(`/SGPI-CFB/proyecto/${result.data.id}?q=${q}`);
    else if (result.type === 'investigador')
      router.push(`/SGPI-CFB/investigador/${result.data.id}?q=${q}`);
    else
      router.push(`/SGPI-CFB/publicacion/${result.data.id}?q=${q}`);
  };

  const toggleCategory = (cat: RecordType) => {
    setTempCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const toggleSource = (src: FuenteDatos) => {
    setTempSources((prev) =>
      prev.includes(src) ? prev.filter((s) => s !== src) : [...prev, src]
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  const counts = response?.counts;

  return (
    <MainLayout title="Sistema de Gestión de Proyectos de Investigación">

      {/* ── Hero section ─────────────────────────────────────────────────────── */}
      <div className="-mx-6 -mt-6 mb-6 px-6 py-10 bg-[#001631] text-white text-center">
        <h1 className="font-heading font-bold text-[26px] leading-[34px] mb-2">
          Búsqueda Global Unificada
        </h1>
        <p className="font-sans text-[13px] text-[#a8c8fa] mb-6">
          Encuentre investigadores, proyectos, publicaciones y tesis en todas las bases de datos de la facultad.
        </p>

        {/* Barra de búsqueda */}
        <div className="flex max-w-[600px] mx-auto gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]">
              <SearchIcon />
            </span>
            <input
              id="global-search-input"
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Buscar por título, investigador, código..."
              className="
                w-full pl-10 pr-4 py-2.5
                font-sans text-[14px] text-[#0f172a]
                bg-white rounded
                outline-none
                focus:ring-2 focus:ring-[#a8c8fa]
                transition-all duration-100
              "
              aria-label="Campo de búsqueda global"
            />
          </div>
          <button
            onClick={handleSearch}
            className="
              px-5 py-2.5 rounded
              bg-[#2563eb] hover:bg-[#1d4ed8] active:bg-[#1e40af]
              text-white font-sans font-semibold text-[14px]
              transition-colors duration-100
            "
            aria-label="Ejecutar búsqueda"
          >
            Buscar
          </button>
        </div>
      </div>

      {/* ── Cuerpo: filtros + resultados ─────────────────────────────────────── */}
      <div className="flex gap-6 items-start">

        {/* ── Panel de filtros ─────────────────────────────────────────────── */}
        <aside className="w-[220px] flex-shrink-0">
          <div className="bg-surface-container-lowest border border-outline-variant rounded p-4">
            {/* Cabecera */}
            <div className="flex items-center justify-between mb-3">
              <span className="flex items-center gap-1.5 font-sans font-bold text-[12px] text-on-surface uppercase tracking-wider">
                <FilterIcon /> Refinar Resultados
              </span>
            </div>
            <button
              onClick={handleClearFilters}
              className="font-sans text-[11px] text-[#2563eb] hover:underline mb-4 block"
            >
              Limpiar todos los filtros
            </button>

            {/* Categoría */}
            <div className="mb-5">
              <p className="font-sans font-bold text-[11px] text-on-surface uppercase tracking-wider mb-2.5">
                Categoría de Registro
              </p>
              <div className="flex flex-col gap-2">
                <Checkbox id="cat-proyecto"     label="Proyectos"      count={counts?.proyecto}     checked={tempCategories.includes('proyecto')}     onChange={() => toggleCategory('proyecto')} />
                <Checkbox id="cat-investigador" label="Investigadores"  count={counts?.investigador}  checked={tempCategories.includes('investigador')}  onChange={() => toggleCategory('investigador')} />
                <Checkbox id="cat-publicacion"  label="Publicaciones"   count={counts?.publicacion}   checked={tempCategories.includes('publicacion')}   onChange={() => toggleCategory('publicacion')} />
              </div>
            </div>

            {/* Fuente */}
            <div className="mb-5">
              <p className="font-sans font-bold text-[11px] text-on-surface uppercase tracking-wider mb-2.5">
                Fuente de Datos
              </p>
              <div className="flex flex-col gap-2">
                <Checkbox id="src-rais"      label="RAIS"      checked={tempSources.includes('RAIS')}      onChange={() => toggleSource('RAIS')} />
                <Checkbox id="src-renacyt"   label="RENACYT"   checked={tempSources.includes('RENACYT')}   onChange={() => toggleSource('RENACYT')} />
                <Checkbox id="src-cybertesis" label="CyberTesis" checked={tempSources.includes('CyberTesis')} onChange={() => toggleSource('CyberTesis')} />
              </div>
            </div>

            {/* Período */}
            <div className="mb-5">
              <p className="font-sans font-bold text-[11px] text-on-surface uppercase tracking-wider mb-2.5">
                Período (Años)
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number" value={tempAnioDesde} min={2000} max={tempAnioHasta}
                  onChange={(e) => setTempAnioDesde(Number(e.target.value))}
                  className="w-full px-2 py-1.5 font-sans text-[12px] text-on-surface border border-outline-variant rounded outline-none focus:ring-2 focus:ring-[#a8c8fa] transition-all"
                  aria-label="Año desde"
                />
                <span className="text-on-surface-variant font-sans text-[12px] flex-shrink-0">–</span>
                <input
                  type="number" value={tempAnioHasta} min={tempAnioDesde} max={CURRENT_YEAR + 2}
                  onChange={(e) => setTempAnioHasta(Number(e.target.value))}
                  className="w-full px-2 py-1.5 font-sans text-[12px] text-on-surface border border-outline-variant rounded outline-none focus:ring-2 focus:ring-[#a8c8fa] transition-all"
                  aria-label="Año hasta"
                />
              </div>
            </div>

            {/* Grupo de Investigación */}
            <div className="mb-5">
              <p className="font-sans font-bold text-[11px] text-on-surface uppercase tracking-wider mb-2.5">
                Grupo de Investigación
              </p>
              <div className="relative">
                <select
                  value={tempGrupo}
                  onChange={(e) => setTempGrupo(e.target.value)}
                  className="w-full appearance-none px-3 py-2 pr-7 font-sans text-[12px] text-on-surface bg-surface-container-lowest border border-outline-variant rounded outline-none focus:ring-2 focus:ring-[#a8c8fa] transition-all cursor-pointer"
                  aria-label="Filtrar por grupo de investigación"
                >
                  <option value="">Cualquier grupo</option>
                  {GRUPOS_INVESTIGACION.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant">
                  <ChevronDownIcon />
                </span>
              </div>
            </div>

            {/* Botón Filtrar */}
            <button
              onClick={handleSearch}
              className="
                w-full flex items-center justify-center gap-2
                px-4 py-2 rounded
                bg-[#001631] hover:bg-[#002b54] active:bg-[#001229]
                text-white font-sans font-semibold text-[13px]
                transition-colors duration-100
              "
              aria-label="Aplicar filtros de búsqueda"
            >
              <FilterIcon /> Filtrar
            </button>
          </div>
        </aside>

        {/* ── Resultados ─────────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          {/* Barra superior resultados */}
          {response && !isLoading && (
            <div className="flex items-center justify-between mb-4">
              <p className="font-sans text-[13px] text-on-surface-variant">
                {response.total === 0
                  ? `Sin resultados${filters.query ? ` para "${filters.query}"` : ''}`
                  : <>
                      Se encontraron{' '}
                      <span className="font-bold text-on-surface">{response.total}</span>{' '}
                      coincidencias{filters.query && <> para <span className="font-bold text-on-surface">"{filters.query}"</span></>}
                    </>
                }
              </p>
              <div className="flex items-center gap-2">
                <span className="font-sans text-[12px] text-on-surface-variant">Ordenar por:</span>
                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SearchFilters['sortBy'])}
                    className="appearance-none pl-2 pr-6 py-1 font-sans font-medium text-[12px] text-on-surface border border-outline-variant rounded outline-none focus:ring-2 focus:ring-[#a8c8fa] bg-white cursor-pointer"
                    aria-label="Ordenar resultados"
                  >
                    <option value="relevancia">Relevancia</option>
                    <option value="fecha">Fecha</option>
                    <option value="titulo">Título</option>
                  </select>
                  <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-on-surface-variant">
                    <ChevronDownIcon />
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Estado cargando */}
          {isLoading && (
            <div className="flex flex-col gap-3">
              {[1,2,3].map((i) => (
                <div key={i} className="bg-surface-container-lowest border border-outline-variant rounded p-4 animate-pulse">
                  <div className="h-4 bg-surface-container-high rounded w-1/4 mb-3"/>
                  <div className="h-5 bg-surface-container-high rounded w-3/4 mb-2"/>
                  <div className="h-3 bg-surface-container-high rounded w-full mb-1"/>
                  <div className="h-3 bg-surface-container-high rounded w-2/3"/>
                </div>
              ))}
            </div>
          )}

          {/* Lista de resultados */}
          {!isLoading && response && response.results.length > 0 && (
            <>
              <div className="flex flex-col gap-3">
                {response.results.map((result, i) => {
                  const id = result.type === 'proyecto'
                    ? result.data.id
                    : result.type === 'investigador'
                      ? result.data.id
                      : result.data.id;
                  return (
                    <ResultCard
                      key={`${result.type}-${id}-${i}`}
                      result={result}
                      query={filters.query}
                      onClick={() => handleResultClick(result)}
                    />
                  );
                })}
              </div>

              <Pagination
                page={response.page}
                totalPages={response.totalPages}
                onPage={handlePage}
              />
            </>
          )}

          {/* Sin resultados */}
          {!isLoading && response && response.results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
                stroke="#94a3b8" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" className="mb-4">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <p className="font-sans font-semibold text-[15px] text-on-surface mb-1">
                No se encontraron resultados
              </p>
              <p className="font-sans text-[13px] text-on-surface-variant">
                Pruebe con otras palabras clave o amplíe los filtros.
              </p>
            </div>
          )}

          {/* Estado inicial */}
          {!isLoading && !response && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
                stroke="#94a3b8" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" className="mb-4">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <p className="font-sans text-[13px] text-on-surface-variant">
                Ingrese un término de búsqueda para comenzar.
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
    <React.Suspense fallback={<div className="p-6 text-center text-on-surface-variant font-sans animate-pulse">Cargando búsqueda...</div>}>
      <BusquedaGlobalPageContent />
    </React.Suspense>
  );
}
