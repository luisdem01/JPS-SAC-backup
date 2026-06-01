'use client';

/**
 * @file nuevo/page.tsx
 * @route /SGPI-CFMH/nuevo
 * @description Formulario de registro de nuevo Docente/Investigador.
 *
 * Secciones:
 *   1. Información Personal (DNI, nombres, apellidos, email, teléfono, depto)
 *   2. Calificación Académica (botones Nivel Renacyt, toggle Investigador SM)
 *   3. Carga y Producción Inicial (puntaje inicial, publicaciones, h-index)
 *
 * Validaciones:
 *   EX1 – DNI único (blur)
 *   EX2 – Campos obligatorios (pre-submit)
 *
 * Modal de confirmación antes de registrar.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MainLayout } from '@/SGPI-CFU/components/layout';
import type { NivelRenacyt } from '../_data/types';
import { crearDocente, validarDNI } from '../_data/service';
import { DEPARTAMENTOS, NIVELES_RENACYT } from '../_data/mock';

// ─────────────────────────────────────────────────────────────────────────────
// Íconos
// ─────────────────────────────────────────────────────────────────────────────


const PersonIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);
const GraduateIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
    <path d="M6 12v5c3 3 9 3 12 0v-5"/>
  </svg>
);
const ClipboardIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
  </svg>
);
const CheckIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const InfoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="16" x2="12" y2="12"/>
    <line x1="12" y1="8" x2="12.01" y2="8"/>
  </svg>
);

const WarningIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const inputCls = (err?: boolean) =>
  `w-full px-3 py-2 font-sans text-[13px] text-on-surface border rounded outline-none
   focus:ring-2 transition-all placeholder:text-on-surface-variant
   ${err
     ? 'border-[#dc2626] bg-[#fff5f5] focus:ring-[#fca5a5]'
     : 'border-outline-variant focus:ring-[#a8c8fa] focus:border-primary'}`;

function Label({ text, required, htmlFor }: { text: string; required?: boolean; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor}
      className="block font-sans font-bold text-[10px] text-on-surface uppercase tracking-widest mb-1.5">
      {text}{required && <span className="text-[#dc2626] ml-0.5">*</span>}
    </label>
  );
}

const ChevronDown = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

function SelectField({ id, value, onChange, options, hasError }: {
  id: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; hasError?: boolean;
}) {
  return (
    <div className="relative">
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}
        className={`w-full appearance-none pl-3 pr-8 py-2 font-sans text-[13px] text-on-surface border rounded bg-surface-container-lowest outline-none focus:ring-2 cursor-pointer transition-all
          ${hasError ? 'border-[#dc2626] focus:ring-[#fca5a5]' : 'border-outline-variant focus:ring-[#a8c8fa]'}`}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant">
        <ChevronDown />
      </span>
    </div>
  );
}

function Toggle({ checked, onChange, id }: {
  checked: boolean; onChange: (v: boolean) => void; id: string;
}) {
  return (
    <button role="switch" aria-checked={checked} id={id}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200
        ${checked ? 'bg-[#16a34a]' : 'bg-[#d1d5db]'}`}>
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200
        ${checked ? 'translate-x-6' : 'translate-x-1'}`}/>
    </button>
  );
}

function SectionCard({ title, icon, children }: {
  title: string; icon: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded shadow-level-1 mb-4">
      <div className="px-6 py-4 border-b border-outline-variant flex items-center gap-2">
        <span className="text-on-surface-variant">{icon}</span>
        <h2 className="font-heading font-semibold text-[15px] text-on-surface">{title}</h2>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal de confirmación
// ─────────────────────────────────────────────────────────────────────────────

function ConfirmModal({
  datos, isSaving, onConfirm, onCancel,
}: {
  datos: {
    nombres: string; apellidos: string; dni: string;
    email: string; departamento: string;
    nivel: NivelRenacyt; esSM: boolean;
    puntajeInicial: string; publicaciones: string; hIndex: string;
  };
  isSaving: boolean;
  onConfirm: () => void;
  onCancel:  () => void;
}) {
  const filas = [
    { label: 'Nombre completo', value: `${datos.apellidos}, ${datos.nombres}` },
    { label: 'DNI / Pasaporte',  value: datos.dni },
    { label: 'Correo',           value: datos.email },
    { label: 'Departamento',     value: datos.departamento },
    { label: 'Nivel Renacyt',    value: datos.nivel },
    { label: 'Investigador SM',  value: datos.esSM ? 'Sí' : 'No' },
    { label: 'Puntaje inicial',  value: `${parseFloat(datos.puntajeInicial || '0').toFixed(2)} pts` },
    { label: 'Publicaciones',    value: datos.publicaciones || '0' },
    { label: 'H-Index (Scopus)', value: datos.hIndex || '0' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]"
      role="dialog" aria-modal="true" aria-labelledby="modal-confirm-title">

      <div
        className="w-full max-w-[500px] bg-white rounded-xl shadow-2xl border border-[#e2e8f0] overflow-hidden"
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-[#e2e8f0] bg-[#fffbeb]">
          <span className="flex-shrink-0"><WarningIcon /></span>
          <div>
            <h3 id="modal-confirm-title" className="font-heading font-bold text-[15px] text-[#92400e]">
              Confirmar Registro de Docente
            </h3>
            <p className="font-sans text-[11px] text-[#b45309] mt-0.5">
              Verifique que los datos sean correctos antes de registrar.
            </p>
          </div>
        </div>

        {/* Resumen */}
        <div className="px-6 py-4 overflow-y-auto max-h-[360px]">
          <div className="rounded border border-[#e2e8f0] overflow-hidden">
            {filas.map((f, i) => (
              <div key={f.label}
                className={`flex items-start gap-3 px-4 py-2.5 ${i % 2 === 0 ? 'bg-[#f8fafc]' : 'bg-white'} border-b border-[#f1f5f9] last:border-0`}>
                <span className="font-sans font-bold text-[10px] text-on-surface-variant uppercase tracking-widest w-[140px] flex-shrink-0 pt-0.5">
                  {f.label}
                </span>
                <span className="font-sans text-[13px] text-on-surface font-medium">{f.value}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 font-sans text-[11px] text-on-surface-variant leading-[16px]">
            Al confirmar, el registro será guardado en la base de datos y el docente quedará disponible
            para vinculación en proyectos de investigación.
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#e2e8f0] bg-[#f8fafc]">
          <button onClick={onCancel} disabled={isSaving}
            className="px-5 py-2 rounded font-sans font-semibold text-[13px] text-on-surface border border-outline-variant hover:bg-surface-container disabled:opacity-40 transition-colors">
            Cancelar
          </button>
          <button onClick={onConfirm} disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2 rounded font-sans font-semibold text-[13px] text-white bg-[#001631] hover:bg-[#002b54] disabled:opacity-50 transition-colors"
            aria-label="Confirmar y registrar docente">
            {isSaving ? (
              <>
                <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                Registrando...
              </>
            ) : (
              <><CheckIcon /> Confirmar Registro</>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────────────────────────────────────

// Niveles mostrados en la grilla (4 visibles en la imagen)
const NIVELES_GRILLA: NivelRenacyt[] = ['NIVEL VII', 'NIVEL VI', 'NIVEL V', 'NIVEL IV', 'NIVEL III', 'NIVEL II', 'NIVEL I', 'DISTINGUIDO'];

function NuevoDocentePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const dniParam = searchParams.get('dni') || '';
  const nombresParam = searchParams.get('nombres') || '';
  const apellidosParam = searchParams.get('apellidos') || '';
  const nivelParam = searchParams.get('nivelRenacyt') || '';

  // ── Campos ────────────────────────────────────────────────────────────────
  const [dni,             setDni]             = useState('');
  const [nombres,         setNombres]         = useState('');
  const [apellidos,       setApellidos]       = useState('');
  const [email,           setEmail]           = useState('');
  const [telefono,        setTelefono]        = useState('');
  const [departamento,    setDepartamento]    = useState('');
  const [nivelSeleccionado, setNivelSeleccionado] = useState<NivelRenacyt>('NIVEL IV');
  const [esSM,            setEsSM]            = useState(true);
  const [puntajeInicial,  setPuntajeInicial]  = useState('0.00');
  const [publicaciones,   setPublicaciones]   = useState('0');
  const [hIndex,          setHIndex]          = useState('0');

  useEffect(() => {
    if (dniParam) setDni(dniParam);
    if (nombresParam) setNombres(nombresParam);
    if (apellidosParam) setApellidos(apellidosParam);
    if (nivelParam) setNivelSeleccionado(nivelParam as NivelRenacyt);
  }, [dniParam, nombresParam, apellidosParam, nivelParam]);

  // ── Validación ────────────────────────────────────────────────────────────
  const [fieldErrors,  setFieldErrors]  = useState<string[]>([]);
  const [dniError,     setDniError]     = useState<string | null>(null);
  const [globalError,  setGlobalError]  = useState<string | null>(null);
  const [showModal,    setShowModal]    = useState(false);
  const [isSaving,     setIsSaving]     = useState(false);

  // EX1: Validar DNI único al salir del campo
  const handleBlurDNI = useCallback(async () => {
    if (!dni.trim()) { setDniError(null); return; }
    const { duplicado } = await validarDNI(dni);
    setDniError(
      duplicado ? 'Error: El DNI del docente ya se encuentra en el padrón.' : null
    );
  }, [dni]);

  // EX2: Validar campos obligatorios
  const validateRequired = (): boolean => {
    const errs: string[] = [];
    if (!dni.trim())         errs.push('dni');
    if (!nombres.trim())     errs.push('nombres');
    if (!apellidos.trim())   errs.push('apellidos');
    if (!email.trim())       errs.push('email');
    if (!departamento)       errs.push('departamento');
    setFieldErrors(errs);
    if (errs.length > 0) {
      setGlobalError('Debe completar todos los campos obligatorios para guardar el perfil.');
      return false;
    }
    return true;
  };

  // Abrir modal de confirmación
  const handleRegistrar = () => {
    setGlobalError(null);
    if (dniError) { setGlobalError(dniError); return; }
    if (!validateRequired()) return;
    setShowModal(true);
  };

  // Confirmar registro
  const handleConfirm = async () => {
    setIsSaving(true);
    try {
      await crearDocente({
        nombres, apellidos, dni, email,
        departamento,
        nivelRenacyt:  nivelSeleccionado,
        condicionSM:   esSM ? 'SM' : 'No SM',
        estado:        'activo',
        puntajeHistorico: [{
          anio:       new Date().getFullYear(),
          puntaje:    parseFloat(puntajeInicial || '0'),
          articulos:  parseInt(publicaciones || '0'),
          tesis:      0,
          proyectos:  0,
        }],
      });
      setShowModal(false);
      router.push('/SGPI-CFMH');
    } catch {
      setGlobalError('Error al registrar el docente. Intente nuevamente.');
      setShowModal(false);
    } finally {
      setIsSaving(false);
    }
  };

  const hasErr = (f: string) => fieldErrors.includes(f);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <MainLayout title="Sistema de Gestión de Proyectos de Investigación">

      <div className="max-w-[860px] mx-auto w-full">

      {/* ── Encabezado ────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-5 gap-4">
        <div>
          <h1 className="font-heading font-semibold text-h1 text-on-surface">
            Registrar Nuevo Docente/Investigador
          </h1>
          <p className="font-sans text-body-md text-on-surface-variant mt-0.5">
            Completa los campos requeridos para el nuevo docente/investigador
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={() => router.push('/SGPI-CFMH')}
            className="border border-[#e2e8f0] hover:bg-slate-50 font-sans text-[13px] text-[#475569] px-4 py-2 rounded transition-colors cursor-pointer"
            type="button"
            aria-label="Cancelar registro">
            Cancelar
          </button>
          <button onClick={handleRegistrar}
            className="flex items-center gap-2 bg-[#001631] hover:bg-[#002b54] text-white font-sans font-bold text-[13px] px-4 py-2 rounded shadow transition-colors cursor-pointer"
            type="button"
            aria-label="Registrar nuevo docente">
            <GraduateIcon /> Registrar Docente
          </button>
        </div>
      </div>

      {/* Error global */}
      {globalError && (
        <div role="alert"
          className="flex items-start gap-2 px-4 py-3 rounded border bg-[#fee2e2] border-[#fca5a5] text-[#991b1b] font-sans text-[13px] mb-4">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {globalError}
        </div>
      )}

      <div className="mb-6">

        {/* ── 1. Información Personal ─────────────────────────────────────────── */}
        <SectionCard title="Información Personal" icon={<PersonIcon />}>
          <div className="flex flex-col gap-4">

            {/* DNI + Nombres + Apellidos */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label text="DNI / Pasaporte" required htmlFor="reg-dni" />
                <input id="reg-dni" type="text" value={dni}
                  onChange={(e) => setDni(e.target.value)}
                  onBlur={handleBlurDNI}
                  placeholder="Ingrese número de documento"
                  aria-invalid={hasErr('dni') || !!dniError}
                  className={inputCls(hasErr('dni') || !!dniError)}
                />
                {dniError && (
                  <p className="mt-1 font-sans text-[11px] text-[#dc2626]" role="alert">{dniError}</p>
                )}
              </div>
              <div>
                <Label text="Nombres" required htmlFor="reg-nombres" />
                <input id="reg-nombres" type="text" value={nombres}
                  onChange={(e) => setNombres(e.target.value)}
                  placeholder="Ej. Juan Alberto"
                  aria-invalid={hasErr('nombres')}
                  className={inputCls(hasErr('nombres'))}
                />
              </div>
              <div>
                <Label text="Apellidos" required htmlFor="reg-apellidos" />
                <input id="reg-apellidos" type="text" value={apellidos}
                  onChange={(e) => setApellidos(e.target.value)}
                  placeholder="Ej. Pérez García"
                  aria-invalid={hasErr('apellidos')}
                  className={inputCls(hasErr('apellidos'))}
                />
              </div>
            </div>

            {/* Email + Teléfono + Departamento */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label text="Correo Institucional" required htmlFor="reg-email" />
                <input id="reg-email" type="email" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jperezg@unmsm.edu.pe"
                  aria-invalid={hasErr('email')}
                  className={inputCls(hasErr('email'))}
                />
              </div>
              <div>
                <Label text="Teléfono de Contacto" htmlFor="reg-tel" />
                <input id="reg-tel" type="tel" value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="+51 900 000 000"
                  className={inputCls()}
                />
              </div>
              <div>
                <Label text="Departamento Académico" required htmlFor="reg-depto" />
                <SelectField id="reg-depto" value={departamento}
                  onChange={setDepartamento}
                  hasError={hasErr('departamento')}
                  options={[
                    { value: '', label: 'Seleccione Departamento' },
                    ...DEPARTAMENTOS.map((d) => ({ value: d, label: d })),
                  ]}
                />
              </div>
            </div>

          </div>
        </SectionCard>

        {/* ── 2. Calificación Académica ───────────────────────────────────────── */}
        <SectionCard title="Calificación Académica" icon={<GraduateIcon />}>
          <div className="flex gap-6 flex-wrap">

            {/* Grid de niveles */}
            <div className="flex-1">
              <Label text="Nivel Renacyt" />
              <div className="grid grid-cols-2 gap-2">
                {NIVELES_GRILLA.map((n) => {
                  const sel = nivelSeleccionado === n;
                  return (
                    <button key={n} type="button"
                      onClick={() => setNivelSeleccionado(n)}
                      aria-pressed={sel}
                      className={`
                        flex items-center gap-2 px-4 py-2.5 rounded font-sans font-semibold text-[13px]
                        border transition-all duration-100
                        ${sel
                          ? 'bg-[#001631] text-white border-[#001631]'
                          : 'bg-white text-on-surface border-outline-variant hover:border-[#001631] hover:bg-surface-container'}
                      `}>
                      <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0
                        ${sel ? 'border-white' : 'border-outline-variant'}`}>
                        {sel && (
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white"
                            strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        )}
                      </span>
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Toggle Investigador SM */}
            <div className="w-full md:w-[240px]">
              <div className="border border-outline-variant rounded p-4 flex items-start gap-3 h-full">
                <div className="flex-shrink-0 mt-0.5">
                  <div className="w-8 h-8 rounded-full bg-[#dbeafe] flex items-center justify-center">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="12" y1="16" x2="12" y2="12"/>
                      <line x1="12" y1="8" x2="12.01" y2="8"/>
                    </svg>
                  </div>
                </div>
                <div className="flex-1">
                  <p className="font-sans font-bold text-[13px] text-on-surface">
                    Investigador San Marcos
                  </p>
                  <p className="font-sans text-[11px] text-on-surface-variant mt-0.5">
                    Habilitar beneficios y acceso a fondos internos
                  </p>
                </div>
                <Toggle id="toggle-sm-nuevo" checked={esSM} onChange={setEsSM} />
              </div>
            </div>

          </div>
        </SectionCard>

        {/* ── 3. Carga y Producción Inicial ───────────────────────────────────── */}
        <SectionCard title="Carga y Producción Inicial" icon={<ClipboardIcon />}>
          <div className="flex flex-col gap-4">

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label text="Puntaje Académico Inicial" htmlFor="reg-puntaje" />
                <div className="relative">
                  <input id="reg-puntaje" type="number" min="0" step="0.01"
                    value={puntajeInicial}
                    onChange={(e) => setPuntajeInicial(e.target.value)}
                    className="w-full pl-3 pr-10 py-2 font-mono text-[13px] text-on-surface border border-outline-variant rounded outline-none focus:ring-2 focus:ring-[#a8c8fa] transition-all"
                    aria-label="Puntaje académico inicial"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-sans text-[11px] text-on-surface-variant">
                    pts
                  </span>
                </div>
              </div>
              <div>
                <Label text="Publicaciones Previas" htmlFor="reg-pubs" />
                <input id="reg-pubs" type="number" min="0" step="1"
                  value={publicaciones}
                  onChange={(e) => setPublicaciones(e.target.value)}
                  className="w-full px-3 py-2 font-mono text-[13px] text-on-surface border border-outline-variant rounded outline-none focus:ring-2 focus:ring-[#a8c8fa] transition-all"
                  aria-label="Número de publicaciones previas"
                />
              </div>
              <div>
                <Label text="H-Index (Scopus)" htmlFor="reg-hindex" />
                <input id="reg-hindex" type="number" min="0" step="1"
                  value={hIndex}
                  onChange={(e) => setHIndex(e.target.value)}
                  className="w-full px-3 py-2 font-mono text-[13px] text-on-surface border border-outline-variant rounded outline-none focus:ring-2 focus:ring-[#a8c8fa] transition-all"
                  aria-label="H-Index según Scopus"
                />
              </div>
            </div>

            {/* Nota informativa */}
            <div className="flex items-start gap-3 p-3 rounded bg-[#eff6ff] border border-[#bfdbfe]">
              <span className="flex-shrink-0 mt-0.5 text-[#3b82f6]"><InfoIcon /></span>
              <p className="font-sans text-[11px] text-[#1e40af] leading-[16px]">
                El puntaje inicial será validado por la comisión académica antes de su sincronización
                con el sistema nacional. Asegúrese de adjuntar documentos probatorios en el expediente físico.
              </p>
            </div>

          </div>
        </SectionCard>

      </div>

      </div>



      {/* ── Modal de confirmación ────────────────────────────────────────────── */}
      {showModal && (
        <ConfirmModal
          datos={{ nombres, apellidos, dni, email, departamento, nivel: nivelSeleccionado, esSM, puntajeInicial, publicaciones, hIndex }}
          isSaving={isSaving}
          onConfirm={handleConfirm}
          onCancel={() => setShowModal(false)}
        />
      )}

    </MainLayout>
  );
}

export default function NuevoDocentePage() {
  return (
    <React.Suspense fallback={<div className="p-6 text-center text-on-surface-variant font-sans animate-pulse">Cargando...</div>}>
      <NuevoDocentePageContent />
    </React.Suspense>
  );
}
