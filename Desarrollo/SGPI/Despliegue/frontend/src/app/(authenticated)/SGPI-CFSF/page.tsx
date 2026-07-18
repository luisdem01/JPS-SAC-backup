'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/SGPI-CFU/components/layout';
import { PageHeader } from '@/SGPI-CFU/components/shared';
import { Button } from '@/SGPI-CFU/components/ui';
import {
  syncService,
  type SyncSourceId,
  type SourceHealth,
  type SourcesHealthData,
} from '@/SGPI-CFU/lib/services/syncService';
import { ApiClientError } from '@/SGPI-CFU/lib/api/client';

// ─── Tipos internos ───────────────────────────────────────────────────────────

type LogLevel = 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR';
interface LogEntry { time: string; level: LogLevel; text: string; }

// Filtros específicos por conector
interface VripFilters {
  enabled: boolean;
  year: string;           // año convocatoria
  program: string;        // '' = todos | 'PCONFIGI' | 'PMULTI' | 'PINTERDIS' | 'PBASICA'
  query: string;          // texto libre extra (opcional)
}
interface CybertesisFilters {
  enabled: boolean;
  yearStart: string;
  yearEnd: string;
  degree: string;         // '' = todos | 'pregrado' | 'maestria' | 'doctorado'
  byDocentes: boolean;    // también buscar por docentes en BD
  maxDocentes: string;    // límite de docentes a consultar
  onlyReconcileLocal: boolean; // solo buscar asesores registrados en BD local
}
interface RenacytFilters {
  enabled: boolean;
  mode: 'update' | 'expanded' | 'both'; // update=solo DNIs en BD, expanded=UNMSM, both=ambos
  maxUpdate: string;   // límite de investigadores existentes a actualizar ('' = todos)
  maxNuevos: string;   // límite de nuevos investigadores a descubrir ('' = sin límite)
}

interface FormState {
  vrip: VripFilters;
  cybertesis: CybertesisFilters;
  renacyt: RenacytFilters;
}

// ─── Estado inicial ───────────────────────────────────────────────────────────

const currentYear = new Date().getFullYear().toString();

const INITIAL: FormState = {
  vrip: {
    enabled: true,
    year: currentYear,
    program: '',
    query: '',
  },
  cybertesis: {
    enabled: true,
    yearStart: (parseInt(currentYear) - 1).toString(),
    yearEnd: currentYear,
    degree: '',
    byDocentes: true,
    maxDocentes: '100',
    onlyReconcileLocal: true,
  },
  renacyt: {
    enabled: true,
    mode: 'both',
    maxUpdate: '',
    maxNuevos: '50',
  },
};

// Intenta cargar el borrador de localStorage
function getSavedForm(): FormState {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('sgpi_sync_draft');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // Fallback a inicial en caso de error
      }
    }
  }
  return INITIAL;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nowTime() {
  return new Date().toLocaleTimeString('es-PE', { hour12: false });
}
function addLog(prev: LogEntry[], level: LogLevel, text: string): LogEntry[] {
  return [...prev.slice(-199), { time: nowTime(), level, text }];
}
function healthToStatus(h?: SourceHealth): 'online' | 'unavailable' | 'loading' {
  if (!h) return 'unavailable';
  return h.status === 'online' ? 'online' : 'unavailable';
}

// ─── Iconos ───────────────────────────────────────────────────────────────────

