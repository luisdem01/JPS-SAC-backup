'use client';

/**
 * @file [id]/page.tsx
 * @route /publicaciones/[id]
 * @description Página de detalle de una producción académica.
 *
 * Muestra dos vistas según el estado del registro:
 *  - 'pendiente' → Pantalla de validación con dos pestañas:
 *      Tab 1: Metadata Técnica (campos editables)
 *      Tab 2: Vinculación de Investigadores (EX1)
 *    Botones: Descartar | Cancelar | Confirmar y Persistir
 *  - 'validado'  → Repositorio de Producción Validada
 *
 * EX2 (DOI duplicado): validado al salir del campo DOI, bloquea confirmación.
 * EX1 (corrección de vínculo): modal de búsqueda de investigadores.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { MainLayout } from '@/SGPI-CFU/components/layout';
import type {
  RegistroProduccion, InvestigadorVinculado, InvestigadorResumen,
  RolPublicacion, Cuartil, GrupoInvestigacionResumen
} from '../_data/types';
import {
  getProduccionById, confirmarProduccion, validarDOI, buscarInvestigadores, buscarGrupos, importarTesis
} from '../_data/service';

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────

const ROLES: RolPublicacion[] = ['Autor Principal', 'Coautor', 'Asesor', 'Coasesor', 'Colaborador'];

const INDEXACIONES = ['Scopus', 'WoS', 'Cybertesis', 'IEEE Xplore', 'PubMed', 'Otras'];

const CUARTILES: Cuartil[] = ['Q1', 'Q2', 'Q3', 'Q4', null];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatFechaLarga(iso: string): string {
  return new Date(iso).toLocaleDateString('es-PE', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

function formatFuente(fuente: string): string {
  const map: Record<string, string> = {
    SCOPUS: 'API Scopus', WOS: 'API Web of Science',
    CYBERTESIS: 'Repositorio Cybertesis', MANUAL: 'Registro Manual',
  };
  return map[fuente] ?? fuente;
}

// ─────────────────────────────────────────────────────────────────────────────
// Íconos
// ─────────────────────────────────────────────────────────────────────────────

const ArrowLeftIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);
const DocIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);
const LinkPersonIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
  </svg>
);
const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" /><path d="M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);
const CheckIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const ExternalLinkIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);
const BackArrowIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);
const ConstanciaIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <polyline points="9 15 11 17 15 13" />
  </svg>
);
const UserIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);
const UsersIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const InfoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);
const StarIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// Modal Buscar Investigador (EX1)
// ─────────────────────────────────────────────────────────────────────────────

function BuscarInvestigadorModal({
  onSelect, onClose, excluirIds,
}: {
  onSelect: (inv: InvestigadorResumen) => void;
  onClose: () => void;
  excluirIds: string[];
}) {
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState<InvestigadorResumen[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const buscar = useCallback(async (query: string) => {
    setLoading(true);
    const res = await buscarInvestigadores(query);
    setResultados(res.filter((r) => !excluirIds.includes(r.id)));
    setLoading(false);
  }, [excluirIds]);

  useEffect(() => { inputRef.current?.focus(); buscar(''); }, [buscar]);

  const handleChange = (v: string) => { setQ(v); buscar(v); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog" aria-modal="true" aria-label="Buscar investigador FISI">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-[480px] bg-white rounded-xl shadow-2xl border border-[#e2e8f0] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SearchIcon />
            <h2 className="font-heading font-bold text-[15px] text-on-surface">
              Buscar Investigador FISI
            </h2>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface text-[20px] leading-none font-light" aria-label="Cerrar">×</button>
        </div>
        {/* Buscador */}
        <div className="px-5 py-3 border-b border-[#e2e8f0]">
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"><SearchIcon /></span>
            <input ref={inputRef} type="text" value={q}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="Nombre o DNI del investigador..."
              className="w-full pl-9 pr-3 py-2 font-sans text-[13px] text-on-surface border border-outline-variant rounded outline-none focus:ring-2 focus:ring-[#a8c8fa] transition-all"
            />
          </div>
        </div>
        {/* Resultados */}
        <div className="overflow-y-auto max-h-[300px]">
          {loading && (
            <div className="py-8 text-center font-sans text-[13px] text-on-surface-variant">Buscando...</div>
          )}
          {!loading && resultados.length === 0 && (
            <div className="py-8 text-center font-sans text-[13px] text-on-surface-variant">No se encontraron investigadores.</div>
          )}
          {!loading && resultados.map((inv) => (
            <button key={inv.id} onClick={() => onSelect(inv)}
              className="w-full flex items-start gap-3 px-5 py-3 text-left hover:bg-surface-container-low border-b border-[#f1f5f9] transition-colors group">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[#dbeafe] text-[#1d4ed8] flex items-center justify-center text-[11px] font-bold">
                {inv.nombre.split(',')[0]?.charAt(0) ?? '?'}
              </span>
              <div>
                <p className="font-sans font-semibold text-[13px] text-on-surface group-hover:text-[#001631]">{inv.nombre}</p>
                <p className="font-sans text-[11px] text-on-surface-variant">{inv.grupo ?? inv.departamento} · DNI: {inv.dni}</p>
              </div>
            </button>
          ))}
        </div>
        <div className="px-5 py-3 bg-[#f8fafc] border-t border-[#e2e8f0]">
          <p className="font-sans text-[11px] text-on-surface-variant">
            Nota: Solo se muestran investigadores pertenecientes a la FISI.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal Buscar Grupo de Investigación
// ─────────────────────────────────────────────────────────────────────────────

function BuscarGrupoModal({
  onSelect, onClose
}: {
  onSelect: (grupo: GrupoInvestigacionResumen) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState<GrupoInvestigacionResumen[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const buscar = useCallback(async (query: string) => {
    setLoading(true);
    const res = await buscarGrupos(query);
    setResultados(res);
    setLoading(false);
  }, []);

  useEffect(() => { inputRef.current?.focus(); buscar(''); }, [buscar]);

  const handleChange = (v: string) => { setQ(v); buscar(v); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog" aria-modal="true" aria-label="Buscar grupo de investigación">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-[480px] bg-white rounded-xl shadow-2xl border border-[#e2e8f0] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SearchIcon />
            <h2 className="font-heading font-bold text-[15px] text-on-surface">
              Buscar Grupo de Investigación
            </h2>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface text-[20px] leading-none font-light" aria-label="Cerrar">×</button>
        </div>
        {/* Buscador */}
        <div className="px-5 py-3 border-b border-[#e2e8f0]">
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"><SearchIcon /></span>
            <input ref={inputRef} type="text" value={q}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="Nombre o siglas del grupo..."
              className="w-full pl-9 pr-3 py-2 font-sans text-[13px] text-on-surface border border-outline-variant rounded outline-none focus:ring-2 focus:ring-[#a8c8fa] transition-all"
            />
          </div>
        </div>
        {/* Resultados */}
        <div className="overflow-y-auto max-h-[300px]">
          {loading && (
            <div className="py-8 text-center font-sans text-[13px] text-on-surface-variant">Buscando...</div>
          )}
          {!loading && resultados.length === 0 && (
            <div className="py-8 text-center font-sans text-[13px] text-on-surface-variant">No se encontraron grupos.</div>
          )}
          {!loading && resultados.map((g) => (
            <button key={g.id} onClick={() => onSelect(g)}
              className="w-full flex items-start gap-3 px-5 py-3 text-left hover:bg-surface-container-low border-b border-[#f1f5f9] transition-colors group">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[#fce7f3] text-[#be185d] flex items-center justify-center text-[11px] font-bold">
                {g.siglas ? g.siglas.substring(0,2) : g.nombre.substring(0,2).toUpperCase()}
              </span>
              <div>
                <p className="font-sans font-semibold text-[13px] text-on-surface group-hover:text-[#001631]">{g.nombre}</p>
                <p className="font-sans text-[11px] text-on-surface-variant">{g.siglas ?? 'Sin siglas'} · {g.facultad}</p>
              </div>
            </button>
          ))}
        </div>
        <div className="px-5 py-3 bg-[#f8fafc] border-t border-[#e2e8f0]">
          <p className="font-sans text-[11px] text-on-surface-variant">
            Nota: Solo se muestran grupos de investigación activos de la facultad.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Select reutilizable
// ─────────────────────────────────────────────────────────────────────────────

function ChevronDown() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function InlineSelect({ id, value, onChange, options, className = '' }: {
  id: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none pl-3 pr-7 py-2 font-sans text-[13px] text-on-surface border border-outline-variant rounded bg-surface-container-lowest outline-none focus:ring-2 focus:ring-[#a8c8fa] cursor-pointer transition-all">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant">
        <ChevronDown />
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Metadata Técnica
// ─────────────────────────────────────────────────────────────────────────────

interface MetaState {
  titulo: string; doi: string; revista: string;
  issn: string; volNum: string;
  indexacion: string; cuartil: string;
  // tesis extra
  tesista?: string; tipoTesis?: string; urlCybertesis?: string;
}

function TabMetadata({
  prod, meta, onChange, doiError,
  onBlurDOI,
}: {
  prod: RegistroProduccion;
  meta: MetaState;
  onChange: (k: keyof MetaState, v: string) => void;
  doiError: string | null;
  onBlurDOI: () => void;
}) {
  const inputCls = "w-full px-3 py-2 font-sans text-[13px] text-on-surface border border-outline-variant rounded outline-none focus:ring-2 focus:ring-[#a8c8fa] transition-all";

  return (
    <div className="p-5">
      <div className="border border-outline-variant rounded overflow-hidden">
        <div className="px-5 py-4 flex flex-col gap-4">

          {/* Título */}
          <div>
            <label htmlFor="meta-titulo" className="block font-sans font-bold text-[10px] text-on-surface uppercase tracking-widest mb-1.5">
              Título de la Publicación
            </label>
            <input id="meta-titulo" type="text" value={meta.titulo}
              onChange={(e) => onChange('titulo', e.target.value)}
              className={inputCls} aria-label="Título de la publicación"
            />
          </div>

          {/* Tesis fields */}
          {prod.tipo === 'tesis' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="meta-tesista" className="block font-sans font-bold text-[10px] text-on-surface uppercase tracking-widest mb-1.5">Tesista</label>
                <input id="meta-tesista" type="text" value={meta.tesista ?? ''}
                  onChange={(e) => onChange('tesista', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label htmlFor="meta-tipo-tesis" className="block font-sans font-bold text-[10px] text-on-surface uppercase tracking-widest mb-1.5">Tipo de Tesis</label>
                <InlineSelect id="meta-tipo-tesis" value={meta.tipoTesis ?? 'Pregrado'}
                  onChange={(v) => onChange('tipoTesis', v)}
                  options={['Pregrado', 'Maestría', 'Doctorado'].map((t) => ({ value: t, label: t }))}
                />
              </div>
              {meta.urlCybertesis !== undefined && (
                <div className="md:col-span-2">
                  <label htmlFor="meta-url" className="block font-sans font-bold text-[10px] text-on-surface uppercase tracking-widest mb-1.5">URL Cybertesis</label>
                  <input id="meta-url" type="url" value={meta.urlCybertesis}
                    onChange={(e) => onChange('urlCybertesis', e.target.value)} className={inputCls} />
                </div>
              )}
            </div>
          )}

          {/* DOI + Revista */}
          {prod.tipo === 'articulo' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="meta-doi" className="font-sans font-bold text-[10px] text-on-surface uppercase tracking-widest">DOI</label>
                    {meta.doi && (
                      <a href={`https://doi.org/${meta.doi}`} target="_blank" rel="noopener noreferrer"
                        className="font-sans text-[10px] text-[#2563eb] hover:underline flex items-center gap-1">
                        <CheckIcon /> Verificar Enlace
                      </a>
                    )}
                  </div>
                  <input id="meta-doi" type="text" value={meta.doi}
                    onChange={(e) => onChange('doi', e.target.value)}
                    onBlur={onBlurDOI}
                    className={`${inputCls} ${doiError ? 'border-[#dc2626] focus:ring-[#fca5a5]' : ''}`}
                    aria-describedby={doiError ? 'doi-error' : undefined}
                  />
                  {doiError && (
                    <p id="doi-error" role="alert" className="mt-1 font-sans text-[11px] text-[#dc2626]">{doiError}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="meta-revista" className="block font-sans font-bold text-[10px] text-on-surface uppercase tracking-widest mb-1.5">Revista Científica</label>
                  <input id="meta-revista" type="text" value={meta.revista}
                    onChange={(e) => onChange('revista', e.target.value)} className={inputCls} />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label htmlFor="meta-issn" className="block font-sans font-bold text-[10px] text-on-surface uppercase tracking-widest mb-1.5">ISSN</label>
                  <input id="meta-issn" type="text" value={meta.issn}
                    onChange={(e) => onChange('issn', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label htmlFor="meta-vol" className="block font-sans font-bold text-[10px] text-on-surface uppercase tracking-widest mb-1.5">Vol / Núm</label>
                  <input id="meta-vol" type="text" value={meta.volNum}
                    onChange={(e) => onChange('volNum', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label htmlFor="meta-indexacion" className="block font-sans font-bold text-[10px] text-on-surface uppercase tracking-widest mb-1.5">Indexación</label>
                  <InlineSelect id="meta-indexacion" value={meta.indexacion}
                    onChange={(v) => onChange('indexacion', v)}
                    options={INDEXACIONES.map((i) => ({ value: i, label: i }))}
                  />
                </div>
                <div>
                  <label htmlFor="meta-cuartil" className="block font-sans font-bold text-[10px] text-on-surface uppercase tracking-widest mb-1.5">Cuartil</label>
                  <InlineSelect id="meta-cuartil" value={meta.cuartil}
                    onChange={(v) => onChange('cuartil', v)}
                    options={[
                      { value: '', label: 'Sin cuartil' },
                      ...(['Q1', 'Q2', 'Q3', 'Q4'].map((q) => ({ value: q, label: q }))),
                    ]}
                  />
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Vinculación de Investigadores
// ─────────────────────────────────────────────────────────────────────────────

function TabVinculacion({
  vinculados, onRolChange, onRemove, onBuscar,
}: {
  vinculados: InvestigadorVinculado[];
  onRolChange: (idx: number, rol: RolPublicacion) => void;
  onRemove: (idx: number) => void;
  onBuscar: () => void;
}) {
  return (
    <div className="p-5">
      <div className="border border-outline-variant rounded overflow-x-auto">
        {/* Header tabla */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-outline-variant">
          <p className="font-sans font-bold text-[11px] text-on-surface uppercase tracking-widest">
            Investigadores Validados en la Publicación
          </p>
          <button onClick={onBuscar}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded font-sans font-semibold text-[12px] text-on-surface border border-outline-variant hover:bg-surface-container transition-colors"
            aria-label="Buscar investigador manualmente">
            <SearchIcon /> Buscar Manualmente
          </button>
        </div>

        {/* Cabecera */}
        <div className="grid grid-cols-[1fr_1fr_1fr_40px] gap-0 border-b border-outline-variant bg-surface-container-low px-5 py-2 min-w-[650px]">
          {['Investigador FISI', 'Grupo de Inv. Afectado', 'Rol en Publicación', 'Acción'].map((h) => (
            <span key={h} className="font-sans font-bold text-[10px] text-on-surface uppercase tracking-widest">{h}</span>
          ))}
        </div>

        {/* Filas */}
        {vinculados.map((v, idx) => (
          <div key={v.investigador.id}
            className="grid grid-cols-[1fr_1fr_1fr_40px] gap-0 items-center px-5 py-3 border-b border-outline-variant last:border-0 hover:bg-surface-container-low transition-colors min-w-[650px]">
            {/* Investigador */}
            <div className="flex items-center gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#dcfce7] flex items-center justify-center" aria-label="Investigador validado">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                  stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
              <div>
                <p className="font-sans font-semibold text-[13px] text-on-surface">{v.investigador.nombre}</p>
                <p className="font-sans text-[11px] text-on-surface-variant">DNI: {v.investigador.dni}</p>
              </div>
            </div>
            {/* Grupo */}
            <p className="font-sans text-[13px] text-on-surface-variant pr-4">
              {v.investigador.grupo ?? v.investigador.departamento}
            </p>
            {/* Rol */}
            <div className="pr-4">
              <InlineSelect id={`rol-${idx}`} value={v.rol}
                onChange={(val) => onRolChange(idx, val as RolPublicacion)}
                options={ROLES.map((r) => ({ value: r, label: r }))}
              />
            </div>
            {/* Eliminar */}
            <button onClick={() => onRemove(idx)}
              className="w-8 h-8 flex items-center justify-center rounded text-[#dc2626] hover:bg-[#fee2e2] transition-colors"
              aria-label={`Eliminar vínculo con ${v.investigador.nombre}`}>
              <TrashIcon />
            </button>
          </div>
        ))}

        {/* Sin vinculados */}
        {vinculados.length === 0 && (
          <div className="px-5 py-5 text-center">
            <p className="font-sans text-[12px] text-on-surface-variant">No se han vinculado investigadores de la facultad a este registro.</p>
          </div>
        )}

        {/* Mensaje vacío adicional */}
        {vinculados.length > 0 && (
          <div className="px-5 py-3 bg-surface-container border-t border-outline-variant">
            <p className="font-sans text-[12px] text-on-surface-variant italic">
              No se han vinculado más investigadores de la facultad a este registro.
            </p>
          </div>
        )}
      </div>
      <p className="font-sans text-[11px] text-on-surface-variant mt-3">
        <span className="font-semibold">Nota:</span> Solo se deben vincular investigadores pertenecientes a la FISI para el cálculo de carga académica.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Vinculación de Grupo de Investigación
// ─────────────────────────────────────────────────────────────────────────────

function TabVinculacionGrupo({
  grupoVinculado, onRemove, onBuscar,
}: {
  grupoVinculado: GrupoInvestigacionResumen | null;
  onRemove: () => void;
  onBuscar: () => void;
}) {
  return (
    <div className="p-5">
      <div className="border border-outline-variant rounded overflow-hidden">
        {/* Header tabla */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-outline-variant">
          <p className="font-sans font-bold text-[11px] text-on-surface uppercase tracking-widest">
            Grupo de Investigación Vinculado
          </p>
          {!grupoVinculado && (
            <button onClick={onBuscar}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded font-sans font-semibold text-[12px] text-on-surface border border-outline-variant hover:bg-surface-container transition-colors"
              aria-label="Vincular grupo">
              <SearchIcon /> Vincular Grupo
            </button>
          )}
        </div>

        {/* Filas */}
        {grupoVinculado ? (
          <div className="grid grid-cols-[1fr_40px] gap-0 items-center px-5 py-3 hover:bg-surface-container-low transition-colors">
            <div className="flex items-center gap-3">
              <span className="flex-shrink-0 w-10 h-10 rounded-full bg-[#fce7f3] flex items-center justify-center text-[14px] text-[#be185d] font-bold">
                {grupoVinculado.siglas ? grupoVinculado.siglas.substring(0,2) : grupoVinculado.nombre.substring(0,2).toUpperCase()}
              </span>
              <div>
                <p className="font-sans font-semibold text-[14px] text-on-surface">{grupoVinculado.nombre}</p>
                <p className="font-sans text-[12px] text-on-surface-variant">{grupoVinculado.siglas ?? 'Sin siglas'} · {grupoVinculado.facultad}</p>
              </div>
            </div>
            <button onClick={onRemove}
              className="w-8 h-8 flex items-center justify-center rounded text-[#dc2626] hover:bg-[#fee2e2] transition-colors"
              aria-label={`Eliminar vínculo con ${grupoVinculado.nombre}`}>
              <TrashIcon />
            </button>
          </div>
        ) : (
          <div className="px-5 py-5 text-center">
            <p className="font-sans text-[12px] text-on-surface-variant">No se ha vinculado ningún grupo de investigación a este artículo.</p>
          </div>
        )}
      </div>
      <p className="font-sans text-[11px] text-on-surface-variant mt-3">
        <span className="font-semibold">Nota:</span> Es obligatorio vincular un grupo de investigación activo para validar un artículo científico.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Vista: Repositorio de Producción Validada
// ─────────────────────────────────────────────────────────────────────────────

function VistaValidada({ prod, onVolver }: { prod: RegistroProduccion; onVolver: () => void }) {
  const tipoLabel = prod.tipo === 'articulo' ? 'Artículo Indexado' : 'Tesis Académica';
  const fuenteLabel = `Validado desde ${formatFuente(prod.fuente)}`;

  const cuartilColor: Record<string, string> = {
    Q1: '#001631', Q2: '#1e40af', Q3: '#0f766e', Q4: '#6d28d9',
  };
  const cuartil = prod.cuartil;

  return (
    <div>
      {/* Encabezado de módulo */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="font-heading font-semibold text-h1 text-on-surface">Repositorio de Producción Validada</h1>
          <p className="font-sans text-body-md text-on-surface-variant mt-0.5">
            Activo académico certificado para el legajo docente y reporte POI.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={onVolver}
            className="flex items-center gap-1.5 px-4 py-2 rounded font-sans font-semibold text-[13px] text-on-surface border border-outline-variant hover:bg-surface-container transition-colors"
            aria-label="Volver a la bandeja">
            <BackArrowIcon /> Volver a Bandeja
          </button>
        </div>
      </div>

      {/* Layout 2 columnas */}
      <div className="flex gap-5 flex-wrap lg:flex-nowrap">

        {/* ── Columna principal ──────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">

          {/* Card: ficha */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded shadow-level-1 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-outline-variant bg-surface-container-low">
              <span className="font-sans font-bold text-[10px] text-on-surface uppercase tracking-widest">
                {tipoLabel}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#dcfce7] font-sans font-bold text-[10px] text-[#166534] uppercase tracking-widest">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                Validado
              </span>
            </div>
            <div className="px-5 py-5 flex flex-col gap-4">
              {/* Título */}
              <h2 className="font-heading font-bold text-[18px] text-on-surface leading-[26px]">
                {prod.titulo}
              </h2>

              {/* Autores validados o Grupo */}
              <div>
                <p className="font-sans font-bold text-[10px] text-on-surface uppercase tracking-widest mb-2">
                  {prod.tipo === 'articulo' ? 'Grupo de Investigación Validado' : 'Autores Validados (FISI)'}
                </p>
                {prod.tipo === 'articulo' ? (
                  prod.grupoVinculado ? (
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 flex items-center justify-center rounded-full bg-[#fce7f3] text-[#be185d]">
                        <UsersIcon />
                      </span>
                      <span className="font-sans font-semibold text-[13px] text-on-surface">{prod.grupoVinculado.nombre}</span>
                    </div>
                  ) : (
                    <p className="font-sans text-[13px] text-on-surface-variant">Sin grupo vinculado.</p>
                  )
                ) : (
                  (prod.investigadoresVinculados || []).length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {(prod.investigadoresVinculados || []).map((v) => (
                        <span key={v.investigador.id} className="flex items-center gap-1.5 font-sans text-[13px] text-[#166534]">
                          <span className="w-4 h-4 flex items-center justify-center rounded-full bg-[#dcfce7]">
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                          </span>
                          <span className="font-semibold">{v.investigador.nombre}</span>
                          <span className="text-on-surface-variant text-[12px]">({v.rol})</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="font-sans text-[13px] text-on-surface-variant">Sin investigadores vinculados.</p>
                  )
                )}
              </div>

              {/* Fuente + DOI */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-outline-variant">
                <div>
                  <p className="font-sans font-bold text-[10px] text-on-surface uppercase tracking-widest mb-1">Fuente Origen</p>
                  <p className="font-sans text-[13px] text-on-surface-variant">{fuenteLabel}</p>
                </div>
                {prod.doi && (
                  <div>
                    <p className="font-sans font-bold text-[10px] text-on-surface uppercase tracking-widest mb-1">Enlace Directo</p>
                    <a href={`https://doi.org/${prod.doi}`} target="_blank" rel="noopener noreferrer"
                      className="font-mono text-[12px] text-[#2563eb] hover:underline flex items-center gap-1">
                      {prod.doi} <ExternalLinkIcon />
                    </a>
                  </div>
                )}
                {prod.urlCybertesis && (
                  <div>
                    <p className="font-sans font-bold text-[10px] text-on-surface uppercase tracking-widest mb-1">URL Cybertesis</p>
                    <a href={prod.urlCybertesis} target="_blank" rel="noopener noreferrer"
                      className="font-sans text-[12px] text-[#2563eb] hover:underline flex items-center gap-1">
                      Ver en repositorio <ExternalLinkIcon />
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Card: Impacto */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded shadow-level-1 overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-outline-variant">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              <span className="font-sans font-bold text-[11px] text-on-surface uppercase tracking-widest">
                Impacto en Productividad Científica
              </span>
            </div>
            <div className="px-5 py-4 flex flex-col gap-3">
              <p className="font-sans text-[13px] text-on-surface-variant leading-[20px]">
                Esta publicación ha sido contabilizada exitosamente y sumará a los siguientes indicadores institucionales:
              </p>

              {/* Indicador 1: Memoria de Grupo (para artículos) */}
              {prod.tipo === 'articulo' && prod.grupoVinculado && (
                <div className="flex items-center gap-3 p-3 rounded border border-outline-variant hover:bg-surface-container-low transition-colors">
                  <span className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-[#ede9fe] text-[#6d28d9]">
                    <UsersIcon />
                  </span>
                  <div className="flex-1">
                    <p className="font-sans font-bold text-[13px] text-on-surface">Memoria de Grupo de Investigación</p>
                    <p className="font-sans text-[12px] text-on-surface-variant">
                      Suma como 1 artículo{prod.cuartil ? ` ${prod.cuartil}` : ''} al perfil del grupo{' '}
                      <span className="font-semibold text-[#001631]">{prod.grupoVinculado.nombre}</span> para el periodo 2026-1.
                    </p>
                  </div>
                  <span className="flex-shrink-0 px-2.5 py-1 rounded bg-[#dcfce7] text-[#166534] font-sans font-bold text-[12px]">+1</span>
                </div>
              )}

              {/* Indicadores Tesis */}
              {prod.tipo === 'tesis' && (prod.investigadoresVinculados || []).map((v) => (
                <div key={`carga-${v.investigador.id}`}
                  className="flex items-center gap-3 p-3 rounded border border-outline-variant hover:bg-surface-container-low transition-colors">
                  <span className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-[#dbeafe] text-[#1d4ed8]">
                    <UserIcon />
                  </span>
                  <div className="flex-1">
                    <p className="font-sans font-bold text-[13px] text-on-surface">Carga No Lectiva (Docente)</p>
                    <p className="font-sans text-[12px] text-on-surface-variant">
                      Suma como 1 tesis al perfil de{' '}
                      <span className="font-semibold text-[#001631]">{v.investigador.nombre}</span> para el periodo 2026-1.
                    </p>
                  </div>
                  <span className="flex-shrink-0 px-2.5 py-1 rounded bg-[#dcfce7] text-[#166534] font-sans font-bold text-[12px]">+1</span>
                </div>
              ))}

              {((prod.tipo === 'tesis' && (!prod.investigadoresVinculados || prod.investigadoresVinculados.length === 0)) || (prod.tipo === 'articulo' && !prod.grupoVinculado)) && (
                <p className="font-sans text-[13px] text-on-surface-variant text-center py-2">
                  Sin impacto calculado (no hay vinculación).
                </p>
              )}
            </div>
          </div>

        </div>

        {/* ── Columna lateral: Atributos de Calidad ─────────────────────────── */}
        <div className="w-full lg:w-[270px] flex-shrink-0 flex flex-col gap-4">
          <div className="bg-surface-container-lowest border border-outline-variant rounded shadow-level-1 overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-outline-variant">
              <span className="text-[#f59e0b]"><StarIcon /></span>
              <span className="font-sans font-bold text-[11px] text-on-surface uppercase tracking-widest">Atributos de Calidad</span>
            </div>
            <div className="px-5 py-5 flex flex-col gap-5">

              {/* Cuartil */}
              {cuartil && (
                <div className="flex flex-col items-center gap-1">
                  <div
                    className="w-[90px] h-[90px] rounded-full border-4 flex items-center justify-center"
                    style={{ borderColor: cuartilColor[cuartil] ?? '#001631' }}>
                    <span className="font-heading font-bold text-[30px] leading-none"
                      style={{ color: cuartilColor[cuartil] ?? '#001631' }}>
                      {cuartil}
                    </span>
                  </div>
                  <p className="font-sans font-bold text-[10px] text-on-surface uppercase tracking-widest mt-1">
                    Cuartil Obtenido
                  </p>
                </div>
              )}

              {/* Indexación */}
              <div>
                <p className="font-sans font-bold text-[10px] text-on-surface uppercase tracking-widest mb-2">
                  Indexación Principal
                </p>
                <div className="w-full py-3 rounded border border-outline-variant text-center">
                  <span className="font-sans font-bold text-[15px] text-on-surface">
                    {prod.fuente === 'WOS' ? 'WoS' : prod.fuente}
                  </span>
                </div>
              </div>

              {/* Nota */}
              {cuartil && (cuartil === 'Q1' || cuartil === 'Q2') && (
                <div className="rounded p-3 bg-[#eff6ff] border border-[#bfdbfe]">
                  <div className="flex items-start gap-2">
                    <span className="flex-shrink-0 mt-0.5 text-[#3b82f6]"><InfoIcon /></span>
                    <p className="font-sans text-[11px] text-[#1e40af] leading-[16px]">
                      Los artículos en cuartiles Q1 y Q2 tienen mayor ponderación en el algoritmo de cálculo para el Plan Operativo Institucional.
                    </p>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────────────────────────────────────

type TabId = 'metadata' | 'vinculacion';

export default function ProduccionDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';

  const [prod, setProd] = useState<RegistroProduccion | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('metadata');
  const [isSaving, setIsSaving] = useState(false);
  const [doiError, setDoiError] = useState<string | null>(null);
  const [showBuscar, setShowBuscar] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleImportarTesis = async () => {
    if (!prod) return;
    setIsImporting(true);
    setSaveError(null);
    try {
      const payload = {
        url_cybertesis: prod.urlCybertesis || meta.urlCybertesis || "",
        titulo_tesis: prod.titulo || meta.titulo || "",
        resumen_abstract: (prod as any).resumen || "",
        cita_apa: `${prod.autores || ""} (${prod.fecha ? prod.fecha.split("-")[0] : new Date().getFullYear()}). ${prod.titulo}.`,
        autor_estudiante_texto: prod.tesista || meta.tesista || "Estudiante no detectado",
        asesor_texto: prod.autores || "Asesor no detectado",
        dni_asesor: vinculados.find(v => v.rol === 'Asesor')?.investigador.id || null,
        nivel_grado: prod.tipoTesis || meta.tipoTesis || "Pregrado",
        tipo_trabajo: "Trabajo de investigación",
        estado_validacion: "Pendiente",
        fuente_origen: "CYBERTESIS",
        palabras_clave: [],
        jurados_evaluadores: []
      };
      await importarTesis(payload);
      setProd(prev => prev ? { ...prev, isExternal: false } : null);
      alert("✓ Tesis importada exitosamente a la base de datos local.");
    } catch (err: any) {
      console.error("Error importing thesis:", err);
      setSaveError(err.message || "Error al importar la tesis.");
    } finally {
      setIsImporting(false);
    }
  };

  // Form state: metadata
  const [meta, setMeta] = useState<MetaState>({
    titulo: '', doi: '', revista: '', issn: '', volNum: '',
    indexacion: 'Scopus', cuartil: '',
    tesista: '', tipoTesis: 'Pregrado', urlCybertesis: '',
  });

  // Form state: vinculados
  const [vinculados, setVinculados] = useState<InvestigadorVinculado[]>([]);
  const [grupoVinculado, setGrupoVinculado] = useState<GrupoInvestigacionResumen | null>(null);

  // ── Cargar ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const data = await getProduccionById(id);
      if (!data) { setNotFound(true); setIsLoading(false); return; }
      setProd(data);
      // Inicializar form
      setMeta({
        titulo: data.titulo,
        doi: data.doi ?? '',
        revista: data.revista ?? '',
        issn: data.issn ?? '',
        volNum: data.volNum ?? '',
        indexacion: data.fuente === 'WOS' ? 'WoS' : data.fuente === 'SCOPUS' ? 'Scopus' : 'Cybertesis',
        cuartil: data.cuartil ?? '',
        tesista: data.tesista ?? '',
        tipoTesis: data.tipoTesis ?? 'Pregrado',
        urlCybertesis: data.urlCybertesis ?? '',
      });
      setVinculados(data.investigadoresVinculados ?? []);
      setGrupoVinculado(data.grupoVinculado ?? null);
      setIsLoading(false);
    }
    load();
  }, [id]);

  // ── Meta change helper ─────────────────────────────────────────────────────
  const handleMetaChange = (k: keyof MetaState, v: string) => setMeta((m) => ({ ...m, [k]: v }));

  // ── Validar DOI (EX2) ──────────────────────────────────────────────────────
  const handleBlurDOI = useCallback(async () => {
    if (!meta.doi.trim()) { setDoiError(null); return; }
    const { duplicado } = await validarDOI(meta.doi);
    if (duplicado) {
      setDoiError('Publicación duplicada: El DOI ingresado ya pertenece a un registro existente.');
    } else {
      setDoiError(null);
    }
  }, [meta.doi]);

  // ── Buscar investigador (EX1) ──────────────────────────────────────────────
  const handleSelectInvestigador = (inv: InvestigadorResumen) => {
    setVinculados((prev) => [...prev, { investigador: inv, rol: 'Coautor' }]);
    setShowBuscar(false);
  };

  const handleSelectGrupo = (grupo: GrupoInvestigacionResumen) => {
    setGrupoVinculado(grupo);
    setShowBuscar(false);
  };

  const handleRolChange = (idx: number, rol: RolPublicacion) => {
    setVinculados((prev) => prev.map((v, i) => i === idx ? { ...v, rol } : v));
  };

  const handleRemoveVinculado = (idx: number) => {
    setVinculados((prev) => prev.filter((_, i) => i !== idx));
  };

  // ── Confirmar y persistir ──────────────────────────────────────────────────
  const handleConfirmar = async () => {
    if (doiError) { setSaveError('Corrija el DOI antes de confirmar.'); return; }
    setSaveError(null);
    setIsSaving(true);
    if (!prod) return;
    try {
      const updated = await confirmarProduccion({
        id,
        tipo: prod.tipo,
        doi: meta.doi || undefined,
        issn: meta.issn || undefined,
        volNum: meta.volNum || undefined,
        revista: meta.revista || undefined,
        cuartil: (meta.cuartil as Cuartil) || null,
        investigadoresVinculados: vinculados.map((v) => ({
          investigadorId: v.investigador.id,
          rol: v.rol,
        })),
        id_grupo: grupoVinculado?.id || undefined,
      });
      setProd(updated);
      setVinculados(updated.investigadoresVinculados);
      setGrupoVinculado(updated.grupoVinculado ?? null);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Error al confirmar.');
    } finally {
      setIsSaving(false);
    }
  };


  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <MainLayout title="Sistema de Gestión de Proyectos de Investigación">
        <div className="flex flex-col gap-4 animate-pulse max-w-[800px]">
          <div className="h-6 w-48 bg-surface-container-high rounded" />
          <div className="h-4 w-72 bg-surface-container-high rounded" />
          <div className="h-[200px] bg-surface-container-high rounded" />
        </div>
      </MainLayout>
    );
  }

  if (notFound || !prod) {
    return (
      <MainLayout title="Sistema de Gestión de Proyectos de Investigación">
        <div className="text-center py-20">
          <p className="font-sans font-semibold text-[14px] text-on-surface mb-2">Registro no encontrado.</p>
          <button onClick={() => router.push('/publicaciones')}
            className="font-sans text-[13px] text-[#2563eb] hover:underline">
            Volver a la bandeja
          </button>
        </div>
      </MainLayout>
    );
  }

  // ── Vista: Validado ────────────────────────────────────────────────────────
  if (prod.estado === 'validado') {
    return (
      <MainLayout title="Sistema de Gestión de Proyectos de Investigación">
        <VistaValidada prod={prod} onVolver={() => router.push('/publicaciones')} />
      </MainLayout>
    );
  }

  // ── Vista: Pendiente (dos pestañas) ───────────────────────────────────────
  const tipoLabel = prod.tipo === 'articulo' ? 'Artículo' : 'Tesis';
  const importadoLabel = prod.importadoEn
    ? `Importado desde ${formatFuente(prod.fuente)} el ${formatFechaLarga(prod.importadoEn)}`
    : `Fuente: ${formatFuente(prod.fuente)}`;

  return (
    <MainLayout title="Sistema de Gestión de Proyectos de Investigación">

      {/* ── Cabecera de validación ───────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-5 pb-4">
        <div className="flex items-start gap-2">
          <button onClick={() => router.push('/publicaciones')}
            className="flex items-center gap-1 font-sans text-[13px] text-on-surface-variant hover:text-on-surface transition-colors mt-2"
            aria-label="Volver a la bandeja">
            <ArrowLeftIcon />
          </button>
          <div>
            <h1 className="font-heading font-semibold text-h1 text-on-surface leading-[32px]">
              Validación de {tipoLabel}: {prod.titulo.length > 50 ? prod.titulo.slice(0, 50) + '...' : prod.titulo}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex px-2 py-0.5 rounded bg-[#fef9c3] font-sans font-bold text-[10px] text-[#854d0e] uppercase tracking-widest">
                Pendiente Confirmar
              </span>
              <span className="font-sans text-[11px] text-on-surface-variant">{importadoLabel}</span>
            </div>
          </div>
        </div>

        {/* Derecha — Cancelar + Confirmar y Persistir */}
        <div className="flex gap-2 flex-shrink-0 ml-4">
          <button
            type="button"
            onClick={() => router.push('/publicaciones')}
            className="border border-[#e2e8f0] hover:bg-slate-50 font-sans text-[13px] text-[#475569] px-4 py-2 rounded transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirmar}
            disabled={isSaving || !!doiError || prod.isExternal}
            className="flex items-center gap-2 bg-[#001631] hover:bg-[#002b54] text-white font-sans font-bold text-[13px] px-4 py-2 rounded shadow transition-colors cursor-pointer disabled:opacity-60"
          >
            {isSaving ? (
              <>
                <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Guardando...
              </>
            ) : (
              <><CheckIcon /> Confirmar y Persistir</>
            )}
          </button>
        </div>
      </div>

      {/* ── Tesis Externa Cybertesis Banner ───────────────────────────────────── */}
      {prod.isExternal && (
        <div className="bg-[#fff9db] border border-[#ffe066] text-[#8c6d00] px-4 py-4 rounded font-sans text-[13px] mb-5 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
          <div>
            <span className="font-bold block mb-0.5">Tesis Externa (Cybertesis UNMSM)</span>
            Esta tesis proviene del repositorio externo Cybertesis de la UNMSM y no está registrada en el sistema local. Debe importarla primero para poder validar e integrar sus docentes/asesores.
          </div>
          <button
            onClick={handleImportarTesis}
            disabled={isImporting}
            className="bg-[#e67e22] hover:bg-[#d35400] text-white font-semibold py-2 px-4 rounded shadow transition-all duration-150 flex items-center justify-center gap-1.5 whitespace-nowrap self-start md:self-auto"
          >
            {isImporting ? 'Importando...' : 'Importar e Integrar Tesis'}
          </button>
        </div>
      )}

      {/* ── Error de guardado ─────────────────────────────────────────────────── */}
      {saveError && (
        <div role="alert"
          className="mb-4 flex items-start gap-2 px-4 py-3 rounded bg-[#fee2e2] border border-[#fca5a5] font-sans text-[13px] text-[#991b1b]">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {saveError}
        </div>
      )}

      {/* ── Pestañas ──────────────────────────────────────────────────────────── */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded shadow-level-1 overflow-hidden mb-6">

        {/* Tab bar */}
        <div className="flex border-b border-outline-variant">
          {([
            { id: 'metadata', label: 'Metadata Técnica', icon: <DocIcon /> },
            { id: 'vinculacion', label: prod.tipo === 'articulo' ? 'Grupo de Investigación' : 'Vinculación de Asesores', icon: <LinkPersonIcon /> },
          ] as { id: TabId; label: string; icon: React.ReactNode }[]).map((t) => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`
                flex items-center gap-2 px-5 py-3 font-sans font-semibold text-[13px]
                border-b-2 transition-all duration-300 ease-out
                ${activeTab === t.id
                  ? 'border-[#001631] text-[#001631]'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline'}
              `}
              aria-selected={activeTab === t.id}
              role="tab">
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div role="tabpanel" key={activeTab} className="animate-sweep-in">
          {activeTab === 'metadata' && (
            <TabMetadata
              prod={prod} meta={meta} onChange={handleMetaChange}
              doiError={doiError} onBlurDOI={handleBlurDOI}
            />
          )}
          {activeTab === 'vinculacion' && (
            prod.tipo === 'articulo' ? (
              <TabVinculacionGrupo
                grupoVinculado={grupoVinculado}
                onRemove={() => setGrupoVinculado(null)}
                onBuscar={() => setShowBuscar(true)}
              />
            ) : (
              <TabVinculacion
                vinculados={vinculados}
                onRolChange={handleRolChange}
                onRemove={handleRemoveVinculado}
                onBuscar={() => setShowBuscar(true)}
              />
            )
          )}
        </div>

      </div>

      {/* ── Modal buscar investigador o grupo (EX1) ──────────────────────────────────── */}
      {showBuscar && (
        prod.tipo === 'articulo' ? (
          <BuscarGrupoModal
            onSelect={handleSelectGrupo}
            onClose={() => setShowBuscar(false)}
          />
        ) : (
          <BuscarInvestigadorModal
            onSelect={handleSelectInvestigador}
            onClose={() => setShowBuscar(false)}
            excluirIds={vinculados.map((v) => v.investigador.id)}
          />
        )
      )}

    </MainLayout>
  );
}
