'use client';

/**
 * @file page.tsx
 * @route /SGPI-CFPI
 * @description Bandeja principal de Gestión de Proyectos de Investigación (SGPI-CFPI).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/SGPI-CFU/components/layout';
import type { FiltrosProyectos, EstadoProyecto } from './_data/types';
import { getProyectos, getStats, getConvocatorias, type PaginatedProyectos } from './_data/service';
import type { StatsProyectos } from './_data/types';

// ─────────────────────────────────────────────────────────────────────────────
// Configuración visual de badges
// ─────────────────────────────────────────────────────────────────────────────

const ESTADO_CONFIG: Record<EstadoProyecto, { dot: string; text: string; bg: string; label: string }> = {
  pendiente_validar: {
    dot: 'bg-[#d97706]',
    text: 'text-[#92400e]',
    bg: 'bg-[#fef3c7]',
    label: 'PENDIENTE VALIDAR',
  },
  en_ejecucion: {
    dot: 'bg-[#16a34a]',
    text: 'text-[#166534]',
    bg: 'bg-[#dcfce7]',
    label: 'EN EJECUCIÓN',
  },
  concluido: {
    dot: 'bg-[#64748b]',
    text: 'text-[#334155]',
    bg: 'bg-[#f1f5f9]',
    label: 'CONCLUIDO',
  },
};

const DEFAULT_FILTROS: FiltrosProyectos = {
  buscar: '',
  estado: '',
  convocatoria: '',
  inicioPlanificado: '',
};

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

const DocumentIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10 9 9 9 8 9"/>
  </svg>
);

const WarningIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// Componentes de apoyo
// ─────────────────────────────────────────────────────────────────────────────

function EstadoBadge({ estado }: { estado: EstadoProyecto }) {
  const cfg = ESTADO_CONFIG[estado];
  return (
    <span className={`
      inline-flex items-center gap-1 px-2 py-0.5 rounded
      font-sans font-semibold text-[10px] whitespace-nowrap
      ${cfg.bg} ${cfg.text}
    `}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} aria-hidden="true"/>
      {cfg.label}
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

export default function ProyectosBandejaPage() {
  const router = useRouter();

  const [filtros,    setFiltros]    = useState<FiltrosProyectos>(DEFAULT_FILTROS);
  const [tempBuscar, setTempBuscar] = useState('');
  const [tempEstado, setTempEstado] = useState('');
  const [tempConvocatoria, setTempConvocatoria] = useState('');
  const [tempInicio, setTempInicio] = useState('');

  const [resultado, setResultado] = useState<PaginatedProyectos | null>(null);
  const [stats,     setStats]     = useState<StatsProyectos | null>(null);
  const [cargando,  setCargando]  = useState(true);
  const [pagina,    setPagina]    = useState(1);
  const [convocatorias, setConvocatorias] = useState<string[]>([]);

  useEffect(() => {
    async function cargarConvocatorias() {
      try {
        const data = await getConvocatorias();
        if (data && data.length > 0) {
          setConvocatorias(data.map(c => c.titulo_convocatoria));
        } else {
          setConvocatorias([
            'Convocatoria VRIP 2026',
            'Convocatoria VRIP 2025',
            'Convocatoria VRIP 2024',
            'VRIP General'
          ]);
        }
      } catch (err) {
        console.error('Error cargando convocatorias:', err);
        setConvocatorias([
          'Convocatoria VRIP 2026',
          'Convocatoria VRIP 2025',
          'Convocatoria VRIP 2024',
          'VRIP General'
        ]);
      }
    }
    cargarConvocatorias();
  }, []);


  const cargarDatos = useCallback(async () => {
    setCargando(true);
    try {
      const [dataProyectos, dataStats] = await Promise.all([
        getProyectos(filtros, pagina),
        getStats(),
      ]);
      setResultado(dataProyectos);
      setStats(dataStats);
    } catch (error) {
      console.error('Error al cargar proyectos de investigación:', error);
    } finally {
      setCargando(false);
    }
  }, [filtros, pagina]);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  const handleFiltrar = (e: React.FormEvent) => {
    e.preventDefault();
    setPagina(1);
    setFiltros({
      buscar: tempBuscar,
      estado: tempEstado,
      convocatoria: tempConvocatoria,
      inicioPlanificado: tempInicio,
    });
  };

  const handleLimpiar = () => {
    setTempBuscar(''); setTempEstado(''); setTempConvocatoria(''); setTempInicio('');
    setPagina(1);
    setFiltros(DEFAULT_FILTROS);
  };

  const hayFiltrosActivos = filtros.buscar || filtros.estado || filtros.convocatoria || filtros.inicioPlanificado;

  return (
    <MainLayout
      title="Gestión de Proyectos de Investigación"
      subtitle="Certifique, audite y monitorea los hitos de los proyectos importados del RAIS y VRIP."
    >
      <div className="flex flex-col gap-5">

        {/* Header: título + botón Nuevo Proyecto */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-heading font-semibold text-h1 text-on-surface leading-[38px]">
              Gestión de Proyectos de Investigación
            </h1>
            <p className="mt-1 font-sans text-body-md text-on-surface-variant">
              Certifique, audite y monitorea los hitos de los proyectos importados del RAIS y VRIP.
            </p>
          </div>
          <button
            onClick={() => router.push('/SGPI-CFPI/nuevo')}
            className="flex items-center gap-1.5 bg-[#001631] hover:bg-[#002b54] text-white font-sans font-bold text-[13px] px-4 py-2 rounded shadow transition-colors cursor-pointer whitespace-nowrap flex-shrink-0"
          >
            <PlusIcon />
            Nuevo Proyecto
          </button>
        </div>

        {/* Barra de Filtros */}
        <form onSubmit={handleFiltrar} className="flex flex-wrap items-end gap-3 bg-surface-container-lowest border border-outline-variant rounded p-4 shadow-level-1">

          {/* Búsqueda */}
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="buscar" className="block font-sans font-bold text-[10px] text-on-surface-variant uppercase tracking-widest mb-1.5">
              BUSCAR
            </label>
            <div className="relative">
              <input
                id="buscar"
                type="text"
                placeholder="Cód RAIS, Título o Resp..."
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
            <label htmlFor="filtro-estado" className="block font-sans font-bold text-[10px] text-on-surface-variant uppercase tracking-widest mb-1.5">
              ESTADO
            </label>
            <Select
              id="filtro-estado"
              value={tempEstado}
              onChange={setTempEstado}
              label="Filtrar por Estado"
              options={[
                { value: '',                      label: 'Pendientes de Validación' },
                { value: 'pendiente_validar',     label: 'Pendiente Validar' },
                { value: 'en_ejecucion',          label: 'En Ejecución' },
                { value: 'concluido',             label: 'Concluido' },
              ]}
            />
          </div>

          {/* Convocatoria */}
          <div className="w-[170px]">
            <label htmlFor="filtro-convocatoria" className="block font-sans font-bold text-[10px] text-on-surface-variant uppercase tracking-widest mb-1.5">
              CONVOCATORIA
            </label>
            <Select
              id="filtro-convocatoria"
              value={tempConvocatoria}
              onChange={setTempConvocatoria}
              label="Filtrar por Convocatoria"
              options={[
                { value: '', label: 'Todas' },
                ...convocatorias.map(c => ({ value: c, label: c }))
              ]}
            />
          </div>

          {/* Inicio Planificado */}
          <div className="w-[150px]">
            <label htmlFor="filtro-inicio" className="block font-sans font-bold text-[10px] text-on-surface-variant uppercase tracking-widest mb-1.5">
              INICIO PLANIFICADO
            </label>
            <input
              id="filtro-inicio"
              type="date"
              value={tempInicio}
              onChange={(e) => setTempInicio(e.target.value)}
              className="w-full px-3 py-[6px] font-sans text-[13px] text-on-surface bg-surface-container-lowest border border-[#e2e8f0] rounded outline-none focus:ring-2 focus:ring-[#a8c8fa] transition-all"
            />
          </div>

          {/* Botones */}
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex items-center gap-1.5 bg-[#001631] hover:bg-[#002b54] text-white font-sans font-bold text-[13px] px-4 py-[7px] rounded transition-colors cursor-pointer"
            >
              <FilterIcon />
              Filtrar
            </button>
            {hayFiltrosActivos && (
              <button
                type="button"
                onClick={handleLimpiar}
                className="border border-[#e2e8f0] hover:bg-slate-50 font-sans text-[13px] text-on-surface-variant px-4 py-[7px] rounded transition-colors cursor-pointer"
              >
                Limpiar
              </button>
            )}
          </div>
        </form>

        {/* Tabla de Proyectos */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded shadow-level-1 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-outline-variant bg-surface-container-low">
                  <th scope="col" className="px-5 py-3 font-sans font-bold text-[10px] text-on-surface-variant uppercase tracking-widest whitespace-nowrap w-[130px]">
                    CÓD. RAIS
                  </th>
                  <th scope="col" className="px-5 py-3 font-sans font-bold text-[10px] text-on-surface-variant uppercase tracking-widest whitespace-nowrap">
                    TÍTULO DEL PROYECTO
                  </th>
                  <th scope="col" className="px-5 py-3 font-sans font-bold text-[10px] text-on-surface-variant uppercase tracking-widest whitespace-nowrap w-[180px]">
                    RESP. PRINCIPAL
                  </th>
                  <th scope="col" className="px-5 py-3 font-sans font-bold text-[10px] text-on-surface-variant uppercase tracking-widest whitespace-nowrap w-[180px]">
                    GRUPO INV.
                  </th>
                  <th scope="col" className="px-5 py-3 font-sans font-bold text-[10px] text-on-surface-variant uppercase tracking-widest whitespace-nowrap w-[190px]">
                    ESTADO / ALERTAS
                  </th>
                  <th scope="col" className="px-5 py-3 font-sans font-bold text-[10px] text-on-surface-variant uppercase tracking-widest whitespace-nowrap w-[110px] text-right">
                    ACCIONES
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {cargando ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={`skel-${i}`} className="animate-pulse">
                      <td className="px-5 py-4"><div className="h-4 bg-slate-100 rounded w-16" /></td>
                      <td className="px-5 py-4"><div className="h-4 bg-slate-100 rounded w-5/6" /></td>
                      <td className="px-5 py-4"><div className="h-4 bg-slate-100 rounded w-28" /></td>
                      <td className="px-5 py-4"><div className="h-4 bg-slate-100 rounded w-32" /></td>
                      <td className="px-5 py-4"><div className="h-8 bg-slate-100 rounded w-24" /></td>
                      <td className="px-5 py-4 text-right"><div className="h-7 bg-slate-100 rounded w-14 ml-auto" /></td>
                    </tr>
                  ))
                ) : resultado && resultado.items.length > 0 ? (
                  resultado.items.map((proy) => {
                    const isPendiente = proy.status === 'pendiente_validar';

                    // Config de Alertas específicas dinámicas
                    let alertaElement = null;
                    const tieneHitoVencido = proy.hitos?.some((hito) => {
                      if (hito.estado !== 'pendiente' || !hito.fechaVencimiento) return false;
                      const limite = new Date(hito.fechaVencimiento);
                      return !isNaN(limite.getTime()) && limite < new Date();
                    });

                    if (proy.fuente && (proy.fuente.toLowerCase().includes('ocr') || proy.fuente.toLowerCase().includes('extrac'))) {
                      alertaElement = (
                        <span className="inline-flex mt-1 text-[10px] font-sans font-medium px-1.5 py-0.5 rounded bg-[#f3e8ff] text-[#6b21a8] uppercase tracking-wider">
                          Extracción OCR (RR)
                        </span>
                      );
                    } else if (tieneHitoVencido) {
                      alertaElement = (
                        <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-sans font-semibold px-1.5 py-0.5 rounded bg-[#fee2e2] text-[#b91c1c] uppercase tracking-wider">
                          <WarningIcon />
                          Hito Vencido
                        </span>
                      );
                    }

                    return (
                      <tr key={proy.code} className="hover:bg-surface-container-low/40 transition-colors">
                        <td className="px-5 py-3.5 font-sans text-[13px] text-on-surface-variant">
                          {proy.code}
                        </td>
                        <td className="px-5 py-3.5 font-sans text-[13px] text-on-surface font-semibold max-w-[320px]">
                          {proy.title}
                        </td>
                        <td className="px-5 py-3.5 font-sans text-[13px] text-on-surface-variant font-medium">
                          {proy.responsablePrincipal}
                        </td>
                        <td className="px-5 py-3.5 font-sans text-[13px] text-[#475569]">
                          {proy.grupoVinculado}
                        </td>
                        <td className="px-5 py-3.5 flex flex-col items-start justify-center">
                          <EstadoBadge estado={proy.status} />
                          {alertaElement}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {isPendiente ? (
                            <button
                              onClick={() => router.push(`/SGPI-CFPI/${proy.code}/validar`)}
                              className="inline-flex items-center gap-1 border border-[#001631] text-[#001631] hover:bg-[#001631] hover:text-white font-sans font-bold text-[12px] px-3 py-1 rounded transition-colors cursor-pointer"
                            >
                              <DocumentIcon />
                              Gestionar
                            </button>
                          ) : (
                            <button
                              onClick={() => router.push(`/SGPI-CFPI/${proy.code}`)}
                              className="inline-flex items-center justify-center text-[#475569] hover:text-[#001631] p-1.5 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                              title="Ver Expediente Digital"
                              aria-label="Ver Expediente"
                            >
                              <EyeIcon />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center">
                      <p className="font-sans text-[13px] text-[#64748b]">
                        No se encontraron proyectos con los filtros seleccionados.
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
                Página {resultado.page} de {resultado.pages} · {resultado.total} proyectos
              </span>
              <Pagination page={pagina} pages={resultado.pages} onChange={setPagina} />
            </div>
          )}
        </div>

      </div>
    </MainLayout>
  );
}
