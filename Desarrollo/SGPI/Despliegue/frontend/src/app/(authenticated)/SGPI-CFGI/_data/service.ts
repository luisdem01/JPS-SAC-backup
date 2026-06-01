/**
 * @file _data/service.ts
 * @description Capa de servicio del módulo de Gestión de Grupos de Investigación (SGPI-CFGI).
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
 * │    - grupo_investigacion      → datos del grupo                         │
 * │    - grupo_miembro            → miembros asociados al grupo             │
 * │    - proyecto                 → proyectos de investigación asociados    │
 * │    - docentes                 → padrón de investigadores                │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

import type {
  GrupoInvestigacion,
  FiltrosGrupos,
  GrupoPayload,
  StatsGrupos,
  InvestigatorPadron,
  FuenteOrigen,
  RolMiembro,
  EstadoGrupo,
} from './types';
// Eliminamos la importación del mock para que no dependa de mock.ts
import { supabase } from '@/SGPI-CFU/lib/supabase';
import { apiClient } from '@/SGPI-CFU/lib/api/client';
import { clientCache } from '@/SGPI-CFU/lib/api/clientCache';
import { formatEmail } from '@/SGPI-CFU/lib/utils/formatters';
 
const PAGE_SIZE = 10;
 
/** Convierte el valor de estado_grupo de la BD al tipo EstadoGrupo del frontend */
function mapEstadoGrupo(estadoBD: string | null | undefined): EstadoGrupo {
  if (!estadoBD) return 'pendiente_validacion';
  const lower = estadoBD.toLowerCase().trim();
  if (lower === 'activo') return 'validado_activo';
  if (lower === 'inactivo') return 'validado_inactivo';
  if (lower === 'pendiente_validacion') return 'pendiente_validacion';
  if (lower === 'validado_activo') return 'validado_activo';
  if (lower === 'validado_inactivo') return 'validado_inactivo';
  // Por defecto, si existe pero no es ninguno conocido, tratar como pendiente
  return 'pendiente_validacion';
}

/** Convierte el tipo EstadoGrupo del frontend al valor de estado_grupo de la BD */
function mapEstadoGrupoBD(estado: string): string | null {
  if (estado === 'validado_activo')   return 'Activo';
  if (estado === 'validado_inactivo') return 'Inactivo';
  if (estado === 'pendiente_validacion') return null; // No hay equivalente directo en BD
  return estado; // fallback: pasar tal cual
}

function mapToGrupo(g: any): GrupoInvestigacion {
  const coordinatorName = g.coordinador ? `${g.coordinador.nombres} ${g.coordinador.apellidos}` : undefined;
  
  return {
    id: String(g.id_grupo),
    code: g.codigo_grupo,
    name: g.nombre_grupo,
    acronym: g.siglas || undefined,
    description: g.descripcion || undefined,
    coordinatorDni: g.dni_coordinador || undefined,
    coordinatorName,
    researchLines: g.lineas_investigacion || [],
    status: mapEstadoGrupo(g.estado_grupo),
    recognitionDate: g.fecha_reconocimiento || undefined,
    createdAt: g.created_at,
    updatedAt: g.created_at,
    fuente: g.url_vrip ? 'RAIS' : 'Manual',
    miembros: (g.miembro_grupo || []).map((m: any) => {
      let rol: RolMiembro = 'Colaborador';
      if (m.condicion_miembro === 'Coordinador') rol = 'Director';
      else if (m.condicion_miembro === 'Titular') rol = 'Co-Investigador';
      else if (m.condicion_miembro === 'Estudiante') rol = 'Tesista';
      
      return {
        dni: m.dni_investigador,
        nombre: m.investigador ? `${m.investigador.nombres} ${m.investigador.apellidos}` : m.dni_investigador,
        rol,
        fechaIncorporacion: m.fecha_incorporacion || '',
        estado: (m.estado_membresia?.toLowerCase() || 'activo') as 'activo' | 'inactivo',
      };
    }),
    proyectosVinculados: (g.proyecto || []).map((p: any) => {
      let estado: 'pending' | 'active' | 'completed' | 'cancelled' = 'active';
      if (p.estado_proyecto === 'Formulación') estado = 'pending';
      else if (p.estado_proyecto === 'Concluido') estado = 'completed';
      else if (p.estado_proyecto === 'Cancelado') estado = 'cancelled';
      
      return {
        codigo: p.codigo_proyecto,
        titulo: p.titulo_proyecto,
        estado,
        convocatoria: String(p.anio_convocatoria || ''),
      };
    }),
  };
}
 
// ─────────────────────────────────────────────────────────────────────────────
// Listado paginado con filtros
// ─────────────────────────────────────────────────────────────────────────────
 
export interface PaginatedGrupos {
  items: GrupoInvestigacion[];
  total: number;
  page: number;
  pages: number;
}
 
