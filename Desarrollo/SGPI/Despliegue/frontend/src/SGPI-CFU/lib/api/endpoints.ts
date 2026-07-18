/**
 * @file endpoints.ts
 * @description Funciones tipadas para cada endpoint de la API del SGPI.
 * Encapsula las rutas y parámetros, devolviendo datos tipados directamente.
 *
 * Organización:
 * - auth:          Autenticación y sesión
 * - investigators: Investigadores y su historial
 * - projects:      Proyectos de investigación
 * - publications:  Publicaciones científicas
 * - calls:         Convocatorias del VRIP
 * - import:        Importación de Excel
 * - sync:          Sincronización ETL
 * - reports:       Generación y descarga de reportes
 * - users:         Gestión de usuarios (solo admin)
 * - logs:          Log de auditoría (solo admin)
 * - search:        Búsqueda global
 */

import { apiClient, HEAVY_TIMEOUT_MS, ApiClientError } from './client';
import { getAccessToken }              from '../auth/storage';
import { supabase }                    from '../supabase';
import { decodeJwt }                   from '../auth/jwt';
import { ROLE_MAP }                    from '../types';
import type {
  LoginCredentials, LoginResponse, RefreshResponse, AuthUser,
  PaginatedData, PaginationParams, SearchParams, SearchResult,
  ImportJobStatus, SyncJobStatus, ReportJobStatus, ReportFormat,
  JobStarted, SyncSource,
  User, Investigator, InvestigatorHistoryEntry,
  Project, Publication, Call,
} from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────────────────────

