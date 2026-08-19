'use client';

import React, { useState, useEffect } from 'react';
import { Home, Users, Briefcase, GraduationCap, Calendar, Settings, ChevronLeft, Menu, CreditCard, Bell, BarChart3, Receipt } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useUnreadNotifications } from '@/hooks/useUnreadNotifications';

import { supabase } from '@/lib/supabase';

interface NavItem {
  name: string;
  icon: React.ElementType;
  path: string;
  color?: string;
}

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  items?: NavItem[];
}

const adminNavItems: NavItem[] = [
  { name: 'Dashboard',          icon: Home,          path: '/dashboard',     color: '#2563EB' },
  { name: 'Student Management', icon: Users,          path: '/students',      color: '#7C3AED' },
  { name: 'Fee Management',     icon: CreditCard,    path: '/fees', color: '#059669' },
  { name: 'Staff',              icon: Briefcase,     path: '/staff',         color: '#F59E0B' },
  { name: 'Academics',          icon: GraduationCap, path: '/academics',     color: '#0891B2' },
  { name: 'Attendance',         icon: Calendar,      path: '/attendance',    color: '#16A34A' },
  { name: 'Timetable',          icon: Calendar,      path: '/timetable',     color: '#9333EA' },
  { name: 'Notifications',      icon: Bell,          path: '/notifications', color: '#F43F5E' },
  { name: 'Expense Management', icon: Receipt,       path: '/finance/expenses', color: '#F97316' },
  { name: 'Finance',            icon: BarChart3,     path: '/finance', color: '#14B8A6' },
  { name: 'Settings',           icon: Settings,      path: '/settings',      color: '#94A3B8' },
];

export const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggle, items = adminNavItems }) => {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const { logout, user } = useAuth();
  
  const [instituteName, setInstituteName] = useState('School ERP');
  const [instituteLogo, setInstituteLogo] = useState('/logo.webp');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  
  const { unreadCount } = useUnreadNotifications();

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    }
  };

  useEffect(() => {
    Promise.resolve(supabase.from('settings').select('*').eq('key', 'app_settings').single())
      .then(res => {
        const data = res.data?.value || {};
        if (data.institute_name) setInstituteName(data.institute_name);
        if (data.institute_logo) setInstituteLogo(data.institute_logo);
      })
      .catch(err => console.error("Error fetching settings for sidebar:", err));
  }, []);

  // Global desktop notifications for Admin (Task 7)
  useEffect(() => {
    if (!user || user.role !== 'Admin') return;

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const channel = supabase
      .channel('admin-global-desktop-notices')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload: any) => {
          const newNotif = payload.new;
          if (
            newNotif &&
            (newNotif.target_role === 'Admin' || newNotif.recipient_role === 'Admin') &&
            ['Guardian', 'Teacher'].includes(newNotif.sender_role)
          ) {
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              new Notification(newNotif.title || 'New ERP Message', {
                body: newNotif.message || 'You have a new message on the school portal.',
                icon: '/logo.webp'
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        {!isCollapsed && (
          <>
            <img src={instituteLogo} alt="Logo" style={{ width: '32px', height: '32px', marginRight: '8px', borderRadius: '4px', objectFit: 'contain' }} />
            <h1 className="school-name" style={{ fontSize: '1.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{instituteName}</h1>
          </>
        )}
        <button 
          className="icon-button menu-toggle" 
          onClick={onToggle} 
          style={{ 
            marginLeft: isCollapsed ? '0' : 'auto', 
            color: '#94A3B8', 
            background: 'transparent', 
            border: 'none', 
            cursor: 'pointer',
            padding: '4px'
          }}
        >
          {isCollapsed ? <Menu size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>
      
      <nav className="sidebar-nav">
        <ul>
          {items.map((item) => {
            const Icon = item.icon;
            
            // Highlight tabs if we are anywhere inside them
            const isActive = (item.path === '/students' && pathname.startsWith('/students')) ||
                             (item.path === '/fees' && pathname.startsWith('/fees')) ||
                             (item.path === '/staff' && pathname.startsWith('/staff')) ||
                             (item.path === '/academics' && (pathname.startsWith('/academics') || pathname.startsWith('/exams') || pathname.startsWith('/results'))) ||
                             (item.path === '/attendance' && pathname.startsWith('/attendance')) ||
                             pathname === item.path;

            return (
              <li key={item.name}>
                <Link 
                  href={item.path} 
                  className={`nav-link ${isActive ? 'active' : ''}`}
                  title={isCollapsed ? item.name : undefined}
                  onClick={() => {
                    if (window.innerWidth <= 768 && !isCollapsed) {
                      onToggle();
                    }
                  }}
                  style={{ position: 'relative' }}
                >
                  <Icon size={isCollapsed ? 24 : 20} style={{ 
                        color: isActive ? '#FFF' : item.color,
                        flexShrink: 0
                      }} />
                      {item.name === 'Notifications' && unreadCount > 0 && (
                        <div style={{
                          position: 'absolute',
                          top: isCollapsed ? '6px' : '8px',
                          left: isCollapsed ? '24px' : '26px',
                          background: '#EF4444',
                          color: 'white',
                          fontSize: '10px',
                          fontWeight: 'bold',
                          height: '18px',
                          minWidth: '18px',
                          padding: '0 4px',
                          borderRadius: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 2px 5px rgba(239,68,68,0.4)',
                          zIndex: 10
                        }}>
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </div>
                      )}{!isCollapsed && <span>{item.name}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div style={{ padding: '16px', borderTop: '1px solid #1E293B', marginTop: 'auto' }}>
        {deferredPrompt && (
          <button 
            onClick={handleInstallClick}
            className="nav-link" 
            style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', color: '#10B981', marginBottom: '8px' }}
            title={isCollapsed ? 'Install App' : undefined}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="nav-icon"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            {!isCollapsed && <span>Install App</span>}
          </button>
        )}
        <button 
          onClick={handleLogout}
          className="nav-link" 
          style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', color: '#DC2626' }}
          title={isCollapsed ? 'Logout' : undefined}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="nav-icon"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          {!isCollapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
};
