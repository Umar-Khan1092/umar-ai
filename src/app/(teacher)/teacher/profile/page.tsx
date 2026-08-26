'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { 
  Calendar, CheckSquare, User, 
  CreditCard, Mail, Phone, MapPin, Briefcase, 
  GraduationCap, DollarSign, Shield, Key, ChevronLeft,
  Clock, Bell, ChevronRight
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { NotificationButton } from '@/components/NotificationButton';

export const TeacherProfile: React.FC = () => {
  const { user } = useAuth();
  const [staff, setStaff] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<'dashboard' | 'profile' | 'attendance' | 'report'>('dashboard');
  const [dailyReportText, setDailyReportText] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportDraftSaved, setReportDraftSaved] = useState(false);
  const [selfAttendanceStatus, setSelfAttendanceStatus] = useState<'Present' | 'Absent' | 'Leave' | null>(null);
  const [selfAttendanceSaving, setSelfAttendanceSaving] = useState(false);
  const [selfAttendanceSaved, setSelfAttendanceSaved] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [selectedModalStatus, setSelectedModalStatus] = useState<'Present' | 'Absent' | 'Leave' | null>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([]);
  const [filterMode, setFilterMode] = useState<'single' | 'range'>('single');
  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [fromMonth, setFromMonth] = useState<number>(() => new Date().getMonth());
  const [fromYear, setFromYear] = useState<number>(() => new Date().getFullYear());
  const [toMonth, setToMonth] = useState<number>(() => new Date().getMonth());
  const [toYear, setToYear] = useState<number>(() => new Date().getFullYear());
  const router = useRouter();

  // Push Notification logic migrated to global NotificationButton component

  useEffect(() => {
    if (user?.id) {
      if (user.role === 'Admin' && user.id === 'admin-0') {
        setStaff({
          name: 'Administrator',
          cnic: '00000-0000000-0',
          contact: 'System Default',
          address: 'Admin Portal',
          role: 'Admin',
          department: 'Administration',
          date_of_joining: '2020-01-01',
          qualifications: 'System Administrator'
        });
        setIsLoading(false);
        return;
      }

      (async () => {
        try {
          const res = await supabase.from('staff').select('*').eq('username', user.email).limit(1).maybeSingle();
          if (res.error) throw res.error;
          setStaff(res.data);

          if (res.data?.id) {
            const attRes = await supabase
              .from('staff_attendance')
              .select('*')
              .eq('staff_id', res.data.id)
              .order('date', { ascending: false });
            if (!attRes.error && attRes.data) {
              setAttendanceHistory(attRes.data);
              // Check if already marked today
              const today = new Date().toISOString().split('T')[0];
              const todayRecord = attRes.data.find((r: any) => r.date === today);
              if (todayRecord) {
                setSelfAttendanceStatus(todayRecord.status as any);
                setSelectedModalStatus(todayRecord.status as any);
              }
            }
          }
        } catch (err: any) {
          setError(err.message);
        } finally {
          setIsLoading(false);
        }
      })();
    }
  }, [user]);

  const submitDailyReport = async () => {
    if (!dailyReportText.trim()) return;
    setSubmittingReport(true);
    try {
      const { error } = await supabase.from('admin_activities').insert({
        activity_type: 'Teacher Report',
        description: dailyReportText.trim(),
        metadata: {
          teacher_name: staff.name,
          department: staff.department || 'Teaching'
        },
        admin_name: staff.name
      });
      if (error) throw error;
      setDailyReportText('');
      setReportDraftSaved(false);
      localStorage.removeItem(`teacher_report_draft_${staff?.id}`);
      setView('dashboard');
      alert('Daily report submitted successfully!');
    } catch (err: any) {
      alert('Failed to submit report: ' + err.message);
    } finally {
      setSubmittingReport(false);
    }
  };

  const saveDraft = () => {
    if (!dailyReportText.trim()) return;
    localStorage.setItem(`teacher_report_draft_${staff?.id}`, dailyReportText.trim());
    setReportDraftSaved(true);
    setTimeout(() => setReportDraftSaved(false), 2000);
  };

  const handleOpenReport = () => {
    const saved = localStorage.getItem(`teacher_report_draft_${staff?.id}`);
    if (saved && !dailyReportText) setDailyReportText(saved);
    setView('report');
  };

  const markSelfAttendance = async (status: 'Present' | 'Absent' | 'Leave') => {
    if (!staff?.id) return;
    setSelfAttendanceSaving(true);
    const today = new Date().toISOString().split('T')[0];
    try {
      // Upsert today's record (delete+insert)
      await supabase.from('staff_attendance').delete().eq('staff_id', staff.id).eq('date', today);
      const { error } = await supabase.from('staff_attendance').insert({
        staff_id: staff.id,
        date: today,
        status: selectedModalStatus,
        marked_by_teacher: true
      });
      if (error && !error.message.includes('column')) {
        // If marked_by_teacher column doesn't exist yet, insert without it
        await supabase.from('staff_attendance').delete().eq('staff_id', staff.id).eq('date', today);
        await supabase.from('staff_attendance').insert({ staff_id: staff.id, date: today, status: selectedModalStatus });
      }
      setSelfAttendanceStatus(selectedModalStatus);
      setSelfAttendanceSaved(true);
      setTimeout(() => {
        setSelfAttendanceSaved(false);
        setShowAttendanceModal(false);
      }, 1500);
      // Refresh attendance history
      const attRes = await supabase.from('staff_attendance').select('*').eq('staff_id', staff.id).order('date', { ascending: false });
      if (attRes.data) setAttendanceHistory(attRes.data);
    } catch (err: any) {
      alert('Failed: ' + err.message);
    } finally {
      setSelfAttendanceSaving(false);
    }
  };

  if (isLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#F8FAFC' }}>Loading...</div>;
  }

  if (error || !staff) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#DC2626', backgroundColor: '#F8FAFC' }}>{error || 'Profile not found'}</div>;
  }

  if (view === 'dashboard') {
    return (
      <div className="teacher-page" style={{ paddingBottom: '24px' }}>
        {/* Welcome Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'var(--tp-primary-light, #DBEAFE)', color: 'var(--tp-primary, #2563EB)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', fontWeight: 700, flexShrink: 0 }}>
              {staff.name.charAt(0)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#1E293B' }}>Hi, {staff.name.split(' ')[0]} 👋</h2>
                <NotificationButton />
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#64748B' }}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
            </div>
          </div>
          
          <button 
            onClick={handleOpenReport}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '6px', 
              padding: '10px 16px', borderRadius: '12px', 
              backgroundColor: '#FEF3C7', color: '#D97706', 
              border: '1px solid #FDE68A', cursor: 'pointer',
              fontWeight: 600, fontSize: '14px',
              boxShadow: '0 2px 8px rgba(217, 119, 6, 0.1)',
              transition: 'all 0.2s', flexShrink: 0
            }}
          >
            <CheckSquare size={18} /> Daily Report
          </button>
        </div>

        {/* Quick Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div 
            onClick={() => router.push('/teacher/timetable')}
            style={{ backgroundColor: '#FFFFFF', borderRadius: 'var(--tp-radius-md, 16px)', padding: '16px', boxShadow: 'var(--tp-shadow-soft, 0 4px 12px rgba(0,0,0,0.05))', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '12px' }}
          >
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: '#F1F5F9', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={20} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748B', fontWeight: 500 }}>Today's Classes</p>
              <h3 style={{ margin: '4px 0 0 0', fontSize: '20px', color: '#1E293B' }}>View Schedule</h3>
            </div>
          </div>
          
          <div 
            onClick={() => router.push('/teacher/attendance')}
            style={{ backgroundColor: '#FFFFFF', borderRadius: 'var(--tp-radius-md, 16px)', padding: '16px', boxShadow: 'var(--tp-shadow-soft, 0 4px 12px rgba(0,0,0,0.05))', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '12px' }}
          >
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: 'var(--tp-warning-light, #FEF3C7)', color: 'var(--tp-warning, #D97706)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckSquare size={20} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748B', fontWeight: 500 }}>Pending Actions</p>
              <h3 style={{ margin: '4px 0 0 0', fontSize: '20px', color: '#1E293B' }}>Mark Attendance</h3>
            </div>
          </div>
        </div>

        {/* Recent Activity / Profile Link */}
        <div style={{ marginTop: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1E293B', marginBottom: '16px' }}>Account & Settings</h3>
          
          <div 
            onClick={() => setView('profile')}
            style={{ backgroundColor: '#FFFFFF', borderRadius: 'var(--tp-radius-md, 16px)', padding: '16px', boxShadow: 'var(--tp-shadow-soft, 0 4px 12px rgba(0,0,0,0.05))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: '12px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--tp-primary-light, #DBEAFE)', color: 'var(--tp-primary, #2563EB)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User size={20} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#1E293B' }}>My Profile</h4>
                <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748B' }}>Personal & Professional details</p>
              </div>
            </div>
            <ChevronRight size={20} color="#94A3B8" />
          </div>

          <div 
            onClick={() => setShowAttendanceModal(true)}
            style={{ backgroundColor: '#FFFFFF', borderRadius: 'var(--tp-radius-md, 16px)', padding: '16px', boxShadow: 'var(--tp-shadow-soft, 0 4px 12px rgba(0,0,0,0.05))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: '12px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckSquare size={20} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#1E293B' }}>Mark Your Attendance</h4>
                <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748B' }}>
                  {selfAttendanceStatus ? `Today: ${selfAttendanceStatus}` : 'Tap to mark today\'s attendance'}
                </p>
              </div>
            </div>
            <ChevronRight size={20} color="#94A3B8" />
          </div>

          <div 
            onClick={() => router.push('/teacher/notifications')}
            style={{ backgroundColor: '#FFFFFF', borderRadius: 'var(--tp-radius-md, 16px)', padding: '16px', boxShadow: 'var(--tp-shadow-soft, 0 4px 12px rgba(0,0,0,0.05))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: '12px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#F1F5F9', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bell size={20} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#1E293B' }}>Notifications</h4>
                <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748B' }}>View recent alerts</p>
              </div>
            </div>
            <ChevronRight size={20} color="#94A3B8" />
          </div>

          <div 
            onClick={() => setView('report')}
            style={{ backgroundColor: '#FFFFFF', borderRadius: 'var(--tp-radius-md, 16px)', padding: '16px', boxShadow: 'var(--tp-shadow-soft, 0 4px 12px rgba(0,0,0,0.05))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: '12px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckSquare size={20} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#1E293B' }}>Daily Report</h4>
                <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748B' }}>Submit your end-of-day report</p>
              </div>
            </div>
            <ChevronRight size={20} color="#94A3B8" />
          </div>
        </div>

        {/* Interactive Attendance Modal */}
        {showAttendanceModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '24px', padding: '24px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 700, color: '#1E293B', textAlign: 'center' }}>Mark Your Attendance</h3>
              <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: '#64748B', textAlign: 'center' }}>{new Date().toLocaleDateString('en-PK', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</p>
              
              <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                {(['Present', 'Absent', 'Leave'] as const).map((s) => {
                  const isActive = selectedModalStatus === s;
                  const colors: Record<string, [string, string, string]> = { Present: ['#16A34A', '#DCFCE7', '#166534'], Absent: ['#DC2626', '#FEE2E2', '#991B1B'], Leave: ['#D97706', '#FEF3C7', '#92400E'] };
                  const [borderColor, bgLight, textDark] = colors[s];
                  return (
                    <button
                      key={s}
                      onClick={() => setSelectedModalStatus(s)}
                      style={{ flex: 1, padding: '16px 8px', borderRadius: '16px', border: `2px solid ${isActive ? borderColor : '#E2E8F0'}`, backgroundColor: isActive ? bgLight : '#FFFFFF', color: isActive ? textDark : '#475569', fontWeight: 700, fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}
                    >
                      <span style={{ fontSize: '24px' }}>{s === 'Present' ? '✅' : s === 'Absent' ? '❌' : '🟡'}</span>
                      <span style={{ fontSize: '14px' }}>{s}</span>
                    </button>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  onClick={() => setShowAttendanceModal(false)}
                  style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', backgroundColor: '#F1F5F9', color: '#475569', fontWeight: 600, fontSize: '15px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  onClick={() => selectedModalStatus && markSelfAttendance(selectedModalStatus as any)}
                  disabled={!selectedModalStatus || selfAttendanceSaving}
                  style={{ flex: 2, padding: '14px', borderRadius: '12px', border: 'none', backgroundColor: !selectedModalStatus ? '#CBD5E1' : '#2563EB', color: '#FFFFFF', fontWeight: 600, fontSize: '15px', cursor: !selectedModalStatus || selfAttendanceSaving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  {selfAttendanceSaving ? <div style={{ width: '20px', height: '20px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#FFF', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> : 'Submit'}
                </button>
              </div>
              {selfAttendanceSaved && <p style={{ margin: '12px 0 0 0', textAlign: 'center', color: '#16A34A', fontSize: '14px', fontWeight: 600 }}>Attendance marked successfully!</p>}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (view === 'report') {
    return (
      <div className="teacher-page" style={{ backgroundColor: '#FFFFFF', minHeight: '100%', paddingBottom: '24px' }}>
        <button 
          onClick={() => setView('dashboard')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', padding: 0, marginBottom: '24px', fontWeight: 500 }}
        >
          <ChevronLeft size={20} /> Back to Dashboard
        </button>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckSquare size={24} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#1E293B' }}>Daily Report</h2>
              <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748B' }}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
            </div>
          </div>

          <div style={{ backgroundColor: '#F8FAFC', borderRadius: '16px', padding: '20px', border: '1px solid #E2E8F0' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#1E293B', marginBottom: '8px' }}>
              What did you accomplish today?
            </label>
            <textarea
              value={dailyReportText}
              onChange={(e) => setDailyReportText(e.target.value)}
              placeholder="Write your daily progress report here in paragraph form..."
              rows={8}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '12px',
                border: '1px solid #CBD5E1',
                fontSize: '14px',
                color: '#1E293B',
                outline: 'none',
                resize: 'vertical',
                fontFamily: 'inherit'
              }}
            />
            
            <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
              <button
                onClick={saveDraft}
                disabled={!dailyReportText.trim()}
                style={{
                  flex: 1, padding: '14px', borderRadius: '12px',
                  backgroundColor: reportDraftSaved ? '#DCFCE7' : '#F1F5F9',
                  color: reportDraftSaved ? '#16A34A' : '#475569',
                  border: 'none', fontWeight: 600, fontSize: '15px',
                  cursor: !dailyReportText.trim() ? 'not-allowed' : 'pointer',
                  opacity: !dailyReportText.trim() ? 0.6 : 1, transition: 'all 0.2s'
                }}
              >
                {reportDraftSaved ? '✓ Saved!' : 'Save as Draft'}
              </button>
              <button
                onClick={submitDailyReport}
                disabled={submittingReport || !dailyReportText.trim()}
                style={{
                  flex: 2, padding: '14px', borderRadius: '12px',
                  backgroundColor: (submittingReport || !dailyReportText.trim()) ? '#93C5FD' : '#2563EB',
                  color: '#FFFFFF', border: 'none', fontWeight: 600, fontSize: '15px',
                  cursor: (submittingReport || !dailyReportText.trim()) ? 'not-allowed' : 'pointer',
                  display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px',
                  transition: 'background-color 0.2s'
                }}
              >
                {submittingReport ? <div style={{ width: '18px', height: '18px', border: '3px solid #FFF', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> : null}
                {submittingReport ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // PROFILE VIEW
  return (
    <div className="teacher-page" style={{ backgroundColor: '#FFFFFF', minHeight: '100%', paddingBottom: '24px' }}>
      <button 
        onClick={() => setView('dashboard')}
        style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', padding: 0, marginBottom: '16px', fontWeight: 500 }}
      >
        <ChevronLeft size={20} /> Back to Dashboard
      </button>

      {/* Personal Details */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ paddingBottom: '24px', borderBottom: '1px solid #E2E8F0' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 600, color: 'var(--tp-primary, #2563EB)' }}>Personal Details</h3>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ color: '#64748B', marginTop: '2px' }}><User size={18} /></div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>Full Name</p>
              <p style={{ margin: '2px 0 0 0', fontSize: '15px', fontWeight: 500, color: '#1E293B' }}>{staff.name}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ color: '#64748B', marginTop: '2px' }}><CreditCard size={18} /></div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>CNIC</p>
              <p style={{ margin: '2px 0 0 0', fontSize: '15px', fontWeight: 500, color: '#1E293B' }}>{staff.cnic || 'N/A'}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ color: '#64748B', marginTop: '2px' }}><Mail size={18} /></div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>Email</p>
              <p style={{ margin: '2px 0 0 0', fontSize: '15px', fontWeight: 500, color: '#1E293B' }}>{staff.email || staff.username || 'N/A'}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ color: '#64748B', marginTop: '2px' }}><Phone size={18} /></div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>Phone Number</p>
              <p style={{ margin: '2px 0 0 0', fontSize: '15px', fontWeight: 500, color: '#1E293B' }}>{staff.phone || 'N/A'}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ color: '#64748B', marginTop: '2px' }}><MapPin size={18} /></div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>Address</p>
              <p style={{ margin: '2px 0 0 0', fontSize: '15px', fontWeight: 500, color: '#1E293B' }}>{staff.address || 'N/A'}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Professional Details */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{ padding: '24px 0', borderBottom: '1px solid #E2E8F0' }}
      >
        <h3 style={{ margin: '0 0 20px 0', fontSize: '17px', fontWeight: 600, color: 'var(--tp-primary, #2563EB)' }}>Professional Details</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ color: '#64748B', marginTop: '2px' }}><Calendar size={18} /></div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>Joining Date</p>
              <p style={{ margin: '2px 0 0 0', fontSize: '15px', fontWeight: 500, color: '#1E293B' }}>{(staff.join_date || staff.joining_date) ? new Date(staff.join_date || staff.joining_date).toLocaleDateString('en-PK', { day: '2-digit', month: 'long', year: 'numeric' }) : 'N/A'}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ color: '#64748B', marginTop: '2px' }}><GraduationCap size={18} /></div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>Qualification</p>
              <p style={{ margin: '2px 0 0 0', fontSize: '15px', fontWeight: 500, color: '#1E293B' }}>{staff.qualification || 'N/A'}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ color: '#64748B', marginTop: '2px' }}><Briefcase size={18} /></div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>Experience</p>
              <p style={{ margin: '2px 0 0 0', fontSize: '15px', fontWeight: 500, color: '#1E293B' }}>{staff.experience ? `${staff.experience} Years` : 'N/A'}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ color: '#64748B', marginTop: '2px' }}><DollarSign size={18} /></div>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>Salary ({staff.salary_type || 'N/A'})</p>
                <p style={{ margin: '2px 0 0 0', fontSize: '15px', fontWeight: 500, color: '#1E293B' }}>PKR {staff.salary || '0'}</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Role and Access */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        style={{ paddingTop: '24px' }}
      >
        <h3 style={{ margin: '0 0 20px 0', fontSize: '17px', fontWeight: 600, color: 'var(--tp-primary, #2563EB)' }}>Role & Security</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ color: '#64748B', marginTop: '2px' }}><Shield size={18} /></div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>Username</p>
              <p style={{ margin: '2px 0 0 0', fontSize: '15px', fontWeight: 500, color: '#1E293B' }}>{user?.email || 'N/A'}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ color: '#64748B', marginTop: '2px' }}><Key size={18} /></div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>Password</p>
              <p style={{ margin: '2px 0 0 0', fontSize: '15px', fontWeight: 500, color: '#1E293B' }}>{staff.password || '••••••••'}</p>
            </div>
          </div>
        </div>
      </motion.div>

    </div>
  );
};

export default TeacherProfile;
