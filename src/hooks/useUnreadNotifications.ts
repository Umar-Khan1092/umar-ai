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
      
      let studentIds: string[] = [];
      let staffId = '';
      
      if (user.role === 'Guardian') {
        const { data: students } = await dbClient
          .from('students')
          .select('id')
          .eq('guardian_id', user.id);
        if (students) {
          studentIds = students.map(s => s.id);
        }
      } else if (user.role === 'Teacher') {
        const { data: staffData } = await dbClient
          .from('staff')
          .select('id')
          .eq('username', user.email)
          .maybeSingle();
        if (staffData) {
          staffId = staffData.id;
        }
      }

      const { data, error: fetchErr } = await dbClient
        .from('notification_history')
        .select('id, read_by, recipient_id, role')
        .order('created_at', { ascending: false })
        .limit(100);

      if (fetchErr) {
        console.error('[UNREAD_HOOK] Error fetching notifications:', fetchErr);
        return;
      }

      if (data) {
        const count = data.filter(n => {
          const cleanRecipientId = n.recipient_id 
            ? String(n.recipient_id).replace('parent_', '').replace('staff_', '') 
            : null;
            
          const isForStudent = cleanRecipientId && studentIds.includes(cleanRecipientId);
          const isForStaff = cleanRecipientId && cleanRecipientId === staffId;
          
          const isForMe = cleanRecipientId === user.id || 
                          n.role === user.role || 
                          isForStudent || 
                          isForStaff || 
                          (!n.recipient_id && !n.role);
                          
          if (!isForMe) return false;
          
          const readBy = Array.isArray(n.read_by) ? n.read_by : [];
          return !readBy.includes(user.id);
        }).length;
        
        console.log(`[UNREAD_HOOK] User ID: ${user.id}, Role: ${user.role}, Student IDs: ${JSON.stringify(studentIds)}, Staff ID: ${staffId}, Unread Count: ${count}`);
        
        setUnreadCount(count);

        if (typeof navigator !== 'undefined' && 'setAppBadge' in navigator) {
          navigator.setAppBadge(count).catch(() => {});
        }
      }
    };

    fetchUnreadCount();

    const channelName = `unread_notifs_${user.id}_${Math.random().toString(36).substring(7)}`;
    const channel = supabase.channel(channelName);
    
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'notification_history' },
      () => {
        fetchUnreadCount();
      }
    );

    channel.subscribe();

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
  }, [user?.id, user?.role]);

  const markAllAsRead = async () => {
    if (!user) return;
    const dbClient = adminSupabase || supabase;
    
    try {
      let studentIds: string[] = [];
      let staffId = '';
      
      if (user.role === 'Guardian') {
        const { data: students } = await dbClient
          .from('students')
          .select('id')
          .eq('guardian_id', user.id);
        if (students) {
          studentIds = students.map(s => s.id);
        }
      } else if (user.role === 'Teacher') {
        const { data: staffData } = await dbClient
          .from('staff')
          .select('id')
          .eq('username', user.email)
          .maybeSingle();
        if (staffData) {
          staffId = staffData.id;
        }
      }

      const { data } = await dbClient
        .from('notification_history')
        .select('id, read_by, recipient_id, role')
        .order('created_at', { ascending: false })
        .limit(100);

      if (data) {
        const unreadItems = data.filter(n => {
          const cleanRecipientId = n.recipient_id 
            ? String(n.recipient_id).replace('parent_', '').replace('staff_', '') 
            : null;
            
          const isForStudent = cleanRecipientId && studentIds.includes(cleanRecipientId);
          const isForStaff = cleanRecipientId && cleanRecipientId === staffId;
          
          const isForMe = cleanRecipientId === user.id || 
                          n.role === user.role || 
                          isForStudent || 
                          isForStaff || 
                          (!n.recipient_id && !n.role);
                          
          if (!isForMe) return false;
          
          const readBy = Array.isArray(n.read_by) ? n.read_by : [];
          return !readBy.includes(user.id);
        });

        if (unreadItems.length > 0) {
          await Promise.all(unreadItems.map(async (n) => {
            const updatedReadBy = [...(Array.isArray(n.read_by) ? n.read_by : []), user.id];
            await dbClient
              .from('notification_history')
              .update({ read_by: updatedReadBy })
              .eq('id', n.id);
          }));
          console.log(`[UNREAD_HOOK] Marked ${unreadItems.length} notifications as read.`);
        }
      }
    } catch (err) {
      console.error('[UNREAD_HOOK] Error marking all as read:', err);
    }
    
    setUnreadCount(0);
    if (typeof navigator !== 'undefined' && 'clearAppBadge' in (navigator as any)) {
      (navigator as any).clearAppBadge().catch(() => {});
    }
  };

  return { unreadCount, markAllAsRead };
}
