'use client';

/**
 * @file nuevo/page.tsx
 * @route /grupos/nuevo
 * @description Registro de Nuevo Grupo de Investigación — Carga Manual (Tabs: Datos Maestros / Gestión de Miembros)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/SGPI-CFU/components/layout';
import { Button } from '@/SGPI-CFU/components/ui';
import type { MiembroGrupo, RolMiembro, InvestigatorPadron, EstadoGrupo, FuenteOrigen } from '../_data/types';
import { buscarInvestigadores, crearGrupo, validarCodigoGrupo, getLineasInvestigacion } from '../_data/service';
import { useAuth } from '@/SGPI-CFU/lib/hooks';

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
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
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

const ClearIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const CheckCircleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

const SpinnerIcon = () => (
  <svg className="animate-spin h-4 w-4 text-[#001631]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

const CloseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// Componente Principal
// ─────────────────────────────────────────────────────────────────────────────

export default function NuevoGrupoPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  // Redirigir si el usuario no es administrador
  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'admin')) {
      router.replace('/grupos');
    }
  }, [user, isLoading, router]);

  const [activeTab, setActiveTab] = useState<'datos-maestros' | 'miembros'>('datos-maestros');

  // Form — Datos Maestros
  const [code,            setCode]            = useState('');
  const [name,            setName]            = useState('');
  const [acronym,         setAcronym]         = useState('');
  const [lineas,          setLineas]          = useState<string[]>([]);
  const [selectedLine,    setSelectedLine]    = useState('');
  const [status,          setStatus]          = useState<EstadoGrupo>('pendiente_validacion');
  const [recognitionDate, setRecognitionDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [fuente,          setFuente]          = useState<FuenteOrigen>('Manual');

  // Cargar líneas de investigación reales desde configuracion_global
  useEffect(() => {
    async function loadLineas() {
      try {
        const data = await getLineasInvestigacion();
        if (data && data.length > 0) {
          setLineas(data);
          setSelectedLine(data[0]);
        }
      } catch (err) {
        console.error("Error cargando líneas de investigación:", err);
      }
    }
    loadLineas();
  }, []);

  // Form — Miembros
  const [miembros,           setMiembros]           = useState<MiembroGrupo[]>([]);
  const [busquedaInv,        setBusquedaInv]        = useState('');
  const [resultadosBusqueda, setResultadosBusqueda] = useState<InvestigatorPadron[]>([]);
  const [buscando,           setBuscando]           = useState(false);
  const [hasSearched,        setHasSearched]        = useState(false);

  // UI
  const [guardando,    setGuardando]    = useState(false);
  const [errors,       setErrors]       = useState<string[]>([]);
  const [showToast,    setShowToast]    = useState(false);

  // Detector de anomalías en el nombre
  const isNameAnomalous = useCallback(() => {
    if (!name.trim()) return false;
    const hasUpperAnomaly = /[A-ZÁÉÍÓÚÑ]{4,}/.test(name);
    const hasMultipleSpaces = /\s{2,}/.test(name);
    return hasUpperAnomaly || hasMultipleSpaces;
  }, [name]);

  // Búsqueda debounce en el padrón
  useEffect(() => {
    if (!busquedaInv.trim()) {
      setResultadosBusqueda([]);
      setBuscando(false);
      setHasSearched(false);
      return;
    }
    setBuscando(true);
    setHasSearched(true);
    const t = setTimeout(async () => {
      try {
        const res = await buscarInvestigadores(busquedaInv);
        setResultadosBusqueda(res);
      } catch (err) {
        console.error(err);
      } finally {
        setBuscando(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [busquedaInv]);

  const handleAddMiembro = (inv: InvestigatorPadron) => {
    if (miembros.some((m) => m.dni === inv.dni)) {
      alert('Este investigador ya forma parte del grupo.');
      return;
    }
    setMiembros([...miembros, {
      dni: inv.dni,
      nombre: inv.nombre,
      nombres: inv.nombres,
      apellidos: inv.apellidos,
      rol: miembros.length === 0 ? 'Director' : 'Colaborador', // Default to Director if first member
      fechaIncorporacion: new Date().toISOString().split('T')[0],
      estado: 'activo',
      isExternal: inv.isExternal,
      nivelRenacyt: inv.nivelRenacyt,
      departamento: inv.departamento,
      facultad: inv.facultad,
    }]);
    setBusquedaInv('');
    setResultadosBusqueda([]);
  };

  const handleRoleChange = (dni: string, nuevoRol: RolMiembro) => {
    let updated = miembros.map((m) => m.dni === dni ? { ...m, rol: nuevoRol } : m);
    if (nuevoRol === 'Director') {
      updated = updated.map((m) => m.dni !== dni && m.rol === 'Director' ? { ...m, rol: 'Co-Investigador' as RolMiembro } : m);
    }
    setMiembros(updated);
  };

  const handleRemoveMiembro = (dni: string) => {
    setMiembros(miembros.filter((x) => x.dni !== dni));
  };

  const handleGuardar = async () => {
    setErrors([]);
    const errs: string[] = [];

    if (!code.trim()) {
      errs.push('El código único del grupo es requerido.');
    } else {
      const esUnico = await validarCodigoGrupo(code);
      if (!esUnico) {
        errs.push(`Regla EX2: El código de grupo "${code}" ya existe.`);
      }
    }

    if (!name.trim()) {
      errs.push('El nombre oficial del grupo es requerido.');
    }

    const director = miembros.find((m) => m.rol === 'Director' && m.estado === 'activo');
    if (!director) {
      errs.push('Debe existir un Director activo en el grupo.');
    }

    if (errs.length > 0) {
      setErrors(errs);
      // Redirige al tab correspondiente según el error
      if (!code.trim() || !name.trim()) {
        setActiveTab('datos-maestros');
      } else {
        setActiveTab('miembros');
      }
      return;
    }

    setGuardando(true);
    try {
      await crearGrupo({
        code: code.trim().toUpperCase(),
        name: name.trim(),
        acronym: acronym.trim() || undefined,
        researchLines: [selectedLine],
        status,
        recognitionDate: recognitionDate || undefined,
        fuente,
        miembros,
      });
      router.push(`/grupos/${code.trim().toUpperCase()}/ficha?created=true`);
    } catch (err: any) {
      setErrors([err.message || 'Error al guardar el grupo.']);
      setGuardando(false);
    }
  };

  if (isLoading || !user || user.role !== 'admin') {
    return (
      <MainLayout title="" subtitle="">
        <div className="flex h-[50vh] items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-3">
            <svg className="animate-spin h-8 w-8 text-[#001631]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="font-sans text-[14px] text-[#475569]">Verificando credenciales...</span>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="" subtitle="">
      <div className="flex flex-col gap-0">

        {/* ── Barra Superior: Breadcrumb + título + botones ── */}
        <div className="flex items-start justify-between pb-4">

          {/* Izquierda */}
          <div>
            {/* Back link */}
            <button
              onClick={() => router.push('/grupos')}
              className="inline-flex items-center gap-1 text-[13px] font-sans text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer mb-2"
              aria-label="Volver a la bandeja principal"
            >
              <BackIcon />
            </button>

            {/* Título + badges */}
            <h1 className="font-heading font-semibold text-h1 text-on-surface leading-[38px]">
              Crear Nuevo Grupo de Investigación
            </h1>
            <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 font-sans font-bold text-[10px] px-2 py-0.5 rounded border border-slate-200 uppercase tracking-widest">
                • Ingreso Manual
              </span>
            </div>
          </div>

          {/* Derecha — Cancelar + Guardar */}
          <div className="flex gap-2 flex-shrink-0 ml-4">
            <Button
              variant="secondary"
              size="md"
              onClick={() => router.push('/grupos')}
            >
              Cancelar
            </Button>
            {user?.role === 'admin' && (
              <Button
                variant="primary"
                size="md"
                onClick={handleGuardar}
                loading={guardando}
                iconLeft={<CheckIcon />}
              >
                Guardar y Validar
              </Button>
            )}
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
            onClick={() => setActiveTab('datos-maestros')}
            className={`flex items-center gap-2 px-5 py-3 font-sans font-semibold text-[13px] border-b-2 transition-all duration-300 ease-out cursor-pointer ${
              activeTab === 'datos-maestros'
                ? 'border-[#001631] text-[#001631]'
                : 'border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline'
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
            </svg>
            Datos Maestros
          </button>
          <button
            onClick={() => setActiveTab('miembros')}
            className={`flex items-center gap-2 px-5 py-3 font-sans font-semibold text-[13px] border-b-2 transition-all duration-300 ease-out cursor-pointer ${
              activeTab === 'miembros'
                ? 'border-[#001631] text-[#001631]'
                : 'border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline'
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            Gestión de Miembros
          </button>
        </div>

        {/* ── Contenido del Tab ─────────────────────────────────────────────── */}
        <div key={activeTab} className="bg-surface-container-lowest border border-t-0 border-outline-variant rounded-b p-6 shadow-level-1 animate-sweep-in">

          {/* TAB 1 — DATOS MAESTROS */}
          {activeTab === 'datos-maestros' && (
            <div className="max-w-[620px] flex flex-col gap-5">

              {/* Código + Fuente */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="code" className="block font-sans font-bold text-[10px] text-on-surface uppercase tracking-widest mb-1.5">
                    Código Único (ID) <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="code"
                    type="text"
                    placeholder="Ej. GI-006"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full px-3 py-2 font-sans text-[13px] text-on-surface bg-surface-container-lowest border border-outline-variant rounded outline-none focus:ring-2 focus:ring-[#a8c8fa]"
                  />
                </div>
                <div>
                  <label htmlFor="fuente" className="block font-sans font-bold text-[10px] text-on-surface uppercase tracking-widest mb-1.5">
                    Fuente de Origen
                  </label>
                  <div className="relative">
                    <select
                      id="fuente"
                      value={fuente}
                      onChange={(e) => setFuente(e.target.value as FuenteOrigen)}
                      className="w-full appearance-none px-3 pr-8 py-2 font-sans text-[13px] text-on-surface bg-surface-container-lowest border border-outline-variant rounded outline-none focus:ring-2 focus:ring-[#a8c8fa]"
                    >
                      <option value="Manual">Manual</option>
                      <option value="RAIS">RAIS</option>
                      <option value="Res. Rectoral">Res. Rectoral</option>
                    </select>
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                    </span>
                  </div>
                </div>
              </div>

              {/* Nombre Oficial */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="nombre" className="font-sans font-bold text-[10px] text-on-surface uppercase tracking-widest">
                    Nombre Oficial del Grupo <span className="text-red-500">*</span>
                  </label>
                  {isNameAnomalous() && (
                    <span className="font-sans font-bold text-[10px] text-[#d97706] uppercase tracking-widest">
                      HOY SIN FORMATO
                    </span>
                  )}
                </div>
                <textarea
                  id="nombre"
                  placeholder="Ingrese el nombre completo del grupo..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 font-sans text-[13px] text-on-surface bg-surface-container-lowest border border-outline-variant rounded outline-none focus:ring-2 focus:ring-[#a8c8fa] resize-none"
                />
                {isNameAnomalous() && (
                  <p className="mt-1 font-sans text-[12px] text-[#64748b]">
                    Corrige errores tipográficos provenientes de la importación.
                  </p>
                )}
              </div>

              {/* Acrónimo + Fecha Registro */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="acronym" className="block font-sans font-bold text-[10px] text-on-surface uppercase tracking-widest mb-1.5">
                    Acrónimo / Siglas
                  </label>
                  <input
                    id="acronym"
                    type="text"
                    placeholder="Ej: GIAP"
                    value={acronym}
                    onChange={(e) => setAcronym(e.target.value)}
                    className="w-full px-3 py-2 font-sans text-[13px] text-on-surface bg-surface-container-lowest border border-outline-variant rounded outline-none focus:ring-2 focus:ring-[#a8c8fa]"
                  />
                </div>
                <div>
                  <label htmlFor="fechaRecon" className="block font-sans font-bold text-[10px] text-on-surface uppercase tracking-widest mb-1.5">
                    Fecha de Reconocimiento
                  </label>
                  <input
                    id="fechaRecon"
                    type="date"
                    value={recognitionDate}
                    onChange={(e) => setRecognitionDate(e.target.value)}
                    className="w-full px-3 py-2 font-sans text-[13px] text-on-surface bg-surface-container-lowest border border-outline-variant rounded outline-none focus:ring-2 focus:ring-[#a8c8fa]"
                  />
                </div>
              </div>

              {/* Línea de Investigación + Estado */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="linea" className="block font-sans font-bold text-[10px] text-on-surface uppercase tracking-widest mb-1.5">
                    Línea de Investigación Principal
                  </label>
                  <div className="relative">
                    <select
                      id="linea"
                      value={selectedLine}
                      onChange={(e) => setSelectedLine(e.target.value)}
                      className="w-full appearance-none px-3 pr-8 py-2 font-sans text-[13px] text-on-surface bg-surface-container-lowest border border-outline-variant rounded outline-none focus:ring-2 focus:ring-[#a8c8fa]"
                    >
                      {lineas.length === 0 ? (
                        <option value="">Cargando líneas de investigación...</option>
                      ) : (
                        lineas.map((l) => <option key={l} value={l}>{l}</option>)
                      )}
                    </select>
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                    </span>
                  </div>
                </div>

                <div>
                  <label htmlFor="estado" className="block font-sans font-bold text-[10px] text-on-surface uppercase tracking-widest mb-1.5">
                    Estado Inicial del Grupo
                  </label>
                  <div className="relative">
                    <select
                      id="estado"
                      value={status}
                      onChange={(e) => setStatus(e.target.value as EstadoGrupo)}
                      className="w-full appearance-none px-3 pr-8 py-2 font-sans text-[13px] text-on-surface bg-surface-container-lowest border border-outline-variant rounded outline-none focus:ring-2 focus:ring-[#a8c8fa]"
                    >
                      <option value="pendiente_validacion">Pendiente Validar</option>
                      <option value="validado_activo">Validado / Activo</option>
                      <option value="validado_inactivo">Validado / Inactivo</option>
                    </select>
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#94a3b8]">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                    </span>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2 — GESTIÓN DE MIEMBROS */}
          {activeTab === 'miembros' && (
            <div className="flex flex-col gap-5">

              {/* Buscador en padrón */}
              <div>
                <p className="font-sans font-bold text-[10px] text-on-surface uppercase tracking-widest mb-1.5">
                  Buscar en Padrón de Investigadores
                </p>
                <div className="flex gap-2 items-center">
                  <div className="flex-1 relative max-w-xl">
                    <input
                      type="text"
                      placeholder="DNI o Nombre de investigador..."
                      value={busquedaInv}
                      onChange={(e) => setBusquedaInv(e.target.value)}
                      className="w-full pl-8 pr-16 py-2 font-sans text-[13px] text-on-surface bg-surface-container-lowest border border-outline-variant rounded outline-none focus:ring-2 focus:ring-[#a8c8fa]"
                    />
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94a3b8]">
                      <SearchIcon />
                    </span>

                    {/* Spinner e Ícono de Limpiar */}
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      {buscando && <SpinnerIcon />}
                      {busquedaInv && (
                        <button
                          type="button"
                          onClick={() => {
                            setBusquedaInv('');
                            setResultadosBusqueda([]);
                          }}
                          className="text-[#94a3b8] hover:text-on-surface p-1 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                          aria-label="Limpiar búsqueda"
                        >
                          <ClearIcon />
                        </button>
                      )}
                    </div>

                    {/* Dropdown autocompletado */}
                    {(resultadosBusqueda.length > 0 || (hasSearched && !buscando && resultadosBusqueda.length === 0)) && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#e2e8f0] rounded shadow-lg max-h-60 overflow-y-auto z-50 divide-y divide-[#f1f5f9] backdrop-blur-sm bg-white/95">
                        {resultadosBusqueda.length > 0 ? (
                          resultadosBusqueda.map((inv) => (
                            <button
                              key={inv.dni}
                              type="button"
                              onClick={() => handleAddMiembro(inv)}
                              className="w-full text-left px-4 py-3 hover:bg-[#f8fafc] font-sans cursor-pointer transition-all duration-150 flex items-center justify-between group"
                            >
                              <div className="flex flex-col gap-0.5">
                                <div className="text-[12px] font-bold text-[#0f172a] group-hover:text-[#001631] transition-colors">{inv.nombre}</div>
                                <div className="text-[10px] text-[#64748b] flex items-center gap-1.5 flex-wrap">
                                  <span>DNI: {inv.dni}</span>
                                  {inv.departamento && <span>• {inv.departamento}</span>}
                                  {inv.isExternal && inv.nivelRenacyt && (
                                    <span className="bg-[#fef3c7] text-[#92400e] px-1 rounded text-[9px] font-semibold">{inv.nivelRenacyt}</span>
                                  )}
                                </div>
                              </div>
                              
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider whitespace-nowrap transition-all duration-150 ${
                                inv.isExternal
                                  ? 'bg-purple-50 text-purple-700 border-purple-200 group-hover:bg-purple-100'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 group-hover:bg-emerald-100'
                              }`}>
                                {inv.isExternal ? 'RENACYT' : 'UNMSM'}
                              </span>
                            </button>
                          ))
                        ) : (
                          <div className="px-4 py-6 text-center text-[#64748b] font-sans text-[12px] flex flex-col items-center gap-1">
                            <span className="text-[#cbd5e1] flex justify-center">
                              <WarningIcon />
                            </span>
                            <span>No se encontraron investigadores locales ni en RENACYT con ese término.</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Regla de negocio inline a la derecha del botón */}
                  <div className="flex items-center gap-1.5 text-[13px] font-sans text-on-surface-variant ml-2">
                    <span className="text-on-surface-variant"><InfoIcon /></span>
                    <span>Debe existir un <strong className="text-on-surface">Director</strong> activo.</span>
                  </div>
                </div>
              </div>

              {/* Tabla de Miembros */}
              <div className="border border-outline-variant rounded overflow-hidden shadow-sm">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-outline-variant bg-surface-container-low">
                      <th className="px-4 py-3 font-sans font-bold text-[10px] text-on-surface uppercase tracking-widest">
                        Investigador
                      </th>
                      <th className="px-4 py-3 font-sans font-bold text-[10px] text-on-surface uppercase tracking-widest w-[120px]">
                        ID / DNI
                      </th>
                      <th className="px-4 py-3 font-sans font-bold text-[10px] text-on-surface uppercase tracking-widest w-[180px]">
                        Rol en el Grupo
                      </th>
                      <th className="px-4 py-3 font-sans font-bold text-[10px] text-on-surface uppercase tracking-widest w-[130px]">
                        Fecha Incorp.
                      </th>
                      <th className="px-4 py-3 font-sans font-bold text-[10px] text-on-surface uppercase tracking-widest w-[70px] text-right">
                        Acción
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {miembros.length > 0 ? (
                      miembros.map((m) => {
                        const isDir = m.rol === 'Director';
                        const initials = m.nombre.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
                        return (
                          <tr key={m.dni} className="hover:bg-surface-container-low/50">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-sans font-bold text-[11px] flex-shrink-0 ${isDir ? 'bg-[#001631] text-white' : 'bg-surface-container text-on-surface-variant'}`}>
                                  {initials}
                                </div>
                                <span className="font-sans font-semibold text-[13px] text-on-surface">{m.nombre}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 font-sans text-[13px] text-on-surface-variant">
                              {m.dni}
                            </td>
                            <td className="px-4 py-3">
                              <div className="relative">
                                <select
                                  value={m.rol}
                                  onChange={(e) => handleRoleChange(m.dni, e.target.value as RolMiembro)}
                                  className="w-full appearance-none pl-2 pr-6 py-1 font-sans text-[12px] text-on-surface bg-surface-container-lowest border border-outline-variant rounded outline-none focus:ring-1 focus:ring-[#a8c8fa] cursor-pointer"
                                >
                                  <option value="Director">Director</option>
                                  <option value="Co-Investigador">Co-Investigador</option>
                                  <option value="Colaborador">Colaborador</option>
                                  <option value="Tesista">Tesista</option>
                                </select>
                                <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-on-surface-variant">
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 font-sans text-[13px] text-on-surface-variant">
                              {m.fechaIncorporacion}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveMiembro(m.dni)}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors cursor-pointer"
                                title="Remover del grupo"
                              >
                                <TrashIcon />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center font-sans text-[13px] text-[#94a3b8]">
                          No hay miembros en el grupo. Use el buscador para añadir investigadores.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
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
          Grupo creado y validado exitosamente.
        </div>
      )}
    </MainLayout>
  );
}
