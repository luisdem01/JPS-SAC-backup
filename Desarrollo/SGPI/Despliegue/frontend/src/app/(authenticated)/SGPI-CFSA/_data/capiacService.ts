import { apiClient } from '@/SGPI-CFU/lib/api/client';
import { getAccessToken } from '@/SGPI-CFU/lib/auth/storage';

export interface LogEntry {
  id: string;
  fechaHora: string; // ISO 8601
  evento: string;
  usuario: string;
  estado: 'EXITO' | 'FALLO' | 'ADVERTENCIA';
  entidadAfectada?: string | null;
  pkEntidad?: string | null;
  valorAnterior?: any;
  valorNuevo?: any;
  ipOrigen?: string | null;
  detalleError?: string | null;
  detail: any;
}

export interface ConfiguracionResponse {
  clave: string;
  valor: any;
  descripcion: string | null;
  updated_at: string;
}

export interface GetLogsParams {
  tipo_evento?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  skip?: number;
  limit?: number;
}

export interface UsuarioResponse {
  id_usuario: string;
  correo_institucional: string;
  rol_sistema: string;
  estado_cuenta: boolean;
  nombre_completo: string;
  created_at: string;
}

export interface UsuarioCreate {
  correo_institucional: string;
  rol_sistema: string;
  estado_cuenta?: boolean;
  nombre_completo: string;
}

const getApiBaseUrl = (): string => {
  const envUrl = typeof process !== 'undefined' ? process.env['NEXT_PUBLIC_API_URL'] : undefined;
  return (envUrl as string | undefined) ?? 'http://localhost:3000';
};

export const capiacService = {
  // Configuración
  async getConfiguraciones(): Promise<ConfiguracionResponse[]> {
    return apiClient.get<ConfiguracionResponse[]>('/configuracion');
  },

  async updateConfiguracion(clave: string, valor: any, descripcion?: string): Promise<ConfiguracionResponse> {
    return apiClient.put<ConfiguracionResponse>(`/configuracion/${clave}`, { valor, descripcion });
  },

  // Logs
  async getLogsAuditoria(params?: GetLogsParams): Promise<LogEntry[]> {
    const queryParams: Record<string, string> = {};
    if (params?.tipo_evento) queryParams.tipo_evento = params.tipo_evento;
    if (params?.fecha_inicio) queryParams.fecha_inicio = params.fecha_inicio;
    if (params?.fecha_fin) queryParams.fecha_fin = params.fecha_fin;
    if (params?.skip !== undefined) queryParams.skip = params.skip.toString();
    if (params?.limit !== undefined) queryParams.limit = params.limit.toString();

    const qs = Object.entries(queryParams)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');

    const path = qs ? `/logs?${qs}` : '/logs';
    const data = await apiClient.get<any[]>(path);

    // Map backend model to frontend model
    return data.map((log: any): LogEntry => ({
      id: String(log.id_log),
      fechaHora: log.timestamp_evento,
      evento: log.tipo_evento,
      usuario: log.id_usuario || 'SISTEMA',
      estado: (log.resultado?.toUpperCase() === 'SUCCESS' || log.resultado?.toUpperCase() === 'EXITO') ? 'EXITO' 
            : (log.resultado?.toUpperCase() === 'WARNING' || log.resultado?.toUpperCase() === 'ADVERTENCIA') ? 'ADVERTENCIA' 
            : 'FALLO',
      entidadAfectada: log.entidad_afectada,
      pkEntidad: log.pk_entidad,
      valorAnterior: log.valor_anterior,
      valorNuevo: log.valor_nuevo,
      ipOrigen: log.ip_origen,
      detalleError: log.detalle_error,
      detail: {
        ...log,
        timestamp: log.timestamp_evento,
        event_type: log.tipo_evento,
        actor: log.id_usuario,
        status: log.resultado,
      }
    }));
  },

  // Diagnóstico de Servidor
  async getSystemLogs(lines: number = 100, level?: string): Promise<string[]> {
    const queryParams: Record<string, string> = { lines: lines.toString() };
    if (level) queryParams.level = level;
    const qs = Object.entries(queryParams)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    return apiClient.get<string[]>(`/logs/system?${qs}`);
  },

  async downloadSystemLogs(): Promise<Blob> {
    const token = getAccessToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    const baseUrl = getApiBaseUrl();
    const url = `${baseUrl}/api/v1/logs/system/download`;
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });
    if (!response.ok) {
      throw new Error('Error al descargar los logs del sistema.');
    }
    return response.blob();
  },

  // Usuarios
  async getUsuarios(): Promise<UsuarioResponse[]> {
    return apiClient.get<UsuarioResponse[]>('/usuarios');
  },

  async createUsuario(data: UsuarioCreate): Promise<UsuarioResponse> {
    return apiClient.post<UsuarioResponse>('/usuarios', data);
  },

  async toggleEstadoUsuario(idUsuario: string, isActive: boolean): Promise<UsuarioResponse> {
    return apiClient.patch<UsuarioResponse>(`/usuarios/${idUsuario}/estado?is_active=${isActive}`);
  },

  async updateUsuario(
    idUsuario: string,
    data: {
      rol_sistema?: string;
      estado_cuenta?: boolean;
      nombre_completo?: string;
      correo_institucional?: string;
      contrasena?: string;
    }
  ): Promise<UsuarioResponse> {
    return apiClient.put<UsuarioResponse>(`/usuarios/${idUsuario}`, data);
  },

  async deleteUsuario(idUsuario: string): Promise<{ status: string; message: string }> {
    return apiClient.delete<{ status: string; message: string }>(`/usuarios/${idUsuario}`);
  },

  // Catálogos Académicos
  async getDepartamentos(): Promise<CatalogItem[]> {
    return apiClient.get<CatalogItem[]>('/catalogos/departamentos');
  },

  async createDepartamento(nombre: string, estado: string = 'Aprobado'): Promise<CatalogItem> {
    return apiClient.post<CatalogItem>('/catalogos/departamentos', { nombre, estado });
  },

  async updateDepartamento(id: number, data: { nombre?: string; estado?: string }): Promise<CatalogItem> {
    return apiClient.put<CatalogItem>(`/catalogos/departamentos/${id}`, data);
  },

  async deleteDepartamento(id: number): Promise<{ status: string; message: string }> {
    return apiClient.delete<{ status: string; message: string }>(`/catalogos/departamentos/${id}`);
  },

  async getLineasInvestigacionAdmin(): Promise<CatalogItem[]> {
    return apiClient.get<CatalogItem[]>('/catalogos/lineas-investigacion');
  },

  async createLineaInvestigacion(nombre: string, estado: string = 'Aprobado'): Promise<CatalogItem> {
    return apiClient.post<CatalogItem>('/catalogos/lineas-investigacion', { nombre, estado });
  },

  async updateLineaInvestigacion(id: number, data: { nombre?: string; estado?: string }): Promise<CatalogItem> {
    return apiClient.put<CatalogItem>(`/catalogos/lineas-investigacion/${id}`, data);
  },

  async deleteLineaInvestigacion(id: number): Promise<{ status: string; message: string }> {
    return apiClient.delete<{ status: string; message: string }>(`/catalogos/lineas-investigacion/${id}`);
  }
};

export interface CatalogItem {
  id: number;
  nombre: string;
  estado: string;
  created_at?: string;
  updated_at?: string;
}


