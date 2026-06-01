/**
 * @file _data/service.ts
 * @description Capa de servicio del módulo de Búsqueda Global.
 *
 * Endpoint real: GET /api/v1/search
 */

import type { SearchProject, SearchInvestigador, SearchPublicacion } from './types';
import { apiClient }                                    from '@/SGPI-CFU/lib/api/client';

// ─────────────────────────────────────────────────────────────────────────────
export async function getProjectById(id: string): Promise<SearchProject | null> {
  try {
    const p = await apiClient.get<any>(`/projects/${id}`);
    if (!p) return null;
    
    // Buscar investigador responsable
    const responsable = p.investigador_proyecto?.find((ip: any) => ip.condicion_rol === 'Responsable');
    const responsableName = responsable?.investigador 
      ? `${responsable.investigador.nombres} ${responsable.investigador.apellidos}`.trim() 
      : 'Sin responsable';
    const initials = responsableName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || 'SR';

    return {
      id: p.codigo_proyecto,
      codigo: p.codigo_proyecto,
      titulo: p.titulo_proyecto,
      tipo: p.tipo_proyecto || 'Básico',
      convocatoria: p.anio_convocatoria ? `VRIP ${p.anio_convocatoria}` : 'VRIP',
      estado: p.estado_proyecto || 'Aprobado',
      resumen: p.observaciones || 'Sin resumen disponible',
      monto: Number(p.presupuesto_asignado || 0),
      respaldoLegal: p.resolucion_aprobacion || 'S/R',
      inicio: p.fecha_inicio || '',
      fin: p.fecha_informe_final || p.fecha_inicio || '',
      responsable: { nombre: responsableName, initials },
      grupo: p.grupo_investigacion?.nombre_grupo || p.codigo_grupo || 'Sin grupo',
      fuente: p.is_external ? ['CyberTesis'] : ['RAIS'],
      ultimaSync: p.updated_at ? new Date(p.updated_at).toLocaleDateString('es-PE') : 'No disponible',
      anio: p.anio_convocatoria || 2026,
    };
  } catch (err) {
    console.error('Error fetching project by ID:', err);
    return null;
  }
}

export async function getInvestigadorById(id: string): Promise<SearchInvestigador | null> {
  try {
    const inv = await apiClient.get<any>(`/investigators/${id}`);
    if (!inv) return null;

    const nombre = `${inv.nombres} ${inv.apellidos}`.trim();
    
    // Deducir bases de datos de origen
    const fuentes: ('RAIS' | 'RENACYT' | 'CyberTesis')[] = [];
    if (inv.investigador_sm || inv.codigo_interno_vrip) fuentes.push('RAIS');
    if (inv.codigo_renacyt || (inv.categoria_renacyt && inv.categoria_renacyt !== 'No Clasificado')) fuentes.push('RENACYT');
    if (fuentes.length === 0) fuentes.push('RAIS'); // fallback

    return {
      id: inv.dni,
      nombre,
      cargo: inv.condicion_laboral || 'Docente Principal',
      especialidad: inv.departamento_academico || 'Ciencia de la Computación',
      nivel: inv.categoria_renacyt || 'No Clasificado',
      dni: inv.dni,
      fuente: fuentes,
      grupo: 'Investigador Principal',
      ultimaSync: inv.updated_at ? new Date(inv.updated_at).toLocaleDateString('es-PE') : 'Hace 1 día',
      proyectosCount: inv.proyectos_count || 0,
      publicacionesCount: inv.publicaciones_count || 0,
      email: inv.correo || undefined,
      facultad: inv.facultad_dependencia || undefined,
      codigoRenacyt: inv.codigo_renacyt || undefined,
    };
  } catch (err) {
    console.error('Error fetching investigator by ID:', err);
    return null;
  }
}

export async function getPublicacionById(id: string): Promise<SearchPublicacion | null> {
  try {
    let targetId = id;
    if (!id.startsWith('pub-') && !id.startsWith('tes-')) {
      if (id.startsWith('http://') || id.startsWith('https://') || id.includes('/')) {
        // Es una URL de tesis, codificar a base64 url-safe
        const b64 = Buffer.from(id).toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');
        targetId = 'tes-' + b64;
      } else {
        // Es un ID de publicación
        targetId = 'pub-' + id;
      }
    }

    const data = await apiClient.get<any>(`/cfpt/producciones/${targetId}`);
    if (!data) return null;
    
    const isTesis = data.tipo === 'tesis';
    const autores = isTesis ? [data.tesista, data.autores] : [data.autores];

    return {
      id: data.id,
      titulo: data.titulo,
      autores,
      revista: isTesis ? 'CyberTesis' : (data.revista || 'Sin revista'),
      anio: data.fecha ? Number(data.fecha.split('-')[0]) : 2026,
      doi: data.doi || undefined,
      fuente: isTesis ? 'CyberTesis' : (data.fuente as any),
      quartil: data.quartil || undefined,
      ultimaAct: data.fecha || 'No disponible',
      tipo: isTesis ? (data.tipoTesis || 'Tesis') : `Artículo ${data.fuente || 'Scopus'}`,
      resumen: data.resumen || 'Sin resumen disponible',
    };
  } catch (err) {
    console.error('Error fetching publication by ID:', err);
    return null;
  }
}
