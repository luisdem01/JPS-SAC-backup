'use client';

/**
 * @file page.tsx
 * @route /SGPI-CFPT  (alias: /publications)
 * @description Tablero de control: Gestión de Publicaciones y Tesis.
 *
 * Pantalla 1 del flujo (pasos 2-3):
 *  - Lista de producciones importadas automáticamente
 *  - Filtros: búsqueda, tipo de producción, estado, indexación
 *  - Indicadores visuales de estado y fuente
 *  - Botón "Vincular" → navegará al detalle (pantalla 2, pendiente)
 *  - EX2 indicado en el badge duplicado (preparado para la siguiente pantalla)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/SGPI-CFU/components/layout';
import type {
  RegistroProduccion, FiltrosProduccion, TipoProduccion, EstadoValidacion, FuenteOrigen,
} from './_data/types';
import { getProducciones, formatFecha } from './_data/service';

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_FILTROS: FiltrosProduccion = {
  buscar:     '',
  tipo:       'todos',
  estado:     'todos',
  indexacion: 'todas',
};

// ─────────────────────────────────────────────────────────────────────────────
// Configuración visual de fuentes (badges)
// ─────────────────────────────────────────────────────────────────────────────

const FUENTE_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  SCOPUS:    { bg: 'bg-[#ede9fe]', text: 'text-[#6d28d9]', label: 'SCOPUS' },
  WOS:       { bg: 'bg-[#fef9c3]', text: 'text-[#854d0e]', label: 'WoS' },
  CYBERTESIS:{ bg: 'bg-[#dbeafe]', text: 'text-[#1e40af]', label: 'CYBERTESIS' },
  MANUAL:    { bg: 'bg-[#f1f5f9]', text: 'text-[#475569]', label: 'MANUAL' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Configuración visual de estados
// ─────────────────────────────────────────────────────────────────────────────

const ESTADO_CONFIG: Record<string, { bg: string; text: string; label: string; dot: string }> = {
  pendiente: { bg: 'bg-[#fef9c3]', text: 'text-[#854d0e]', dot: 'bg-[#ca8a04]', label: '⚠ PENDIENTE CONFIRMAR' },
  validado:  { bg: 'bg-[#dcfce7]', text: 'text-[#166534]', dot: 'bg-[#16a34a]', label: '✓ VALIDADO' },
  rechazado: { bg: 'bg-[#fee2e2]', text: 'text-[#991b1b]', dot: 'bg-[#dc2626]', label: '✗ RECHAZADO' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Íconos
// ─────────────────────────────────────────────────────────────────────────────

const SearchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
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

const ChevronDown = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

const LinkIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
  </svg>
);

const EyeIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

const EmptyIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
    stroke="#94a3b8" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10 9 9 9 8 9"/>
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// Badge de fuente
// ─────────────────────────────────────────────────────────────────────────────

function FuenteBadge({ fuente }: { fuente: string }) {
  const cfg = FUENTE_CONFIG[fuente] ?? FUENTE_CONFIG.MANUAL;
  return (
    <span className={`
      inline-flex items-center px-2 py-0.5 rounded
      font-sans font-bold text-[10px] uppercase tracking-widest
      ${cfg.bg} ${cfg.text}
    `}>
      {cfg.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Badge de estado
// ─────────────────────────────────────────────────────────────────────────────

function EstadoBadge({ estado }: { estado: string }) {
  const cfg = ESTADO_CONFIG[estado] ?? ESTADO_CONFIG.pendiente;
  return (
    <span className={`
      inline-flex items-center gap-1.5 px-2.5 py-1 rounded
      font-sans font-bold text-[10px] uppercase tracking-widest
      ${cfg.bg} ${cfg.text}
    `}>
      {cfg.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Select con flecha
// ─────────────────────────────────────────────────────────────────────────────

function Select({ id, value, onChange, options, label }: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  label: string;
}) {
  return (
    <div className="relative">
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="
          appearance-none pl-3 pr-7 py-2
          font-sans text-[13px] text-on-surface
          bg-surface-container-lowest border border-outline-variant rounded
          outline-none cursor-pointer whitespace-nowrap
          focus:ring-2 focus:ring-[#a8c8fa] focus:border-primary
          transition-all duration-100
        ">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant">
        <ChevronDown />
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────────────────────────────────────

export default function PublicacionesTesisPage() {
  const router = useRouter();

  const [filtros,       setFiltros]       = useState<FiltrosProduccion>(DEFAULT_FILTROS);
  const [tempBuscar,    setTempBuscar]    = useState('');
  const [tempTipo,      setTempTipo]      = useState<string>('todos');
  const [tempEstado,    setTempEstado]    = useState<string>('todos');
  const [tempIndexacion,setTempIndexacion]= useState<string>('todas');
  const [producciones,  setProducciones]  = useState<RegistroProduccion[]>([]);
  const [isLoading,     setIsLoading]     = useState(true);

  // ── Cargar datos ───────────────────────────────────────────────────────────
  const cargar = useCallback(async (f: FiltrosProduccion) => {
    setIsLoading(true);
    try {
      const data = await getProducciones(f);
      setProducciones(data);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { cargar(DEFAULT_FILTROS); }, []);

  // ── Aplicar filtros ────────────────────────────────────────────────────────
  const handleFiltrar = () => {
    const f: FiltrosProduccion = {
      buscar:     tempBuscar,
      tipo:       tempTipo as TipoProduccion | 'todos',
      estado:     tempEstado as EstadoValidacion | 'todos',
      indexacion: tempIndexacion as FuenteOrigen | 'todas',
    };
    setFiltros(f);
    cargar(f);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleFiltrar();
  };

  // ── Contador de pendientes ─────────────────────────────────────────────────
  const pendientesCount = producciones.filter((p) => p.estado === 'pendiente').length;

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <MainLayout title="Sistema de Gestión de Proyectos de Investigación">

      {/* ── Encabezado ────────────────────────────────────────────────────────── */}
      <div className="mb-5">
        <h1 className="font-heading font-semibold text-h1 text-on-surface leading-[38px]">
          Gestión de Publicaciones y Tesis
        </h1>
        <p className="mt-1 font-sans text-body-md text-on-surface-variant">
          Certifique la autoría y calidad de los artículos y tesis detectados en fuentes externas.
        </p>
      </div>

      {/* ── Banner de pendientes ──────────────────────────────────────────────── */}
      {pendientesCount > 0 && !isLoading && (
        <div className="
          flex items-center gap-3 px-4 py-3 mb-5 rounded
          bg-[#fffbeb] border border-[#fde68a]
          font-sans text-[13px] text-[#92400e]
        ">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span>
            <span className="font-bold">{pendientesCount} registro{pendientesCount > 1 ? 's' : ''}</span>
            {' '}pendiente{pendientesCount > 1 ? 's' : ''} de confirmación detectado{pendientesCount > 1 ? 's' : ''}.
          </span>
        </div>
      )}

      {/* ── Tarjeta de filtros + tabla ─────────────────────────────────────────── */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded shadow-level-1 overflow-hidden">

        {/* Barra de filtros */}
        <div className="px-5 py-4 border-b border-outline-variant flex items-end gap-3 flex-wrap">

          {/* Búsqueda */}
          <div className="flex-1 min-w-[180px]">
            <label htmlFor="buscar-prod"
              className="block font-sans font-bold text-[10px] text-on-surface uppercase tracking-widest mb-1.5">
              Buscar
            </label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none">
                <SearchIcon />
              </span>
              <input
                id="buscar-prod" type="text"
                value={tempBuscar}
                onChange={(e) => setTempBuscar(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="DOI, Título o Autor..."
                className="
                  w-full pl-9 pr-3 py-2
                  font-sans text-[13px] text-on-surface
                  border border-outline-variant rounded
                  outline-none
                  focus:ring-2 focus:ring-[#a8c8fa] focus:border-primary
                  transition-all duration-100
                  placeholder:text-on-surface-variant
                "
                aria-label="Buscar por DOI, título o autor"
              />
            </div>
          </div>

          {/* Tipo de producción */}
          <div>
            <label htmlFor="filtro-tipo"
              className="block font-sans font-bold text-[10px] text-on-surface uppercase tracking-widest mb-1.5">
              Tipo de Producción
            </label>
            <Select
              id="filtro-tipo" label="Tipo de producción"
              value={tempTipo} onChange={setTempTipo}
              options={[
                { value: 'todos',    label: 'Todos los tipos' },
                { value: 'articulo', label: 'Artículos Indexados' },
                { value: 'tesis',    label: 'Tesis Académicas' },
              ]}
            />
          </div>

          {/* Estado */}
          <div>
            <label htmlFor="filtro-estado"
              className="block font-sans font-bold text-[10px] text-on-surface uppercase tracking-widest mb-1.5">
              Estados
            </label>
            <Select
              id="filtro-estado" label="Estado de validación"
              value={tempEstado} onChange={setTempEstado}
              options={[
                { value: 'todos',     label: 'Todos los estados' },
                { value: 'pendiente', label: 'Pendientes de Confirmar' },
                { value: 'validado',  label: 'Validados' },
                { value: 'rechazado', label: 'Rechazados' },
              ]}
            />
          </div>

          {/* Fuente de Origen */}
          <div>
            <label htmlFor="filtro-fuente"
              className="block font-sans font-bold text-[10px] text-on-surface uppercase tracking-widest mb-1.5">
              Fuente de Origen
            </label>
            <Select
              id="filtro-fuente" label="Fuente de Origen"
              value={tempIndexacion} onChange={setTempIndexacion}
              options={[
                { value: 'todas',      label: 'Todas' },
                { value: 'MANUAL',     label: 'Manual' },
                { value: 'CYBERTESIS', label: 'Cybertesis' },
              ]}
            />
          </div>

          {/* Botón filtrar */}
          <button
            onClick={handleFiltrar}
            className="
              flex items-center gap-2
              px-5 py-2 rounded
              font-sans font-bold text-[13px] text-white
              bg-[#001631] hover:bg-[#002b54] active:bg-[#001229]
              transition-colors duration-100 self-end
            "
            aria-label="Aplicar filtros"
          >
            <FilterIcon /> Filtrar
          </button>

        </div>

        {/* ── Skeleton ────────────────────────────────────────────────────────── */}
        {isLoading && (
          <div className="divide-y divide-outline-variant">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
                <div className="flex-1 h-4 bg-surface-container-high rounded"/>
                <div className="w-24 h-4 bg-surface-container-high rounded"/>
                <div className="w-16 h-4 bg-surface-container-high rounded"/>
                <div className="w-20 h-5 bg-surface-container-high rounded"/>
                <div className="w-28 h-5 bg-surface-container-high rounded"/>
                <div className="w-20 h-7 bg-surface-container-high rounded"/>
              </div>
            ))}
          </div>
        )}

        {/* ── Sin resultados ────────────────────────────────────────────────────── */}
        {!isLoading && producciones.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <EmptyIcon />
            <p className="font-sans font-semibold text-[14px] text-on-surface mt-4 mb-1">
              No se encontraron registros para los parámetros seleccionados.
            </p>
            <p className="font-sans text-[12px] text-on-surface-variant">
              Ajuste los filtros e intente nuevamente.
            </p>
          </div>
        )}

        {/* ── Tabla ─────────────────────────────────────────────────────────────── */}
        {!isLoading && producciones.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" role="table">
              <thead>
                <tr className="border-b border-outline-variant bg-surface-container-low">
                  {[
                    'Título de la Producción',
                    'Asesor / Grupo de Inv. Detectado',
                    'Fecha',
                    'Fuente de Origen',
                    'Estado de Validación',
                    'Acciones',
                  ].map((h) => (
                    <th key={h}
                      className="px-5 py-3 text-left font-sans font-bold text-[10px] text-on-surface uppercase tracking-widest whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {producciones.map((prod) => (
                  <tr key={prod.id}
                    className={`transition-colors hover:bg-surface-container-low ${prod.estado === 'pendiente' ? 'bg-[#fffef7]' : ''}`}>

                    {/* Título */}
                    <td className="px-5 py-3 max-w-[280px]">
                      <p className="font-sans font-semibold text-[13px] text-on-surface leading-[18px] line-clamp-2">
                        {prod.titulo}
                      </p>
                      {prod.tipo === 'articulo' && prod.doi && (
                        <p className="font-sans text-[11px] text-on-surface-variant mt-0.5">
                          DOI: <span className="font-mono">{prod.doi}</span>
                        </p>
                      )}
                      {prod.tipo === 'tesis' && (
                        <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-[#f0fdf4] text-[#166534]">
                          {prod.tipoTesis ?? 'Tesis'}
                        </span>
                      )}
                    </td>

                    {/* Autor */}
                    <td className="px-5 py-3 font-sans text-[13px] text-on-surface-variant whitespace-nowrap">
                      {prod.autores}
                    </td>

                    {/* Fecha */}
                    <td className="px-5 py-3 font-sans text-[13px] text-on-surface-variant whitespace-nowrap">
                      {formatFecha(prod.fecha)}
                    </td>

                    {/* Fuente */}
                    <td className="px-5 py-3">
                      <FuenteBadge fuente={prod.fuente} />
                    </td>

                    {/* Estado */}
                    <td className="px-5 py-3">
                      <EstadoBadge estado={prod.estado} />
                    </td>

                    {/* Acciones */}
                    <td className="px-5 py-3">
                      {prod.estado === 'pendiente' ? (
                        <button
                          onClick={() => router.push(`/SGPI-CFPT/${prod.id}`)}
                          className="
                            inline-flex items-center gap-1.5
                            px-3 py-1.5 rounded
                            font-sans font-semibold text-[12px] text-on-surface
                            border border-outline-variant
                            hover:bg-surface-container hover:border-primary
                            transition-colors duration-100
                          "
                          aria-label={`Vincular y confirmar: ${prod.titulo}`}
                        >
                          <LinkIcon /> Vincular
                        </button>
                      ) : (
                        <button
                          onClick={() => router.push(`/SGPI-CFPT/${prod.id}`)}
                          className="
                            w-8 h-8 flex items-center justify-center rounded
                            text-on-surface-variant
                            hover:bg-surface-container hover:text-on-surface
                            transition-colors duration-100
                          "
                          aria-label={`Ver detalles: ${prod.titulo}`}
                        >
                          <EyeIcon />
                        </button>
                      )}
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>

    </MainLayout>
  );
}
