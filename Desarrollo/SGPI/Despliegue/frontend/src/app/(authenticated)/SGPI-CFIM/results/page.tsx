'use client';

/**
 * @file SGPI-CFIM/results/page.tsx
 * @route /importacion/results
 * @description Pantalla de resumen de importación completada.
 *
 * Lee {entity, fileName, nuevos, actualizados, errores, detalleExtraccion}
 * del sessionStorage (escrito por preview/page.tsx al detectar isSuccess).
 * Muestra tablas colapsables de registros guardados por entidad y permite
 * descargar un log .txt con el detalle completo.
 */

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/SGPI-CFU/components/layout';
import { Button } from '@/SGPI-CFU/components/ui';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

interface SinDniItem {
  nombre:   string;
  contexto: string;
}

interface ImportResults {
  entity:              string;
  fileName:            string;
  nuevos:              number;
  actualizados:        number;
  errores:             number;
  apiRenacytOffline?:  boolean;
  enCuarentena?:       number;
  detalleSinDni?:      SinDniItem[];
  detalleExtraccion?:  Record<string, Record<string, unknown>[]>;
  resultadosDbDetalle?: Record<string, { insertados: number; actualizados: number; fallidos: number }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuración de tablas por entidad
// ─────────────────────────────────────────────────────────────────────────────

interface ColDef {
  key:   string;
  label: string;
  /** Ancho mínimo en px */
  minW?: number;
}

interface TableConfig {
  title:   string;
  singlar: string;
  cols:    ColDef[];
}

const TABLE_CONFIG: Record<string, TableConfig> = {
  investigadores: {
    title:   'Investigadores',
    singlar: 'investigador',
    cols: [
      { key: 'dni',                  label: 'DNI',         minW: 90 },
      { key: 'nombres',              label: 'Nombres',     minW: 140 },
      { key: 'apellidos',            label: 'Apellidos',   minW: 160 },
      { key: 'codigo_renacyt',       label: 'RENACYT',     minW: 100 },
      { key: 'categoria_renacyt',    label: 'Categoría',   minW: 110 },
      { key: 'institucion_principal',label: 'Institución', minW: 200 },
    ],
  },
  proyectos: {
    title:   'Proyectos de Investigación',
    singlar: 'proyecto',
    cols: [
      { key: 'codigo_proyecto',      label: 'Código',      minW: 120 },
      { key: 'titulo_proyecto',      label: 'Título',      minW: 280 },
      { key: 'tipo_programa',        label: 'Tipo',        minW: 110 },
      { key: 'anio_convocatoria',    label: 'Año',         minW: 60 },
      { key: 'resolucion_aprobacion',label: 'Resolución',  minW: 130 },
    ],
  },
  publicaciones: {
    title:   'Publicaciones Científicas',
    singlar: 'publicación',
    cols: [
      { key: 'titulo_articulo',  label: 'Título del Artículo', minW: 280 },
      { key: 'nombre_revista',   label: 'Revista',             minW: 180 },
      { key: 'doi_codigo',       label: 'DOI',                 minW: 160 },
      { key: 'indexacion',       label: 'Indexación',          minW: 130 },
      { key: 'tipo_publicacion', label: 'Tipo',                minW: 130 },
    ],
  },
  tesis: {
    title:   'Tesis',
    singlar: 'tesis',
    cols: [
      { key: 'titulo_tesis',           label: 'Título',    minW: 280 },
      { key: 'autor_estudiante_texto', label: 'Tesista',   minW: 180 },
      { key: 'asesor_texto',           label: 'Asesor(es)',minW: 180 },
    ],
  },
  grupos: {
    title:   'Grupos de Investigación',
    singlar: 'grupo',
    cols: [
      { key: 'nombre_grupo',       label: 'Nombre del Grupo', minW: 220 },
      { key: 'siglas',             label: 'Siglas',           minW: 90 },
      { key: 'docente_nombre',     label: 'Coordinador',      minW: 160 },
      { key: 'correo_coordinador', label: 'Correo',           minW: 140 },
    ],
  },
};

/** Orden de presentación de las tablas */
const TABLE_ORDER = ['investigadores', 'proyectos', 'publicaciones', 'tesis', 'grupos'];

// ─────────────────────────────────────────────────────────────────────────────
// Íconos
// ─────────────────────────────────────────────────────────────────────────────

function CheckCircleIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"
      viewBox="0 0 24 24" fill="none" stroke="#059669"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14"
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
      aria-hidden="true">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tarjeta de estadística
// ─────────────────────────────────────────────────────────────────────────────

interface StatCardProps {
  label:    string;
  value:    number;
  variant:  'neutral' | 'info' | 'error';
  footnote?: string;
}

function StatCard({ label, value, variant, footnote }: StatCardProps) {
  const styles = {
    neutral: { wrapper: 'bg-surface-container-lowest border-outline-variant', label: 'text-on-surface-variant', value: 'text-on-surface' },
    info:    { wrapper: 'bg-surface-container-lowest border-outline-variant', label: 'text-[#1d4ed8]',          value: 'text-[#1d4ed8]' },
    error:   { wrapper: 'bg-[#fff1f1] border-[#fca5a5]',                      label: 'text-error',              value: 'text-error' },
  }[variant];

  return (
    <div className={`flex-1 flex flex-col items-center justify-center gap-1 px-6 py-7 rounded border ${styles.wrapper}`}>
      <span className={`font-sans font-bold text-[10px] uppercase tracking-widest text-center ${styles.label}`}>
        {label}
      </span>
      <span className={`font-heading font-bold leading-none text-[48px] ${styles.value}`}>
        {value}
      </span>
      {footnote && (
        <span className={`font-sans text-[11px] text-center mt-0.5 ${styles.label}`}>
          {footnote}
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tabla colapsable por entidad
// ─────────────────────────────────────────────────────────────────────────────

interface EntityTableProps {
  entityKey:   string;
  rows:        Record<string, unknown>[];
  insertados:  number;
  actualizados: number;
}

function EntityTable({ entityKey, rows, insertados, actualizados }: EntityTableProps) {
  const [open, setOpen] = useState(false);
  const config = TABLE_CONFIG[entityKey];
  if (!config || rows.length === 0) return null;

  const ENTITY_COLORS: Record<string, { border: string; badge: string; header: string }> = {
    investigadores: { border: 'border-blue-200',   badge: 'bg-blue-50 text-blue-700',   header: 'bg-blue-50' },
    proyectos:      { border: 'border-violet-200',  badge: 'bg-violet-50 text-violet-700', header: 'bg-violet-50' },
    publicaciones:  { border: 'border-emerald-200', badge: 'bg-emerald-50 text-emerald-700', header: 'bg-emerald-50' },
    tesis:          { border: 'border-amber-200',   badge: 'bg-amber-50 text-amber-700',  header: 'bg-amber-50' },
    grupos:         { border: 'border-rose-200',    badge: 'bg-rose-50 text-rose-700',    header: 'bg-rose-50' },
  };
  const colors = ENTITY_COLORS[entityKey] ?? { border: 'border-outline-variant', badge: 'bg-surface-container text-on-surface-variant', header: 'bg-surface-container-lowest' };

  // Filtrar columnas que no tienen datos en ninguna fila
  const activeCols = config.cols.filter(col => 
    rows.some(row => {
      const val = row[col.key];
      return val !== null && val !== undefined && val !== '';
    })
  );

  return (
    <div className={`w-full rounded-lg border ${colors.border} overflow-hidden`}>
      {/* Cabecera colapsable */}
      <button
        type="button"
        id={`btn-table-${entityKey}`}
        aria-expanded={open}
        aria-controls={`table-body-${entityKey}`}
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-5 py-3.5 ${colors.header} hover:brightness-95 transition-all cursor-pointer`}
      >
        <div className="flex items-center gap-2">
          <span className="font-sans font-semibold text-[13px] text-on-surface">
            {config.title}
          </span>
          {insertados > 0 && (
            <span className={`font-sans font-bold text-[11px] px-2 py-0.5 rounded-full ${colors.badge}`}>
              {insertados} nuevo{insertados !== 1 ? 's' : ''}
            </span>
          )}
          {actualizados > 0 && (
            <span className="font-sans font-bold text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
              {actualizados} actualizado{actualizados !== 1 ? 's' : ''}
            </span>
          )}
          {insertados === 0 && actualizados === 0 && (
            <span className={`font-sans font-bold text-[11px] px-2 py-0.5 rounded-full ${colors.badge}`}>
              {rows.length} {rows.length === 1 ? config.singlar : `${config.singlar}s`}
            </span>
          )}
        </div>
        <ChevronIcon open={open} />
      </button>

      {/* Cuerpo de la tabla */}
      {open && (
        <div
          id={`table-body-${entityKey}`}
          className="overflow-x-auto"
        >
          <table className="w-full text-[12px] font-sans border-collapse">
            <thead>
              <tr className="border-b border-outline-variant bg-surface-container-lowest">
                <th className="px-3 py-2 text-left font-bold text-on-surface-variant text-[10px] uppercase tracking-wider w-[40px]">
                  #
                </th>
                {activeCols.map(col => (
                  <th
                    key={col.key}
                    className="px-3 py-2 text-left font-bold text-on-surface-variant text-[10px] uppercase tracking-wider whitespace-nowrap"
                    style={{ minWidth: col.minW }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={i}
                  className={`border-b border-outline-variant last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-surface-container-lowest'} hover:bg-surface-container transition-colors`}
                >
                  <td className="px-3 py-2 text-on-surface-variant font-mono text-[11px]">
                    {i + 1}
                  </td>
                  {activeCols.map(col => {
                    const rawVal = row[col.key];
                    const val = rawVal != null && rawVal !== '' ? String(rawVal) : '—';
                    return (
                      <td
                        key={col.key}
                        className="px-3 py-2 text-on-surface max-w-[340px] truncate"
                        title={val !== '—' ? val : undefined}
                      >
                        {val}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers para el log TXT
// ─────────────────────────────────────────────────────────────────────────────

function padCol(s: string, width: number): string {
  const str = s ?? '';
  return str.length >= width ? str.substring(0, width - 1) + '…' : str + ' '.repeat(width - str.length);
}

function buildEntityTxtSection(entityKey: string, rows: Record<string, unknown>[]): string {
  const config = TABLE_CONFIG[entityKey];
  if (!config || rows.length === 0) return '';

  const activeCols = config.cols.filter(col => 
    rows.some(row => {
      const val = row[col.key];
      return val !== null && val !== undefined && val !== '';
    })
  );

  // Ancho máximo de etiqueta para alinear los valores
  const labelWidth = Math.max(...activeCols.map(c => c.label.length));
  const divider    = '  ' + '·'.repeat(48);

  const lines: string[] = [];

  rows.forEach((row, idx) => {
    lines.push('');
    lines.push(`  [${idx + 1}]`);
    for (const col of activeCols) {
      const rawVal = row[col.key];
      const val    = rawVal != null && rawVal !== '' ? String(rawVal) : '—';
      const label  = col.label.padEnd(labelWidth, ' ');
      lines.push(`  ${label} : ${val}`);
    }
    if (idx < rows.length - 1) lines.push(divider);
  });

  return lines.join('\n');
}



// ─────────────────────────────────────────────────────────────────────────────
// Página
// ─────────────────────────────────────────────────────────────────────────────

export default function ImportResultsPage() {
  const router  = useRouter();
  const [results, setResults] = useState<ImportResults | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem('import_results');
    if (raw) {
      try { setResults(JSON.parse(raw)); } catch { /* ignore */ }
    }
  }, []);

  const nuevos               = results?.nuevos            ?? 0;
  const actualizados         = results?.actualizados      ?? 0;
  const errores              = results?.errores           ?? 0;
  const fileName             = results?.fileName          ?? 'importacion';
  const entity               = results?.entity            ?? '';
  const apiRenacytOffline    = results?.apiRenacytOffline ?? false;
  const enCuarentena         = results?.enCuarentena         ?? 0;
  const detalleSinDni        = results?.detalleSinDni        ?? [];
  const detalleExtraccion    = results?.detalleExtraccion    ?? {};
  const resultadosDbDetalle  = results?.resultadosDbDetalle  ?? {};
  const total                = nuevos + actualizados + errores;

  /** Entidades con registros, en el orden definido */
  const entidadesConDatos = TABLE_ORDER.filter(
    k => Array.isArray(detalleExtraccion[k]) && (detalleExtraccion[k] as unknown[]).length > 0
  );

  // ── Generar log de errores con datos reales ───────────────────────────────
  const handleDownloadLog = () => {
    const now  = new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' });
    const lines = [
      `SGPI — Log de Importación`,
      `Fecha        : ${now}`,
      `Archivo      : ${fileName}`,
      `─────────────────────────────────────────`,
      `Total procesados : ${total}`,
      `  Nuevos         : ${nuevos}`,
      `  Actualizados   : ${actualizados}`,
      `  Con error      : ${errores}`,
      `─────────────────────────────────────────`,
      '',
      errores === 0
        ? 'No se registraron errores en esta importación.'
        : `Se encontraron ${errores} registro(s) con error.\n` +
          (apiRenacytOffline
            ? 'AVISO: Se detectó que el servicio externo de CONCYTEC RENACYT estuvo temporalmente fuera de línea,\n' +
              'lo que impidió resolver el DNI de docentes nuevos no registrados previamente en nuestro sistema.\n\n'
            : '') +
          'Revise el archivo original y corrija las filas indicadas.\n' +
          'Para obtener el detalle exacto por fila comuníquese con el administrador del sistema.',
    ];

    // Secciones detalladas de registros guardados
    if (entidadesConDatos.length > 0) {
      lines.push('');
      lines.push('═════════════════════════════════════════');
      lines.push('DETALLE DE REGISTROS GUARDADOS');
      lines.push('═════════════════════════════════════════');

      for (const key of entidadesConDatos) {
        const config   = TABLE_CONFIG[key];
        const rows     = detalleExtraccion[key] as Record<string, unknown>[];
        const dbCounts = resultadosDbDetalle[key];
        const ins  = dbCounts?.insertados  ?? 0;
        const upd  = dbCounts?.actualizados ?? 0;

        lines.push('');
        lines.push(`━━━ ${(config?.title ?? key).toUpperCase()} ━━━`);
        lines.push(`  Nuevos guardados  : ${ins}`);
        lines.push(`  Actualizados      : ${upd}`);
        lines.push('');
        lines.push(buildEntityTxtSection(key, rows));
      }
    }

    const content = lines.join('\n');
    const blob    = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url     = URL.createObjectURL(blob);
    const link    = document.createElement('a');
    link.href     = url;
    link.download = `log_importacion_${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleGoHome = () => {
    sessionStorage.removeItem('import_results');
    sessionStorage.removeItem('import_meta');
    router.push('/importacion');
  };

  return (
    <MainLayout title="Sistema de Gestión de Proyectos de Investigación">

      <div className="flex flex-col items-center justify-start pt-10 w-full">

        {/* ── Ícono check ──────────────────────────────────────────────────────── */}
        <div className="mb-4">
          <CheckCircleIcon />
        </div>

        {/* ── Título ───────────────────────────────────────────────────────────── */}
        <h1 className="font-heading font-bold text-[28px] text-on-surface text-center leading-[36px] mb-2">
          Importación Completada Exitosamente
        </h1>

        {/* ── Subtítulo ─────────────────────────────────────────────────────────── */}
        <p className="font-sans text-body-md text-on-surface-variant text-center max-w-[480px] mb-2">
          La base de datos del SGPI se ha actualizado aplicando lógica de deduplicación para evitar registros repetidos.
        </p>
        {fileName && (
          <p className="font-sans text-[12px] text-on-surface-variant text-center mb-6">
            Archivo procesado: <span className="font-medium">«{fileName}»</span>
            {' · '}<span className="font-medium">{total} registros totales</span>
          </p>
        )}

        {apiRenacytOffline && (
          <div className="flex items-start gap-3 px-5 py-4 bg-[#fffbeb] border border-[#fde68a] text-[#b45309] rounded w-full max-w-[860px] mb-8">
            <span className="text-[#d97706] mt-0.5 shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </span>
            <p className="font-sans text-[13px] leading-[20px] text-left">
              <span className="font-bold">Aviso sobre consulta externa:</span> Se detectó que el servicio externo de CONCYTEC RENACYT no estuvo disponible durante la importación. Algunos registros de docentes nuevos no pudieron ser validados con su DNI y fueron omitidos. Esto no es un error de nuestro sistema.
            </p>
          </div>
        )}

        {/* ── Tarjetas de estadísticas ──────────────────────────────────────────── */}
        <div className="flex items-stretch gap-4 w-full max-w-[860px] mb-8">
          <StatCard
            label="Registros Nuevos Insertados"
            value={nuevos}
            variant="neutral"
          />
          <StatCard
            label="Registros Actualizados"
            value={actualizados}
            variant="info"
            footnote="Información sincronizada"
          />
          <StatCard
            label="Registros Omitidos / Con Error"
            value={errores}
            variant={errores > 0 ? 'error' : 'neutral'}
          />
        </div>

        {/* ── Nota UX sobre errores ─────────────────────────────────────────────── */}
        {errores > 0 && !apiRenacytOffline && (
          <p className="font-sans text-[11px] text-on-surface-variant text-center max-w-[860px] -mt-5 mb-8 flex items-center justify-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 opacity-60">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
            Los registros con error generalmente corresponden a docentes cuyo nombre no pudo resolverse en el padrón RENACYT de CONCYTEC.
          </p>
        )}

        {/* ── Sección de cuarentena ─────────────────────────────────────────────── */}
        {enCuarentena > 0 && (
          <div className="w-full max-w-[860px] mb-8 rounded-lg border border-[#fde68a] overflow-hidden">
            {/* Cabecera */}
            <div className="flex items-start gap-3 px-5 py-4 bg-[#fffbeb] border-b border-[#fde68a]">
              <span className="shrink-0 mt-0.5 text-[#d97706]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </span>
              <div>
                <p className="font-sans font-bold text-[13px] text-[#92400e]">
                  {enCuarentena} registro{enCuarentena > 1 ? 's fueron enviados' : ' fue enviado'} a revisión manual
                </p>
                <p className="font-sans text-[12px] text-[#b45309] mt-0.5">
                  No se descartaron — están guardados en Cuarentena esperando que un administrador asigne el DNI correspondiente.
                </p>
              </div>
            </div>

            {/* Lista de personas sin resolver */}
            {detalleSinDni.length > 0 && (
              <div className="bg-white px-5 py-4">
                <p className="font-sans text-[12px] font-semibold text-[#374151] mb-3">
                  Personas cuyo DNI no pudo resolverse automáticamente:
                </p>
                <ul className="flex flex-col gap-2">
                  {detalleSinDni.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-[12px]">
                      <span className="shrink-0 mt-0.5 text-[#d97706]">•</span>
                      <div>
                        <span className="font-semibold text-[#1f2937]">{item.nombre}</span>
                        <span className="text-[#6b7280] ml-1">— {item.contexto}</span>
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="font-sans text-[11px] text-[#9ca3af] mt-4">
                  Puede revisarlos y completarlos desde el módulo de <span className="font-semibold">Sincronización → Cuarentena</span>.
                </p>
              </div>
            )}
          </div>
        )}


        {entidadesConDatos.length > 0 && (
          <div className="w-full max-w-[860px] mb-8">
            <h2 className="font-sans font-semibold text-[13px] uppercase tracking-widest text-on-surface-variant mb-3">
              Registros guardados por tabla
            </h2>
            <div className="flex flex-col gap-3">
              {entidadesConDatos.map(key => {
                const dbCounts = resultadosDbDetalle[key];
                return (
                  <EntityTable
                    key={key}
                    entityKey={key}
                    rows={detalleExtraccion[key] as Record<string, unknown>[]}
                    insertados={dbCounts?.insertados  ?? 0}
                    actualizados={dbCounts?.actualizados ?? 0}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* ── Botones de acción ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <Button
            id="btn-descargar-log"
            variant="secondary"
            size="md"
            iconLeft={<DownloadIcon />}
            onClick={handleDownloadLog}
            aria-label="Descargar log de importación en formato txt"
          >
            Descargar Log (.txt)
          </Button>

          <Button
            id="btn-volver-inicio"
            variant="primary"
            size="md"
            onClick={handleGoHome}
            aria-label="Volver al módulo de importación"
          >
            Nueva Importación
          </Button>
        </div>

      </div>

    </MainLayout>
  );
}
