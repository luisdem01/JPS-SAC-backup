'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/SGPI-CFU/components/layout';
import { PageHeader } from '@/SGPI-CFU/components/shared';
import { Button } from '@/SGPI-CFU/components/ui';
import { ExportFlow } from '@/SGPI-CFU/components/SGPI-CFE/export/ExportFlow';
import type { SyncSourceReport } from '@/SGPI-CFU/lib/services/syncService';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type EstadoAccion = 'Resuelto' | 'Cuarentena' | 'Error' | 'Sin datos';

interface AccionResumen {
  fuente: string;
  procesados: number;
  resueltos: number;
  cuarentena: number;
  errores: number;
  estado: EstadoAccion;
}

interface LogEntry {
  level: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  time: string;
  text: string;
}

interface RegistroReconciliado {
  fuente: string;
  tipo: string;
  id: string;
  titulo: string;
  estado: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildLogs(report: Record<string, SyncSourceReport>): LogEntry[] {
  const time = new Date().toLocaleTimeString('es-PE', { hour12: false });
  const entries: LogEntry[] = [
    { level: 'INFO', time, text: 'Sincronización completada. Generando resumen de resultados…' },
  ];

  for (const [src, rep] of Object.entries(report)) {
    if (rep.error) {
      entries.push({ level: 'ERROR', time, text: `${src}: ${rep.error}` });
      continue;
    }
    if (rep.procesados === 0) {
      entries.push({ level: 'INFO', time, text: `${src}: Ningún registro procesado.` });
      continue;
    }
    if (rep.resueltos > 0) {
      entries.push({
        level: 'SUCCESS',
        time,
        text: `${src}: ${rep.resueltos} registros reconciliados correctamente.`,
      });
    }
    if (rep.cuarentena > 0) {
      entries.push({
        level: 'WARNING',
        time,
        text: `${src}: ${rep.cuarentena} registros enviados a cuarentena (requieren revisión manual).`,
      });
    }
    if (rep.errores > 0) {
      entries.push({
        level: 'ERROR',
        time,
        text: `${src}: ${rep.errores} errores durante el procesamiento.`,
      });
    }
    if (rep.convocatorias_extraidas !== undefined) {
      entries.push({
        level: 'INFO',
        time,
        text: `VRIP: ${rep.convocatorias_extraidas} convocatorias extraídas del portal.`,
      });
    }
  }

  entries.push({ level: 'SUCCESS', time, text: 'Sincronización Global Completada.' });
  return entries;
}

function buildAcciones(report: Record<string, SyncSourceReport>): AccionResumen[] {
  return Object.entries(report).map(([src, rep]) => {
    let estado: EstadoAccion = 'Sin datos';
    if (rep.error) estado = 'Error';
    else if (rep.cuarentena > 0 && rep.resueltos === 0) estado = 'Cuarentena';
    else if (rep.resueltos > 0) estado = 'Resuelto';
    else if (rep.errores > 0) estado = 'Error';

    return {
      fuente: src,
      procesados: rep.procesados,
      resueltos: rep.resueltos,
      cuarentena: rep.cuarentena,
      errores: rep.errores,
      estado,
    };
  });
}

// ─── Datos de fallback (cuando no hay reporte en sesión) ─────────────────────

const FALLBACK_LOGS: LogEntry[] = [
  { level: 'INFO',    time: '--:--:--', text: 'No se encontró un reporte de sincronización activo.' },
  { level: 'INFO',    time: '--:--:--', text: 'Inicie una sincronización desde el Panel de Control.' },
];

const FALLBACK_ACCIONES: AccionResumen[] = [];

// ─── Estilos ──────────────────────────────────────────────────────────────────

const LOG_STYLE: Record<string, { label: string; color: string }> = {
  INFO:    { label: 'INFO',    color: 'text-sky-400'     },
  SUCCESS: { label: 'SUCCESS', color: 'text-emerald-400' },
  WARNING: { label: 'WARNING', color: 'text-amber-400'   },
  ERROR:   { label: 'ERROR',   color: 'text-red-400'     },
};

const ESTADO_BADGE: Record<EstadoAccion, { bg: string; dot: string; text: string }> = {
  'Resuelto':  { bg: 'bg-emerald-50', dot: 'bg-emerald-500', text: 'text-emerald-700' },
  'Cuarentena':{ bg: 'bg-amber-50',   dot: 'bg-amber-500',   text: 'text-amber-700'   },
  'Error':     { bg: 'bg-red-50',     dot: 'bg-red-500',     text: 'text-red-700'     },
  'Sin datos': { bg: 'bg-slate-50',   dot: 'bg-slate-400',   text: 'text-slate-600'   },
};

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function EstadoAccionBadge({ estado }: { estado: EstadoAccion }) {
  const s = ESTADO_BADGE[estado];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {estado}
    </span>
  );
}

const DownloadIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

const TerminalDots = () => (
  <div className="flex items-center gap-1.5">
    <span className="w-3 h-3 rounded-full bg-red-500 opacity-80" />
    <span className="w-3 h-3 rounded-full bg-amber-500 opacity-80" />
    <span className="w-3 h-3 rounded-full bg-emerald-500 opacity-80" />
  </div>
);

// ─── Página ───────────────────────────────────────────────────────────────────

export default function ResultadosSincronizacionPage() {
  const router = useRouter();
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [syncLogs, setSyncLogs]     = useState<LogEntry[]>(FALLBACK_LOGS);
  const [acciones, setAcciones]     = useState<AccionResumen[]>(FALLBACK_ACCIONES);
  const [jobId, setJobId]           = useState<string | null>(null);
  const [totalResueltos, setTotalResueltos] = useState(0);
  const [totalCuarentena, setTotalCuarentena] = useState(0);
  const [registros, setRegistros]   = useState<RegistroReconciliado[]>([]);

  useEffect(() => {
    // Leer el reporte guardado por la Pantalla 1 tras completar el job
    const raw = sessionStorage.getItem('sgpi_sync_report');
    const id  = sessionStorage.getItem('sgpi_sync_job_id');

    if (raw) {
      try {
        const report: Record<string, SyncSourceReport> = JSON.parse(raw);
        setSyncLogs(buildLogs(report));
        setAcciones(buildAcciones(report));
        if (id) setJobId(id);

        const totRes = Object.values(report).reduce((s, r) => s + (r.resueltos ?? 0), 0);
        const totCua = Object.values(report).reduce((s, r) => s + (r.cuarentena ?? 0), 0);
        setTotalResueltos(totRes);
        setTotalCuarentena(totCua);

        const allRegistros: RegistroReconciliado[] = [];
        for (const [src, rep] of Object.entries(report)) {
          if (rep.registros && Array.isArray(rep.registros)) {
            for (const reg of rep.registros) {
              allRegistros.push({
                fuente: src,
                tipo: reg.tipo,
                id: reg.id,
                titulo: reg.titulo,
                estado: reg.estado,
              });
            }
          }
        }
        setRegistros(allRegistros);
      } catch {
        // JSON inválido — usar fallback
      }
    }
  }, []);

  const totalProcesados = acciones.reduce((s, a) => s + a.procesados, 0);

  return (
    <MainLayout
      title="Sistema de Gestión de Proyectos de Investigación"
      subtitle=""
    >
      {/* ── Encabezado ───────────────────────────────────────────────────── */}
      <PageHeader
        title="Resultados de Sincronización"
        description={
          totalProcesados > 0
            ? `Se procesaron ${totalProcesados} registros: ${totalResueltos} reconciliados, ${totalCuarentena} en cuarentena.`
            : 'Se ha actualizado el ciclo de vida y la vinculación de proyectos.'
        }
        noBorder
      />

      {/* Job ID badge */}
      {jobId && (
        <div className="mb-4 flex items-center gap-2">
          <span className="font-mono text-[11px] text-slate-400 bg-slate-100 rounded px-2 py-1">
            Job ID: {jobId}
          </span>
        </div>
      )}

      {/* ── Terminal de log ──────────────────────────────────────────────── */}
      <div className="rounded border border-[#334155] overflow-hidden shadow-md mb-6">
        <div className="bg-[#1e293b] px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            <span className="font-mono text-[11px] font-bold tracking-widest uppercase text-slate-400">
              System Sync Log
            </span>
          </div>
          <TerminalDots />
        </div>

        <div className="bg-[#0f172a] px-5 py-5 font-mono text-[12.5px] leading-7 space-y-0.5 min-h-[200px] max-h-[320px] overflow-y-auto">
          {syncLogs.map((log, i) => {
            const s = LOG_STYLE[log.level] ?? { label: log.level, color: 'text-slate-400' };
            const isLast = i === syncLogs.length - 1;
            return (
              <div key={i} className="flex gap-0">
                <span className={`shrink-0 font-bold ${s.color}`}>[{s.label}]</span>
                <span className="text-slate-500 shrink-0 mx-2">{log.time}</span>
                <span className={isLast ? 'text-emerald-400 font-semibold' : 'text-slate-300'}>
                  {log.text}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Resumen de Acciones ──────────────────────────────────────────── */}
      <div className="bg-white border border-[#e2e8f0] rounded shadow-sm mb-6 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#e2e8f0]">
          <span className="font-heading font-semibold text-[15px] text-on-surface">
            Resumen por Fuente
          </span>
        </div>

        {acciones.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-on-surface-variant font-sans">
            No hay datos de sincronización disponibles.
            <br />
            <button
              className="mt-2 text-[#001631] underline text-sm"
              onClick={() => router.push('/SGPI-CFSF')}
            >
              Ir al Panel de Sincronización
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
                  {['Fuente', 'Procesados', 'Reconciliados', 'Cuarentena', 'Errores', 'Estado'].map((col) => (
                    <th
                      key={col}
                      className="px-5 py-3 text-left font-sans text-[11px] font-bold tracking-[0.06em] uppercase text-on-surface-variant"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {acciones.map((accion, i) => (
                  <tr key={i} className="hover:bg-[#f8fafc] transition-colors">
                    <td className="px-5 py-3.5 font-sans text-body-sm text-on-surface font-medium">
                      {accion.fuente}
                    </td>
                    <td className="px-5 py-3.5 font-sans text-body-sm text-on-surface-variant">
                      {accion.procesados}
                    </td>
                    <td className="px-5 py-3.5 font-sans text-body-sm text-emerald-700 font-medium">
                      {accion.resueltos}
                    </td>
                    <td className="px-5 py-3.5 font-sans text-body-sm text-amber-700 font-medium">
                      {accion.cuarentena}
                    </td>
                    <td className="px-5 py-3.5 font-sans text-body-sm text-red-700 font-medium">
                      {accion.errores}
                    </td>
                    <td className="px-5 py-3.5">
                      <EstadoAccionBadge estado={accion.estado} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Registros Reconciliados ──────────────────────────────────────────── */}
      {registros.length > 0 && (
        <div className="bg-white border border-[#e2e8f0] rounded shadow-sm mb-6 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#e2e8f0]">
            <span className="font-heading font-semibold text-[15px] text-on-surface">
              Detalle de Registros Reconciliados
            </span>
          </div>
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-[#f8fafc] z-10 shadow-[0_1px_0_0_#e2e8f0]">
                <tr>
                  {['Fuente', 'Tipo', 'Identificador', 'Título / Nombre', 'Estado'].map((col) => (
                    <th
                      key={col}
                      className="px-5 py-3 text-left font-sans text-[11px] font-bold tracking-[0.06em] uppercase text-on-surface-variant bg-[#f8fafc]"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {registros.map((reg, i) => (
                  <tr key={i} className="hover:bg-[#f8fafc] transition-colors">
                    <td className="px-5 py-3.5 font-sans text-body-sm text-on-surface font-medium whitespace-nowrap">
                      {reg.fuente}
                    </td>
                    <td className="px-5 py-3.5 font-sans text-body-sm text-on-surface-variant whitespace-nowrap">
                      {reg.tipo}
                    </td>
                    <td className="px-5 py-3.5 font-sans text-[11px] text-slate-500 font-mono">
                      {reg.id}
                    </td>
                    <td className="px-5 py-3.5 font-sans text-body-sm text-on-surface">
                      <div className="line-clamp-2 max-w-[400px]" title={reg.titulo}>
                        {reg.titulo}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                        reg.estado === 'En Cuarentena' ? 'bg-amber-50 text-amber-700' :
                        reg.estado === 'Error' ? 'bg-red-50 text-red-700' :
                        'bg-emerald-50 text-emerald-700'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          reg.estado === 'En Cuarentena' ? 'bg-amber-500' :
                          reg.estado === 'Error' ? 'bg-red-500' :
                          'bg-emerald-500'
                        }`} />
                        {reg.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Acciones ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-3">
        {totalCuarentena > 0 && (
          <Button
            variant="primary"
            size="md"
            onClick={() => router.push('/SGPI-CFSF/cuarentena')}
          >
            Revisar Cuarentena →
          </Button>
        )}
        <Button
          variant="secondary"
          size="md"
          iconLeft={<DownloadIcon />}
          onClick={() => setIsExportOpen(true)}
        >
          Descargar Reporte PDF
        </Button>
        <Button
          variant={totalCuarentena > 0 ? "secondary" : "primary"}
          size="md"
          iconRight={<ArrowRightIcon />}
          onClick={() => router.push('/SGPI-CFSF')}
        >
          Volver al Panel
        </Button>
      </div>

      {/* Modal de exportación */}
      {isExportOpen && (
        <ExportFlow
          context="reporte_sincronizacion"
          onClose={() => setIsExportOpen(false)}
        />
      )}
    </MainLayout>
  );
}
