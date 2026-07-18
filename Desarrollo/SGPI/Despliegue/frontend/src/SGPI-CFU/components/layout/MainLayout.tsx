'use client';

/**
 * @file MainLayout.tsx
 * @description Wrapper de pantalla completa del SGPI.
 *
 * Modelo Fixed-Fluid Hybrid:
 * - Sidebar: fijo a la izquierda, 220px
 * - TopBar: fija arriba (desplazada 220px a la derecha)
 * - Main: fluid, con padding-left 220px y padding-top 56px
 *
 * Uso:
 * ```tsx
 * // En app/dashboard/layout.tsx
 * export default function DashboardLayout({ children }) {
 *   return <MainLayout>{children}</MainLayout>;
 * }
 * ```
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { TopBar, type TopBarProps } from './TopBar';
import { AuthGuard } from '../auth/AuthGuard';

// Context to detect nested layouts
interface LayoutContextType {
  hasParentLayout: boolean;
  setTitle: (title: string) => void;
  setSubtitle: (subtitle: string) => void;
}

const LayoutContext = createContext<LayoutContextType | null>(null);

export interface MainLayoutProps extends TopBarProps {
  children: React.ReactNode;
}

export function MainLayout({ children, title: initialTitle = '', subtitle: initialSubtitle = '' }: MainLayoutProps) {
  const parentContext = useContext(LayoutContext);
  const pathname = usePathname();

  // States for title and subtitle at this layout level
  const [title, setTitle] = useState(initialTitle);
  const [subtitle, setSubtitle] = useState(initialSubtitle);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Notify parent layout of our title/subtitle when nested
  useEffect(() => {
    if (parentContext) {
      if (initialTitle) parentContext.setTitle(initialTitle);
      if (initialSubtitle) parentContext.setSubtitle(initialSubtitle);
      return () => {
        parentContext.setTitle('');
        parentContext.setSubtitle('');
      };
    }
  }, [parentContext, initialTitle, initialSubtitle]);

  // Keep internal state in sync with changes to props
  useEffect(() => {
    if (!parentContext) {
      setTitle(initialTitle);
      setSubtitle(initialSubtitle);
    }
  }, [parentContext, initialTitle, initialSubtitle]);

  // Precarga en segundo plano para las pestañas principales del sidebar (velocidad instantánea)
  useEffect(() => {
    if (parentContext) return; // Solo ejecutar en el MainLayout raíz

    const prefetch = async () => {
      try {
        const { apiClient } = await import('@/SGPI-CFU/lib/api/client');
        // Listas por defecto de las pestañas principales
        apiClient.get('/projects?page=1&limit=10').catch(() => {});
        apiClient.get('/investigators?page=1&limit=10').catch(() => {});
        apiClient.get('/groups/?limit=1000').catch(() => {});
        apiClient.get('/calls/?limit=200').catch(() => {});
        
        // Estadísticas mostradas en los dashboards de las pestañas
        apiClient.get('/investigators/stats').catch(() => {});
        apiClient.get('/projects?limit=1').catch(() => {});
        apiClient.get('/projects?limit=1&estado=En%20ejecuci%C3%B3n').catch(() => {});
        apiClient.get('/projects?limit=1&estado=Concluido').catch(() => {});
      } catch (err) {
        console.error('Error al precargar datos en segundo plano:', err);
      }
    };

    // Retrasar 600 ms para dar prioridad a la renderización y animación inicial de la página activa
    const timer = setTimeout(prefetch, 600);
    return () => clearTimeout(timer);
  }, [parentContext]);

  if (parentContext) {
    // Nested layout: transparently render children without duplication
    return <>{children}</>;
  }

  // Root layout: render the actual layout shell
  return (
    <LayoutContext.Provider value={{ hasParentLayout: true, setTitle, setSubtitle }}>
      <AuthGuard>
        <div className="min-h-screen bg-background font-sans text-on-surface">
          {/* Sidebar fijo */}
          <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

          {/* TopBar fija sobre el área de contenido */}
          <TopBar title={title} subtitle={subtitle} onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />

          {/* Área de contenido principal */}
          <main
            className="flex flex-col min-h-screen pl-0 lg:pl-[220px]"
            style={{ paddingTop: '56px' }}
            id="main-content"
          >
            {/* Container con padding del sistema */}
            <div
              key={pathname}
              className="flex-1 p-[24px] animate-sweep-in"
            >
              {children}
            </div>
          </main>
        </div>
      </AuthGuard>
    </LayoutContext.Provider>
  );
}

export default MainLayout;
