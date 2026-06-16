'use client';

/**
 * @file page.tsx
 * @route /configuracion/Gestión_de_Cuentas_Activas
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

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MainLayout }                               from '@/SGPI-CFU/components/layout';
import { Button, Badge, Modal, Input, Select, Toast } from '@/SGPI-CFU/components/ui';
import { useAuth }                                  from '@/SGPI-CFU/lib/hooks';
import { canDo }                                    from '@/SGPI-CFU/lib/auth/permissions';
import type { User }                                from '@/SGPI-CFU/lib/types/models';
import type { UserRole }                            from '@/SGPI-CFU/lib/types/auth';
import { ROLE_LABELS, ROLE_MAP }                    from '@/SGPI-CFU/lib/types/auth';
import { capiacService, type CatalogItem }            from '../_data/capiacService';

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

type Tab = 'cuentas' | 'parametros' | 'catalogos';

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

function EditIcon({ className = '' }: { className?: string }) {
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
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function TrashIcon({ className = '' }: { className?: string }) {
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
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
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
  const { user }         = useAuth();
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

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<User | null>(null);
  const [editUserRole, setEditUserRole] = useState<string>('Consulta');
  const [editUserActive, setEditUserActive] = useState<boolean>(true);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedUserForDelete, setSelectedUserForDelete] = useState<User | null>(null);

  const [editUserName, setEditUserName] = useState<string>('');
  const [editUserEmail, setEditUserEmail] = useState<string>('');
  const [editUserPassword, setEditUserPassword] = useState<string>('');

  // --- Estados de Gestión de Catálogos ---
  const [activeCatalogTab, setActiveCatalogTab] = useState<'departamentos' | 'lineas'>('departamentos');
  const [departamentos, setDepartamentos] = useState<CatalogItem[]>([]);
  const [lineas, setLineas] = useState<CatalogItem[]>([]);
  const [loadingCatalogs, setLoadingCatalogs] = useState<boolean>(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [searchCatalogQuery, setSearchCatalogQuery] = useState<string>('');
  const [catalogStatusFilter, setCatalogStatusFilter] = useState<'todos' | 'Aprobado' | 'Pendiente'>('todos');

  // Modal de Catálogos
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState<boolean>(false);
  const [catalogModalType, setCatalogModalType] = useState<'create' | 'edit'>('create');
  const [currentCatalogItem, setCurrentCatalogItem] = useState<CatalogItem | null>(null);
  const [catalogFormName, setCatalogFormName] = useState<string>('');
  const [catalogFormEstado, setCatalogFormEstado] = useState<string>('Aprobado');
  const [isCatalogSubmitting, setIsCatalogSubmitting] = useState<boolean>(false);

  // Cargar catálogos
  const fetchCatalogs = useCallback(async () => {
    try {
      setLoadingCatalogs(true);
      setCatalogError(null);
      const [deptsData, lineasData] = await Promise.all([
        capiacService.getDepartamentos(),
        capiacService.getLineasInvestigacionAdmin(),
      ]);
      setDepartamentos(deptsData);
      setLineas(lineasData);
    } catch (err: any) {
      console.error(err);
      setCatalogError('Error al cargar los catálogos.');
    } finally {
      setLoadingCatalogs(false);
    }
  }, []);

  // Cargar usuarios
  const fetchUsers = useCallback(async () => {
    try {
      setIsLoadingUsers(true);
      const data = await capiacService.getUsuarios();
      const mappedUsers: User[] = data.map(u => ({
        id: u.id_usuario,
        email: u.correo_institucional,
        name: u.nombre_completo || u.correo_institucional.split('@')[0],
        role: ROLE_MAP[u.rol_sistema] || 'readonly',
        isActive: u.estado_cuenta,
        lastLogin: '',
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
    fetchCatalogs();
  }, [fetchUsers, fetchCatalogs]);

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



  // --- Funciones para Gestión de Catálogos ---
  const filteredCatalogItems = useMemo(() => {
    const list = activeCatalogTab === 'departamentos' ? departamentos : lineas;
    return list.filter((item) => {
      const matchesSearch = item.nombre.toLowerCase().includes(searchCatalogQuery.toLowerCase());
      const matchesStatus = catalogStatusFilter === 'todos' || item.estado === catalogStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [activeCatalogTab, departamentos, lineas, searchCatalogQuery, catalogStatusFilter]);

  const catalogMetrics = useMemo(() => {
    const list = activeCatalogTab === 'departamentos' ? departamentos : lineas;
    const total = list.length;
    const aprobados = list.filter((item) => item.estado === 'Aprobado').length;
    const pendientes = list.filter((item) => item.estado === 'Pendiente').length;
    return { total, aprobados, pendientes };
  }, [activeCatalogTab, departamentos, lineas]);

  const handleCatalogApprove = async (item: CatalogItem) => {
    try {
      if (activeCatalogTab === 'departamentos') {
        await capiacService.updateDepartamento(item.id, { estado: 'Aprobado' });
      } else {
        await capiacService.updateLineaInvestigacion(item.id, { estado: 'Aprobado' });
      }
      showToast('Registro aprobado correctamente.');
      await fetchCatalogs();
    } catch (err) {
      showToast('Error al aprobar el registro.');
    }
  };

  const handleCatalogDelete = async (item: CatalogItem) => {
    if (!confirm(`¿Está seguro de eliminar "${item.nombre}"?`)) return;
    try {
      if (activeCatalogTab === 'departamentos') {
        await capiacService.deleteDepartamento(item.id);
      } else {
        await capiacService.deleteLineaInvestigacion(item.id);
      }
      showToast('Registro eliminado correctamente.');
      await fetchCatalogs();
    } catch (err) {
      showToast('Error al eliminar el registro. Verifique que no esté en uso.');
    }
  };

  const openCatalogCreateModal = () => {
    setCatalogModalType('create');
    setCurrentCatalogItem(null);
    setCatalogFormName('');
    setCatalogFormEstado('Aprobado');
    setIsCatalogModalOpen(true);
  };

  const openCatalogEditModal = (item: CatalogItem) => {
    setCatalogModalType('edit');
    setCurrentCatalogItem(item);
    setCatalogFormName(item.nombre);
    setCatalogFormEstado(item.estado);
    setIsCatalogModalOpen(true);
  };

  const handleCatalogSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catalogFormName.trim()) return;

    setIsCatalogSubmitting(true);
    try {
      if (catalogModalType === 'create') {
        if (activeCatalogTab === 'departamentos') {
          await capiacService.createDepartamento(catalogFormName.trim(), catalogFormEstado);
        } else {
          await capiacService.createLineaInvestigacion(catalogFormName.trim(), catalogFormEstado);
        }
        showToast('Registro creado exitosamente.');
      } else if (catalogModalType === 'edit' && currentCatalogItem) {
        if (activeCatalogTab === 'departamentos') {
          await capiacService.updateDepartamento(currentCatalogItem.id, { nombre: catalogFormName.trim(), estado: catalogFormEstado });
        } else {
          await capiacService.updateLineaInvestigacion(currentCatalogItem.id, { nombre: catalogFormName.trim(), estado: catalogFormEstado });
        }
        showToast('Registro actualizado exitosamente.');
      }
      setIsCatalogModalOpen(false);
      await fetchCatalogs();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Error al guardar el registro.');
    } finally {
      setIsCatalogSubmitting(false);
    }
  };

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

  const handleEditClick = useCallback((user: User) => {
    setSelectedUserForEdit(user);
    const roleSpanish = user.role === 'admin' ? 'Administrador'
                      : user.role === 'secretary' ? 'Secretaria'
                      : user.role === 'chief' ? 'Jefe'
                      : 'Consulta';
    setEditUserRole(roleSpanish);
    setEditUserActive(user.isActive);
    setEditUserName(user.name);
    setEditUserEmail(user.email);
    setEditUserPassword('');
    setIsEditModalOpen(true);
  }, []);

  const handleDeleteClick = useCallback((user: User) => {
    setSelectedUserForDelete(user);
    setIsDeleteModalOpen(true);
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
              transition-all duration-300 ease-out
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
              transition-all duration-300 ease-out
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#a8c8fa]
              ${activeTab === 'parametros'
                ? 'text-primary border-b-2 border-primary -mb-px'
                : 'text-on-surface-variant hover:text-on-surface border-b-2 border-transparent'
              }
            `}
          >
            Parámetros de Operación
          </button>

          {/* Tab: Gestión de Catálogos */}
          <button
            id="tab-catalogos"
            role="tab"
            aria-selected={activeTab === 'catalogos'}
            aria-controls="panel-catalogos"
            onClick={() => setActiveTab('catalogos')}
            className={`
              relative px-4 py-3
              font-sans text-[13px] font-medium
              transition-all duration-300 ease-out
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#a8c8fa]
              ${activeTab === 'catalogos'
                ? 'text-primary border-b-2 border-primary -mb-px'
                : 'text-on-surface-variant hover:text-on-surface border-b-2 border-transparent'
              }
            `}
          >
            Gestión de Catálogos
          </button>
        </nav>
      </div>

      {/* ── Panel: Gestión de Cuentas ────────────────────────────────────── */}
      {activeTab === 'cuentas' && (
        <section
          id="panel-cuentas"
          role="tabpanel"
          aria-labelledby="tab-cuentas"
          className="mt-6 animate-sweep-in"
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
                        <td className="px-5 py-3 text-right flex justify-end gap-2">
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
                          {puedeGestionar && (
                            <>
                              <button
                                id={`btn-editar-${u.id}`}
                                onClick={() => handleEditClick(u)}
                                title={`Editar usuario ${u.name}`}
                                aria-label={`Editar usuario ${u.name}`}
                                className="
                                  inline-flex items-center justify-center
                                  w-7 h-7 rounded
                                  text-on-surface-variant
                                  hover:bg-surface-container hover:text-info
                                  active:bg-surface-container-high
                                  transition-colors duration-100
                                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a8c8fa]
                                "
                              >
                                <EditIcon />
                              </button>
                              <button
                                id={`btn-eliminar-${u.id}`}
                                onClick={() => handleDeleteClick(u)}
                                title={`Eliminar usuario ${u.name}`}
                                aria-label={`Eliminar usuario ${u.name}`}
                                className="
                                  inline-flex items-center justify-center
                                  w-7 h-7 rounded
                                  text-on-surface-variant
                                  hover:bg-surface-container hover:text-error
                                  active:bg-surface-container-high
                                  transition-colors duration-100
                                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a8c8fa]
                                "
                              >
                                <TrashIcon />
                              </button>
                            </>
                          )}
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
          aria-labelledby="tab-tab-parametros"
          className="mt-6 animate-sweep-in"
        >
          <div className="bg-surface-container-lowest rounded border border-outline-variant shadow-level-1 p-6">
            <ParametrosOperacion onSaved={handleParamsSaved} />
          </div>
        </section>
      )}

      {/* ── Panel: Gestión de Catálogos ─────────────────────────────────── */}
      {activeTab === 'catalogos' && (
        <section
          id="panel-catalogos"
          role="tabpanel"
          aria-labelledby="tab-catalogos"
          className="mt-6 animate-sweep-in"
        >
          <div className="bg-surface-container-lowest rounded border border-outline-variant shadow-level-1 p-6 flex flex-col gap-6">
            
            {/* Header & New Register Button */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex bg-[#f1f5f9] p-1 rounded-lg border border-[#e2e8f0]">
                <button
                  type="button"
                  onClick={() => {
                    setActiveCatalogTab('departamentos');
                    setSearchCatalogQuery('');
                    setCatalogStatusFilter('todos');
                  }}
                  className={`px-4 py-2 text-sm font-sans rounded-md transition-all ${
                    activeCatalogTab === 'departamentos'
                      ? 'bg-white text-[#001631] font-bold shadow-sm'
                      : 'text-[#64748b] hover:text-[#001631]'
                  }`}
                >
                  Departamentos Académicos
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveCatalogTab('lineas');
                    setSearchCatalogQuery('');
                    setCatalogStatusFilter('todos');
                  }}
                  className={`px-4 py-2 text-sm font-sans rounded-md transition-all ${
                    activeCatalogTab === 'lineas'
                      ? 'bg-white text-[#001631] font-bold shadow-sm'
                      : 'text-[#64748b] hover:text-[#001631]'
                  }`}
                >
                  Líneas de Investigación
                </button>
              </div>

              {puedeGestionar && (
                <Button
                  variant="primary"
                  onClick={openCatalogCreateModal}
                  className="flex items-center gap-2 font-bold"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Nuevo Registro
                </Button>
              )}
            </div>

            {/* Metrics Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-surface-container rounded border border-outline-variant p-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-[#64748b] uppercase tracking-wider font-sans font-bold">Total Registros</p>
                  <h3 className="text-xl font-bold text-[#0f172a] mt-1 font-heading">{catalogMetrics.total}</h3>
                </div>
                <div className="p-2.5 bg-[#e2e8f0] rounded text-[#475569]">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                </div>
              </div>
              <div className="bg-surface-container rounded border border-outline-variant p-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-[#64748b] uppercase tracking-wider font-sans font-bold">Aprobados</p>
                  <h3 className="text-xl font-bold text-[#15803d] mt-1 font-heading">{catalogMetrics.aprobados}</h3>
                </div>
                <div className="p-2.5 bg-[#f0fdf4] rounded text-[#16a34a]">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              </div>
              <div className="bg-surface-container rounded border border-outline-variant p-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-[#64748b] uppercase tracking-wider font-sans font-bold">Pendientes</p>
                  <h3 className="text-xl font-bold text-[#b45309] mt-1 font-heading">{catalogMetrics.pendientes}</h3>
                </div>
                <div className="p-2.5 bg-[#fffbeb] rounded text-[#d97706]">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Filters and List */}
            <div className="rounded border border-outline-variant overflow-hidden flex flex-col bg-surface-container-lowest">
              {/* Filters Bar */}
              <div className="p-4 border-b border-outline-variant flex flex-col sm:flex-row gap-4 justify-between items-center bg-[#f8fafc]">
                {/* Search Input */}
                <div className="relative w-full sm:w-80">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[#94a3b8]">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    placeholder={`Buscar ${activeCatalogTab === 'departamentos' ? 'departamento' : 'línea'}...`}
                    value={searchCatalogQuery}
                    onChange={(e) => setSearchCatalogQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-1.5 border border-outline-variant rounded-md text-sm font-sans focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-white text-on-surface"
                  />
                </div>

                {/* Status Filter */}
                <div className="flex gap-2">
                  {(['todos', 'Aprobado', 'Pendiente'] as const).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setCatalogStatusFilter(filter)}
                      className={`px-3 py-1.5 text-xs font-sans rounded-md transition-all border ${
                        catalogStatusFilter === filter
                          ? 'bg-[#eef2ff] border-primary text-primary font-semibold'
                          : 'bg-white border-outline-variant text-[#64748b] hover:text-[#001631]'
                      }`}
                    >
                      {filter === 'todos' ? 'Todos' : filter}
                    </button>
                  ))}
                </div>
              </div>

              {/* List Content */}
              {loadingCatalogs ? (
                <div className="py-16 flex flex-col items-center justify-center gap-3">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-xs text-[#64748b] font-sans">Cargando catálogo...</p>
                </div>
              ) : catalogError ? (
                <div className="py-12 flex flex-col items-center justify-center text-center px-4">
                  <span className="p-2 bg-red-50 text-red-500 rounded-full mb-2">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  </span>
                  <p className="text-xs font-semibold text-red-600 font-sans">{catalogError}</p>
                  <button type="button" onClick={fetchCatalogs} className="mt-2 text-xs font-bold text-primary hover:underline font-sans">Reintentar</button>
                </div>
              ) : filteredCatalogItems.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center text-center px-4">
                  <span className="p-2 bg-gray-50 text-gray-400 rounded-full mb-2">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" /><path d="M8 12h8" />
                    </svg>
                  </span>
                  <p className="text-xs text-[#64748b] font-sans font-medium">No se encontraron resultados.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-[#f8fafc] text-left border-b border-outline-variant text-[11px] font-sans uppercase tracking-wider text-[#64748b]">
                        <th className="py-3 px-5 font-semibold w-16">ID</th>
                        <th className="py-3 px-5 font-semibold">Nombre</th>
                        <th className="py-3 px-5 font-semibold w-32">Estado</th>
                        {puedeGestionar && <th className="py-3 px-5 font-semibold w-40 text-right">Acciones</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant text-[13px] font-sans text-on-surface">
                      {filteredCatalogItems.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-5 text-[#94a3b8] font-mono">{item.id}</td>
                          <td className="py-3 px-5 font-medium truncate max-w-md" title={item.nombre}>{item.nombre}</td>
                          <td className="py-3 px-5">
                            <Badge
                              variant={item.estado === 'Aprobado' ? 'success' : 'warning'}
                              size="sm"
                            >
                              {item.estado}
                            </Badge>
                          </td>
                          {puedeGestionar && (
                            <td className="py-3 px-5 text-right">
                              <div className="flex justify-end items-center gap-1.5">
                                {item.estado === 'Pendiente' && (
                                  <button
                                    onClick={() => handleCatalogApprove(item)}
                                    className="px-2.5 py-1 text-[11px] font-bold font-sans bg-[#16a34a] hover:bg-[#15803d] text-white rounded transition-all shadow-sm flex items-center gap-1"
                                    title="Aprobar para producción"
                                    type="button"
                                  >
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                    Aprobar
                                  </button>
                                )}
                                <button
                                  onClick={() => openCatalogEditModal(item)}
                                  className="p-1 text-primary hover:bg-slate-100 rounded transition-colors"
                                  title="Editar nombre"
                                  type="button"
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                    <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleCatalogDelete(item)}
                                  className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="Eliminar"
                                  type="button"
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
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
                    estado_cuenta: true,
                    nombre_completo: newUserNombre
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

      {/* ── Modal: Editar Usuario ─────────────────────────────────────── */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Editar Usuario"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsEditModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={async () => {
                if (!selectedUserForEdit) return;
                try {
                  const updateData: {
                    rol_sistema?: string;
                    estado_cuenta?: boolean;
                    nombre_completo?: string;
                    correo_institucional?: string;
                    contrasena?: string;
                  } = {
                    rol_sistema: editUserRole,
                    estado_cuenta: editUserActive,
                    nombre_completo: editUserName,
                    correo_institucional: editUserEmail
                  };
                  if (editUserPassword && editUserPassword.trim() !== '') {
                    updateData.contrasena = editUserPassword;
                  }
                  await capiacService.updateUsuario(selectedUserForEdit.id, updateData);
                  setIsEditModalOpen(false);
                  showToast('Usuario actualizado exitosamente.');
                  fetchUsers(); // Recargar la lista
                } catch (err: any) {
                  setErrorMsg(err.message || 'Error al actualizar usuario');
                }
              }}
            >
              Guardar Cambios
            </Button>
          </>
        }
      >
        {selectedUserForEdit && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="edit-nombre" className="font-sans font-bold text-[13px] text-[#0f172a]">
                Nombre Completo
              </label>
              <Input
                id="edit-nombre"
                value={editUserName}
                onChange={(e) => setEditUserName(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="edit-email" className="font-sans font-bold text-[13px] text-[#0f172a]">
                Correo Institucional
              </label>
              <Input
                id="edit-email"
                value={editUserEmail}
                onChange={(e) => setEditUserEmail(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="edit-rol" className="font-sans font-bold text-[13px] text-[#0f172a]">
                Editar Rol
              </label>
              <Select id="edit-rol" value={editUserRole} onChange={(e) => setEditUserRole(e.target.value)}>
                <option value="Administrador">Administrador</option>
                <option value="Secretaria">Secretaria</option>
                <option value="Jefe">Jefe del Instituto</option>
                <option value="Consulta">Consulta</option>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="edit-password" className="font-sans font-bold text-[13px] text-[#0f172a]">
                Contraseña (Nueva / Opcional)
              </label>
              <Input
                id="edit-password"
                type="password"
                placeholder="Dejar en blanco para no modificar"
                value={editUserPassword}
                onChange={(e) => setEditUserPassword(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between py-2 border-t border-outline-variant mt-2">
              <label htmlFor="edit-activo" className="font-sans font-bold text-[13px] text-[#0f172a]">
                Estado de Cuenta (Activa)
              </label>
              <Toggle
                id="edit-activo"
                checked={editUserActive}
                onChange={(val) => setEditUserActive(val)}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* ── Modal: Confirmar Eliminación ───────────────────────────────── */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Eliminar Usuario"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsDeleteModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={async () => {
                if (!selectedUserForDelete) return;
                try {
                  await capiacService.deleteUsuario(selectedUserForDelete.id);
                  setIsDeleteModalOpen(false);
                  showToast('Usuario eliminado exitosamente.');
                  fetchUsers(); // Recargar la lista
                } catch (err: any) {
                  setErrorMsg(err.message || 'Error al eliminar usuario');
                }
              }}
            >
              Eliminar
            </Button>
          </>
        }
      >
        {selectedUserForDelete && (
          <div className="font-sans text-[13px] text-[#0f172a] flex flex-col gap-2">
            <p>
              ¿Está seguro de que desea eliminar al usuario <strong>{selectedUserForDelete.email}</strong>?
            </p>
            <p className="text-[#dc2626] font-medium">
              Esta acción no se puede deshacer. Revocará permanentemente su acceso al sistema y eliminará la cuenta de Supabase Auth.
            </p>
          </div>
        )}
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


      {/* ── Modal: Crear/Editar Catálogo ────────────────────────────────── */}
      <Modal
        isOpen={isCatalogModalOpen}
        onClose={() => setIsCatalogModalOpen(false)}
        title={catalogModalType === 'create' ? 'Crear Nuevo Registro' : 'Editar Registro'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsCatalogModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant={catalogFormName.trim() ? 'primary' : 'secondary'}
              disabled={isCatalogSubmitting || !catalogFormName.trim()}
              onClick={handleCatalogSave}
            >
              {isCatalogSubmitting ? 'Guardando...' : 'Guardar'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4 font-sans text-sm text-[#0f172a]">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="catalog-name" className="font-sans font-bold text-[13px] text-[#0f172a]">
              Nombre {activeCatalogTab === 'departamentos' ? 'del Departamento' : 'de la Línea'} *
            </label>
            <Input
              id="catalog-name"
              placeholder={`Ej: ${activeCatalogTab === 'departamentos' ? 'Ingeniería Mecatrónica' : 'L9. Computación Cuántica'}`}
              value={catalogFormName}
              onChange={(e) => setCatalogFormName(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="catalog-status" className="font-sans font-bold text-[13px] text-[#0f172a]">
              Estado
            </label>
            <Select
              id="catalog-status"
              value={catalogFormEstado}
              onChange={(e) => setCatalogFormEstado(e.target.value)}
            >
              <option value="Aprobado">Aprobado</option>
              <option value="Pendiente">Pendiente de Aprobación</option>
            </Select>
          </div>
        </div>
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
