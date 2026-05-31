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
import { MOCK_GRUPOS, MOCK_PADRON_INVESTIGADORES, getMockStats } from './mock';
import { supabase } from '../../../SGPI-CFU/lib/supabase';
 
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
  let query = supabase
    .from('grupo_investigacion')
    .select(`
      *,
      coordinador:investigador!grupo_investigacion_dni_coordinador_fkey(nombres, apellidos),
      miembro_grupo(
        *,
        investigador(nombres, apellidos)
      ),
      proyecto(*)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
 
  if (filtros.buscar.trim()) {
    query = query.or(
      `codigo_grupo.ilike.%${filtros.buscar.trim()}%,nombre_grupo.ilike.%${filtros.buscar.trim()}%,siglas.ilike.%${filtros.buscar.trim()}%`
    );
  }
  if (filtros.estado) {
    const estadoBD = mapEstadoGrupoBD(filtros.estado);
    if (estadoBD) {
      query = query.eq('estado_grupo', estadoBD);
    }
    // Si estadoBD es null (pendiente_validacion), no hay equivalente en BD actual;
    // se muestra todo (sin filtro) — el mapper ya lo convierte correctamente.
  }
  if (filtros.fuente) {
    if (filtros.fuente === 'RAIS') {
      query = query.not('url_vrip', 'is', null);
    } else {
      query = query.is('url_vrip', null);
    }
  }
 
  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
 
  const total = count ?? 0;
  
  return {
    items: (data || []).map(mapToGrupo),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}
 
// ─────────────────────────────────────────────────────────────────────────────
// Obtener grupo por ID
// ─────────────────────────────────────────────────────────────────────────────
 
export async function getGrupoById(id: string): Promise<GrupoInvestigacion | null> {
  const query = supabase
    .from('grupo_investigacion')
    .select(`
      *,
      coordinador:investigador!grupo_investigacion_dni_coordinador_fkey(nombres, apellidos),
      miembro_grupo(
        *,
        investigador(nombres, apellidos)
      ),
      proyecto(*)
    `)
    .or(`codigo_grupo.eq.${id},id_grupo.eq.${isNaN(Number(id)) ? -1 : Number(id)}`)
    .maybeSingle();
 
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  if (!data) return null;
 
  const grupo = mapToGrupo(data);

  // 1. Contar publicaciones indexadas en Scopus vinculadas al grupo
  const { count: scopusCount, error: pubError } = await supabase
    .from('publicacion')
    .select('*', { count: 'exact', head: true })
    .eq('id_grupo', data.id_grupo)
    .ilike('indexacion', 'scopus');

  grupo.articulosScopus = !pubError ? (scopusCount ?? 0) : 0;

  // 2. Contar tesis asesoradas por miembros del grupo
  const memberDnis = grupo.miembros.map((m) => m.dni);
  if (memberDnis.length > 0) {
    const { count: thesesCount, error: thesisError } = await supabase
      .from('tesis')
      .select('*', { count: 'exact', head: true })
      .in('dni_asesor', memberDnis);
    
    grupo.tesisEnCurso = !thesisError ? (thesesCount ?? 0) : 0;
  } else {
    grupo.tesisEnCurso = 0;
  }

  return grupo;
}
 
// ─────────────────────────────────────────────────────────────────────────────
// Obtener estadísticas globales del módulo
// ─────────────────────────────────────────────────────────────────────────────
 
export async function getStats(): Promise<StatsGrupos> {
  const { data, error } = await supabase
    .from('grupo_investigacion')
    .select('estado_grupo');
 
  if (error) throw new Error(error.message);
 
  const total = data.length;
  const mapped = (data || []).map((g: any) => mapEstadoGrupo(g.estado_grupo));
  const pending  = mapped.filter((s) => s === 'pendiente_validacion').length;
  const active   = mapped.filter((s) => s === 'validado_activo').length;
  const inactive = mapped.filter((s) => s === 'validado_inactivo').length;
 
  return {
    totalGrupos: total,
    pendientesValidar: pending,
    validadosActivos: active,
    validadosInactivos: inactive,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Buscar investigadores en el Padrón de Investigadores (CUO4)
// ─────────────────────────────────────────────────────────────────────────────

export async function buscarInvestigadores(buscar: string): Promise<InvestigatorPadron[]> {
  /* ── SUPABASE ──────────────────────────────────────────────────────────────
  const { data, error } = await supabase
    .from('docentes')
    .select('dni, nombres, apellidos, email, facultad, departamento')
    .or(`dni.eq.${buscar},nombres.ilike.%${buscar}%,apellidos.ilike.%${buscar}%`)
    .limit(10);

  if (error) throw new Error(error.message);

  return (data || []).map((d: any) => ({
    dni: d.dni,
    nombre: `${d.nombres} ${d.apellidos}`,
    email: d.email,
    facultad: d.facultad || '',
    departamento: d.departamento || '',
  }));
  ──────────────────────────────────────────────────────────────────────────── */

  const { data, error } = await supabase
    .from('investigador')
    .select('dni, nombres, apellidos, departamento_academico, facultad_dependencia')
    .or(`dni.eq.${buscar.trim()},nombres.ilike.%${buscar.trim()}%,apellidos.ilike.%${buscar.trim()}%`)
    .limit(10);
 
  if (error) throw new Error(error.message);
 
  return (data || []).map((d: any) => ({
    dni: d.dni,
    nombre: `${d.nombres} ${d.apellidos}`,
    email: `${d.dni}@unmsm.edu.pe`,
    facultad: d.facultad_dependencia || '',
    departamento: d.departamento_academico || '',
  }));
}
 
// ─────────────────────────────────────────────────────────────────────────────
// Guardar y Validar Grupo (Curación de Datos)
// ─────────────────────────────────────────────────────────────────────────────
 
export async function validarGrupo(
  id: string,
  payload: GrupoPayload,
): Promise<GrupoInvestigacion> {
  const director = payload.miembros.find((m) => m.rol === 'Director' && m.estado === 'activo');
  const coordinatorDni = director?.dni || null;
 
  const idGrupoNum = Number(id);
 
  // 1. Actualizar el grupo principal
  const { data: g, error: errGrupo } = await supabase
    .from('grupo_investigacion')
    .update({
      nombre_grupo: payload.name,
      siglas: payload.acronym || null,
      lineas_investigacion: payload.researchLines,
      estado_grupo: mapEstadoGrupoBD(payload.status) || 'Activo',
      fecha_reconocimiento: payload.recognitionDate || new Date().toISOString().split('T')[0],
      dni_coordinador: coordinatorDni,
      correo_coordinador: coordinatorDni ? `${coordinatorDni}@unmsm.edu.pe` : null,
    })
    .eq('id_grupo', idGrupoNum)
    .select()
    .single();
 
  if (errGrupo || !g) throw new Error(errGrupo?.message || 'Error al actualizar el grupo.');
 
  // 2. Sincronizar miembros: eliminar los antiguos e insertar los nuevos
  const { error: errDelMiembros } = await supabase
    .from('miembro_grupo')
    .delete()
    .eq('id_grupo', idGrupoNum);
 
  if (errDelMiembros) throw new Error(errDelMiembros.message);
 
  if (payload.miembros.length > 0) {
    const { error: errInsMiembros } = await supabase
      .from('miembro_grupo')
      .insert(
        payload.miembros.map((m) => {
          let condicion = 'Adherente';
          if (m.rol === 'Director') condicion = 'Coordinador';
          else if (m.rol === 'Co-Investigador') condicion = 'Titular';
          else if (m.rol === 'Tesista') condicion = 'Estudiante';
 
          return {
            id_grupo: idGrupoNum,
            dni_investigador: m.dni,
            condicion_miembro: condicion,
            estado_membresia: m.estado === 'activo' ? 'Activo' : 'Inactivo',
            fecha_incorporacion: m.fechaIncorporacion || new Date().toISOString().split('T')[0],
          };
        })
      );
    if (errInsMiembros) throw new Error(errInsMiembros.message);
  }
 
  const gActualizado = await getGrupoById(id);
  if (!gActualizado) throw new Error('Error al recuperar el grupo actualizado.');
  return gActualizado;
}
 
// ─────────────────────────────────────────────────────────────────────────────
// Validar unicidad del código (EX2)
// ─────────────────────────────────────────────────────────────────────────────
 
export async function validarCodigoGrupo(codigo: string, excluirId?: string): Promise<boolean> {
  let query = supabase
    .from('grupo_investigacion')
    .select('id_grupo')
    .eq('codigo_grupo', codigo.trim().toUpperCase());
 
  if (excluirId) {
    query = query.neq('id_grupo', Number(excluirId));
  }
 
  const { data, error } = await query;
  if (error) throw new Error(error.message);
 
  return (data || []).length === 0;
}
 
// ─────────────────────────────────────────────────────────────────────────────
// Exportar Ficha (Simulación de descarga)
// ─────────────────────────────────────────────────────────────────────────────
 
export async function exportarFicha(
  id: string,
  formato: 'pdf' | 'excel',
): Promise<Blob> {
  // En producción, esto haría una llamada al endpoint del backend que genera el reporte
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/reports/ficha?grupo_id=${id}&format=${formato}`);
  if (!response.ok) {
    throw new Error('Error al generar la ficha.');
  }
  return response.blob();
}
 
