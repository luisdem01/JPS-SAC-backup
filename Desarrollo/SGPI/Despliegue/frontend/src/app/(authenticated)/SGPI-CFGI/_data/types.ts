/**
 * @file _data/types.ts
 * @description Definición de tipos TypeScript para el módulo de Gestión de Grupos de Investigación (SGPI-CFGI).
 */

export type EstadoGrupo = 'pendiente_validacion' | 'validado_activo' | 'validado_inactivo';

export type FuenteOrigen = 'RAIS' | 'Res. Rectoral' | 'Manual';

export type RolMiembro = 'Director' | 'Co-Investigador' | 'Colaborador' | 'Tesista';

export interface MiembroGrupo {
  dni: string;
  nombre: string;
  nombres?: string;
  apellidos?: string;
  rol: RolMiembro;
  fechaIncorporacion: string;
  estado: 'activo' | 'inactivo';
  isExternal?: boolean;
  nivelRenacyt?: string;
  departamento?: string;
  facultad?: string;
}

export interface ProyectoVinculado {
  codigo: string;
  titulo: string;
  estado: 'pending' | 'active' | 'completed' | 'cancelled';
  convocatoria: string;
}

export interface GrupoInvestigacion {
  id: string; // Puede ser igual a 'code' o un ID autogenerado
  code: string;
  name: string;
  acronym?: string;
  description?: string;
  coordinatorDni?: string;
  coordinatorName?: string;
  researchLines: string[];
  status: EstadoGrupo;
  recognitionDate?: string;
  createdAt: string;
  updatedAt: string;
  fuente: FuenteOrigen;
  miembros: MiembroGrupo[];
  proyectosVinculados: ProyectoVinculado[];
  articulosScopus?: number;
  tesisEnCurso?: number;
}

export interface FiltrosGrupos {
  buscar: string;
  estado: string;
  fuente: string;
}

export interface GrupoPayload {
  name: string;
  acronym?: string;
  researchLines: string[];
  status: EstadoGrupo;
  recognitionDate?: string;
  miembros: MiembroGrupo[];
}

export interface StatsGrupos {
  totalGrupos: number;
  pendientesValidar: number;
  validadosActivos: number;
  validadosInactivos: number;
}

export interface InvestigatorPadron {
  dni: string;
  nombre: string;
  nombres?: string;
  apellidos?: string;
  email: string;
  facultad: string;
  departamento: string;
  isExternal?: boolean;
  nivelRenacyt?: string;
}
