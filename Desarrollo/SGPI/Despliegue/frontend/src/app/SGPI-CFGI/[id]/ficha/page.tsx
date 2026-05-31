'use client';

/**
 * @file [id]/ficha/page.tsx
 * @route /SGPI-CFGI/[id]/ficha
 * @description Ficha Consolidada de Grupo — usa el ExportFlow compartido de SGPI-CFE.
 */

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { MainLayout } from '@/SGPI-CFU/components/layout';
import { ExportFlow } from '@/SGPI-CFU/components/SGPI-CFE/export/ExportFlow';
import type { GrupoInvestigacion, EstadoGrupo } from '../../_data/types';
import { getGrupoById } from '../../_data/service';

// ─────────────────────────────────────────────────────────────────────────────
// Configuración visual
// ─────────────────────────────────────────────────────────────────────────────

const ESTADO_CONFIG: Record<EstadoGrupo, { dot: string; text: string; bg: string; label: string }> = {
  pendiente_validacion: { dot: 'bg-[#d97706]', text: 'text-[#92400e]', bg: 'bg-[#fef3c7]', label: 'Pendiente Validar' },
  validado_activo:      { dot: 'bg-[#16a34a]', text: 'text-[#166534]', bg: 'bg-[#dcfce7]', label: 'Validado / Activo' },
  validado_inactivo:    { dot: 'bg-[#dc2626]', text: 'text-[#991b1b]', bg: 'bg-[#fee2e2]', label: 'Validado / Inactivo' },
};

const ESTADO_PROY: Record<string, { bg: string; text: string; label: string }> = {
  pending:   { bg: 'bg-[#fef9c3]', text: 'text-[#854d0e]', label: 'Formulación' },
  active:    { bg: 'bg-[#dcfce7]', text: 'text-[#166534]', label: 'En ejecución' },
  completed: { bg: 'bg-[#f1f5f9]', text: 'text-[#475569]', label: 'Concluido' },
  cancelled: { bg: 'bg-[#fee2e2]', text: 'text-[#991b1b]', label: 'Cancelado' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Íconos
// ─────────────────────────────────────────────────────────────────────────────

const BackIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);

const ExportIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/><polyline points="14 2 14 8 20 8"/>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
  </svg>
);

const BeakerIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h6m-6 0H3m6 0v-3m6 3V3m0 18h4a2 2 0 0 0 2-2V9"/>
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// Componentes de apoyo
// ─────────────────────────────────────────────────────────────────────────────

