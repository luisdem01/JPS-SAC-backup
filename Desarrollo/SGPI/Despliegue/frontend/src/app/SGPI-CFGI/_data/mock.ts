/**
 * @file _data/mock.ts
 * @description Datos mock del módulo de Gestión de Grupos de Investigación (SGPI-CFGI).
 */

import type { GrupoInvestigacion, InvestigatorPadron, StatsGrupos } from './types';

export const LINEAS_INVESTIGACION = [
  'L1. Inteligencia Artificial y Aprendizaje Automático',
  'L2. Ciberseguridad y Criptografía Aplicada',
  'L3. Sistemas Distribuidos y Computación en la Nube',
  'L4. Ingeniería de Software y Metodologías Ágiles',
  'L5. Procesamiento de Lenguaje Natural',
  'L6. Ciencia de Datos y Big Data',
  'L7. Internet de las Cosas y Redes de Sensores',
  'L8. Computación Gráfica y Realidad Virtual'
];

export const MOCK_PADRON_INVESTIGADORES: InvestigatorPadron[] = [
  {
    dni: '12345678',
    nombre: 'Carlos Alfonso Pérez Medina',
    email: 'carlos.perez@unmsm.edu.pe',
    facultad: 'Ingeniería de Sistemas e Informática',
    departamento: 'Ingeniería de Sistemas y Software'
  },
  {
    dni: '87654321',
    nombre: 'María Elena Rostworowski Silva',
    email: 'maria.rostworowski@unmsm.edu.pe',
    facultad: 'Ingeniería de Sistemas e Informática',
    departamento: 'Ciencias de la Computación'
  },
  {
    dni: '45678912',
    nombre: 'Jorge Luis Basadre Ayulo',
    email: 'jorge.basadre@unmsm.edu.pe',
    facultad: 'Ingeniería de Sistemas e Informática',
    departamento: 'Ingeniería de Sistemas y Software'
  },
  {
    dni: '78912345',
    nombre: 'Ana Cecilia Valenzuela Flores',
    email: 'ana.valenzuela@unmsm.edu.pe',
    facultad: 'Ciencias Matemáticas',
    departamento: 'Estadística'
  },
  {
    dni: '23456789',
    nombre: 'Humberto Raúl Landeo Quispe',
    email: 'humberto.landeo@unmsm.edu.pe',
    facultad: 'Ingeniería de Sistemas e Informática',
    departamento: 'Ciencias de la Computación'
  },
  {
    dni: '98765432',
    nombre: 'Sofía Isabel Loli Bonilla',
    email: 'sofia.loli@unmsm.edu.pe',
    facultad: 'Ingeniería de Sistemas e Informática',
    departamento: 'Ingeniería de Sistemas y Software'
  },
  {
    dni: '34567890',
    nombre: 'Víctor Manuel Torres Castillo',
    email: 'victor.torres@unmsm.edu.pe',
    facultad: 'Física',
    departamento: 'Física Aplicada'
  },
  {
    dni: '56789012',
    nombre: 'Carmen Rosa Vargas Romero',
    email: 'carmen.vargas@unmsm.edu.pe',
    facultad: 'Ingeniería de Sistemas e Informática',
    departamento: 'Ciencias de la Computación'
  }
];

