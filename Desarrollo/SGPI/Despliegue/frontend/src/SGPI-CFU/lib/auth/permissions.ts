/**
 * @file permissions.ts
 * @description Matriz de permisos RBAC del SGPI.
 * Define qué roles pueden ejecutar cada acción del sistema.
 * Implementa el principio de menor privilegio (RNF001, RNF004).
 *
 * @example
 * import { canDo } from '@/lib/SGPI-CFU/auth/permissions';
 * if (canDo('secretary', 'IMPORT_DATA')) { ... }
 */

import type { UserRole, PermissionAction } from '../types/auth';

// ─────────────────────────────────────────────────────────────────────────────
// Matriz de permisos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mapa de permisos: para cada acción, lista de roles que pueden ejecutarla.
 * Principio: denegar por defecto; solo se permite si el rol está en la lista.
 */
const PERMISSION_MATRIX: Record<PermissionAction, readonly UserRole[]> = {
  /**
   * IMPORT_DATA: Importar archivos Excel al sistema.
   * Solo admin y secretaria pueden subir datos masivos.
   */
  IMPORT_DATA: ['admin', 'secretary'],

  /**
   * SYNC_SOURCES: Sincronizar fuentes externas (RENACYT, VRIP, Cybertesis).
   * Solo admin y secretaria pueden disparar procesos ETL.
   */
  SYNC_SOURCES: ['admin', 'secretary'],

  /**
   * VALIDATE_PROJECTS: Aprobar o descartar proyectos y publicaciones.
   * Solo admin y secretaria pueden cambiar el estado de validación.
   */
  VALIDATE_PROJECTS: ['admin', 'secretary'],

  /**
   * GENERATE_REPORTS: Generar reportes consolidados del sistema.
   * Admin, secretaria y el jefe del instituto pueden generarlos.
   */
  GENERATE_REPORTS: ['admin', 'secretary', 'chief'],

  /**
   * EXPORT_REPORTS: Descargar reportes en formato xlsx o pdf.
   * Admin, secretaria y el jefe pueden exportar reportes.
   */
  EXPORT_REPORTS: ['admin', 'secretary', 'chief'],

  /**
   * MANAGE_USERS: Crear, editar y desactivar usuarios del sistema.
   * Acción exclusiva del administrador.
   */
  MANAGE_USERS: ['admin'],

  /**
   * VIEW_LOGS: Ver el log de auditoría del sistema.
   * Acción exclusiva del administrador.
   */
  VIEW_LOGS: ['admin'],

  /**
   * VIEW_ALL: Ver datos del sistema (lectura básica).
   * Disponible para todos los roles activos del sistema.
   */
  VIEW_ALL: ['admin', 'secretary', 'chief', 'readonly'],
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Función principal de verificación de permisos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verifica si un rol tiene permiso para ejecutar una acción específica.
 *
 * Esta función es la fuente de verdad del RBAC en el frontend.
 * Debe usarse antes de renderizar controles sensibles y antes de
 * cualquier llamada a la API que requiera permisos (RNF001).
 *
 * @param role   - Rol del usuario autenticado
 * @param action - Acción que se desea verificar
 * @returns true si el rol tiene permiso, false en caso contrario
 *
 * @example
 * // Verificar si la secretaria puede importar datos
 * canDo('secretary', 'IMPORT_DATA') // → true
 *
 * // Verificar si un usuario de consulta puede gestionar usuarios
 * canDo('readonly', 'MANAGE_USERS') // → false
 */
export function canDo(role: UserRole, action: PermissionAction): boolean {
  const allowedRoles = PERMISSION_MATRIX[action];
  return allowedRoles.includes(role);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de conveniencia por módulo
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verifica si un rol puede realizar operaciones de escritura
 * (importar, sincronizar o validar datos).
 *
 * @param role - Rol del usuario
 * @returns true si puede realizar operaciones de escritura
 */
export function canWrite(role: UserRole): boolean {
  return canDo(role, 'IMPORT_DATA') ||
         canDo(role, 'SYNC_SOURCES') ||
         canDo(role, 'VALIDATE_PROJECTS');
}

/**
 * Verifica si un rol puede acceder al módulo de reportes.
 *
 * @param role - Rol del usuario
 * @returns true si puede generar o exportar reportes
 */
export function canAccessReports(role: UserRole): boolean {
  return canDo(role, 'GENERATE_REPORTS') || canDo(role, 'EXPORT_REPORTS');
}

/**
 * Verifica si un rol tiene acceso al panel de administración.
 * El panel de admin requiere poder gestionar usuarios o ver logs.
 *
 * @param role - Rol del usuario
 * @returns true si puede acceder al panel de administración
 */
export function canAccessAdminPanel(role: UserRole): boolean {
  return canDo(role, 'MANAGE_USERS') || canDo(role, 'VIEW_LOGS');
}

/**
 * Devuelve todas las acciones permitidas para un rol dado.
 * Útil para depuración y pruebas.
 *
 * @param role - Rol del usuario
 * @returns Array de acciones permitidas para el rol
 */
export function getAllowedActions(role: UserRole): PermissionAction[] {
  return (Object.keys(PERMISSION_MATRIX) as PermissionAction[]).filter(
    (action) => canDo(role, action)
  );
}

/**
 * Verifica si el rol tiene acceso a un módulo específico de la navegación.
 * Centraliza la lógica de visibilidad del menú lateral.
 *
 * @param role   - Rol del usuario
 * @param module - Módulo de la interfaz
 * @returns true si el módulo debe ser visible para el rol
 */
export function canAccessModule(
  role: UserRole,
  module:
    | 'dashboard'
    | 'investigators'
    | 'projects'
    | 'publications'
    | 'calls'
    | 'import'
    | 'sync'
    | 'reports'
    | 'users'
    | 'logs'
    | 'search'
): boolean {
  switch (module) {
    case 'dashboard':
    case 'investigators':
    case 'projects':
    case 'publications':
    case 'calls':
    case 'search':
      // Todos los roles pueden ver estos módulos
      return canDo(role, 'VIEW_ALL');

    case 'import':
      return canDo(role, 'IMPORT_DATA');

    case 'sync':
      return canDo(role, 'SYNC_SOURCES');

    case 'reports':
      return canDo(role, 'GENERATE_REPORTS');

    case 'users':
      return canDo(role, 'MANAGE_USERS');

    case 'logs':
      return canDo(role, 'VIEW_LOGS');

    default:
      return false;
  }
}
