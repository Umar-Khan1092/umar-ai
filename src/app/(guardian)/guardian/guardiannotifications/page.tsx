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
        const res = await supabase
          .from('notifications')
          .select('*')
          .or(`student_id.eq.${activeStudent.id},and(target_role.eq.Guardian,student_id.is.null)`)
          .order('created_at', { ascending: false });
        
        if (res.data) {
          const mapped = res.data.map((n: any) => {
            const dateObj = new Date(n.created_at || Date.now());
            return {
              id: n.id,
              title: n.title || (n.sender_role === 'Admin' ? 'Message from Administration' : 'Teacher Remark'),
              desc: n.message,
              dateStr: dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }),
              timeStr: dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
              color: (n.title || n.sender_role === 'Admin') ? '#2563EB' : '#16A34A',
              bg: (n.title || n.sender_role === 'Admin') ? '#EFF6FF' : '#F0FDF4'
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
              <div key={notice.id} className="guardian-action-card" style={{ padding: '12px 14px', backgroundColor: notice.bg, border: `1px solid ${notice.color}20`, gap: '4px' }}>
                <h3 style={{ margin: '0', fontSize: '15px', color: notice.color, fontWeight: 600 }}>{notice.title}</h3>
                <p style={{ margin: '4px 0', fontSize: '14px', color: '#334155', lineHeight: 1.4, wordWrap: 'break-word' }}>
                  {notice.desc}
                </p>
                <div style={{ textAlign: 'right', marginTop: '2px' }}>
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
