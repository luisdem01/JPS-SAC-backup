'use client';

/**
 * @file [id]/ficha/page.tsx
 * @route /grupos/[id]/ficha
 * @description Ficha Consolidada de Grupo — usa el ExportFlow compartido de SGPI-CFE.
 */

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { MainLayout } from '@/SGPI-CFU/components/layout';
import dynamic from 'next/dynamic';
const ExportFlow = dynamic(() => import('@/SGPI-CFU/components/SGPI-CFE/export/ExportFlow').then(mod => mod.ExportFlow), { ssr: false });
import type { GrupoInvestigacion, EstadoGrupo } from '../../_data/types';
import { getGrupoById, buscarTesisExternas, vincularTesis } from '../../_data/service';

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
  const [tesisCount,     setTesisCount]     = useState(0);

  const [selectedMiembroDni, setSelectedMiembroDni] = useState('');
  const [buscandoTesis,      setBuscandoTesis]      = useState(false);
  const [tesisEncontradas,   setTesisEncontradas]   = useState<any[]>([]);
  const [vinculandoUrl,      setVinculandoUrl]      = useState<string | null>(null);
  const [vinculadasSesion,   setVinculadasSesion]   = useState<string[]>([]);
  const [toastMsg,           setToastMsg]           = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('created') === 'true') {
        setToastMsg("Grupo creado y validado exitosamente.");
        const timer = setTimeout(() => setToastMsg(null), 3000);
        return () => clearTimeout(timer);
      } else if (urlParams.get('validated') === 'true') {
        setToastMsg("Grupo validado exitosamente.");
        const timer = setTimeout(() => setToastMsg(null), 3000);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  useEffect(() => {
    async function cargar() {
      setCargando(true);
      try {
        const res = await getGrupoById(id);
        setGrupo(res);
        if (res) {
          setTesisCount(res.tesisEnCurso ?? 0);
          if (res.miembros && res.miembros.length > 0) {
            setSelectedMiembroDni(res.miembros[0].dni);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, [id]);

  const handleConsultarCybertesis = async () => {
    if (!selectedMiembroDni || !grupo) return;
    const miembro = grupo.miembros.find((m) => m.dni === selectedMiembroDni);
    if (!miembro) return;
    
    setBuscandoTesis(true);
    setTesisEncontradas([]);
    try {
      const res = await buscarTesisExternas(miembro.nombre);
      setTesisEncontradas(res);
    } catch (err) {
      alert("Error al buscar tesis externas. Verifique que el conector esté activo.");
      console.error(err);
    } finally {
      setBuscandoTesis(false);
    }
  };

  const handleVincularTesis = async (tesisItem: any) => {
    if (!selectedMiembroDni) return;
    setVinculandoUrl(tesisItem.url_cybertesis);
    try {
      const payload = {
        ...tesisItem,
        dni_asesor: selectedMiembroDni
      };
      await vincularTesis(payload);
      setVinculadasSesion((prev) => [...prev, tesisItem.url_cybertesis]);
      setTesisCount((prev) => prev + 1);
      setToastMsg("Tesis vinculada exitosamente.");
      setTimeout(() => setToastMsg(null), 3000);
    } catch (err: any) {
      alert(err.message || "Error al vincular la tesis.");
      console.error(err);
    } finally {
      setVinculandoUrl(null);
    }
  };

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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
          <button onClick={() => router.push('/grupos')} className="mt-3 text-[13px] underline cursor-pointer">Volver</button>
        </div>
      </MainLayout>
    );
  }

  const proyectosActivos = grupo.proyectosVinculados.filter((p) => p.estado === 'active').length;
  const articulosScopus  = grupo.articulosScopus ?? 0;
  const tesisEnCurso     = tesisCount;

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
              onClick={() => router.push('/grupos')}
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 mb-4">
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

            {/* Buscador de Tesis en Cybertesis */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded p-6 shadow-level-1">
              <p className="font-sans font-bold text-[10px] text-[#001631] uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                </svg>
                Buscador de Tesis en Cybertesis (DSpace 7)
              </p>
              <p className="font-sans text-[12px] text-on-surface-variant mb-4">
                Consulte en tiempo real la base de datos externa de Cybertesis para los integrantes del grupo y vincule sus tesis asesoradas.
              </p>

              <div className="flex flex-wrap gap-3 items-end mb-5">
                <div className="flex-1 min-w-[200px]">
                  <label htmlFor="miembro-select" className="block font-sans font-bold text-[10px] text-on-surface uppercase tracking-widest mb-1.5">
                    Seleccionar Integrante
                  </label>
                  <div className="relative">
                    <select
                      id="miembro-select"
                      value={selectedMiembroDni}
                      onChange={(e) => setSelectedMiembroDni(e.target.value)}
                      className="w-full appearance-none pl-3 pr-8 py-2 font-sans text-[13px] text-on-surface bg-surface-container-lowest border border-[#e2e8f0] rounded outline-none focus:ring-2 focus:ring-[#a8c8fa] cursor-pointer"
                    >
                      {grupo.miembros.map((m) => (
                        <option key={m.dni} value={m.dni}>
                          {m.nombre} ({m.rol})
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleConsultarCybertesis}
                  disabled={buscandoTesis || !selectedMiembroDni}
                  className="bg-[#001631] hover:bg-[#002b54] text-white font-sans font-bold text-[13px] px-4 py-[9px] rounded shadow transition-colors cursor-pointer disabled:opacity-40 whitespace-nowrap flex items-center gap-1.5"
                >
                  {buscandoTesis ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Consultando...
                    </>
                  ) : (
                    <>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                      </svg>
                      Consultar Repositorio
                    </>
                  )}
                </button>
              </div>

              {/* Resultados */}
              {buscandoTesis && (
                <div className="flex flex-col gap-3 py-4 animate-pulse">
                  <div className="h-5 bg-slate-100 rounded w-1/3" />
                  <div className="h-16 bg-slate-100 rounded" />
                  <div className="h-16 bg-slate-100 rounded" />
                </div>
              )}

              {!buscandoTesis && tesisEncontradas.length > 0 && (
                <div className="flex flex-col gap-3 max-h-96 overflow-y-auto pr-1">
                  <p className="font-sans font-bold text-[10px] text-[#64748b] uppercase tracking-widest mb-1">
                    Tesis encontradas en Cybertesis ({tesisEncontradas.length})
                  </p>
                  {tesisEncontradas.map((t) => {
                    const isLinked = vinculadasSesion.includes(t.url_cybertesis);
                    const isLinking = vinculandoUrl === t.url_cybertesis;
                    return (
                      <div key={t.url_cybertesis} className="flex items-start justify-between gap-4 border border-[#e2e8f0] bg-surface-container-low rounded p-4 hover:border-slate-300 transition-colors">
                        <div className="min-w-0 flex-1">
                          <a
                            href={t.url_cybertesis}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-sans font-bold text-[13px] text-[#001631] hover:underline leading-snug break-words flex items-center gap-1.5 text-left"
                          >
                            {t.titulo_tesis}
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                            </svg>
                          </a>
                          <p className="font-sans text-[11px] text-on-surface-variant mt-1.5 leading-relaxed text-left">
                            <strong>Autor:</strong> {t.autor_estudiante_texto} <span className="text-[#94a3b8]">|</span> <strong>Grado:</strong> {t.nivel_grado} <span className="text-[#94a3b8]">|</span> <strong>Año:</strong> {t.anio_publicacion}
                          </p>
                          {t.resumen_abstract && (
                            <p className="font-sans text-[11px] text-[#64748b] mt-1.5 line-clamp-2 leading-relaxed italic text-left">
                              &quot;{t.resumen_abstract}&quot;
                            </p>
                          )}
                        </div>
                        <div className="flex-shrink-0">
                          {isLinked ? (
                            <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 border border-green-200 rounded px-2.5 py-1 font-sans font-semibold text-[11px]">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                              Vinculado
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleVincularTesis(t)}
                              disabled={isLinking}
                              className="bg-white border border-[#001631] hover:bg-[#001631] hover:text-white text-[#001631] font-sans font-bold text-[11px] px-3 py-1.5 rounded transition-colors cursor-pointer flex items-center gap-1"
                            >
                              {isLinking ? (
                                <>
                                  <div className="w-2.5 h-2.5 border-2 border-[#001631] border-t-transparent rounded-full animate-spin" />
                                  Vinculando...
                                </>
                              ) : (
                                <>
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                                  </svg>
                                  Vincular Tesis
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {!buscandoTesis && tesisEncontradas.length === 0 && (
                <div className="border border-dashed border-[#cbd5e1] rounded-lg p-8 text-center bg-slate-50/50">
                  <svg className="mx-auto text-slate-300 mb-2" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/>
                  </svg>
                  <p className="font-sans text-[12px] text-[#64748b]">
                    No se han consultado tesis aún. Seleccione un integrante y presione el botón de arriba.
                  </p>
                </div>
              )}
            </div>
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
        <ExportFlow context={`ficha_grupo_${id}`} result={grupo} onClose={() => setShowExportFlow(false)} />
      )}

      {/* Toast de éxito */}
      {toastMsg && (
        <div
          role="status" aria-live="polite"
          className="fixed bottom-8 right-6 z-[60] flex items-center gap-3 px-5 py-3.5 rounded-lg bg-[#22c55e] text-white shadow-2xl font-sans font-semibold text-[14px] animate-[slideInRight_0.25s_ease-out]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          {toastMsg}
        </div>
      )}
    </MainLayout>
  );
}
