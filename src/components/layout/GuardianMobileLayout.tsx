'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Home, BookOpen, Banknote, Bell, User, ChevronDown, CheckCircle2 } from 'lucide-react';
import { useGuardian } from '@/context/GuardianContext';
import { NotificationButton } from '@/components/NotificationButton';
import { useUnreadNotifications } from '@/hooks/useUnreadNotifications';

export const GuardianMobileLayout = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const { students, activeStudent, setActiveStudentId, isLoading } = useGuardian();
  const [showSwitcher, setShowSwitcher] = useState(false);
  const { unreadCount } = useUnreadNotifications();

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

  if (isLoading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg-tertiary)' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="loader" style={{ margin: '0 auto', marginBottom: '16px', borderTopColor: '#2563EB' }}></div>
          <p style={{ color: '#64748B' }}>Loading Guardian Portal...</p>
        </div>
      </div>
    );
  }

  const navItems = [
    { id: 'home', icon: Home, label: 'Home', path: '/guardian/guardianhome', altPath: '/guardian/home' },
    { id: 'academics', icon: BookOpen, label: 'Academics', path: '/guardian/guardianacademics' },
    { id: 'fees', icon: Banknote, label: 'Fees', path: '/guardian/guardianfees' },
    { id: 'notifications', icon: Bell, label: 'Notices', path: '/guardian/guardiannotifications' },
    { id: 'profile', icon: User, label: 'Profile', path: '/guardian/guardianprofile' }
  ];

  return (
    <div className="guardian-mobile-app">
      <NotificationButton silent />
      {/* Sticky Header with Child Switcher */}
      <div className="guardian-mobile-header">
        <div 
          className="guardian-child-switcher"
          onClick={() => setShowSwitcher(true)}
        >
          <div className="guardian-child-avatar">
            {activeStudent?.profile_image_url ? (
              <img src={activeStudent.profile_image_url} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              activeStudent?.name?.charAt(0) || <User size={16} />
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF', lineHeight: 1.2 }}>
              {activeStudent?.name || 'Select Student'}
            </span>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>
              {activeStudent ? `${activeStudent.academic_class} ${activeStudent.section}` : ''}
            </span>
          </div>
          <ChevronDown size={16} color="rgba(255,255,255,0.7)" style={{ marginLeft: '4px' }} />
        </div>
        
        {/* Optional Logo or other top right action */}
        {deferredPrompt && (
          <button 
            onClick={handleInstallClick}
            style={{ background: '#10B981', border: 'none', color: '#FFFFFF', cursor: 'pointer', padding: '6px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' }}
          >
            Install App
          </button>
        )}
      </div>

      {/* Main Content Area */}
      <div className="guardian-content">
        {children}
      </div>

      {/* Bottom Navigation */}
      <div className="guardian-bottom-nav">
        {navItems.map(item => {
          const isActive = pathname.startsWith(item.path) || (item.altPath && pathname.startsWith(item.altPath));
          const Icon = item.icon;
          return (
            <div 
              key={item.id} 
              className={`guardian-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => router.push(item.path)}
              style={{
                background: isActive ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                color: isActive ? '#38BDF8' : 'rgba(255, 255, 255, 0.6)',
                borderRadius: '12px',
                padding: '8px 4px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={24} strokeWidth={isActive ? 2.5 : 2} style={{ color: isActive ? '#38BDF8' : 'rgba(255, 255, 255, 0.6)' }} />
                {item.id === 'notifications' && unreadCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-6px',
                    backgroundColor: '#EF4444',
                    color: '#FFFFFF',
                    borderRadius: '50%',
                    fontSize: '9px',
                    minWidth: '15px',
                    height: '15px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 3px',
                    fontWeight: 'bold',
                    boxShadow: '0 0 0 2px #0F172A'
                  }}>
                    {unreadCount}
                  </span>
                )}
              </div>
              <span>{item.label}</span>
            </div>
          );
        })}
      </div>

      {/* Child Switcher Dropdown */}
      {showSwitcher && (
        <>
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'transparent', zIndex: 1000 }} onClick={() => setShowSwitcher(false)}></div>
          <div style={{ position: 'absolute', top: '65px', left: '16px', backgroundColor: '#FFFFFF', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)', width: '280px', zIndex: 1001, border: '1px solid #E2E8F0', padding: '8px' }}>
            <h3 style={{ margin: '8px 12px 12px 12px', fontSize: '14px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Select Student</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {students.map(student => (
                <div 
                  key={student.id}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '8px', cursor: 'pointer', backgroundColor: activeStudent?.id === student.id ? '#EFF6FF' : 'transparent', transition: 'background 0.2s' }}
                  onClick={() => {
                    setActiveStudentId(student.id);
                    setShowSwitcher(false);
                  }}
                >
                  <div className="guardian-child-avatar" style={{ width: '40px', height: '40px', fontSize: '16px' }}>
                    {student.profile_image_url ? (
                      <img src={student.profile_image_url} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      student.name.charAt(0)
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: activeStudent?.id === student.id ? '#1E3A8A' : '#1E293B' }}>{student.name}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: '#64748B', marginTop: '2px' }}>Class: {student.academic_class} ({student.section})</p>
                  </div>
                  {activeStudent?.id === student.id && (
                    <CheckCircle2 size={20} color="#2563EB" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