export async function getGrupos(
  filtros: FiltrosGrupos,
  page: number = 1,
): Promise<PaginatedGrupos> {
  try {
    const queryParams = new URLSearchParams();
    if (filtros.buscar) queryParams.append('buscar', filtros.buscar);
    if (filtros.estado) queryParams.append('estado', filtros.estado);
    if (filtros.fuente) queryParams.append('fuente', filtros.fuente);
    queryParams.append('page', String(page));
    queryParams.append('limit', String(PAGE_SIZE));

    const res = await apiClient.get<{ items: any[]; total: number; page: number; pages: number }>(
      `/groups/?${queryParams.toString()}`
    );

    return {
      items: res.items as GrupoInvestigacion[],
      total: res.total,
      page: res.page,
      pages: res.pages,
    };
  } catch (err: any) {
    throw new Error(err.message || 'Error al obtener los grupos.');
  }
}
 
// ─────────────────────────────────────────────────────────────────────────────
// Obtener grupo por ID
// ─────────────────────────────────────────────────────────────────────────────
 
export async function getGrupoById(id: string): Promise<GrupoInvestigacion | null> {
  let data: any;
  try {
    data = await apiClient.get<any>(`/groups/${id}`);
  } catch (err: any) {
    if (err.status === 404 || (err.message && err.message.includes('404'))) {
      return null;
    }
    throw err;
  }

  if (!data) return null;
  const grupo = data as GrupoInvestigacion;

  const memberDnis = grupo.miembros.map((m) => m.dni);

  // Ejecutar las consultas de conteo en paralelo para evitar waterfalls
  const [pubRes, thesisRes] = await Promise.all([
    supabase
      .from('publicacion')
      .select('*', { count: 'exact', head: true })
      .eq('id_grupo', data.id_grupo)
      .ilike('indexacion', 'scopus'),
    memberDnis.length > 0
      ? supabase
          .from('tesis')
          .select('*', { count: 'exact', head: true })
          .in('dni_asesor', memberDnis)
      : Promise.resolve({ count: 0, error: null })
  ]);

  grupo.articulosScopus = !pubRes.error ? (pubRes.count ?? 0) : 0;
  grupo.tesisEnCurso = !thesisRes.error ? (thesisRes.count ?? 0) : 0;

  return grupo;
}
 
// ─────────────────────────────────────────────────────────────────────────────
// Obtener estadísticas globales del módulo
// ─────────────────────────────────────────────────────────────────────────────
 
