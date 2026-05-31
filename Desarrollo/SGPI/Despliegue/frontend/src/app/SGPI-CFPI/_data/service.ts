/**
 * @file _data/service.ts
 * @description Capa de servicio del módulo de Gestión de Proyectos de Investigación (SGPI-CFPI).
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  INTEGRACIÓN CON SUPABASE                                               │
 * │                                                                         │
 * │  Para conectar al backend real (Supabase):                              │
 * │  1. Instalar: npm install @supabase/supabase-js                         │
 * │  2. Crear el cliente en lib/supabase.ts                                 │
 * │  3. Descomentar los bloques ── SUPABASE ── y eliminar los bloques MOCK. │
 * │                                                                         │
 * │  Tablas esperadas en Supabase:                                          │
 * │    - proyecto                 → datos del proyecto de investigación     │
 * │    - proyecto_miembro         → co-investigadores y roles asignados     │
 * │    - proyecto_hito            → hitos planificados y su porcentaje      │
 * │    - proyecto_historial       → bitácora e historial de auditorías      │
 * │    - docentes                 → padrón de investigadores                │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

import type {
  Proyecto,
  FiltrosProyectos,
  ProyectoPayload,
  StatsProyectos,
  MiembroProyecto,
  HitoProyecto,
  HistorialProyecto,
  EstadoProyecto,
  RolMiembroProyecto,
  Convocatoria,
} from './types';
import type { InvestigatorPadron } from '../../SGPI-CFGI/_data/types';
import { supabase } from '../../../SGPI-CFU/lib/supabase';
import { apiClient } from '../../../SGPI-CFU/lib/api/client';
 
const PAGE_SIZE = 10;
 
function mapToProyecto(p: any): Proyecto {
  let status: EstadoProyecto = 'pendiente_validar';
  if (p.estado_proyecto === 'En ejecución') status = 'en_ejecucion';
  else if (p.estado_proyecto === 'Concluido') status = 'concluido';
 
  const responsable = p.investigador_proyecto?.find((ip: any) => ip.condicion_rol === 'Responsable');
  const responsablePrincipal = responsable?.investigador ? `${responsable.investigador.nombres} ${responsable.investigador.apellidos}` : '';
 
  return {
    id: p.codigo_proyecto,
    code: p.codigo_proyecto,
    title: p.titulo_proyecto,
    tipo: (p.tipo_proyecto === 'Básico' ? 'Básico' : 'Aplicado') as 'Básico' | 'Aplicado',
    programa: p.tipo_programa || '',
    convocatoria: String(p.anio_convocatoria || ''),
    resolucion: p.resolucion_aprobacion || '',
    montoFinanciado: Number(p.presupuesto_asignado || 0),
    inicioPlanificado: p.fecha_inicio || '',
    finPlanificado: p.fecha_informe_final || '',
    status,
    grupoVinculado: p.grupo_investigacion?.codigo_grupo || '',
    responsablePrincipal,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    fuente: p.presupuesto_asignado > 0 ? 'RAIS' : 'Manual',
    miembros: (p.investigador_proyecto || []).map((ip: any) => {
      let rol: RolMiembroProyecto = 'Colaborador';
      if (ip.condicion_rol === 'Responsable') rol = 'Responsable Principal';
      else if (ip.condicion_rol === 'Co-investigador') rol = 'Co-investigador';
      else if (ip.condicion_rol === 'Tesista') rol = 'Tesista vinculado';
      
      return {
        dni: ip.dni_investigador,
        nombre: ip.investigador ? `${ip.investigador.nombres} ${ip.investigador.apellidos}` : ip.dni_investigador,
        rol,
      };
    }),
    hitos: (p.entregable || []).map((e: any) => ({
      id: String(e.id_entregable),
      nombre: e.tipo_entregable,
      fechaVencimiento: e.fecha_limite_programada || '',
      estado: (e.estado_entregable?.toLowerCase() || 'pendiente') as 'pendiente' | 'completado' | 'bloqueado',
      porcentaje: e.estado_entregable === 'Completado' ? 100 : 0,
    })).sort((a: any, b: any) => a.id.localeCompare(b.id)),
    historial: (p.proyecto_estado_historial || []).map((h: any) => ({
      id: String(h.id_historial),
      fecha: h.fecha_cambio,
      usuario: h.usuario?.correo_institucional || 'Sistema',
      cambio: `${h.estado_anterior || 'Inicio'} → ${h.estado_nuevo}`,
      observacion: h.justificacion,
    })).sort((a: any, b: any) => b.fecha.localeCompare(a.fecha)),
  };
}
 
export interface PaginatedProyectos {
  items: Proyecto[];
  total: number;
  page: number;
  pages: number;
}
 
// ─────────────────────────────────────────────────────────────────────────────
// Listado paginado con filtros (ruteado por backend para habilitar logging)
// ─────────────────────────────────────────────────────────────────────────────
export async function getProyectos(
  filtros: FiltrosProyectos,
  page: number = 1,
): Promise<PaginatedProyectos> {
  // Mapear estado frontend → valor BD
  let estadoBackend: string | undefined;
  if (filtros.estado === 'en_ejecucion') estadoBackend = 'En ejecución';
  else if (filtros.estado === 'concluido') estadoBackend = 'Concluido';
  else if (filtros.estado === 'pendiente_validar') estadoBackend = 'Aprobado';

  const params: Record<string, any> = { page, limit: 10 };
  if (filtros.buscar?.trim()) params.buscar = filtros.buscar.trim();
  if (estadoBackend) params.estado = estadoBackend;
  if (filtros.convocatoria) params.convocatoria = filtros.convocatoria;
  if (filtros.inicioPlanificado) params.inicio_planificado = filtros.inicioPlanificado;

  const qs = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');

  const data = await apiClient.get<{ items: any[]; total: number; page: number; pages: number }>(
    `/projects?${qs}`
  );

  return {
    items: (data.items || []).map(mapToProyecto),
    total: data.total,
    page: data.page,
    pages: data.pages,
  };
}
 
// ─────────────────────────────────────────────────────────────────────────────
// Obtener proyecto por ID o código (ruteado por backend para habilitar logging)
// ─────────────────────────────────────────────────────────────────────────────
export async function getProyectoById(id: string): Promise<Proyecto | null> {
  try {
    const p = await apiClient.get<any>(`/projects/${id}`);
    if (!p) return null;
    return mapToProyecto(p);
  } catch (err: any) {
    // 404 devuelto por el backend
    if (err?.status === 404 || err?.message?.includes('404')) return null;
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Obtener estadísticas del módulo
// ─────────────────────────────────────────────────────────────────────────────
function mapToEstadoProyecto(estado_proyecto: string): EstadoProyecto {
  if (estado_proyecto === 'En ejecución') return 'en_ejecucion';
  if (estado_proyecto === 'Concluido') return 'concluido';
  return 'pendiente_validar';
}

// ─────────────────────────────────────────────────────────────────────────────
// Obtener estadísticas del módulo (ruteado por backend para habilitar logging)
// ─────────────────────────────────────────────────────────────────────────────
export async function getStats(): Promise<StatsProyectos> {
  // Solicitamos todas las páginas mínimas solo para el conteo por estado;
  // el backend ya calcula el total, así que hacemos 3 peticiones ligeras.
  const [all, enEjecucion, concluidos] = await Promise.all([
    apiClient.get<{ total: number }>('/projects?limit=1'),
    apiClient.get<{ total: number }>('/projects?limit=1&estado=En%20ejecuci%C3%B3n'),
    apiClient.get<{ total: number }>('/projects?limit=1&estado=Concluido'),
  ]);

  const total = (all as any).total ?? 0;
  const execution = (enEjecucion as any).total ?? 0;
  const completed = (concluidos as any).total ?? 0;
  const pending = total - execution - completed;

  return {
    totalProyectos: total,
    pendientesValidar: Math.max(0, pending),
    enEjecucion: execution,
    concluidos: completed,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Buscar investigadores en el padrón (ruteado por backend para habilitar logging)
// ─────────────────────────────────────────────────────────────────────────────
export async function buscarInvestigadores(buscar: string): Promise<InvestigatorPadron[]> {
  if (!buscar.trim()) return [];

  const data = await apiClient.get<{ items: any[]; total: number } | any[]>(
    `/investigators?buscar=${encodeURIComponent(buscar.trim())}&limit=10`
  );

  const items = Array.isArray(data) ? data : (data as any).items ?? [];

  return items.map((d: any) => ({
    dni: d.dni,
    nombre: `${d.nombres} ${d.apellidos}`,
    email: `${d.dni}@unmsm.edu.pe`,
    facultad: d.facultad_dependencia || '',
    departamento: d.departamento_academico || '',
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Guardar y Auditar Proyecto (Curación de Datos)
// ─────────────────────────────────────────────────────────────────────────────
export async function validarProyecto(
  id: string,
  payload: ProyectoPayload
): Promise<Proyecto> {
  // Mapear estado
  let estadoProyecto = 'Aprobado';
  if (payload.status === 'en_ejecucion') estadoProyecto = 'En ejecución';
  else if (payload.status === 'concluido') estadoProyecto = 'Concluido';

  // 1. Actualizar datos del proyecto vía backend
  await apiClient.put<any>(`/projects/${id}`, {
    titulo_proyecto: payload.title,
    tipo_proyecto: payload.tipo,
    tipo_programa: payload.programa,
    anio_convocatoria: Number(payload.convocatoria) || null,
    resolucion_aprobacion: payload.resolucion,
    presupuesto_asignado: payload.montoFinanciado,
    fecha_inicio: payload.inicioPlanificado || null,
    fecha_informe_final: payload.finPlanificado || null,
    estado_proyecto: estadoProyecto,
    codigo_grupo: payload.grupoVinculado || null,
    justificacion: payload.cambioEstadoObs || null,
  });

  // 2. Limpiar investigadores asociados
  try {
    await apiClient.delete<any>(`/projects/${id}/investigators`);
  } catch (err) {
    console.warn(`No se pudieron eliminar investigadores para el proyecto ${id}:`, err);
  }

  // 3. Insertar nuevos investigadores
  if (payload.miembros.length > 0) {
    for (const m of payload.miembros) {
      let condicion_rol = 'Colaborador';
      if (m.rol === 'Responsable Principal') condicion_rol = 'Responsable';
      else if (m.rol === 'Co-investigador') condicion_rol = 'Co-investigador';
      else if (m.rol === 'Tesista vinculado') condicion_rol = 'Tesista';

      try {
        await apiClient.post<any>(`/projects/${id}/investigators`, {
          codigo_proyecto: id,
          dni_investigador: m.dni,
          condicion_rol,
          tipo_vinculo: 'Docente',
          facultad_integrante: 'Ingeniería de Sistemas e Informática',
        });
      } catch (err) {
        console.warn(`No se pudo agregar investigador ${m.dni}:`, err);
      }
    }
  }

  // Devolver el objeto actualizado completo
  const proyAct = await getProyectoById(id);
  if (!proyAct) throw new Error('No se pudo recuperar el proyecto actualizado.');
  return proyAct;
}

// ─────────────────────────────────────────────────────────────────────────────
// Obtener grupos de investigación disponibles desde el backend
// ─────────────────────────────────────────────────────────────────────────────
export interface GrupoInvestigacion {
  codigo_grupo: string;
  nombre_grupo: string;
  estado_grupo?: string;
}

export async function getGruposDisponibles(): Promise<GrupoInvestigacion[]> {
  try {
    const data = await apiClient.get<GrupoInvestigacion[]>('/groups/?limit=200');
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('Error cargando grupos de investigación:', err);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Crear Nuevo Proyecto
// ─────────────────────────────────────────────────────────────────────────────
export async function crearProyecto(
  payload: ProyectoPayload & { code: string; fuente: string }
): Promise<Proyecto> {
  // Mapear estado frontend → valor BD
  let estadoProyecto = 'Aprobado';
  if (payload.status === 'en_ejecucion') estadoProyecto = 'En ejecución';
  else if (payload.status === 'concluido') estadoProyecto = 'Concluido';

  // 1. Crear el proyecto vía backend (resuelve codigo_grupo → id_grupo internamente)
  await apiClient.post<any>('/projects/', {
    codigo_proyecto:      payload.code,
    titulo_proyecto:      payload.title,
    tipo_proyecto:        payload.tipo,
    tipo_programa:        payload.programa,
    anio_convocatoria:    Number(payload.convocatoria) || null,
    resolucion_aprobacion: payload.resolucion,
    presupuesto_asignado: payload.montoFinanciado,
    fecha_inicio:         payload.inicioPlanificado || null,
    fecha_informe_final:  payload.finPlanificado || null,
    estado_proyecto:      estadoProyecto,
    codigo_grupo:         payload.grupoVinculado || null,
  });

  // 2. Agregar investigadores al proyecto
  for (const m of payload.miembros) {
    let condicion_rol = 'Colaborador';
    if (m.rol === 'Responsable Principal') condicion_rol = 'Responsable';
    else if (m.rol === 'Co-investigador')  condicion_rol = 'Co-investigador';
    else if (m.rol === 'Tesista vinculado') condicion_rol = 'Tesista';

    try {
      await apiClient.post<any>(`/projects/${payload.code}/investigators`, {
        codigo_proyecto:     payload.code,
        dni_investigador:    m.dni,
        condicion_rol,
        tipo_vinculo:        'Docente',
        facultad_integrante: 'Ingeniería de Sistemas e Informática',
      });
    } catch (err) {
      console.warn(`No se pudo agregar investigador ${m.dni}:`, err);
    }
  }

  // 3. Recuperar el proyecto creado para devolverlo al formulario
  const proyNvo = await getProyectoById(payload.code);
  if (!proyNvo) throw new Error('No se pudo recuperar el proyecto creado.');
  return proyNvo;
}


// ─────────────────────────────────────────────────────────────────────────────
// Registrar hito completado
// ─────────────────────────────────────────────────────────────────────────────
export async function completarHito(
  proyectoId: string,
  hitoId: string
): Promise<Proyecto> {
  let id_entregable: number | null = null;

  // 1. Determinar el ID numérico y si es el primer hito
  if (/^\d+$/.test(hitoId)) {
    id_entregable = Number(hitoId);
  } else {
    const isFirstHito = hitoId.endsWith('-1') || hitoId === 'hito-1';
    try {
      const p = await apiClient.get<any>(`/projects/${proyectoId}`);
      if (p && p.entregable && p.entregable.length > 0) {
        const sorted = [...p.entregable].sort((a: any, b: any) => a.id_entregable - b.id_entregable);
        if (isFirstHito) {
          id_entregable = sorted[0].id_entregable;
        } else if (sorted.length > 1) {
          id_entregable = sorted[1].id_entregable;
        }
      }
    } catch (err) {
      console.error('Error recuperando entregables para hito mock:', err);
    }
  }

  if (id_entregable === null) throw new Error('Hito no encontrado.');

  // 2. Actualizar el estado del hito en entregable vía backend
  await apiClient.patch<any>(`/projects/${proyectoId}/deliverables/${id_entregable}`, {
    estado_entregable: 'Completado',
    fecha_entrega_real: new Date().toISOString().split('T')[0],
  });

  const proyAct = await getProyectoById(proyectoId);
  if (!proyAct) throw new Error('No se pudo recuperar el proyecto actualizado.');
  return proyAct;
}

// ─────────────────────────────────────────────────────────────────────────────
// Obtener convocatorias disponibles desde el backend
// ─────────────────────────────────────────────────────────────────────────────
export async function getConvocatorias(): Promise<Convocatoria[]> {
  try {
    const data = await apiClient.get<Convocatoria[]>('/calls/?limit=200');
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('Error cargando convocatorias:', err);
    return [];
  }
}

