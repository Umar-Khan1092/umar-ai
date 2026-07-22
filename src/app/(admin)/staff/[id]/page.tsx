'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { Edit, ArrowLeft } from 'lucide-react';
import { formatDate } from '@/utils/formatDate';
import { supabase, adminSupabase } from '@/lib/supabase';
import '@/app/(admin)/students/[id]/StudentProfile.css';

export const StaffProfile: React.FC = () => {
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : undefined;
  const router = useRouter();
  const [staff, setStaff] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('overview');
  

  
  // Salaries & Attendance
  const [salaries, setSalaries] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;

    const fetchProfileData = async () => {
      try {
        const dbClient = adminSupabase || supabase;
        // Fetch staff profile
        const { data: staffData } = await dbClient
          .from('staff')
          .select('*')
          .eq('id', id)
          .single();
        if (staffData) setStaff(staffData);

        // Fetch salaries
        const { data: payrollData } = await dbClient
          .from('payroll')
          .select('*')
          .eq('staff_id', id)
          .order('month', { ascending: false });
        if (payrollData) setSalaries(payrollData);

        // Fetch attendance
        const { data: attData } = await dbClient
          .from('staff_attendance')
          .select('*')
          .eq('staff_id', id)
          .order('date', { ascending: false });
        if (attData) setAttendance(attData);

      } catch (err) {
        console.error("Error fetching staff profile:", err);
      }
    };

    fetchProfileData();
  }, [id]);

  if (!staff) {
    return <div className="profile-page"><div className="card"><p>Loading profile...</p></div></div>;
  }

  return (
    <div className="profile-page">
      <div style={{ marginBottom: '16px' }}>
        <button className="btn-secondary" onClick={() => router.push('/staff/records')}>
          <ArrowLeft size={16} /> Back to Records
        </button>
      </div>

      <div className="profile-header card">
        <div className="profile-avatar-large">
          {staff.profile_image_url ? (
            <img src={`${staff.profile_image_url}`} alt={staff.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            staff.name.charAt(0)
          )}
        </div>
        <div className="profile-title" style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <h1 style={{ margin: 0 }}>{staff.name}</h1>
            <div style={{ display: 'flex', gap: '12px', fontSize: '13px', backgroundColor: 'var(--color-bg-secondary)', padding: '4px 12px', borderRadius: '16px', border: '1px solid var(--color-border)' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Username: <strong>{staff.username || staff.email}</strong></span>
              <span style={{ color: 'var(--color-text-secondary)' }}>Password: <strong>{staff.password || '******'}</strong></span>
            </div>
          </div>
          <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>{staff.qualification} • {staff.experience} Years Experience</p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
          <button className="btn-secondary" onClick={() => router.push(`/staff/edit/${staff.id}`)}>
            <Edit size={16} /> Edit Profile
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <nav className="profile-nav-horizontal">
          <button className={`profile-tab-horizontal ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>Overview</button>
          <button className={`profile-tab-horizontal ${activeTab === 'salaries' ? 'active' : ''}`} onClick={() => setActiveTab('salaries')}>Salaries</button>
          <button className={`profile-tab-horizontal ${activeTab === 'attendance' ? 'active' : ''}`} onClick={() => setActiveTab('attendance')}>Attendance</button>
        </nav>

        <div className="profile-content-area" style={{ padding: 'var(--space-6)' }}>
          {activeTab === 'overview' && (
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">CNIC</span>
                <span className="info-value">{staff.cnic}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Email</span>
                <span className="info-value">{staff.email}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Joining Date</span>
                <span className="info-value">{formatDate(staff.joining_date)}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Salary Type</span>
                <span className="info-value">{staff.salary_type}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Salary (PKR)</span>
                <span className="info-value">{staff.salary}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Status</span>
                <span className="info-value">
                  <span className={`status-badge ${staff.status === 'Active' ? 'success' : 'danger'}`}>
                    {staff.status}
                  </span>
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">WhatsApp Number</span>
                <span className="info-value">{staff.whatsapp_number || 'N/A'}</span>
              </div>
            </div>
          )}


          
          {activeTab === 'salaries' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0 }}>Salary History</h3>
                <button className="btn-primary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => router.push('/staff/salaries')}>
                  Manage Payroll
                </button>
              </div>
              
              {!salaries || salaries.length === 0 ? (
                <p className="body-text">No salary records found for this staff member.</p>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Month</th>
                        <th>Base Salary</th>
                        <th>Advance Deduction</th>
                        <th>Net Payable</th>
                        <th>Status</th>
                        <th>Payment Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salaries.map(slip => (
                        <tr key={slip.id}>
                          <td><strong>{slip.month}</strong></td>
                          <td>Rs {slip.base_salary}</td>
                          <td style={{ color: slip.advance_deduction > 0 ? '#DC2626' : 'inherit' }}>
                            {slip.advance_deduction > 0 ? `- Rs ${slip.advance_deduction}` : '-'}
                          </td>
                          <td><strong>Rs {slip.net_payable}</strong></td>
                          <td>
                            <span className={`status-badge ${slip.status === 'Paid' ? 'success' : 'warning'}`}>
                              {slip.status}
                            </span>
                          </td>
                          <td style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>
                            {slip.payment_date ? formatDate(slip.payment_date) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'attendance' && (
            <div>
              <h3 style={{ marginTop: 0 }}>Attendance Record</h3>
              
              <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
                <div className="card" style={{ flex: 1, textAlign: 'center', padding: '16px', borderTop: '4px solid var(--color-success)' }}>
                  <h3 style={{ margin: 0, fontSize: '24px', color: 'var(--color-success)' }}>{attendance.filter(a => a.status === 'Present').length}</h3>
                  <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)', fontSize: '13px', fontWeight: 500 }}>Total Present</p>
                </div>
                <div className="card" style={{ flex: 1, textAlign: 'center', padding: '16px', borderTop: '4px solid var(--color-error)' }}>
                  <h3 style={{ margin: 0, fontSize: '24px', color: 'var(--color-error)' }}>{attendance.filter(a => a.status === 'Absent').length}</h3>
                  <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)', fontSize: '13px', fontWeight: 500 }}>Total Absent</p>
                </div>
                <div className="card" style={{ flex: 1, textAlign: 'center', padding: '16px', borderTop: '4px solid var(--color-warning)' }}>
                  <h3 style={{ margin: 0, fontSize: '24px', color: 'var(--color-warning)' }}>{attendance.filter(a => a.status === 'Leave').length}</h3>
                  <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)', fontSize: '13px', fontWeight: 500 }}>Total Leave</p>
                </div>
                <div className="card" style={{ flex: 1, textAlign: 'center', padding: '16px', borderTop: '4px solid var(--color-primary)' }}>
                  <h3 style={{ margin: 0, fontSize: '24px', color: 'var(--color-primary)' }}>
                    {attendance.length > 0 ? Math.round((attendance.filter(a => a.status === 'Present').length / attendance.length) * 100) : 0}%
                  </h3>
                  <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)', fontSize: '13px', fontWeight: 500 }}>Attendance Rate</p>
                </div>
              </div>

              {attendance.length > 0 ? (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendance.map((record, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 500 }}>{formatDate(record.date)}</td>
                          <td>
                            <span className={`badge ${record.status === 'Present' ? 'badge-success' : record.status === 'Absent' ? 'badge-error' : 'badge-warning'}`}>
                              {record.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="body-text">No attendance records found for this staff member.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StaffProfile;
