/**
 * @file _data/service.ts
 * @description Capa de servicio del módulo de Docentes/Investigadores (SGPI-CFMH).
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  INTEGRACIÓN CON SUPABASE                                               │
 * │                                                                         │
 * │  Para conectar al backend real (Supabase):                              │
 * │  1. Instalar: npm install @supabase/supabase-js                         │
 * │     (o @supabase/auth-helpers-nextjs si se usa autenticación de sesión) │
 * │  2. Crear el cliente en lib/supabase.ts (ver abajo).                    │
 * │  3. Descomentar los bloques ── SUPABASE ── y eliminar los bloques MOCK. │
 * │                                                                         │
 * │  Tablas esperadas en Supabase:                                          │
 * │    - docentes           → perfil principal                              │
 * │    - puntaje_historico  → relación 1:N con docentes (fk: docente_id)   │
 * │                                                                         │
 * │  Ejemplo de lib/supabase.ts:                                            │
 * │    import { createClient } from '@supabase/supabase-js';                │
 * │    export const supabase = createClient(                                │
 * │      process.env.NEXT_PUBLIC_SUPABASE_URL!,                             │
 * │      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!                         │
 * │    );                                                                   │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

import type {
  DocenteInvestigador, FiltrosDocentes, DocentePayload, StatsDocentes,
  ProyectoHistorial, NivelRenacyt, EstadoVigencia, RolProyecto, EstadoProyecto,
} from './types';


import { supabase } from '../../../SGPI-CFU/lib/supabase';
import { apiClient } from '../../../SGPI-CFU/lib/api/client';
 
const PAGE_SIZE = 10;
 
function mapToDocente(inv: any): DocenteInvestigador {
  return {
    id: inv.dni,
    dni: inv.dni,
    nombres: inv.nombres,
    apellidos: inv.apellidos,
    email: `${inv.dni}@unmsm.edu.pe`,
    departamento: inv.departamento_academico,
    nivelRenacyt: (inv.categoria_renacyt || 'Sin nivel') as NivelRenacyt,
    condicionSM: inv.investigador_sm ? 'SM' : 'No SM',
    estado: (inv.estado_vigencia?.toLowerCase() || 'activo') as EstadoVigencia,
    fechaVigencia: undefined,
    codigoDocente: inv.codigo_interno_vrip || undefined,
    puntajeHistorico: (inv.historial_puntaje || []).map((hp: any) => ({
      anio: hp.anio_evaluacion,
      articulos: Math.round(Number(hp.puntaje_revistas || 0) + Number(hp.puntaje_libros || 0)),
      tesis: Math.round(Number(hp.puntaje_tesis || 0)),
      proyectos: Math.round(Number(hp.puntaje_proyectos || 0)),
      puntaje: Number(hp.puntaje_total || 0),
    })),
    creadoEn: inv.created_at,
    actualizadoEn: inv.updated_at,
  };
}
 
// ─────────────────────────────────────────────────────────────────────────────
// Listado paginado con filtros
// ─────────────────────────────────────────────────────────────────────────────
 
export interface PaginatedDocentes {
  items:  DocenteInvestigador[];
  total:  number;
  page:   number;
  pages:  number;
}
 
export async function getDocentes(
  filtros: FiltrosDocentes,
  page: number = 1,
): Promise<PaginatedDocentes> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(PAGE_SIZE),
  });

  if (filtros.buscar.trim()) {
    params.append('buscar', filtros.buscar.trim());
  }
  if (filtros.departamento) {
    params.append('departamento', filtros.departamento);
  }
  if (filtros.nivelRenacyt) {
    params.append('nivelRenacyt', filtros.nivelRenacyt);
  }
  if (filtros.estado) {
    params.append('estado', filtros.estado);
  }

  // Hacer la petición al backend local (FastAPI) a través de apiClient
  const data = await apiClient.get<{
    items: any[];
    total: number;
    page: number;
    pages: number;
  }>(`/investigators?${params.toString()}`);

  return {
    items: (data.items || []).map(mapToDocente),
    total: data.total,
    page: data.page,
    pages: data.pages,
  };
}
 
// ─────────────────────────────────────────────────────────────────────────────
// Obtener perfil completo por ID
// ─────────────────────────────────────────────────────────────────────────────
 
export async function getDocenteById(id: string): Promise<DocenteInvestigador | null> {
  const { data, error } = await supabase
    .from('investigador')
    .select('*, historial_puntaje(*)')
    .eq('dni', id)
    .maybeSingle();
 
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapToDocente(data);
}

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Crear docente
// ─────────────────────────────────────────────────────────────────────────────
 
export async function crearDocente(payload: DocentePayload): Promise<DocenteInvestigador> {
  const estadoMapeado = payload.estado === 'activo' ? 'Activo' : payload.estado === 'inactivo' ? 'Inactivo' : 'Por Vencer';
  
  // 1. Insertar el perfil principal en la tabla 'investigador'
  const { data: docente, error: errDoc } = await supabase
    .from('investigador')
    .insert([{
      dni:                    payload.dni,
      nombres:                payload.nombres,
      apellidos:              payload.apellidos,
      codigo_interno_vrip:    payload.codigoDocente || null,
      condicion_laboral:      'Ordinario',
      departamento_academico: payload.departamento,
      facultad_dependencia:   'Ingeniería de Sistemas e Informática',
      grado_academico_max:    'Magíster',
      codigo_renacyt:         payload.codigoDocente ? `${payload.dni}_ren` : null,
      orcid:                  null,
      categoria_renacyt:      payload.nivelRenacyt,
      estado_renacyt:         payload.estado,
      url_cti_vitae:          null,
      investigador_sm:        payload.condicionSM === 'SM',
      estado_vigencia:        estadoMapeado,
      tiene_deuda_gi:         false,
      tiene_deuda_pi:         false,
    }])
    .select()
    .single();
 
  if (errDoc || !docente) throw new Error(errDoc?.message ?? 'Error al crear docente.');
 
  // 2. Insertar el historial de puntajes en la tabla 'historial_puntaje'
  if (payload.puntajeHistorico.length > 0) {
    const { error: errHist } = await supabase
      .from('historial_puntaje')
      .insert(
        payload.puntajeHistorico.map((p) => ({
          dni_investigador: docente.dni,
          anio_evaluacion:  p.anio,
          puntaje_total:    p.puntaje,
          puntaje_revistas: p.articulos,
          puntaje_tesis:      p.tesis,
          puntaje_proyectos:  p.proyectos,
          puntaje_libros:   0,
          puntaje_patentes: 0,
          puntaje_otros:    0,
        }))
      );
    if (errHist) throw new Error(errHist.message);
  }
 
  return mapToDocente({ ...docente, historial_puntaje: payload.puntajeHistorico });
}
 
// ─────────────────────────────────────────────────────────────────────────────
// Actualizar docente
// ─────────────────────────────────────────────────────────────────────────────
 
export async function actualizarDocente(
  id: string,
  payload: DocentePayload,
): Promise<DocenteInvestigador> {
  const estadoMapeado = payload.estado === 'activo' ? 'Activo' : payload.estado === 'inactivo' ? 'Inactivo' : 'Por Vencer';
 
  // 1. Actualizar el perfil principal en 'investigador'
  const { data: docente, error: errDoc } = await supabase
    .from('investigador')
    .update({
      nombres:                payload.nombres,
      apellidos:              payload.apellidos,
      dni:                    payload.dni,
      codigo_interno_vrip:    payload.codigoDocente || null,
      departamento_academico: payload.departamento,
      categoria_renacyt:      payload.nivelRenacyt,
      investigador_sm:        payload.condicionSM === 'SM',
      estado_vigencia:        estadoMapeado,
      updated_at:             new Date().toISOString(),
    })
    .eq('dni', id)
    .select()
    .single();
 
  if (errDoc || !docente) throw new Error(errDoc?.message ?? 'Error al actualizar docente.');
 
  // 2. Sincronizar historial: eliminar los antiguos e insertar los nuevos
  const { error: errDelHist } = await supabase
    .from('historial_puntaje')
    .delete()
    .eq('dni_investigador', id);
 
  if (errDelHist) throw new Error(errDelHist.message);
 
  if (payload.puntajeHistorico.length > 0) {
    const { error: errHist } = await supabase
      .from('historial_puntaje')
      .insert(
        payload.puntajeHistorico.map((p) => ({
          dni_investigador: id,
          anio_evaluacion:  p.anio,
          puntaje_total:    p.puntaje,
          puntaje_revistas: p.articulos,
          puntaje_tesis:      p.tesis,
          puntaje_proyectos:  p.proyectos,
          puntaje_libros:   0,
          puntaje_patentes: 0,
          puntaje_otros:    0,
        }))
      );
    if (errHist) throw new Error(errHist.message);
  }
 
  return mapToDocente({ ...docente, historial_puntaje: payload.puntajeHistorico });
}
 
// ─────────────────────────────────────────────────────────────────────────────
// Validar unicidad de DNI — EX1
// ─────────────────────────────────────────────────────────────────────────────
 
export async function validarDNI(
  dni: string,
  excluirId?: string,
): Promise<{ duplicado: boolean; existenteId?: string }> {
  let query = supabase
    .from('investigador')
    .select('dni')
    .eq('dni', dni);
 
  if (excluirId) query = query.neq('dni', excluirId);
 
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
 
  return { duplicado: !!data, existenteId: data?.dni };
}
 
// ─────────────────────────────────────────────────────────────────────────────
// KPIs del tablero
// ─────────────────────────────────────────────────────────────────────────────
 
export async function getStats(): Promise<StatsDocentes> {
  const [
    { count: totalDocentes },
    { count: investigadoresRenacyt },
    { count: vigenciasPorVencer },
    { count: proyectosActivos },
  ] = await Promise.all([
    supabase.from('investigador').select('*', { count: 'exact', head: true }),
    supabase.from('investigador').select('*', { count: 'exact', head: true }).neq('categoria_renacyt', 'No Clasificado'),
    supabase.from('investigador').select('*', { count: 'exact', head: true }).eq('estado_vigencia', 'Por Vencer'),
    supabase.from('proyecto').select('*', { count: 'exact', head: true }).eq('estado_proyecto', 'En ejecución'),
  ]);
 
  const total = totalDocentes ?? 0;
  const renacyt = investigadoresRenacyt ?? 0;
 
  return {
    totalDocentes:         total,
    deltaEsteMes:          0,
    investigadoresRenacyt: renacyt,
    porcentajeRenacyt:     total ? Math.round((renacyt / total) * 100) : 0,
    vigenciasPorVencer:    vigenciasPorVencer ?? 0,
    proyectosActivos:      proyectosActivos ?? 0,
    cicloAcademico:        '2026-I',
  };
}
 
// ─────────────────────────────────────────────────────────────────────────────
// Historial de Proyectos del investigador (Línea de Tiempo)
// ─────────────────────────────────────────────────────────────────────────────
 
export async function getHistorialProyectos(
  docenteId: string,
): Promise<ProyectoHistorial[]> {
  const { data, error } = await supabase
    .from('investigador_proyecto')
    .select(`
      condicion_rol,
      proyecto (
        codigo_proyecto,
        titulo_proyecto,
        fecha_inicio,
        presupuesto_asignado,
        estado_proyecto
      )
    `)
    .eq('dni_investigador', docenteId);
 
  if (error) throw new Error(error.message);
 
  return (data || []).map((row: any) => {
    const p = row.proyecto;
    const anioInicio = p.fecha_inicio ? new Date(p.fecha_inicio).getFullYear() : new Date().getFullYear();
    return {
      id: `${p.codigo_proyecto}-${docenteId}`,
      codigo: p.codigo_proyecto,
      titulo: p.titulo_proyecto,
      rol: row.condicion_rol as RolProyecto,
      anioInicio,
      anioFin: undefined,
      presupuesto: Number(p.presupuesto_asignado || 0),
      entidadFinanciadora: 'VRIP-UNMSM',
      estado: (p.estado_proyecto === 'En ejecución' ? 'en_ejecucion' : p.estado_proyecto === 'Concluido' ? 'finalizado' : 'en_evaluacion') as EstadoProyecto,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Generar Certificado PDF
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Solicita la generación del certificado PDF de participación en proyectos
 * para el docente/investigador indicado y dispara la descarga en el navegador.
 *
 * Supabase / API:
 *   POST /api/v1/docentes/{id}/certificado
 *   Body: { incluirMontos: boolean }
 *   Response: application/pdf (blob)
 *
 * El servidor genera el PDF con:
 *   - Datos del investigador (nombre, DNI, categoría, departamento)
 *   - Listado cronológico de proyectos con rol, período, estado
 *   - Si incluirMontos = true → columna de presupuesto asignado
 *   - Sello y firma digital del Vicerrector de Investigación
 *   - Código QR de validación
 */
export async function generarCertificadoPDF(
  docenteId: string,
  incluirMontos: boolean,
): Promise<void> {

  /* ── REAL API ────────────────────────────────────────────────────────────────
  const res = await fetch(`/api/v1/docentes/${docenteId}/certificado`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ incluirMontos }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message ?? 'Error al generar el certificado PDF.');
  }

  const blob     = await res.blob();
  const url      = URL.createObjectURL(blob);
  const anchor   = document.createElement('a');
  anchor.href     = url;
  anchor.download  = `certificado_participacion_${docenteId}.pdf`;
  anchor.click();
  URL.revokeObjectURL(url);
  ─────────────────────────────────────────────────────────────────────────── */

  // ── MOCK ──────────────────────────────────────────────────────────────────
  // Simula el tiempo de generación del PDF en el servidor (~1.4 s)
  await new Promise((r) => setTimeout(r, 1400));
  console.info(
    `[MOCK] Certificado PDF generado para docenteId="${docenteId}", incluirMontos=${incluirMontos}`,
  );
}
