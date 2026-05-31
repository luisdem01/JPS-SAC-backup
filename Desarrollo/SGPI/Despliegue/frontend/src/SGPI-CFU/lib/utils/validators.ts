/**
 * @file validators.ts
 * @description Validaciones del lado del cliente para el SGPI.
 * Todas las validaciones retornan un mensaje de error en español
 * o null si la validación es exitosa (RNF024).
 *
 * PRINCIPIO: Validar siempre en el cliente ANTES de llamar al backend,
 * para dar feedback inmediato al usuario y reducir llamadas innecesarias.
 *
 * Incluye:
 * - Email institucional UNMSM
 * - Contraseña segura
 * - Archivos Excel y PDF
 * - Rango de fechas
 * - Campos obligatorios por formulario
 */

// ─────────────────────────────────────────────────────────────────────────────
// Tipos de retorno
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resultado de una validación individual.
 * null = válido; string = mensaje de error en español.
 */
export type ValidationResult = string | null;

/**
 * Resultado de validación de un formulario completo.
 * Mapea nombre de campo → mensaje de error (undefined = campo válido).
 */
export type FormValidationResult<T extends string = string> =
  Partial<Record<T, string>>;

// ─────────────────────────────────────────────────────────────────────────────
// Email
// ─────────────────────────────────────────────────────────────────────────────

/** Expresión regular para email institucional UNMSM */
const INSTITUTIONAL_EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@(unmsm\.edu\.pe|sanmarcos\.edu\.pe)$/i;

/** Expresión regular genérica para cualquier email válido */
const GENERIC_EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/i;

/**
 * Valida un correo institucional de la UNMSM.
 * Acepta dominios @unmsm.edu.pe y @sanmarcos.edu.pe.
 *
 * @param email - Correo a validar
 * @returns null si es válido, mensaje de error si no
 */
export function validateInstitutionalEmail(email: string): ValidationResult {
  if (!email || email.trim().length === 0) {
    return 'El correo institucional es obligatorio.';
  }

  if (!GENERIC_EMAIL_REGEX.test(email.trim())) {
    return 'El formato del correo electrónico no es válido.';
  }

  if (!INSTITUTIONAL_EMAIL_REGEX.test(email.trim())) {
    return 'Debe utilizar su correo institucional (@unmsm.edu.pe).';
  }

  const username = email.trim().split('@')[0];
  if (/^\d+$/.test(username)) {
    return 'No se permiten correos basados en DNI.';
  }

  return null;
}

/**
 * Valida cualquier correo electrónico con formato válido.
 * Para usuarios que no necesariamente son de la UNMSM.
 *
 * @param email - Correo a validar
 * @returns null si es válido, mensaje de error si no
 */
