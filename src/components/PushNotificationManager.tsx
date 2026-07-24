'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken } from 'firebase/messaging';
import { supabase } from '@/lib/supabase';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

export const PushNotificationManager: React.FC = () => {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permissionState, setPermissionState] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      if ('Notification' in window) {
        setPermissionState(Notification.permission);
        if (Notification.permission === 'granted') {
          // Check localStorage to avoid hammering Firebase
          const hasToken = localStorage.getItem('fcm_token_synced');
          if (hasToken) setIsSubscribed(true);
        }
      }
    }
  }, []);

  // Auto-subscribe if they already granted permission but aren't subscribed
  useEffect(() => {
    if (user && isSupported && permissionState === 'granted' && !isSubscribed) {
      handleSubscribe();
    }
  }, [user, isSupported, permissionState, isSubscribed]);

  const saveSubscriptionToServer = async (token: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ subscription: { fcm_token: token } })
      });
      if (res.ok) {
        localStorage.setItem('fcm_token_synced', 'true');
        localStorage.setItem('fcm_current_token', token);
      }
    } catch (e) {
      console.error('Error saving FCM token', e);
    }
  };

  const handleSubscribe = async () => {
    try {
      if (!firebaseConfig.apiKey) {
        console.error('Firebase config not found');
        return;
      }
      
      let token: string | null = null;
      let isNative = false;

      // Try Capacitor Native Push first
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (Capacitor.isNativePlatform()) {
          isNative = true;
          const { PushNotifications } = await import('@capacitor/push-notifications');
          
          let permStatus = await PushNotifications.checkPermissions();
          if (permStatus.receive === 'prompt') {
            permStatus = await PushNotifications.requestPermissions();
          }
          
          if (permStatus.receive === 'granted') {
            await PushNotifications.register();
            // Wait up to 5 seconds for the token event
            token = await new Promise<string | null>((resolve) => {
              const timeout = setTimeout(() => resolve(null), 5000);
              PushNotifications.addListener('registration', (t) => {
                clearTimeout(timeout);
                resolve(t.value);
              });
              PushNotifications.addListener('registrationError', () => {
                clearTimeout(timeout);
                resolve(null);
              });
            });
            if (token) {
              setPermissionState('granted');
            }
          }
        }
      } catch (e) {
        console.log('Capacitor native push check failed or not in native context.', e);
      }

      // Fallback to Firebase Web Push if not native
      if (!isNative) {
        const app = initializeApp(firebaseConfig);
        const messaging = getMessaging(app);
        
        const permission = await Notification.requestPermission();
        setPermissionState(permission);
        
        if (permission === 'granted') {
          token = await getToken(messaging, {
            vapidKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
          });
        }
      }
      
      if (token) {
        await saveSubscriptionToServer(token);
        setIsSubscribed(true);
      }
    } catch (err) {
      console.error('Failed to subscribe to FCM push notifications:', err);
    }
  };

  if (!user || !isSupported || isSubscribed) {
    return null;
  }
  
  const isDenied = permissionState === 'denied';

  return (
    <div style={{
      position: 'fixed',
      top: '12px',
      right: '120px',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center'
    }}>
      <button 
        onClick={() => {
          if (isDenied) {
            alert('Notifications are blocked by your browser. Please enable them in your site settings (usually the lock icon next to the URL) and refresh the page.');
          } else {
            handleSubscribe();
          }
        }}
        style={{
          background: '#3B82F6',
          border: 'none',
          color: '#FFFFFF',
          padding: '8px 16px',
          fontSize: '13px',
          cursor: 'pointer',
          borderRadius: '20px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 2px 8px rgba(59, 130, 246, 0.4)',
          transition: 'all 0.2s ease'
        }}
      >
        <span style={{ fontSize: '14px' }}>🔔</span>
        {isDenied ? 'Notifications Blocked' : 'Enable Notifications'}
      </button>
    </div>
  );
};
