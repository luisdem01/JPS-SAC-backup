/**
 * @file _data/types.ts
 * @description Definición de tipos TypeScript para el módulo de Gestión de Proyectos de Investigación (SGPI-CFPI).
 */

export type EstadoProyecto = 'pendiente_validar' | 'en_ejecucion' | 'concluido';

export type RolMiembroProyecto = 'Responsable Principal' | 'Co-investigador' | 'Tesista vinculado' | 'Colaborador';

export interface MiembroProyecto {
  dni: string;
  nombre: string;
  rol: RolMiembroProyecto;
  fechaIncorporacion?: string;
  estado?: 'activo' | 'inactivo';
}

export interface HitoProyecto {
  id: string;
  nombre: string;
  fechaVencimiento: string;
  estado: 'pendiente' | 'completado' | 'bloqueado';
  porcentaje: number;
}

export interface HistorialProyecto {
  id: string;
  fecha: string;
  usuario: string;
  cambio: string;
  observacion: string;
}

export interface Proyecto {
  id: string;
  code: string;
  title: string;
  tipo: 'Básico' | 'Aplicado';
  programa: string;
  convocatoria: string;
  resolucion: string;
  montoFinanciado: number;
  inicioPlanificado: string;
  finPlanificado: string;
  status: EstadoProyecto;
  grupoVinculado: string;
  responsablePrincipal: string;
  createdAt: string;
  updatedAt: string;
  fuente: string;
  miembros: MiembroProyecto[];
  hitos: HitoProyecto[];
  historial: HistorialProyecto[];
  is_external?: boolean;
}

export interface FiltrosProyectos {
  buscar: string;
  estado: string;
  convocatoria: string;
  inicioPlanificado: string;
}

export interface ProyectoPayload {
  title: string;
  tipo: 'Básico' | 'Aplicado';
  programa: string;
  convocatoria: string;
  resolucion: string;
  montoFinanciado: number;
  inicioPlanificado: string;
  finPlanificado: string;
  status: EstadoProyecto;
  grupoVinculado: string;
  responsablePrincipal: string;
  miembros: MiembroProyecto[];
  cambioEstadoObs?: string;
}

export interface StatsProyectos {
  totalProyectos: number;
  pendientesValidar: number;
  enEjecucion: number;
  concluidos: number;
}

export interface Convocatoria {
  id_convocatoria: number;
  titulo_convocatoria: string;
  estado_convocatoria: string;
}

