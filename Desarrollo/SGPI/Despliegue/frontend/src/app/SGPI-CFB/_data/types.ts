/**
 * @file _data/types.ts
 * @description Tipos TypeScript del módulo de Búsqueda Global (SGPI-CFB).
 * Reemplazar los mocks de service.ts con llamadas reales cuando el backend esté disponible.
 *
 * Endpoint principal: GET /api/v1/search?q=&types=&sources=&anioDesde=&anioHasta=&grupo=&page=&limit=
 */

// ─────────────────────────────────────────────────────────────────────────────
// Enumeraciones y uniones
// ─────────────────────────────────────────────────────────────────────────────

export type RecordType = 'proyecto' | 'investigador' | 'publicacion';

export type EstadoProyecto =
  | 'En Ejecución'
  | 'En Evaluación'
  | 'Concluido'
  | 'Suspendido';

export type FuenteDatos = 'RAIS' | 'RENACYT' | 'CyberTesis';

// ─────────────────────────────────────────────────────────────────────────────
// Entidades de búsqueda
// ─────────────────────────────────────────────────────────────────────────────

export interface SearchProject {
  id:            string;
  codigo:        string;
  titulo:        string;
  tipo:          string;            // e.g. "Investigación Aplicada"
  convocatoria:  string;            // e.g. "VRIP 2026"
  estado:        EstadoProyecto;
  resumen:       string;
  monto:         number;
  respaldoLegal: string;
  inicio:        string;            // ISO date "YYYY-MM-DD"
  fin:           string;
  responsable:   { nombre: string; initials: string };
  grupo:         string;
  fuente:        FuenteDatos[];
  ultimaSync:    string;            // formatted display string
  anio:          number;
}

export interface SearchInvestigador {
  id:                  string;
  nombre:              string;
  cargo:               string;
  especialidad:        string;
  nivel:               string;      // RENACYT level: "I"–"VII" | "No Clasificado"
  dni:                 string;
  fuente:              FuenteDatos[];
  grupo:               string;
  ultimaSync:          string;
  proyectosCount:      number;
  publicacionesCount:  number;
  email?:              string;
  facultad?:           string;
  codigoRenacyt?:      string;
}

export interface SearchPublicacion {
  id:        string;
  titulo:    string;
  autores:   string[];
  revista:   string;
  anio:      number;
  doi?:      string;
  fuente:    FuenteDatos;
  quartil?:  string;               // "Q1" | "Q2" | "Q3" | "Q4"
  ultimaAct: string;
  tipo:      string;               // "Artículo ISI" | "Tesis Doctoral" | "Artículo Scopus"
  resumen?:  string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Resultado unificado
// ─────────────────────────────────────────────────────────────────────────────

export type SearchResult =
  | { type: 'proyecto';     data: SearchProject }
  | { type: 'investigador'; data: SearchInvestigador }
  | { type: 'publicacion';  data: SearchPublicacion };

// ─────────────────────────────────────────────────────────────────────────────
// Filtros de búsqueda
// ─────────────────────────────────────────────────────────────────────────────

export interface SearchFilters {
  query:      string;
  categories: RecordType[];
  sources:    FuenteDatos[];
  anioDesde:  number;
  anioHasta:  number;
  grupo:      string;             // "" = todos
  sortBy:     'relevancia' | 'fecha' | 'titulo';
  page:       number;
  perPage:    number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Respuesta paginada
// ─────────────────────────────────────────────────────────────────────────────

export interface SearchResponse {
  results:    SearchResult[];
  total:      number;
  totalPages: number;
  page:       number;
  counts: {
    proyecto:     number;
    investigador: number;
    publicacion:  number;
  };
}
