'use client';

import React, { useState } from 'react';

import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { NotificationButton } from '@/components/NotificationButton';

export const MainLayout = ({ children }: { children: React.ReactNode }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);

  return (
    <div className="app-container">
      <NotificationButton silent />
      
      {!isSidebarCollapsed && (
        <div 
          className="sidebar-overlay" 
          onClick={() => setIsSidebarCollapsed(true)} 
        />
      )}
      <Sidebar isCollapsed={isSidebarCollapsed} onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)} />

      <div className="main-content-wrapper">
        <Topbar onMenuClick={() => setIsSidebarCollapsed(false)} />
        <main className="page-content">
          {children}
        </main>
      </div>
    </div>
  );
};
