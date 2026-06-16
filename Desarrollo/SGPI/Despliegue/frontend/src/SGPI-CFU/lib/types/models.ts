/**
 * @file models.ts
 * @description Modelos de dominio del SGPI para el frontend.
 * Mapeados desde el esquema PostgreSQL/Supabase del backend.
 * Coinciden con las entidades devueltas por la API REST.
 */

import type { UserRole } from './auth';
import type { SyncSource, JobStatus } from './api';

// ─────────────────────────────────────────────────────────────────────────────
// Usuario del sistema
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Usuario del sistema SGPI.
 * Corresponde a la tabla `usuario` en Supabase.
 */
export interface User {
  /** UUID del usuario (id_usuario en BD) */
  id:        string;
  /** Correo institucional (@unmsm.edu.pe) */
  email:     string;
  /** Nombre completo */
  name:      string;
  /** Rol del sistema */
  role:      UserRole;
  /** Si la cuenta está activa (estado_cuenta en BD) */
  isActive:  boolean;
  /** Fecha y hora del último inicio de sesión (ISO 8601) */
  lastLogin: string;
  /** Fecha de creación de la cuenta */
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Investigador
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Nivel de confianza del match automático entre fuentes de datos.
 * - high:   Match automático con alta confianza (DNI o ORCID coincide)
 * - medium: Match con confianza media (nombre similar, verificar manualmente)
 * - manual: Registrado manualmente por la secretaria
 */
export type MatchConfidence = 'high' | 'medium' | 'manual';

/**
 * Investigador del sistema SGPI.
 * Corresponde a la tabla `investigador` en Supabase.
 */
export interface Investigator {
  /** DNI del investigador (PK en BD) */
  id:               string;
  /** DNI del investigador */
  dni:              string;
  /** Código ORCID (opcional) */
  orcid?:           string;
  /** Código RENACYT (opcional, ej: "P0012345") */
  renacytCode?:     string;
  /** Nombre completo (nombres + apellidos) */
  name:             string;
  /** Correo del investigador */
  email:            string;
  /** Departamento académico */
  department:       string;
  /** Facultad o dependencia */
  faculty:          string;
  /** Grado académico máximo */
  academicDegree?:  string;
  /** Categoría RENACYT (ej: "I", "II", "No Clasificado") */
  renacytCategory?: string;
  /** Estado en RENACYT */
  renacytStatus?:   string;
  /** Si es investigador categoría SM del VRIP */
  isSM:             boolean;
  /** Si está activo en el sistema */
  isActive:         boolean;
  /** Si tiene deuda en grupos de investigación */
  hasDebtGI:        boolean;
  /** Si tiene deuda en proyectos de investigación */
  hasDebtPI:        boolean;
  /** Nivel de confianza del match entre fuentes */
  matchConfidence:  MatchConfidence;
  /** URL del perfil CTI Vitae */
  ctiVitaeUrl?:     string;
  /** Fecha de creación del registro */
  createdAt:        string;
  /** Fecha de última actualización */
  updatedAt:        string;
}

/**
 * Historial cronológico de un investigador (puntajes RAIS por año).
 */
export interface InvestigatorHistoryEntry {
  /** Año de la evaluación */
  year:             number;
  /** Puntaje total acumulado */
  totalScore:       number;
  /** Puntaje por publicaciones en revistas */
  journalScore:     number;
  /** Puntaje por libros */
  bookScore:        number;
  /** Puntaje por proyectos */
  projectScore:     number;
  /** Puntaje por patentes */
  patentScore:      number;
  /** Puntaje por tesis asesoradas */
  thesisScore:      number;
  /** Puntaje por otros méritos */
  otherScore:       number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Proyecto de investigación
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Estados posibles de un proyecto de investigación.
 * Coinciden con el CHECK en la tabla `proyecto` de la BD.
 */
export type ProjectStatus =
  | 'pending'    // Formulación
  | 'active'     // En ejecución (o Aprobado)
  | 'completed'  // Concluido
  | 'cancelled'; // Cancelado

/**
 * Tipos de proyecto financiado por el VRIP.
 */
export type ProjectType = 'Básico' | 'Aplicado' | 'Tesis';

/**
 * Proyecto de investigación financiado.
 * Corresponde a la tabla `proyecto` en Supabase.
 */
export interface Project {
  /** Código del proyecto (PK en BD, ej: "VRIP-2024-001") */
  id:               string;
  /** Código del proyecto */
  code:             string;
  /** Resolución de aprobación */
  resolutionNumber?:string;
  /** Título completo del proyecto */
  title:            string;
  /** Tipo de proyecto */
  type:             ProjectType;
  /** Estado actual del proyecto */
  status:           ProjectStatus;
  /** DNI del investigador responsable */
  responsibleId:    string;
  /** Nombre del investigador responsable */
  responsibleName?: string;
  /** Código del grupo de investigación */
  groupId:          string;
  /** Nombre del grupo de investigación */
  groupName?:       string;
  /** Fecha de inicio (ISO 8601) */
  startDate:        string;
  /** Fecha de fin prevista (ISO 8601) */
  endDate:          string;
  /** Presupuesto asignado en soles (PEN) */
  budget:           number;
  /** Año de la convocatoria */
  callYear?:        number;
  /** Área académica */
  academicArea?:    string;
  /** Fuentes de financiamiento (RAIS, RENACYT, VRIP, etc.) */
  sources:          string[];
  /** Fecha de creación del registro */
  createdAt:        string;
  /** Fecha de última actualización */
  updatedAt:        string;
}

/**
 * Entrada del historial de transición de estado de un proyecto.
 */
export interface ProjectStatusHistory {
  /** Estado anterior al cambio */
  previousStatus: string;
  /** Estado nuevo tras el cambio */
  newStatus:      string;
  /** Justificación del cambio */
  justification:  string;
  /** Nombre del responsable del cambio */
  changedBy:      string;
  /** Fecha y hora del cambio */
  changedAt:      string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Publicación científica
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Estado de validación de una publicación.
 */
export type PublicationStatus = 'pending' | 'approved' | 'rejected';

/**
 * Publicación científica del catálogo SGPI.
 * Corresponde a la tabla `publicacion` en Supabase.
 */
export interface Publication {
  /** ID de la publicación (id_publicacion en BD) */
  id:              number;
  /** DOI o código único (puede ser null para revistas sin DOI) */
  doi?:            string;
  /** Título del artículo */
  title:           string;
  /** ISSN de la revista */
  issn?:           string;
  /** Tipo (Artículo, Capítulo de libro, Ponencia) */
  type:            string;
  /** Nombre de la revista */
  journalName?:    string;
  /** Cuartil de impacto (Q1, Q2, Q3, Q4) */
  quartile?:       string;
  /** Indexación (Scopus, Web of Science, SciELO) */
  indexation?:     string;
  /** Fecha de publicación (ISO 8601) */
  publishedDate?:  string;
  /** URL del documento */
  url?:            string;
  /** Estado de validación en el sistema */
  status:          PublicationStatus;
  /** Fecha de creación del registro */
  createdAt:       string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tesis (Cybertesis)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tesis registrada en Cybertesis UNMSM.
 * Corresponde a la tabla `tesis` en Supabase.
 */
export interface Thesis {
  /** URL canónica de Cybertesis (PK en BD) */
  id:              string;
  /** Título de la tesis */
  title:           string;
  /** Resumen/abstract */
  abstract?:       string;
  /** Año de publicación */
  year?:           number;
  /** Nombre del estudiante autor */
  student:         string;
  /** DNI del asesor */
  advisorDni?:     string;
  /** Nombre del asesor */
  advisorName:     string;
  /** Nivel de grado (Bachiller, Maestría, Doctorado) */
  degree?:         string;
  /** Escuela profesional */
  school?:         string;
  /** Palabras clave */
  keywords?:       string[];
  /** Fecha de creación del registro */
  createdAt:       string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Convocatoria
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Estados de una convocatoria.
 * Basado en el campo estado_convocatoria de la BD y la vista vista_convocatoria.
 */
export type CallStatus = 'active' | 'closing' | 'closed';

/**
 * Nivel de urgencia calculado por la BD (vista_convocatoria).
 * - green:  Más de 21 días para el cierre
 * - yellow: Entre 8 y 21 días para el cierre
 * - red:    7 días o menos para el cierre
 */
export type CallUrgency = 'green' | 'yellow' | 'red';

/**
 * Convocatoria del VRIP.
 * Combina la tabla `convocatoria` con la vista `vista_convocatoria`.
 */
export interface Call {
  /** ID de la convocatoria (id_convocatoria en BD) */
  id:             number;
  /** Nombre/título de la convocatoria */
  name:           string;
  /** Resolución base de la convocatoria */
  resolution?:    string;
  /** Entidad emisora (por defecto: "VRIP-UNMSM") */
  entity:         string;
  /** Estado actual */
  status:         CallStatus;
  /** Fecha de apertura (ISO 8601) */
  openDate:       string;
  /** Fecha de cierre (ISO 8601) */
  closeDate:      string;
  /** Días restantes para el cierre (calculado por la BD) */
  daysRemaining:  number;
  /** Nivel de urgencia calculado */
  urgency:        CallUrgency;
  /** Presupuesto máximo disponible */
  maxBudget?:     number;
  /** URL de las bases en el VRIP */
  baseUrl?:       string;
  /** Fecha de creación del registro */
  createdAt:      string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Jobs asíncronos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Job de sincronización ETL con fuentes externas.
 * Agrupa los endpoints de sync e importación.
 */
export interface SyncJob {
  /** ID del job (job_id en la respuesta del backend) */
  jobId:       string;
  /** Estado actual del job */
  status:      JobStatus;
  /** Fuente de datos sincronizada */
  source:      SyncSource;
  /** Porcentaje de progreso (0-100) */
  progress:    number;
  /** Timestamp de inicio (ISO 8601) */
  startedAt:   string;
  /** Resumen disponible al completarse */
  summary?:    {
    /** Registros nuevos creados */
    created: number;
    /** Registros actualizados */
    updated: number;
    /** Errores de procesamiento */
    errors:  number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Grupo de investigación
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Grupo de investigación registrado en el VRIP.
 * Corresponde a la tabla `grupo_investigacion` en Supabase.
 */
export interface ResearchGroup {
  /** Código del grupo (PK en BD) */
  code:             string;
  /** Nombre completo del grupo */
  name:             string;
  /** Siglas del grupo */
  acronym?:         string;
  /** Descripción del grupo */
  description?:     string;
  /** DNI del coordinador */
  coordinatorDni?:  string;
  /** Nombre del coordinador */
  coordinatorName?: string;
  /** Líneas de investigación */
  researchLines?:   string[];
  /** Estado del grupo */
  status:           string;
  /** Fecha de reconocimiento oficial */
  recognitionDate?: string;
  /** Fecha de creación del registro */
  createdAt:        string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Log de auditoría
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tipos de eventos registrados en el log de auditoría.
 * Coinciden con el CHECK del campo tipo_evento en la BD.
 */
export type AuditEventType =
  | 'INSERT' | 'UPDATE' | 'DELETE'
  | 'LOGIN' | 'LOGOUT'
  | 'IMPORT_EXCEL'
  | 'SYNC_RENACYT' | 'SYNC_CYBERTESIS' | 'SYNC_VRIP'
  | 'EXPORT_REPORT' | 'SNAPSHOT_GENERADO'
  | 'CONFIG_CHANGE' | 'USER_CREATED' | 'USER_DEACTIVATED';

/**
 * Entrada del log de auditoría (append-only en BD).
 * Corresponde a la tabla `log_auditoria` en Supabase.
 */
export interface AuditLog {
  /** ID del log (UUID) */
  id:              string;
  /** Tipo de evento */
  eventType:       AuditEventType;
  /** Entidad afectada (nombre de la tabla o módulo) */
  entity:          string;
  /** PK del registro afectado */
  entityId?:       string;
  /** ID del usuario que realizó la acción */
  userId?:         string;
  /** Nombre del usuario */
  userName?:       string;
  /** IP de origen de la petición */
  ipAddress?:      string;
  /** Resultado de la operación */
  result:          'Exito' | 'Error';
  /** Detalle del error (solo cuando result = "Error") */
  errorDetail?:    string;
  /** Timestamp del evento (ISO 8601) */
  timestamp:       string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Resultado de búsqueda global
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ítem de resultado en la búsqueda global.
 */
export interface SearchResult {
  /** ID del ítem encontrado */
  id:      string;
  /** Tipo de entidad */
  type:    'investigators' | 'projects' | 'groups' | 'publications' | 'tesis';
  /** Título o nombre del ítem */
  title:   string;
  /** Descripción breve */
  excerpt: string;
  /** Relevancia del resultado (0-1) */
  score?:  number;
  /** Origen de datos (RENACYT, RAIS, etc.) */
  source?: string;
  /** Estado del ítem */
  status?: string;
  /** Fecha asociada */
  date?:   string;
  /** Detalles específicos de la entidad */
  details?: Record<string, any>;
}