export function validateEmail(email: string): ValidationResult {
  if (!email || email.trim().length === 0) {
    return 'El correo electrónico es obligatorio.';
  }

  if (!GENERIC_EMAIL_REGEX.test(email.trim())) {
    return 'El formato del correo electrónico no es válido.';
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Contraseña
// ─────────────────────────────────────────────────────────────────────────────

/** Requisitos mínimos de la contraseña */
const PASSWORD_RULES = {
  minLength:         8,
  requireUppercase:  true,
  requireNumber:     true,
  requireSpecial:    true,
} as const;

const SPECIAL_CHARS_REGEX    = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/;
const UPPERCASE_REGEX        = /[A-Z]/;
const NUMBER_REGEX           = /[0-9]/;

/**
 * Valida que una contraseña cumpla los requisitos de seguridad del SGPI.
 * - Mínimo 8 caracteres
 * - Al menos una mayúscula
 * - Al menos un número
 * - Al menos un carácter especial
 *
 * @param password - Contraseña a validar
 * @returns null si es válida, mensaje de error si no
 */
export function validatePassword(password: string): ValidationResult {
  if (!password) {
    return 'La contraseña es obligatoria.';
  }

  if (password.length < PASSWORD_RULES.minLength) {
    return `La contraseña debe tener al menos ${PASSWORD_RULES.minLength} caracteres.`;
  }

  if (!UPPERCASE_REGEX.test(password)) {
    return 'La contraseña debe contener al menos una letra mayúscula.';
  }

  if (!NUMBER_REGEX.test(password)) {
    return 'La contraseña debe contener al menos un número.';
  }

  if (!SPECIAL_CHARS_REGEX.test(password)) {
    return 'La contraseña debe contener al menos un carácter especial (ej: !, @, #, $).';
  }

  return null;
}

/**
 * Valida que dos contraseñas coincidan.
 *
 * @param password        - Contraseña original
 * @param confirmPassword - Confirmación de la contraseña
 * @returns null si coinciden, mensaje de error si no
 */
export function validatePasswordConfirmation(
  password:        string,
  confirmPassword: string
): ValidationResult {
  if (!confirmPassword) {
    return 'Debe confirmar la contraseña.';
  }

  if (password !== confirmPassword) {
    return 'Las contraseñas no coinciden.';
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Archivos
// ─────────────────────────────────────────────────────────────────────────────

/** Tamaño máximo para archivos Excel: 10 MB en bytes */
const MAX_EXCEL_SIZE_BYTES = 10 * 1024 * 1024;

/** Tamaño máximo para archivos PDF: 50 MB en bytes */
const MAX_PDF_SIZE_BYTES = 50 * 1024 * 1024;

/** Extensiones válidas para archivos Excel */
const VALID_EXCEL_TYPES = [
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream', // Algunos navegadores usan esto para .xlsx
];

/** Extensiones válidas para archivos PDF */
const VALID_PDF_TYPES = ['application/pdf'];

/**
 * Valida un archivo Excel (.xlsx o .xls) para importación.
 * - Extensión debe ser .xlsx o .xls
 * - Tamaño máximo: 10 MB
 *
 * @param file - Archivo a validar
 * @returns null si es válido, mensaje de error si no
 */
export function validateExcelFile(file: File | null | undefined): ValidationResult {
  if (!file) {
    return 'Debe seleccionar un archivo Excel (.xlsx o .xls).';
  }

  const ext      = file.name.split('.').pop()?.toLowerCase();
  const isXlsExt = ext === 'xlsx' || ext === 'xls';

  if (!isXlsExt) {
    return 'El archivo debe tener extensión .xlsx o .xls.';
  }

  const isValidMime =
    VALID_EXCEL_TYPES.includes(file.type) ||
    file.type === '' || // Algunos sistemas no detectan el MIME
    isXlsExt;          // La extensión ya la validamos

  if (!isValidMime) {
    return 'El archivo no es un Excel válido. Use formato .xlsx o .xls.';
  }

  if (file.size > MAX_EXCEL_SIZE_BYTES) {
    const maxMb = MAX_EXCEL_SIZE_BYTES / (1024 * 1024);
    const fileMb = (file.size / (1024 * 1024)).toFixed(1);
    return `El archivo es demasiado grande (${fileMb} MB). El tamaño máximo es ${maxMb} MB.`;
  }

  if (file.size === 0) {
    return 'El archivo está vacío. Por favor, seleccione un archivo válido.';
  }

  return null;
}

/**
 * Valida un archivo PDF para adjuntar como evidencia.
 * - Tipo MIME debe ser application/pdf
 * - Tamaño máximo: 50 MB
 *
 * @param file - Archivo a validar
 * @returns null si es válido, mensaje de error si no
 */
export function validatePdfFile(file: File | null | undefined): ValidationResult {
  if (!file) {
    return 'Debe seleccionar un archivo PDF.';
  }

  const ext   = file.name.split('.').pop()?.toLowerCase();
  const isPdf = VALID_PDF_TYPES.includes(file.type) || ext === 'pdf';

  if (!isPdf) {
    return 'El archivo debe ser un PDF válido (.pdf).';
  }

  if (file.size > MAX_PDF_SIZE_BYTES) {
    const maxMb  = MAX_PDF_SIZE_BYTES / (1024 * 1024);
    const fileMb = (file.size / (1024 * 1024)).toFixed(1);
    return `El archivo es demasiado grande (${fileMb} MB). El tamaño máximo es ${maxMb} MB.`;
  }

  if (file.size === 0) {
    return 'El archivo PDF está vacío. Por favor, seleccione un archivo válido.';
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fechas y rangos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Valida que una fecha sea válida y no esté vacía.
 *
 * @param dateStr - Fecha en formato ISO 8601 o "YYYY-MM-DD"
 * @param label   - Nombre del campo para el mensaje de error
 * @returns null si es válida, mensaje de error si no
 */
export function validateDate(
  dateStr: string | null | undefined,
  label:   string = 'La fecha'
): ValidationResult {
  if (!dateStr || dateStr.trim().length === 0) {
    return `${label} es obligatoria.`;
  }

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return `${label} no tiene un formato válido.`;
  }

  return null;
}

/**
 * Valida que un rango de fechas sea válido (fecha de inicio antes de fin).
 *
 * @param startDate - Fecha de inicio (ISO 8601)
 * @param endDate   - Fecha de fin (ISO 8601)
 * @returns null si el rango es válido, mensaje de error si no
 */
export function validateDateRange(
  startDate: string | null | undefined,
  endDate:   string | null | undefined
): ValidationResult {
  const startErr = validateDate(startDate, 'La fecha de inicio');
  if (startErr) return startErr;

  const endErr = validateDate(endDate, 'La fecha de fin');
  if (endErr) return endErr;

  const start = new Date(startDate!);
  const end   = new Date(endDate!);

  if (start >= end) {
    return 'La fecha de inicio debe ser anterior a la fecha de fin.';
  }

  return null;
}

/**
 * Valida que una fecha no sea en el pasado.
 *
 * @param dateStr - Fecha a verificar
 * @param label   - Nombre del campo para el mensaje de error
 * @returns null si es válida, mensaje de error si es pasado
 */
export function validateFutureDate(
  dateStr: string | null | undefined,
  label:   string = 'La fecha'
): ValidationResult {
  const basicErr = validateDate(dateStr, label);
  if (basicErr) return basicErr;

  const date = new Date(dateStr!);
  const now  = new Date();
  now.setHours(0, 0, 0, 0); // Comparar solo por día

  if (date < now) {
    return `${label} no puede ser en el pasado.`;
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Campos de texto obligatorios
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Valida que un campo de texto no esté vacío.
 *
 * @param value   - Valor del campo
 * @param label   - Nombre del campo para el mensaje de error
 * @param minLen  - Longitud mínima (default: 1)
 * @param maxLen  - Longitud máxima (optional)
 * @returns null si es válido, mensaje de error si no
 */
export function validateRequired(
  value:  string | null | undefined,
  label:  string,
  minLen: number = 1,
  maxLen?: number
): ValidationResult {
  if (!value || value.trim().length === 0) {
    return `${label} es obligatorio.`;
  }

  if (value.trim().length < minLen) {
    return `${label} debe tener al menos ${minLen} caracteres.`;
  }

  if (maxLen && value.trim().length > maxLen) {
    return `${label} no puede exceder ${maxLen} caracteres.`;
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// DNI peruano
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Valida un DNI peruano (8 dígitos numéricos).
 *
 * @param dni - DNI a validar
 * @returns null si es válido, mensaje de error si no
 */
export function validateDNI(dni: string | null | undefined): ValidationResult {
  if (!dni || dni.trim().length === 0) {
    return 'El DNI es obligatorio.';
  }

  const cleaned = dni.trim().replace(/\s/g, '');

  if (!/^\d{8}$/.test(cleaned)) {
    return 'El DNI debe tener exactamente 8 dígitos numéricos.';
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// ORCID
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Valida un identificador ORCID.
 * Formato: 0000-0000-0000-0000 (16 dígitos en grupos de 4)
 *
 * @param orcid - ORCID a validar
 * @returns null si es válido o está vacío (es opcional), mensaje de error si el formato es incorrecto
 */
export function validateOrcid(orcid: string | null | undefined): ValidationResult {
  if (!orcid || orcid.trim().length === 0) {
    return null; // ORCID es opcional
  }

  const ORCID_REGEX = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;
  if (!ORCID_REGEX.test(orcid.trim())) {
    return 'El ORCID debe tener el formato 0000-0000-0000-0000.';
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Validaciones de formularios completos
// ─────────────────────────────────────────────────────────────────────────────

/** Campos del formulario de login */
export type LoginFields = 'email' | 'password';

/**
 * Valida el formulario de inicio de sesión.
 * Implementa RNF024: validaciones del lado del cliente antes de llamar al backend.
 *
 * @param values - Valores del formulario
 * @returns Objeto con errores por campo (vacío si todos son válidos)
 */
export function validateLoginForm(
  values: { email: string; password: string }
): FormValidationResult<LoginFields> {
  const errors: FormValidationResult<LoginFields> = {};

  const emailErr = validateInstitutionalEmail(values.email);
  if (emailErr) errors.email = emailErr;

  if (!values.password) {
    errors.password = 'La contraseña es obligatoria.';
  }

  return errors;
}

/** Campos del formulario de creación de usuario */
export type CreateUserFields = 'email' | 'name' | 'role' | 'password' | 'confirmPassword';

/**
 * Valida el formulario de creación de nuevo usuario.
 *
 * @param values - Valores del formulario
 * @returns Objeto con errores por campo
 */
export function validateCreateUserForm(
  values: {
    email:           string;
    name:            string;
    role:            string;
    password:        string;
    confirmPassword: string;
  }
): FormValidationResult<CreateUserFields> {
  const errors: FormValidationResult<CreateUserFields> = {};

  const emailErr = validateInstitutionalEmail(values.email);
  if (emailErr) errors.email = emailErr;

  const nameErr = validateRequired(values.name, 'El nombre completo', 3, 200);
  if (nameErr) errors.name = nameErr;

  if (!values.role) {
    errors.role = 'Debe seleccionar un rol para el usuario.';
  }

  const passErr = validatePassword(values.password);
  if (passErr) errors.password = passErr;

  const confirmErr = validatePasswordConfirmation(values.password, values.confirmPassword);
  if (confirmErr) errors.confirmPassword = confirmErr;

  return errors;
}

/**
 * Verifica si un objeto de errores de formulario está vacío (sin errores).
 *
 * @param errors - Resultado de la validación del formulario
 * @returns true si el formulario es válido (sin errores)
 */
export function isFormValid<T extends string>(
  errors: FormValidationResult<T>
): boolean {
  return Object.keys(errors).length === 0;
}
