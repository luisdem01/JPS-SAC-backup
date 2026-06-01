'use client';

/**
 * @file page.tsx
 * @route /investigadores  (alias: /investigators)
 * @description Directorio de Docentes/Investigadores — Pantalla 1 del flujo.
 *
 * Muestra el listado paginado con filtros, KPIs y accesos a:
 *   - Registrar Nuevo Docente → /investigadores/nuevo
 *   - Editar perfil            → /investigadores/[id]/editar
 *   - Ver perfil               → /investigadores/[id]  (siguiente pantalla)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/SGPI-CFU/components/layout';
import type { DocenteInvestigador, FiltrosDocentes, EstadoVigencia } from './_data/types';
import { getDocentes, getStats, getDepartamentos, getNivelesRenacyt, type PaginatedDocentes } from './_data/service';
import type { StatsDocentes } from './_data/types';
import { useAuth } from '@/SGPI-CFU/lib/hooks';

// ─────────────────────────────────────────────────────────────────────────────
// Configuración visual
// ─────────────────────────────────────────────────────────────────────────────

const NIVEL_CONFIG: Record<string, { bg: string; text: string }> = {
  'NIVEL I':     { bg: 'bg-[#f1f5f9]',  text: 'text-[#475569]' },
  'NIVEL II':    { bg: 'bg-[#dbeafe]',  text: 'text-[#1e40af]' },
  'NIVEL III':   { bg: 'bg-[#ede9fe]',  text: 'text-[#6d28d9]' },
  'NIVEL IV':    { bg: 'bg-[#fce7f3]',  text: 'text-[#9d174d]' },
  'NIVEL V':     { bg: 'bg-[#d1fae5]',  text: 'text-[#065f46]' },
  'NIVEL VI':    { bg: 'bg-[#fef9c3]',  text: 'text-[#854d0e]' },
  'NIVEL VII':   { bg: 'bg-[#fee2e2]',  text: 'text-[#991b1b]' },
  'DISTINGUIDO': { bg: 'bg-[#0f172a]',  text: 'text-white' },
  'Sin nivel':   { bg: 'bg-[#f8fafc]',  text: 'text-[#94a3b8]' },
};

const ESTADO_CONFIG: Record<EstadoVigencia, { dot: string; text: string; label: string }> = {
  activo:      { dot: 'bg-[#16a34a]', text: 'text-[#166534]', label: 'ACTIVO' },
  inactivo:    { dot: 'bg-[#dc2626]', text: 'text-[#991b1b]', label: 'INACTIVO' },
  por_vencer:  { dot: 'bg-[#d97706]', text: 'text-[#92400e]', label: 'POR VENCER' },
};

const DEFAULT_FILTROS: FiltrosDocentes = {
  buscar: '', departamento: '', nivelRenacyt: '', estado: '',
};

// ─────────────────────────────────────────────────────────────────────────────
// Íconos
// ─────────────────────────────────────────────────────────────────────────────

const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
  </svg>
);
const FilterIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
  </svg>
);
const PlusIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);
const EyeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);
const ChevronLeft = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);
const ChevronRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);
const ChevronDown = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);
const TrendUpIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
    <polyline points="17 6 23 6 23 12"/>
  </svg>
);
const GraduateIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
    <path d="M6 12v5c3 3 9 3 12 0v-5"/>
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// Badge de nivel
// ─────────────────────────────────────────────────────────────────────────────

function NivelBadge({ nivel }: { nivel: string }) {
  const cfg = NIVEL_CONFIG[nivel] ?? NIVEL_CONFIG['Sin nivel'];
  return (
    <span className={`
      inline-flex items-center px-2.5 py-1 rounded
      font-sans font-bold text-[10px] uppercase tracking-wider whitespace-nowrap
      ${cfg.bg} ${cfg.text}
    `}>
      {nivel}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Badge de estado
// ─────────────────────────────────────────────────────────────────────────────

function EstadoBadge({ estado }: { estado: EstadoVigencia }) {
  const cfg = ESTADO_CONFIG[estado];
  return (
    <span className={`inline-flex items-center gap-1.5 font-sans font-bold text-[11px] ${cfg.text}`}>
      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} aria-hidden="true"/>
      {cfg.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Select
// ─────────────────────────────────────────────────────────────────────────────

function Select({ id, value, onChange, options, label }: {
  id: string; value: string; label: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="appearance-none pl-3 pr-7 py-2 font-sans text-[13px] text-on-surface bg-surface-container-lowest border border-outline-variant rounded outline-none cursor-pointer focus:ring-2 focus:ring-[#a8c8fa] focus:border-primary transition-all whitespace-nowrap w-full">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant">
        <ChevronDown />
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI Card
// ─────────────────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, valueClass = '' }: {
  label: string; value: string | number; sub?: string; valueClass?: string;
}) {
  return (
    <div className="flex-1 min-w-[180px] bg-surface-container-lowest border border-outline-variant rounded p-5 shadow-level-1">
      <p className="font-sans font-bold text-[10px] text-on-surface uppercase tracking-widest mb-2">{label}</p>
      <p className={`font-heading font-bold text-[32px] leading-[36px] ${valueClass || 'text-on-surface'}`}>
        {typeof value === 'number' ? value.toLocaleString('es-PE') : value}
      </p>
      {sub && <p className="font-sans text-[11px] text-on-surface-variant mt-1">{sub}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Paginación
// ─────────────────────────────────────────────────────────────────────────────

function Pagination({ page, pages, onChange }: {
  page: number; pages: number; onChange: (p: number) => void;
}) {
  const items: (number | '...')[] = [];
  if (pages <= 7) {
    for (let i = 1; i <= pages; i++) items.push(i);
  } else {
    items.push(1, 2, 3);
    if (page > 5) items.push('...');
    if (page > 3 && page < pages - 2) items.push(page);
    if (page < pages - 3) items.push('...');
    items.push(pages - 1, pages);
  }

  return (
    <div className="flex items-center gap-1" role="navigation" aria-label="Paginación">
      <button onClick={() => onChange(page - 1)} disabled={page === 1}
        className="w-8 h-8 flex items-center justify-center rounded border border-outline-variant hover:bg-surface-container disabled:opacity-40 transition-colors"
        aria-label="Página anterior">
        <ChevronLeft />
      </button>
      {items.map((item, i) =>
        item === '...' ? (
          <span key={`ellipsis-${i}`} className="w-8 text-center font-sans text-[13px] text-on-surface-variant">…</span>
        ) : (
          <button key={item} onClick={() => onChange(item)}
            className={`w-8 h-8 flex items-center justify-center rounded font-sans text-[13px] transition-colors
              ${page === item
                ? 'bg-[#001631] text-white font-bold'
                : 'border border-outline-variant hover:bg-surface-container text-on-surface'}`}
            aria-current={page === item ? 'page' : undefined}
            aria-label={`Ir a página ${item}`}>
            {item}
          </button>
        )
      )}
      <button onClick={() => onChange(page + 1)} disabled={page === pages}
        className="w-8 h-8 flex items-center justify-center rounded border border-outline-variant hover:bg-surface-container disabled:opacity-40 transition-colors"
        aria-label="Página siguiente">
        <ChevronRight />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────────────────────────────────────

export default function DocentesDirectorioPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [filtros,     setFiltros]     = useState<FiltrosDocentes>(DEFAULT_FILTROS);
  const [tempBuscar,  setTempBuscar]  = useState('');
  const [tempDepto,   setTempDepto]   = useState('');
  const [tempNivel,   setTempNivel]   = useState('');
  const [tempEstado,  setTempEstado]  = useState('');
  const [resultado,   setResultado]   = useState<PaginatedDocentes | null>(null);
  const [stats,       setStats]       = useState<StatsDocentes | null>(null);
  const [isLoading,   setIsLoading]   = useState(true);
  const [page,        setPage]        = useState(1);
  const [liveRenacyt, setLiveRenacyt] = useState(false);
  const [departamentos, setDepartamentos] = useState<string[]>([]);
  const [nivelesRenacyt, setNivelesRenacyt] = useState<string[]>([]);

  // ── Cargar datos ───────────────────────────────────────────────────────────
  const cargar = useCallback(async (f: FiltrosDocentes, p: number, liveRenacytParam: boolean = false) => {
    setIsLoading(true);
    try {
      const [res, statsRes] = await Promise.all([getDocentes(f, p, liveRenacytParam), getStats()]);
      setResultado(res);
      setStats(statsRes);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar(DEFAULT_FILTROS, 1, false);

    async function cargarCatalogos() {
      try {
        const [depts, nivs] = await Promise.all([
          getDepartamentos(),
          getNivelesRenacyt(),
        ]);
        setDepartamentos(depts);
        setNivelesRenacyt(nivs);
      } catch (err) {
        console.error('Error al cargar catálogos desde el backend:', err);
      }
    }
    cargarCatalogos();
  }, [cargar]);

  // ── Filtrar ────────────────────────────────────────────────────────────────
  const handleFiltrar = () => {
    setLiveRenacyt(false);
    const f: FiltrosDocentes = {
      buscar: tempBuscar, departamento: tempDepto,
      nivelRenacyt: tempNivel, estado: tempEstado,
    };
    setFiltros(f);
    setPage(1);
    cargar(f, 1, false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleFiltrar(); };

  const handlePage = (p: number) => {
    setPage(p);
    cargar(filtros, p, liveRenacyt);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const triggerLiveRenacyt = () => {
    setLiveRenacyt(true);
    cargar(filtros, 1, true);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <MainLayout title="Sistema de Gestión de Proyectos de Investigación">

      {/* ── Encabezado ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
        <div>
          <h1 className="font-heading font-semibold text-h1 text-on-surface leading-[38px]">
            Directorio de Docente/Investigador
          </h1>
          <p className="font-sans text-body-md text-on-surface-variant mt-0.5">
            Gestione la información y el estado de vigencia de los docentes investigadores.
          </p>
        </div>
        {user?.role === 'admin' && (
          <button
            onClick={() => router.push('/investigadores/nuevo')}
            className="flex items-center gap-2 px-4 py-2 rounded font-sans font-semibold text-[13px] text-white bg-[#001631] hover:bg-[#002b54] transition-colors flex-shrink-0"
            aria-label="Registrar nuevo docente investigador"
          >
            <GraduateIcon /> Registrar Docente
          </button>
        )}
      </div>

      {/* ── Filtros ─────────────────────────────────────────────────────────── */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded shadow-level-1 overflow-hidden mb-4">

        <div className="px-5 py-4 flex items-end gap-3 flex-wrap">

          {/* Búsqueda */}
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="buscar-docente"
              className="block font-sans font-bold text-[10px] text-on-surface uppercase tracking-widest mb-1.5">
              Búsqueda por Identificación
            </label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none">
                <SearchIcon />
              </span>
              <input id="buscar-docente" type="text" value={tempBuscar}
                onChange={(e) => setTempBuscar(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="DNI o Apellidos del docente..."
                aria-label="Buscar por DNI o apellidos"
                className="w-full pl-9 pr-3 py-2 font-sans text-[13px] text-on-surface border border-outline-variant rounded outline-none focus:ring-2 focus:ring-[#a8c8fa] transition-all placeholder:text-on-surface-variant"
              />
            </div>
          </div>

          {/* Departamento */}
          <div className="min-w-[160px]">
            <label htmlFor="filtro-depto"
              className="block font-sans font-bold text-[10px] text-on-surface uppercase tracking-widest mb-1.5">
              Departamento
            </label>
            <Select id="filtro-depto" label="Departamento" value={tempDepto} onChange={setTempDepto}
              options={[
                { value: '', label: 'Todos' },
                ...departamentos.map((d) => ({ value: d, label: d })),
              ]}
            />
          </div>

          {/* Nivel Renacyt */}
          <div className="min-w-[140px]">
            <label htmlFor="filtro-nivel"
              className="block font-sans font-bold text-[10px] text-on-surface uppercase tracking-widest mb-1.5">
              Nivel Renacyt
            </label>
            <Select id="filtro-nivel" label="Nivel Renacyt" value={tempNivel} onChange={setTempNivel}
              options={[
                { value: '', label: 'Todos' },
                ...nivelesRenacyt.map((n) => ({ value: n, label: n })),
              ]}
            />
          </div>

          {/* Estado */}
          <div className="min-w-[130px]">
            <label htmlFor="filtro-estado"
              className="block font-sans font-bold text-[10px] text-on-surface uppercase tracking-widest mb-1.5">
              Estado
            </label>
            <Select id="filtro-estado" label="Estado de vigencia" value={tempEstado} onChange={setTempEstado}
              options={[
                { value: '',           label: 'Todos' },
                { value: 'activo',     label: 'Activo' },
                { value: 'inactivo',   label: 'Inactivo' },
                { value: 'por_vencer', label: 'Por Vencer' },
              ]}
            />
          </div>

          {/* Botón */}
          <button onClick={handleFiltrar}
            className="flex items-center gap-2 px-5 py-2 rounded font-sans font-bold text-[13px] text-white bg-[#001631] hover:bg-[#002b54] active:bg-[#001229] transition-colors self-end"
            aria-label="Aplicar filtros">
            <FilterIcon /> Filtrar
          </button>

        </div>

        {/* ── Skeleton / tabla ────────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="divide-y divide-outline-variant">
            {[1,2,3,4].map((i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
                <div className="w-24 h-4 bg-surface-container-high rounded"/>
                <div className="flex-1 h-4 bg-surface-container-high rounded"/>
                <div className="w-28 h-4 bg-surface-container-high rounded"/>
                <div className="w-20 h-5 bg-surface-container-high rounded"/>
                <div className="w-16 h-4 bg-surface-container-high rounded"/>
                <div className="w-16 h-6 bg-surface-container-high rounded"/>
              </div>
            ))}
          </div>
        ) : resultado && resultado.items.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" role="table">
                <thead>
                  <tr className="border-b border-t border-outline-variant bg-surface-container-low">
                    {['DNI', 'Docente', 'Departamento', 'Nivel Renacyt', 'Estado', 'Acciones'].map((h) => (
                      <th key={h}
                        className="px-5 py-3 text-left font-sans font-bold text-[10px] text-on-surface uppercase tracking-widest whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {resultado.items.map((doc) => (
                    <DocenteRow key={doc.id} doc={doc}
                      isAdmin={user?.role === 'admin'}
                      onEdit={() => router.push(`/investigadores/${doc.id}/editar`)}
                      onView={() => router.push(`/investigadores/${doc.id}`)}
                      onImport={() => router.push(`/investigadores/nuevo?dni=${doc.dni}&nombres=${encodeURIComponent(doc.nombres)}&apellidos=${encodeURIComponent(doc.apellidos)}&nivelRenacyt=${encodeURIComponent(doc.nivelRenacyt)}`)}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer paginación */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-outline-variant bg-surface-container-low">
              <p className="font-sans text-[12px] text-on-surface-variant">
                Mostrando {((page - 1) * 10) + 1}–{Math.min(page * 10, resultado.total)} de{' '}
                <span className="font-semibold">{resultado.total}</span> investigadores
              </p>
              <Pagination page={resultado.page} pages={resultado.pages} onChange={handlePage} />
            </div>
          </>
        ) : (
          <div className="py-16 text-center">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#94a3b8"
              strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <p className="font-sans font-semibold text-[14px] text-on-surface mb-1">
              No se encontraron docentes con los criterios seleccionados en la base de datos local.
            </p>
            {filtros.buscar.trim() && !liveRenacyt ? (
              <>
                <p className="font-sans text-[12px] text-on-surface-variant mb-4">
                  Puede intentar buscar en la base de datos externa de RENACYT.
                </p>
                <button
                  onClick={triggerLiveRenacyt}
                  className="px-4 py-2 bg-[#001631] text-white rounded font-sans font-semibold text-[12px] hover:bg-[#002b54] transition-colors shadow-sm"
                >
                  Buscar en RENACYT
                </button>
              </>
            ) : (
              <p className="font-sans text-[12px] text-on-surface-variant">
                {liveRenacyt
                  ? 'No se encontraron registros del investigador en RENACYT.'
                  : 'Ajuste los filtros o intente nuevamente.'}
              </p>
            )}
          </div>
        )}

      </div>

      {/* ── KPIs ────────────────────────────────────────────────────────────── */}
      {stats && (
        <div className="flex gap-4 flex-wrap">
          <KpiCard
            label="Total Docentes"
            value={stats.totalDocentes}
            sub={
              <span className="flex items-center gap-1 text-[#16a34a]">
                <TrendUpIcon /> +{stats.deltaEsteMes} este mes
              </span> as unknown as string
            }
          />
          <KpiCard
            label="Investigadores Renacyt"
            value={stats.investigadoresRenacyt}
            sub={`${stats.porcentajeRenacyt}% del total`}
          />
          <KpiCard
            label="Vigencias por Vencer"
            value={stats.vigenciasPorVencer}
            valueClass="text-[#dc2626]"
          />
          <KpiCard
            label="Proyectos Activos"
            value={stats.proyectosActivos}
            sub={`Ciclo Académico ${stats.cicloAcademico}`}
          />
        </div>
      )}

    </MainLayout>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Fila de tabla
// ─────────────────────────────────────────────────────────────────────────────

function DocenteRow({ doc, onEdit, onView, onImport, isAdmin }: {
  doc: DocenteInvestigador;
  onEdit: () => void;
  onView: () => void;
  onImport: () => void;
  isAdmin: boolean;
}) {
  return (
    <tr className={`
      hover:bg-surface-container-low transition-colors
      ${doc.estado === 'por_vencer' ? 'bg-[#fffef7]' : ''}
      ${doc.estado === 'inactivo'   ? 'opacity-75' : ''}
    `}>

      {/* DNI */}
      <td className="px-5 py-4 font-mono text-[13px] text-on-surface-variant whitespace-nowrap">
        {doc.dni}
      </td>

      {/* Nombre + email */}
      <td className="px-5 py-4">
        <p className="font-sans font-bold text-[13px] text-on-surface uppercase leading-[18px]">
          {doc.apellidos}, {doc.nombres}
        </p>
        {doc.email && <p className="font-sans text-[11px] text-on-surface-variant mt-0.5">{doc.email}</p>}
      </td>

      {/* Departamento */}
      <td className="px-5 py-4 font-sans text-[13px] text-on-surface-variant whitespace-nowrap">
        {doc.departamento}
      </td>

      {/* Nivel */}
      <td className="px-5 py-4">
        <NivelBadge nivel={doc.nivelRenacyt} />
      </td>

      {/* Estado */}
      <td className="px-5 py-4">
        <EstadoBadge estado={doc.estado} />
      </td>

      {/* Acciones */}
      <td className="px-5 py-4">
        {doc.isExternal ? (
          isAdmin && (
            <button onClick={onImport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded font-sans font-semibold text-[12px] text-white bg-[#16a34a] hover:bg-[#166534] transition-colors whitespace-nowrap"
              aria-label={`Importar docente ${doc.apellidos}, ${doc.nombres}`}>
              <PlusIcon /> Importar
            </button>
          )
        ) : (
          <button onClick={onView}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded font-sans font-semibold text-[12px] text-on-surface border border-outline-variant hover:bg-surface-container hover:border-[#001631] transition-colors whitespace-nowrap"
            aria-label={`Ver y editar perfil de ${doc.apellidos}, ${doc.nombres}`}>
            <EditIcon /> Ver / Editar
          </button>
        )}
      </td>

    </tr>
  );
}
