'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { adminSupabase, supabase } from '@/lib/supabase';
import { NotificationButton } from '@/components/NotificationButton';


const db = adminSupabase || supabase;

export const Dashboard: React.FC = () => {
  const router = useRouter();

  // KPI state
  const [activeStudents, setActiveStudents] = useState<number | null>(null);
  const [activeStaff, setActiveStaff] = useState<number | null>(null);
  const [attendanceRate, setAttendanceRate] = useState<string | null>(null);
  const [feeCollection, setFeeCollection] = useState<string | null>(null);

  // Secondary stats
  const [pendingFees, setPendingFees] = useState<number | null>(null);
  const [struckOffStudents, setStruckOffStudents] = useState<number | null>(null);
  const [totalTeachers, setTotalTeachers] = useState<number | null>(null);

  // Recent communications
  const [activitiesDate, setActivitiesDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [adminActivities, setAdminActivities] = useState<any[]>([]);
  const [missingReports, setMissingReports] = useState<any[]>([]);

  // Loading state
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    try {
      // ── Active Students ──
      const { count: sCount } = await db
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Active');
      setActiveStudents(sCount ?? 0);

      // ── Struck-off Students ──
      const { count: soCount } = await db
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Struck Off');
      setStruckOffStudents(soCount ?? 0);

      // ── Active Staff ──
      const { count: stCount } = await db
        .from('staff')
        .select('*', { count: 'exact', head: true })
        .neq('status', 'Struck Off');
      setActiveStaff(stCount ?? 0);

      // ── Teachers specifically ──
      const { count: teacherCount } = await db
        .from('staff')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'Teacher')
        .neq('status', 'Struck Off');
      setTotalTeachers(teacherCount ?? 0);

      // ── Today's Attendance ──
      const today = new Date().toISOString().split('T')[0];
      const { data: attData } = await db
        .from('attendance')
        .select('records')
        .eq('date', today);

      if (attData && attData.length > 0) {
        let totalStudents = 0;
        let presentStudents = 0;
        attData.forEach((att: any) => {
          const records = att.records || [];
          totalStudents += records.length;
          presentStudents += records.filter((r: any) => r.status === 'Present').length;
        });
        if (totalStudents > 0) {
          setAttendanceRate(((presentStudents / totalStudents) * 100).toFixed(1) + '%');
        } else {
          setAttendanceRate('No data');
        }
      } else {
        setAttendanceRate('Not taken');
      }

      // ── This Month's Fee Collection ──
      const now = new Date();
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const { data: feeData } = await db
        .from('fee_vouchers')
        .select('amount_paid')
        .gte('payment_date', firstOfMonth);

      if (feeData) {
        const total = feeData.reduce((sum: number, v: any) => sum + (v.amount_paid || 0), 0);
        if (total >= 1000000) {
          setFeeCollection('₨ ' + (total / 1000000).toFixed(1) + 'M');
        } else if (total >= 1000) {
          setFeeCollection('₨ ' + (total / 1000).toFixed(1) + 'k');
        } else {
          setFeeCollection('₨ ' + total.toLocaleString());
        }
      }

      // ── Pending Fee Vouchers count ──
      const { count: pendingCount } = await db
        .from('fee_vouchers')
        .select('*', { count: 'exact', head: true })
        .neq('status', 'Paid');
      setPendingFees(pendingCount ?? 0);

      // ── Admin Activities ──
      const { data: actData } = await db
        .from('admin_activities')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (actData) {
        const filteredActivities = actData.filter((a: any) => {
          // Compare using local timezone
          const dateStr = new Date(a.created_at).toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' });
          // en-CA formats as YYYY-MM-DD
          const formatted = dateStr.replace(/\//g, '-');
          return formatted === activitiesDate;
        });
        setAdminActivities(filteredActivities);
      } else {
        setAdminActivities([]);
      }

      // ── Missing Teacher Reports ──
      const { data: staffData } = await db.from('staff').select('id, name').eq('role', 'Teacher').neq('status', 'Struck Off');
      const { data: attendanceData } = await db.from('staff_attendance').select('staff_id, status').eq('date', activitiesDate);
      
      if (staffData && attendanceData) {
        // Teachers marked present today
        const presentStaffIds = attendanceData.filter((a: any) => a.status === 'Present').map((a: any) => a.staff_id);
        const presentTeachers = staffData.filter((s: any) => presentStaffIds.includes(s.id));
        
        // Teachers who submitted a report today
        const submittedTeacherNames = (actData || [])
          .filter((a: any) => a.activity_type === 'Teacher Report')
          .map((a: any) => a.admin_name);

        const missing = presentTeachers.filter((t: any) => !submittedTeacherNames.includes(t.name));
        setMissingReports(missing);
      } else {
        setMissingReports([]);
      }

    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [activitiesDate]);

  const handleDeleteActivity = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this activity?')) return;
    const db = adminSupabase || supabase;
    await db.from('admin_activities').delete().eq('id', id);
    fetchDashboardData();
  };

  const handleNotifyMissingReport = async (teacher: any) => {
    try {
      const db = adminSupabase || supabase;
      const title = 'Daily Report Reminder';
      const message = `Dear ${teacher.name},\n\nJust a friendly reminder to please submit your Daily Report for today in the Teacher Portal. Your updates help us stay aligned!\n\nThank you,\nAdministration`;
      
      const { error } = await db.from('notifications').insert({
        title,
        message,
        target_role: 'Teacher',
        staff_id: teacher.id
      });
      if (error) throw error;
      
      // Attempt push notification if available
      try {
        const authData = await supabase.auth.getSession();
        if (authData.data.session?.access_token) {
          await fetch('/api/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authData.data.session.access_token}` },
            body: JSON.stringify({ userIds: ['teacher_' + teacher.id], title, message, url: '/teacher/profile', category: 'General', skipHistory: true })
          });
        }
      } catch (e) {
        console.error('Push notification failed', e);
      }
      
      alert(`Reminder sent to ${teacher.name}!`);
    } catch (err: any) {
      alert('Failed to send reminder: ' + err.message);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 15000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  const fmt = (val: number | null) => (val === null ? '...' : val.toLocaleString());

  return (
    <div className="dashboard">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            Dashboard
            <NotificationButton />
          </h1>
          <p className="caption">Live overview of school operations and daily metrics.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--color-text-muted)', paddingTop: '8px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'pulse 2s infinite' }} />
          Live — refreshes every 15s
        </div>
      </div>

      {/* ── Primary KPI Grid ── */}
      <div className="kpi-grid">
        <div
          className="kpi-card"
          onClick={() => router.push('/students/records')}
          style={{ cursor: 'pointer', borderTop: '4px solid #6366f1' }}
        >
          <span className="kpi-title">Active Students</span>
          <span className="kpi-value" style={{ color: '#6366f1' }}>
            {loading ? '...' : fmt(activeStudents)}
          </span>
          <span className="kpi-trend positive">Click to view all students</span>
        </div>

        <div
          className="kpi-card"
          onClick={() => router.push('/staff/records')}
          style={{ cursor: 'pointer', borderTop: '4px solid #0ea5e9' }}
        >
          <span className="kpi-title">Active Staff</span>
          <span className="kpi-value" style={{ color: '#0ea5e9' }}>
            {loading ? '...' : fmt(activeStaff)}
          </span>
          <span className="kpi-trend positive">
            {totalTeachers !== null ? `${totalTeachers} Teacher${totalTeachers !== 1 ? 's' : ''}` : ''}
          </span>
        </div>

        <div className="kpi-card" style={{ borderTop: '4px solid #22c55e' }}>
          <span className="kpi-title">Today's Attendance</span>
          <span className="kpi-value" style={{ color: '#22c55e' }}>
            {loading ? '...' : (attendanceRate || 'N/A')}
          </span>
          <span className="kpi-trend positive">Across all classes today</span>
        </div>

        <div className="kpi-card" style={{ borderTop: '4px solid #f59e0b' }}>
          <span className="kpi-title">This Month's Collection</span>
          <span className="kpi-value" style={{ color: '#f59e0b' }}>
            {loading ? '...' : (feeCollection || '₨ 0')}
          </span>
          <span className="kpi-trend positive">Fee received this month</span>
        </div>
      </div>



        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {missingReports.length > 0 && (
            <div className="card" style={{ borderLeft: '4px solid #ef4444' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <span style={{ fontSize: '18px' }}>⚠️</span>
                <h2 className="card-heading" style={{ margin: 0, color: '#ef4444' }}>Missing Daily Reports</h2>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '12px', marginTop: 0 }}>
                These teachers were marked Present today but have not submitted their daily report.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {missingReports.map((teacher: any) => (
                  <div key={teacher.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-bg-secondary)', padding: '10px 12px', borderRadius: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-main)' }}>{teacher.name}</span>
                    <button 
                      onClick={() => handleNotifyMissingReport(teacher)}
                      style={{ padding: '6px 12px', borderRadius: '6px', background: '#fee2e2', color: '#dc2626', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: '0.2s' }}
                      onMouseOver={e => e.currentTarget.style.background = '#fecaca'}
                      onMouseOut={e => e.currentTarget.style.background = '#fee2e2'}
                    >
                      Notify
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 className="card-heading" style={{ margin: 0 }}>Today Activities</h2>
            <input 
              type="date" 
              value={activitiesDate}
              onChange={(e) => setActivitiesDate(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--color-border)', fontSize: '13px' }}
            />
          </div>
          {adminActivities.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {adminActivities.map((act) => {
                let cardColor = 'var(--color-primary)';
                if (act.activity_type?.includes('Fee')) cardColor = '#eab308';
                if (act.activity_type?.includes('Attendance')) cardColor = '#22c55e';
                if (act.activity_type?.includes('Test')) cardColor = '#ef4444';

                return (
                  <div
                    key={act.id}
                    style={{
                      padding: '12px',
                      background: 'var(--color-bg-secondary)',
                      borderRadius: '8px',
                      borderLeft: `4px solid ${cardColor}`,
                      position: 'relative',
                    }}
                  >
                    <button 
                      onClick={() => handleDeleteActivity(act.id)}
                      style={{
                        position: 'absolute', top: '8px', right: '8px', background: 'transparent',
                        border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer',
                        fontSize: '14px', padding: '4px'
                      }}
                      title="Permanently Delete Activity"
                    >
                      ✕
                    </button>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', paddingRight: '20px' }}>
                      <span style={{ fontWeight: 600, fontSize: '13px', color: cardColor }}>
                        {act.activity_type}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                        {new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p style={{ margin: '0 0 4px 0', fontSize: '13px', color: 'var(--color-text-main)' }}>
                      {act.description}
                    </p>
                    {act.metadata && (
                      <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary)', background: 'var(--color-background)', padding: '6px', borderRadius: '4px', marginTop: '6px' }}>
                        {Object.entries(act.metadata).map(([k, v]) => (
                          <div key={k}><strong style={{ textTransform: 'capitalize' }}>{k.replace(/_/g, ' ')}:</strong> {String(v)}</div>
                        ))}
                      </div>
                    )}
                    {act.admin_name && (
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '6px', fontStyle: 'italic' }}>
                        By {act.admin_name}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state-placeholder" style={{ padding: '24px 16px' }}>
              <p className="body-text" style={{ fontSize: '13px' }}>No activities recorded for this date.</p>
            </div>
          )}
        </div>
        </div>


      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .kpi-card {
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .kpi-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0,0,0,0.08);
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