const IconVrip = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 22V8l9-6 9 6v14"/><path d="M9 22V12h6v10"/>
  </svg>
);
const IconCyb = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
  </svg>
);
const IconRen = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
  </svg>
);
const IconSync = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
  </svg>
);
const IconChevron = ({ open }: { open: boolean }) => (
  <svg className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

// ─── Sub-componente: Toggle del conector ──────────────────────────────────────

const LOG_COLORS: Record<string, string> = {
  INFO:    'text-sky-600',
  SUCCESS: 'text-emerald-600',
  WARN:    'text-amber-600',
  ERROR:   'text-red-600',
};

const STATUS_DOT: Record<string, string> = {
  online:      'bg-emerald-500',
  unavailable: 'bg-amber-500',
  loading:     'bg-slate-400 animate-pulse',
};
const STATUS_TEXT: Record<string, string> = {
  online:      'text-emerald-600',
  unavailable: 'text-amber-600',
  loading:     'text-slate-500',
};
const STATUS_LABEL: Record<string, string> = {
  online:      'Operativo',
  unavailable: 'No disponible',
  loading:     'Verificando…',
};

interface ConnectorCardProps {
  id: SyncSourceId;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  status: 'online' | 'unavailable' | 'loading';
  enabled: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  running: boolean;
}

function ConnectorCard({ id, icon, title, subtitle, status, enabled, onToggle, children, running }: ConnectorCardProps) {
  const [open, setOpen] = useState(true);
  const isDisabled = status === 'unavailable';

  return (
    <div className={`border rounded overflow-hidden shadow-sm transition-all ${
      enabled && !isDisabled ? 'border-[#001631] bg-white' : 'border-[#e2e8f0] bg-[#f8fafc]'
    }`}>
      {/* Cabecera del conector */}
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#e2e8f0]">
        {/* Checkbox de activación */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled && !isDisabled}
            disabled={isDisabled || running}
            onChange={onToggle}
            className="w-4 h-4 accent-[#001631] cursor-pointer disabled:cursor-not-allowed"
          />
        </label>

        <span className={enabled && !isDisabled ? 'text-[#001631]' : 'text-slate-400'}>
          {icon}
        </span>

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={`font-heading font-semibold text-[14px] ${enabled && !isDisabled ? 'text-on-surface' : 'text-slate-400'}`}>
              {title}
            </span>
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold tracking-wide ${STATUS_TEXT[status]}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[status]}`} />
              {STATUS_LABEL[status]}
            </span>
          </div>
          <p className="font-sans text-[11px] text-on-surface-variant mt-0.5">{subtitle}</p>
        </div>

        {/* Colapsar/expandir filtros */}
        {enabled && !isDisabled && (
          <button
            onClick={() => setOpen((p) => !p)}
            className="p-1 rounded hover:bg-slate-100 text-slate-400 transition-colors"
            title={open ? 'Colapsar filtros' : 'Expandir filtros'}
          >
            <IconChevron open={open} />
          </button>
        )}
      </div>

      {/* Filtros del conector */}
      {enabled && !isDisabled && open && (
        <div className="px-5 py-4 space-y-3 bg-white">
          {children}
        </div>
      )}

      {/* Aviso de no disponible */}
      {isDisabled && (
        <div className="px-5 py-3 bg-amber-50 text-[12px] text-amber-700 font-sans">
          ⚠ El conector no está disponible en el servidor. Verifica la instalación.
        </div>
      )}
    </div>
  );
}

// ─── Sub-componentes de formulario ────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block font-sans text-[11px] font-semibold text-on-surface-variant uppercase tracking-wide mb-1">
      {children}
    </label>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      {children}
    </div>
  );
}
const inputCls = "w-full h-8 px-2.5 text-[13px] font-sans bg-white border border-[#d1d5db] rounded focus:outline-none focus:ring-1 focus:ring-[#001631] text-on-surface disabled:bg-slate-50 disabled:text-slate-400";
const selectCls = inputCls + " cursor-pointer";

// ─── Página principal ─────────────────────────────────────────────────────────

export default function SincronizacionDeFuentesPage() {
  const router = useRouter();
  const [form, setForm]           = useState<FormState>(getSavedForm);
  const [healthData, setHealthData] = useState<SourcesHealthData | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [running, setRunning]     = useState(false);
  const [jobId, setJobId]         = useState<string | null>(null);
  const [errorMsg, setErrorMsg]   = useState<string | null>(null);
  const [logs, setLogs]           = useState<LogEntry[]>([
    { time: '--:--:--', level: 'INFO', text: 'Sistema listo. Configure los conectores y sus filtros, luego ejecute la sincronización.' },
  ]);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Auto-guardado en localStorage
  useEffect(() => {
    localStorage.setItem('sgpi_sync_draft', JSON.stringify(form));
  }, [form]);

  // Auto-scroll al final del log (solo del contenedor de la consola)
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTo({
        top: logContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [logs]);

  // ── Polling ───────────────────────────────────────────────────────────────
  const pollJob = useCallback((id: string) => {
    const iv = setInterval(async () => {
      try {
        const st = await syncService.getJobStatus(id);
        
        if (st.progress_logs && st.progress_logs.length > 0) {
          setLogs([
            { time: '--:--:--', level: 'INFO', text: 'Sistema listo. Configure los conectores y sus filtros, luego ejecute la sincronización.' },
            ...st.progress_logs
          ]);
        } else if (st.status === 'running') {
          setLogs((p) => addLog(p, 'INFO', `En proceso… [${st.sources.join(' · ')}]`));
        }

        if (st.status === 'completed') {
          clearInterval(iv);
          setRunning(false);
          if (st.report) {
            sessionStorage.setItem('sgpi_sync_report', JSON.stringify(st.report));
            sessionStorage.setItem('sgpi_sync_job_id', id);
          }
          setLogs((p) => addLog(p, 'SUCCESS', '✓ Sincronización completada. Redirigiendo a resultados…'));
          setTimeout(() => router.push('/sincronizacion/resultados'), 1500);
        }
        if (st.status === 'stopped') {
          clearInterval(iv);
          setRunning(false);
          setLogs((p) => addLog(p, 'WARN', 'Sincronización detenida por el usuario.'));
        }
        if (st.status === 'failed') {
          clearInterval(iv);
          setRunning(false);
          setErrorMsg(st.error ?? 'El proceso falló en el servidor.');
        }
      } catch {
        setLogs((p) => addLog(p, 'WARN', 'Error temporal consultando estado — reintentando…'));
      }
    }, 2000);
  }, [router]);

  // Carga inicial de salud y chequeo de job activo
  useEffect(() => {
    let cancelled = false;
    
    // Verificar salud de conectores
    syncService.getSourcesHealth()
      .then((d) => { if (!cancelled) setHealthData(d); })
      .catch(() => {
        if (!cancelled)
          setLogs((p) => addLog(p, 'WARN', 'No se pudo verificar el estado de los conectores en el servidor.'));
      })
      .finally(() => { if (!cancelled) setHealthLoading(false); });

    // Verificar si hay una sincronización activa
    syncService.getActiveJob()
      .then((res) => {
        if (cancelled) return;
        if (res) {
          const activeJob = res;
          setJobId(activeJob.job_id);
          setRunning(true);
          
          // Restaurar estado del formulario para que sea persistente en la interfaz
          setForm((prev) => {
             const vripEnabled = activeJob.sources.includes('VRIP');
             const cybEnabled = activeJob.sources.includes('CYBERTESIS');
             const renEnabled = activeJob.sources.includes('RENACYT');
             const f = activeJob.filters || {};
             
             return {
               vrip: {
                 enabled: vripEnabled,
                 year: f.vrip_year?.toString() || prev.vrip.year,
                 program: f.vrip_program || '',
                 query: f.vrip_query || '',
               },
               cybertesis: {
                 enabled: cybEnabled,
                 yearStart: f.year_start?.toString() || '',
                 yearEnd: f.year_end?.toString() || '',
                 degree: f.degree || '',
                 byDocentes: f.by_docentes ?? true,
                 maxDocentes: f.max_docentes_cybertesis?.toString() || '100',
                 onlyReconcileLocal: f.only_reconcile_local ?? true,
               },
               renacyt: {
                 enabled: renEnabled,
                 mode: (f.renacyt_mode as 'update'|'expanded'|'both') || (f.expanded_search ? 'expanded' : 'update'),
                 maxUpdate: f.renacyt_max_update?.toString() || '',
                 maxNuevos: f.renacyt_max_new?.toString() || '',
               }
             };
          });

          if (activeJob.progress_logs && activeJob.progress_logs.length > 0) {
            setLogs([
              { time: '--:--:--', level: 'INFO', text: 'Sistema listo. Configure los conectores y sus filtros, luego ejecute la sincronización.' },
              ...activeJob.progress_logs
            ]);
          }
          setLogs((p) => addLog(p, 'INFO', `Sincronización activa detectada en el servidor [${activeJob.job_id.slice(0, 8)}…]. Monitoreando...`));
          pollJob(activeJob.job_id);
        }
      })
      .catch((e) => {
        console.error('Error al consultar job activo:', e);
      });

    return () => { cancelled = true; };
  }, [pollJob]);

  // ── Lanzar sincronización ─────────────────────────────────────────────────
  const handleRun = async () => {
    setErrorMsg(null);

    const sources: SyncSourceId[] = [];
    if (form.vrip.enabled) sources.push('VRIP');
    if (form.cybertesis.enabled) sources.push('CYBERTESIS');
    if (form.renacyt.enabled) sources.push('RENACYT');

    if (sources.length === 0) {
      setErrorMsg('Selecciona al menos un conector para sincronizar.');
      return;
    }

    setRunning(true);
    setLogs((p) => addLog(p, 'INFO', `Lanzando sincronización: [${sources.join(', ')}]`));

    // Construir filtros según configuración del formulario
    const filters: Record<string, unknown> = {
      expanded_search: form.renacyt.mode !== 'update',
    };

    if (form.vrip.enabled) {
      filters.vrip_year    = form.vrip.year ? parseInt(form.vrip.year) : undefined;
      filters.vrip_program = form.vrip.program || undefined;
      filters.vrip_query   = form.vrip.query.trim() || undefined;
    }
    if (form.cybertesis.enabled) {
      filters.year_start              = form.cybertesis.yearStart ? parseInt(form.cybertesis.yearStart) : undefined;
      filters.year_end                = form.cybertesis.yearEnd   ? parseInt(form.cybertesis.yearEnd)   : undefined;
      filters.degree                  = form.cybertesis.degree    || undefined;
      filters.by_docentes             = form.cybertesis.byDocentes;
      filters.max_docentes_cybertesis = form.cybertesis.maxDocentes ? parseInt(form.cybertesis.maxDocentes) : undefined;
      filters.only_reconcile_local    = form.cybertesis.onlyReconcileLocal;
    }
    if (form.renacyt.enabled) {
      filters.renacyt_mode = form.renacyt.mode;
      if (form.renacyt.maxUpdate.trim()) {
        filters.renacyt_max_update = parseInt(form.renacyt.maxUpdate);
      }
      if (form.renacyt.maxNuevos.trim()) {
        filters.renacyt_max_new = parseInt(form.renacyt.maxNuevos);
      }
    }

    try {
      const res = await syncService.run({ sources, filters });
      setJobId(res.job_id);
      setLogs((p) => addLog(p, 'INFO', `Job iniciado [${res.job_id.slice(0, 8)}…]. Monitoreando cada 5s…`));
      pollJob(res.job_id);
    } catch (e) {
      setRunning(false);
      const msg = e instanceof ApiClientError ? e.message : 'No se pudo conectar al servidor.';
      setErrorMsg(msg);
      setLogs((p) => addLog(p, 'ERROR', `Error al lanzar: ${msg}`));
    }
  };

  // ── Detener sincronización ────────────────────────────────────────────────
  const handleStop = async () => {
    if (!jobId) return;
    try {
      setLogs((p) => addLog(p, 'INFO', 'Solicitando detención de la sincronización...'));
      const res = await syncService.stopJob(jobId);
      if (res.success) {
        setLogs((p) => addLog(p, 'SUCCESS', 'Detención solicitada con éxito. Esperando respuesta...'));
      } else {
        setLogs((p) => addLog(p, 'WARN', `Mensaje del servidor: ${res.message}`));
      }
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : 'No se pudo conectar al servidor.';
      setLogs((p) => addLog(p, 'ERROR', `Error al detener: ${msg}`));
    }
  };

  // ── Helpers de estado ─────────────────────────────────────────────────────
  const vripStatus  = healthLoading ? 'loading' : healthToStatus(healthData?.VRIP as SourceHealth | undefined);
  const cybStatus   = healthLoading ? 'loading' : healthToStatus(healthData?.CYBERTESIS as SourceHealth | undefined);
  const renStatus   = healthLoading ? 'loading' : healthToStatus(healthData?.RENACYT as SourceHealth | undefined);

  const activeCount = [form.vrip.enabled, form.cybertesis.enabled, form.renacyt.enabled].filter(Boolean).length;

  // ── Actualizadores de form ────────────────────────────────────────────────
  const setVrip      = (upd: Partial<VripFilters>)      => setForm((f) => ({ ...f, vrip:      { ...f.vrip,      ...upd } }));
  const setCybertesis= (upd: Partial<CybertesisFilters>) => setForm((f) => ({ ...f, cybertesis:{ ...f.cybertesis,...upd } }));
  const setRenacyt   = (upd: Partial<RenacytFilters>)   => setForm((f) => ({ ...f, renacyt:   { ...f.renacyt,   ...upd } }));

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <MainLayout title="Sistema de Gestión de Proyectos de Investigación" subtitle="">
      <PageHeader
        title="Sincronización Global de Fuentes Externas"
        description="Seleccione los conectores a ejecutar y configure sus parámetros específicos. Solo se procesarán los datos que coincidan con los filtros."
        noBorder
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="lg"
              onClick={() => router.push('/sincronizacion/cuarentena')}
            >
              Revisar Cuarentena
            </Button>
            {running && (
              <Button
                variant="danger"
                size="lg"
                onClick={handleStop}
              >
                Detener Sincronización
              </Button>
            )}
            <Button
              variant="primary"
              size="lg"
              iconLeft={<IconSync />}
              loading={running}
              disabled={running || activeCount === 0}
              onClick={handleRun}
            >
              {running ? 'Sincronizando…' : `Sincronizar${activeCount > 0 ? ` (${activeCount})` : ''}`}
            </Button>
          </div>
        }
      />

      {/* ── Error global ────────────────────────────────────────────────── */}
      {errorMsg && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 font-sans">
          <span className="font-semibold">Error: </span>{errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Columna izquierda: conectores ───────────────────────────── */}
        <div className="space-y-4">

          {/* ── VRIP ──────────────────────────────────────────────────── */}
          <ConnectorCard
            id="VRIP" icon={<IconVrip />}
            title="VRIP — Vicerrectorado de Investigación"
            subtitle="Convocatorias activas y proyectos financiados · WordPress REST API + scraping"
            status={vripStatus}
            enabled={form.vrip.enabled}
            onToggle={() => setVrip({ enabled: !form.vrip.enabled })}
            running={running}
          >
            <div className="grid grid-cols-2 gap-3">
              <Field label="Año de convocatoria">
                <select
                  className={selectCls}
                  value={form.vrip.year}
                  onChange={(e) => setVrip({ year: e.target.value })}
                  disabled={running}
                >
                  {Array.from({ length: 6 }, (_, i) => (parseInt(currentYear) - i).toString()).map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </Field>

              <Field label="Programa de investigación">
                <select
                  className={selectCls}
                  value={form.vrip.program}
                  onChange={(e) => setVrip({ program: e.target.value })}
                  disabled={running}
                >
                  <option value="">Todos los programas</option>
                  <option value="PCONFIGI">PCONFIGI — Proyectos de grupos</option>
                  <option value="PMULTI">PMULTI — Multidisciplinarios</option>
                  <option value="PINTERDIS">PINTERDIS — Interdisciplinarios</option>
                  <option value="PBASICA">PBASICA — Investigación básica</option>
                  <option value="PFIS">PFIS — Proyectos individuales FIS</option>
                  <option value="resolucion">Resoluciones Rectorales</option>
                </select>
              </Field>
            </div>

            <Field label="Búsqueda adicional (texto libre, opcional)">
              <input
                type="text"
                className={inputCls}
                placeholder="Ej: nanotecnología, sistemas embebidos…"
                value={form.vrip.query}
                onChange={(e) => setVrip({ query: e.target.value })}
                disabled={running}
              />
            </Field>

            <p className="text-[11px] text-on-surface-variant font-sans bg-slate-50 rounded px-2.5 py-2">
              <strong>Extrae:</strong> convocatorias vigentes, proyectos aprobados con código, presupuesto y resolución rectoral.
            </p>
          </ConnectorCard>

          {/* ── Cybertesis ────────────────────────────────────────────── */}
          <ConnectorCard
            id="CYBERTESIS" icon={<IconCyb />}
            title="Cybertesis — Repositorio Institucional"
            subtitle="Tesis con metadatos Dublin Core · DSpace 7 REST API"
            status={cybStatus}
            enabled={form.cybertesis.enabled}
            onToggle={() => setCybertesis({ enabled: !form.cybertesis.enabled })}
            running={running}
          >
            <div className="grid grid-cols-2 gap-3">
              <Field label="Año desde">
                <select
                  className={selectCls}
                  value={form.cybertesis.yearStart}
                  onChange={(e) => setCybertesis({ yearStart: e.target.value })}
                  disabled={running}
                >
                  <option value="">Sin límite</option>
                  {Array.from({ length: 10 }, (_, i) => (parseInt(currentYear) - i).toString()).map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </Field>

              <Field label="Año hasta">
                <select
                  className={selectCls}
                  value={form.cybertesis.yearEnd}
                  onChange={(e) => setCybertesis({ yearEnd: e.target.value })}
                  disabled={running}
                >
                  <option value="">Sin límite</option>
                  {Array.from({ length: 10 }, (_, i) => (parseInt(currentYear) - i).toString()).map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Nivel académico de la tesis">
              <select
                className={selectCls}
                value={form.cybertesis.degree}
                onChange={(e) => setCybertesis({ degree: e.target.value })}
                disabled={running}
              >
                <option value="">Todos los niveles</option>
                <option value="pregrado">Pregrado / Licenciatura / Título</option>
                <option value="maestria">Maestría</option>
                <option value="doctorado">Doctorado</option>
              </select>
            </Field>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 accent-[#001631] cursor-pointer"
                checked={form.cybertesis.byDocentes}
                onChange={(e) => setCybertesis({ byDocentes: e.target.checked })}
                disabled={running}
              />
              <span className="font-sans text-[12px] text-on-surface">
                Buscar también por docentes registrados en la BD
              </span>
            </label>

            {form.cybertesis.byDocentes && (
              <Field label="Límite de docentes a consultar">
                <input
                  type="number"
                  min="1"
                  max="1000"
                  className={inputCls}
                  value={form.cybertesis.maxDocentes}
                  onChange={(e) => setCybertesis({ maxDocentes: e.target.value })}
                  disabled={running}
                />
              </Field>
            )}

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 accent-[#001631] cursor-pointer"
                checked={form.cybertesis.onlyReconcileLocal}
                onChange={(e) => setCybertesis({ onlyReconcileLocal: e.target.checked })}
                disabled={running}
              />
              <span className="font-sans text-[12px] text-emerald-700 font-semibold">
                Sincronización estricta (reconciliar solo docentes locales de la BD)
              </span>
            </label>

            <p className="text-[11px] text-on-surface-variant font-sans bg-slate-50 rounded px-2.5 py-2">
              <strong>Extrae:</strong> tesis de FISI-UNMSM con título, autores, asesores, URL, grado y año. Permite vincular asesorías con investigadores.
            </p>
          </ConnectorCard>

          {/* ── RENACYT ───────────────────────────────────────────────── */}
          <ConnectorCard
            id="RENACYT" icon={<IconRen />}
            title="RENACYT — CONCYTEC"
            subtitle="Investigadores calificados · API REST de CONCYTEC / CTI Vitae"
            status={renStatus}
            enabled={form.renacyt.enabled}
            onToggle={() => setRenacyt({ enabled: !form.renacyt.enabled })}
            running={running}
          >
            <Field label="Modo de búsqueda">
              <div className="space-y-2 mt-1">
                {[
                  {
                    value: 'update',
                    label: 'Solo actualizar registros existentes',
                    desc: 'Consulta en RENACYT solo los DNIs de investigadores ya registrados en la BD. Más rápido.',
                  },
                  {
                    value: 'expanded',
                    label: 'Búsqueda expandida en UNMSM-FISI',
                    desc: 'Busca todos los investigadores de la UNMSM y filtra por FISI. Puede descubrir nuevos.',
                  },
                  {
                    value: 'both',
                    label: 'Ambos (recomendado)',
                    desc: 'Actualiza los existentes y luego realiza la búsqueda expandida.',
                  },
                ].map((opt) => (
                  <label key={opt.value} className={`flex items-start gap-2.5 p-2.5 rounded border cursor-pointer transition-colors ${
                    form.renacyt.mode === opt.value
                      ? 'border-[#001631] bg-slate-50'
                      : 'border-[#e2e8f0] bg-white hover:bg-slate-50'
                  } ${running ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <input
                      type="radio"
                      name="renacyt-mode"
                      value={opt.value}
                      checked={form.renacyt.mode === opt.value as RenacytFilters['mode']}
                      onChange={() => setRenacyt({ mode: opt.value as RenacytFilters['mode'] })}
                      disabled={running}
                      className="mt-0.5 accent-[#001631]"
                    />
                    <div>
                      <p className="font-sans text-[12px] font-semibold text-on-surface">{opt.label}</p>
                      <p className="font-sans text-[11px] text-on-surface-variant mt-0.5">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </Field>

            <p className="text-[11px] text-on-surface-variant font-sans bg-slate-50 rounded px-2.5 py-2">
              <strong>Extrae:</strong> nivel RENACYT (I–VII), código CTI Vitae, ORCID, grado académico e institución principal. Sin filtro de año (registro activo por reglamento).
            </p>

            {/* Límites de cantidad */}
            <div className="grid grid-cols-2 gap-3 border-t border-[#f1f5f9] pt-3 mt-1">
              {(form.renacyt.mode === 'update' || form.renacyt.mode === 'both') && (
                <Field label="Máx. existentes a actualizar">
                  <input
                    type="number"
                    min="1"
                    max="500"
                    className={inputCls}
                    placeholder="Todos (sin límite)"
                    value={form.renacyt.maxUpdate}
                    onChange={(e) => setRenacyt({ maxUpdate: e.target.value })}
                    disabled={running}
                  />
                  <p className="text-[10px] text-slate-400 mt-1 font-sans">~1s por investigador</p>
                </Field>
              )}
              {(form.renacyt.mode === 'expanded' || form.renacyt.mode === 'both') && (
                <Field label="Máx. nuevos a descubrir">
                  <input
                    type="number"
                    min="1"
                    max="5000"
                    className={inputCls}
                    placeholder="Sin límite"
                    value={form.renacyt.maxNuevos}
                    onChange={(e) => setRenacyt({ maxNuevos: e.target.value })}
                    disabled={running}
                  />
                  <p className="text-[10px] text-slate-400 mt-1 font-sans">50 = ~1 pág. RENACYT</p>
                </Field>
              )}
            </div>
          </ConnectorCard>
        </div>

        {/* ── Columna derecha: consola ─────────────────────────────────── */}
        <div className="flex flex-col gap-4">

          {/* Resumen de configuración */}
          <div className="bg-white border border-[#e2e8f0] rounded shadow-sm p-4">
            <p className="font-sans text-[11px] font-bold tracking-[0.08em] uppercase text-on-surface-variant mb-3">
              Resumen de extracción
            </p>
            <div className="space-y-2">
              {[
                {
                  label: 'VRIP',
                  active: form.vrip.enabled && vripStatus === 'online',
                  detail: form.vrip.enabled
                    ? `Año ${form.vrip.year}${form.vrip.program ? ` · ${form.vrip.program}` : ' · todos los programas'}${form.vrip.query ? ` · "${form.vrip.query}"` : ''}`
                    : 'Desactivado',
                },
                {
                  label: 'Cybertesis',
                  active: form.cybertesis.enabled && cybStatus === 'online',
                  detail: form.cybertesis.enabled
                    ? `${form.cybertesis.yearStart || '∞'}–${form.cybertesis.yearEnd || '∞'} · ${form.cybertesis.degree || 'todos los niveles'}${form.cybertesis.byDocentes ? ' · +docentes' : ''}`
                    : 'Desactivado',
                },
                {
                  label: 'RENACYT',
                  active: form.renacyt.enabled && renStatus === 'online',
                  detail: form.renacyt.enabled
                    ? { update: 'Solo actualizar existentes', expanded: 'Búsqueda expandida FISI', both: 'Actualizar + búsqueda expandida' }[form.renacyt.mode]
                    : 'Desactivado',
                },
              ].map((row) => (
                <div key={row.label} className="flex items-start gap-2.5">
                  <span className={`w-1.5 h-1.5 mt-1.5 rounded-full flex-shrink-0 ${row.active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  <div>
                    <span className="font-sans text-[12px] font-semibold text-on-surface">{row.label}</span>
                    <span className="font-sans text-[12px] text-on-surface-variant ml-2">{row.detail}</span>
                  </div>
                </div>
              ))}
            </div>

            {jobId && (
              <p className="mt-3 pt-3 border-t border-[#f1f5f9] font-mono text-[10px] text-slate-400">
                Job activo: {jobId}
              </p>
            )}
          </div>

          {/* Consola de log */}
          <div className="rounded border border-[#e2e8f0] bg-white overflow-hidden shadow-sm flex-1">
            <div className="bg-slate-100/70 border-b border-[#e2e8f0] px-4 py-2.5 flex items-center justify-between">
              <span className="font-sans text-[11px] font-bold tracking-[0.08em] uppercase text-slate-500">
                Consola de Sistema
              </span>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400 opacity-80" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 opacity-80" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 opacity-80" />
              </div>
            </div>
            <div
              ref={logContainerRef}
              className="bg-slate-50 px-4 py-3.5 font-mono text-[11.5px] leading-6 min-h-[280px] max-h-[480px] overflow-y-auto"
            >
              {logs.map((log, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-slate-400 shrink-0">[{log.time}]</span>
                  <span className={`shrink-0 font-bold w-[54px] ${LOG_COLORS[log.level]}`}>[{log.level}]</span>
                  <span className={i === logs.length - 1 && log.level === 'SUCCESS' ? 'text-emerald-600 font-semibold' : 'text-slate-700'}>
                    {log.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
