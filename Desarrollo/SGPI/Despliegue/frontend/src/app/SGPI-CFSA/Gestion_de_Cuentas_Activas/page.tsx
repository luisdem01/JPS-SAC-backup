'use client';

/**
 * @file page.tsx
 * @route /SGPI-CFSA/Gestión_de_Cuentas_Activas
 * @description Pantalla "Gestión de Cuentas Activas" del módulo Configuración del Sistema.
 *
 * Muestra:
 * - Tabs de navegación: "Gestión de Cuentas" | "Parámetros de Operación"
 * - Listado de usuarios con columnas: USUARIO, CORREO INSTITUCIONAL, ROL, ESTADO, ACCIONES
 * - Toggle de activación/desactivación por usuario
 * - Botón "Crear Nuevo Usuario" (solo rol admin)
 * - Icono de edición por fila (solo rol admin)
 *
 * Permisos: Solo admin puede MANAGE_USERS. El resto solo visualiza.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { MainLayout }                               from '@/SGPI-CFU/components/layout';
import { Button, Badge, Modal, Input, Select, Toast } from '@/SGPI-CFU/components/ui';
// import { useAuth }                               from '@/SGPI-CFU/lib/hooks';
import { canDo }                                    from '@/SGPI-CFU/lib/auth/permissions';
import type { User }                                from '@/SGPI-CFU/lib/types/models';
import type { UserRole }                            from '@/SGPI-CFU/lib/types/auth';
import { ROLE_LABELS, ROLE_MAP }                    from '@/SGPI-CFU/lib/types/auth';
import { capiacService }                            from '../_data/capiacService';

// ── Mock temporal de useAuth (sin backend) ───────────────────────────────────
// TODO: reemplazar por useAuth real cuando el backend esté disponible
function useMockAuth() {
  return {
    user: {
      id: 'mock-1',
      name: 'Ana Mendoza',
      email: 'amendoza@unmsm.edu.pe',
      role: 'admin' as UserRole,
    },
  };
}


// ─────────────────────────────────────────────────────────────────────────────
// Tipos locales
// ─────────────────────────────────────────────────────────────────────────────

type Tab = 'cuentas' | 'parametros';

// ─────────────────────────────────────────────────────────────────────────────
// Datos mock (reemplazar por llamada a API cuando el endpoint exista)
// ─────────────────────────────────────────────────────────────────────────────

// MOCK_USERS removed. Data now comes from API

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponente: Toggle de estado
// ─────────────────────────────────────────────────────────────────────────────

interface ToggleProps {
  checked:  boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  id:       string;
}

function Toggle({ checked, onChange, disabled = false, id }: ToggleProps) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`
        relative inline-flex items-center
        w-10 h-5 rounded-full
        transition-colors duration-200
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#a8c8fa]
        ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
        ${checked ? 'bg-[#059669]' : 'bg-[#c3c6d0]'}
      `}
    >
      <span
        className={`
          absolute top-[2px]
          inline-block w-4 h-4 rounded-full bg-white
          shadow-sm transition-transform duration-200
          ${checked ? 'translate-x-[22px]' : 'translate-x-[2px]'}
        `}
      />
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponente: Icono Ojo (ver)
// ─────────────────────────────────────────────────────────────────────────────

function EyeIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="15" height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponente: Icono Plus
// ─────────────────────────────────────────────────────────────────────────────

function PlusIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14" height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5"  y1="12" x2="19" y2="12" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Valores iniciales de los Parámetros de Operación
// ─────────────────────────────────────────────────────────────────────────────

const INITIAL_PARAMS = {
  'scraping.vrip.url_base': '',
  'scraping.cybertesis.url_base': '',
  'scraping.frecuencia_horas': '',
  'alertas.semaforo_rojo_dias': '',
  'alertas.semaforo_amarillo_dias': '',
  'carga_no_lectiva.maximo_horas_semanales': '',
  'reportes.limite_filas_export': '',
};

type ParamKey = keyof typeof INITIAL_PARAMS;
type ParamState = Record<ParamKey, string>;

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponente: Sección Parámetros de Operación
// ─────────────────────────────────────────────────────────────────────────────

interface ParametrosOperacionProps {
  /** Callback que se dispara cuando el usuario guarda exitosamente */
  onSaved: () => void;
}

