'use client';

/**
 * @file [id]/page.tsx
 * @route /SGPI-CFAC/[id]
 * @description Pantalla de detalle de una Convocatoria de Alerta.
 *
 * Flujo (pasos 7-14):
 *  - Muestra cronograma y, si `cronogramaModificado`, resalta el cambio
 *  - Botón "Cargar Evidencia" → abre modal (paso 9)
 *  - Modal valida archivo (EX2) y sube evidencia (paso 12)
 *  - Tras el éxito muestra banner verde + lista de archivos (paso 13)
 *
 * Conexión real (TODO):
 *  - getConvocatoriaById → GET /api/v1/convocatorias/{id}
 *  - subirEvidencia      → POST /api/v1/convocatorias/{id}/evidencias (multipart)
 */

import React, {
  useState, useEffect, useRef, useCallback,
} from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MainLayout }           from '@/SGPI-CFU/components/layout';
import type { Convocatoria, Evidencia } from '../_data/types';
import {
  getConvocatoriaById,
  subirEvidencia,
  validarEvidencia,
  formatFechaCierre,
  diasRestantes,
  nivelAlerta,
  EVIDENCIA_MAX_SIZE_MB,
  EVIDENCIA_ALLOWED_EXTS,
} from '../_data/service';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatHora(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Íconos
// ─────────────────────────────────────────────────────────────────────────────

const BackIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);

const WarningIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

const UploadBtnIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/>
    <line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
);

const XIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const CloudUploadIcon = () => (
  <svg width="44" height="44" viewBox="0 0 24 24" fill="none"
    stroke="#001631" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 16 12 12 8 16"/>
    <line x1="12" y1="12" x2="12" y2="21"/>
    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
  </svg>
);

const PdfIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="9" y1="13" x2="15" y2="13"/>
    <line x1="9" y1="17" x2="12" y2="17"/>
  </svg>
);

const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="#166534" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// Modal de subir evidencia
// ─────────────────────────────────────────────────────────────────────────────

interface ModalProps {
  convNombre: string;
  convId:     string;
  onClose:    () => void;
  onSuccess:  (ev: Evidencia) => void;
}

