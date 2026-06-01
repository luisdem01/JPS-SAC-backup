/**
 * @file formatters.ts
 * @description Formateadores de datos para la interfaz del SGPI.
 * Todos los formatos están adaptados al español peruano (es-PE).
 *
 * Incluye:
 * - Fechas en español peruano
 * - Moneda en soles (PEN)
 * - Números con separadores de miles
 * - Porcentajes de progreso
 * - Tamaño de archivos (KB, MB, GB)
 * - Urgencia de convocatoria a texto legible
 * - Estado de proyecto a etiqueta con color
 * - Rol del sistema a nombre legible
 */

import type { ProjectStatus, CallUrgency } from '../types/models';
import type { UserRole }                   from '../types/auth';

// ─────────────────────────────────────────────────────────────────────────────
// Locale base para el español peruano
// ─────────────────────────────────────────────────────────────────────────────

const LOCALE_ES_PE = 'es-PE';

// ─────────────────────────────────────────────────────────────────────────────
// Fechas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Formatea una fecha ISO 8601 en formato largo en español peruano.
 * Ej: "15 de enero de 2024"
 *
 * @param dateStr - Fecha en formato ISO 8601 o compatible con Date
 * @returns Fecha formateada, o "—" si el valor es nulo/inválido
 */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '—';

  return date.toLocaleDateString(LOCALE_ES_PE, {
    day:   'numeric',
    month: 'long',
    year:  'numeric',
  });
}

/**
 * Formatea una fecha ISO 8601 en formato corto.
 * Ej: "15/01/2024"
 *
 * @param dateStr - Fecha en formato ISO 8601
 * @returns Fecha en formato corto, o "—" si es inválida
 */
export function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '—';

  return date.toLocaleDateString(LOCALE_ES_PE, {
    day:   '2-digit',
    month: '2-digit',
    year:  'numeric',
  });
}

/**
 * Formatea un timestamp ISO 8601 con fecha y hora.
 * Ej: "15/01/2024, 10:30 a. m."
 *
 * @param dateStr - Timestamp en formato ISO 8601
 * @returns Fecha y hora formateadas, o "—" si es inválida
 */
