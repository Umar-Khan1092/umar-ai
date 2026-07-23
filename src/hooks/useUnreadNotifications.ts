'use client';

import { useState, useEffect } from 'react';
import { supabase, adminSupabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export function useUnreadNotifications() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    const fetchUnreadCount = async () => {
      const dbClient = adminSupabase || supabase;
      
      const { data } = await dbClient
        .from('notification_history')
        .select('id, read_by, recipient_id, role')
        .order('created_at', { ascending: false })
        .limit(100);

      if (data) {
        const count = data.filter(n => {
          const isForMe = n.recipient_id === user.id || n.role === user.role || (!n.recipient_id && !n.role);
          if (!isForMe) return false;
          
          const readBy = Array.isArray(n.read_by) ? n.read_by : [];
          return !readBy.includes(user.id);
        }).length;
        
        setUnreadCount(count);

        if (typeof navigator !== 'undefined' && 'setAppBadge' in navigator) {
          navigator.setAppBadge(count).catch(() => {});
        }
      }
    };

    fetchUnreadCount();

    const channelName = `unread-notifications-${user.id}-${Date.now()}`;
    const channel = supabase.channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notification_history' }, () => {
        fetchUnreadCount();
      })
      .subscribe();

    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'PUSH_RECEIVED') {
        fetchUnreadCount();
      }
    };

    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    }

    return () => {
      supabase.removeChannel(channel);
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
      }
    };
  }, [user]);

  const markAllAsRead = async () => {
    if (!user) return;
    const dbClient = adminSupabase || supabase;
    await dbClient.rpc('mark_all_notifications_read', { u_id: user.id });
    setUnreadCount(0);
    if (typeof navigator !== 'undefined' && 'clearAppBadge' in (navigator as any)) {
      (navigator as any).clearAppBadge().catch(() => {});
    }
  };

  return { unreadCount, markAllAsRead };
}
