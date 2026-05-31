'use client';

/**
 * @file nuevo/page.tsx
 * @route /SGPI-CFPI/nuevo
 * @description Registro de Nuevo Proyecto de Investigación — Carga Manual (Tabs: Ficha Técnica y Financiera / Equipo y Grupo)
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/SGPI-CFU/components/layout';
import type { MiembroProyecto, RolMiembroProyecto, EstadoProyecto } from '../_data/types';
import { buscarInvestigadores, crearProyecto, getGruposDisponibles, getConvocatorias } from '../_data/service';
import type { GrupoInvestigacion } from '../_data/service';
import type { InvestigatorPadron } from '../../SGPI-CFGI/_data/types';

// ─────────────────────────────────────────────────────────────────────────────
// Íconos SVG
// ─────────────────────────────────────────────────────────────────────────────

const BackIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
  </svg>
);

const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
);

const WarningIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

const InfoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
  </svg>
);

const CheckCircleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

const DocumentTextIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
);

const GroupIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// Componente Principal
// ─────────────────────────────────────────────────────────────────────────────

export default function NuevoProyectoPage() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'ficha' | 'equipo'>('ficha');

  // Form — Ficha Técnica y Financiera
  const [code,              setCode]              = useState('');
  const [title,             setTitle]             = useState('');
  const [tipo,              setTipo]              = useState<'Básico' | 'Aplicado'>('Aplicado');
  const [programa,          setPrograma]          = useState('VRIP General');
  const [convocatoria,      setConvocatoria]      = useState('');
  const [resolucion,        setResolucion]        = useState('');
  const [montoFinanciado,   setMontoFinanciado]   = useState(0);
  const [inicioPlanificado, setInicioPlanificado] = useState(() => new Date().toISOString().split('T')[0]);
  const [finPlanificado,    setFinPlanificado]    = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split('T')[0];
  });

  // Grupos de investigación (cargados del backend)
  const [grupos,                setGrupos]                = useState<GrupoInvestigacion[]>([]);
  const [gruposLoading,         setGruposLoading]         = useState(true);

  // Form — Equipo y Grupo
  const [grupoVinculado,        setGrupoVinculado]        = useState('');
  const [responsablePrincipal,  setResponsablePrincipal]  = useState('');
  const [miembros,              setMiembros]              = useState<MiembroProyecto[]>([]);

  const [convocatorias,         setConvocatorias]         = useState<string[]>([]);
  const [convocatoriasLoading,  setConvocatoriasLoading]  = useState(true);

  // Búsqueda de Co-investigadores
  const [busquedaInv,        setBusquedaInv]        = useState('');
  const [resultadosBusqueda, setResultadosBusqueda] = useState<InvestigatorPadron[]>([]);
  const [invSeleccionado,    setInvSeleccionado]    = useState<InvestigatorPadron | null>(null);
  const [mostrarBuscador,    setMostrarBuscador]    = useState(false);

  // UI
  const [guardando,    setGuardando]    = useState(false);
  const [errors,       setErrors]       = useState<string[]>([]);
  const [showToast,    setShowToast]    = useState(false);

  // Cargar grupos de investigación y convocatorias reales al montar
  useEffect(() => {
    Promise.all([
      getGruposDisponibles(),
      getConvocatorias()
    ]).then(([gruposData, convocatoriasData]) => {
      setGrupos(gruposData);
      if (gruposData.length > 0) setGrupoVinculado(gruposData[0].codigo_grupo);

      if (convocatoriasData && convocatoriasData.length > 0) {
        const list = convocatoriasData.map(c => c.titulo_convocatoria);
        setConvocatorias(list);
        setConvocatoria(list[0]);
      } else {
        const defaults = [
          'Convocatoria VRIP 2026',
          'Convocatoria VRIP 2025',
          'Convocatoria VRIP 2024',
          'VRIP General'
        ];
        setConvocatorias(defaults);
        setConvocatoria(defaults[0]);
      }
    }).finally(() => {
      setGruposLoading(false);
      setConvocatoriasLoading(false);
    });
  }, []);

  // Búsqueda de investigadores
  useEffect(() => {
    if (!busquedaInv.trim()) { setResultadosBusqueda([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await buscarInvestigadores(busquedaInv);
        setResultadosBusqueda(res);
      } catch (err) { console.error(err); }
    }, 220);
    return () => clearTimeout(t);
  }, [busquedaInv]);

  const handleAddMiembro = () => {
    if (!invSeleccionado) return;
    if (miembros.some((m) => m.dni === invSeleccionado.dni)) {
      alert('Este investigador ya forma parte del proyecto.');
      return;
    }
    const nuevoMiembro: MiembroProyecto = {
      dni: invSeleccionado.dni,
      nombre: invSeleccionado.nombre,
      rol: miembros.length === 0 ? 'Responsable Principal' : 'Co-investigador',
      estado: 'activo'
    };
    setMiembros([...miembros, nuevoMiembro]);
    if (miembros.length === 0) {
      setResponsablePrincipal(invSeleccionado.nombre);
    }
    setInvSeleccionado(null);
    setBusquedaInv('');
    setResultadosBusqueda([]);
    setMostrarBuscador(false);
  };

  const handleRoleChange = (dni: string, nuevoRol: RolMiembroProyecto) => {
    let updated = miembros.map((m) => m.dni === dni ? { ...m, rol: nuevoRol } : m);
    if (nuevoRol === 'Responsable Principal') {
      const viejoRP = miembros.find((m) => m.rol === 'Responsable Principal');
      if (viejoRP) {
        updated = updated.map((m) => m.dni === viejoRP.dni ? { ...m, rol: 'Co-investigador' as RolMiembroProyecto } : m);
      }
      setResponsablePrincipal(miembros.find((m) => m.dni === dni)?.nombre || responsablePrincipal);
    }
    setMiembros(updated);
  };

  const handleRemoveMiembro = (dni: string) => {
    const m = miembros.find((x) => x.dni === dni);
    if (!m) return;
    if (m.rol === 'Responsable Principal') {
      alert('No se puede remover al Responsable Principal.');
      return;
    }
    setMiembros(miembros.filter((x) => x.dni !== dni));
  };

  const handleGuardar = async () => {
    setErrors([]);
    const errs: string[] = [];

    if (!code.trim()) errs.push('El código único RAIS del proyecto es requerido.');
    if (!title.trim()) errs.push('El título oficial del proyecto es requerido.');
    if (!resolucion.trim()) errs.push('El número de resolución (RR) es requerido.');
    if (montoFinanciado <= 0) errs.push('El monto financiado debe ser mayor a 0.');

    const rp = miembros.find((m) => m.rol === 'Responsable Principal');
    if (!rp) {
      errs.push('Debe existir un Responsable Principal asignado en el equipo del proyecto.');
    }

    if (errs.length > 0) {
      setErrors(errs);
      if (!code.trim() || !title.trim() || !resolucion.trim()) {
        setActiveTab('ficha');
      } else {
        setActiveTab('equipo');
      }
      return;
    }

    setGuardando(true);
    try {
      const formattedCode = code.trim().toUpperCase();
      await crearProyecto({
        code: formattedCode,
        title: title.trim(),
        tipo,
        programa,
        convocatoria,
        resolucion: resolucion.trim(),
        montoFinanciado,
        inicioPlanificado,
        finPlanificado,
        status: 'en_ejecucion', // Creación manual inicia directamente en ejecución
        grupoVinculado,
        responsablePrincipal: rp?.nombre || '',
        miembros,
        fuente: 'Manual'
      });
      setShowToast(true);
      setTimeout(() => { router.push(`/SGPI-CFPI/${formattedCode}`); }, 2000);
    } catch (err: any) {
      setErrors([err.message || 'Error al guardar el proyecto.']);
      setGuardando(false);
    }
  };

  return (
    <MainLayout title="" subtitle="">
      <div className="flex flex-col gap-0">

        {/* ── Barra Superior: Breadcrumb + título + botones ── */}
        <div className="flex items-start justify-between pb-4">
          {/* Izquierda */}
          <div>
            <button
              onClick={() => router.push('/SGPI-CFPI')}
              className="inline-flex items-center gap-1 text-[13px] font-sans text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer mb-2"
              aria-label="Volver a la bandeja principal"
            >
              <BackIcon />
            </button>

            <h1 className="font-heading font-semibold text-h1 text-on-surface leading-[38px]">
              Crear Nuevo Proyecto de Investigación
            </h1>
            <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 font-sans font-bold text-[10px] px-2 py-0.5 rounded border border-slate-200 uppercase tracking-widest">
                • Ingreso Manual
              </span>
            </div>
          </div>

          {/* Derecha — Cancelar + Guardar */}
          <div className="flex gap-2 flex-shrink-0 ml-4">
            <button
              type="button"
              onClick={() => router.push('/SGPI-CFPI')}
              className="border border-[#e2e8f0] hover:bg-slate-50 font-sans text-[13px] text-[#475569] px-4 py-2 rounded transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleGuardar}
              disabled={guardando}
              className="flex items-center gap-2 bg-[#001631] hover:bg-[#002b54] text-white font-sans font-bold text-[13px] px-4 py-2 rounded shadow transition-colors cursor-pointer disabled:opacity-60"
            >
              <CheckIcon />
              {guardando ? 'Guardando...' : 'Guardar y Validar'}
            </button>
          </div>
        </div>

        {/* Alertas de error */}
        {errors.length > 0 && (
          <div className="mb-4 bg-red-50 text-red-800 border border-red-200 rounded p-3 flex gap-2 items-start text-[13px] font-sans">
            <span className="text-red-500 flex-shrink-0 mt-0.5"><WarningIcon /></span>
            <ul className="list-disc pl-3 flex flex-col gap-0.5">
              {errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        )}

        {/* ── Tabs ─────────────────────────────────────────────────────────── */}
        <div className="border-b border-outline-variant flex bg-surface-container-lowest rounded-t border border-b-0">
          <button
            onClick={() => setActiveTab('ficha')}
            className={`flex items-center gap-2 px-5 py-3 font-sans font-semibold text-[13px] border-b-2 transition-colors duration-100 cursor-pointer ${
              activeTab === 'ficha'
                ? 'border-[#001631] text-[#001631]'
                : 'border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline'
            }`}
          >
            <DocumentTextIcon />
            Ficha Técnica y Financiera
          </button>
          <button
            onClick={() => setActiveTab('equipo')}
            className={`flex items-center gap-2 px-5 py-3 font-sans font-semibold text-[13px] border-b-2 transition-colors duration-100 cursor-pointer ${
              activeTab === 'equipo'
                ? 'border-[#001631] text-[#001631]'
                : 'border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline'
            }`}
          >
            <GroupIcon />
            Equipo y Grupo
          </button>
        </div>

        {/* ── Contenido del Tab ─────────────────────────────────────────────── */}
        <div className="bg-surface-container-lowest border border-t-0 border-outline-variant rounded-b p-6 shadow-level-1">

          {/* TAB 1 — FICHA TÉCNICA */}
          {activeTab === 'ficha' && (
            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="code" className="block font-sans font-bold text-[10px] text-on-surface-variant uppercase tracking-widest mb-1.5">
                    CÓDIGO ÚNICO RAIS <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="code"
                    type="text"
                    placeholder="Ej. PRJ-26-999"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full px-3 py-2 font-sans text-[13px] text-on-surface bg-surface-container-lowest border border-outline-variant rounded outline-none focus:ring-2 focus:ring-[#a8c8fa]"
                  />
                </div>

                <div>
                  <label htmlFor="titulo" className="block font-sans font-bold text-[10px] text-on-surface-variant uppercase tracking-widest mb-1.5">
                    TÍTULO OFICIAL DEL PROYECTO <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="titulo"
                    type="text"
                    placeholder="Ingrese el título oficial..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 font-sans text-[13px] text-on-surface bg-surface-container-lowest border border-outline-variant rounded outline-none focus:ring-2 focus:ring-[#a8c8fa]"
                  />
                </div>

                <div>
                  <label htmlFor="tipo" className="block font-sans font-bold text-[10px] text-on-surface-variant uppercase tracking-widest mb-1.5">
                    TIPO DE PROYECTO
                  </label>
                  <select
                    id="tipo"
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value as 'Básico' | 'Aplicado')}
                    className="w-full px-3 py-2 font-sans text-[13px] text-on-surface bg-surface-container-lowest border border-[#e2e8f0] rounded outline-none focus:ring-2 focus:ring-[#a8c8fa]"
                  >
                    <option value="Básico">Básico</option>
                    <option value="Aplicado">Aplicado</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="programa" className="block font-sans font-bold text-[10px] text-on-surface-variant uppercase tracking-widest mb-1.5">
                    PROG. FINANCIAMIENTO
                  </label>
                  <select
                    id="programa"
                    value={programa}
                    onChange={(e) => setPrograma(e.target.value)}
                    className="w-full px-3 py-2 font-sans text-[13px] text-on-surface bg-surface-container-lowest border border-[#e2e8f0] rounded outline-none focus:ring-2 focus:ring-[#a8c8fa]"
                  >
                    <option value="VRIP General">VRIP General</option>
                    <option value="Convocatoria VRIP 2026">Convocatoria VRIP 2026</option>
                    <option value="Otros">Otros</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="convocatoria" className="block font-sans font-bold text-[10px] text-on-surface-variant uppercase tracking-widest mb-1.5">
                    CONVOCATORIA
                  </label>
                  <select
                    id="convocatoria"
                    value={convocatoria}
                    onChange={(e) => setConvocatoria(e.target.value)}
                    disabled={convocatoriasLoading}
                    className="w-full px-3 py-2 font-sans text-[13px] text-on-surface bg-surface-container-lowest border border-[#e2e8f0] rounded outline-none focus:ring-2 focus:ring-[#a8c8fa] disabled:opacity-60"
                  >
                    {convocatoriasLoading && (
                      <option value="">Cargando convocatorias...</option>
                    )}
                    {convocatorias.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="resolucion" className="block font-sans font-bold text-[10px] text-on-surface-variant uppercase tracking-widest mb-1.5">
                    Nº RESOLUCIÓN (RR) <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="resolucion"
                    type="text"
                    placeholder="Ej: RR-00999-UNMSM-2026"
                    value={resolucion}
                    onChange={(e) => setResolucion(e.target.value)}
                    className="w-full px-3 py-2 font-sans text-[13px] text-on-surface bg-surface-container-lowest border border-outline-variant rounded outline-none focus:ring-2 focus:ring-[#a8c8fa]"
                  />
                </div>

                <div>
                  <label htmlFor="monto" className="block font-sans font-bold text-[10px] text-on-surface-variant uppercase tracking-widest mb-1.5">
                    MONTO FINANCIADO (S/.) <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="monto"
                    type="number"
                    value={montoFinanciado}
                    onChange={(e) => setMontoFinanciado(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 font-sans text-[13px] text-on-surface bg-surface-container-lowest border border-outline-variant rounded outline-none focus:ring-2 focus:ring-[#a8c8fa]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="inicio" className="block font-sans font-bold text-[10px] text-on-surface-variant uppercase tracking-widest mb-1.5">
                      INICIO PLAN.
                    </label>
                    <input
                      id="inicio"
                      type="date"
                      value={inicioPlanificado}
                      onChange={(e) => setInicioPlanificado(e.target.value)}
                      className="w-full px-3 py-2 font-sans text-[13px] text-on-surface bg-surface-container-lowest border border-[#e2e8f0] rounded outline-none focus:ring-2 focus:ring-[#a8c8fa]"
                    />
                  </div>
                  <div>
                    <label htmlFor="fin" className="block font-sans font-bold text-[10px] text-on-surface-variant uppercase tracking-widest mb-1.5">
                      FIN PLAN.
                    </label>
                    <input
                      id="fin"
                      type="date"
                      value={finPlanificado}
                      onChange={(e) => setFinPlanificado(e.target.value)}
                      className="w-full px-3 py-2 font-sans text-[13px] text-on-surface bg-surface-container-lowest border border-[#e2e8f0] rounded outline-none focus:ring-2 focus:ring-[#a8c8fa]"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2 — EQUIPO */}
          {activeTab === 'equipo' && (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="grupo-vinculado" className="block font-sans font-bold text-[10px] text-on-surface-variant uppercase tracking-widest mb-1.5">
                    GRUPO DE INVESTIGACIÓN (CU05)
                  </label>
                  <select
                    id="grupo-vinculado"
                    value={grupoVinculado}
                    onChange={(e) => setGrupoVinculado(e.target.value)}
                    disabled={gruposLoading}
                    className="w-full px-3 py-2 font-sans text-[13px] text-on-surface bg-surface-container-lowest border border-[#e2e8f0] rounded outline-none focus:ring-2 focus:ring-[#a8c8fa] disabled:opacity-60"
                  >
                    {gruposLoading && (
                      <option value="">Cargando grupos...</option>
                    )}
                    {!gruposLoading && grupos.length === 0 && (
                      <option value="">Sin grupos disponibles</option>
                    )}
                    {grupos.map(g => (
                      <option key={g.codigo_grupo} value={g.codigo_grupo}>{g.nombre_grupo}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="resp-principal" className="block font-sans font-bold text-[10px] text-on-surface-variant uppercase tracking-widest mb-1.5">
                    RESPONSABLE PRINCIPAL (CU04)
                  </label>
                  <select
                    id="resp-principal"
                    value={responsablePrincipal}
                    onChange={(e) => {
                      const nombre = e.target.value;
                      setResponsablePrincipal(nombre);
                      setMiembros(prev => prev.map(m => {
                        if (m.nombre === nombre) {
                          return { ...m, rol: 'Responsable Principal' };
                        } else if (m.rol === 'Responsable Principal') {
                          return { ...m, rol: 'Co-investigador' };
                        }
                        return m;
                      }));
                    }}
                    className="w-full px-3 py-2 font-sans text-[13px] text-on-surface bg-surface-container-lowest border border-[#e2e8f0] rounded outline-none focus:ring-2 focus:ring-[#a8c8fa]"
                  >
                    {miembros.map(m => (
                      <option key={m.dni} value={m.nombre}>{m.nombre}</option>
                    ))}
                    {miembros.length === 0 && (
                      <option value="">Añada investigadores primero</option>
                    )}
                  </select>
                </div>
              </div>

              {/* Co-investigadores */}
              <div className="border border-outline-variant rounded p-5 bg-surface-container-lowest">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-sans font-bold text-[11px] text-on-surface-variant uppercase tracking-widest">
                    EQUIPO DEL PROYECTO
                  </h3>
                  <button
                    type="button"
                    onClick={() => setMostrarBuscador(!mostrarBuscador)}
                    className="flex items-center gap-1 bg-[#001631] hover:bg-[#002b54] text-white font-sans font-bold text-[12px] px-3 py-1.5 rounded transition-colors cursor-pointer"
                  >
                    <SearchIcon />
                    Añadir Miembro
                  </button>
                </div>

                {mostrarBuscador && (
                  <div className="mb-4 p-4 bg-slate-50 border border-slate-200 rounded flex flex-col md:flex-row gap-3 items-end">
                    <div className="flex-1 relative">
                      <label className="block font-sans font-bold text-[10px] text-[#475569] uppercase tracking-widest mb-1">
                        Buscar Investigador en el Padrón
                      </label>
                      <input
                        type="text"
                        placeholder="Nombre o DNI..."
                        value={busquedaInv}
                        onChange={(e) => setBusquedaInv(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 font-sans text-[13px] text-on-surface bg-white border border-[#e2e8f0] rounded outline-none focus:ring-2 focus:ring-[#a8c8fa]"
                      />
                      <span className="absolute left-2.5 top-[30px] text-[#94a3b8]">
                        <SearchIcon />
                      </span>

                      {/* Dropdown autocompletado */}
                      {resultadosBusqueda.length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#e2e8f0] rounded shadow-lg max-h-48 overflow-y-auto z-50 divide-y divide-[#f1f5f9]">
                          {resultadosBusqueda.map((inv) => (
                            <button
                              key={inv.dni}
                              type="button"
                              onClick={() => {
                                setInvSeleccionado(inv);
                                setBusquedaInv(`${inv.nombre} (${inv.dni})`);
                                setResultadosBusqueda([]);
                              }}
                              className="w-full text-left px-4 py-2 hover:bg-slate-50 font-sans text-[12px] cursor-pointer"
                            >
                              <div className="font-bold text-[#0f172a]">{inv.nombre}</div>
                              <div className="text-[#64748b]">DNI: {inv.dni} · {inv.departamento}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleAddMiembro}
                        disabled={!invSeleccionado}
                        className="bg-[#001631] text-white hover:bg-[#002b54] font-sans font-bold text-[13px] px-4 py-2 rounded transition-colors disabled:opacity-40"
                      >
                        Añadir
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMostrarBuscador(false);
                          setInvSeleccionado(null);
                          setBusquedaInv('');
                        }}
                        className="border border-[#e2e8f0] font-sans text-[13px] px-4 py-2 rounded hover:bg-slate-100"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {/* Tabla de Miembros */}
                <div className="border border-outline-variant rounded overflow-hidden">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-outline-variant bg-surface-container-low">
                        <th className="px-4 py-2.5 font-sans font-bold text-[10px] text-on-surface-variant uppercase tracking-widest">
                          INVESTIGADOR
                        </th>
                        <th className="px-4 py-2.5 font-sans font-bold text-[10px] text-on-surface-variant uppercase tracking-widest w-[180px]">
                          ROL EN PROYECTO
                        </th>
                        <th className="px-4 py-2.5 font-sans font-bold text-[10px] text-on-surface-variant uppercase tracking-widest w-[80px] text-right">
                          ACCIÓN
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant">
                      {miembros.length > 0 ? (
                        miembros.map((m) => {
                          const isRP = m.rol === 'Responsable Principal';
                          const initials = m.nombre.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
                          return (
                            <tr key={m.dni} className="hover:bg-surface-container-low/50">
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2.5">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-sans font-bold text-[11px] flex-shrink-0 ${isRP ? 'bg-[#001631] text-white' : 'bg-surface-container text-on-surface-variant'}`}>
                                    {initials}
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="font-sans font-semibold text-[13px] text-on-surface">{m.nombre}</span>
                                    <span className="font-sans text-[11px] text-[#64748b]">DNI: {m.dni}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-2.5">
                                <div className="relative">
                                  <select
                                    value={m.rol}
                                    onChange={(e) => handleRoleChange(m.dni, e.target.value as RolMiembroProyecto)}
                                    className="w-full appearance-none pl-2 pr-6 py-1 font-sans text-[12px] text-on-surface bg-surface-container-lowest border border-outline-variant rounded outline-none focus:ring-1 focus:ring-[#a8c8fa] cursor-pointer"
                                  >
                                    <option value="Responsable Principal">Responsable Principal</option>
                                    <option value="Co-investigador">Co-investigador</option>
                                    <option value="Tesista vinculado">Tesista vinculado</option>
                                    <option value="Colaborador">Colaborador</option>
                                  </select>
                                  <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-on-surface-variant">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveMiembro(m.dni)}
                                  disabled={isRP}
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors cursor-pointer disabled:opacity-30"
                                  title="Remover miembro"
                                >
                                  <TrashIcon />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={3} className="px-4 py-8 text-center font-sans text-[13px] text-[#94a3b8]">
                            No hay miembros registrados en el equipo. Añada al menos un Responsable Principal.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div>

      </div>

      {/* Toast de éxito */}
      {showToast && (
        <div
          role="status" aria-live="polite"
          className="fixed bottom-8 right-6 z-[60] flex items-center gap-3 px-5 py-3.5 rounded-lg bg-[#22c55e] text-white shadow-2xl font-sans font-semibold text-[14px] animate-[slideInRight_0.25s_ease-out]"
        >
          <CheckCircleIcon />
          Proyecto creado exitosamente.
        </div>
      )}
    </MainLayout>
  );
}
