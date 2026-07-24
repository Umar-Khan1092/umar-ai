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
        // Task 4: Resolve the teacher's staff ID first to receive parent direct remarks
        const { data: staffData } = await supabase.from('staff').select('id').eq('username', user.email).maybeSingle();
        const staffId = staffData?.id;

        let query = supabase
          .from('notifications')
          .select('*');
        
        if (staffId) {
          query = query.or(`and(target_role.eq.Teacher,recipient_id.is.null),recipient_id.eq.${user.id},recipient_id.eq.${staffId}`);
        } else {
          query = query.or(`and(target_role.eq.Teacher,recipient_id.is.null),recipient_id.eq.${user.id}`);
        }

        const res = await query.order('created_at', { ascending: false });
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
                  const isSentByTeacher = n.sender_role === 'Teacher';
                  
                  // Category Styling (Task 10)
                  let color = '#D97706'; // default System notification (Orange)
                  let bg = '#FFFBEB';
                  let categoryLabel = 'System Notification';
                  
                  if (n.sender_role === 'Teacher') {
                    color = '#059669'; // Teacher Remark (Green)
                    bg = '#ECFDF5';
                    categoryLabel = 'Teacher Remark';
                  } else if (n.sender_role === 'Admin') {
                    color = '#2563EB'; // Admin Notification (Blue)
                    bg = '#EFF6FF';
                    categoryLabel = 'Admin Notification';
                  } else if (n.sender_role === 'Guardian') {
                    color = '#4F46E5'; // Parent Message (Indigo)
                    bg = '#EEF2FF';
                    categoryLabel = 'Parent Message';
                  }

                  return (
                    <div
                      key={n.id || idx}
                      style={{
                        backgroundColor: bg,
                        borderRadius: '16px',
                        padding: '16px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        border: `1px solid ${color}20`,
                        position: 'relative',
                      }}
                    >
                      {/* Badge Row (Task 10) */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: color }}>
                          {categoryLabel}
                        </span>
                        
                        {/* Sent / Received Badge */}
                        <span style={{ 
                          fontSize: '11px', 
                          padding: '2px 8px', 
                          borderRadius: '12px', 
                          fontWeight: 600,
                          backgroundColor: isSentByTeacher ? '#E0F2FE' : '#D1FAE5',
                          color: isSentByTeacher ? '#0369A1' : '#065F46'
                        }}>
                          {isSentByTeacher ? 'Sent' : 'Received'}
                        </span>
                      </div>

                      {/* Header/Title */}
                      <h4 style={{ margin: '4px 0 0 0', fontSize: '15px', fontWeight: 600, color: '#1E293B' }}>
                        {n.title || n.display_sender_name || (n.sender_role === 'Admin' ? 'Message from Administration' : (n.sender_role === 'Teacher' ? 'Teacher Remark' : 'Notification'))}
                      </h4>

                      {/* Subject Metadata (Task 8) */}
                      {n.subject && (
                        <div style={{ margin: '2px 0' }}>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: '#8B5CF6', backgroundColor: '#F5F3FF', padding: '2px 8px', borderRadius: '12px', border: '1px solid #DDD6FE' }}>
                            Subject: {n.subject}
                          </span>
                        </div>
                      )}

                      {/* Student info if present */}
                      {n.student_name && (
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                          RE: {n.student_name} {n.student_class ? `(${n.student_class}-${n.student_section})` : ''}
                        </div>
                      )}

                      {/* Body Message */}
                      <p style={{ margin: '2px 0 14px 0', fontSize: '14px', lineHeight: '1.5', color: '#475569' }}>
                        {n.message}
                      </p>
                      
                      {/* Time */}
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
