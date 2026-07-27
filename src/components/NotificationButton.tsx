'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken } from 'firebase/messaging';
import { supabase } from '@/lib/supabase';
import { Bell, CheckCircle2 } from 'lucide-react';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

export const NotificationButton: React.FC<{ silent?: boolean }> = ({ silent = false }) => {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('fcm_token_synced') === 'true';
    }
    return false;
  });
  const [permissionState, setPermissionState] = useState<NotificationPermission>('default');
  const [isNativeCapacitor, setIsNativeCapacitor] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      import('@capacitor/core').then(({ Capacitor }) => {
        if (Capacitor.isNativePlatform()) {
          setIsNativeCapacitor(true);
          return;
        } else {
          // Web check
          if ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) {
            setIsSupported(true);
            setPermissionState(Notification.permission);
            if (Notification.permission === 'granted') {
              const hasToken = localStorage.getItem('fcm_token_synced');
              if (hasToken) setIsSubscribed(true);
            }
          }
        }
      });
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

      if (isNativeCapacitor) {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        let permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }
        
        if (permStatus.receive === 'granted') {
          // Explicitly create a high-importance channel for Android 8.0+ ringtones
          try {
            await PushNotifications.createChannel({
              id: 'high_priority_alerts',
              name: 'High Priority Alerts',
              description: 'Important school alerts with sound and vibration',
              importance: 5,
              visibility: 1,
              vibration: true,
              sound: 'default' // requests the default notification sound
            });
          } catch(e) {
            console.log('Error creating push channel', e);
          }

          // Clean up duplicate listeners before adding new ones
          try {
            await PushNotifications.removeAllListeners();
          } catch(e) {}

          // Add the listeners back so they remain active
          PushNotifications.addListener('pushNotificationReceived', (notification) => {
            console.log('Push received in foreground:', notification);
          });

          PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
            console.log('Push action performed:', notification);
            const data = notification.notification.data;
            const url = data?.url;
            if (url) {
              window.location.href = url;
            }
          });

           // Set up listeners first before registering to avoid race conditions where event fires before promise attaches listener
          const tokenPromise = new Promise<string | null>((resolve) => {
            const timeout = setTimeout(() => resolve(null), 5000);
            PushNotifications.addListener('registration', (t) => {
              clearTimeout(timeout);
              resolve(t.value);
            });
            PushNotifications.addListener('registrationError', (err) => {
              console.error('Registration error callback:', err);
              clearTimeout(timeout);
              resolve(null);
            });
          });

          await PushNotifications.register();
          token = await tokenPromise;
          if (token) {
            setPermissionState('granted');
          }
        }
      } else {
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

  if (!user || !isSupported || silent || isNativeCapacitor) {
    return null;
  }
  
  if (isSubscribed) {
    return (
      <span style={{ color: '#16A34A', display: 'inline-flex', alignItems: 'center', marginLeft: '12px' }} title="Notifications Enabled">
        <CheckCircle2 size={22} fill="#16A34A" color="#FFFFFF" />
      </span>
    );
  }

  const isDenied = permissionState === 'denied';

  return (
    <button 
      onClick={() => {
        if (isDenied) {
          alert('Notifications are blocked by your device/browser. Please enable them in your settings and refresh the page.');
        } else {
          handleSubscribe();
        }
      }}
      style={{
        background: '#10B981',
        border: 'none',
        color: '#FFFFFF',
        padding: '6px 14px',
        fontSize: '12px',
        cursor: 'pointer',
        borderRadius: '20px',
        fontWeight: 600,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        boxShadow: '0 2px 4px rgba(16,185,129,0.2)',
        transition: 'all 0.2s ease',
        marginLeft: '12px'
      }}
    >
      <Bell size={14} />
      {isDenied ? 'Notifications Blocked' : 'Enable Notifications'}
    </button>
  );
};