function ParametrosOperacion({ onSaved }: ParametrosOperacionProps) {
  // Estado de cada campo editable
  const [params, setParams] = useState<ParamState>({ ...INITIAL_PARAMS });

  // Último estado confirmado (tras "Aplicar Cambios" o estado inicial)
  const [savedParams, setSavedParams] = useState<ParamState>({ ...INITIAL_PARAMS });
  
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const data = await capiacService.getConfiguraciones();
        const newParams: ParamState = { ...INITIAL_PARAMS };
        data.forEach(c => {
          if (c.clave in newParams) {
            newParams[c.clave as ParamKey] = String(c.valor);
          }
        });
        setParams(newParams);
        setSavedParams(newParams);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchConfig();
  }, []);

  // Hay cambios pendientes si cualquier campo difiere del guardado
  const hasChanges = Object.keys(params).some(
    (key) => params[key as ParamKey] !== savedParams[key as ParamKey]
  );

  // Actualiza el campo correspondiente en el estado
  const handleChange = (key: ParamKey) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setParams((prev) => ({ ...prev, [key]: e.target.value }));
  };

  // Guardar cambios → persiste el estado y notifica al padre
  const handleAplicar = async () => {
    if (!hasChanges) return;
    try {
      const promises = [];
      for (const key of Object.keys(params) as ParamKey[]) {
        if (params[key] !== savedParams[key]) {
          // Si el valor debe ser número y no es URL
          let valueToSave: any = params[key];
          if (!key.includes('url_base') && !isNaN(Number(valueToSave)) && valueToSave !== '') {
            valueToSave = Number(valueToSave);
          }
          promises.push(capiacService.updateConfiguracion(key, valueToSave));
        }
      }
      await Promise.all(promises);
      setSavedParams({ ...params });
      onSaved();
    } catch (err) {
      console.error(err);
    }
  };

  const SaveIcon = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
      <polyline points="17 21 17 13 7 13 7 21"/>
      <polyline points="7 3 7 8 15 8"/>
    </svg>
  );

  return (
    <div className="flex flex-col">
      {/* ── Cabecera ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 text-[#001631]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          <h2 className="font-sans font-bold text-[15px]">Configuración Global</h2>
        </div>

        {/*
          Botón "Aplicar Cambios":
          · Sin cambios → variant="secondary" + disabled (estilo bloqueado: gris, cursor-not-allowed)
          · Con cambios  → variant="primary"  (navy sólido, totalmente activo, hover habilitado)
        */}
        <Button
          id="btn-aplicar-cambios"
          variant={hasChanges ? 'primary' : 'secondary'}
          size="sm"
          disabled={!hasChanges}
          iconLeft={SaveIcon}
          onClick={handleAplicar}
        >
          Aplicar Cambios
        </Button>
      </div>

      {/* ── Primera sección: Scraping ────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 mb-6">
        <h3 className="font-sans font-bold text-[13px] text-[#0f172a]">
          Módulo de Scraping (Convocatorias y Entregables)
        </h3>
        <div className="flex flex-wrap gap-6 mt-1">
          <div className="flex flex-col gap-1.5 flex-1 min-w-[280px]">
            <label className="font-sans font-bold text-[12px] text-[#0f172a]">
              URL Base VRIP
            </label>
            <Input
              id="param-vrip-url"
              value={params['scraping.vrip.url_base']}
              onChange={handleChange('scraping.vrip.url_base')}
              placeholder="https://vrip.unmsm.edu.pe"
            />
          </div>
          <div className="flex flex-col gap-1.5 flex-1 min-w-[280px]">
            <label className="font-sans font-bold text-[12px] text-[#0f172a]">
              URL Base Cybertesis
            </label>
            <Input
              id="param-cybertesis-url"
              value={params['scraping.cybertesis.url_base']}
              onChange={handleChange('scraping.cybertesis.url_base')}
              placeholder="https://cybertesis.unmsm.edu.pe"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="param-frecuencia" className="font-sans font-bold text-[12px] text-[#0f172a]">
              Frecuencia de Actualización
            </label>
            <div className="flex items-center gap-2">
              <Input
                id="param-frecuencia"
                value={params['scraping.frecuencia_horas']}
                onChange={handleChange('scraping.frecuencia_horas')}
                className="w-[60px] text-center"
              />
              <span className="font-sans text-[13px] text-[#64748b]">Horas</span>
            </div>
          </div>
        </div>
      </div>

      <hr className="border-[#e2e8f0] mb-6" />

      {/* ── Segunda sección: Alertas ──────────────────────────────────────── */}
      <div className="flex flex-col gap-3 mb-6">
        <h3 className="font-sans font-bold text-[13px] text-[#0f172a]">
          Umbrales de Semaforización (Alertas)
        </h3>

        <div className="flex gap-6 mt-1">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="param-alerta-roja"
              className="font-sans font-bold text-[11px] text-[#dc2626]"
            >
              Alerta Roja (Días &lt;=)
            </label>
            <input
              id="param-alerta-roja"
              type="text"
              value={params['alertas.semaforo_rojo_dias']}
              onChange={handleChange('alertas.semaforo_rojo_dias')}
              className="w-40 px-3 py-1.5 font-sans font-medium text-[13px] text-[#dc2626] bg-white border border-[#fca5a5] rounded outline-none focus:ring-2 focus:ring-[#fecaca] transition-all"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="param-alerta-amarilla"
              className="font-sans font-bold text-[11px] text-[#d97706]"
            >
              Alerta Amarilla (Días &lt;=)
            </label>
            <input
              id="param-alerta-amarilla"
              type="text"
              value={params['alertas.semaforo_amarillo_dias']}
              onChange={handleChange('alertas.semaforo_amarillo_dias')}
              className="w-40 px-3 py-1.5 font-sans font-medium text-[13px] text-[#d97706] bg-white border border-[#fcd34d] rounded outline-none focus:ring-2 focus:ring-[#fde68a] transition-all"
            />
          </div>
        </div>
      </div>

      <hr className="border-[#e2e8f0] mb-6" />

      {/* ── Tercera sección: Reglas y Reportes ──────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <h3 className="font-sans font-bold text-[13px] text-[#0f172a]">
          Configuraciones Adicionales
        </h3>

        <div className="flex gap-6 mt-1">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="param-max-horas"
              className="font-sans font-bold text-[11px] text-[#0f172a]"
            >
              Límite Máx. Horas Semanales (Carga no Lectiva)
            </label>
            <Input
              id="param-max-horas"
              value={params['carga_no_lectiva.maximo_horas_semanales']}
              onChange={handleChange('carga_no_lectiva.maximo_horas_semanales')}
              className="w-40"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="param-limite-export"
              className="font-sans font-bold text-[11px] text-[#0f172a]"
            >
              Límite Filas Exportación
            </label>
            <Input
              id="param-limite-export"
              value={params['reportes.limite_filas_export']}
              onChange={handleChange('reportes.limite_filas_export')}
              className="w-40"
            />
          </div>
        </div>
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────────────────────────────────────

export default function GestionDeCuentasActivasPage() {
  const { user }         = useMockAuth();
  const [activeTab, setActiveTab] = useState<Tab>('cuentas');
  const [users, setUsers]         = useState<User[]>([]);
  const [errorMsg, setErrorMsg]   = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen]     = useState(false);
  const [selectedUser, setSelectedUser]           = useState<User | null>(null);
  const [newUserNombre, setNewUserNombre] = useState('');
  const [newUserEmail,  setNewUserEmail]  = useState('');
  const [newUserRole, setNewUserRole] = useState<string>('Consulta');
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);

  // Cargar usuarios
  const fetchUsers = useCallback(async () => {
    try {
      setIsLoadingUsers(true);
      const data = await capiacService.getUsuarios();
      const mappedUsers: User[] = data.map(u => ({
        id: u.id_usuario,
        email: u.correo_institucional,
        name: u.correo_institucional.split('@')[0], // Placeholder para el nombre
        role: ROLE_MAP[u.rol_sistema] || 'readonly',
        isActive: u.estado_cuenta,
        createdAt: u.created_at
      }));
      setUsers(mappedUsers);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al cargar usuarios');
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Resetea los campos al cerrar el modal
  const handleCloseModal = useCallback(() => {
    setIsCreateModalOpen(false);
    setNewUserNombre('');
    setNewUserEmail('');
  }, []);

  const canGuardarUsuario = newUserNombre.trim() !== '' && newUserEmail.trim() !== '';

  // ── Toast de éxito (mensaje dinámico; null = oculto) ─────────────────────
  const [toast, setToast] = useState<{ title: string; description?: string } | null>(null);

  const showToast = useCallback((title: string, description?: string) => {
    setToast({ title, description });
  }, []);

  const handleParamsSaved = useCallback(() => {
    showToast(
      'Configuración global actualizada exitosamente.',
      'Los cambios aplicarán en la próxima ejecución.',
    );
  }, [showToast]);

  const handleUsuarioCreado = useCallback(() => {
    showToast('Usuario nuevo creado exitosamente.');
  }, [showToast]);

  // Auto-cierra el Toast después de 4 s
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);



  const puedeGestionar = user ? canDo(user.role, 'MANAGE_USERS') : false;

  // ── Cambiar estado activo de un usuario ──────────────────────────────────
  const handleToggleActivo = useCallback(async (userId: string, nuevoEstado: boolean) => {
    if (!puedeGestionar) {
      setErrorMsg('No tienes permisos para cambiar el estado de una cuenta.');
      return;
    }
    try {
      await capiacService.toggleEstadoUsuario(userId, nuevoEstado);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, isActive: nuevoEstado } : u))
      );
      showToast('Estado actualizado exitosamente');
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al cambiar el estado del usuario');
    }
  }, [puedeGestionar, showToast]);

  // ── Acción "Crear Nuevo Usuario" (stub) ─────────────────────────────────
  const handleCrearUsuario = useCallback(() => {
    if (!puedeGestionar) {
      setErrorMsg('No tienes permisos para crear usuarios.');
      return;
    }
    setIsCreateModalOpen(true);
  }, [puedeGestionar]);

  // ── Acción "Ver detalles usuario" ───────────────────────────────────────
  const handleVer = useCallback((user: User) => {
    setSelectedUser(user);
    setIsViewModalOpen(true);
  }, []);

  // Limpiar error tras 5 s
  useEffect(() => {
    if (!errorMsg) return;
    const timer = setTimeout(() => setErrorMsg(null), 5000);
    return () => clearTimeout(timer);
  }, [errorMsg]);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <MainLayout
      title="Sistema de Gestión de Proyectos de Investigación"
      subtitle=""
    >
      {/* ── Encabezado de sección ────────────────────────────────────────── */}
      <div className="mb-6">
        <h1 className="font-heading font-semibold text-h1 text-on-surface leading-[38px]">
          Configuración del Sistema
        </h1>
        <p className="mt-1 font-sans text-body-md text-on-surface-variant">
          Gestionar accesos y parámetros globales de operación.
        </p>
      </div>

      {/* ── Mensaje de error (permisos u otro) ──────────────────────────── */}
      {errorMsg && (
        <div
          role="alert"
          className="
            mb-4 px-4 py-3 rounded
            bg-error-container text-on-error-container
            border border-[#ffb4ab]
            font-sans text-body-md
          "
        >
          {errorMsg}
        </div>
      )}

      {/* ── Tabs de navegación ───────────────────────────────────────────── */}
      <div className="border-b border-outline-variant mb-0">
        <nav
          className="flex gap-0"
          role="tablist"
          aria-label="Secciones de Configuración del Sistema"
        >
          {/* Tab: Gestión de Cuentas */}
          <button
            id="tab-cuentas"
            role="tab"
            aria-selected={activeTab === 'cuentas'}
            aria-controls="panel-cuentas"
            onClick={() => setActiveTab('cuentas')}
            className={`
              relative px-4 py-3
              font-sans text-[13px] font-medium
              transition-colors duration-150
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#a8c8fa]
              ${activeTab === 'cuentas'
                ? 'text-primary border-b-2 border-primary -mb-px'
                : 'text-on-surface-variant hover:text-on-surface border-b-2 border-transparent'
              }
            `}
          >
            Gestión de Cuentas
          </button>

          {/* Tab: Parámetros de Operación */}
          <button
            id="tab-parametros"
            role="tab"
            aria-selected={activeTab === 'parametros'}
            aria-controls="panel-parametros"
            onClick={() => setActiveTab('parametros')}
            className={`
              relative px-4 py-3
              font-sans text-[13px] font-medium
              transition-colors duration-150
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#a8c8fa]
              ${activeTab === 'parametros'
                ? 'text-primary border-b-2 border-primary -mb-px'
                : 'text-on-surface-variant hover:text-on-surface border-b-2 border-transparent'
              }
            `}
          >
            Parámetros de Operación
          </button>
        </nav>
      </div>

      {/* ── Panel: Gestión de Cuentas ────────────────────────────────────── */}
      {activeTab === 'cuentas' && (
        <section
          id="panel-cuentas"
          role="tabpanel"
          aria-labelledby="tab-cuentas"
          className="mt-6"
        >
          {/* Tarjeta principal */}
          <div className="bg-surface-container-lowest rounded border border-outline-variant shadow-level-1">

            {/* Cabecera de la tarjeta */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant">

              <h2 className="font-heading font-semibold text-h3 text-on-surface">
                Listado de Usuarios
              </h2>

              {/* Botón Crear — visible solo si puedeGestionar */}
              {puedeGestionar && (
                  <Button
                    id="btn-crear-usuario"
                    variant="primary"
                    size="md"
                    iconLeft={<PlusIcon />}
                    onClick={handleCrearUsuario}
                  >
                    Crear Nuevo Usuario
                  </Button>
                )}
            </div>

            {/* Tabla */}
            <div className="overflow-x-auto">
              <table
                className="w-full border-collapse"
                aria-label="Listado de usuarios del sistema"
              >
                {/* Encabezados */}
                <thead>
                  <tr className="border-b border-outline-variant bg-surface-container-low">
                    <th
                      scope="col"
                      className="
                        px-5 py-3 text-left
                        font-sans text-label-caps text-on-surface-variant
                        uppercase tracking-widest
                        w-[220px]
                      "
                    >
                      Usuario
                    </th>
                    <th
                      scope="col"
                      className="
                        px-5 py-3 text-left
                        font-sans text-label-caps text-on-surface-variant
                        uppercase tracking-widest
                      "
                    >
                      Correo Institucional
                    </th>
                    <th
                      scope="col"
                      className="
                        px-5 py-3 text-left
                        font-sans text-label-caps text-on-surface-variant
                        uppercase tracking-widest
                        w-[160px]
                      "
                    >
                      Rol
                    </th>
                    <th
                      scope="col"
                      className="
                        px-5 py-3 text-left
                        font-sans text-label-caps text-on-surface-variant
                        uppercase tracking-widest
                        w-[100px]
                      "
                    >
                      Estado
                    </th>
                    <th
                      scope="col"
                      className="
                        px-5 py-3 text-right
                        font-sans text-label-caps text-on-surface-variant
                        uppercase tracking-widest
                        w-[100px]
                      "
                    >
                      Acciones
                    </th>
                  </tr>
                </thead>

                {/* Filas */}
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-5 py-10 text-center font-sans text-body-md text-on-surface-variant"
                      >
                        {isLoadingUsers ? 'Cargando usuarios...' : 'No hay usuarios registrados en el sistema.'}
                      </td>
                    </tr>
                  ) : (
                    users.map((u, idx) => (
                      <tr
                        key={u.id}
                        className={`
                          border-b border-outline-variant last:border-b-0
                          transition-colors duration-100
                          ${idx % 2 === 0 ? 'bg-surface-container-lowest' : 'bg-surface-container-low/40'}
                          hover:bg-surface-container-low
                        `}
                      >
                        {/* Nombre */}
                        <td className="px-5 py-3">
                          <span className="font-sans text-body-md font-medium text-on-surface">
                            {u.name}
                          </span>
                        </td>

                        {/* Correo */}
                        <td className="px-5 py-3">
                          <span className="font-sans text-body-md text-on-surface-variant">
                            {u.email}
                          </span>
                        </td>

                        {/* Rol */}
                        <td className="px-5 py-3">
                          <Badge
                            variant={
                              u.role === 'admin'
                                ? 'info'
                                : u.role === 'secretary'
                                ? 'success'
                                : u.role === 'chief'
                                ? 'warning'
                                : 'neutral'
                            }
                            size="sm"
                          >
                            {ROLE_LABELS[u.role]}
                          </Badge>
                        </td>

                        {/* Estado (toggle) */}
                        <td className="px-5 py-3">
                          <Toggle
                            id={`toggle-estado-${u.id}`}
                            checked={u.isActive}
                            onChange={(val) => handleToggleActivo(u.id, val)}
                            disabled={!puedeGestionar}
                          />
                        </td>

                        {/* Acciones */}
                        <td className="px-5 py-3 text-right">
                          <button
                            id={`btn-ver-${u.id}`}
                            onClick={() => handleVer(u)}
                            title={`Ver detalles del usuario ${u.name}`}
                            aria-label={`Ver detalles del usuario ${u.name}`}
                            className="
                              inline-flex items-center justify-center
                              w-7 h-7 rounded
                              text-on-surface-variant
                              hover:bg-surface-container hover:text-primary
                              active:bg-surface-container-high
                              transition-colors duration-100
                              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a8c8fa]
                            "
                          >
                            <EyeIcon />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ── Panel: Parámetros de Operación ──────────────────────────────── */}
      {activeTab === 'parametros' && (
        <section
          id="panel-parametros"
          role="tabpanel"
          aria-labelledby="tab-parametros"
          className="mt-6"
        >
          <div className="bg-surface-container-lowest rounded border border-outline-variant shadow-level-1 p-6">
            <ParametrosOperacion onSaved={handleParamsSaved} />
          </div>
        </section>
      )}

      {/* ── Modal: Crear Nuevo Usuario ────────────────────────────────────── */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={handleCloseModal}
        title="Crear Nuevo Usuario"
        footer={
          <>
            <Button variant="secondary" onClick={handleCloseModal}>
              Cancelar
            </Button>
            <Button
              variant={canGuardarUsuario ? 'primary' : 'secondary'}
              disabled={!canGuardarUsuario}
              onClick={async () => {
                try {
                  await capiacService.createUsuario({
                    correo_institucional: newUserEmail,
                    rol_sistema: newUserRole,
                    estado_cuenta: true
                  });
                  handleCloseModal();
                  handleUsuarioCreado();
                  fetchUsers(); // Recargar la lista
                } catch (err: any) {
                  setErrorMsg(err.message || 'Error al crear usuario');
                }
              }}
            >
              Guardar Usuario
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="nombre" className="font-sans font-bold text-[13px] text-[#0f172a]">
              Nombre Completo
            </label>
            <Input
              id="nombre"
              placeholder="Ej. Ana García"
              value={newUserNombre}
              onChange={(e) => setNewUserNombre(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="font-sans font-bold text-[13px] text-[#0f172a]">
              Correo Institucional (UNMSM) *
            </label>
            <Input
              id="email"
              placeholder="usuario@unmsm.edu.pe"
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="rol" className="font-sans font-bold text-[13px] text-[#0f172a]">
              Asignar Rol
            </label>
            <Select id="rol" value={newUserRole} onChange={(e) => setNewUserRole(e.target.value)}>
              <option value="Administrador">Administrador</option>
              <option value="Secretaria">Secretaria</option>
              <option value="Jefe">Jefe del Instituto</option>
              <option value="Consulta">Consulta</option>
            </Select>
          </div>
        </div>
      </Modal>

      {/* ── Modal: Ver Detalles del Usuario ───────────────────────────────── */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title="Detalles del Usuario"
        footer={
          <Button variant="secondary" onClick={() => setIsViewModalOpen(false)}>
            Cerrar
          </Button>
        }
      >
        {selectedUser && (
          <div className="flex flex-col gap-4 font-sans text-[13px] text-[#0f172a]">
            <div className="flex flex-col border-b border-outline-variant pb-3">
              <span className="font-bold text-[#64748b] text-[11px] uppercase tracking-wider mb-1">ID de Usuario</span>
              <span className="font-mono text-[12px]">{selectedUser.id}</span>
            </div>
            <div className="flex flex-col border-b border-outline-variant pb-3">
              <span className="font-bold text-[#64748b] text-[11px] uppercase tracking-wider mb-1">Nombre Completo</span>
              <span>{selectedUser.name}</span>
            </div>
            <div className="flex flex-col border-b border-outline-variant pb-3">
              <span className="font-bold text-[#64748b] text-[11px] uppercase tracking-wider mb-1">Correo Institucional</span>
              <span>{selectedUser.email}</span>
            </div>
            <div className="flex flex-col border-b border-outline-variant pb-3">
              <span className="font-bold text-[#64748b] text-[11px] uppercase tracking-wider mb-1">Rol Asignado</span>
              <span>{ROLE_LABELS[selectedUser.role]}</span>
            </div>
            <div className="flex flex-col border-b border-outline-variant pb-3">
              <span className="font-bold text-[#64748b] text-[11px] uppercase tracking-wider mb-1">Estado de Cuenta</span>
              <span>{selectedUser.isActive ? 'Activa' : 'Desactivada'}</span>
            </div>
            <div className="flex flex-col pb-1">
              <span className="font-bold text-[#64748b] text-[11px] uppercase tracking-wider mb-1">Fecha de Creación</span>
              <span>{new Date(selectedUser.createdAt).toLocaleString('es-PE')}</span>
            </div>
          </div>
        )}
      </Modal>


      {/* ── Toast de éxito (mensaje dinámico) ────────────────────────────── */}
      {toast && (
        <div
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50"
        >
          <Toast
            variant="success"
            title={toast.title}
            description={toast.description}
          />
        </div>
      )}
    </MainLayout>
  );
}
