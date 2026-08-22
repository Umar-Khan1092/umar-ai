'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { User as SupabaseUser, Session } from '@supabase/supabase-js';

// We extend the base Supabase user with our custom role metadata
export interface User {
  id: string;
  email: string;
  role: string;
  name: string;
  assigned_classes?: {class: string, section: string}[];
  allowed_assessments?: string[];
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        mapSupabaseUser(session.user);
      } else {
        setLoading(false);
      }
    });

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        mapSupabaseUser(session.user);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const mapSupabaseUser = (su: SupabaseUser) => {
    const role = su.user_metadata?.role || 'Admin';
    const name = su.user_metadata?.name || su.email?.split('@')[0] || 'User';

    setUser({
      id: su.id,
      email: su.email || '',
      role: role,
      name: name,
    });
    setLoading(false);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Unconditional listener: Registers immediately on launch so cold start actions are never lost
    import('@capacitor/core').then(({ Capacitor }) => {
      if (Capacitor.isNativePlatform()) {
        import('@capacitor/push-notifications').then(({ PushNotifications }) => {
          PushNotifications.addListener('pushNotificationActionPerformed', async (notification) => {
            console.log('[PUSH/INIT] Action performed immediately:', notification);
            const data = notification.notification.data;
            let targetUrl = data?.url;
            
            if (targetUrl) {
              // Dynamically fetch the current session role at the moment of click
              const { data: { session: activeSession } } = await supabase.auth.getSession();
              const role = activeSession?.user?.user_metadata?.role || 'Guardian';
              
              const isTeacher = role === 'Teacher' || role === 'Staff';
              const isGuardian = role === 'Guardian';
              
              if (isTeacher && targetUrl.startsWith('/guardian')) {
                if (targetUrl.includes('notification')) {
                  targetUrl = '/teacher/notifications';
                } else if (targetUrl.includes('academics')) {
                  targetUrl = '/teacher/timetable';
                } else {
                  targetUrl = '/teacher/profile';
                }
              } else if (isGuardian && targetUrl.startsWith('/teacher')) {
                if (targetUrl.includes('notification')) {
                  targetUrl = '/guardian/guardiannotifications';
                } else {
                  targetUrl = '/guardian/guardianhome';
                }
              }
            }
            
            if (targetUrl) {
              window.location.href = targetUrl;
            }
          });
        });
      }
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !user) return;

    const syncToken = async (fcmToken: string) => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (!currentSession) return;
        
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentSession.access_token}`
          },
          body: JSON.stringify({ subscription: { fcm_token: fcmToken } })
        });
        localStorage.setItem('fcm_token_synced', 'true');
        localStorage.setItem('fcm_current_token', fcmToken);
      } catch (err) {
        console.error('[PUSH/INIT] Failed to save token to server:', err);
      }
    };

    import('@capacitor/core').then(({ Capacitor }) => {
      if (Capacitor.isNativePlatform()) {
        import('@capacitor/push-notifications').then(({ PushNotifications }) => {
          PushNotifications.checkPermissions().then(async (perm) => {
            if (perm.receive === 'prompt') {
              perm = await PushNotifications.requestPermissions();
            }

            if (perm.receive === 'granted') {
              try {
                await PushNotifications.createChannel({
                  id: 'high_priority_alerts',
                  name: 'High Priority Alerts',
                  description: 'Important school alerts with sound and vibration',
                  importance: 5,
                  visibility: 1,
                  vibration: true,
                  sound: 'default'
                });
              } catch (e) {
                console.log('[PUSH/INIT] Error creating native channel:', e);
              }

              try {
                await PushNotifications.removeAllListeners();
              } catch (e) {}

              PushNotifications.addListener('registration', (tokenData) => {
                const currentToken = tokenData.value;
                const syncedToken = localStorage.getItem('fcm_current_token');
                if (currentToken !== syncedToken || !localStorage.getItem('fcm_token_synced')) {
                  syncToken(currentToken);
                }
              });

              PushNotifications.addListener('registrationError', (err) => {
                console.error('[PUSH/INIT] Registration error:', err);
              });

              PushNotifications.addListener('pushNotificationReceived', (notification) => {
                console.log('[PUSH/INIT] Foreground notification received:', notification);
              });

              await PushNotifications.register();
            }
          });
        });
      }
    });
  }, [user]);

  const logout = async () => {
    try {
      const fcmToken = localStorage.getItem('fcm_current_token');
      if (fcmToken) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', fcmToken);
        localStorage.removeItem('fcm_token_synced');
        localStorage.removeItem('fcm_current_token');
      }
    } catch (e) {
      console.error('Error cleaning up push token:', e);
    }
    await supabase.auth.signOut();
  };

  const value = React.useMemo(
    () => ({ user, session, loading, logout, isAuthenticated: !!user }),
    [user, session, loading]
  );

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
