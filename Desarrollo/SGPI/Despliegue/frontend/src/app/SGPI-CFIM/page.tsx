'use client';

/**
 * @file SGPI-CFIM/page.tsx
 * @route /SGPI-CFIM  →  alias: /import
 * @description Pantalla de carga del archivo de importación.
 *
 * Flujo real:
 *  1. Usuario selecciona entidad + archivo (.xlsx/.csv)
 *  2. Click "Validar" → POST /api/v1/import/excel → job_id
 *  3. Se guarda {entity, fileName, fileSize, jobId} en sessionStorage
 *  4. Navega a /SGPI-CFIM/preview para seguimiento del progreso
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/SGPI-CFU/components/layout';
import { Button } from '@/SGPI-CFU/components/ui';
import { importEndpoints } from '@/SGPI-CFU/lib/api/endpoints';
import type { UserRole } from '@/SGPI-CFU/lib/types/auth';

// ── Mock temporal de useAuth ──────────────────────────────────────────────────
function useMockAuth() {
  return {
    user: {
      id:    'mock-1',
      name:  'Ana Mendoza',
      email: 'amendoza@unmsm.edu.pe',
      role:  'secretary' as UserRole,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE_MB    = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_EXTENSIONS  = ['.csv', '.xlsx'];

// ─────────────────────────────────────────────────────────────────────────────
// Íconos SVG inline
// ─────────────────────────────────────────────────────────────────────────────

function CloudUploadIcon({ className = '' }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden="true">
      <polyline points="16 16 12 12 8 16" />
      <line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    </svg>
  );
}

function FileIcon({ className = '' }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36"
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13"
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function isValidFile(file: File): { valid: boolean; error?: string } {
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext))
    return { valid: false, error: `Formato no permitido. Use: ${ALLOWED_EXTENSIONS.join(', ')}` };
  if (file.size > MAX_FILE_SIZE_BYTES)
    return { valid: false, error: `El archivo excede el tamaño máximo de ${MAX_FILE_SIZE_MB} MB.` };
  return { valid: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────────────────────────────────────

export default function ImportacionDeDatosPage() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { user }  = useMockAuth();
  const router    = useRouter();

  const [isDragging,     setIsDragging]     = useState(false);
  const [selectedFile,   setSelectedFile]   = useState<File | null>(null);
  const [fileError,      setFileError]      = useState<string | null>(null);
  const [isUploading,    setIsUploading]    = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-cerrar banner de error a los 6 s
  useEffect(() => {
    if (!fileError) return;
    const t = setTimeout(() => setFileError(null), 6000);
    return () => clearTimeout(t);
  }, [fileError]);

  // ── Drag & Drop ───────────────────────────────────────────────────────────

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const { valid, error } = isValidFile(file);
    if (!valid) { setFileError(error ?? 'Archivo no válido.'); return; }
    setSelectedFile(file);
    setFileError(null);
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { valid, error } = isValidFile(file);
    if (!valid) { setFileError(error ?? 'Archivo no válido.'); e.target.value = ''; return; }
    setSelectedFile(file);
    setFileError(null);
  }, []);

  const handleRemoveFile = useCallback(() => {
    setSelectedFile(null);
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  // ── Upload real al backend ────────────────────────────────────────────────

  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setFileError(null);

    try {
      // Llamada real: POST /api/v1/import/excel → { job_id }
      const { job_id } = await importEndpoints.uploadExcel(selectedFile);

      // Persistir metadatos en sessionStorage para las pantallas siguientes
      sessionStorage.setItem('import_meta', JSON.stringify({
        entity:   'general',
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        jobId:    job_id,
      }));

      // Ir a la pantalla de progreso / preview
      router.push('/SGPI-CFIM/preview');

    } catch (err: unknown) {
      const msg = err instanceof Error
        ? err.message
        : 'No se pudo subir el archivo. Verifique su conexión e intente nuevamente.';
      setFileError(msg);
    } finally {
      setIsUploading(false);
    }
  }, [selectedFile, router]);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <MainLayout title="Sistema de Gestión de Proyectos de Investigación">

      {/* ── Encabezado ──────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <h1 className="font-heading font-semibold text-h1 text-on-surface leading-[38px]">
          Importación de Datos (RAIS)
        </h1>
        <p className="mt-1 font-sans text-body-md text-on-surface-variant">
          Utilice esta herramienta para poblar o actualizar la base de datos del SGPI.
          Suba los archivos exportados del sistema oficial RAIS. El sistema insertará
          los registros nuevos y actualizará los existentes sin duplicar información.
        </p>
      </div>

      {/* ── Tarjeta centrada ────────────────────────────────────────────────── */}
      <div className="flex justify-center">
        <div className="
          w-full max-w-[600px]
          bg-surface-container-lowest
          rounded border border-outline-variant shadow-level-1
          p-6 flex flex-col gap-5
        ">

          {/* ── 1. Información ──────────────────────────────────────── */}
          <div>
            <label className="block font-sans font-bold text-[13px] text-on-surface mb-2">
              1. Seleccione el archivo a importar:
            </label>
            <p className="font-sans text-[12px] text-on-surface-variant mb-4">
              El sistema identificará automáticamente si el archivo contiene datos de Docentes, Proyectos, Publicaciones, Tesis o Grupos de Investigación.
            </p>
          </div>

          {/* ── 2. Zona Drag & Drop ─────────────────────────────────────────── */}
          <div
            role="button"
            tabIndex={0}
            aria-label="Zona de carga de archivo. Arrastre o haga clic para seleccionar"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !selectedFile && !isUploading && fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && !selectedFile && !isUploading)
                fileInputRef.current?.click();
            }}
            className={`
              w-full
              flex flex-col items-center justify-center
              gap-3 min-h-[180px]
              rounded border-2 border-dashed
              transition-colors duration-150
              select-none
              ${isDragging
                ? 'border-primary bg-[#eef2ff] cursor-copy'
                : selectedFile
                  ? 'border-outline-variant bg-surface-container-low cursor-default'
                  : 'border-outline-variant bg-surface-container-low hover:border-primary hover:bg-[#f4f6ff] cursor-pointer'
              }
              ${isUploading ? 'opacity-60 pointer-events-none' : ''}
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              id="file-input-import"
              accept={ALLOWED_EXTENSIONS.join(',')}
              className="sr-only"
              onChange={handleFileInputChange}
              aria-hidden="true"
              tabIndex={-1}
            />

            {selectedFile ? (
              /* ── Archivo listo ────────────────────────────────────────── */
              <div className="flex flex-col items-center gap-2 px-6 text-center">
                <span className="text-[#059669]"><FileIcon /></span>
                <div>
                  <p className="font-sans font-semibold text-[14px] text-on-surface">
                    {selectedFile.name}
                  </p>
                  <p className="font-sans text-[12px] text-on-surface-variant mt-0.5">
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleRemoveFile(); }}
                  className="
                    flex items-center gap-1 mt-1 px-3 py-1 rounded
                    font-sans text-[12px] font-medium text-on-surface-variant
                    hover:bg-surface-container hover:text-error
                    transition-colors duration-100
                  "
                  aria-label="Quitar archivo seleccionado"
                  disabled={isUploading}
                >
                  <XIcon />
                  Quitar archivo
                </button>
              </div>
            ) : (
              /* ── Estado vacío ─────────────────────────────────────────── */
              <div className="flex flex-col items-center gap-2 px-6 text-center pointer-events-none">
                <CloudUploadIcon
                  className={`transition-colors duration-150 ${isDragging ? 'text-primary' : 'text-on-surface-variant'
                    }`}
                />
                <p className={`font-sans font-semibold text-[14px] transition-colors duration-150 ${isDragging ? 'text-primary' : 'text-on-surface'
                  }`}>
                  {isDragging ? 'Suelte el archivo aquí' : 'Arrastre y suelte su archivo Excel o CSV aquí'}
                </p>
                <p className="font-sans text-[12px] text-on-surface-variant">
                  O haga clic para explorar en su equipo. Formatos permitidos:{' '}
                  <span className="font-medium">.csv, .xlsx</span>.{' '}
                  Tamaño máximo: <span className="font-medium">{MAX_FILE_SIZE_MB} MB</span>
                </p>
              </div>
            )}
          </div>

          {/* ── Error de archivo ────────────────────────────────────────────── */}
          {fileError && (
            <div
              role="alert"
              className="
                px-4 py-2.5 rounded
                bg-error-container text-on-error-container
                border border-[#ffb4ab]
                font-sans text-[13px]
              "
            >
              {fileError}
            </div>
          )}

          {/* ── Botón Subir ──────────────────────────────────────────────────── */}
          <div className="flex justify-center">
            <Button
              id="btn-subir-archivo"
              variant="primary"
              size="md"
              disabled={!selectedFile || isUploading}
              loading={isUploading}
              onClick={handleUpload}
              aria-label="Subir archivo e iniciar importación en background"
            >
              {isUploading ? 'Subiendo archivo...' : 'Subir e Iniciar Importación'}
            </Button>
          </div>

        </div>
      </div>

    </MainLayout>
  );
}
