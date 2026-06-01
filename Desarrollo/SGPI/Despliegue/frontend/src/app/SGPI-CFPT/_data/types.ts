/**
 * @file _data/types.ts
 * @description Tipos TypeScript del módulo de Publicaciones y Tesis (SGPI-CFPT).
 *
 * Endpoints futuros:
 *   GET  /api/v1/publicaciones                        → lista paginada con filtros
 *   GET  /api/v1/publicaciones/{id}                   → detalle
 *   POST /api/v1/publicaciones/{id}/confirmar         → confirmar y persistir
 *   PUT  /api/v1/publicaciones/{id}/vincular          → vincular a docente (EX1)
 *   GET  /api/v1/publicaciones/validar-doi?doi=...    → validación de duplicado (EX2)
 *   GET  /api/v1/investigadores?q=...                 → buscador para EX1
 */

// ─────────────────────────────────────────────────────────────────────────────
// Enumeraciones
// ─────────────────────────────────────────────────────────────────────────────

/** Tipo de producción académica */
export type TipoProduccion =
  | 'articulo'   // Artículos indexados (Scopus / WoS)
  | 'tesis';     // Tesis académicas (Cybertesis / repositorio)

/** Fuente de importación del registro */
export type FuenteOrigen =
  | 'SCOPUS'
  | 'WOS'
  | 'CYBERTESIS'
  | 'MANUAL';

/** Estado del ciclo de validación */
export type EstadoValidacion =
  | 'pendiente'   // Importado, aguardando confirmación
  | 'validado'    // Confirmado y persistido
  | 'rechazado';  // Descartado manualmente

/** Cuartil de indexación de revistas */
export type Cuartil = 'Q1' | 'Q2' | 'Q3' | 'Q4' | null;

/** Rol del investigador dentro de la publicación o tesis */
export type RolPublicacion =
  | 'Autor Principal'
  | 'Coautor'
  | 'Asesor'
  | 'Coasesor'
  | 'Colaborador';

// ─────────────────────────────────────────────────────────────────────────────
// Investigador/Docente (para vincular)
// ─────────────────────────────────────────────────────────────────────────────

export interface InvestigadorResumen {
  id:           string;
  nombre:       string;
  dni:          string;
  departamento: string;
  grupo?:       string;   // Grupo de investigación al que pertenece
}

export interface InvestigadorVinculado {
  investigador: InvestigadorResumen;
  rol:          RolPublicacion;
}

export interface GrupoInvestigacionResumen {
  id:       number;
  nombre:   string;
  siglas?:  string;
  facultad?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Registro de producción (unifica artículo y tesis)
// ─────────────────────────────────────────────────────────────────────────────

export interface RegistroProduccion {
  id:                      string;
  tipo:                    TipoProduccion;
  titulo:                  string;
  autores:                 string;        // "R. Perez, J. Doe" — texto libre del import
  fecha:                   string;        // "YYYY-MM-DD"
  fuente:                  FuenteOrigen;
  estado:                  EstadoValidacion;

  // Metadatos de artículos (opcionales para tesis)
  revista?:                string;
  issn?:                   string;
  volNum?:                 string;        // "Vol 12, N° 4"
  doi?:                    string;
  cuartil?:                Cuartil;

  // Metadatos de tesis (opcionales para artículos)
  tesista?:                string;
  asesorSugerido?:         InvestigadorResumen;
  tipoTesis?:              'Pregrado' | 'Maestría' | 'Doctorado';
  urlCybertesis?:          string;

  // Investigadores vinculados (con rol)
  investigadoresVinculados: InvestigadorVinculado[];

  // Grupo vinculado (para articulos)
  grupoVinculado?:         GrupoInvestigacionResumen;

  // Metadatos comunes de auditoría
  importadoEn?:            string;        // ISO datetime
  confirmadoPor?:          string;
  confirmadoEn?:           string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Filtros de búsqueda
// ─────────────────────────────────────────────────────────────────────────────

export interface FiltrosProduccion {
  buscar:       string;
  tipo:         TipoProduccion | 'todos';
  estado:       EstadoValidacion | 'todos';
  indexacion:   FuenteOrigen | 'todas';
}

// ─────────────────────────────────────────────────────────────────────────────
// Payload de confirmación
// ─────────────────────────────────────────────────────────────────────────────

export interface ConfirmarPayload {
  id:                      string;
  tipo:                    TipoProduccion;
  doi?:                    string;
  issn?:                   string;
  volNum?:                 string;
  revista?:                string;
  cuartil?:                Cuartil;
  id_grupo?:               number;
  investigadoresVinculados: { investigadorId: string; rol: RolPublicacion }[];
}
