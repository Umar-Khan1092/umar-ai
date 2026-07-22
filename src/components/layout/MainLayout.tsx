'use client';

import React, { useState } from 'react';

import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export const MainLayout = ({ children }: { children: React.ReactNode }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <div className="app-container">
      <Sidebar isCollapsed={isSidebarCollapsed} onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)} />
      <div className="main-content-wrapper">
        <Topbar />
        <main className="page-content">
          {children}
        </main>
      </div>
    </div>
  );
};
