'use client';

/**
 * @file TopBar.tsx
 * @description Barra superior del SGPI — White fija, nivel 1 del design system.
 *
 * Contiene:
 * - Breadcrumb / título de página activa (izquierda)
 * - Barra de búsqueda rápida (centro, opcional)
 * - Nombre del usuario + badge de rol + avatar (derecha)
 * - Indicador de sesión (tiempo restante si showExpiryWarning)
 */

import React from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../lib/hooks/useAuth';
import { SessionTimer } from './SessionTimer';

// ─────────────────────────────────────────────────────────────────────────────
// Íconos
// ─────────────────────────────────────────────────────────────────────────────

const ClockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);

const ChevronRightIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

const MenuIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="12" x2="20" y2="12" />
    <line x1="4" y1="6" x2="20" y2="6" />
    <line x1="4" y1="18" x2="20" y2="18" />
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Mapa de rutas a etiquetas en español */
const ROUTE_LABELS: Record<string, string> = {
  '':              'Inicio',
  'dashboard':     'Dashboard',
  'search':        'Búsqueda Global',
  'busqueda':      'Búsqueda Global',
  'projects':      'Proyectos',
  'proyectos':     'Proyectos',
  'investigators': 'Investigadores',
  'investigadores': 'Investigadores',
  'groups':        'Grupos de Investigación',
  'grupos':        'Grupos de Investigación',
  'sync':          'Sincronización ETL',
  'sincronizacion': 'Sincronización',
  'import':        'Importación de Datos',
  'importacion':   'Importación de Datos',
  'calls':         'Alertas de Convocatorias',
  'convocatorias': 'Alertas de Convocatorias',
  'publications':  'Publicaciones y Tesis',
  'publicaciones': 'Publicaciones y Tesis',
  'reports':       'Reportes',
  'reportes':      'Reportes',
  'admin':         'Administración',
  'users':         'Usuarios',
  'logs':          'Auditoría',
  'configuracion': 'Configuración del Sistema',
  'Gestion_de_Cuentas_Activas': 'Gestión de Cuentas Activas',
  'Modulo_de_auditoria': 'Módulo de Auditoría de Logs',
  
  // Nombres de carpetas físicas
  'SGPI-CFAC':     'Alertas de Convocatorias',
  'SGPI-CFB':      'Búsqueda Global',
  'SGPI-CFGI':     'Grupos de Investigación',
  'SGPI-CFIM':     'Importación de Datos',
  'SGPI-CFMH':     'Investigadores',
  'SGPI-CFPI':     'Proyectos de Investigación',
  'SGPI-CFPT':     'Publicaciones y Tesis',
  'SGPI-CFR':      'Reportes Académicos',
  'SGPI-CFSA':     'Seguridad y Configuración',
  'SGPI-CFSF':     'Sincronización ETL',
};

/** Convierte la ruta actual en breadcrumbs */
function parseBreadcrumbs(pathname: string): { label: string; href: string }[] {
  const segments = pathname.split('/').filter(Boolean);
  const crumbs: { label: string; href: string }[] = [
    { label: 'Inicio', href: '/dashboard' },
  ];

  let path = '';
  for (const seg of segments) {
    path += `/${seg}`;
    const label = ROUTE_LABELS[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1);
    crumbs.push({ label, href: path });
  }

  return crumbs;
}

/** Convierte el rol interno a texto legible */
function roleLabel(role?: string): string {
  const map: Record<string, string> = {
    admin:     'Administrador',
    secretary: 'Secretaria',
    chief:     'Jefe del Instituto',
    readonly:  'Consulta',
  };
  return role ? (map[role] ?? role) : '';
}

/** Iniciales del nombre del usuario para el avatar */
function initials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────────────────────────────────────

export interface TopBarProps {
  /** Título personalizado. Si se omite, se genera desde la ruta. */
  title?: string;
  /** Subtítulo opcional debajo del título */
  subtitle?: string;
}

export function TopBar({ title, subtitle, onToggleSidebar }: TopBarProps & { onToggleSidebar?: () => void }) {
  const pathname = usePathname();
  const { user, showExpiryWarning, minutesRemaining, dismissWarning } = useAuth();
  const breadcrumbs = parseBreadcrumbs(pathname);
  const currentLabel = title ?? breadcrumbs[breadcrumbs.length - 1]?.label ?? 'SGPI';

  return (
    <header
      className="
        fixed top-0 right-0 left-0 lg:left-[220px] z-30
        flex items-center justify-between
        h-[64px]
        bg-white
        border-b border-[#e2e8f0]
        px-6
      "
      aria-label="Barra superior"
    >
      {/* ── Izquierda: Hamburguesa + Título ────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="p-1.5 -ml-1.5 rounded-md text-[#475569] hover:bg-slate-100 hover:text-[#0f172a] lg:hidden transition-colors cursor-pointer"
            aria-label="Abrir menú de navegación"
          >
            <MenuIcon />
          </button>
        )}
        <h1 className="font-sans font-bold text-[15px] text-[#001631] truncate">
          {title || currentLabel || 'Sistema de Gestión de Proyectos de Investigación'}
        </h1>
      </div>

      {/* ── Centro: Advertencia de sesión ────────────────────────────────── */}
      {showExpiryWarning && (
        <div className="
          flex items-center gap-2
          mx-4 px-3 py-1.5 rounded
          bg-[#fef3c7] border border-[#fcd34d]
          text-[#92400e] font-sans text-body-sm
        ">
          <ClockIcon />
          <span>
            Su sesión expira pronto (<strong>{minutesRemaining} min</strong>). Por favor, interactúe con el sistema para mantenerla activa.
          </span>
        </div>
      )}

      {/* ── Derecha: Perfil de usuario ───────────────────────────────────── */}
      <div className="flex items-center gap-4 flex-shrink-0">
        {user && <SessionTimer />}

        {/* Notificaciones */}
        <button
          type="button"
          className="text-[#475569] hover:text-[#0f172a] transition-colors"
          aria-label="Notificaciones"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </button>

        {/* Separador */}
        <div className="h-8 w-px bg-[#e2e8f0]" />

        {/* Usuario */}
        {user ? (
          <div className="flex items-center gap-2">
            <div className="text-[#001631]">
              {/* User Avatar SVG */}
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="5" />
                <path d="M20 21a8 8 0 0 0-16 0" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="font-sans text-[13px] font-bold text-[#001631] leading-tight">
                {user.name}
              </span>
              <span className="font-sans text-[11px] text-[#64748b] leading-tight">
                {roleLabel(user.role)}
              </span>
            </div>
          </div>
        ) : (
          /* Placeholder visual para SSR / si no hay user cargado */
          <div className="flex items-center gap-2">
             <div className="text-[#cbd5e1]">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="5" />
                <path d="M20 21a8 8 0 0 0-16 0" />
              </svg>
            </div>
            <div className="flex flex-col gap-1">
              <div className="h-3.5 w-24 bg-[#f1f5f9] rounded animate-pulse" />
              <div className="h-2.5 w-16 bg-[#f1f5f9] rounded animate-pulse" />
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

export default TopBar;
