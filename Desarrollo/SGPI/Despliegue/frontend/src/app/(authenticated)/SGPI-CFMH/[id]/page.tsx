'use client';

/**
 * @file [id]/page.tsx
 * @route /investigadores/[id]
 * @description Perfil editable de Docente/Investigador.
 * Accesible desde:
 *   - Ícono 👁 (vista/edición combinada)
 *   - Ícono ✏  (alias /investigadores/[id]/editar → redirige aquí)
 *
 * Secciones:
 *   1. Información General (DNI readonly + validado, nombres, apellidos, depto, estado)
 *   2. Calificación Académica (nivel Renacyt, toggle SM, puntaje actual)
 *   3. Historial de Producción (últimos 7 años — mini-grid editable, EX3)
 *
 * Validaciones:
 *   EX1 – DNI único (blur sobre DNI)
 *   EX2 – Campos obligatorios vacíos (pre-save)
 *   EX3 – Valores numéricos en historial (0–100)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { MainLayout } from '@/SGPI-CFU/components/layout';
import type { DocenteInvestigador, NivelRenacyt, EstadoVigencia } from '../_data/types';
import { getDocenteById, actualizarDocente, getDepartamentos, getNivelesRenacyt } from '../_data/service';
import { validateInstitutionalEmail } from '@/SGPI-CFU/lib/utils/validators';
import { apiClient } from '@/SGPI-CFU/lib/api/client';

// ─────────────────────────────────────────────────────────────────────────────
// Íconos
// ─────────────────────────────────────────────────────────────────────────────

const BackIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);
const CheckSmall = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const SaveIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
);
const HistorialIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const inputCls = (err?: boolean) =>
  `w-full px-3 py-2 font-sans text-[13px] text-on-surface border rounded outline-none
   focus:ring-2 transition-all
   ${err
    ? 'border-[#dc2626] bg-[#fff5f5] focus:ring-[#fca5a5]'
    : 'border-outline-variant focus:ring-[#a8c8fa] focus:border-primary'}`;

const selectCls =
  'w-full appearance-none pl-3 pr-8 py-2 font-sans text-[13px] text-on-surface border border-outline-variant rounded bg-surface-container-lowest outline-none focus:ring-2 focus:ring-[#a8c8fa] cursor-pointer transition-all';

const ChevronDown = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

function SelectField({ id, value, onChange, options }: {
  id: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={selectCls}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant">
        <ChevronDown />
      </span>
    </div>
  );
}

function Label({ text, required }: { text: string; required?: boolean }) {
  return (
    <label className="block font-sans font-bold text-[10px] text-on-surface uppercase tracking-widest mb-1.5">
      {text}{required && <span className="text-[#dc2626] ml-0.5">*</span>}
    </label>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded shadow-level-1 mb-4">
      <div className="px-6 py-4 border-b border-outline-variant">
        <h2 className="font-heading font-semibold text-[15px] text-on-surface">{title}</h2>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Toggle
// ─────────────────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, id }: {
  checked: boolean; onChange: (v: boolean) => void; id: string;
}) {
  return (
    <button role="switch" aria-checked={checked} id={id}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200
        ${checked ? 'bg-[#16a34a]' : 'bg-[#d1d5db]'}`}>
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200
        ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Alert banner
// ─────────────────────────────────────────────────────────────────────────────

function AlertBanner({ message, type }: { message: string; type: 'error' | 'success' }) {
  const cfg = type === 'error'
    ? 'bg-[#fee2e2] border-[#fca5a5] text-[#991b1b]'
    : 'bg-[#dcfce7] border-[#86efac] text-[#166534]';
  return (
    <div role="alert"
      className={`flex items-start gap-2 px-4 py-3 rounded border ${cfg} font-sans text-[13px] mb-4`}>
      {type === 'error' ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
      {message}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear();

export default function DocentePerfilPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';

  const [doc, setDoc] = useState<DocenteInvestigador | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [alert, setAlert] = useState<{ msg: string; type: 'error' | 'success' } | null>(null);

  // ── Campos del formulario ──────────────────────────────────────────────────
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [email, setEmail] = useState('');
  const [departamento, setDepartamento] = useState('');
  const [estado, setEstado] = useState<EstadoVigencia>('activo');
  const [nivel, setNivel] = useState<NivelRenacyt>('Sin nivel');
  const [esSM, setEsSM] = useState(false);
  const [historial, setHistorial] = useState<{ anio: number; puntaje: string }[]>([]);
  const [histErrors, setHistErrors] = useState<boolean[]>([]);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const [departamentos, setDepartamentos] = useState<string[]>([]);
  const [nivelesRenacyt, setNivelesRenacyt] = useState<string[]>([]);

  // ── Cargar catálogos ────────────────────────────────────────────────────────
  useEffect(() => {
    async function loadCatalogos() {
      try {
        const [depts, nivs] = await Promise.all([
          getDepartamentos(),
          getNivelesRenacyt(),
        ]);
        setDepartamentos(depts);
        setNivelesRenacyt(nivs);
      } catch (err) {
        console.error('Error al cargar catálogos en perfil:', err);
      }
    }
    loadCatalogos();
  }, []);

  // ── Cargar docente ─────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const data = await getDocenteById(id);
      if (!data) { setNotFound(true); setIsLoading(false); return; }
      setDoc(data);
      setNombres(data.nombres);
      setApellidos(data.apellidos);
      setEmail(data.email);
      setDepartamento(data.departamento);
      setEstado(data.estado);
      setNivel(data.nivelRenacyt);
      setEsSM(data.condicionSM === 'SM');
      // Últimos 7 años
      const años = Array.from({ length: 7 }, (_, i) => CURRENT_YEAR - 6 + i);
      setHistorial(años.map((anio) => {
        const found = data.puntajeHistorico.find((p) => p.anio === anio);
        return { anio, puntaje: found ? String(found.puntaje) : '0' };
      }));
      setHistErrors(new Array(7).fill(false));
      setIsLoading(false);
    }
    load();
  }, [id]);

  // ── Puntaje actual = año corriente ─────────────────────────────────────────
  const puntajeActual = historial.find((h) => h.anio === CURRENT_YEAR)?.puntaje ?? '0';

  // ── Validaciones ──────────────────────────────────────────────────────────

  // EX3: validar historial (0-100, numérico)
  const validateHistorial = useCallback((): boolean => {
    const errors = historial.map((h) => {
      const v = parseFloat(h.puntaje);
      return isNaN(v) || v < 0 || v > 100;
    });
    setHistErrors(errors);
    if (errors.some(Boolean)) {
      setAlert({ msg: 'Formato de puntaje inválido. Los valores deben ser numéricos entre 0 y 100.', type: 'error' });
      return false;
    }
    return true;
  }, [historial]);

  // EX2: campos obligatorios
  const validateRequired = useCallback((): boolean => {
    const errs: string[] = [];
    if (!nombres.trim()) errs.push('nombres');
    if (!apellidos.trim()) errs.push('apellidos');
    
    const emailErr = validateInstitutionalEmail(email);
    if (emailErr) errs.push('email');

    if (!departamento) errs.push('departamento');
    setFieldErrors(errs);
    if (errs.length > 0) {
      if (emailErr && email.trim()) {
        setAlert({ msg: emailErr, type: 'error' });
      } else {
        setAlert({ msg: 'Debe completar todos los campos obligatorios para guardar el perfil.', type: 'error' });
      }
      return false;
    }
    return true;
  }, [nombres, apellidos, email, departamento]);

  const [isSavingImport, setIsSavingImport] = useState(false);

  const handleImportar = async () => {
    setAlert(null);
    setIsSavingImport(true);
    try {
      const updated = await actualizarDocente(id, {
        dni: doc!.dni,
        nombres,
        apellidos,
        email,
        departamento: departamento || 'Externo (RENACYT)',
        nivelRenacyt: nivel,
        condicionSM: esSM ? 'SM' : 'No SM',
        estado,
        puntajeHistorico: historial.map((h) => ({
          anio: h.anio, puntaje: parseFloat(h.puntaje),
          articulos: 0, tesis: 0, proyectos: 0,
        })),
        isExternal: false
      });
      setDoc(updated);
      if (updated.departamento) setDepartamento(updated.departamento);
      setAlert({ msg: 'El investigador ha sido importado con éxito a la base de datos local.', type: 'success' });
    } catch (err) {
      setAlert({ msg: 'Ocurrió un error al importar el investigador.', type: 'error' });
    } finally {
      setIsSavingImport(false);
    }
  };

  const [showSincronizar, setShowSincronizar] = useState(false);
  const [tesisExternas, setTesisExternas] = useState<any[]>([]);
  const [loadingTesis, setLoadingTesis] = useState(false);
  const [importingTesisUrls, setImportingTesisUrls] = useState<Record<string, boolean>>({});
  const [importedUrls, setImportedUrls] = useState<Set<string>>(new Set());
  const [modalSearchTerm, setModalSearchTerm] = useState('');

  const buscarTesisExternas = async (queryTerm?: string) => {
    setLoadingTesis(true);
    setTesisExternas([]);
    const term = queryTerm !== undefined ? queryTerm : modalSearchTerm || `${nombres} ${apellidos}`;
    try {
      const data = await apiClient.get<any[]>(`/theses/external?q=${encodeURIComponent(term)}&limit=15`);
      setTesisExternas(data);
      
      const checkPromises = data.map(async (t) => {
        try {
          await apiClient.get(`/theses/${encodeURIComponent(t.url_cybertesis)}`);
          return { url: t.url_cybertesis, imported: true };
        } catch {
          return { url: t.url_cybertesis, imported: false };
        }
      });
      const results = await Promise.all(checkPromises);
      const newImported = new Set<string>();
      results.forEach(r => {
        if (r.imported) newImported.add(r.url);
      });
      setImportedUrls(newImported);
    } catch (err) {
      console.error(err);
      setAlert({ msg: 'Error al buscar tesis externas.', type: 'error' });
    } finally {
      setLoadingTesis(false);
    }
  };

  const handleImportarIndividual = async (tesis: any) => {
    setImportingTesisUrls((prev) => ({ ...prev, [tesis.url_cybertesis]: true }));
    try {
      const payload = {
        ...tesis,
        dni_asesor: doc!.dni
      };
      await apiClient.post('/theses', payload);
      setImportedUrls((prev) => {
        const next = new Set(prev);
        next.add(tesis.url_cybertesis);
        return next;
      });
    } catch (err) {
      console.error(err);
      setAlert({ msg: 'Error al importar la tesis.', type: 'error' });
    } finally {
      setImportingTesisUrls((prev) => ({ ...prev, [tesis.url_cybertesis]: false }));
    }
  };

  useEffect(() => {
    if (showSincronizar && doc) {
      const initialTerm = `${nombres} ${apellidos}`;
      setModalSearchTerm(initialTerm);
      buscarTesisExternas(initialTerm);
    }
  }, [showSincronizar, doc]);

  // ── Guardar ────────────────────────────────────────────────────────────────
  const handleGuardar = async () => {
    setAlert(null);
    if (!validateRequired()) return;
    if (!validateHistorial()) return;
    setIsSaving(true);
    try {
      await actualizarDocente(id, {
        dni: doc!.dni,
        nombres, apellidos, email, departamento,
        nivelRenacyt: nivel,
        condicionSM: esSM ? 'SM' : 'No SM',
        estado,
        isExternal: false,
        puntajeHistorico: historial.map((h) => ({
          anio: h.anio, puntaje: parseFloat(h.puntaje),
          articulos: 0, tesis: 0, proyectos: 0,
        })),
      });
      router.push('/investigadores');
    } catch {
      setAlert({ msg: 'Error al guardar el perfil. Intente nuevamente.', type: 'error' });
      setIsSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <MainLayout title="Sistema de Gestión de Proyectos de Investigación">
        <div className="animate-pulse flex flex-col gap-4 max-w-[820px]">
          <div className="h-6 w-64 bg-surface-container-high rounded" />
          <div className="h-[200px] bg-surface-container-high rounded" />
          <div className="h-[120px] bg-surface-container-high rounded" />
        </div>
      </MainLayout>
    );
  }

  if (notFound || !doc) {
    return (
      <MainLayout title="Sistema de Gestión de Proyectos de Investigación">
        <div className="text-center py-20">
          <p className="font-sans font-semibold text-[14px] text-on-surface mb-2">Docente no encontrado.</p>
          <button onClick={() => router.push('/investigadores')}
            className="font-sans text-[13px] text-[#2563eb] hover:underline">
            Volver al directorio
          </button>
        </div>
      </MainLayout>
    );
  }

  const hasErr = (f: string) => fieldErrors.includes(f);

  return (
    <MainLayout title="Sistema de Gestión de Proyectos de Investigación">

      <div className="max-w-[860px] mx-auto w-full">

        {/* ── Encabezado ────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-5 gap-4">
          <h1 className="font-heading font-semibold text-h1 text-on-surface">
            Perfil de Docente/Investigador
          </h1>
          <div className="flex items-center gap-2">
            {!doc.isExternal && (
              <button
                type="button"
                onClick={() => setShowSincronizar(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#0284c7] hover:bg-[#0369a1] rounded font-sans font-semibold text-[13px] text-white transition-colors"
              >
                Sincronizar Cybertesis
              </button>
            )}
            <button onClick={() => router.push('/investigadores')}
              className="flex items-center gap-1.5 px-4 py-2 rounded font-sans font-semibold text-[13px] text-on-surface border border-outline-variant hover:bg-surface-container transition-colors"
              aria-label="Volver al directorio">
              <BackIcon /> Volver al directorio
            </button>
          </div>
        </div>

        {alert && <AlertBanner message={alert.msg} type={alert.type} />}

        {doc.isExternal && (
          <div className="bg-[#fff9db] border border-[#ffe066] text-[#8c6d00] px-4 py-4 rounded font-sans text-[13px] mb-5 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
            <div>
              <span className="font-bold block mb-0.5">Investigador Externo (Buscado en RENACYT)</span>
              Este investigador proviene de la base de datos externa de RENACYT y no está importado oficialmente en el sistema local.
            </div>
            <button
              onClick={handleImportar}
              disabled={isSaving || isSavingImport}
              className="bg-[#e67e22] hover:bg-[#d35400] text-white font-semibold py-2 px-4 rounded shadow transition-all duration-150 flex items-center justify-center gap-1.5 whitespace-nowrap self-start md:self-auto"
            >
              {isSavingImport ? 'Importando...' : 'Importar a Base de Datos'}
            </button>
          </div>
        )}

        <div>

          {/* ── 1. Información General ──────────────────────────────────────────── */}
          <SectionCard title="1. Información General">
            <div className="flex flex-col gap-4">

              {/* DNI + Nombres */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label text="DNI / Pasaporte" />
                  <input type="text" value={doc.dni} readOnly
                    className="w-full px-3 py-2 font-mono text-[13px] text-on-surface-variant border border-outline-variant rounded bg-surface-container-low outline-none cursor-not-allowed"
                    aria-label="DNI (no editable)"
                  />
                  <p className="mt-1 flex items-center gap-1 font-sans text-[11px] text-[#16a34a]">
                    <CheckSmall /> DNI verificado y único en el sistema.
                  </p>
                </div>
                <div>
                  <Label text="Nombres" required />
                  <input type="text" value={nombres}
                    onChange={(e) => setNombres(e.target.value)}
                    className={inputCls(hasErr('nombres'))}
                    aria-label="Nombres del docente"
                    aria-invalid={hasErr('nombres')}
                  />
                </div>
              </div>

              {/* Apellidos + Departamento */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label text="Apellidos" required />
                  <input type="text" value={apellidos}
                    onChange={(e) => setApellidos(e.target.value)}
                    className={inputCls(hasErr('apellidos'))}
                    aria-label="Apellidos del docente"
                    aria-invalid={hasErr('apellidos')}
                  />
                </div>
                <div>
                  <Label text="Departamento Académico" required />
                  <SelectField id="departamento" value={departamento}
                    onChange={setDepartamento}
                    options={[
                      { value: '', label: 'Seleccione...' },
                      ...departamentos.map((d) => ({ value: d, label: d })),
                    ]}
                  />
                </div>
              </div>

              {/* Email + Estado */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label text="Correo Institucional" required />
                  <input type="email" value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputCls(hasErr('email'))}
                    aria-label="Correo institucional"
                    aria-invalid={hasErr('email')}
                  />
                </div>
                <div>
                  <Label text="Estado en el Sistema" />
                  <SelectField id="estado" value={estado} onChange={(v) => setEstado(v as EstadoVigencia)}
                    options={[
                      { value: 'activo', label: 'Activo' },
                      { value: 'inactivo', label: 'Inactivo' },
                      { value: 'por_vencer', label: 'Por Vencer' },
                    ]}
                  />
                </div>
              </div>

            </div>
          </SectionCard>

          {/* ── 2. Calificación Académica ───────────────────────────────────────── */}
          <SectionCard title="2. Calificación Académica">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">

              <div>
                <Label text="Nivel Renacyt Actual" />
                <SelectField id="nivel-renacyt" value={nivel}
                  onChange={(v) => setNivel(v as NivelRenacyt)}
                  options={nivelesRenacyt.map((n) => ({ value: n, label: n }))}
                />
              </div>

              <div>
                <Label text="¿Es Investigador San Marcos (RR Nº 02127-R-17)?" />
                <div className="flex items-center gap-3 mt-1">
                  <Toggle id="toggle-sm" checked={esSM} onChange={setEsSM} />
                  <span className="font-sans font-semibold text-[13px] text-on-surface">
                    {esSM ? 'SÍ' : 'NO'}
                  </span>
                </div>
              </div>

              <div>
                <Label text={`Puntaje Actual (${CURRENT_YEAR})`} />
                <input type="text" readOnly
                  value={`${parseFloat(puntajeActual || '0').toFixed(1)} puntos`}
                  className="w-full px-3 py-2 font-mono text-[13px] text-on-surface border border-outline-variant rounded bg-surface-container-low outline-none cursor-not-allowed"
                />
              </div>

            </div>
          </SectionCard>

          {/* ── 3. Historial de Producción ─────────────────────────────────────── */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded shadow-level-1 mb-[80px]">
            <div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between">
              <div>
                <h2 className="font-heading font-semibold text-[15px] text-on-surface">
                  3. Historial de Producción (Últimos 7 Años)
                </h2>
                <p className="font-sans text-[11px] text-on-surface-variant mt-0.5">
                  Registre o valide los puntajes anuales para mantener el seguimiento de la
                  recategorización y carga no lectiva.
                </p>
              </div>
              <button
                onClick={() => router.push(`/investigadores/${id}/historial`)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded font-sans font-semibold text-[12px] text-white bg-[#001631] hover:bg-[#002b54] transition-colors"
                aria-label="Ver historial completo de proyectos del investigador"
              >
                <HistorialIcon /> Ver Historial de Proyectos
              </button>
            </div>
            <div className="px-6 py-5">
              <div className="flex gap-3 flex-wrap">
                {historial.map((h, idx) => {
                  const isCurrent = h.anio === CURRENT_YEAR;
                  const hasError = histErrors[idx];
                  return (
                    <div key={h.anio} className="flex flex-col items-center gap-1.5">
                      <span className="font-sans font-bold text-[10px] text-on-surface-variant uppercase">
                        {h.anio}
                      </span>
                      <input
                        type="number" min="0" max="100" step="0.1"
                        value={h.puntaje}
                        onChange={(e) => {
                          const next = [...historial];
                          next[idx] = { ...next[idx], puntaje: e.target.value };
                          setHistorial(next);
                          if (histErrors[idx]) {
                            const ne = [...histErrors];
                            ne[idx] = false;
                            setHistErrors(ne);
                          }
                        }}
                        aria-label={`Puntaje ${h.anio}`}
                        aria-invalid={hasError}
                        className={`
                        w-[68px] px-2 py-1.5 text-center font-mono text-[13px] rounded outline-none transition-all
                        focus:ring-2
                        ${isCurrent
                            ? 'border-2 border-[#001631] text-[#001631] font-bold focus:ring-[#a8c8fa]'
                            : hasError
                              ? 'border border-[#dc2626] bg-[#fff5f5] focus:ring-[#fca5a5]'
                              : 'border border-outline-variant focus:ring-[#a8c8fa]'}
                      `}
                      />
                    </div>
                  );
                })}
              </div>
              {histErrors.some(Boolean) && (
                <p className="mt-3 font-sans text-[11px] text-[#dc2626]">
                  Formato de puntaje inválido. Los valores deben ser numéricos entre 0 y 100.
                </p>
              )}
            </div>
          </div>

        </div>

      </div>

      {/* ── Barra fija inferior ──────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-end gap-3 px-6 py-4 bg-white border-t border-outline-variant shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
        <button onClick={() => router.push('/investigadores')}
          className="px-5 py-2 rounded font-sans font-semibold text-[12px] text-on-surface border border-outline-variant hover:bg-surface-container transition-colors uppercase tracking-wide"
          aria-label="Cancelar modificaciones">
          Cancelar Modificaciones
        </button>
        <button onClick={handleGuardar} disabled={isSaving}
          className="flex items-center gap-2 px-6 py-2 rounded font-sans font-semibold text-[12px] text-white bg-[#001631] hover:bg-[#002b54] disabled:opacity-50 transition-colors uppercase tracking-wide"
          aria-label="Guardar perfil del investigador">
          {isSaving ? (
            <>
              <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              Guardando...
            </>
          ) : (
            <><SaveIcon /> Guardar Perfil de Investigador</>
          )}
        </button>
      </div>

      {showSincronizar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog" aria-modal="true" aria-label="Sincronización de Tesis">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setShowSincronizar(false)} aria-hidden="true" />
          <div className="relative w-full max-w-[680px] bg-white rounded-xl shadow-2xl border border-[#e2e8f0] overflow-hidden flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="px-5 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                </svg>
                <h2 className="font-heading font-bold text-[16px] text-on-surface">
                  Sincronización de Tesis desde Cybertesis (UNMSM)
                </h2>
              </div>
              <button onClick={() => setShowSincronizar(false)} className="text-on-surface-variant hover:text-on-surface text-[22px] leading-none font-light" aria-label="Cerrar">×</button>
            </div>
            {/* Buscador */}
            <div className="px-5 py-3 border-b border-[#e2e8f0] bg-slate-50">
              <div className="flex gap-2">
                <input type="text" value={modalSearchTerm}
                  onChange={(e) => setModalSearchTerm(e.target.value)}
                  placeholder="Nombre de autor o asesor..."
                  className="flex-1 px-3 py-2 font-sans text-[13px] text-on-surface border border-outline-variant rounded outline-none focus:ring-2 focus:ring-[#a8c8fa] transition-all bg-white"
                />
                <button
                  onClick={() => buscarTesisExternas()}
                  disabled={loadingTesis}
                  className="px-4 py-2 bg-[#001631] text-white rounded font-sans font-semibold text-[12px] hover:bg-[#002b54] transition-colors"
                >
                  {loadingTesis ? 'Buscando...' : 'Buscar'}
                </button>
              </div>
            </div>
            {/* Contenido / Listado */}
            <div className="overflow-y-auto flex-1 px-5 py-4">
              {loadingTesis && (
                <div className="py-12 text-center font-sans text-[13px] text-on-surface-variant flex flex-col items-center gap-3">
                  <svg className="animate-spin text-[#0284c7]" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  <span>Consultando repositorio de Cybertesis UNMSM...</span>
                </div>
              )}
              {!loadingTesis && tesisExternas.length === 0 && (
                <div className="py-12 text-center font-sans text-[13px] text-on-surface-variant">
                  No se encontraron tesis para &ldquo;{modalSearchTerm}&rdquo;. Intente ajustando el término de búsqueda.
                </div>
              )}
              {!loadingTesis && tesisExternas.length > 0 && (
                <div className="flex flex-col gap-3">
                  {tesisExternas.map((t) => {
                    const isImported = importedUrls.has(t.url_cybertesis);
                    const isImportingThis = importingTesisUrls[t.url_cybertesis] || false;
                    return (
                      <div key={t.url_cybertesis} className="p-3 border border-[#e2e8f0] rounded-lg hover:bg-slate-50 transition-colors flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-sans font-semibold text-[13px] text-on-surface mb-1 line-clamp-2">
                            {t.titulo_tesis}
                          </h3>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 font-sans text-[11px] text-on-surface-variant">
                            <span><span className="font-medium text-slate-700">Autor:</span> {t.autor_estudiante_texto}</span>
                            <span>•</span>
                            <span><span className="font-medium text-slate-700">Asesor:</span> {t.asesor_texto}</span>
                            <span>•</span>
                            <span><span className="font-medium text-slate-700">Año:</span> {t.anio_publicacion}</span>
                            <span>•</span>
                            <span><span className="font-medium text-slate-700">Grado:</span> {t.nivel_grado}</span>
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          {isImported ? (
                            <span className="inline-flex px-2 py-1 rounded bg-green-50 font-sans font-semibold text-[11px] text-green-700 border border-green-200 whitespace-nowrap">
                              ✓ Vinculado
                            </span>
                          ) : (
                            <button
                              onClick={() => handleImportarIndividual(t)}
                              disabled={isImportingThis}
                              className="px-3 py-1.5 bg-[#e67e22] hover:bg-[#d35400] text-white rounded font-sans font-semibold text-[11px] disabled:opacity-50 transition-colors whitespace-nowrap shadow-sm"
                            >
                              {isImportingThis ? 'Importando...' : 'Importar y Vincular'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {/* Footer */}
            <div className="px-5 py-3 border-t border-[#e2e8f0] bg-slate-50 flex justify-end">
              <button
                onClick={() => setShowSincronizar(false)}
                className="px-4 py-2 border border-[#e2e8f0] bg-white hover:bg-slate-50 font-sans text-[13px] text-[#475569] rounded transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

    </MainLayout>
  );
}
