export interface LogEntry {
  id: string;
  fechaHora: string; // ISO 8601
  evento: string;
  usuario: string;
  estado: 'EXITO' | 'FALLO' | 'ADVERTENCIA';
  detail: object;
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
  created_at: string;
}

export interface UsuarioCreate {
  correo_institucional: string;
  rol_sistema: string;
  estado_cuenta?: boolean;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const capiacService = {
  // Configuración
  async getConfiguraciones(): Promise<ConfiguracionResponse[]> {
    const res = await fetch(`${API_BASE_URL}/api/v1/configuracion`, {
      headers: {
        // 'Authorization': `Bearer ${token}` // TODO: Add if auth is required
      }
    });
    if (!res.ok) throw new Error('Error al obtener configuraciones');
    return res.json();
  },

  async updateConfiguracion(clave: string, valor: any, descripcion?: string): Promise<ConfiguracionResponse> {
    const res = await fetch(`${API_BASE_URL}/api/v1/configuracion/${clave}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ valor, descripcion }),
    });
    if (!res.ok) throw new Error(`Error al actualizar la configuración ${clave}`);
    return res.json();
  },

  // Logs
  async getLogsAuditoria(params?: GetLogsParams): Promise<LogEntry[]> {
    const url = new URL(`${API_BASE_URL}/api/v1/logs`);
    if (params?.tipo_evento) url.searchParams.append('tipo_evento', params.tipo_evento);
    if (params?.fecha_inicio) url.searchParams.append('fecha_inicio', params.fecha_inicio);
    if (params?.fecha_fin) url.searchParams.append('fecha_fin', params.fecha_fin);
    if (params?.skip !== undefined) url.searchParams.append('skip', params.skip.toString());
    if (params?.limit !== undefined) url.searchParams.append('limit', params.limit.toString());

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error('Error al obtener logs');
    const data = await res.json();

    // Map backend model to frontend model
    return data.map((log: any): LogEntry => ({
      id: String(log.id_log),
      fechaHora: log.timestamp_evento,
      evento: log.tipo_evento,
      usuario: log.id_usuario || 'SISTEMA',
      estado: (log.resultado?.toUpperCase() === 'SUCCESS' || log.resultado?.toUpperCase() === 'EXITO') ? 'EXITO' 
            : (log.resultado?.toUpperCase() === 'WARNING' || log.resultado?.toUpperCase() === 'ADVERTENCIA') ? 'ADVERTENCIA' 
            : 'FALLO',
      detail: {
        ...log,
        timestamp: log.timestamp_evento,
        event_type: log.tipo_evento,
        actor: log.id_usuario,
        status: log.resultado,
      }
    }));
  },

  // Usuarios
  async getUsuarios(): Promise<UsuarioResponse[]> {
    const res = await fetch(`${API_BASE_URL}/api/v1/usuarios`, {
      headers: {
        // 'Authorization': `Bearer ${token}`
      }
    });
    if (!res.ok) throw new Error('Error al obtener usuarios');
    return res.json();
  },

  async createUsuario(data: UsuarioCreate): Promise<UsuarioResponse> {
    const res = await fetch(`${API_BASE_URL}/api/v1/usuarios`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      throw new Error(errorData?.detail || 'Error al crear usuario');
    }
    return res.json();
  },

  async toggleEstadoUsuario(idUsuario: string, isActive: boolean): Promise<UsuarioResponse> {
    const url = new URL(`${API_BASE_URL}/api/v1/usuarios/${idUsuario}/estado`);
    url.searchParams.append('is_active', isActive.toString());
    
    const res = await fetch(url.toString(), {
      method: 'PATCH',
    });
    if (!res.ok) throw new Error('Error al actualizar estado del usuario');
    return res.json();
  }
};
