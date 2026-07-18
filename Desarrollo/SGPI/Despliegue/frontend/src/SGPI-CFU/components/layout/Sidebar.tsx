'use client';

/**
 * @file Sidebar.tsx
 * @description Sidebar de navegación del SGPI — Light, fijo a la izquierda.
 *
 * - Fondo blanco/gris muy claro
 * - Item activo: fondo azul-lavanda claro + texto navy bold + borde izquierdo accent
 * - Item inactivo: texto gris, hover sutil
 * - El item "Configuración" se activa en rutas /SGPI-CFSA/*
 */

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../../lib/hooks/useAuth';
import type { UserRole } from '../../lib/types/auth';

// ─────────────────────────────────────────────────────────────────────────────
// Íconos SVG inline (outline, 18×18, stroke-1.75)
// ─────────────────────────────────────────────────────────────────────────────

const SearchIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
  </svg>
);

const ConfigIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33
      1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06
      a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09
      A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06
      A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51
      1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9
      a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);

const FolderIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const UserIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const UsersIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const SyncIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 4v6h-6" /><path d="M1 20v-6h6" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const ImportIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const BellIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const BookIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);

const ChartIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
    <line x1="2" y1="20" x2="22" y2="20" />
  </svg>
);

const AuditIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const CatalogIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);


const LogoutIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const GraduationIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
    <path d="M6 12v5c3 3 9 3 12 0v-5" />
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// Definición de items de navegación
// ─────────────────────────────────────────────────────────────────────────────

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.FC;
  /** Prefijos de ruta que activan este ítem */
  matchPrefixes?: string[];
  /** Roles que pueden ver este item. undefined = todos. */
  roles?: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'search',
    label: 'Búsqueda Global',
    href: '/busqueda',
    icon: SearchIcon,
  },
  {
    id: 'config',
    label: 'Configuración',
    href: '/configuracion/Gestion_de_Cuentas_Activas',
    icon: ConfigIcon,
    matchPrefixes: ['/configuracion/Gestion_de_Cuentas_Activas'],
    roles: ['admin'],
  },
  {
    id: 'projects',
    label: 'Proyectos',
    href: '/proyectos',
    icon: FolderIcon,
    matchPrefixes: ['/proyectos'],
  },
  {
    id: 'investigators',
    label: 'Docentes/Inv.',
    href: '/investigadores',
    icon: UserIcon,
    matchPrefixes: ['/investigadores'],
  },
  {
    id: 'groups',
    label: 'Grupos de Inv.',
    href: '/grupos',
    icon: UsersIcon,
    matchPrefixes: ['/grupos'],
  },
  {
    id: 'sync',
    label: 'Sincronización',
    href: '/sincronizacion',
    icon: SyncIcon,
    matchPrefixes: ['/sincronizacion'],
    roles: ['admin'],
  },
  {
    id: 'import',
    label: 'Importación de datos',
    href: '/importacion',
    icon: ImportIcon,
    matchPrefixes: ['/importacion'],
    roles: ['admin', 'secretary'],
  },
  {
    id: 'calls',
    label: 'Alertas Convocatorias',
    href: '/convocatorias',
    icon: BellIcon,
    matchPrefixes: ['/convocatorias'],
    roles: ['admin', 'secretary', 'chief'],
  },
  {
    id: 'publications',
    label: 'Publicaciones y Tesis',
    href: '/publicaciones',
    icon: BookIcon,
    matchPrefixes: ['/publicaciones'],
  },
  {
    id: 'reports',
    label: 'Reportes',
    href: '/reportes',
    icon: ChartIcon,
    matchPrefixes: ['/reportes'],
    roles: ['admin', 'secretary', 'chief'],
  },
  {
    id: 'audit',
    label: 'Auditoría de Logs',
    href: '/configuracion/Modulo_de_auditoria',
    icon: AuditIcon,
    matchPrefixes: ['/configuracion/Modulo_de_auditoria'],
    roles: ['admin'],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────────────────────────────────────

export function Sidebar({ isOpen, onClose }: { isOpen?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  /** Filtra los items visibles según el rol del usuario */
  const visibleItems = NAV_ITEMS.filter((item) => {
    if (!item.roles) return true;
    if (!user?.role) return false;
    return item.roles.includes(user.role);
  });

  /** Determina si un item está activo considerando sus prefijos */
  const isItemActive = (item: NavItem): boolean => {
    const decodedPath = decodeURIComponent(pathname);
    if (item.matchPrefixes) {
      return item.matchPrefixes.some((prefix) => decodedPath.startsWith(prefix));
    }
    return decodedPath === item.href || decodedPath.startsWith(`${item.href}/`);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      router.push('/auth/login');
    }
  };

  return (
    <>
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          aria-hidden="true"
        />
      )}
      <aside
        className={`
          fixed left-0 top-0 z-40
          flex flex-col
          h-screen w-[220px]
          bg-white
          border-r border-[#e2e8f0]
          select-none
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
        `}
        aria-label="Navegación principal del SGPI"
      >
      {/* ── BRAND ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-4 border-b border-[#e2e8f0]">
        {/* Logo institucional */}
        <div className="
          flex items-center justify-center flex-shrink-0
          w-9 h-9 rounded-lg
          bg-[#001631] text-white
        ">
          <GraduationIcon />
        </div>

        {/* Texto de marca */}
        <div className="min-w-0">
          <p className="font-heading font-bold text-[#001631] text-[15px] leading-tight tracking-tight">
            SGPI
          </p>
          <p className="font-sans text-[10px] leading-[14px] text-[#64748b] mt-0.5 line-clamp-2">
            Sistema de Gestión de Proyectos de Investigación
          </p>
        </div>
      </div>

      {/* ── NAV ITEMS ─────────────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-3 px-3" aria-label="Módulos del sistema">
        <ul className="space-y-0.5">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = isItemActive(item);

            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`
                    group flex items-center gap-2.5
                    px-3 py-[9px] rounded-md
                    text-[13px] font-sans leading-5
                    transition-all duration-300 ease-out
                    ${isActive
                      ? 'bg-[#eef2ff] text-[#001631] font-bold border-r-[3px] border-[#001631]'
                      : 'text-[#475569] font-normal hover:bg-[#f1f5f9] hover:text-[#0f172a] border-r-[3px] border-transparent'
                    }
                  `}
                >
                  {/* Ícono */}
                  <span className={`
                    flex-shrink-0 transition-all duration-300 ease-out rounded-md p-0.5
                    ${isActive
                      ? 'text-[#001631] bg-[#dde5ff]'
                      : 'text-[#94a3b8] group-hover:text-[#475569]'
                    }
                  `}>
                    <Icon />
                  </span>

                  {/* Label */}
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ── FOOTER — Logout ───────────────────────────────────────────────── */}
      <div className="px-3 py-4 border-t border-[#e2e8f0]">
        <button
          onClick={handleLogout}
          className="
            group flex items-center gap-2.5
            w-full px-3 py-[9px] rounded-md
            text-[13px] font-sans font-normal leading-5
            text-[#64748b] hover:text-[#b91c1c] hover:bg-[#fef2f2]
            border-l-[3px] border-transparent pl-[9px]
            transition-all duration-300 ease-out
          "
          aria-label="Cerrar sesión"
          type="button"
        >
          <span className="flex-shrink-0 transition-all duration-300 ease-out">
            <LogoutIcon />
          </span>
          <span>Cerrar Sesión</span>
        </button>
      </div>
      </aside>
    </>
  );
}

export default Sidebar;
