/**
 * @file _data/service.ts
 * @description Capa de servicio del módulo de Búsqueda Global.
 *
 * Actualmente usa datos mock. Para conectar con el backend real:
 * 1. Reemplazar el bloque "// MOCK" con la llamada fetch real.
 * 2. Descomentar la URL del endpoint y los params.
 *
 * Endpoint real: GET /api/v1/search
 * Query params: q, types[], sources[], anioDesde, anioHasta, grupo, page, limit, sortBy
 */

import type { SearchFilters, SearchResponse, SearchResult } from './types';
import { ALL_RESULTS, MOCK_PROJECTS, MOCK_INVESTIGADORES, MOCK_PUBLICACIONES } from './mock';

// ─────────────────────────────────────────────────────────────────────────────
// Filtro local (mock)
// ─────────────────────────────────────────────────────────────────────────────

function matchesQuery(result: SearchResult, q: string): boolean {
  if (!q.trim()) return true;
  const term = q.toLowerCase();

  if (result.type === 'proyecto') {
    const d = result.data;
    return (
      d.titulo.toLowerCase().includes(term) ||
      d.codigo.toLowerCase().includes(term) ||
      d.resumen.toLowerCase().includes(term) ||
      d.grupo.toLowerCase().includes(term) ||
      d.responsable.nombre.toLowerCase().includes(term)
    );
  }
  if (result.type === 'investigador') {
    const d = result.data;
    return (
      d.nombre.toLowerCase().includes(term) ||
      d.especialidad.toLowerCase().includes(term) ||
      d.grupo.toLowerCase().includes(term) ||
      (d.codigoRenacyt?.toLowerCase().includes(term) ?? false)
    );
  }
  if (result.type === 'publicacion') {
    const d = result.data;
    return (
      d.titulo.toLowerCase().includes(term) ||
      d.autores.some((a) => a.toLowerCase().includes(term)) ||
      d.revista.toLowerCase().includes(term) ||
      (d.resumen?.toLowerCase().includes(term) ?? false)
    );
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Función principal de búsqueda
// ─────────────────────────────────────────────────────────────────────────────

export async function searchRecords(filters: SearchFilters): Promise<SearchResponse> {
  /* ── REAL API (descomentar cuando el backend esté disponible) ─────────────
  const params = new URLSearchParams({
    q:         filters.query,
    types:     filters.categories.join(','),
    sources:   filters.sources.join(','),
    anioDesde: String(filters.anioDesde),
    anioHasta: String(filters.anioHasta),
    grupo:     filters.grupo,
    sortBy:    filters.sortBy,
    page:      String(filters.page),
    limit:     String(filters.perPage),
  });
  const res  = await fetch(`/api/v1/search?${params}`);
  const json = await res.json();
  return json as SearchResponse;
  ─────────────────────────────────────────────────────────────────────────── */

  // MOCK ────────────────────────────────────────────────────────────────────
  await new Promise((r) => setTimeout(r, 350)); // simulación latencia

  let filtered = ALL_RESULTS.filter((r) => {
    // Filtro de categoría
    if (!filters.categories.includes(r.type)) return false;

    // Filtro de fuente de datos
    if (filters.sources.length > 0) {
      const fuente = r.type === 'proyecto'
        ? r.data.fuente
        : r.type === 'investigador'
          ? r.data.fuente
          : [r.data.fuente];
      if (!fuente.some((f) => filters.sources.includes(f as any))) return false;
    }

    // Filtro de año
    const anio = r.type === 'proyecto'
      ? r.data.anio
      : r.type === 'investigador'
        ? 2024 // investigators don't have a specific year
        : r.data.anio;
    if (anio < filters.anioDesde || anio > filters.anioHasta) return false;

    // Filtro de grupo
    if (filters.grupo && filters.grupo !== '') {
      const grupo = r.type === 'investigador' ? r.data.grupo : r.type === 'proyecto' ? r.data.grupo : '';
      if (grupo !== filters.grupo) return false;
    }

    // Filtro de texto
    if (!matchesQuery(r, filters.query)) return false;

    return true;
  });

  // Ordenar
  if (filters.sortBy === 'titulo') {
    filtered = filtered.sort((a, b) => {
      const ta = a.type === 'proyecto' ? a.data.titulo : a.type === 'investigador' ? a.data.nombre : a.data.titulo;
      const tb = b.type === 'proyecto' ? b.data.titulo : b.type === 'investigador' ? b.data.nombre : b.data.titulo;
      return ta.localeCompare(tb, 'es');
    });
  } else if (filters.sortBy === 'fecha') {
    filtered = filtered.sort((a, b) => {
      const ya = a.type === 'proyecto' ? a.data.anio : a.type === 'publicacion' ? a.data.anio : 2024;
      const yb = b.type === 'proyecto' ? b.data.anio : b.type === 'publicacion' ? b.data.anio : 2024;
      return yb - ya;
    });
  }

  const total = filtered.length;
  const counts = {
    proyecto:     filtered.filter((r) => r.type === 'proyecto').length,
    investigador: filtered.filter((r) => r.type === 'investigador').length,
    publicacion:  filtered.filter((r) => r.type === 'publicacion').length,
  };

  const start   = (filters.page - 1) * filters.perPage;
  const results = filtered.slice(start, start + filters.perPage);

  return {
    results,
    total,
    totalPages: Math.max(1, Math.ceil(total / filters.perPage)),
    page: filters.page,
    counts,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers: obtener un registro por tipo e ID
// ─────────────────────────────────────────────────────────────────────────────

export function getProjectById(id: string) {
  // TODO: GET /api/v1/projects/{id}
  return MOCK_PROJECTS.find((p) => p.id === id) ?? null;
}

export function getInvestigadorById(id: string) {
  // TODO: GET /api/v1/investigators/{id}
  return MOCK_INVESTIGADORES.find((i) => i.id === id) ?? null;
}

export function getPublicacionById(id: string) {
  // TODO: GET /api/v1/publications/{id}
  return MOCK_PUBLICACIONES.find((p) => p.id === id) ?? null;
}
