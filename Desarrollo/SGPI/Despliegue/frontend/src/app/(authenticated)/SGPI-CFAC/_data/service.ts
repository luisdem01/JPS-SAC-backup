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
import { supabase } from '@/SGPI-CFU/lib/supabase';
import { removeAccents } from '@/SGPI-CFU/lib/utils/formatters';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de semaforización
// ─────────────────────────────────────────────────────────────────────────────

/** Calcula los días restantes hasta la fecha de cierre desde hoy */
export function diasRestantes(fechaCierre?: string | null): number {
  if (!fechaCierre) return 999;
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
export function formatFechaCierre(iso?: string | null): string {
  if (!iso) return 'No especificada';
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
    fechaCierre: c.fecha_cierre || null,
    fuente: 'VRIP',
    ultimaSync: c.created_at,
    cronogramaDetallado: c.cronograma_detallado,
    evidencias: (c.evidencias || []).map((e: any) => ({
      id: String(e.id_evidencia),
      fileName: e.nombre_archivo,
      descripcion: e.tipo_evidencia || '',
      fechaCarga: e.fecha_carga,
      cargadoPor: 'Usuario',
      urlArchivo: e.url_archivo,
    })),
  }));

  // Filtro: estado
  if (filtros.estado !== 'Todos') {
    if (filtros.estado === 'Por Vencer') {
      list = list.filter((c) => c.estado === 'Abierta' && diasRestantes(c.fechaCierre) <= 7 && diasRestantes(c.fechaCierre) >= 0);
    } else {
      list = list.filter((c) => c.estado === filtros.estado);
    }
  }

  // Filtro: búsqueda de texto
  if (filtros.buscar.trim()) {
    const q = removeAccents(filtros.buscar);
    list = list.filter(
      (c) =>
        removeAccents(c.nombre).includes(q) ||
        removeAccents(c.entidad).includes(q) ||
        (c.programa ? removeAccents(c.programa).includes(q) : false)
    );
  }

  // Ordenar
  if (filtros.orden === 'fechaCierre') {
    list = list.sort((a, b) => {
      const fa = a.fechaCierre || '';
      const fb = b.fechaCierre || '';
      if (!fa && !fb) return 0;
      if (!fa) return 1;
      if (!fb) return -1;
      return fa.localeCompare(fb);
    });
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
      fechaCierre: res.fecha_cierre || null,
      fuente: 'VRIP',
      ultimaSync: res.created_at,
      cronogramaDetallado: res.cronograma_detallado,
      evidencias: (res.evidencias || []).map((e: any) => ({
        id: String(e.id_evidencia),
        fileName: e.nombre_archivo,
        descripcion: e.tipo_evidencia || '',
        fechaCarga: e.fecha_carga,
        cargadoPor: 'Usuario',
        urlArchivo: e.url_archivo,
      })),
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
  // 1. Subir archivo al bucket de Supabase
  const fileExt = payload.file.name.split('.').pop();
  const uniqueName = `${payload.convocatoriaId}_${Date.now()}.${fileExt}`;
  const filePath = `${payload.convocatoriaId}/${uniqueName}`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('evidencias')
    .upload(filePath, payload.file);

  if (uploadError) {
    throw new Error(`Error al subir archivo a Supabase Storage: ${uploadError.message}`);
  }

  // 2. Registrar el metadato en la API
  const res = await apiClient.post<any>(`/calls/${payload.convocatoriaId}/evidence`, {
    id_convocatoria: parseInt(payload.convocatoriaId),
    tipo_evidencia: payload.descripcion || 'Sin descripción',
    nombre_archivo: payload.file.name,
    url_archivo: filePath
  });

  return {
    id: String(res.id_evidencia),
    fileName: res.nombre_archivo,
    descripcion: payload.descripcion,
    fechaCarga: res.fecha_carga,
    cargadoPor: 'Usuario Actual',
    urlArchivo: filePath,
  };
}

export { EVIDENCIA_MAX_SIZE_MB, EVIDENCIA_ALLOWED_EXTS };
