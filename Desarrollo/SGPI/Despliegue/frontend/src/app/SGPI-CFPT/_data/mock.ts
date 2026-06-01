/**
 * @file _data/mock.ts
 * @description Datos mock del módulo de Publicaciones y Tesis.
 * Reemplazar con respuestas reales de GET /api/v1/publicaciones.
 */

import type { RegistroProduccion, InvestigadorResumen } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Investigadores disponibles para vincular (búsqueda EX1)
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_INVESTIGADORES: InvestigadorResumen[] = [
  { id: 'INV-001', nombre: 'Perez Torres, Rosa',      dni: '08459231', departamento: 'Ingeniería de Sistemas',      grupo: 'IA en Salud Pública' },
  { id: 'INV-002', nombre: 'Gomez Llanos, Luis',       dni: '40596871', departamento: 'Ingeniería de Software',      grupo: 'NLP y Minería de Datos' },
  { id: 'INV-003', nombre: 'Silva Ramirez, Alejandro', dni: '18293847', departamento: 'Ciencias de la Computación', grupo: 'Visión Artificial y Robótica' },
  { id: 'INV-004', nombre: 'Mendoza Torres, Carlos',   dni: '42385912', departamento: 'Ingeniería de Sistemas',      grupo: 'IA en Educación' },
  { id: 'INV-005', nombre: 'Flores Cano, Pedro',       dni: '29384756', departamento: 'Ingeniería de Software',      grupo: 'Seguridad Informática' },
  { id: 'INV-006', nombre: 'Quispe Mamani, Julia',     dni: '31928475', departamento: 'Ciencias de la Computación', grupo: 'Bioinformática Clínica' },
  { id: 'INV-007', nombre: 'Torres Vargas, Miguel',    dni: '10293847', departamento: 'Ingeniería de Sistemas',      grupo: 'NLP y Minería de Datos' },
  { id: 'INV-008', nombre: 'Rojas Calla, Marco',       dni: '55647382', departamento: 'Ingeniería de Software',      grupo: 'IA en Salud Pública' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Registros de producción
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_PRODUCCIONES: RegistroProduccion[] = [
  // ── Artículos Pendientes ────────────────────────────────────────────────────
  {
    id:            'PROD-001',
    tipo:          'articulo',
    titulo:        'Machine Learning Models for Healthcare Analytics in Rural Areas',
    autores:       'R. Perez, J. Doe',
    fecha:         '2026-04-15',
    fuente:        'SCOPUS',
    estado:        'pendiente',
    revista:       'Journal of Healthcare Informatics',
    issn:          '2452-315X',
    volNum:        'Vol 12, Nº 4',
    doi:           '10.1816/j.health.2026.185432',
    cuartil:       'Q1',
    importadoEn:   '2026-04-18T08:15:00Z',
    investigadoresVinculados: [
      { investigador: { id: 'INV-001', nombre: 'Perez Torres, Rosa', dni: '08459231', departamento: 'Ingeniería de Sistemas', grupo: 'IA en Salud Pública' }, rol: 'Autor Principal' },
    ],
  },
  {
    id:            'PROD-002',
    tipo:          'articulo',
    titulo:        'Arquitectura de microservicios para gestión académica universitaria',
    autores:       'L. Gomez',
    fecha:         '2026-05-10',
    fuente:        'CYBERTESIS',
    estado:        'pendiente',
    revista:       'Repositorio UNMSM',
    doi:           '',
    cuartil:       null,
    importadoEn:   '2026-05-22T09:00:00Z',
    investigadoresVinculados: [],
  },
  {
    id:            'PROD-003',
    tipo:          'articulo',
    titulo:        'IoT Security Frameworks in Smart Cities: A Systematic Review',
    autores:       'A. Silva',
    fecha:         '2026-02-02',
    fuente:        'WOS',
    estado:        'validado',
    revista:       'IEEE Internet of Things Journal',
    issn:          '2327-4662',
    volNum:        'Vol 14, Nº 2',
    doi:           '10.1109/jiot.2026.3041123',
    cuartil:       'Q1',
    confirmadoPor: 'Ana Mendoza',
    confirmadoEn:  '2026-05-10T14:30:00Z',
    importadoEn:   '2026-05-08T11:00:00Z',
    investigadoresVinculados: [
      { investigador: { id: 'INV-003', nombre: 'Silva Ramirez, Alejandro', dni: '18293847', departamento: 'Ciencias de la Computación', grupo: 'Visión Artificial y Robótica' }, rol: 'Autor Principal' },
    ],
  },
  {
    id:            'PROD-004',
    tipo:          'articulo',
    titulo:        'Deep Learning for Early Detection of Diabetic Retinopathy',
    autores:       'C. Mendoza, P. Flores',
    fecha:         '2026-03-18',
    fuente:        'SCOPUS',
    estado:        'pendiente',
    revista:       'Computers in Biology and Medicine',
    issn:          '0010-4825',
    doi:           '10.1016/j.compbiomed.2026.106012',
    cuartil:       'Q2',
    importadoEn:   '2026-05-21T07:45:00Z',
    investigadoresVinculados: [
      { investigador: { id: 'INV-004', nombre: 'Mendoza Torres, Carlos', dni: '42385912', departamento: 'Ingeniería de Sistemas', grupo: 'IA en Educación' }, rol: 'Autor Principal' },
      { investigador: { id: 'INV-005', nombre: 'Flores Cano, Pedro',     dni: '29384756', departamento: 'Ingeniería de Software',  grupo: 'Seguridad Informática' }, rol: 'Coautor' },
    ],
  },
  {
    id:            'PROD-005',
    tipo:          'articulo',
    titulo:        'Blockchain-Based Academic Credential Verification System',
    autores:       'M. Torres, J. Quispe',
    fecha:         '2025-12-01',
    fuente:        'WOS',
    estado:        'validado',
    revista:       'Future Generation Computer Systems',
    issn:          '0167-739X',
    volNum:        'Vol 155',
    doi:           '10.1016/j.future.2025.11.009',
    cuartil:       'Q1',
    confirmadoPor: 'Ana Mendoza',
    confirmadoEn:  '2026-01-15T10:00:00Z',
    importadoEn:   '2026-01-10T08:30:00Z',
    investigadoresVinculados: [
      { investigador: { id: 'INV-007', nombre: 'Torres Vargas, Miguel', dni: '10293847', departamento: 'Ingeniería de Sistemas', grupo: 'NLP y Minería de Datos' }, rol: 'Autor Principal' },
      { investigador: { id: 'INV-006', nombre: 'Quispe Mamani, Julia',  dni: '31928475', departamento: 'Ciencias de la Computación', grupo: 'Bioinformática Clínica' }, rol: 'Coautor' },
    ],
  },

  // ── Tesis Pendientes ────────────────────────────────────────────────────────
  {
    id:            'PROD-006',
    tipo:          'tesis',
    titulo:        'Sistema de recomendación de tesis basado en redes neuronales para la UNMSM',
    autores:       'García Paredes, Kevin Rodrigo',
    fecha:         '2026-04-20',
    fuente:        'CYBERTESIS',
    estado:        'pendiente',
    tesista:       'García Paredes, Kevin Rodrigo',
    asesorSugerido: { id: 'INV-002', nombre: 'Gomez Llanos, Luis', dni: '40596871', departamento: 'Ingeniería de Software', grupo: 'NLP y Minería de Datos' },
    tipoTesis:     'Pregrado',
    urlCybertesis: 'https://cybertesis.unmsm.edu.pe/handle/20.500.12672/19834',
    importadoEn:   '2026-05-23T10:30:00Z',
    investigadoresVinculados: [
      { investigador: { id: 'INV-002', nombre: 'Gomez Llanos, Luis', dni: '40596871', departamento: 'Ingeniería de Software', grupo: 'NLP y Minería de Datos' }, rol: 'Asesor' },
    ],
  },
  {
    id:            'PROD-007',
    tipo:          'tesis',
    titulo:        'Implementación de modelos de IA para clasificación de enfermedades dermatológicas',
    autores:       'Quispe Mamani, Sandra',
    fecha:         '2026-03-05',
    fuente:        'CYBERTESIS',
    estado:        'pendiente',
    tesista:       'Quispe Mamani, Sandra',
    asesorSugerido: { id: 'INV-001', nombre: 'Perez Torres, Rosa', dni: '08459231', departamento: 'Ingeniería de Sistemas', grupo: 'IA en Salud Pública' },
    tipoTesis:     'Maestría',
    urlCybertesis: 'https://cybertesis.unmsm.edu.pe/handle/20.500.12672/19901',
    importadoEn:   '2026-05-24T09:00:00Z',
    investigadoresVinculados: [
      { investigador: { id: 'INV-001', nombre: 'Perez Torres, Rosa', dni: '08459231', departamento: 'Ingeniería de Sistemas', grupo: 'IA en Salud Pública' }, rol: 'Asesor' },
    ],
  },
  {
    id:            'PROD-008',
    tipo:          'tesis',
    titulo:        'Arquitectura distribuida para el procesamiento de big data en tiempo real',
    autores:       'Ccori Mamani, Renato',
    fecha:         '2025-11-14',
    fuente:        'CYBERTESIS',
    estado:        'validado',
    tesista:       'Ccori Mamani, Renato',
    tipoTesis:     'Doctorado',
    urlCybertesis: 'https://cybertesis.unmsm.edu.pe/handle/20.500.12672/18756',
    confirmadoPor: 'Ana Mendoza',
    confirmadoEn:  '2026-02-01T11:00:00Z',
    importadoEn:   '2025-12-01T08:00:00Z',
    investigadoresVinculados: [
      { investigador: { id: 'INV-003', nombre: 'Silva Ramirez, Alejandro', dni: '18293847', departamento: 'Ciencias de la Computación', grupo: 'Visión Artificial y Robótica' }, rol: 'Asesor' },
    ],
  },
];
