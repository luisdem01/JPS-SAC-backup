/**
 * @file _data/service.ts
 * @description Capa de servicio del módulo de Reportes (SGPI-CFR).
 *
 * Conectado con la API real del backend: SGPI-CRAPI
 * Endpoint real: POST /api/v1/reports/generate
 */

import type { ReporteParams, ReporteResult, PasoCarga, RegistroDocente } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const CORTE_LABELS: Record<string, string> = {
  abril:     'Abril',
  agosto:    'Agosto',
  noviembre: 'Noviembre',
};

const TIPO_LABELS: Record<string, string> = {
  actividades:          'Carga No Lectiva y Cumplimiento',
  proyectosActivos:     'Proyectos Activos',
  produccionCientifica: 'Producción Científica',
  baseDatosPOI:         'Base de Datos para POI',
};

// ─────────────────────────────────────────────────────────────────────────────
// Pasos animados de la carga (compartidos con el componente)
// ─────────────────────────────────────────────────────────────────────────────

export const PASOS_CARGA: PasoCarga[] = [
  { progreso: 10, mensaje: 'Conectando con la base de datos...' },
  { progreso: 28, mensaje: 'Consultando registros...' },
  { progreso: 50, mensaje: 'Calculando métricas...' },
  { progreso: 70, mensaje: 'Consolidando indicadores...' },
  { progreso: 88, mensaje: 'Aplicando filtros seleccionados...' },
  { progreso: 100, mensaje: 'Preparando reporte final...' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Generación del reporte
// ─────────────────────────────────────────────────────────────────────────────

export async function generarReporte(params: ReporteParams): Promise<ReporteResult> {
  // Mapeo del frontend 'ReporteParams' al schema del backend 'ReportParams'
  let tipoReporte = '';
  switch(params.tipo) {
    case 'actividades': tipoReporte = 'Carga No Lectiva'; break;
    case 'proyectosActivos': tipoReporte = 'Proyectos Activos'; break;
    case 'produccionCientifica': tipoReporte = 'Produccion Cientifica'; break;
    case 'baseDatosPOI': tipoReporte = 'Resumen General'; break;
    default: tipoReporte = 'Carga No Lectiva';
  }

  const backendParams = {
    tipo_reporte: tipoReporte,
    anio_corte: params.anioFiscal,
    periodo_corte: params.corte,
    fecha_inicio_desde: params.fechaInicio || undefined,
    fecha_fin_hasta: params.fechaFin || undefined,
    departamento_academico: params.departamentos.length > 0 ? params.departamentos[0] : undefined,
    grupo_investigacion: params.grupoInvestigacion || undefined
  };

  // Obtener token de auth desde donde se almacene (ej. localStorage)
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : '';

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const res = await fetch(`${API_URL}/api/v1/reports/generate`, {
    method:  'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}` 
    },
    body: JSON.stringify(backendParams),
  });

  if (!res.ok) {
    const errorData = await res.text();
    throw new Error('Error al generar el reporte en el servidor: ' + errorData);
  }

  const data = await res.json();

  const corteLabel = CORTE_LABELS[params.corte] ?? params.corte;
  const tipoLabel  = TIPO_LABELS[params.tipo]   ?? params.tipo;

  const result: ReporteResult = {
    titulo:                 'Resultados del Reporte',
    subtitulo:              `${tipoLabel} - ${corteLabel} ${params.anioFiscal}`,
    generadoPor:            'Usuario Autenticado',
    fechaEmision:           new Date().toISOString(),
    params,
    totalDocentes:          0,
    proyectosActivos:       0,
    promedioCargaNoLectiva: 0,
    registros:              [],
    totalRegistros:         0,
  };

  // Mapear los datos de respuesta según el tipo de reporte generado
  if (tipoReporte === 'Carga No Lectiva') {
    result.totalDocentes = data.total_investigadores || 0;
    
    if (data.investigadores) {
      result.registros = data.investigadores.map((inv: any) => ({
        id: inv.dni,
        nombre: `${inv.nombres} ${inv.apellidos}`,
        dni: inv.dni,
        departamento: inv.departamento || 'No asignado',
        hrsProyectos: inv.horas_proyectos || 0,
        hrsAsesorias: inv.horas_tesis || 0,
        totalCarga: inv.carga_total || 0
      }));
    }
    result.totalRegistros = result.registros.length;

    const totalCargaSum = result.registros.reduce((acc, r) => acc + r.totalCarga, 0);
    result.promedioCargaNoLectiva = result.totalDocentes > 0 ? Math.round(totalCargaSum / result.totalDocentes) : 0;

  } else if (tipoReporte === 'Resumen General') {
    result.totalDocentes = data.total_investigadores_evaluados || 0;
    result.proyectosActivos = data.total_proyectos_activos || 0;
    result.promedioCargaNoLectiva = data.promedio_carga_no_lectiva ? Math.round(data.promedio_carga_no_lectiva) : 0;
    // Resumen general no tiene registros para la tabla por defecto
    result.registros = [];
    result.totalRegistros = 0;

  } else if (tipoReporte === 'Proyectos Activos') {
    result.proyectosActivos = data.total_proyectos || 0;
    result.promedioCargaNoLectiva = 0;
    if (data.proyectos) {
      // Adaptar a tabla
      result.registros = data.proyectos.map((p: any) => ({
        id: p.codigo_proyecto,
        nombre: p.titulo,
        dni: p.codigo_proyecto,
        departamento: p.estado,
        hrsProyectos: 0,
        hrsAsesorias: 0,
        totalCarga: 0
      }));
    }
    result.totalRegistros = result.registros.length;

  } else if (tipoReporte === 'Produccion Cientifica') {
    result.totalPublicaciones = data.total_publicaciones || 0;
    result.totalTesis = data.total_tesis || 0;
    if (data.publicaciones) {
      result.registros = data.publicaciones.map((p: any) => ({
        id: String(p.id_publicacion),
        nombre: p.titulo,
        dni: p.doi || p.tipo,
        departamento: p.revista || p.indexacion || 'Sin revista',
        hrsProyectos: 0,
        hrsAsesorias: 0,
        totalCarga: 0
      }));
    }
    result.totalRegistros = result.registros.length;
  }

  // Validación de negocio (EX1)
  if (result.registros.length === 0 && tipoReporte === 'Carga No Lectiva') {
    throw new Error('EX1: No se encontraron registros para los parámetros seleccionados.');
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Guardar snapshot (paso 9 del flujo)
// ─────────────────────────────────────────────────────────────────────────────

export async function guardarSnapshot(result: ReporteResult): Promise<void> {
  let tipoReporte = '';
  switch(result.params.tipo) {
    case 'actividades': tipoReporte = 'Carga No Lectiva'; break;
    case 'proyectosActivos': tipoReporte = 'Proyectos Activos'; break;
    case 'produccionCientifica': tipoReporte = 'Produccion Cientifica'; break;
    case 'baseDatosPOI': tipoReporte = 'Resumen General'; break;
    default: tipoReporte = 'Carga No Lectiva';
  }

  const backendParams = {
    tipo_reporte: tipoReporte,
    anio_corte: result.params.anioFiscal,
    periodo_corte: result.params.corte,
    fecha_inicio_desde: result.params.fechaInicio || undefined,
    fecha_fin_hasta: result.params.fechaFin || undefined,
    departamento_academico: result.params.departamentos.length > 0 ? result.params.departamentos[0] : undefined,
    grupo_investigacion: result.params.grupoInvestigacion || undefined
  };

  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : '';

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const res = await fetch(`${API_URL}/api/v1/reports/snapshot`, {
    method:  'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}` 
    },
    body: JSON.stringify(backendParams),
  });

  if (!res.ok) {
    const errorData = await res.text();
    console.error('Error al guardar snapshot:', errorData);
    throw new Error('Error al guardar el snapshot en el servidor.');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Exportar reporte
// ─────────────────────────────────────────────────────────────────────────────

export async function exportarReporte(
  result: ReporteResult,
  formato: 'pdf' | 'excel'
): Promise<void> {
  // Mock fallback para exportación (hasta que el backend exponga /export)
  await new Promise((r) => setTimeout(r, 400));
  alert(`La exportación en formato ${formato.toUpperCase()} se procesará con el backend real en un futuro endpoint de exportación.`);
}

// Exportar umbrales para colorear la tabla
export const UMBRAL_ALTO = 18;  // totalCarga > UMBRAL_ALTO → rojo
export const UMBRAL_BAJO = 7;   // totalCarga < UMBRAL_BAJO → naranja/amarillo

// ─────────────────────────────────────────────────────────────────────────────
// Obtener catálogos dinámicos
// ─────────────────────────────────────────────────────────────────────────────

export async function obtenerCatalogos(): Promise<{ departamentos: string[], grupos: string[] }> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : '';
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const res = await fetch(`${API_URL}/api/v1/reports/catalogs`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });

  if (!res.ok) {
    console.error('Error al obtener catálogos, usando predeterminados vacíos');
    return { departamentos: [], grupos: [] };
  }

  return res.json();
}
