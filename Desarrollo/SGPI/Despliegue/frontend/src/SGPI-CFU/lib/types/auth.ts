/**
 * @file auth.ts
 * @description Tipos TypeScript para el módulo de autenticación del SGPI.
 * Cubre sesión, tokens JWT, credenciales, permisos RBAC y estados de bloqueo.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Roles del sistema (coinciden con rol_sistema en la tabla usuario de Supabase)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Roles disponibles en el sistema SGPI.
 * - admin       → Administrador: acceso total y configuración
 * - secretary   → Secretaria: gestión de datos, importación y reportes
 * - chief       → Jefe del Instituto: consulta y reportes (solo lectura avanzada)
 * - readonly    → Consulta: solo lectura básica
 */
export type UserRole = 'admin' | 'secretary' | 'chief' | 'readonly';

/**
 * Mapeo de roles del backend (base de datos) al tipo interno del frontend.
 * La BD usa nombres en español; el frontend usa nombres cortos en inglés.
 */
export const ROLE_MAP: Record<string, UserRole> = {
  Administrador: 'admin',
  Secretaria:    'secretary',
  Jefe:          'chief',
  Consulta:      'readonly',
} as const;

/**
 * Etiquetas legibles en español para cada rol.
 */
export const ROLE_LABELS: Record<UserRole, string> = {
  admin:     'Administrador',
  secretary: 'Secretaria',
  chief:     'Jefe del Instituto',
  readonly:  'Consulta',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Tokens y sesión
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Respuesta del endpoint POST /api/v1/auth/login.
 */
export interface LoginResponse {
  /** Token de acceso JWT (corta duración) */
  accessToken:  string;
  /** Token de refresco (larga duración) */
  refreshToken: string;
  /** Segundos hasta que expira el accessToken */
  expiresIn:    number;
  /** Información básica del usuario autenticado */
  user:         AuthUser;
}

/**
 * Respuesta del endpoint POST /api/v1/auth/refresh.
 */
export interface RefreshResponse {
  accessToken: string;
  expiresIn:   number;
}

/**
 * Payload decodificado de un token JWT del SGPI.
 * Incluye los claims estándar de Supabase más el rol del sistema.
 */
export interface JwtPayload {
  /** ID único del usuario (UUID de Supabase) */
  sub:         string;
  /** Correo institucional del usuario */
  email:       string;
  /** Rol del sistema en formato del backend (Administrador, Secretaria, etc.) */
  rol_sistema?: string;
  /** Rol normalizado para uso en el frontend */
  role?:       UserRole;
  /** Timestamp de emisión (Unix epoch) */
  iat:         number;
  /** Timestamp de expiración (Unix epoch) */
  exp:         number;
  /** Issuer del token */
  iss?:        string;
  /** Audience del token */
  aud?:        string | string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Usuario autenticado
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Información del usuario devuelta por el backend en /auth/me y /auth/login.
 */
export interface AuthUser {
  /** UUID del usuario en Supabase */
  id:        string;
  /** Correo institucional (@unmsm.edu.pe) */
  email:     string;
  /** Nombre completo del usuario */
  name:      string;
  /** Rol del sistema */
  role:      UserRole;
  /** Si la cuenta está activa */
  isActive:  boolean;
  /** Última fecha/hora de inicio de sesión (ISO 8601) */
  lastLogin: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Credenciales y formularios
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Credenciales enviadas al endpoint de login.
 */
export interface LoginCredentials {
  email:    string;
  password: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Estado del hook useAuth
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Estado completo de autenticación manejado por el hook useAuth.
 */
export interface AuthState {
  /** Usuario autenticado actualmente, o null si no hay sesión */
  user:              AuthUser | null;
  /** Token de acceso JWT almacenado en localStorage */
  token:             string | null;
  /** Indica si la sesión está siendo verificada (carga inicial) */
  isLoading:         boolean;
  /** Indica si el usuario está autenticado */
  isAuthenticated:   boolean;
  /** Número de intentos de login fallidos consecutivos */
  failedAttempts:    number;
  /** Timestamp hasta cuando la cuenta está bloqueada (null = no bloqueada) */
  lockedUntil:       number | null;
  /** Si debe mostrarse la advertencia de sesión por vencer */
  showExpiryWarning: boolean;
  /** Minutos restantes de sesión cuando se muestra la advertencia */
  minutesRemaining:  number;
}

/**
 * Acciones disponibles en el hook useAuth.
 */
export interface AuthActions {
  /** Inicia sesión con email y contraseña */
  login:             (credentials: LoginCredentials) => Promise<void>;
  /** Cierra la sesión y limpia el storage */
  logout:            () => Promise<void>;
  /** Renueva el token de acceso usando el refreshToken */
  refreshToken:      () => Promise<void>;
  /** Descarta la advertencia de sesión por vencer (pospone cierre) */
  dismissWarning:    () => void;
  /** Verifica si el usuario tiene permiso para una acción */
  canDo:             (action: PermissionAction) => boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Permisos RBAC
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Acciones controladas por RBAC en el sistema SGPI.
 * canDo(role, action) devuelve boolean según la matriz de permisos.
 */
export type PermissionAction =
  | 'IMPORT_DATA'        // Importar Excel al sistema
  | 'SYNC_SOURCES'       // Sincronizar fuentes externas (RENACYT, VRIP, Cybertesis)
  | 'VALIDATE_PROJECTS'  // Aprobar o descartar proyectos/publicaciones
  | 'GENERATE_REPORTS'   // Generar reportes del sistema
  | 'EXPORT_REPORTS'     // Descargar reportes en xlsx/pdf
  | 'MANAGE_USERS'       // Crear, editar y desactivar usuarios
  | 'VIEW_LOGS'          // Ver logs de auditoría
  | 'VIEW_ALL';          // Ver cualquier dato del sistema (lectura básica)

/**
 * Resultado del intento de login con detalle del error.
 */
export interface LoginResult {
  success:       boolean;
  /** Mensaje amigable en español para mostrar al usuario */
  message?:      string;
  /** Si la cuenta queda bloqueada tras este intento */
  isLocked?:     boolean;
  /** Minutos de bloqueo restantes */
  lockMinutes?:  number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuración de timeouts de sesión
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Constantes de configuración de la sesión (en milisegundos).
 */
export const SESSION_CONFIG = {
  /** Tiempo de inactividad para expirar la sesión: 30 minutos */
  INACTIVITY_TIMEOUT_MS:  30 * 60 * 1000,
  /** Tiempo antes de expirar para mostrar la advertencia: 5 minutos */
  WARNING_BEFORE_MS:       5 * 60 * 1000,
  /** Tiempo de bloqueo tras 3 intentos fallidos: 15 minutos */
  LOCK_DURATION_MS:       15 * 60 * 1000,
  /** Número máximo de intentos fallidos antes de bloquear */
  MAX_FAILED_ATTEMPTS:     3,
} as const;