export async function getStats(): Promise<StatsGrupos> {
  try {
    const res = await apiClient.get<StatsGrupos>('/groups/stats');
    return res;
  } catch (err: any) {
    throw new Error(err.message || 'Error al obtener las estadísticas.');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Buscar investigadores en el Padrón de Investigadores
// ─────────────────────────────────────────────────────────────────────────────

export async function buscarInvestigadores(buscar: string): Promise<InvestigatorPadron[]> {
  const params = new URLSearchParams({
    buscar: buscar.trim(),
    limit: '10'
  });

  try {
    const data = await apiClient.get<{
      items: any[];
      total: number;
    }>(`/investigators?${params.toString()}`);

    return (data.items || []).map((d: any) => ({
      dni: d.dni,
      nombre: `${d.nombres} ${d.apellidos}`,
      nombres: d.nombres,
      apellidos: d.apellidos,
      email: formatEmail(d.correo),
      facultad: d.facultad_dependencia || '',
      departamento: d.departamento_academico || '',
      isExternal: d.is_external || false,
      nivelRenacyt: d.categoria_renacyt || 'Sin nivel'
    }));
  } catch (err) {
    console.error("Error fetching investigators from API, falling back to local Supabase query", err);
    const { data, error } = await supabase
      .from('investigador')
      .select('dni, nombres, apellidos, departamento_academico, facultad_dependencia, categoria_renacyt, correo')
      .or(`dni.eq.${buscar.trim()},nombres.ilike.%${buscar.trim()}%,apellidos.ilike.%${buscar.trim()}%`)
      .limit(10);
 
    if (error) throw new Error(error.message);
 
    return (data || []).map((d: any) => ({
      dni: d.dni,
      nombre: `${d.nombres} ${d.apellidos}`,
      nombres: d.nombres,
      apellidos: d.apellidos,
      email: formatEmail(d.correo),
      facultad: d.facultad_dependencia || '',
      departamento: d.departamento_academico || '',
      isExternal: false,
      nivelRenacyt: d.categoria_renacyt || 'Sin nivel'
    }));
  }
}
 
// ─────────────────────────────────────────────────────────────────────────────
// Guardar y Validar Grupo (Curación de Datos)
// ─────────────────────────────────────────────────────────────────────────────
 
export async function validarGrupo(
  id: string,
  payload: GrupoPayload,
): Promise<any> {
  const director = payload.miembros.find((m) => m.rol === 'Director' && m.estado === 'activo');
  const coordinatorDni = director?.dni || null;

  const backendPayload = {
    nombre_grupo: payload.name,
    siglas: payload.acronym || null,
    lineas_investigacion: payload.researchLines,
    estado_grupo: mapEstadoGrupoBD(payload.status) || 'Activo',
    fecha_reconocimiento: payload.recognitionDate || new Date().toISOString().split('T')[0],
    dni_coordinador: coordinatorDni,
    correo_coordinador: coordinatorDni && !/^\d+$/.test(coordinatorDni) ? `${coordinatorDni}@unmsm.edu.pe` : null,
    miembros: payload.miembros.map((m) => ({
      dni: m.dni,
      nombre: m.nombre || null,
      nombres: m.nombres || null,
      apellidos: m.apellidos || null,
      rol: m.rol,
      fechaIncorporacion: m.fechaIncorporacion || new Date().toISOString().split('T')[0],
      estado: m.estado,
      isExternal: !!m.isExternal,
      nivelRenacyt: m.nivelRenacyt || null,
      departamento: m.departamento || null,
      facultad: m.facultad || null,
    })),
  };

  try {
    return await apiClient.put<any>(`/groups/${id}`, backendPayload);
  } catch (err: any) {
    throw new Error(err.message || 'Error al actualizar el grupo.');
  }
}

export async function crearGrupo(
  payload: GrupoPayload & { code: string; fuente: FuenteOrigen },
): Promise<any> {
  const director = payload.miembros.find((m) => m.rol === 'Director' && m.estado === 'activo');
  const coordinatorDni = director?.dni || null;

  const backendPayload = {
    codigo_grupo: payload.code.trim().toUpperCase(),
    nombre_grupo: payload.name,
    siglas: payload.acronym || null,
    lineas_investigacion: payload.researchLines,
    estado_grupo: mapEstadoGrupoBD(payload.status) || 'Activo',
    fecha_reconocimiento: payload.recognitionDate || new Date().toISOString().split('T')[0],
    dni_coordinador: coordinatorDni,
    correo_coordinador: coordinatorDni && !/^\d+$/.test(coordinatorDni) ? `${coordinatorDni}@unmsm.edu.pe` : null,
    url_vrip: payload.fuente === 'RAIS' ? 'https://vrip.unmsm.edu.pe' : null,
    miembros: payload.miembros.map((m) => ({
      dni: m.dni,
      nombre: m.nombre || null,
      nombres: m.nombres || null,
      apellidos: m.apellidos || null,
      rol: m.rol,
      fechaIncorporacion: m.fechaIncorporacion || new Date().toISOString().split('T')[0],
      estado: m.estado,
      isExternal: !!m.isExternal,
      nivelRenacyt: m.nivelRenacyt || null,
      departamento: m.departamento || null,
      facultad: m.facultad || null,
    })),
  };

  try {
    return await apiClient.post<any>('/groups/', backendPayload);
  } catch (err: any) {
    throw new Error(err.message || 'Error al crear el grupo.');
  }
}

export async function validarCodigoGrupo(code: string): Promise<boolean> {
  if (!code.trim()) return false;
  try {
    const res = await apiClient.get<{ unico: boolean }>(`/groups/validate-code?code=${encodeURIComponent(code)}`);
    return res.unico;
  } catch (err) {
    console.error("Error validating group code", err);
    return true; // fallback
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Integración con Cybertesis (GET /external, POST /theses)
// ─────────────────────────────────────────────────────────────────────────────

export async function buscarTesisExternas(query: string): Promise<any[]> {
  try {
    const data = await apiClient.get<any[]>(`/theses/external?q=${encodeURIComponent(query)}`);
    return data || [];
  } catch (err) {
    console.error("Error consultando tesis externas en backend:", err);
    throw err;
  }
}

export async function vincularTesis(tesisPayload: any): Promise<any> {
  try {
    const data = await apiClient.post<any>('/theses', tesisPayload);
    return data;
  } catch (err) {
    console.error("Error al vincular tesis en backend:", err);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Obtener Líneas de Investigación reales desde configuracion_global
// ─────────────────────────────────────────────────────────────────────────────

// TTL de 1 hora para las líneas de investigación (catálogo muy estático)
const CATALOG_TTL = 60 * 60 * 1000;

export async function getLineasInvestigacion(): Promise<string[]> {
  const cacheKey = 'catalog.lineas_investigacion';
  const cachedData = clientCache.get(cacheKey, CATALOG_TTL);
  if (cachedData) {
    return cachedData;
  }

  try {
    const data = await apiClient.get<{ id: number; nombre: string; estado: string }[]>(
      '/catalogos/lineas-investigacion'
    );
    const lineas = data
      .filter((item) => item.estado === 'Aprobado')
      .map((item) => item.nombre) || [];
    clientCache.set(cacheKey, lineas);
    return lineas;
  } catch (err) {
    console.error("Error al obtener líneas de investigación reales:", err);
    throw err;
  }
}

