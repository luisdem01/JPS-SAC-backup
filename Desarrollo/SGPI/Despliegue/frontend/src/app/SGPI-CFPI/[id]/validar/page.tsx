'use client';

/**
 * @file [id]/validar/page.tsx
 * @route /SGPI-CFPI/[id]/validar
 * @description Pantalla de Auditoría/Validación de Proyecto de Investigación con dos pestañas.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { MainLayout } from '@/SGPI-CFU/components/layout';
import type { Proyecto, MiembroProyecto, RolMiembroProyecto, EstadoProyecto, Convocatoria } from '../../_data/types';
import { getProyectoById, buscarInvestigadores, validarProyecto, getGruposDisponibles, getConvocatorias, type GrupoInvestigacion } from '../../_data/service';
import type { InvestigatorPadron } from '../../../SGPI-CFGI/_data/types';

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

const ScannerIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/>
    <line x1="7" y1="12" x2="17" y2="12"/>
  </svg>
);

const DocumentTextIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
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

export default function AuditoriaProyectoPage() {
  const router = useRouter();
  const { id } = useParams() as { id: string };

  const [activeTab, setActiveTab] = useState<'ficha' | 'equipo'>('ficha');
  const [proyecto,  setProyecto]  = useState<Proyecto | null>(null);
  const [cargando,  setCargando]  = useState(true);

  // Form — Ficha Técnica y Financiera
  const [title,             setTitle]             = useState('');
  const [tipo,              setTipo]              = useState<'Básico' | 'Aplicado'>('Aplicado');
  const [programa,          setPrograma]          = useState('');
  const [convocatoria,      setConvocatoria]      = useState('');
  const [resolucion,        setResolucion]        = useState('');
  const [montoFinanciado,   setMontoFinanciado]   = useState(0);
  const [inicioPlanificado, setInicioPlanificado] = useState('');
  const [finPlanificado,    setFinPlanificado]    = useState('');

  // Form — Equipo y Grupo
  const [grupoVinculado,        setGrupoVinculado]        = useState('');
  const [responsablePrincipal,  setResponsablePrincipal]  = useState('');
  const [miembros,              setMiembros]              = useState<MiembroProyecto[]>([]);

  // Form — Cambio de Estado y Observación (Barra inferior)
  const [nuevoEstado,    setNuevoEstado]    = useState<EstadoProyecto>('en_ejecucion');
  const [observacion,    setObservacion]    = useState('');

  // Búsqueda de Co-investigadores
  const [busquedaInv,        setBusquedaInv]        = useState('');
  const [resultadosBusqueda, setResultadosBusqueda] = useState<InvestigatorPadron[]>([]);
  const [invSeleccionado,    setInvSeleccionado]    = useState<InvestigatorPadron | null>(null);
  const [mostrarBuscador,    setMostrarBuscador]    = useState(false);

  // UI
  const [guardando,    setGuardando]    = useState(false);
  const [errors,       setErrors]       = useState<string[]>([]);
  const [showToast,    setShowToast]    = useState(false);

  const [grupos, setGrupos] = useState<GrupoInvestigacion[]>([]);
  const [convocatorias, setConvocatorias] = useState<string[]>([]);


  // Carga inicial
  useEffect(() => {
    async function cargar() {
      setCargando(true);
      try {
        const [data, dataGrupos, dataConvocatorias] = await Promise.all([
          getProyectoById(id),
          getGruposDisponibles(),
          getConvocatorias()
        ]);

        if (dataGrupos && dataGrupos.length > 0) {
          setGrupos(dataGrupos);
        } else {
          setGrupos([
            { codigo_grupo: 'IA en Salud Pública', nombre_grupo: 'IA en Salud Pública' },
            { codigo_grupo: 'Ciberseguridad Avanzada', nombre_grupo: 'Ciberseguridad Avanzada' },
            { codigo_grupo: 'Sistemas de Información y Ciberseguridad Avanzada', nombre_grupo: 'Sistemas de Información y Ciberseguridad Avanzada' },
            { codigo_grupo: 'Redes y Sistemas Computacionales', nombre_grupo: 'Redes y Sistemas Computacionales' },
            { codigo_grupo: 'Ciencia de Datos Aplicada', nombre_grupo: 'Ciencia de Datos Aplicada' }
          ]);
        }

        if (dataConvocatorias && dataConvocatorias.length > 0) {
          setConvocatorias(dataConvocatorias.map(c => c.titulo_convocatoria));
        } else {
          setConvocatorias([
            'Convocatoria VRIP 2026',
            'Convocatoria VRIP 2025',
            'Convocatoria VRIP 2024',
            'VRIP General'
          ]);
        }

        if (data) {
          setProyecto(data);
          setTitle(data.title);
          setTipo(data.tipo);
          setPrograma(data.programa);
          setConvocatoria(data.convocatoria);
          setResolucion(data.resolucion);
          setMontoFinanciado(data.montoFinanciado);
          setInicioPlanificado(data.inicioPlanificado);
          setFinPlanificado(data.finPlanificado);
          setGrupoVinculado(data.grupoVinculado);
          setResponsablePrincipal(data.responsablePrincipal);
          setMiembros(data.miembros);
          setNuevoEstado(data.status === 'pendiente_validar' ? 'en_ejecucion' : data.status);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, [id]);

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
    setMiembros([...miembros, {
      dni: invSeleccionado.dni,
      nombre: invSeleccionado.nombre,
      rol: 'Co-investigador',
      estado: 'activo'
    }]);
    setInvSeleccionado(null);
    setBusquedaInv('');
    setResultadosBusqueda([]);
    setMostrarBuscador(false);
  };

  const handleRoleChange = (dni: string, nuevoRol: RolMiembroProyecto) => {
    let updated = miembros.map((m) => m.dni === dni ? { ...m, rol: nuevoRol } : m);
    if (nuevoRol === 'Responsable Principal') {
      // Si el nuevo rol es RP, cambiamos a los otros RP a Co-investigadores
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
      alert('No se puede remover al Responsable Principal del proyecto.');
      return;
    }
    setMiembros(miembros.filter((x) => x.dni !== dni));
  };

  const handleGuardar = async () => {
    setErrors([]);
    const rp = miembros.find((m) => m.rol === 'Responsable Principal');
    if (!rp) {
      setErrors(['Debe existir un Responsable Principal asignado en el equipo del proyecto.']);
      return;
    }
    if (nuevoEstado === 'en_ejecucion' && !observacion.trim()) {
      setErrors(['La observación de auditoría es obligatoria para pasar a ejecución.']);
      return;
    }

    setGuardando(true);
    try {
      await validarProyecto(id, {
        title,
        tipo,
        programa,
        convocatoria,
        resolucion,
        montoFinanciado,
        inicioPlanificado,
        finPlanificado,
        status: nuevoEstado,
        grupoVinculado,
        responsablePrincipal: rp.nombre,
        miembros,
        cambioEstadoObs: observacion
      });
      setShowToast(true);
      setTimeout(() => { router.push(`/SGPI-CFPI/${id}`); }, 2000);
    } catch (err: any) {
      setErrors([err.message || 'Error al guardar el proyecto.']);
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <MainLayout title="Auditoría de Proyecto" subtitle="">
        <div className="flex flex-col gap-4 animate-pulse">
          <div className="h-8 bg-slate-100 rounded w-1/3"/>
          <div className="h-64 bg-slate-100 rounded"/>
        </div>
      </MainLayout>
    );
  }

  if (!proyecto) {
    return (
      <MainLayout title="Auditoría de Proyecto" subtitle="">
        <div className="bg-red-50 text-red-800 p-6 rounded border border-red-200">
          <p className="font-sans font-bold">Proyecto no encontrado.</p>
          <button onClick={() => router.push('/SGPI-CFPI')} className="mt-3 text-[13px] font-bold text-red-700 underline cursor-pointer">
            Volver a la bandeja
          </button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="" subtitle="">
      <div className="flex flex-col gap-0 pb-24">

        {/* ── Barra Superior: Breadcrumb + título + badge + fuente / Botones ── */}
        <div className="flex items-start justify-between pb-4">
          {/* Izquierda */}
          <div>
            <button
              onClick={() => router.push('/SGPI-CFPI')}
              className="inline-flex items-center gap-1 text-[13px] font-sans text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer mb-2"
              aria-label="Volver a la lista"
            >
              <BackIcon />
            </button>

            <div className="flex items-center gap-3">
              <h1 className="font-heading font-semibold text-h1 text-on-surface leading-[38px]">
                Auditoría de Proyecto: {proyecto.code}
              </h1>
            </div>
            <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 bg-[#fef3c7] text-[#92400e] font-sans font-bold text-[10px] px-2 py-0.5 rounded uppercase tracking-widest">
                • {proyecto.status === 'pendiente_validar' ? 'Pendiente Validar' : proyecto.status === 'en_ejecucion' ? 'En Ejecución' : 'Concluido'}
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-[#475569] bg-slate-100 px-2 py-0.5 rounded font-sans font-medium">
                <ScannerIcon />
                Fuente: {proyecto.fuente}
              </span>
            </div>
          </div>

          {/* Derecha: Botón Guardar en la parte superior derecha como pidió el usuario */}
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
              {guardando ? 'Guardando...' : 'Guardar y Auditar'}
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

          {/* TAB 1 — FICHA TÉCNICA Y FINANCIERA */}
          {activeTab === 'ficha' && (
            <div className="flex flex-col gap-5">
              
              {/* Tarjeta contenedora de Datos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block font-sans font-bold text-[10px] text-on-surface-variant uppercase tracking-widest mb-1.5">
                    CÓDIGO RAIS
                  </label>
                  <input
                    type="text"
                    value={proyecto.code}
                    disabled
                    className="w-full px-3 py-2 font-sans text-[13px] text-on-surface-variant bg-surface-container-low border border-outline-variant rounded cursor-not-allowed"
                  />
                </div>

                <div>
                  <label htmlFor="titulo" className="block font-sans font-bold text-[10px] text-on-surface-variant uppercase tracking-widest mb-1.5">
                    TÍTULO OFICIAL DEL PROYECTO
                  </label>
                  <input
                    id="titulo"
                    type="text"
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
                    className="w-full px-3 py-2 font-sans text-[13px] text-on-surface bg-surface-container-lowest border border-[#e2e8f0] rounded outline-none focus:ring-2 focus:ring-[#a8c8fa]"
                  >
                    {convocatorias.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="resolucion" className="font-sans font-bold text-[10px] text-on-surface-variant uppercase tracking-widest">
                      Nº RESOLUCIÓN (RR)
                    </label>
                    <span className="font-sans font-bold text-[10px] text-[#6b21a8] bg-[#f3e8ff] px-1.5 py-0.5 rounded tracking-wide uppercase">
                      Autocompletado
                    </span>
                  </div>
                  <input
                    id="resolucion"
                    type="text"
                    value={resolucion}
                    onChange={(e) => setResolucion(e.target.value)}
                    className="w-full px-3 py-2 font-sans text-[13px] text-on-surface bg-surface-container-lowest border border-outline-variant rounded outline-none focus:ring-2 focus:ring-[#a8c8fa]"
                  />
                </div>

                <div>
                  <label htmlFor="monto" className="block font-sans font-bold text-[10px] text-on-surface-variant uppercase tracking-widest mb-1.5">
                    MONTO FINANCIADO (S/.)
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

          {/* TAB 2 — EQUIPO Y GRUPO */}
          {activeTab === 'equipo' && (
            <div className="flex flex-col gap-6">

              {/* Grupo y Responsable */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="grupo-vinculado" className="block font-sans font-bold text-[10px] text-on-surface-variant uppercase tracking-widest mb-1.5">
                    GRUPO DE INVESTIGACIÓN (CU05)
                  </label>
                  <select
                    id="grupo-vinculado"
                    value={grupoVinculado}
                    onChange={(e) => setGrupoVinculado(e.target.value)}
                    className="w-full px-3 py-2 font-sans text-[13px] text-on-surface bg-surface-container-lowest border border-[#e2e8f0] rounded outline-none focus:ring-2 focus:ring-[#a8c8fa]"
                  >
                    {grupos.map(g => (
                      <option key={g.codigo_grupo} value={g.codigo_grupo}>{g.nombre_grupo}</option>
                    ))}
                  </select>
                  <p className="mt-1.5 font-sans text-[11px] text-[#64748b]">
                    Filtra automáticamente los responsables disponibles.
                  </p>
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
                      // Sincronizar el rol en la lista de miembros
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
                  </select>
                </div>
              </div>

              {/* Co-investigadores / Participantes */}
              <div className="border border-outline-variant rounded p-5 bg-surface-container-lowest">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-sans font-bold text-[11px] text-on-surface-variant uppercase tracking-widest">
                    CO-INVESTIGADORES / PARTICIPANTES
                  </h3>
                  <button
                    type="button"
                    onClick={() => setMostrarBuscador(!mostrarBuscador)}
                    className="flex items-center gap-1 bg-[#001631] hover:bg-[#002b54] text-white font-sans font-bold text-[12px] px-3 py-1.5 rounded transition-colors cursor-pointer"
                  >
                    <SearchIcon />
                    Añadir
                  </button>
                </div>

                {/* Formulario de Búsqueda inline */}
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

                      {/* Resultados dropdown */}
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
                                  title="Remover co-investigador"
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
                            No hay miembros registrados en el equipo.
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

        {/* ── Sección Fija de Cambio de Estado y Observaciones (abajo) ── */}
        <div className="fixed bottom-0 left-[240px] right-0 bg-surface-container-low border-t border-outline-variant p-4 flex flex-col md:flex-row gap-4 items-end justify-start shadow-lg z-40">
          
          <div className="w-[200px]">
            <label htmlFor="nuevo-estado" className="block font-sans font-bold text-[10px] text-on-surface-variant uppercase tracking-widest mb-1.5">
              CAMBIO DE ESTADO
            </label>
            <div className="relative">
              <select
                id="nuevo-estado"
                value={nuevoEstado}
                onChange={(e) => setNuevoEstado(e.target.value as EstadoProyecto)}
                className="w-full appearance-none pl-3 pr-7 py-2 font-sans text-[13px] text-on-surface bg-white border border-[#e2e8f0] rounded outline-none focus:ring-2 focus:ring-[#a8c8fa] cursor-pointer"
              >
                <option value="en_ejecucion">En Ejecución</option>
                <option value="concluido">Concluido</option>
              </select>
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748b]">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
              </span>
            </div>
          </div>

          <div className="flex-1 min-w-[300px]">
            <label htmlFor="observacion" className="block font-sans font-bold text-[10px] text-[#b91c1c] uppercase tracking-widest mb-1.5 flex items-center gap-1">
              OBSERVACIÓN (OBLIGATORIA PARA AUDITORÍA)
            </label>
            <input
              id="observacion"
              type="text"
              placeholder="Ej: Se validan montos según RR adjunta. Pasa a ejecución."
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              className="w-full px-3 py-[7px] font-sans text-[13px] text-on-surface bg-white border border-outline-variant rounded outline-none focus:ring-2 focus:ring-[#a8c8fa]"
            />
          </div>

        </div>

      </div>

      {/* Toast de éxito */}
      {showToast && (
        <div
          role="status" aria-live="polite"
          className="fixed bottom-8 right-6 z-[60] flex items-center gap-3 px-5 py-3.5 rounded-lg bg-[#22c55e] text-white shadow-2xl font-sans font-semibold text-[14px] animate-[slideInRight_0.25s_ease-out]"
        >
          <CheckCircleIcon />
          Proyecto guardado y auditado exitosamente.
        </div>
      )}
    </MainLayout>
  );
}
