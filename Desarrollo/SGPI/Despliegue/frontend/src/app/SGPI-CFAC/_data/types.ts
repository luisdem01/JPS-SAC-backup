/**
 * @file _data/types.ts
 * @description Tipos TypeScript del módulo de Alertas de Convocatorias (SGPI-CFAC).
 *
 * Endpoint: GET /api/v1/convocatorias
 * Endpoint detalle: GET /api/v1/convocatorias/{id}
 * Endpoint evidencia: POST /api/v1/convocatorias/{id}/evidencias
 */

// ─────────────────────────────────────────────────────────────────────────────
// Enumeraciones
// ─────────────────────────────────────────────────────────────────────────────

export type EstadoConvocatoria =
  | 'Abierta'
  | 'Por Vencer'
  | 'Cerrada'
  | 'Suspendida';

/** Nivel de urgencia calculado en base a días restantes */
export type NivelAlerta = 'verde' | 'amarillo' | 'rojo';

// ─────────────────────────────────────────────────────────────────────────────
// Entidades
// ─────────────────────────────────────────────────────────────────────────────

export interface Evidencia {
  id:          string;
  fileName:    string;
  descripcion: string;
  fechaCarga:  string;   // ISO date
  cargadoPor:  string;
}

export interface Convocatoria {
  id:                    string;
  nombre:                string;
  entidad:               string;
  programa?:             string;
  estado:                EstadoConvocatoria;
  apertura?:             string;            // ISO date — fecha de apertura
  fechaCierre:           string;            // ISO date — fecha de cierre actual
  cierreOriginal?:       string;            // ISO date — fecha de cierre ANTES de la modificación
  fuente:                string;
  ultimaSync:            string;
  descripcion?:          string;
  cronogramaModificado?: boolean;
  evidencias:            Evidencia[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Filtros
// ─────────────────────────────────────────────────────────────────────────────

export interface AlertaFiltros {
  buscar: string;
  estado: EstadoConvocatoria | 'Todos';
  orden:  'porDefecto' | 'fechaCierre' | 'nombre' | 'alerta';
}

// ─────────────────────────────────────────────────────────────────────────────
// Payload para cargar evidencia
// ─────────────────────────────────────────────────────────────────────────────

export interface EvidenciaPayload {
  convocatoriaId: string;
  file:           File;
  descripcion:    string;
}