// ─────────────────────────────────────────────────────────────────────────────
// Crear Nuevo Grupo (Ingreso Manual)
// ─────────────────────────────────────────────────────────────────────────────
 
export async function crearGrupo(
  payload: GrupoPayload & { code: string; fuente: FuenteOrigen },
): Promise<GrupoInvestigacion> {
  const director = payload.miembros.find((m) => m.rol === 'Director' && m.estado === 'activo');
  const coordinatorDni = director?.dni || null;
 
  const { data: g, error: errGrupo } = await supabase
    .from('grupo_investigacion')
    .insert({
      codigo_grupo: payload.code.trim().toUpperCase(),
      nombre_grupo: payload.name,
      siglas: payload.acronym || null,
      lineas_investigacion: payload.researchLines,
      estado_grupo: mapEstadoGrupoBD(payload.status) || 'Activo',
      fecha_reconocimiento: payload.recognitionDate || new Date().toISOString().split('T')[0],
      dni_coordinador: coordinatorDni,
      correo_coordinador: coordinatorDni ? `${coordinatorDni}@unmsm.edu.pe` : null,
      url_vrip: payload.fuente === 'RAIS' ? 'https://vrip.unmsm.edu.pe' : null,
    })
    .select()
    .single();
 
  if (errGrupo || !g) throw new Error(errGrupo?.message || 'Error al crear el grupo.');
 
  if (payload.miembros.length > 0) {
    const { error: errMiembros } = await supabase
      .from('miembro_grupo')
      .insert(
        payload.miembros.map((m) => {
          let condicion = 'Adherente';
          if (m.rol === 'Director') condicion = 'Coordinador';
          else if (m.rol === 'Co-Investigador') condicion = 'Titular';
          else if (m.rol === 'Tesista') condicion = 'Estudiante';
 
          return {
            id_grupo: g.id_grupo,
            dni_investigador: m.dni,
            condicion_miembro: condicion,
            estado_membresia: m.estado === 'activo' ? 'Activo' : 'Inactivo',
            fecha_incorporacion: m.fechaIncorporacion || new Date().toISOString().split('T')[0],
          };
        })
      );
    if (errMiembros) throw new Error(errMiembros.message);
  }
 
  const gCreado = await getGrupoById(String(g.id_grupo));
  if (!gCreado) throw new Error('Error al recuperar el grupo recién creado.');
  return gCreado;
}
