'use client';

/**
 * @file page.tsx
 * @route /grupos
 * @description Bandeja principal de Gestión de Grupos de Investigación (SGPI-CFGI).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/SGPI-CFU/components/layout';
import { Button } from '@/SGPI-CFU/components/ui';
import type { FiltrosGrupos, EstadoGrupo, FuenteOrigen } from './_data/types';
import { getGrupos, getStats, type PaginatedGrupos } from './_data/service';
import type { StatsGrupos } from './_data/types';
import { useAuth } from '@/SGPI-CFU/lib/hooks';

// ─────────────────────────────────────────────────────────────────────────────
// Configuración visual de badges
// ─────────────────────────────────────────────────────────────────────────────

const ESTADO_CONFIG: Record<EstadoGrupo, { dot: string; text: string; bg: string; label: string }> = {
  pendiente_validacion: {
    dot: 'bg-[#d97706]',
    text: 'text-[#92400e]',
    bg: 'bg-[#fef3c7]',
    label: 'Pendiente Validar',
  },
  validado_activo: {
    dot: 'bg-[#16a34a]',
    text: 'text-[#166534]',
    bg: 'bg-[#dcfce7]',
    label: 'Validado / Activo',
  },
  validado_inactivo: {
    dot: 'bg-[#dc2626]',
    text: 'text-[#991b1b]',
    bg: 'bg-[#fee2e2]',
    label: 'Validado / Inactivo',
  },
};

const FUENTE_CONFIG: Record<FuenteOrigen, { text: string; bg: string }> = {
  RAIS:            { text: 'text-[#1e40af]', bg: 'bg-[#dbeafe]' },
  'Res. Rectoral': { text: 'text-[#6d28d9]', bg: 'bg-[#ede9fe]' },
  Manual:          { text: 'text-[#374151]', bg: 'bg-[#f3f4f6]' },
};

const DEFAULT_FILTROS: FiltrosGrupos = { buscar: '', estado: '', fuente: '' };

// ─────────────────────────────────────────────────────────────────────────────
// Íconos SVG
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

const EyeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

const PlusIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
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

// ─────────────────────────────────────────────────────────────────────────────
// Componentes de apoyo
// ─────────────────────────────────────────────────────────────────────────────

function EstadoBadge({ estado }: { estado: EstadoGrupo }) {
  const cfg = ESTADO_CONFIG[estado];
  return (
    <span className={`
      inline-flex items-center gap-1.5 px-2 py-0.5 rounded
      font-sans font-semibold text-[11px] whitespace-nowrap
      ${cfg.bg} ${cfg.text}
    `}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} aria-hidden="true"/>
      {cfg.label}
    </span>
  );
}

function FuenteBadge({ fuente }: { fuente: FuenteOrigen }) {
  const cfg = FUENTE_CONFIG[fuente];
  return (
    <span className={`
      inline-flex items-center px-2 py-0.5 rounded
      font-sans font-semibold text-[11px] whitespace-nowrap
      ${cfg.bg} ${cfg.text}
    `}>
      {fuente}
    </span>
  );
}

function Select({ id, value, onChange, options, label }: {
  id: string; value: string; label: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="appearance-none pl-3 pr-7 py-[7px] font-sans text-[13px] text-on-surface bg-white border border-[#e2e8f0] rounded outline-none cursor-pointer focus:ring-2 focus:ring-[#a8c8fa] focus:border-primary transition-all whitespace-nowrap w-full">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant">
        <ChevronDown />
      </span>
    </div>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="flex-1 min-w-[160px] bg-white border border-[#e2e8f0] rounded p-5">
      <p className="font-sans font-bold text-[10px] text-[#64748b] uppercase tracking-widest mb-2">{label}</p>
      <p className="font-heading font-bold text-[30px] leading-[34px] text-[#0f172a]">
        {value.toLocaleString('es-PE')}
      </p>
      {sub && <p className="font-sans text-[11px] text-[#94a3b8] mt-1">{sub}</p>}
    </div>
  );
}

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
        className="w-8 h-8 flex items-center justify-center rounded border border-[#e2e8f0] hover:bg-slate-50 disabled:opacity-40 transition-colors"
        aria-label="Página anterior">
        <ChevronLeft />
      </button>
      {items.map((item, i) =>
        item === '...' ? (
          <span key={`ellipsis-${i}`} className="w-8 text-center font-sans text-[13px] text-[#94a3b8]">…</span>
        ) : (
          <button key={item} onClick={() => onChange(item)}
            className={`w-8 h-8 flex items-center justify-center rounded font-sans text-[13px] transition-colors
              ${page === item
                ? 'bg-[#001631] text-white font-bold'
                : 'border border-[#e2e8f0] hover:bg-slate-50 text-[#0f172a]'}`}
            aria-current={page === item ? 'page' : undefined}>
            {item}
          </button>
        )
      )}
      <button onClick={() => onChange(page + 1)} disabled={page === pages}
        className="w-8 h-8 flex items-center justify-center rounded border border-[#e2e8f0] hover:bg-slate-50 disabled:opacity-40 transition-colors"
        aria-label="Página siguiente">
        <ChevronRight />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente Principal
// ─────────────────────────────────────────────────────────────────────────────

export default function GruposBandejaPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [filtros,    setFiltros]    = useState<FiltrosGrupos>(DEFAULT_FILTROS);
  const [tempBuscar, setTempBuscar] = useState('');
  const [tempEstado, setTempEstado] = useState('');
  const [tempFuente, setTempFuente] = useState('');

  const [resultado, setResultado] = useState<PaginatedGrupos | null>(null);
  const [stats,     setStats]     = useState<StatsGrupos | null>(null);
  const [cargando,  setCargando]  = useState(true);
  const [pagina,    setPagina]    = useState(1);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setErrorCarga(null);
    try {
      const dataGrupos = await getGrupos(filtros, pagina);
      setResultado(dataGrupos);
    } catch (error: any) {
      console.error('Error al cargar datos de grupos:', error);
      setErrorCarga(error?.message || 'No se pudieron cargar los datos de los grupos de investigación.');
    } finally {
      setCargando(false);
    }
  }, [filtros, pagina]);

  const cargarStats = useCallback(async () => {
    try {
      const dataStats = await getStats();
      setStats(dataStats);
    } catch (error) {
      console.error('Error al cargar stats:', error);
    }
  }, []);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);
  useEffect(() => { cargarStats(); }, [cargarStats]);

  const handleFiltrar = (e: React.FormEvent) => {
    e.preventDefault();
    setPagina(1);
    setFiltros({ buscar: tempBuscar, estado: tempEstado, fuente: tempFuente });
  };

  const handleLimpiar = () => {
    setTempBuscar(''); setTempEstado(''); setTempFuente('');
    setPagina(1);
    setFiltros(DEFAULT_FILTROS);
  };

  const formatearFecha = (fechaStr: string) => {
    if (!fechaStr) return '-';
    try {
      const d = new Date(fechaStr);
      return d.toLocaleDateString('es-PE', { year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch { return fechaStr; }
  };

  const hayFiltrosActivos = filtros.buscar || filtros.estado || filtros.fuente;

  return (
    <MainLayout
      title="Gestión de Grupos de Investigación"
      subtitle="Controle e identifique la información importada de fuentes externas que requiere atención."
    >
      <div className="flex flex-col gap-5">

        {/* Header: título + botón Nuevo Grupo */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-heading font-semibold text-h1 text-on-surface leading-[38px]">
              Gestión de Grupos de Investigación
            </h1>
            <p className="mt-1 font-sans text-body-md text-on-surface-variant">
              Controle e identifique la información importada de fuentes externas que requiere atención.
            </p>
          </div>
          {user?.role === 'admin' && (
            <button
              onClick={() => router.push('/grupos/nuevo')}
              className="flex items-center gap-1.5 bg-[#001631] hover:bg-[#002b54] text-white font-sans font-bold text-[13px] px-4 py-2 rounded shadow transition-colors cursor-pointer whitespace-nowrap flex-shrink-0"
            >
              <PlusIcon />
              Nuevo Grupo
            </button>
          )}
        </div>

        {/* Barra de Filtros */}
        <form onSubmit={handleFiltrar} className="flex flex-wrap items-end gap-3 bg-surface-container-lowest border border-outline-variant rounded p-4 shadow-level-1">

          {/* Búsqueda */}
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="buscar" className="block font-sans font-bold text-[10px] text-on-surface uppercase tracking-widest mb-1.5">
              Buscar
            </label>
            <div className="relative">
              <input
                id="buscar"
                type="text"
                placeholder="Nombre o código..."
                value={tempBuscar}
                onChange={(e) => setTempBuscar(e.target.value)}
                className="w-full pl-8 pr-3 py-[7px] font-sans text-[13px] text-on-surface bg-surface-container-lowest border border-outline-variant rounded outline-none focus:ring-2 focus:ring-[#a8c8fa] transition-all"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94a3b8]" aria-hidden="true">
                <SearchIcon />
              </span>
            </div>
          </div>

          {/* Estado */}
          <div className="w-[190px]">
            <label htmlFor="filtro-estado" className="block font-sans font-bold text-[10px] text-on-surface uppercase tracking-widest mb-1.5">
              Estado
            </label>
            <Select
              id="filtro-estado"
              value={tempEstado}
              onChange={setTempEstado}
              label="Filtrar por Estado"
              options={[
                { value: '',                      label: 'Pendientes de validac...' },
                { value: 'pendiente_validacion',  label: 'Pendiente Validar' },
                { value: 'validado_activo',        label: 'Validado / Activo' },
                { value: 'validado_inactivo',      label: 'Validado / Inactivo' },
              ]}
            />
          </div>

          {/* Fuente */}
          <div className="w-[140px]">
            <label htmlFor="filtro-fuente" className="block font-sans font-bold text-[10px] text-on-surface uppercase tracking-widest mb-1.5">
              Fuente de Origen
            </label>
            <Select
              id="filtro-fuente"
              value={tempFuente}
              onChange={setTempFuente}
              label="Filtrar por Fuente"
              options={[
                { value: '',             label: 'Todas' },
                { value: 'RAIS',         label: 'RAIS' },
                { value: 'Res. Rectoral', label: 'Res. Rectoral' },
                { value: 'Manual',       label: 'Manual' },
              ]}
            />
          </div>

          {/* Botones */}
          <div className="flex gap-2">
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={cargando}
              iconLeft={<FilterIcon />}
            >
              Filtrar
            </Button>
            {hayFiltrosActivos && (
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={handleLimpiar}
              >
                Limpiar
              </Button>
            )}
          </div>
        </form>

        {/* Tabla de Grupos */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded shadow-level-1 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-outline-variant bg-surface-container-low">
                  <th scope="col" className="px-5 py-3 font-sans font-bold text-[10px] text-on-surface uppercase tracking-widest whitespace-nowrap w-[140px]">
                    Código
                  </th>
                  <th scope="col" className="px-5 py-3 font-sans font-bold text-[10px] text-on-surface uppercase tracking-widest whitespace-nowrap">
                    Nombre del Grupo
                  </th>
                  <th scope="col" className="px-5 py-3 font-sans font-bold text-[10px] text-on-surface uppercase tracking-widest whitespace-nowrap w-[170px]">
                    Importación/Creación
                  </th>
                  <th scope="col" className="px-5 py-3 font-sans font-bold text-[10px] text-on-surface uppercase tracking-widest whitespace-nowrap w-[110px]">
                    Fuente
                  </th>
                  <th scope="col" className="px-5 py-3 font-sans font-bold text-[10px] text-on-surface uppercase tracking-widest whitespace-nowrap w-[170px]">
                    Estado
                  </th>
                  <th scope="col" className="px-5 py-3 font-sans font-bold text-[10px] text-on-surface uppercase tracking-widest whitespace-nowrap w-[100px] text-right">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {errorCarga ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="flex items-center gap-2 text-error text-[13px] font-sans font-medium">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                          <span>{errorCarga}</span>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={cargarDatos}
                        >
                          Reintentar carga
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : cargando ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={`skel-${i}`} className="animate-pulse">
                      <td className="px-5 py-4"><div className="h-4 bg-slate-100 rounded w-20" /></td>
                      <td className="px-5 py-4"><div className="h-4 bg-slate-100 rounded w-3/4" /></td>
                      <td className="px-5 py-4"><div className="h-4 bg-slate-100 rounded w-20" /></td>
                      <td className="px-5 py-4"><div className="h-5 bg-slate-100 rounded w-12" /></td>
                      <td className="px-5 py-4"><div className="h-5 bg-slate-100 rounded-full w-28" /></td>
                      <td className="px-5 py-4 text-right"><div className="h-7 bg-slate-100 rounded w-14 ml-auto" /></td>
                    </tr>
                  ))
                ) : resultado && resultado.items.length > 0 ? (
                  resultado.items.map((grupo) => (
                    <tr key={grupo.code} className="hover:bg-surface-container-low transition-colors">
                      <td className="px-5 py-3.5 font-sans font-semibold text-[13px] text-on-surface">
                        {grupo.code}
                      </td>
                      <td className="px-5 py-3.5 font-sans text-[13px] text-on-surface font-medium max-w-[420px]">
                        {grupo.name}
                      </td>
                      <td className="px-5 py-3.5 font-sans text-[13px] text-on-surface-variant">
                        {formatearFecha(grupo.createdAt)}
                      </td>
                      <td className="px-5 py-3.5">
                        <FuenteBadge fuente={grupo.fuente} />
                      </td>
                      <td className="px-5 py-3.5">
                        <EstadoBadge estado={grupo.status} />
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {grupo.status === 'pendiente_validacion' ? (
                          <button
                            onClick={() => router.push(`/grupos/${grupo.code}/validar`)}
                            className="inline-flex items-center gap-1.5 border border-[#001631] text-[#001631] hover:bg-[#001631] hover:text-white font-sans font-bold text-[12px] px-3 py-1 rounded transition-colors cursor-pointer"
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                            </svg>
                            Validar
                          </button>
                        ) : (
                          <button
                            onClick={() => router.push(`/grupos/${grupo.code}/ficha`)}
                            className="inline-flex items-center justify-center text-[#475569] hover:text-[#0f172a] p-1.5 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                            title="Ver Ficha Consolidada"
                            aria-label="Ver Ficha"
                          >
                            <EyeIcon />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center">
                      <p className="font-sans text-[13px] text-[#64748b]">
                        No se encontraron grupos de investigación con los filtros seleccionados.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {resultado && resultado.pages > 1 && (
            <div className="flex items-center justify-between border-t border-[#e2e8f0] px-5 py-3.5">
              <span className="font-sans text-[12px] text-[#64748b]">
                Página {resultado.page} de {resultado.pages} · {resultado.total} grupos
              </span>
              <Pagination page={pagina} pages={resultado.pages} onChange={setPagina} />
            </div>
          )}
        </div>

        {/* Bloque de KPIs — al final de la página como indica el diseño */}
        {stats ? (
          <div className="flex flex-wrap gap-4 mt-2">
            <KpiCard label="Total de Grupos"        value={stats.totalGrupos}       sub="Registrados en el sistema" />
            <KpiCard label="Pendientes de Validar"  value={stats.pendientesValidar} sub="Requieren curación de datos" />
            <KpiCard label="Validados Activos"       value={stats.validadosActivos}  sub="Grupos vigentes VRIP" />
            <KpiCard label="Validados Inactivos"     value={stats.validadosInactivos} sub="Grupos dados de baja" />
          </div>
        ) : (
          <div className="flex flex-wrap gap-4 mt-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={`stats-skel-${i}`} className="flex-1 min-w-[160px] bg-white border border-[#e2e8f0] rounded p-5 animate-pulse">
                <div className="h-3 bg-slate-100 rounded w-2/3 mb-2" />
                <div className="h-8 bg-slate-100 rounded w-1/2 mb-2" />
                <div className="h-3 bg-slate-100 rounded w-3/4" />
              </div>
            ))}
          </div>
        )}

      </div>
    </MainLayout>
  );
}
