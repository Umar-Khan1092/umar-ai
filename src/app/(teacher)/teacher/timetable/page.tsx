'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, Clock, BookOpen, Users, Megaphone, Send, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { formatTime } from '@/utils/formatDate';
import { supabase, adminSupabase } from '@/lib/supabase';
import { triggerWebPush } from '@/lib/push';

interface TimetableEntry {
  id: string;
  class_name: string;
  section: string;
  day: string;
  start_time: string;
  end_time: string;
  subject: string;
  teacher_id: string;
  teacher_name: string;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_ABBR: Record<string, string> = {
  Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed',
  Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat'
};
const CLASS_COLORS = [
  { bg: '#EFF6FF', border: '#3B82F6', text: '#1D4ED8', light: '#DBEAFE' },
  { bg: '#FDF4FF', border: '#A855F7', text: '#7C3AED', light: '#F3E8FF' },
  { bg: '#F0FDF4', border: '#22C55E', text: '#15803D', light: '#DCFCE7' },
  { bg: '#FFF7ED', border: '#F97316', text: '#C2410C', light: '#FFEDD5' },
  { bg: '#FFF1F2', border: '#F43F5E', text: '#BE123C', light: '#FFE4E6' },
];

export const TeacherTimetable: React.FC = () => {
  const { user } = useAuth();
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string>('All');

  const [announcementModal, setAnnouncementModal] = useState<{isOpen: boolean, class_name: string, section: string, message: string, isSending: boolean}>({
    isOpen: false, class_name: '', section: '', message: '', isSending: false
  });

  const sendAnnouncement = async () => {
    if (!announcementModal.message.trim()) return;
    setAnnouncementModal(prev => ({ ...prev, isSending: true }));
    
    try {
      const { data: students } = await supabase.from('students')
        .select('id')
        .eq('academic_class', announcementModal.class_name)
        .eq('section', announcementModal.section);
        
      if (students && students.length > 0) {
        const notifs = students.map(s => ({
          target_role: 'Guardian',
          sender_role: 'Teacher',
          title: `Announcement: Class ${announcementModal.class_name}-${announcementModal.section}`,
          message: announcementModal.message,
          category: 'General',
          student_id: s.id
        }));
        
        await supabase.from('notifications').insert(notifs);
        
        triggerWebPush({
          roles: ['Guardian'],
          title: `Announcement: Class ${announcementModal.class_name}-${announcementModal.section}`,
          message: announcementModal.message,
          url: '/guardian/guardianhome',
          category: 'General'
        });
      }
      
      alert('Announcement sent successfully!');
      setAnnouncementModal({ isOpen: false, class_name: '', section: '', message: '', isSending: false });
    } catch (err: any) {
      alert('Failed to send announcement: ' + err.message);
      setAnnouncementModal(prev => ({ ...prev, isSending: false }));
    }
  };

  useEffect(() => {
    let subscription: any = null;
    
    if (user?.id) {
      const fetchTimetable = async () => {
        try {
          const dbClient = adminSupabase || supabase;
          const staffRes = await dbClient.from('staff').select('id, name').ilike('username', user.email ?? '').limit(1).maybeSingle();
          if (!staffRes.data) { setLoading(false); return; }
          const res = await dbClient.from('timetable').select('*').eq('teacher_id', staffRes.data.id);
          const mapped = (res.data || []).map((t: any) => ({
            ...t,
            class_name: t.academic_class,
            teacher_name: staffRes.data!.name
          }));
          setTimetable(mapped);
        } catch (err) {
          console.error(err);
        } finally {
          setLoading(false);
        }
      };
      
      fetchTimetable();
      
      subscription = supabase
        .channel('timetable_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'timetable' }, () => {
          fetchTimetable();
        })
        .subscribe();
    }
    
    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, [user]);

  if (loading) {
    return (
      <div className="teacher-page" style={{ paddingBottom: '80px' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ height: '100px', backgroundColor: '#F1F5F9', borderRadius: '16px', marginBottom: '12px', opacity: 0.6 }} />
        ))}
      </div>
    );
  }

  const classSectionMap: Record<string, TimetableEntry[]> = {};
  timetable.forEach(entry => {
    const key = `${entry.class_name}||${entry.section}`;
    if (!classSectionMap[key]) classSectionMap[key] = [];
    classSectionMap[key].push(entry);
  });

  const activeDays = DAYS.filter(d => timetable.some(e => e.day === d));

  return (
    <div className="teacher-page" style={{ paddingBottom: '80px' }}>
      <h2 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: 700, color: '#1E293B' }}>My Timetable</h2>
      <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#64748B' }}>Your assigned classes and periods</p>

      {timetable.length === 0 ? (
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', textAlign: 'center', padding: '60px 24px', color: '#94A3B8', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', border: '1px solid #E2E8F0' }}>
          <Calendar size={48} style={{ opacity: 0.2, margin: '0 auto 16px' }} />
          <h3 style={{ margin: '0 0 8px 0', color: '#475569' }}>No Classes Assigned</h3>
          <p style={{ margin: 0, fontSize: '14px' }}>Please contact the Admin to assign you to classes in the Timetable.</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
            {[
              { icon: <BookOpen size={18} color="#3B82F6" />, bg: '#DBEAFE', label: 'Classes', value: Object.keys(classSectionMap).length, color: '#EFF6FF' },
              { icon: <Clock size={18} color="#22C55E" />, bg: '#DCFCE7', label: 'Periods', value: timetable.length, color: '#F0FDF4' },
              { icon: <Users size={18} color="#A855F7" />, bg: '#F3E8FF', label: 'Days/Week', value: activeDays.length, color: '#FDF4FF' },
            ].map((stat, i) => (
              <div key={i} style={{ backgroundColor: stat.color, borderRadius: '12px', padding: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: stat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{stat.icon}</div>
                <div>
                  <p style={{ margin: 0, fontSize: '11px', color: '#64748B', fontWeight: 500 }}>{stat.label}</p>
                  <p style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#1E293B' }}>{stat.value}</p>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none', marginBottom: '20px' }}>
            {['All', ...activeDays].map(day => (
              <button key={day} onClick={() => setSelectedDay(day)} style={{ padding: '6px 16px', borderRadius: '20px', border: 'none', fontSize: '13px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', backgroundColor: selectedDay === day ? '#3B82F6' : '#F1F5F9', color: selectedDay === day ? '#FFFFFF' : '#475569', transition: 'all 0.2s', flexShrink: 0 }}>
                {day === 'All' ? 'All Days' : DAY_ABBR[day] || day}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {Object.entries(classSectionMap).map(([key, entries], idx) => {
              const [cls, sec] = key.split('||');
              const color = CLASS_COLORS[idx % CLASS_COLORS.length];
              const dayEntries = selectedDay === 'All' ? entries : entries.filter(e => e.day === selectedDay);
              if (dayEntries.length === 0) return null;

              const periodMap: Record<string, { subject: string; start_time: string; end_time: string; days: string[] }> = {};
              dayEntries.forEach(e => {
                const pKey = `${e.subject}|${e.start_time}|${e.end_time}`;
                if (!periodMap[pKey]) periodMap[pKey] = { subject: e.subject, start_time: e.start_time, end_time: e.end_time, days: [] };
                if (!periodMap[pKey].days.includes(e.day)) periodMap[pKey].days.push(e.day);
              });
              const periods = Object.values(periodMap).sort((a, b) => a.start_time.localeCompare(b.start_time));

              return (
                <div key={key} style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderLeft: `5px solid ${color.border}` }}>
                  <div style={{ backgroundColor: color.bg, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1E293B' }}>
                        Class {cls}
                        <span style={{ marginLeft: '8px', fontSize: '12px', fontWeight: 600, backgroundColor: color.light, color: color.text, padding: '2px 10px', borderRadius: '20px' }}>Section {sec}</span>
                      </h3>
                      <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748B' }}>{periods.length} period{periods.length !== 1 ? 's' : ''}{selectedDay !== 'All' ? ` on ${selectedDay}` : ' assigned'}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        onClick={() => setAnnouncementModal({ isOpen: true, class_name: cls, section: sec, message: '', isSending: false })}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', border: `1px solid ${color.text}40`, backgroundColor: color.light, color: color.text, fontWeight: 600, fontSize: '12px', cursor: 'pointer', transition: 'all 0.2s' }}
                      >
                        <Megaphone size={14} /> Announce
                      </button>
                      <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: color.light, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <BookOpen size={16} color={color.text} />
                      </div>
                    </div>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table" style={{ margin: 0, borderTop: 'none', width: '100%', minWidth: '500px' }}>
                      <thead>
                        <tr>
                          <th style={{ backgroundColor: 'rgba(248, 250, 252, 0.5)', padding: '12px 16px', borderBottom: '1px solid #E2E8F0', color: '#475569', fontWeight: 600, textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Subject</th>
                          <th style={{ backgroundColor: 'rgba(248, 250, 252, 0.5)', padding: '12px 16px', borderBottom: '1px solid #E2E8F0', color: '#475569', fontWeight: 600, textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Time</th>
                          <th style={{ backgroundColor: 'rgba(248, 250, 252, 0.5)', padding: '12px 16px', borderBottom: '1px solid #E2E8F0', color: '#475569', fontWeight: 600, textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Days</th>
                        </tr>
                      </thead>
                      <tbody>
                        {periods.map((period, i) => {
                          period.days.sort((d1, d2) => DAYS.indexOf(d1) - DAYS.indexOf(d2));
                          const daysDisplay = period.days.length === DAYS.length ? 'Full Week' : period.days.map(d => DAY_ABBR[d] || d).join(', ');
                          return (
                            <tr key={i} style={{ borderBottom: i < periods.length - 1 ? '1px solid #F1F5F9' : 'none', backgroundColor: i % 2 === 0 ? '#FFFFFF' : '#FAFBFC' }}>
                              <td style={{ padding: '12px 16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <div style={{ width: '30px', height: '30px', borderRadius: '8px', backgroundColor: color.light, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <span style={{ fontSize: '10px', fontWeight: 800, color: color.text }}>{period.subject.slice(0, 3).toUpperCase()}</span>
                                  </div>
                                  <span style={{ fontWeight: 600, color: '#1E293B', fontSize: '14px' }}>{period.subject}</span>
                                </div>
                              </td>
                              <td style={{ padding: '12px 16px', color: '#475569', fontSize: '13px', whiteSpace: 'nowrap' }}>
                                {formatTime(period.start_time)} - {formatTime(period.end_time)}
                              </td>
                              <td style={{ padding: '12px 16px', color: '#64748B', fontSize: '13px' }}>
                                {daysDisplay}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Announcement Modal */}
      {announcementModal.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div style={{ width: '100%', maxWidth: '400px', padding: '24px', position: 'relative', backgroundColor: '#FFFFFF', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
            <button onClick={() => setAnnouncementModal(prev => ({ ...prev, isOpen: false }))} style={{ position: 'absolute', top: '20px', right: '20px', background: '#F8FAFC', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', color: '#64748B' }}>
              <X size={18} />
            </button>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 600, color: '#1E293B' }}>Global Announcement</h2>
            <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#64748B' }}>
              To all parents of <strong style={{ color: '#1E293B' }}>Class {announcementModal.class_name}-{announcementModal.section}</strong>
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>Message</label>
              <textarea 
                style={{ width: '100%', minHeight: '120px', resize: 'vertical', padding: '12px', borderRadius: '12px', border: '1px solid #CBD5E1', outline: 'none', fontSize: '14px', color: '#1E293B', backgroundColor: '#F8FAFC' }}
                placeholder="Type your announcement (e.g., 'Math test tomorrow at 9 AM')..."
                value={announcementModal.message}
                onChange={(e) => setAnnouncementModal(prev => ({ ...prev, message: e.target.value }))}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
              <button onClick={() => setAnnouncementModal(prev => ({ ...prev, isOpen: false }))} disabled={announcementModal.isSending} style={{ padding: '10px 16px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, backgroundColor: 'transparent', color: '#64748B', border: 'none', cursor: 'pointer' }}>Cancel</button>
              <button onClick={sendAnnouncement} disabled={!announcementModal.message.trim() || announcementModal.isSending} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, backgroundColor: (!announcementModal.message.trim() || announcementModal.isSending) ? '#94A3B8' : '#2563EB', color: '#FFFFFF', border: 'none', cursor: (!announcementModal.message.trim() || announcementModal.isSending) ? 'not-allowed' : 'pointer', boxShadow: (!announcementModal.message.trim() || announcementModal.isSending) ? 'none' : '0 4px 12px rgba(37, 99, 235, 0.2)' }}>
                <Send size={16} /> {announcementModal.isSending ? 'Sending...' : 'Announce'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherTimetable;