export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '—';

  return date.toLocaleString(LOCALE_ES_PE, {
    day:    '2-digit',
    month:  '2-digit',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formatea una fecha relativa al momento actual.
 * Ej: "hace 2 días", "en 3 semanas"
 *
 * @param dateStr - Fecha en formato ISO 8601
 * @returns Descripción relativa de la fecha
 */
export function formatRelativeDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '—';

  const diffMs   = date.getTime() - Date.now();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (Math.abs(diffDays) < 1)  return 'hoy';
  if (diffDays === 1)           return 'mañana';
  if (diffDays === -1)          return 'ayer';
  if (diffDays > 0) {
    if (diffDays < 7)           return `en ${diffDays} días`;
    if (diffDays < 30)          return `en ${Math.round(diffDays / 7)} semanas`;
    if (diffDays < 365)         return `en ${Math.round(diffDays / 30)} meses`;
    return `en ${Math.round(diffDays / 365)} años`;
  } else {
    const absDays = Math.abs(diffDays);
    if (absDays < 7)            return `hace ${absDays} días`;
    if (absDays < 30)           return `hace ${Math.round(absDays / 7)} semanas`;
    if (absDays < 365)          return `hace ${Math.round(absDays / 30)} meses`;
    return `hace ${Math.round(absDays / 365)} años`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Números y moneda
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Formatea un número con separadores de miles en español peruano.
 * Ej: 1234567 → "1.234.567"
 *
 * @param value    - Número a formatear
 * @param decimals - Número de decimales (default: 0)
 * @returns Número formateado, o "—" si es nulo/inválido
 */
export function formatNumber(
  value:    number | null | undefined,
  decimals: number = 0
): string {
  if (value === null || value === undefined || isNaN(value)) return '—';

  return value.toLocaleString(LOCALE_ES_PE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Formatea un monto en soles peruanos (PEN).
 * Ej: 15000 → "S/ 15,000.00"
 *
 * @param amount - Monto en soles
 * @returns Monto formateado en PEN, o "—" si es nulo/inválido
 */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return '—';

  return new Intl.NumberFormat(LOCALE_ES_PE, {
    style:    'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Formatea un porcentaje de progreso.
 * Ej: 0.756 → "75.6 %" / 75 → "75 %"
 *
 * @param value      - Valor del porcentaje (0-100 o 0-1 si isDecimal=true)
 * @param isDecimal  - Si true, multiplica por 100 antes de formatear
 * @returns Porcentaje formateado, o "—" si es nulo/inválido
 */
export function formatPercent(
  value:     number | null | undefined,
  isDecimal: boolean = false
): string {
  if (value === null || value === undefined || isNaN(value)) return '—';

  const pct = isDecimal ? value * 100 : value;
  const clamped = Math.max(0, Math.min(100, pct));

  return `${formatNumber(clamped, clamped % 1 === 0 ? 0 : 1)} %`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tamaño de archivos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Formatea un tamaño de archivo en bytes a la unidad apropiada.
 * Ej: 1536 → "1.5 KB" / 2097152 → "2.0 MB"
 *
 * @param bytes - Tamaño en bytes
 * @returns Tamaño formateado con unidad, o "—" si es nulo/inválido
 */
export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || isNaN(bytes)) return '—';
  if (bytes === 0) return '0 B';

  const units  = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index  = Math.floor(Math.log(bytes) / Math.log(1024));
  const size   = bytes / Math.pow(1024, index);
  const unitIndex = Math.min(index, units.length - 1);

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Estado de proyecto
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convierte el estado interno de un proyecto a su etiqueta en español.
 * Ej: "active" → "En ejecución"
 *
 * @param status - Estado interno del proyecto
 * @returns Etiqueta legible en español
 */
export function formatProjectStatus(status: ProjectStatus | string): string {
  const labels: Record<string, string> = {
    pending:   'Pendiente',
    active:    'En ejecución',
    completed: 'Concluido',
    cancelled: 'Cancelado',
    // Estados de la BD en español (compatibilidad)
    Formulación:   'Formulación',
    Aprobado:      'Aprobado',
    'En ejecución':'En ejecución',
    Concluido:     'Concluido',
    Cancelado:     'Cancelado',
  };
  return labels[status] ?? status;
}

/**
 * Devuelve la clase CSS de color para el badge de estado del proyecto.
 * Compatible con Tailwind CSS.
 *
 * @param status - Estado del proyecto
 * @returns Clases CSS de Tailwind para el badge
 */
export function getProjectStatusClasses(status: ProjectStatus | string): string {
  const classes: Record<string, string> = {
    pending:     'bg-yellow-100 text-yellow-800 border border-yellow-300',
    active:      'bg-green-100 text-green-800 border border-green-300',
    completed:   'bg-blue-100 text-blue-800 border border-blue-300',
    cancelled:   'bg-red-100 text-red-800 border border-red-300',
  };
  return classes[status] ?? 'bg-gray-100 text-gray-800 border border-gray-300';
}

// ─────────────────────────────────────────────────────────────────────────────
// Urgencia de convocatoria
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convierte el nivel de urgencia de una convocatoria a texto legible.
 * Ej: "red" → "Urgente" / "yellow" → "Próxima" / "green" → "Normal"
 *
 * @param urgency - Nivel de urgencia calculado por la BD
 * @returns Texto legible en español
 */
export function formatCallUrgency(urgency: CallUrgency | string): string {
  const labels: Record<string, string> = {
    red:    'Urgente',
    yellow: 'Próxima',
    green:  'Normal',
  };
  return labels[urgency] ?? urgency;
}

/**
 * Devuelve la clase CSS de color para el semáforo de urgencia.
 * Compatible con Tailwind CSS.
 *
 * @param urgency - Nivel de urgencia
 * @returns Clases CSS de Tailwind para el indicador
 */
export function getUrgencyClasses(urgency: CallUrgency | string): string {
  const classes: Record<string, string> = {
    red:    'bg-red-500 text-white',
    yellow: 'bg-yellow-400 text-yellow-900',
    green:  'bg-green-500 text-white',
  };
  return classes[urgency] ?? 'bg-gray-400 text-white';
}

/**
 * Formatea los días restantes de una convocatoria con texto contextual.
 * Ej: 3 → "3 días restantes" / 0 → "Cierra hoy" / -1 → "Vencida"
 *
 * @param days - Días restantes (negativo = vencida)
 * @returns Texto descriptivo de los días restantes
 */
export function formatDaysRemaining(days: number): string {
  if (days < 0)  return 'Convocatoria vencida';
  if (days === 0) return 'Cierra hoy';
  if (days === 1) return '1 día restante';
  return `${days} días restantes`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Roles de usuario
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convierte el rol interno a su nombre legible en español.
 * Ej: "admin" → "Administrador"
 *
 * @param role - Rol interno del usuario
 * @returns Nombre legible del rol
 */
export function formatRole(role: UserRole | string): string {
  const labels: Record<string, string> = {
    admin:     'Administrador',
    secretary: 'Secretaria',
    chief:     'Jefe del Instituto',
    readonly:  'Consulta',
  };
  return labels[role] ?? role;
}

// ─────────────────────────────────────────────────────────────────────────────
// Match confidence (confianza del match automático)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convierte el nivel de confianza del match a texto y color.
 *
 * @param confidence - Nivel de confianza ("high" | "medium" | "manual")
 * @returns Objeto con label y clases CSS
 */
export function formatMatchConfidence(
  confidence: 'high' | 'medium' | 'manual' | string
): { label: string; classes: string } {
  const map: Record<string, { label: string; classes: string }> = {
    high:   { label: 'Alta confianza',  classes: 'bg-green-100 text-green-800' },
    medium: { label: 'Media confianza', classes: 'bg-yellow-100 text-yellow-800' },
    manual: { label: 'Manual',          classes: 'bg-gray-100 text-gray-700' },
  };
  return map[confidence] ?? { label: confidence, classes: 'bg-gray-100 text-gray-700' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Progreso de job asíncrono
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Formatea el progreso de un job asíncrono para mostrar en UI.
 * Ej: { progress: 45, status: 'running' } → "Procesando... 45 %"
 *
 * @param progress - Porcentaje de avance (0-100)
 * @param status   - Estado actual del job
 * @returns Texto descriptivo del progreso
 */
export function formatJobProgress(
  progress: number,
  status:   'queued' | 'running' | 'completed' | 'failed' | null
): string {
  switch (status) {
    case 'queued':    return 'En cola...';
    case 'running':   return `Procesando... ${Math.round(progress)} %`;
    case 'completed': return 'Completado exitosamente';
    case 'failed':    return 'El proceso falló';
    default:          return '—';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Texto truncado
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Trunca un texto largo añadiendo "..." al final.
 *
 * @param text    - Texto a truncar
 * @param maxLen  - Longitud máxima (default: 80)
 * @returns Texto truncado con "..." o el original si es corto
 */
export function truncate(text: string | null | undefined, maxLen: number = 80): string {
  if (!text) return '—';
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 3).trimEnd()}...`;
}