function EstadoBadge({ estado }: { estado: EstadoGrupo }) {
  const cfg = ESTADO_CONFIG[estado];
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded font-sans font-bold text-[11px] ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}/>
      {cfg.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente Principal
// ─────────────────────────────────────────────────────────────────────────────

export default function FichaGrupoPage() {
  const router = useRouter();
  const { id } = useParams() as { id: string };

  const [grupo,          setGrupo]          = useState<GrupoInvestigacion | null>(null);
  const [cargando,       setCargando]       = useState(true);
  const [showExportFlow, setShowExportFlow] = useState(false);

  useEffect(() => {
    async function cargar() {
      setCargando(true);
      try {
        const res = await getGrupoById(id);
        setGrupo(res);
      } catch (err) {
        console.error(err);
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, [id]);

  const formatearFecha = (s: string) => {
    if (!s) return '-';
    try {
      const d = new Date(s);
      return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return s; }
  };

  if (cargando) {
    return (
      <MainLayout title="" subtitle="">
        <div className="flex flex-col gap-6 animate-pulse">
          <div className="h-8 bg-slate-100 rounded w-1/4"/>
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2 h-96 bg-slate-100 rounded"/>
            <div className="col-span-1 h-96 bg-slate-100 rounded"/>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!grupo) {
    return (
      <MainLayout title="" subtitle="">
        <div className="bg-red-50 text-red-800 p-6 rounded border border-red-200">
          <p className="font-sans font-bold">No se encontró el grupo.</p>
          <button onClick={() => router.push('/SGPI-CFGI')} className="mt-3 text-[13px] underline cursor-pointer">Volver</button>
        </div>
      </MainLayout>
    );
  }

  const proyectosActivos = grupo.proyectosVinculados.filter((p) => p.estado === 'active').length;
  const articulosScopus  = grupo.articulosScopus ?? 0;
  const tesisEnCurso     = grupo.tesisEnCurso ?? 0;

  return (
    <MainLayout title="" subtitle="">
      <div className="flex flex-col gap-5">

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-heading font-semibold text-h1 text-on-surface leading-[38px]">
              Ficha Consolidada de Grupo
            </h1>
            <p className="font-sans text-body-md text-on-surface-variant mt-0.5">
              Vista oficial certificada para auditoría y reportes POI.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 ml-4">
            <button
              onClick={() => router.push('/SGPI-CFGI')}
              className="flex items-center gap-1.5 border border-outline-variant hover:bg-surface-container font-sans text-[13px] text-on-surface px-4 py-2 rounded transition-colors cursor-pointer"
            >
              <BackIcon />
              Volver a Bandeja
            </button>
            <button
              onClick={() => setShowExportFlow(true)}
              className="flex items-center gap-1.5 bg-surface-container-lowest border border-outline-variant hover:bg-surface-container font-sans font-bold text-[13px] text-on-surface px-4 py-2 rounded transition-colors cursor-pointer shadow-sm"
            >
              <ExportIcon />
              Exportar Ficha
            </button>
          </div>
        </div>

        {/* ── Cuerpo en 2 columnas ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Columna izquierda (2/3) */}
          <div className="lg:col-span-2 flex flex-col gap-5">

            {/* Identificación Institucional */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded p-6 shadow-level-1 relative">
              {/* Badge de estado arriba a la derecha */}
              <div className="absolute top-4 right-4">
                <EstadoBadge estado={grupo.status} />
              </div>

              <p className="font-sans font-bold text-[10px] text-on-surface uppercase tracking-widest mb-4">
                Identificación Institucional
              </p>

              <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-4">
                <div>
                  <p className="font-sans text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">Código Oficial</p>
                  <p className="font-sans font-bold text-[13px] text-on-surface mt-0.5">{grupo.code}</p>
                </div>
                <div>
                  <p className="font-sans text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">Fecha Registro</p>
                  <p className="font-sans font-bold text-[13px] text-on-surface mt-0.5">{formatearFecha(grupo.recognitionDate || grupo.createdAt)}</p>
                </div>
              </div>

              <div className="mb-4">
                <p className="font-sans text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold mb-1">Nombre del Grupo</p>
                <p className="font-sans font-bold text-[15px] text-on-surface leading-snug">{grupo.name}</p>
              </div>

              <div>
                <p className="font-sans text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold mb-2">Línea de Investigación Principal</p>
                <div className="flex flex-wrap gap-2">
                  {grupo.researchLines.map((l, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5 bg-[#dbeafe] text-[#1e40af] font-sans font-semibold text-[12px] px-3 py-1 rounded">
                      <BeakerIcon />
                      {l}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Productividad Científica */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded p-6 shadow-level-1">
              <p className="font-sans font-bold text-[10px] text-on-surface uppercase tracking-widest mb-4">
                Productividad Científica
              </p>
              <div className="grid grid-cols-3 gap-4">
                <div className="border border-outline-variant rounded p-4 text-center bg-surface-container-low">
                  <p className="font-heading font-bold text-[32px] text-on-surface">{proyectosActivos}</p>
                  <p className="font-sans text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold mt-1">Proyectos Activos</p>
                </div>
                <div className="border border-outline-variant rounded p-4 text-center bg-surface-container-low">
                  <p className="font-heading font-bold text-[32px] text-on-surface">{articulosScopus}</p>
                  <p className="font-sans text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold mt-1">Artículos (Scopus)</p>
                </div>
                <div className="border border-outline-variant rounded p-4 text-center bg-surface-container-low">
                  <p className="font-heading font-bold text-[32px] text-on-surface">{tesisEnCurso}</p>
                  <p className="font-sans text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold mt-1">Tesis en Curso</p>
                </div>
              </div>
            </div>

            {/* Proyectos Destacados Vinculados */}
            {grupo.proyectosVinculados.length > 0 && (
              <div className="bg-surface-container-lowest border border-outline-variant rounded p-6 shadow-level-1">
                <p className="font-sans font-bold text-[13px] text-on-surface mb-3">
                  Proyectos Destacados Vinculados
                </p>
                <div className="flex flex-col gap-2">
                  {grupo.proyectosVinculados.map((p) => {
                    const cfg = ESTADO_PROY[p.estado] || ESTADO_PROY.pending;
                    return (
                      <div key={p.codigo} className="flex items-center justify-between border border-outline-variant bg-surface-container-low rounded px-4 py-3">
                        <div>
                          <p className="font-sans font-semibold text-[13px] text-on-surface">
                            {p.codigo}: {p.titulo}
                          </p>
                          <p className="font-sans text-[11px] text-on-surface-variant mt-0.5">{p.convocatoria}</p>
                        </div>
                        <span className={`ml-4 flex-shrink-0 inline-flex px-2 py-0.5 rounded font-sans font-semibold text-[11px] ${cfg.bg} ${cfg.text}`}>
                          {cfg.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Columna derecha (1/3) — Nómina */}
          <div className="lg:col-span-1">
            <div className="bg-surface-container-lowest border border-outline-variant rounded p-5 sticky top-6 shadow-level-1">
              <p className="font-sans font-bold text-[10px] text-on-surface uppercase tracking-widest border-b border-outline-variant pb-2 mb-4">
                Nómina de Integrantes (Validada)
              </p>

              <div className="flex flex-col gap-3">
                {grupo.miembros.map((m) => {
                  const isDir    = m.rol === 'Director';
                  const initials = m.nombre.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
                  return (
                    <div
                      key={m.dni}
                      className={`flex items-center gap-3 p-3 rounded border ${isDir ? 'border-[#dbeafe] bg-[#eff6ff]' : 'border-outline-variant'}`}
                    >
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-sans font-bold text-[13px] flex-shrink-0 ${isDir ? 'bg-[#001631] text-white' : 'bg-surface-container text-on-surface-variant'}`}>
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className={`font-sans font-bold text-[13px] truncate ${isDir ? 'text-[#001631]' : 'text-on-surface'}`}>
                          {m.nombre}
                        </p>
                        <p className="font-sans text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">
                          {m.rol}
                        </p>
                        <p className="font-sans text-[10px] text-on-surface-variant mt-0.5">
                          DNI: {m.dni} · Alta: {m.fechaIncorporacion}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── ExportFlow (componente compartido SGPI-CFE) ────────────────── */}
      {showExportFlow && (
        <ExportFlow context={`ficha_grupo_${id}`} onClose={() => setShowExportFlow(false)} />
      )}
    </MainLayout>
  );
}
