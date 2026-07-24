'use client';

import React, { useState, useEffect } from 'react';
import { useGuardian } from '@/context/GuardianContext';
import { supabase } from '@/lib/supabase';

export const GuardianNotifications: React.FC = () => {
  const { activeStudent } = useGuardian();
  const [notices, setNotices] = useState<any[]>([]);

  useEffect(() => {
    if (activeStudent) {
      const fetchNotices = async () => {
        // Fetch notices that target this student (or broadcasts to all guardians)
        const res = await supabase
          .from('notifications')
          .select('*')
          .or(`student_id.eq.${activeStudent.id},and(target_role.eq.Guardian,student_id.is.null)`)
          .order('created_at', { ascending: false });
        
        if (res.data) {
          const mapped = res.data.map((n: any) => {
            const dateObj = new Date(n.created_at || Date.now());
            const isSentByParent = n.sender_role === 'Guardian';
            
            // Task 9 category colors: Teacher remarks, Admin notices, Parent messages, System/other notices
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
              color = '#4F46E5'; // Parent Message (Indigo/Purple)
              bg = '#EEF2FF';
              categoryLabel = 'Parent Message';
            }

            return {
              id: n.id,
              title: n.title || (n.sender_role === 'Admin' ? 'Message from Administration' : (n.sender_role === 'Teacher' ? 'Teacher Remark' : 'Notification')),
              desc: n.message,
              subject: n.subject, // Task 8 metadata: Subject
              isSentByParent,
              categoryLabel,
              color,
              bg,
              dateStr: dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }),
              timeStr: dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
            };
          });
          setNotices(mapped);
        }
      };
      
      fetchNotices();
      const interval = setInterval(fetchNotices, 10000);
      return () => clearInterval(interval);
    }
  }, [activeStudent]);

  const groupedNotices = notices.reduce((acc, notice) => {
    if (!acc[notice.dateStr]) acc[notice.dateStr] = [];
    acc[notice.dateStr].push(notice);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <h1 style={{ fontSize: '24px', color: '#1E293B', margin: '0 0 24px 0' }}>Notifications</h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {Object.keys(groupedNotices).length > 0 ? Object.keys(groupedNotices).map(dateStr => (
          <div key={dateStr} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ textAlign: 'center', margin: '4px 0 8px 0' }}>
              <span style={{ backgroundColor: '#EFF6FF', color: '#2563EB', padding: '6px 14px', borderRadius: '16px', fontSize: '13px', fontWeight: 600, boxShadow: '0 2px 4px rgba(37, 99, 235, 0.1)' }}>
                {dateStr}
              </span>
            </div>
            {groupedNotices[dateStr].map((notice: any) => (
              <div 
                key={notice.id} 
                className="guardian-action-card" 
                style={{ 
                  padding: '16px', 
                  backgroundColor: notice.bg, 
                  border: `1px solid ${notice.color}25`, 
                  borderRadius: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  position: 'relative'
                }}
              >
                {/* Top status & Type badges (Task 9) */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: notice.color }}>
                    {notice.categoryLabel}
                  </span>
                  
                  {/* Sent / Received Badge */}
                  <span style={{ 
                    fontSize: '11px', 
                    padding: '2px 8px', 
                    borderRadius: '12px', 
                    fontWeight: 600,
                    backgroundColor: notice.isSentByParent ? '#E0F2FE' : '#D1FAE5',
                    color: notice.isSentByParent ? '#0369A1' : '#065F46'
                  }}>
                    {notice.isSentByParent ? 'Sent' : 'Received'}
                  </span>
                </div>

                {/* Title */}
                <h3 style={{ margin: '4px 0 0 0', fontSize: '16px', color: '#1E293B', fontWeight: 600 }}>
                  {notice.title}
                </h3>

                {/* Metadata: Class & Section (Task 8) */}
                {activeStudent && (
                  <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 500 }}>
                    For Student: <span style={{ fontWeight: 600 }}>{activeStudent.name}</span> ({activeStudent.academic_class} - {activeStudent.section})
                  </div>
                )}

                {/* Metadata: Subject (Task 8) */}
                {notice.subject && (
                  <div style={{ margin: '2px 0' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#8B5CF6', backgroundColor: '#F5F3FF', padding: '2px 8px', borderRadius: '12px', border: '1px solid #DDD6FE' }}>
                      Subject: {notice.subject}
                    </span>
                  </div>
                )}

                {/* Description / Message Body */}
                <p style={{ margin: '4px 0', fontSize: '14px', color: '#334155', lineHeight: 1.4, wordWrap: 'break-word' }}>
                  {notice.desc}
                </p>

                {/* Timestamp */}
                <div style={{ textAlign: 'right', marginTop: '4px' }}>
                  <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 500 }}>{notice.timeStr}</span>
                </div>
              </div>
            ))}
          </div>
        )) : (
          <div className="guardian-action-card" style={{ padding: '24px', textAlign: 'center' }}>
            <p style={{ margin: 0, color: '#64748B' }}>No new notifications.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GuardianNotifications;
