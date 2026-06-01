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

import React from 'react';
import { Sidebar } from './Sidebar';
import { TopBar, type TopBarProps } from './TopBar';

export interface MainLayoutProps extends TopBarProps {
  children: React.ReactNode;
}

export function MainLayout({ children, title, subtitle }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-background font-sans text-on-surface">
      {/* Sidebar fijo */}
      <Sidebar />

      {/* TopBar fija sobre el área de contenido */}
      <TopBar title={title} subtitle={subtitle} />

      {/* Área de contenido principal */}
      <main
        className="flex flex-col min-h-screen"
        style={{ paddingLeft: '220px', paddingTop: '56px' }}
        id="main-content"
      >
        {/* Container con padding del sistema */}
        <div className="flex-1 p-[24px]">
          {children}
        </div>
      </main>
    </div>
  );
}

export default MainLayout;
