'use client';

import React, { useState, useEffect } from 'react';
import { Save, Calendar, UserCheck, AlertCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';


export const AdminStaffAttendance: React.FC = () => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [records, setRecords] = useState<any[]>([]);
  const [isFinalized, setIsFinalized] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [notifyStaff, setNotifyStaff] = useState(true);

  useEffect(() => {
    fetchAttendance();
  }, [date]);

  const fetchAttendance = async () => {
    try {
      const [staffRes, attRes] = await Promise.all([
        supabase.from('staff').select('id, name, role').eq('status', 'Active'),
        supabase.from('staff_attendance').select('*').eq('date', date)
      ]);
      
      const activeStaff = staffRes.data || [];
      const attendance = attRes.data || [];
      
      const mergedRecords = activeStaff.map(staff => {
        const att = attendance.find(a => a.staff_id === staff.id);
        return {
          staff_id: staff.id,
          staff_name: staff.name,
          role: staff.role,
          status: att ? att.status : 'Absent'
        };
      });
      
      setRecords(mergedRecords);
      setIsFinalized(attendance.length > 0);
    } catch (err) {
      console.error(err);
    }
  };

  const handleStatusChange = (staffId: string, status: string) => {
    if (isFinalized) return;
    setRecords(prev => prev.map(r => r.staff_id === staffId ? { ...r, status } : r));
  };

  const handleSave = async (finalize: boolean) => {
    setIsLoading(true);
    setStatusMsg({ type: null, message: '' });

    try {
      const upsertPayload = records.map(r => ({
        staff_id: r.staff_id,
        date: date,
        status: r.status
      }));

      const { error } = await supabase
        .from('staff_attendance')
        .upsert(upsertPayload, { onConflict: 'staff_id, date' });

      if (error) throw error;
      
      // Notify staff with individual professional messages if requested
      if (notifyStaff) {
        const dateFormatted = new Date(date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
        records.forEach((r: any) => {
          const message = r.status === 'Present'
            ? `Dear ${r.staff_name},\n\nYour attendance was marked as Present on ${dateFormatted}. Thank you.`
            : r.status === 'Absent'
            ? `Dear ${r.staff_name},\n\nYour attendance was marked as Absent on ${dateFormatted}. Please contact administration if this is incorrect.`
            : `Dear ${r.staff_name},\n\nYour leave has been recorded for ${dateFormatted}.`;
          supabase.auth.getSession().then(({ data }) => {
            const token = data.session?.access_token;
            if (token) {
              fetch('/api/push/send', {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                  title: `Attendance: ${r.status} — ${dateFormatted}`,
                  message,
                  category: 'Attendance',
                  userIds: ['staff_' + r.staff_id],
                })
              }).catch(() => {});
            }
          });
        });
      }
      
      setStatusMsg({ type: 'success', message: finalize ? 'Attendance finalized successfully!' : 'Attendance saved successfully!' });
      if (finalize) setIsFinalized(true);
      setShowConfirm(false);
      setTimeout(() => setStatusMsg({ type: null, message: '' }), 3000);
    } catch (err: any) {
      setStatusMsg({ type: 'error', message: err.message || 'Failed to save attendance' });
      setShowConfirm(false);
    } finally {
      setIsLoading(false);
    }
  };



  return (
    <div className="attendance-page page-content">
      <div className="records-controls" style={{ marginBottom: '16px' }}>
        <div className="header-left">
          <h1 className="section-heading" style={{ marginBottom: 0 }}>Staff Attendance</h1>
          <p className="subtitle">Manage daily attendance for all staff members.</p>
        </div>
      </div>



      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="input-group" style={{ margin: 0, flex: 1, minWidth: '200px', maxWidth: '250px' }}>
            <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={14} /> Date 
              <span style={{ color: 'var(--color-primary)', fontWeight: 600, marginLeft: 'auto' }}>
                {new Date(date).toLocaleDateString('en-US', { weekday: 'long' })}
              </span>
            </label>
            <input type="date" className="input-field" value={date} onChange={e => setDate(e.target.value)} />
          </div>
        </div>
      </div>

      {statusMsg.type && (
        <div className={`toast ${statusMsg.type}`} style={{ marginBottom: '16px' }}>
          {statusMsg.message}
        </div>
      )}

        <div className="card" style={{ padding: '0', position: 'relative' }}>
          <div className="table-container" style={{ paddingBottom: '80px' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Staff Name</th>
                  <th>Role</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '24px' }}>
                      No active staff found to mark attendance.
                    </td>
                  </tr>
                ) : (
                  records.map((record, index) => (
                    <tr key={record.staff_id}>
                      <td style={{ color: 'var(--color-text-muted)', fontSize: '12px', fontWeight: 500 }}>
                        {String(index + 1).padStart(2, '0')}
                      </td>
                      <td><strong>{record.staff_name}</strong></td>
                      <td>{record.role}</td>
                      <td>
                        <div className="radio-group" style={{ display: 'flex', gap: '12px', opacity: isFinalized ? 0.6 : 1, pointerEvents: isFinalized ? 'none' : 'auto' }}>
                          <label className={`radio-label ${record.status === 'Present' ? 'active-present' : ''}`}>
                            <input type="radio" name={`status-${record.staff_id}`} value="Present" checked={record.status === 'Present'} onChange={() => handleStatusChange(record.staff_id, 'Present')} disabled={isFinalized} />
                            <UserCheck size={14} /> Present
                          </label>
                          <label className={`radio-label ${record.status === 'Absent' ? 'active-absent' : ''}`}>
                            <input type="radio" name={`status-${record.staff_id}`} value="Absent" checked={record.status === 'Absent'} onChange={() => handleStatusChange(record.staff_id, 'Absent')} disabled={isFinalized} />
                            <AlertCircle size={14} /> Absent
                          </label>
                          <label className={`radio-label ${record.status === 'Leave' ? 'active-leave' : ''}`}>
                            <input type="radio" name={`status-${record.staff_id}`} value="Leave" checked={record.status === 'Leave'} onChange={() => handleStatusChange(record.staff_id, 'Leave')} disabled={isFinalized} />
                            Leave
                          </label>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Floating Footer */}
          {records.length > 0 && (
            <div className="attendance-save-footer" style={{ 
              position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px', 
              borderTop: '1px solid var(--color-border)', display: 'flex', 
              justifyContent: 'flex-end', alignItems: 'center', backgroundColor: '#ffffff',
              boxShadow: '0 -4px 12px rgba(0,0,0,0.08)', zIndex: 10
            }}>
              {isFinalized ? (
                <div style={{ color: '#64748B', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: 500 }}>
                  <AlertTriangle size={16} />
                  Attendance Locked
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button className="btn-primary" onClick={() => handleSave(true)} disabled={isLoading} style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#059669', borderColor: '#059669', boxShadow: '0 4px 12px rgba(5,150,105,0.3)' }}>
                    <Save size={16} />
                    Save Attendance
                  </button>
                </div>
              )}
            </div>
          )}
        </div>


      {showConfirm && (
        <div className="modal-overlay">
          <div className="modal-content card" style={{ maxWidth: '400px', width: '90%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', color: '#DC2626' }}>
              <AlertTriangle size={24} />
              <h2 style={{ margin: 0, fontSize: '18px' }}>Finalize Attendance?</h2>
            </div>
            <p style={{ marginBottom: '16px', color: '#475569', lineHeight: 1.5 }}>
              Are you sure you want to finalize the attendance for {date}? 
              <strong> You will not be able to edit it once finalized.</strong>
            </p>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: '#334155' }}>
                <input 
                  type="checkbox" 
                  checked={notifyStaff} 
                  onChange={(e) => setNotifyStaff(e.target.checked)} 
                  style={{ width: '16px', height: '16px', accentColor: '#059669' }}
                />
                Send push notification to all staff
              </label>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setShowConfirm(false)}>Cancel</button>
              <button className="btn-primary" style={{ backgroundColor: '#059669', borderColor: '#059669' }} onClick={() => handleSave(true)}>
                Confirm & Finalize
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminStaffAttendance;
