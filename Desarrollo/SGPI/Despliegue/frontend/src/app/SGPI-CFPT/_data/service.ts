/**
 * @file _data/service.ts
 * @description Capa de servicio del módulo de Publicaciones y Tesis (SGPI-CFPT).
 *
 * Para conectar al backend real:
 *   1. Descomentar los bloques REAL API.
 *   2. Comentar/eliminar los bloques MOCK.
 *
 * Endpoints documentados:
 *   GET  /api/v1/publicaciones                         → lista con filtros
 *   GET  /api/v1/publicaciones/{id}                    → detalle
 *   POST /api/v1/publicaciones/{id}/confirmar          → confirmar y persistir
 *   PUT  /api/v1/publicaciones/{id}/vincular           → vincular docente (EX1)
 *   GET  /api/v1/publicaciones/validar-doi?doi=...     → validación duplicado (EX2)
 *   GET  /api/v1/investigadores?q=...                  → búsqueda para vincular
 */

import type {
  RegistroProduccion, FiltrosProduccion, ConfirmarPayload, InvestigadorResumen, GrupoInvestigacionResumen
} from './types';
import { MOCK_PRODUCCIONES, MOCK_INVESTIGADORES } from './mock';
import { apiClient } from '@/SGPI-CFU/lib';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de formato
// ─────────────────────────────────────────────────────────────────────────────

export function formatFecha(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Obtener lista de producciones (con filtros)
// ─────────────────────────────────────────────────────────────────────────────

export async function getProducciones(filtros: FiltrosProduccion): Promise<RegistroProduccion[]> {
  const params = new URLSearchParams({
    buscar:     filtros.buscar,
    tipo:       filtros.tipo,
    estado:     filtros.estado,
    indexacion: filtros.indexacion,
  });
  return apiClient.get<RegistroProduccion[]>(`/cfpt/producciones?${params}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Obtener detalle
// ─────────────────────────────────────────────────────────────────────────────

export async function getProduccionById(id: string): Promise<RegistroProduccion | null> {
  return apiClient.get<RegistroProduccion>(`/cfpt/producciones/${id}`).catch(() => null);
}

// ─────────────────────────────────────────────────────────────────────────────
// Confirmar y persistir (pasos 7 y 10 del flujo)
// ─────────────────────────────────────────────────────────────────────────────

export async function confirmarProduccion(payload: ConfirmarPayload): Promise<RegistroProduccion> {
  return apiClient.post<RegistroProduccion>(`/cfpt/producciones/${payload.id}/confirmar`, payload);
}

// ─────────────────────────────────────────────────────────────────────────────
// Validar DOI duplicado (EX2)
// ─────────────────────────────────────────────────────────────────────────────

export async function validarDOI(doi: string): Promise<{ duplicado: boolean; existenteId?: string }> {
  return apiClient.get<{ duplicado: boolean; existenteId?: string }>(`/cfpt/validar-doi?doi=${encodeURIComponent(doi)}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Buscar investigadores para vincular (EX1)
// ─────────────────────────────────────────────────────────────────────────────

export async function buscarInvestigadores(q: string): Promise<InvestigadorResumen[]> {
  const data = await apiClient.get<any>(`/investigators?buscar=${encodeURIComponent(q)}`);
  // Ensure we map the response to the frontend's expected InvestigtorResumen format
  return data.items.map((i: any) => ({
    id: i.dni,
    nombre: `${i.nombres} ${i.apellidos}`,
    dni: i.dni,
    departamento: i.departamento_academico,
    esDocente: i.condicion_laboral == 'Docente',
    esInvestigador: i.investigador_sm
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Buscar grupos de investigación para vincular (Artículos)
// ─────────────────────────────────────────────────────────────────────────────

export async function buscarGrupos(q: string): Promise<GrupoInvestigacionResumen[]> {
  return apiClient.get<GrupoInvestigacionResumen[]>(`/cfpt/grupos-investigacion?query=${encodeURIComponent(q)}`);
}
