/**
 * @file _data/service.ts
 * @description Capa de servicio del módulo de Alertas de Convocatorias.
 *
 * Para conectar con el backend real:
 * 1. Descomentar las llamadas fetch.
 * 2. Comentar o eliminar el bloque MOCK.
 *
 * Endpoints:
 *   GET    /api/v1/convocatorias                     → lista paginada
 *   GET    /api/v1/convocatorias/{id}                → detalle
 *   POST   /api/v1/convocatorias/{id}/evidencias     → subir evidencia (multipart)
 */

import type { Convocatoria, AlertaFiltros, NivelAlerta, EvidenciaPayload, Evidencia } from './types';
import { apiClient } from '@/SGPI-CFU/lib/api/client';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de semaforización
// ─────────────────────────────────────────────────────────────────────────────

/** Calcula los días restantes hasta la fecha de cierre desde hoy */
export function diasRestantes(fechaCierre: string): number {
  const hoy    = new Date();
  hoy.setHours(0, 0, 0, 0);
  const cierre = new Date(fechaCierre + 'T00:00:00');
  return Math.ceil((cierre.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Determina el nivel de alerta según días restantes.
 * Umbrales: rojo ≤ 3 días | amarillo 4-7 días | verde > 7 días
 */
export function nivelAlerta(dias: number): NivelAlerta {
  if (dias <= 3) return 'rojo';
  if (dias <= 7) return 'amarillo';
  return 'verde';
}

/** Formatea una fecha ISO "YYYY-MM-DD" a "DD Mmm YYYY" en español */
export function formatFechaCierre(iso: string): string {
  const [y, m, d] = iso.split('-');
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${parseInt(d)} ${meses[parseInt(m) - 1]} ${y}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Servicio de consulta
// ─────────────────────────────────────────────────────────────────────────────

export async function getConvocatorias(filtros: AlertaFiltros): Promise<Convocatoria[]> {
  const res = await apiClient.get<any[]>('/calls');
  
  let list: Convocatoria[] = res.map((c: any) => ({
    id: String(c.id_convocatoria),
    nombre: c.titulo_convocatoria,
    entidad: c.entidad_emisora || 'VRIP-UNMSM',
    estado: c.estado_convocatoria as any,
    apertura: c.fecha_inicio_inscripcion,
    fechaCierre: c.fecha_cierre || new Date().toISOString().split('T')[0],
    fuente: 'VRIP',
    ultimaSync: c.created_at,
    evidencias: [],
  }));

  // Filtro: estado
  if (filtros.estado !== 'Todos') {
    list = list.filter((c) => c.estado === filtros.estado);
  }

  // Filtro: búsqueda de texto
  if (filtros.buscar.trim()) {
    const q = filtros.buscar.toLowerCase();
    list = list.filter(
      (c) =>
        c.nombre.toLowerCase().includes(q) ||
        c.entidad.toLowerCase().includes(q) ||
        (c.programa?.toLowerCase().includes(q) ?? false)
    );
  }

  // Ordenar
  if (filtros.orden === 'fechaCierre') {
    list = list.sort((a, b) => a.fechaCierre.localeCompare(b.fechaCierre));
  } else if (filtros.orden === 'nombre') {
    list = list.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  } else if (filtros.orden === 'alerta') {
    list = list.sort((a, b) => diasRestantes(a.fechaCierre) - diasRestantes(b.fechaCierre));
  }

  return list;
}

export async function getConvocatoriaById(id: string): Promise<Convocatoria | null> {
  try {
    const res = await apiClient.get<any>(`/calls/${id}`);
    return {
      id: String(res.id_convocatoria),
      nombre: res.titulo_convocatoria,
      entidad: res.entidad_emisora || 'VRIP-UNMSM',
      estado: res.estado_convocatoria as any,
      apertura: res.fecha_inicio_inscripcion,
      fechaCierre: res.fecha_cierre || new Date().toISOString().split('T')[0],
      fuente: 'VRIP',
      ultimaSync: res.created_at,
      evidencias: [],
    };
  } catch (error) {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Subida de evidencia
// ─────────────────────────────────────────────────────────────────────────────

const EVIDENCIA_MAX_SIZE_MB   = 10;
const EVIDENCIA_ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const EVIDENCIA_ALLOWED_EXTS  = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];

export function validarEvidencia(file: File): { valid: boolean; error?: string } {
  const ext = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '');
  if (!EVIDENCIA_ALLOWED_EXTS.includes(ext)) {
    return {
      valid: false,
      error: 'El archivo debe ser PDF o Imagen y no superar los 10MB.',
    };
  }
  if (file.size > EVIDENCIA_MAX_SIZE_MB * 1024 * 1024) {
    return {
      valid: false,
      error: 'El archivo debe ser PDF o Imagen y no superar los 10MB.',
    };
  }
  return { valid: true };
}

export async function subirEvidencia(payload: EvidenciaPayload): Promise<Evidencia> {
  // Dado que el backend actual espera un JSON con los metadatos y no implementa subida multipart real de momento:
  const res = await apiClient.post<any>(`/calls/${payload.convocatoriaId}/evidence`, {
    id_convocatoria: parseInt(payload.convocatoriaId),
    tipo_evidencia: payload.file.type || 'application/pdf',
    nombre_archivo: payload.file.name,
    url_archivo: `local://${payload.file.name}`
  });

  return {
    id: String(res.id_evidencia),
    fileName: res.nombre_archivo,
    descripcion: payload.descripcion,
    fechaCarga: res.fecha_carga,
    cargadoPor: 'Usuario Actual',
  };
}

export { EVIDENCIA_MAX_SIZE_MB, EVIDENCIA_ALLOWED_EXTS };