function SubirEvidenciaModal({ convNombre, convId, onClose, onSuccess }: ModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file,        setFile]        = useState<File | null>(null);
  const [descripcion, setDescripcion] = useState('');
  const [isDragging,  setIsDragging]  = useState(false);
  const [fileError,   setFileError]   = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // ── Manejo de archivo ────────────────────────────────────────────────────────
  const handleFile = (f: File) => {
    const { valid, error } = validarEvidencia(f);
    if (!valid) { setFileError(error ?? 'Archivo inválido.'); return; }
    setFile(f);
    setFileError(null);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const handleZoneClick = () => { if (!file) fileInputRef.current?.click(); };
  const handleZoneKey   = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && !file) fileInputRef.current?.click();
  };

  // ── Confirmar ────────────────────────────────────────────────────────────────
  const handleConfirm = async () => {
    if (!file || !descripcion.trim()) return;
    setIsUploading(true);
    try {
      // TODO: cuando el backend esté listo, subirEvidencia ya apunta al endpoint real.
      const ev = await subirEvidencia({ convocatoriaId: convId, file, descripcion: descripcion.trim() });
      onSuccess(ev);
    } catch {
      setFileError('Error al subir la evidencia. Intente nuevamente.');
    } finally {
      setIsUploading(false);
    }
  };

  const canConfirm = file !== null && descripcion.trim().length > 0 && !isUploading;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog" aria-modal="true" aria-labelledby="modal-titulo">

      {/* Backdrop semitransparente */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel del modal */}
      <div className="relative w-full max-w-[500px] bg-white rounded-lg shadow-2xl overflow-hidden">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#e2e8f0]">
          <h2 id="modal-titulo" className="font-heading font-bold text-[18px] text-on-surface">
            Subir Evidencia de Difusión
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded text-[#64748b] hover:bg-[#f1f5f9] transition-colors"
            aria-label="Cerrar modal"
          >
            <XIcon />
          </button>
        </div>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <div className="px-6 py-5 flex flex-col gap-5">

          {/* Zona drag-and-drop */}
          <div
            role="button" tabIndex={0}
            onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
            onClick={handleZoneClick} onKeyDown={handleZoneKey}
            aria-label="Zona de carga de evidencia"
            className={`
              w-full min-h-[160px] flex flex-col items-center justify-center gap-3
              rounded-lg border-2 border-dashed
              transition-colors duration-150 select-none
              ${isDragging
                ? 'border-[#2563eb] bg-[#dbeafe] cursor-copy'
                : file
                  ? 'border-[#bfdbfe] bg-[#eff6ff] cursor-default'
                  : 'border-[#bfdbfe] bg-[#eff6ff] hover:border-[#2563eb] cursor-pointer'
              }
            `}
          >
            <input
              ref={fileInputRef} type="file"
              accept={EVIDENCIA_ALLOWED_EXTS.join(',')}
              className="sr-only" onChange={handleInputChange}
              aria-hidden="true" tabIndex={-1}
            />

            {/* Ícono de nube siempre visible */}
            <CloudUploadIcon />

            {file ? (
              /* Archivo seleccionado */
              <div className="flex flex-col items-center gap-1 text-center px-4">
                <p className="font-heading font-bold text-[15px] text-on-surface">{file.name}</p>
                <p className="font-sans text-[13px] text-[#64748b]">{formatFileSize(file.size)}</p>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setFile(null); setFileError(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                  className="font-sans text-[11px] text-[#64748b] hover:text-[#dc2626] mt-0.5 transition-colors"
                >
                  Quitar archivo
                </button>
              </div>
            ) : (
              /* Estado vacío */
              <div className="flex flex-col items-center gap-1 pointer-events-none text-center px-4">
                <p className={`font-sans font-semibold text-[13px] ${isDragging ? 'text-[#2563eb]' : 'text-on-surface'}`}>
                  {isDragging ? 'Suelte el archivo aquí' : 'Arrastre o haga clic para seleccionar'}
                </p>
                <p className="font-sans text-[12px] text-[#64748b]">
                  <span className="font-medium">PDF, JPG, PNG</span> — Máx. <span className="font-medium">{EVIDENCIA_MAX_SIZE_MB} MB</span>
                </p>
              </div>
            )}
          </div>

          {/* Error EX2 */}
          {fileError && (
            <div role="alert" className="px-3 py-2.5 rounded bg-[#fff1f2] border border-[#fca5a5] font-sans text-[12px] text-[#991b1b]">
              <span className="font-bold">Error: </span>{fileError}
            </div>
          )}

          {/* Descripción */}
          <div>
            <label htmlFor="ev-descripcion"
              className="block font-sans font-bold text-[14px] text-on-surface mb-2">
              Descripción de la gestión
            </label>
            <textarea
              id="ev-descripcion" rows={3}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej: Publicado en redes sociales FISI y envío por correo institucional."
              className="
                w-full px-3 py-2.5
                font-sans text-[13px] text-on-surface
                border border-[#cbd5e1] rounded
                outline-none resize-none
                focus:ring-2 focus:ring-[#93c5fd] focus:border-[#3b82f6]
                transition-all duration-100
                placeholder:text-[#94a3b8]
              "
              aria-label="Descripción de la gestión de difusión"
            />
          </div>
        </div>

        {/* ── Footer — botón Confirmar Guardado ────────────────────────────── */}
        <div className="px-6 pb-6">
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="
              w-full flex items-center justify-center gap-2
              py-3 rounded-lg
              font-sans font-bold text-[15px] text-white
              bg-[#001631] hover:bg-[#002b54] active:bg-[#001229]
              disabled:opacity-40 disabled:cursor-not-allowed
              transition-colors duration-100
            "
            aria-label="Confirmar y guardar evidencia"
          >
            {isUploading ? (
              <>
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                Guardando...
              </>
            ) : 'Confirmar Guardado'}
          </button>
        </div>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Página de detalle
// ─────────────────────────────────────────────────────────────────────────────

export default function ConvocatoriaDetailPage() {
  const router = useRouter();
  const params = useParams();

  const [conv,         setConv]         = useState<Convocatoria | null>(null);
  const [evidencias,   setEvidencias]   = useState<Evidencia[]>([]);
  const [notFound,     setNotFound]     = useState(false);
  const [showModal,    setShowModal]    = useState(false);
  const [successBanner,setSuccessBanner]= useState(false);
  const [isLoading,    setIsLoading]    = useState(true);

  // ── Carga de datos ──────────────────────────────────────────────────────────
  useEffect(() => {
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    if (!id) { setNotFound(true); setIsLoading(false); return; }

    // TODO: reemplazar por GET /api/v1/convocatorias/{id}
    getConvocatoriaById(id).then((data) => {
      if (!data) setNotFound(true);
      else {
        setConv(data);
        setEvidencias(data.evidencias);
      }
      setIsLoading(false);
    });
  }, [params.id]);

  // ── Auto-ocultar banner ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!successBanner) return;
    const t = setTimeout(() => setSuccessBanner(false), 8000);
    return () => clearTimeout(t);
  }, [successBanner]);

  // ── Callback de éxito del modal ─────────────────────────────────────────────
  const handleSuccess = (ev: Evidencia) => {
    setEvidencias((prev) => [...prev, ev]);
    setShowModal(false);
    setSuccessBanner(true);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Skeleton / 404
  // ─────────────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <MainLayout title="Sistema de Gestión de Proyectos de Investigación">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-surface-container-high rounded w-1/4"/>
          <div className="h-8 bg-surface-container-high rounded w-1/2"/>
          <div className="h-40 bg-surface-container-high rounded"/>
        </div>
      </MainLayout>
    );
  }

  if (notFound || !conv) {
    return (
      <MainLayout title="Sistema de Gestión de Proyectos de Investigación">
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="font-heading font-semibold text-h2 text-on-surface mb-2">Convocatoria no encontrada</p>
          <button onClick={() => router.push('/SGPI-CFAC')}
            className="font-sans text-[13px] font-medium text-[#2563eb] hover:underline">
            ← Volver a la lista
          </button>
        </div>
      </MainLayout>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Lógica de semaforización y estado difusión
  // ─────────────────────────────────────────────────────────────────────────

  const dias             = diasRestantes(conv.fechaCierre);
  const nivel            = nivelAlerta(dias);
  const tieneEvidencias  = evidencias.length > 0;

  const estadoBadge = nivel === 'rojo'
    ? { bg: 'bg-[#dc2626]', text: 'CIERRE INMINENTE' }
    : nivel === 'amarillo'
      ? { bg: 'bg-[#d97706]', text: `VENCE EN ${dias} DÍAS` }
      : { bg: 'bg-[#16a34a]', text: conv.estado.toUpperCase() };

  const nombre = conv.programa ?? conv.nombre;

  // ─────────────────────────────────────────────────────────────────────────
  // Render principal
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <MainLayout title="Sistema de Gestión de Proyectos de Investigación">

      {/* ── Banner de éxito (paso 13) ─────────────────────────────────────── */}
      {successBanner && (
        <div
          role="status" aria-live="polite"
          className="
            flex items-center gap-2.5 mb-5
            px-4 py-3 rounded
            bg-[#f0fdf4] border border-[#86efac]
            font-sans text-[13px] text-[#166534]
          "
        >
          <CheckIcon />
          <span>Evidencia guardada exitosamente. El estado de difusión ha sido actualizado.</span>
        </div>
      )}

      {/* ── Volver ───────────────────────────────────────────────────────────── */}
      <div className="mb-4">
        <button
          onClick={() => router.push('/SGPI-CFAC')}
          className="inline-flex items-center gap-1.5 font-sans text-[13px] font-medium text-on-surface-variant hover:text-on-surface transition-colors"
          aria-label="Volver a la lista de convocatorias"
        >
          <BackIcon /> Volver a la lista
        </button>
      </div>

      {/* ── Cabecera ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Badge de estado/urgencia */}
          {tieneEvidencias ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded font-sans font-bold text-[11px] uppercase tracking-wider bg-[#16a34a] text-white">
              <CheckIcon /> Estado: Difusión Completada
            </span>
          ) : (
            <span className={`inline-block px-3 py-1 rounded font-sans font-bold text-[11px] uppercase tracking-wider text-white ${estadoBadge.bg}`}>
              {estadoBadge.text}
            </span>
          )}
          <h1 className="font-heading font-bold text-[20px] text-on-surface">
            {nombre}
          </h1>
        </div>

        {/* Botón Cargar Evidencia (siempre visible) */}
        <button
          onClick={() => setShowModal(true)}
          className="
            flex items-center gap-2
            px-4 py-2 rounded
            font-sans font-semibold text-[13px] text-white
            bg-[#001631] hover:bg-[#002b54] active:bg-[#001229]
            transition-colors duration-100 flex-shrink-0
          "
          aria-label="Cargar evidencia de difusión"
        >
          <UploadBtnIcon /> Cargar Evidencia
        </button>
      </div>

      {/* ── Cronograma Histórico ─────────────────────────────────────────────── */}
      {(conv.apertura || conv.cronogramaModificado) && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded shadow-level-1 overflow-hidden mb-5">
          <div className="px-5 pt-4 pb-2 border-b border-outline-variant">
            <h2 className="font-sans font-bold text-[13px] text-on-surface">Cronograma Histórico</h2>
          </div>

          <div className="divide-y divide-outline-variant">
            {/* Apertura original */}
            {conv.apertura && (
              <div className="flex items-center justify-between px-5 py-3">
                <span className="font-sans text-[13px] text-on-surface-variant">Apertura Original:</span>
                <span className="font-sans text-[13px] text-on-surface font-medium">
                  {formatFechaCierre(conv.apertura)}
                </span>
              </div>
            )}

            {/* Cierre original (si fue modificado) */}
            {conv.cronogramaModificado && conv.cierreOriginal && (
              <div className="flex items-center justify-between px-5 py-3">
                <span className="font-sans text-[13px] text-on-surface-variant line-through">
                  Cierre Original:
                </span>
                <span className="font-sans text-[13px] text-on-surface-variant line-through">
                  {formatFechaCierre(conv.cierreOriginal)}
                </span>
              </div>
            )}

            {/* Cierre (modificado o normal) */}
            {conv.cronogramaModificado ? (
              <div className="flex items-center justify-between px-5 py-3 bg-[#fff5f5]">
                <div className="flex items-center gap-2">
                  <WarningIcon />
                  <span className="font-sans font-semibold text-[13px] text-[#dc2626]">
                    Cierre Modificado:
                  </span>
                </div>
                <span className="font-sans font-bold text-[13px] text-[#dc2626]">
                  {formatFechaCierre(conv.fechaCierre)}
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-between px-5 py-3">
                <span className="font-sans text-[13px] text-on-surface-variant">Fecha de Cierre:</span>
                <span className="font-sans text-[13px] text-on-surface font-medium">
                  {formatFechaCierre(conv.fechaCierre)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Archivos de Evidencia (paso 13 / estado final) ───────────────────── */}
      {tieneEvidencias && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded shadow-level-1 overflow-hidden">
          <div className="px-5 pt-4 pb-2 border-b border-outline-variant">
            <h2 className="font-sans font-bold text-[13px] text-on-surface">Archivos de Evidencia</h2>
          </div>

          <ul className="divide-y divide-outline-variant">
            {evidencias.map((ev) => (
              <li key={ev.id} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-container-low transition-colors">
                {/* Ícono PDF */}
                <span className="flex-shrink-0"><PdfIcon /></span>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-sans font-semibold text-[13px] text-on-surface truncate">
                    {ev.fileName}
                  </p>
                  <p className="font-sans text-[11px] text-on-surface-variant">
                    Subido por: {ev.cargadoPor}
                    {' | '}
                    {ev.fechaCarga === new Date().toISOString().split('T')[0]
                      ? `Hoy, ${new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}`
                      : ev.fechaCarga}
                  </p>
                </div>

                {/* Botón descargar */}
                <button
                  className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
                  aria-label={`Descargar ${ev.fileName}`}
                  onClick={() => {
                    /* TODO: GET /api/v1/evidencias/{ev.id}/download */
                    alert(`Descarga: ${ev.fileName} (disponible con backend real)`);
                  }}
                >
                  <DownloadIcon />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Descripción (si no hay nada más que mostrar) ─────────────────────── */}
      {!tieneEvidencias && !conv.apertura && !conv.cronogramaModificado && conv.descripcion && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded shadow-level-1 p-5">
          <h2 className="font-sans font-bold text-[13px] text-on-surface mb-2">Descripción</h2>
          <p className="font-sans text-[13px] text-on-surface-variant leading-[20px]">{conv.descripcion}</p>
        </div>
      )}

      {/* ── Modal de subir evidencia ─────────────────────────────────────────── */}
      {showModal && (
        <SubirEvidenciaModal
          convNombre={nombre}
          convId={conv.id}
          onClose={() => setShowModal(false)}
          onSuccess={handleSuccess}
        />
      )}

    </MainLayout>
  );
}
