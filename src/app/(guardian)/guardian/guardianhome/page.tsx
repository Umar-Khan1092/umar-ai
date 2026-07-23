'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useGuardian } from '@/context/GuardianContext';
import { CheckSquare, FileSpreadsheet, Banknote, Bell, Calendar, MessageCircle, Send, Users, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { triggerWebPush } from '@/lib/push';

export const GuardianHome: React.FC = () => {
  const { user } = useAuth();
  const { activeStudent, students, setActiveStudentId } = useGuardian();
  const router = useRouter();

  const [adminRemark, setAdminRemark] = useState('');
  const [sendingAdminRemark, setSendingAdminRemark] = useState(false);
  const [, setRecentActivity] = useState<any[]>([]);
  const [permission, setPermission] = useState<string>('default');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const handleSendAdminRemark = async () => {
    if (!adminRemark.trim() || !activeStudent) return;
    setSendingAdminRemark(true);
    try {
      await supabase.from('notifications').insert({
        recipient_id: 'admin',
        recipient_role: 'Admin',
        target_role: 'Admin',
        sender_id: activeStudent.id,
        sender_role: 'Guardian',
        title: `Message from Parent of ${activeStudent.name}`,
        message: adminRemark,
        context: 'Remarks',
        student_id: activeStudent.id
      });
      
      triggerWebPush({
        roles: ['Admin'],
        title: `Message from Parent of ${activeStudent.name}`,
        message: adminRemark,
        url: '/admin-notices',
        category: 'Chat'
      });
      
      setAdminRemark('');
      alert('Message sent to administration successfully.');
    } catch (err: any) {
      console.error(err);
      alert('Failed to send message.');
    } finally {
      setSendingAdminRemark(false);
    }
  };

  const [schoolSettings, setSchoolSettings] = useState<{ start: string, end: string } | null>(null);

  useEffect(() => {
    // Fetch school settings
    Promise.resolve(supabase.from('settings').select('*').eq('key', 'app_settings').single())
      .then(res => {
        const data = res.data?.value || {};
        if (data.school_start_time && data.school_end_time) {
          setSchoolSettings({ start: data.school_start_time, end: data.school_end_time });
        }
      })
      .catch((err: any) => console.error(err));

    if (activeStudent) {
      // Fetch actual notifications and attendance to populate recent activity
      Promise.all([
        supabase.from('notifications').select('*').eq('student_id', activeStudent.id).then(r => r.data || []),
        supabase.from('student_attendance').select('*').eq('student_id', activeStudent.id).order('date', { ascending: false }).limit(1).then(r => r.data || [])
      ]).then(([notices, attendance]) => {
        const activities: any[] = [];
        
        // Add latest attendance
        if (attendance.length > 0) {
          const latest = attendance[0];
          // attendance records contain records array; find student's record
          const studentRecord = latest.records?.find((r: any) => r.student_id === activeStudent.id);
          const status = studentRecord?.status || 'Unknown';
          activities.push({
            id: 'att',
            icon: CheckSquare,
            title: 'Attendance',
            desc: `Status: ${status}`,
            time: latest.date,
            color: status === 'Present' ? '#16A34A' : '#E11D48'
          });
        }
        
        // Add latest notices
        if (notices.length > 0) {
          notices.slice(0, 2).forEach((n: any) => {
            activities.push({
              id: `not_${n.id}`,
              icon: Bell,
              title: n.title || 'New Remark',
              desc: n.message || 'Notification',
              time: new Date(n.created_at).toLocaleDateString(),
              color: '#2563EB'
            });
          });
        }

        if (activities.length > 0) {
          setRecentActivity(activities);
        }
      });
    }
  }, [activeStudent]);

  const quickActions = [
    { id: 'attendance', label: 'Attendance', icon: CheckSquare, color: '#16A34A', bg: '#F0FDF4', path: '/guardian/academics' },
    { id: 'results', label: 'Results', icon: FileSpreadsheet, color: '#7C3AED', bg: '#F3E8FF', path: '/guardian/academics' },
    { id: 'fees', label: 'Fees', icon: Banknote, color: '#E11D48', bg: '#FFE4E6', path: '/guardian/fees' },
    { id: 'timetable', label: 'Timetable', icon: Calendar, color: '#2563EB', bg: '#EFF6FF', path: '/guardian/academics' }
  ];

  // Siblings = all students linked to the same guardian except the active one
  const siblings = students.filter(s => s.id !== activeStudent?.id);

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: '24px', color: '#1E293B', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          Welcome {user?.name || 'Guardian'}
          {permission === 'granted' && (
            <span style={{ color: '#16A34A', display: 'inline-flex', alignItems: 'center' }} title="Notifications Enabled">
              <CheckCircle2 size={22} fill="#16A34A" color="#FFFFFF" />
            </span>
          )}
        </h1>
        {permission !== 'granted' && (
          <button 
            onClick={() => {
              if (typeof window !== 'undefined' && 'Notification' in window) {
                Notification.requestPermission().then(p => {
                  setPermission(p);
                  if (p === 'granted') {
                    window.location.reload();
                  }
                });
              }
            }} 
            style={{ background: '#10B981', border: 'none', color: '#FFF', padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 4px rgba(16,185,129,0.2)', transition: 'all 0.2s ease' }}
          >
            <Bell size={14} /> Allow Notifications
          </button>
        )}
      </div>
      <p style={{ color: '#64748B', margin: '0 0 16px 0', fontSize: '14px' }}>
        Here is the latest update for {activeStudent?.name || 'your child'}.
      </p>

      {schoolSettings && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', padding: '10px 16px', borderRadius: '12px', marginBottom: '24px', width: 'fit-content', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)' }}>
          <Calendar size={18} color="white" />
          <span style={{ fontSize: '14px', color: 'white', fontWeight: 600, letterSpacing: '0.3px' }}>
            School Timings: {schoolSettings.start} - {schoolSettings.end}
          </span>
        </div>
      )}

      {/* Quick Action Grid */}
      <h2 style={{ fontSize: '18px', margin: '0 0 16px 0', color: '#1E293B' }}>Quick Actions</h2>
      <div className="guardian-quick-grid">
        {quickActions.map(action => (
          <div 
            key={action.id} 
            className="guardian-action-card"
            onClick={() => router.push(action.path)}
            style={{ backgroundColor: action.bg, border: `1px solid ${action.color}40` }}
          >
            <div className="guardian-action-icon" style={{ backgroundColor: '#FFFFFF', color: action.color, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <action.icon size={24} />
            </div>
            <span style={{ fontSize: '15px', fontWeight: 600, color: '#1E293B' }}>{action.label}</span>
          </div>
        ))}
      </div>

      {/* Siblings Section */}
      {siblings.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <h2 style={{ fontSize: '18px', margin: '0 0 16px 0', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={20} color="#7C3AED" /> Siblings
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {siblings.map(sibling => (
              <div
                key={sibling.id}
                onClick={() => {
                  setActiveStudentId(sibling.id);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '14px 16px',
                  background: '#FFFFFF',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  transition: 'all 0.2s ease'
                }}
                onPointerDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
                onPointerUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                <div style={{ width: '42px', height: '42px', borderRadius: '50%', backgroundColor: '#F3E8FF', color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '16px', flexShrink: 0 }}>
                  {sibling.profile_image_url ? (
                    <img src={sibling.profile_image_url} alt={sibling.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    sibling.name?.charAt(0) || '?'
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '15px', color: '#1E293B' }}>{sibling.name}</div>
                  <div style={{ fontSize: '13px', color: '#64748B' }}>{sibling.academic_class} — {sibling.section}</div>
                </div>
                <div style={{ fontSize: '12px', color: '#7C3AED', fontWeight: 600, background: '#F3E8FF', padding: '4px 10px', borderRadius: '20px' }}>
                  Switch
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Send Remark to Admin */}
      <div style={{ marginTop: '24px', padding: '16px', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <h2 style={{ fontSize: '18px', margin: '0 0 12px 0', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MessageCircle size={20} color="#2563EB" /> Contact Administration
        </h2>
        <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#64748B' }}>
          Send a direct message or remark to the school administration regarding {activeStudent?.name}.
        </p>
        <textarea
          value={adminRemark}
          onChange={(e) => setAdminRemark(e.target.value)}
          placeholder="Type your message here..."
          style={{ width: '100%', minHeight: '100px', padding: '12px', borderRadius: '8px', border: '1px solid #CBD5E1', resize: 'vertical', fontSize: '14px', marginBottom: '12px', boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleSendAdminRemark}
            disabled={!adminRemark.trim() || sendingAdminRemark}
            style={{ 
              padding: '10px 20px', 
              borderRadius: '8px', 
              background: (!adminRemark.trim() || sendingAdminRemark) ? '#94A3B8' : '#2563EB', 
              color: 'white', 
              border: 'none', 
              fontWeight: 600, 
              cursor: (!adminRemark.trim() || sendingAdminRemark) ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Send size={16} /> {sendingAdminRemark ? 'Sending...' : 'Send Message'}
          </button>
        </div>
      </div>
      
    </div>
  );
};

export default GuardianHome;

