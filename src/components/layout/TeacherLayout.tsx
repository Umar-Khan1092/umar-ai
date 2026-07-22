'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, CheckSquare, FileSpreadsheet, Calendar, LogOut, MessageSquare } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const teacherNavItems = [
  { name: 'Home', icon: LayoutDashboard, path: '/teacher/profile' },
  { name: 'Attendance', icon: CheckSquare, path: '/teacher/attendance' },
  { name: 'Exams', icon: FileSpreadsheet, path: '/teacher/marks' },
  { name: 'Timetable', icon: Calendar, path: '/teacher/timetable' },
  { name: 'Alerts', icon: MessageSquare, path: '/teacher/notifications' }
];

export const TeacherLayout = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const { logout } = useAuth();

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(() => {
        setDeferredPrompt(null);
      });
    }
  };

  let title = 'Teacher Portal';

  if (pathname.includes('/teacher/timetable')) {
    title = 'My Timetable';
  } else if (pathname.includes('/teacher/attendance')) {
    title = 'Daily Attendance';
  } else if (pathname.includes('/teacher/marks')) {
    title = 'Scheduled Exam';
  } else if (pathname.includes('/teacher/notifications')) {
    title = 'Notifications';
  } else if (pathname.includes('/teacher/profile')) {
    title = 'Dashboard';
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#F8FAFC' }}>
      
      {/* Minimal Top App Bar */}
      <header style={{ 
        height: '60px', 
        backgroundColor: 'var(--tp-primary, #2563EB)', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        padding: '0 16px',
        boxShadow: '0 2px 8px rgba(37, 99, 235, 0.2)',
        zIndex: 10
      }}>
        <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#FFFFFF' }}>{title}</h1>
        <div style={{ display: 'flex', gap: '12px' }}>
          {deferredPrompt && (
            <button 
              onClick={handleInstallClick}
              style={{ background: '#10B981', border: 'none', color: '#FFFFFF', cursor: 'pointer', padding: '6px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 'bold' }}
            >
              Install App
            </button>
          )}
          <button 
            onClick={() => { logout(); router.push('/login'); }}
            style={{ background: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#FFFFFF', cursor: 'pointer', padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease' }}
            onPointerDown={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'}
            onPointerUp={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Main Content Area (Scrollable) */}
      <main style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', position: 'relative' }}>
        {children}
      </main>

      {/* Fixed Bottom Tab Bar */}
      <nav style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '56px',
        backgroundColor: '#FFFFFF',
        boxShadow: '0 -2px 10px rgba(0,0,0,0.05)',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingBottom: 'safe-area-inset-bottom',
        zIndex: 50
      }}>
        {teacherNavItems.map((item) => {
          const isActive = pathname.includes(item.path);
          const Icon = item.icon;
          return (
            <button
              key={item.name}
              onClick={() => router.push(item.path)}
              style={{
                background: 'none',
                border: 'none',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                color: isActive ? 'var(--tp-primary, #2563EB)' : '#94A3B8',
                flex: 1,
                height: '100%',
                cursor: 'pointer',
                transition: 'color 0.2s ease, transform 0.1s ease'
              }}
              onPointerDown={(e) => e.currentTarget.style.transform = 'scale(0.92)'}
              onPointerUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
              onPointerLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              <div style={{ 
                padding: '4px 16px', 
                borderRadius: '20px', 
                backgroundColor: isActive ? 'var(--tp-primary-light, #DBEAFE)' : 'transparent',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} style={{ color: isActive ? 'var(--tp-primary, #2563EB)' : '#64748B' }} />
              </div>
              <span style={{ fontSize: '10px', fontWeight: isActive ? 700 : 500, marginTop: '4px', color: isActive ? 'var(--tp-primary, #2563EB)' : '#64748B', transition: 'color 0.3s ease' }}>
                {item.name}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
