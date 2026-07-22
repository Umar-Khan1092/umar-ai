'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { adminSupabase, supabase } from '@/lib/supabase';
import '@/app/(admin)/dashboard/Dashboard.css';

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
  const [communications, setCommunications] = useState<any[]>([]);

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

      // ── Recent Communications ──
      const { data: nData } = await db
        .from('notifications')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(5);
      if (nData) {
        setCommunications(nData.filter((n: any) => !(n.sender_role === 'Admin' && n.recipient_role === 'Admin')));
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

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
          <h1 className="page-title">Dashboard</h1>
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

      {/* ── Secondary Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>⚠️</div>
          <div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#dc2626' }}>{fmt(pendingFees)}</div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 500 }}>Pending Fee Vouchers</div>
          </div>
        </div>
        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>👩‍🏫</div>
          <div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#16a34a' }}>{fmt(totalTeachers)}</div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 500 }}>Total Teachers</div>
          </div>
        </div>
        <div
          className="card"
          style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer' }}
          onClick={() => router.push('/students/struck-off')}
        >
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>🚫</div>
          <div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#ea580c' }}>{fmt(struckOffStudents)}</div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 500 }}>Struck-Off Students</div>
          </div>
        </div>
      </div>

      {/* ── Bottom Section ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        <div className="card">
          <h2 className="card-heading">Quick Actions</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {[
              { label: '➕ Register Student', path: '/students/register', color: '#6366f1' },
              { label: '➕ Register Staff', path: '/staff/register', color: '#0ea5e9' },
              { label: '💰 Manage Fees', path: '/students/fees', color: '#f59e0b' },
              { label: '📋 Student Records', path: '/students/records', color: '#22c55e' },
              { label: '📊 Academics', path: '/academics/schedule', color: '#8b5cf6' },
              { label: '⚙️ Settings', path: '/settings', color: '#64748b' },
            ].map(action => (
              <button
                key={action.path}
                onClick={() => router.push(action.path)}
                style={{
                  padding: '14px 16px',
                  background: 'var(--color-bg-secondary)',
                  border: `1px solid var(--color-border)`,
                  borderLeft: `4px solid ${action.color}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--color-text-main)',
                  transition: 'all 0.2s',
                }}
                onMouseOver={e => { e.currentTarget.style.background = action.color + '12'; }}
                onMouseOut={e => { e.currentTarget.style.background = 'var(--color-bg-secondary)'; }}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="card-heading" style={{ marginBottom: '16px' }}>Recent Communications</h2>
          {communications.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {communications.map((c, i) => (
                <div
                  key={c.id || i}
                  style={{
                    padding: '12px',
                    background: 'var(--color-bg-secondary)',
                    borderRadius: '8px',
                    borderLeft: '4px solid var(--color-primary)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, fontSize: '13px' }}>
                      {c.display_sender_name} → {c.recipient_role}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                      {new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {c.student_name && (
                    <div style={{ fontSize: '12px', color: 'var(--color-primary)', marginBottom: '4px', fontWeight: 500 }}>
                      RE: {c.student_name} ({c.student_class} - {c.student_section})
                    </div>
                  )}
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as any}>
                    {c.message}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state-placeholder" style={{ padding: '24px 16px' }}>
              <p className="body-text" style={{ fontSize: '13px' }}>No recent communications between Parents and Teachers.</p>
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