export const MOCK_GRUPOS: GrupoInvestigacion[] = [
  {
    id: 'GI-001',
    code: 'GI-001',
    name: 'GRUPO DE INTELIGENCIA ARTIFICIAL Y PATRONES (GIAP)',
    acronym: 'GIAP',
    description: 'Investigación y desarrollo de técnicas avanzadas de IA, reconocimiento de patrones y visión computacional.',
    coordinatorDni: '12345678',
    coordinatorName: 'Carlos Alfonso Pérez Medina',
    researchLines: [LINEAS_INVESTIGACION[0], LINEAS_INVESTIGACION[4]],
    status: 'validado_activo',
    recognitionDate: '2022-03-15',
    createdAt: '2022-03-01T10:00:00Z',
    updatedAt: '2026-05-20T18:30:00Z',
    fuente: 'RAIS',
    miembros: [
      {
        dni: '12345678',
        nombre: 'Carlos Alfonso Pérez Medina',
        rol: 'Director',
        fechaIncorporacion: '2022-03-15',
        estado: 'activo'
      },
      {
        dni: '87654321',
        nombre: 'María Elena Rostworowski Silva',
        rol: 'Co-Investigador',
        fechaIncorporacion: '2022-03-15',
        estado: 'activo'
      },
      {
        dni: '45678912',
        nombre: 'Jorge Luis Basadre Ayulo',
        rol: 'Colaborador',
        fechaIncorporacion: '2023-01-10',
        estado: 'activo'
      }
    ],
    proyectosVinculados: [
      {
        codigo: 'PROY-2024-0023',
        titulo: 'Clasificación automática de imágenes médicas mediante redes neuronales profundas',
        estado: 'active',
        convocatoria: 'Convocatoria Proyectos de Investigación VRIP 2024'
      },
      {
        codigo: 'PROY-2023-0112',
        titulo: 'Optimización de algoritmos de procesamiento de lenguaje natural en quechua',
        estado: 'completed',
        convocatoria: 'Convocatoria Proyectos de Investigación VRIP 2023'
      }
    ]
  },
  {
    id: 'GI-002',
    code: 'GI-002',
    name: 'Sistemas de Información y Ciberseguridad Avanzada',
    acronym: 'SICA',
    description: 'Estudio de protocolos criptográficos y protección de infraestructuras críticas de información.',
    coordinatorDni: '87654321',
    coordinatorName: 'María Elena Rostworowski Silva',
    researchLines: [LINEAS_INVESTIGACION[1]],
    status: 'pendiente_validacion',
    recognitionDate: undefined,
    createdAt: '2026-04-10T14:20:00Z',
    updatedAt: '2026-04-10T14:20:00Z',
    fuente: 'RAIS',
    miembros: [
      {
        dni: '87654321',
        nombre: 'María Elena Rostworowski Silva',
        rol: 'Director',
        fechaIncorporacion: '2026-04-10',
        estado: 'activo'
      },
      {
        dni: '23456789',
        nombre: 'Humberto Raúl Landeo Quispe',
        rol: 'Co-Investigador',
        fechaIncorporacion: '2026-04-10',
        estado: 'activo'
      }
    ],
    proyectosVinculados: [
      {
        codigo: 'PROY-2025-0089',
        titulo: 'Framework de ciberseguridad para dispositivos del Internet de las Cosas en entornos médicos',
        estado: 'pending',
        convocatoria: 'Convocatoria Proyectos de Investigación VRIP 2025'
      }
    ]
  },
  {
    id: 'GI-003',
    code: 'GI-003',
    name: 'grupo investigacion redes y sistemas computacionales (GIRSC)',
    acronym: 'GIRSC',
    description: 'Grupo orientado a redes de sensores y computación distribuida de alto rendimiento.',
    coordinatorDni: '23456789',
    coordinatorName: 'Humberto Raúl Landeo Quispe',
    researchLines: [LINEAS_INVESTIGACION[2], LINEAS_INVESTIGACION[6]],
    status: 'pendiente_validacion',
    recognitionDate: undefined,
    createdAt: '2026-05-15T09:00:00Z',
    updatedAt: '2026-05-15T09:00:00Z',
    fuente: 'Res. Rectoral',
    miembros: [
      {
        dni: '23456789',
        nombre: 'Humberto Raúl Landeo Quispe',
        rol: 'Director',
        fechaIncorporacion: '2026-05-15',
        estado: 'activo'
      },
      {
        dni: '78912345',
        nombre: 'Ana Cecilia Valenzuela Flores',
        rol: 'Co-Investigador',
        fechaIncorporacion: '2026-05-15',
        estado: 'activo'
      }
    ],
    proyectosVinculados: []
  },
  {
    id: 'GI-004',
    code: 'GI-004',
    name: 'CIENCIA DE DATOS APLICADA A LA SALUD Y EDUCACION',
    acronym: 'CDASE',
    description: 'Desarrollo de modelos predictivos de datos y análisis estadístico en salud pública y educación virtual.',
    coordinatorDni: '78912345',
    coordinatorName: 'Ana Cecilia Valenzuela Flores',
    researchLines: [LINEAS_INVESTIGACION[5]],
    status: 'validado_activo',
    recognitionDate: '2023-11-20',
    createdAt: '2023-11-01T11:45:00Z',
    updatedAt: '2026-03-12T15:10:00Z',
    fuente: 'Manual',
    miembros: [
      {
        dni: '78912345',
        nombre: 'Ana Cecilia Valenzuela Flores',
        rol: 'Director',
        fechaIncorporacion: '2023-11-20',
        estado: 'activo'
      },
      {
        dni: '34567890',
        nombre: 'Víctor Manuel Torres Castillo',
        rol: 'Co-Investigador',
        fechaIncorporacion: '2023-11-20',
        estado: 'activo'
      },
      {
        dni: '98765432',
        nombre: 'Sofía Isabel Loli Bonilla',
        rol: 'Colaborador',
        fechaIncorporacion: '2024-04-18',
        estado: 'activo'
      }
    ],
    proyectosVinculados: [
      {
        codigo: 'PROY-2024-0412',
        titulo: 'Minería de opiniones en redes sociales para la detección temprana de crisis de salud mental en universitarios',
        estado: 'active',
        convocatoria: 'Convocatoria Proyectos de Investigación VRIP 2024'
      }
    ]
  },
  {
    id: 'GI-005',
    code: 'GI-005',
    name: 'INGENIERIA DE SOFTWARE Y CALIDAD (ISC-UNMSM)',
    acronym: 'ISC',
    description: 'Investigación en metodologías de desarrollo, calidad de software y usabilidad en plataformas web.',
    coordinatorDni: '98765432',
    coordinatorName: 'Sofía Isabel Loli Bonilla',
    researchLines: [LINEAS_INVESTIGACION[3]],
    status: 'validado_inactivo',
    recognitionDate: '2021-06-10',
    createdAt: '2021-05-15T08:00:00Z',
    updatedAt: '2025-12-01T17:00:00Z',
    fuente: 'RAIS',
    miembros: [
      {
        dni: '98765432',
        nombre: 'Sofía Isabel Loli Bonilla',
        rol: 'Director',
        fechaIncorporacion: '2021-06-10',
        estado: 'activo'
      },
      {
        dni: '45678912',
        nombre: 'Jorge Luis Basadre Ayulo',
        rol: 'Co-Investigador',
        fechaIncorporacion: '2021-06-10',
        estado: 'activo'
      }
    ],
    proyectosVinculados: [
      {
        codigo: 'PROY-2022-0045',
        titulo: 'Evaluación del impacto de DevOps en la calidad de software en pymes limeñas',
        estado: 'completed',
        convocatoria: 'Convocatoria Proyectos de Investigación VRIP 2022'
      }
    ]
  }
];

export function getMockStats(): StatsGrupos {
  const totalGrupos = MOCK_GRUPOS.length;
  const pendientesValidar = MOCK_GRUPOS.filter((g) => g.status === 'pendiente_validacion').length;
  const validadosActivos = MOCK_GRUPOS.filter((g) => g.status === 'validado_activo').length;
  const validadosInactivos = MOCK_GRUPOS.filter((g) => g.status === 'validado_inactivo').length;

  return {
    totalGrupos,
    pendientesValidar,
    validadosActivos,
    validadosInactivos
  };
}
