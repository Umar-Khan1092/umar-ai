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

  // Show the banner if it's supported and they are not subscribed.
  // If denied, they can click 'Enable' to see instructions or try again.
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
