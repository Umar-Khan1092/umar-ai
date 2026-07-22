'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { subscribeToPush, saveSubscriptionToServer } from '@/lib/push';

export const PushNotificationManager: React.FC = () => {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permissionState, setPermissionState] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      // Check current permission without prompting
      if ('Notification' in window) {
        setPermissionState(Notification.permission);
      }
      
      // Check if already subscribed
      navigator.serviceWorker.ready.then(reg => {
        reg.pushManager.getSubscription().then(sub => {
          setIsSubscribed(!!sub);
        });
      });
    }
  }, []);

  // Auto-subscribe if they already granted permission but aren't subscribed
  useEffect(() => {
    if (user && isSupported && permissionState === 'granted' && !isSubscribed) {
      handleSubscribe();
    }
  }, [user, isSupported, permissionState, isSubscribed]);

  const handleSubscribe = async () => {
    try {
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        console.error('VAPID public key not configured');
        return;
      }
      
      const sub = await subscribeToPush(vapidKey);
      await saveSubscriptionToServer(sub);
      setIsSubscribed(true);
      if ('Notification' in window) {
        setPermissionState(Notification.permission);
      }
    } catch (err) {
      console.error('Failed to subscribe to push notifications:', err);
      if ('Notification' in window) {
        setPermissionState(Notification.permission);
      }
    }
  };

  // If they are logged in, push is supported, and they haven't explicitly denied,
  // we could show a soft prompt UI. For now, we'll just render a small subtle banner or nothing
  // if they are already subscribed.
  if (!user || !isSupported || isSubscribed || permissionState === 'denied') {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      left: '20px',
      right: '20px',
      zIndex: 9999,
      maxWidth: '400px',
      backgroundColor: 'var(--color-surface, #1E293B)',
      color: 'var(--color-text-heading, #F8FAFC)',
      padding: '16px',
      borderRadius: '12px',
      boxShadow: 'var(--shadow-premium, 0 10px 25px -5px rgba(0,0,0,0.5))',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      border: '1px solid var(--color-border, #334155)'
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          padding: '10px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#3B82F6'
        }}>
          🔔
        </div>
        <div>
          <h4 style={{ margin: '0 0 4px 0', fontSize: '15px' }}>Enable Notifications</h4>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary, #94A3B8)', lineHeight: 1.4 }}>
            Get instant updates on attendance, fees, and school announcements even when the app is closed.
          </p>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button 
          onClick={() => setPermissionState('denied')} // Just hide for this session
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--color-text-secondary, #94A3B8)',
            padding: '8px 12px',
            fontSize: '13px',
            cursor: 'pointer',
            borderRadius: '6px',
            fontWeight: 500
          }}
        >
          Not Now
        </button>
        <button 
          onClick={handleSubscribe}
          style={{
            background: '#3B82F6',
            border: 'none',
            color: '#FFFFFF',
            padding: '8px 16px',
            fontSize: '13px',
            cursor: 'pointer',
            borderRadius: '6px',
            fontWeight: 600,
            boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)'
          }}
        >
          Enable
        </button>
      </div>
    </div>
  );
};
