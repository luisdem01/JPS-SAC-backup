/**
 * @file _data/mock.ts
 * @description Datos mock del módulo de Reportes.
 * Sustituir con llamadas reales a POST /api/v1/reportes/generar.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Catálogos
// ─────────────────────────────────────────────────────────────────────────────

export const DEPARTAMENTOS_ACADEMICOS = [
  'Ingeniería de Sistemas',
  'Ingeniería de Software',
  'Ciencia de la Computación',
  'Ciencias de la Computación',
  'Inteligencia Artificial',
  'Ingeniería Eléctrica',
  'Ingeniería Industrial',
];

export const GRUPOS_INVESTIGACION = [
  'IA en Salud Pública',
  'Bioinformática Clínica',
  'NLP y Minería de Datos',
  'Visión Artificial y Robótica',
  'IA en Educación',
  'Seguridad Informática',
];

export const AÑOS_FISCALES = [2021, 2022, 2023, 2024, 2025, 2026];

// Los datos hardcodeados (MOCK_REGISTROS) han sido eliminados.
// El sistema ahora consume los datos reales desde SGPI-CRAPI.

