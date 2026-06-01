/**
 * @file _data/types.ts
 * @description Tipos TypeScript del módulo de Reportes (SGPI-CFR).
 *
 * Endpoints futuros:
 *   POST /api/v1/reportes/generar    → genera y devuelve ReporteResult
 *   GET  /api/v1/reportes/snapshots  → lista de snapshots guardados
 *   POST /api/v1/reportes/snapshots  → guarda un snapshot
 *   GET  /api/v1/reportes/export     → descarga PDF/Excel
 */

// ─────────────────────────────────────────────────────────────────────────────
// Enumeraciones
// ─────────────────────────────────────────────────────────────────────────────

export type TipoReporte =
  | 'actividades'          // Reporte de Actividades (Carga No Lectiva)
  | 'proyectosActivos'     // Proyectos Activos
  | 'produccionCientifica' // Producción Científica
  | 'baseDatosPOI';        // Base de Datos para POI

export type CortesPOI = 'abril' | 'agosto' | 'noviembre';

export type NivelDetalle = 'resumido' | 'detallado';

export type FormatoExport = 'pdf' | 'excel';

// ─────────────────────────────────────────────────────────────────────────────
// Parámetros del reporte
// ─────────────────────────────────────────────────────────────────────────────

export interface ReporteParams {
  tipo:                TipoReporte;
  anioFiscal:          number;
  corte:               CortesPOI;
  fechaInicio:         string;   // "YYYY-MM-DD"
  fechaFin:            string;
  departamentos:       string[]; // IDs/nombres seleccionados
  grupoInvestigacion:  string;   // "" = todos
  nivelDetalle:        NivelDetalle;
}

// ─────────────────────────────────────────────────────────────────────────────
// Resultado: registro por docente
// ─────────────────────────────────────────────────────────────────────────────

export interface RegistroDocente {
  id:            string;
  nombre:        string;
  dni:           string;
  departamento:  string;
  hrsProyectos:  number;
  hrsAsesorias:  number;
  totalCarga:    number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Resultado completo del reporte
// ─────────────────────────────────────────────────────────────────────────────

export interface ReporteResult {
  /** Metadatos del reporte (paso 9 del flujo) */
  titulo:                  string;
  subtitulo:               string;
  generadoPor:             string;
  fechaEmision:            string;   // ISO datetime
  params:                  ReporteParams;

  /** KPIs */
  totalDocentes:           number;
  proyectosActivos:        number;
  promedioCargaNoLectiva:  number;   // en horas
  totalPublicaciones?:     number;
  totalTesis?:             number;

  /** Datos tabulares */
  registros:               RegistroDocente[];
  totalRegistros:          number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pasos de la animación de carga
// ─────────────────────────────────────────────────────────────────────────────

export interface PasoCarga {
  progreso: number;   // 0-100
  mensaje:  string;
}
