// src/lib/push.ts
import { supabase } from './supabase';
import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, deleteToken } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

export const subscribeToPush = async (vapidPublicKey?: string) => {
  if (typeof window === 'undefined') {
    throw new Error('Must be called on the client');
  }
  if (!('Notification' in window)) {
    throw new Error('Push messaging is not supported.');
  }

  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  const messaging = getMessaging(app);

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission denied');
  }

  const token = await getToken(messaging, { vapidKey: vapidPublicKey || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY });
  if (!token) {
    throw new Error('Failed to generate FCM token');
  }

  return token;
};

export const unsubscribeFromPush = async () => {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  const messaging = getMessaging(app);
  await deleteToken(messaging);
};

export const saveSubscriptionToServer = async (fcmToken: string) => {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || '';

  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ subscription: { fcm_token: fcmToken } }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to save subscription to server');
  }
  return res.json();
};

export const triggerWebPush = async (payload: { userIds?: string[], roles?: string[], title: string, message: string, url: string, category?: string, metadata?: any }) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await fetch('/api/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ ...payload, skipHistory: true })
    });
  } catch (e) {
    console.error('Failed to trigger web push', e);
  }
};
