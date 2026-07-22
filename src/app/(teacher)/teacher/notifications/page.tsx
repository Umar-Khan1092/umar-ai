'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ShieldAlert, MessageCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

// ── helpers ──────────────────────────────────────────────────────────────────

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return `${h}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function getDayLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (isSameDay(d, today)) return 'Today';
  if (isSameDay(d, yesterday)) return 'Yesterday';

  // dd/mm/yyyy
  const dd = d.getDate().toString().padStart(2, '0');
  const mm = (d.getMonth() + 1).toString().padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// ── component ─────────────────────────────────────────────────────────────────

export const TeacherNotifications: React.FC = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchNotifications = async () => {
      if (user) {
        const res = await supabase
          .from('notifications')
          .select('*')
          .or(`and(target_role.eq.Teacher,recipient_id.is.null),recipient_id.eq.${user.id}`)
          .order('created_at', { ascending: false });

        if (res.data) setNotifications(res.data);
        setIsLoading(false);
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, [user]);

  // Group notifications by calendar day (WhatsApp style)
  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const n of notifications) {
      const label = getDayLabel(n.created_at || n.timestamp);
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(n);
    }
    return Array.from(map.entries()); // [[label, items], ...]
  }, [notifications]);

  return (
    <div className="teacher-page" style={{ paddingBottom: '80px' }}>
      <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: 700, color: '#1E293B' }}>
        Notifications
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '64px' }}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="skeleton-box" style={{ height: '80px', width: '100%', borderRadius: '16px' }} />
            <div className="skeleton-box" style={{ height: '80px', width: '100%', borderRadius: '16px' }} />
          </div>
        ) : grouped.length > 0 ? (
          grouped.map(([dayLabel, items]) => (
            <div key={dayLabel}>
              {/* ── WhatsApp-style date divider ── */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '12px',
              }}>
                <div style={{ flex: 1, height: '1px', background: '#E2E8F0' }} />
                <span style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#94A3B8',
                  background: '#F8FAFC',
                  padding: '3px 10px',
                  borderRadius: '999px',
                  border: '1px solid #E2E8F0',
                  whiteSpace: 'nowrap',
                }}>
                  {dayLabel}
                </span>
                <div style={{ flex: 1, height: '1px', background: '#E2E8F0' }} />
              </div>

              {/* ── Notification cards for this day ── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {items.map((n: any, idx: number) => {
                  const isAdmin = n.sender_role === 'Admin';
                  return (
                    <div
                      key={n.id || idx}
                      style={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: '16px',
                        padding: '14px 16px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        border: '1px solid #F1F5F9',
                        position: 'relative',
                      }}
                    >
                      {/* Body */}
                      <div style={{ flex: 1, minWidth: 0, paddingBottom: '14px' }}>
                        <div style={{ marginBottom: '4px' }}>
                          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#1E293B' }}>
                            {n.display_sender_name}
                          </h4>
                        </div>

                        {n.student_name && (
                          <div style={{ fontSize: '12px', fontWeight: 600, color: '#2563EB', marginBottom: '4px' }}>
                            RE: {n.student_name} ({n.student_class}-{n.student_section})
                          </div>
                        )}

                        <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.5', color: '#475569' }}>
                          {n.message}
                        </p>
                      </div>
                      
                      {/* Time: hour:min am/pm — bottom-right */}
                      <span style={{
                        position: 'absolute',
                        bottom: '10px',
                        right: '14px',
                        fontSize: '11px',
                        color: '#94A3B8',
                        whiteSpace: 'nowrap',
                      }}>
                        {formatTime(n.created_at || n.timestamp)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 20px',
            textAlign: 'center',
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px dashed #CBD5E1',
          }}>
            <MessageCircle size={40} color="#CBD5E1" style={{ marginBottom: '12px' }} />
            <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 600, color: '#475569' }}>
              No notifications yet
            </h3>
            <p style={{ margin: 0, fontSize: '14px', color: '#94A3B8' }}>You&apos;re all caught up!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherNotifications;
