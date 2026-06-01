/**
 * @file _data/types.ts
 * @description Tipos TypeScript del módulo de Gestión de Docentes/Investigadores (SGPI-CFMH).
 *
 * Endpoints futuros:
 *   GET    /api/v1/docentes                   → listado paginado con filtros
 *   GET    /api/v1/docentes/{id}              → perfil completo
 *   POST   /api/v1/docentes                   → registrar nuevo
 *   PUT    /api/v1/docentes/{id}              → actualizar perfil
 *   DELETE /api/v1/docentes/{id}              → desactivar
 *   GET    /api/v1/docentes/validar-dni?dni=  → EX1: validar unicidad de DNI
 *   GET    /api/v1/docentes/stats             → KPIs del tablero
 *   GET    /api/v1/docentes/{id}/historial    → Línea de Tiempo de Proyectos
 *   GET    /api/v1/docentes/{id}/certificado  → Generar certificado PDF
 */

// ─────────────────────────────────────────────────────────────────────────────
// Enumeraciones
// ─────────────────────────────────────────────────────────────────────────────

export type EstadoVigencia = 'activo' | 'inactivo' | 'por_vencer';

export type NivelRenacyt =
  | 'NIVEL I'
  | 'NIVEL II'
  | 'NIVEL III'
  | 'NIVEL IV'
  | 'NIVEL V'
  | 'NIVEL VI'
  | 'NIVEL VII'
  | 'DISTINGUIDO'
  | 'Sin nivel';

export type CondicionSM = 'SM' | 'No SM';

// ─────────────────────────────────────────────────────────────────────────────
// Historial de producción (últimos 7 años)
// ─────────────────────────────────────────────────────────────────────────────

export interface PuntajeAnual {
  anio:        number;
  articulos:   number;  // cantidad de artículos ese año
  tesis:       number;  // tesis asesoradas
  proyectos:   number;  // proyectos activos
  puntaje:     number;  // puntaje total calculado
}

// ─────────────────────────────────────────────────────────────────────────────
// Perfil del Docente/Investigador
// ─────────────────────────────────────────────────────────────────────────────

export interface DocenteInvestigador {
  id:                    string;
  nombres:               string;
  apellidos:             string;
  dni:                   string;
  email:                 string;
  departamento:          string;
  nivelRenacyt:          NivelRenacyt;
  condicionSM:           CondicionSM;
  estado:                EstadoVigencia;
  fechaVigencia?:        string;   // "YYYY-MM-DD" — vencimiento de vigencia Renacyt
  codigoDocente?:        string;
  puntajeHistorico:      PuntajeAnual[];
  // Auditoría
  creadoEn?:             string;
  actualizadoEn?:        string;
  isExternal?:           boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Filtros para el listado
// ─────────────────────────────────────────────────────────────────────────────

export interface FiltrosDocentes {
  buscar:       string;
  departamento: string;   // "" = todos
  nivelRenacyt: string;   // "" = todos
  estado:       string;   // "" = todos
}

// ─────────────────────────────────────────────────────────────────────────────
// KPIs del tablero
// ─────────────────────────────────────────────────────────────────────────────

export interface StatsDocentes {
  totalDocentes:          number;
  deltaEsteMes:           number;
  investigadoresRenacyt:  number;
  porcentajeRenacyt:      number;
  vigenciasPorVencer:     number;
  proyectosActivos:       number;
  cicloAcademico:         string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Payload para crear / actualizar
// ─────────────────────────────────────────────────────────────────────────────

export interface DocentePayload {
  nombres:          string;
  apellidos:        string;
  dni:              string;
  email:            string;
  departamento:     string;
  nivelRenacyt:     NivelRenacyt;
  condicionSM:      CondicionSM;
  estado:           EstadoVigencia;
  fechaVigencia?:   string;
  codigoDocente?:   string;
  puntajeHistorico: PuntajeAnual[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Historial de Proyectos (Línea de Tiempo)
// ─────────────────────────────────────────────────────────────────────────────

export type EstadoProyecto =
  | 'en_ejecucion'
  | 'finalizado'
  | 'suspendido'
  | 'en_evaluacion';

export type RolProyecto =
  | 'Investigador Principal (IP)'
  | 'Co-Investigador'
  | 'Asesor'
  | 'Tesista'
  | 'Colaborador';

export interface ProyectoHistorial {
  id:                  string;
  codigo:              string;        // "PRJ-2023-684"
  titulo:              string;
  rol:                 RolProyecto;
  anioInicio:          number;
  anioFin?:            number;        // undefined = "Presente"
  presupuesto:         number;        // en soles
  entidadFinanciadora: string;
  estado:              EstadoProyecto;
}
