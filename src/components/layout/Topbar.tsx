'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, Sun, Moon } from 'lucide-react';
import './Topbar.css';

interface TopbarProps {
  onMenuClick?: () => void;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export const Topbar: React.FC<TopbarProps> = ({ onMenuClick, title, subtitle, actions }) => {
  const pathname = usePathname() ?? '';
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setIsDark(true);
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }, []);

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
      setIsDark(false);
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
      setIsDark(true);
    }
  };

  const getBreadcrumb = () => {
    const path = pathname;
    if (path === '/') return 'Dashboard';
    const firstSegment = path.split('/')[1];
    if (!firstSegment) return 'Dashboard';
    return firstSegment.charAt(0).toUpperCase() + firstSegment.slice(1);
  };

  return (
    <header className="topbar">
      <div className="breadcrumb" style={{ display: 'flex', alignItems: 'center' }}>
        {onMenuClick && (
          <button className="mobile-menu-btn" onClick={onMenuClick} style={{ background: 'none', border: 'none', cursor: 'pointer', marginRight: '16px', display: 'flex', alignItems: 'center' }}>
            <Menu size={24} />
          </button>
        )}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span className="current-page" style={{ fontWeight: 'bold', fontSize: '1.2rem', margin: 0 }}>
            {title || getBreadcrumb()}
          </span>
          {subtitle && (
            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
              {subtitle}
            </span>
          )}
        </div>
      </div>
      
      <div className="topbar-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button 
          onClick={toggleTheme} 
          style={{ 
            background: 'var(--color-surface)', 
            border: '1px solid var(--color-border)', 
            borderRadius: '50%', 
            width: '40px', 
            height: '40px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            cursor: 'pointer',
            color: 'var(--color-text-main)',
            transition: 'all 0.2s ease'
          }}
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        {actions}
      </div>
    </header>
  );
};