export const authEndpoints = {
  /**
   * Inicia sesión y devuelve tokens JWT + información del usuario.
   * POST /api/v1/auth/login
   */
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });

    if (error) {
      throw new Error(
        error.message?.toLowerCase().includes('invalid login')
          ? 'Credenciales incorrectas. Verifica tu email y contraseña.'
          : error.message
      );
    }

    if (!data.session || !data.user) {
      throw new Error('No se pudo establecer la sesión.');
    }

    // Obtener rol y estado de la tabla pública usuario
    const { data: perfil, error: perfilError } = await supabase
      .from('usuario')
      .select('rol_sistema, estado_cuenta')
      .eq('id_usuario', data.user.id)
      .maybeSingle();

    if (perfilError) {
      throw new Error('Error al cargar el perfil del usuario.');
    }

    const rolSistema = perfil?.rol_sistema ?? 'Consulta';
    const isActive = perfil?.estado_cuenta ?? true;

    // Normalizar el rol para el frontend
    const normalizedRole = ROLE_MAP[rolSistema] ?? 'readonly';

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresIn: data.session.expires_in,
      user: {
        id: data.user.id,
        email: data.user.email ?? credentials.email,
        name: data.user.email?.split('@')[0] ?? 'Usuario',
        role: normalizedRole,
        isActive: isActive,
        lastLogin: new Date().toISOString()
      }
    };
  },

  /**
   * Cierra la sesión en el servidor.
   * POST /api/v1/auth/logout
   */
  async logout(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
  },

  /**
   * Renueva el token de acceso usando el refreshToken.
   * POST /api/v1/auth/refresh
   */
  async refresh(refreshToken: string): Promise<RefreshResponse> {
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken
    });

    if (error || !data.session) {
      throw new Error(error?.message || 'No se pudo renovar la sesión.');
    }

    return {
      accessToken: data.session.access_token,
      expiresIn: data.session.expires_in
    };
  },

  /**
   * Obtiene el perfil completo del usuario autenticado.
   * GET /api/v1/auth/me
   */
  async me(): Promise<AuthUser> {
    const token = getAccessToken();
    if (!token) throw new Error('No se encontró el token de acceso.');

    const payload = decodeJwt(token);
    const userId = payload?.sub;
    if (!userId) throw new Error('Token de acceso inválido.');

    // Obtener los detalles del usuario desde el backend /users/{userId}
    const user = await apiClient.get<any>(`/users/${userId}`);
    const normalizedRole = ROLE_MAP[user.rol_sistema] ?? 'readonly';

    return {
      id: user.id_usuario,
      email: user.correo_institucional,
      name: user.correo_institucional.split('@')[0],
      role: normalizedRole,
      isActive: user.estado_cuenta,
      lastLogin: new Date().toISOString()
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// INVESTIGADORES
// ─────────────────────────────────────────────────────────────────────────────

export const investigatorsEndpoints = {
  /**
   * Obtiene la lista paginada de investigadores.
   * GET /api/v1/investigators
   */
  list(params?: PaginationParams): Promise<PaginatedData<Investigator>> {
    const query = buildQuery(params);
    return apiClient.get<PaginatedData<Investigator>>(`/investigators${query}`);
  },

  /**
   * Obtiene el detalle de un investigador por su DNI.
   * GET /api/v1/investigators/{id}
   */
  getById(id: string): Promise<Investigator> {
    return apiClient.get<Investigator>(`/investigators/${id}`);
  },

  /**
   * Actualiza los datos de un investigador.
   * PUT /api/v1/investigators/{id}
   */
  update(id: string, data: Partial<Investigator>): Promise<Investigator> {
    return apiClient.put<Investigator>(`/investigators/${id}`, data);
  },

  /**
   * Obtiene el historial cronológico de puntajes RAIS de un investigador.
   * GET /api/v1/investigators/{id}/history
   */
  getHistory(id: string): Promise<InvestigatorHistoryEntry[]> {
    return apiClient.get<InvestigatorHistoryEntry[]>(`/investigators/${id}/history`);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// PROYECTOS
// ─────────────────────────────────────────────────────────────────────────────

/** Filtros disponibles para la lista de proyectos */
export interface ProjectFilters extends PaginationParams {
  /** Filtrar por estado del proyecto */
  status?: Project['status'];
  /** Filtrar por año de convocatoria */
  year?:   number;
  /** Filtrar por grupo de investigación */
  groupId?: string;
}

export const projectsEndpoints = {
  /**
   * Obtiene la lista paginada de proyectos con filtros opcionales.
   * GET /api/v1/projects
   */
  list(params?: ProjectFilters): Promise<PaginatedData<Project>> {
    const query = buildQuery(params);
    return apiClient.get<PaginatedData<Project>>(`/projects${query}`);
  },

  /**
   * Obtiene el detalle de un proyecto por su código.
   * GET /api/v1/projects/{id}
   */
  getById(id: string): Promise<Project> {
    return apiClient.get<Project>(`/projects/${id}`);
  },

  /**
   * Actualiza los datos de un proyecto.
   * PUT /api/v1/projects/{id}
   */
  update(id: string, data: Partial<Project>): Promise<Project> {
    return apiClient.put<Project>(`/projects/${id}`, data);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLICACIONES Y TESIS
// ─────────────────────────────────────────────────────────────────────────────

/** Acción de validación sobre una publicación */
export type PublicationAction = 'approve' | 'reject';

export const publicationsEndpoints = {
  /**
   * Obtiene la lista paginada de publicaciones.
   * GET /api/v1/publications
   */
  list(params?: PaginationParams): Promise<PaginatedData<Publication>> {
    const query = buildQuery(params);
    return apiClient.get<PaginatedData<Publication>>(`/publications${query}`);
  },

  /**
   * Aprueba o descarta una publicación.
   * PUT /api/v1/publications/{id}
   */
  validate(
    id:     number,
    action: PublicationAction
  ): Promise<Publication> {
    return apiClient.put<Publication>(`/publications/${id}`, { action });
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// CONVOCATORIAS
// ─────────────────────────────────────────────────────────────────────────────

/** Filtros para la lista de convocatorias */
export interface CallFilters extends PaginationParams {
  /** Filtrar por estado de la convocatoria */
  status?: Call['status'];
}

export const callsEndpoints = {
  /**
   * Obtiene la lista paginada de convocatorias con filtros por estado.
   * GET /api/v1/calls
   */
  list(params?: CallFilters): Promise<PaginatedData<Call>> {
    const query = buildQuery(params);
    return apiClient.get<PaginatedData<Call>>(`/calls${query}`);
  },

  /**
   * Adjunta un documento de evidencia a una convocatoria.
   * POST /api/v1/calls/{id}/evidence
   *
   * @param id       - ID de la convocatoria
   * @param file     - Archivo PDF a adjuntar (máximo 50MB)
   * @param metadata - Tipo y descripción de la evidencia
   */
  attachEvidence(
    id:       number,
    file:     File,
    metadata: { type: string; description?: string }
  ): Promise<{ url: string }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type',        metadata.type);
    formData.append('description', metadata.description ?? '');

    return apiClient.upload<{ url: string }>(
      `/calls/${id}/evidence`,
      formData,
      { timeout: HEAVY_TIMEOUT_MS }
    );
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTACIÓN EXCEL
// ─────────────────────────────────────────────────────────────────────────────

export const importEndpoints = {
  /**
   * Sube un archivo Excel para importación masiva de datos.
   * POST /api/v1/import/excel
   * Devuelve un job_id para consultar el progreso.
   *
   * @param file - Archivo .xlsx o .xls (máximo 10MB)
   */
  uploadExcel(file: File): Promise<JobStarted> {
    const formData = new FormData();
    formData.append('file', file);

    return apiClient.upload<JobStarted>('/import/excel', formData, {
      timeout: HEAVY_TIMEOUT_MS,
    });
  },

  /**
   * Consulta el estado de un job de importación.
   * GET /api/v1/import/{job_id}/status
   */
  getStatus(jobId: string): Promise<ImportJobStatus> {
    return apiClient.get<ImportJobStatus>(`/import/${jobId}/status`, { skipCache: true });
  },

  /**
   * Detiene una importación en curso.
   * POST /api/v1/import/{job_id}/stop
   */
  stopJob(jobId: string): Promise<{ success: boolean; message: string }> {
    return apiClient.post<{ success: boolean; message: string }>(`/import/${jobId}/stop`);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// SINCRONIZACIÓN ETL
// ─────────────────────────────────────────────────────────────────────────────

export const syncEndpoints = {
  /**
   * Inicia una sincronización ETL con fuentes externas.
   * POST /api/v1/sync/run
   *
   * @param source - Fuente a sincronizar (RENACYT, VRIP, CYBERTESIS, ALL)
   */
  run(source: SyncSource): Promise<JobStarted> {
    return apiClient.post<JobStarted>('/sync/run', { source }, {
      timeout: HEAVY_TIMEOUT_MS,
    });
  },

  /**
   * Consulta el estado de un job de sincronización ETL.
   * GET /api/v1/sync/{job_id}/status
   */
  getStatus(jobId: string): Promise<SyncJobStatus> {
    return apiClient.get<SyncJobStatus>(`/sync/${jobId}/status`, { skipCache: true });
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// REPORTES
// ─────────────────────────────────────────────────────────────────────────────

/** Parámetros para la generación de un reporte */
export interface ReportParams {
  /** Tipo de reporte (ej: "proyectos_activos", "carga_no_lectiva") */
  type:      string;
  /** Período de corte (ej: "Abril 2026") */
  period?:   string;
  /** Filtros adicionales según el tipo de reporte */
  filters?:  Record<string, unknown>;
}

export const reportsEndpoints = {
  /**
   * Inicia la generación de un reporte (operación asíncrona).
   * POST /api/v1/reports/generate
   */
  generate(params: ReportParams): Promise<JobStarted> {
    return apiClient.post<JobStarted>('/reports/generate', params, {
      timeout: HEAVY_TIMEOUT_MS,
    });
  },

  /**
   * Consulta el estado de un job de generación de reporte.
   * GET /api/v1/reports/{job_id}/status
   */
  getStatus(jobId: string): Promise<ReportJobStatus> {
    return apiClient.get<ReportJobStatus>(`/reports/${jobId}/status`, { skipCache: true });
  },

  /**
   * Descarga un reporte generado en el formato especificado.
   * GET /api/v1/reports/{id}/download?format=xlsx|pdf
   *
   * @param reportId - ID del reporte generado
   * @param format   - Formato de descarga ('xlsx' o 'pdf')
   * @returns Blob del archivo descargado
   */
  async download(reportId: string, format: ReportFormat): Promise<Blob> {
    // Construir la URL manualmente para evitar el wrapper JSON del apiClient
    // (la descarga devuelve bytes, no { success, data })
    const baseUrl = (typeof window !== 'undefined'
      ? window.location.origin
      : 'http://localhost:3000');
    // En Next.js, NEXT_PUBLIC_* está disponible en el cliente via webpack define
    const apiBase = (process.env['NEXT_PUBLIC_API_URL'] as string | undefined) ?? baseUrl;
    const url     = `${apiBase}/api/v1/reports/${reportId}/download?format=${format}`;
    const token   = getAccessToken();

    const response = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!response.ok) {
      throw new Error('No se pudo descargar el reporte. Intente nuevamente.');
    }

    return response.blob();
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// USUARIOS (solo Administrador)
// ─────────────────────────────────────────────────────────────────────────────

/** Datos para crear un nuevo usuario */
export interface CreateUserPayload {
  email:    string;
  name:     string;
  role:     User['role'];
  password: string;
}

export const usersEndpoints = {
  /**
   * Obtiene la lista de todos los usuarios del sistema.
   * GET /api/v1/users
   */
  list(params?: PaginationParams): Promise<PaginatedData<User>> {
    const query = buildQuery(params);
    return apiClient.get<PaginatedData<User>>(`/users${query}`);
  },

  /**
   * Crea un nuevo usuario en el sistema.
   * POST /api/v1/users
   */
  create(data: CreateUserPayload): Promise<User> {
    return apiClient.post<User>('/users', data);
  },

  /**
   * Actualiza los datos de un usuario existente.
   * PUT /api/v1/users/{id}
   */
  update(id: string, data: Partial<User>): Promise<User> {
    return apiClient.put<User>(`/users/${id}`, data);
  },

  /**
   * Desactiva la cuenta de un usuario (no la elimina).
   * PUT /api/v1/users/{id}/deactivate
   */
  deactivate(id: string): Promise<User> {
    return apiClient.put<User>(`/users/${id}/deactivate`);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// LOGS DE AUDITORÍA (solo Administrador)
// ─────────────────────────────────────────────────────────────────────────────

/** Filtros para el log de auditoría */
export interface LogFilters extends PaginationParams {
  /** Filtrar por tipo de evento */
  eventType?: string;
  /** Filtrar por ID de usuario */
  userId?:    string;
  /** Fecha de inicio del rango (ISO 8601) */
  from?:      string;
  /** Fecha de fin del rango (ISO 8601) */
  to?:        string;
}

export const logsEndpoints = {
  /**
   * Obtiene la lista paginada del log de auditoría con filtros opcionales.
   * GET /api/v1/logs
   */
  list(params?: LogFilters): Promise<PaginatedData<unknown>> {
    const query = buildQuery(params);
    return apiClient.get<PaginatedData<unknown>>(`/logs${query}`);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// BÚSQUEDA GLOBAL
// ─────────────────────────────────────────────────────────────────────────────

export const searchEndpoints = {
  /**
   * Realiza una búsqueda global en el sistema.
   * GET /api/v1/search?q=&type=&page=&limit=
   */
  search(params: SearchParams): Promise<PaginatedData<SearchResult>> {
    const query = buildQuery(params as Record<string, any>);
    return apiClient.get<PaginatedData<SearchResult>>(`/search${query}`);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper interno: construir query string
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convierte un objeto de parámetros en un query string URL.
 * Ignora los valores undefined y null.
 *
 * @param params - Objeto con los parámetros de la query
 * @returns Query string con el prefijo "?" o "" si está vacío
 */
function buildQuery(params?: Record<string, any> | undefined): string {
  if (!params) return '';

  const entries = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '');

  if (entries.length === 0) return '';

  const qs = entries
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');

  return `?${qs}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Exportación agrupada de todos los endpoints
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Objeto centralizado con todos los endpoints de la API del SGPI.
 * Usar como `api.auth.login(...)`, `api.projects.list(...)`, etc.
 */
export const api = {
  auth:          authEndpoints,
  investigators: investigatorsEndpoints,
  projects:      projectsEndpoints,
  publications:  publicationsEndpoints,
  calls:         callsEndpoints,
  import:        importEndpoints,
  sync:          syncEndpoints,
  reports:       reportsEndpoints,
  users:         usersEndpoints,
  logs:          logsEndpoints,
  search:        searchEndpoints,
} as const;
