'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Users, UserX, UserMinus, UserCheck, Briefcase, GraduationCap, Send, X } from 'lucide-react';
import { formatDate } from '@/utils/formatDate';
import { supabase } from '@/lib/supabase';

interface StudentAttendanceRecord {
  student_id: string;
  student_name: string;
  father_name: string;
  roll_number: string;
  status: 'Present' | 'Absent' | 'Leave' | 'Late';
}

interface StudentSession {
  date: string;
  class_name: string;
  section: string;
  subject?: string;
  teacher_id: string;
  teacher_name: string;
  status: string;
  records: StudentAttendanceRecord[];
}

interface StaffAttendanceRecord {
  staff_id: string;
  staff_name: string;
  role: string;
  status: 'Present' | 'Absent' | 'Leave';
}

interface StaffSession {
  date: string;
  is_finalized: boolean;
  records: StaffAttendanceRecord[];
}

export const AttendanceHistory: React.FC = () => {
  const [mode, setMode] = useState<'student' | 'staff'>('student');
  
  const [studentSessions, setStudentSessions] = useState<StudentSession[]>([]);
  const [staffSessions, setStaffSessions] = useState<StaffSession[]>([]);
  
  const [classes, setClasses] = useState<string[]>([]);
  const [classSections, setClassSections] = useState<Record<string, string[]>>({});
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [allStaff, setAllStaff] = useState<any[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  
  const [filters, setFilters] = useState({
    fromDate: new Date().toISOString().split('T')[0],
    toDate: new Date().toISOString().split('T')[0],
    class_name: '',
    section: '',
    role: ''
  });
  
  const [activeTab, setActiveTab] = useState<'present' | 'absent' | 'leave' | null>(null);
  const [activeQuickSelect, setActiveQuickSelect] = useState<number | null>(0);
  
  const [showWhatsappModal, setShowWhatsappModal] = useState(false);
  const [whatsappMessage, setWhatsappMessage] = useState('');
  const [isSendingMsg, setIsSendingMsg] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });

  useEffect(() => {
    // Settings for Classes and Sections
    Promise.resolve(supabase.from('settings').select('*').eq('key', 'app_settings').single())
      .then(res => {
        const data = res.data?.value || {};
        setClasses(data.classes || []);
        setClassSections(data.class_sections || {});
      })
      .catch((err: any) => console.error(err));
      
    // Student Attendance - fetch Published sessions
    Promise.resolve(supabase.from('student_attendance').select('*').eq('status', 'Published'))
      .then(res => { if (res.data) setStudentSessions(res.data); })
      .catch((err: any) => console.error(err));
      
    // Students List
    Promise.resolve(supabase.from('students').select('*'))
      .then(res => { if (res.data) setAllStudents(res.data); })
      .catch((err: any) => console.error(err));

    // Staff + Staff Attendance - fetch together so we can build sessions
    Promise.resolve(supabase.from('staff').select('*'))
      .then(staffRes => {
        const staffList = staffRes.data || [];
        setAllStaff(staffList);
        const uniqueRoles = Array.from(new Set(staffList.map((s: any) => s.role).filter(Boolean))) as string[];
        setRoles(uniqueRoles);
        
        // Now fetch staff_attendance flat rows and group into sessions
        return supabase.from('staff_attendance').select('*').then(attRes => {
          const rows = attRes.data || [];
          // Group flat rows by date -> build session objects
          const byDate: Record<string, any[]> = {};
          rows.forEach((row: any) => {
            if (!byDate[row.date]) byDate[row.date] = [];
            const staffMember = staffList.find((s: any) => s.id === row.staff_id);
            byDate[row.date].push({
              staff_id: row.staff_id,
              staff_name: staffMember?.name || 'Unknown',
              role: staffMember?.role || 'Unknown',
              status: row.status
            });
          });
          
          const sessions = Object.entries(byDate).map(([date, records]) => ({
            date,
            is_finalized: true,
            records
          }));
          setStaffSessions(sessions);
        });
      })
      .catch((err: any) => console.error(err));
  }, []);

  // Compute filtered sessions based on Mode and Filters
  const filteredStudentSessions = useMemo(() => {
    return studentSessions.filter(s => {
      const matchFrom = filters.fromDate ? s.date >= filters.fromDate : true;
      const matchTo = filters.toDate ? s.date <= filters.toDate : true;
      const matchClass = filters.class_name ? s.class_name === filters.class_name : true;
      const matchSection = filters.section ? s.section === filters.section : true;
      return matchFrom && matchTo && matchClass && matchSection;
    });
  }, [studentSessions, filters]);

  const filteredStaffSessions = useMemo(() => {
    return staffSessions.filter(s => {
      const matchFrom = filters.fromDate ? s.date >= filters.fromDate : true;
      const matchTo = filters.toDate ? s.date <= filters.toDate : true;
      // We'll filter role at the record level because a session contains multiple roles
      return matchFrom && matchTo;
    });
  }, [staffSessions, filters]);

  // Aggregate stats
  const stats = useMemo(() => {
    let total = 0;
    const presentList: any[] = [];
    const absentList: any[] = [];
    const leaveList: any[] = [];
    let totalActiveCount = 0;
    let label = '';
    
    if (mode === 'student') {
      label = 'Students';
      filteredStudentSessions.forEach(session => {
        session.records.forEach(r => {
          total++;
          if (r.status === 'Present') {
            presentList.push({ ...r, class_name: session.class_name, section: session.section, date: session.date });
          } else if (r.status === 'Absent') {
            absentList.push({ ...r, class_name: session.class_name, section: session.section, date: session.date });
          } else if (r.status === 'Leave') {
            leaveList.push({ ...r, class_name: session.class_name, section: session.section, date: session.date });
          }
        });
      });
      
      let active = allStudents.filter(s => s.status === 'Active');
      if (filters.class_name) active = active.filter(s => s.academic_class === filters.class_name);
      if (filters.section) active = active.filter(s => s.section === filters.section);
      totalActiveCount = active.length;
      
    } else {
      label = 'Staff';
      filteredStaffSessions.forEach(session => {
        session.records.forEach(r => {
          if (filters.role && r.role !== filters.role) return;
          total++;
          if (r.status === 'Present') {
            presentList.push({ ...r, date: session.date });
          } else if (r.status === 'Absent') {
            absentList.push({ ...r, date: session.date });
          } else if (r.status === 'Leave') {
            leaveList.push({ ...r, date: session.date });
          }
        });
      });
      
      let active = allStaff.filter(s => s.status === 'Active');
      if (filters.role) active = active.filter(s => s.role === filters.role);
      totalActiveCount = active.length;
    }
    
    const presentPercentage = total > 0 ? ((presentList.length / total) * 100).toFixed(1) : '0.0';
    const absentPercentage = total > 0 ? ((absentList.length / total) * 100).toFixed(1) : '0.0';
    const leavePercentage = total > 0 ? ((leaveList.length / total) * 100).toFixed(1) : '0.0';
    
    return {
      label,
      totalRecords: total,
      totalActiveCount,
      presentCount: presentList.length,
      absentCount: absentList.length,
      leaveCount: leaveList.length,
      presentPercentage,
      absentPercentage,
      leavePercentage,
      presentList,
      absentList,
      leaveList
    };
  }, [mode, filteredStudentSessions, filteredStaffSessions, allStudents, allStaff, filters]);

  const handleQuickDate = (days: number) => {
    const today = new Date();
    const fromDate = new Date(today);
    fromDate.setDate(today.getDate() - days);
    
    setFilters(f => ({
      ...f,
      fromDate: fromDate.toISOString().split('T')[0],
      toDate: today.toISOString().split('T')[0]
    }));
    setActiveQuickSelect(days);
  };

  const currentList = activeTab === 'present' ? stats.presentList : activeTab === 'absent' ? stats.absentList : stats.leaveList;

  const handleSendWhatsapp = async () => {
    if (!whatsappMessage.trim()) return;
    setIsSendingMsg(true);
    setStatusMsg({ type: null, message: '' });

    try {
      const targets: any[] = [];
      if (mode === 'student') {
        currentList.forEach(item => {
          const student = allStudents.find(s => s.id === item.student_id);
          if (student && student.guardian_whatsapp) {
            targets.push({ name: student.name, phone: student.guardian_whatsapp });
          }
        });
      } else {
        currentList.forEach(item => {
          const staff = allStaff.find(s => s.id === item.staff_id);
          if (staff && staff.whatsapp_number) {
            targets.push({ name: staff.name, phone: staff.whatsapp_number });
          }
        });
      }

      if (targets.length === 0) {
        throw new Error("No valid WhatsApp numbers found for the current list.");
      }

      // WhatsApp is simulated - show success
      setStatusMsg({ type: 'success', message: `WhatsApp messages sent to ${targets.length} recipient(s) (simulated).` });
      setShowWhatsappModal(false);
      setWhatsappMessage('');
    } catch (err: any) {
      setStatusMsg({ type: 'error', message: err.message });
    } finally {
      setIsSendingMsg(false);
      setTimeout(() => setStatusMsg({ type: null, message: '' }), 5000);
    }
  };

  return (
    <div className="page-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '1.5rem', color: 'var(--color-text-primary)' }}>Attendance Reports</h2>
          <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>View and analyze approved attendance records.</p>
        </div>
      </div>
      
      {statusMsg.type && (
        <div className={`toast ${statusMsg.type}`} style={{ marginBottom: '16px' }}>
          {statusMsg.message}
        </div>
      )}

      {/* Mode Toggle */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', borderBottom: '1px solid var(--color-border)' }}>
        <button 
          onClick={() => { setMode('student'); setActiveTab(null); }}
          style={{
            padding: '12px 24px', background: 'none', border: 'none',
            borderBottom: mode === 'student' ? '2px solid var(--color-primary)' : '2px solid transparent',
            color: mode === 'student' ? 'var(--color-primary)' : 'var(--color-text-muted)',
            fontWeight: mode === 'student' ? 600 : 400,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
          }}
        >
          <GraduationCap size={18} /> Student Attendance
        </button>
        <button 
          onClick={() => { setMode('staff'); setActiveTab(null); }}
          style={{
            padding: '12px 24px', background: 'none', border: 'none',
            borderBottom: mode === 'staff' ? '2px solid var(--color-primary)' : '2px solid transparent',
            color: mode === 'staff' ? 'var(--color-primary)' : 'var(--color-text-muted)',
            fontWeight: mode === 'staff' ? 600 : 400,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
          }}
        >
          <Briefcase size={18} /> Staff Attendance
        </button>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '16px' }}>
          <div style={{ flex: 1, minWidth: '150px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>From Date</label>
            <input 
              type="date" 
              className="input-field" 
              value={filters.fromDate}
              onChange={(e) => {
                setFilters(f => ({ ...f, fromDate: e.target.value }));
                setActiveQuickSelect(null);
              }}
            />
          </div>
          <div style={{ flex: 1, minWidth: '150px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>To Date</label>
            <input 
              type="date" 
              className="input-field" 
              value={filters.toDate}
              onChange={(e) => {
                setFilters(f => ({ ...f, toDate: e.target.value }));
                setActiveQuickSelect(null);
              }}
            />
          </div>
          
          {mode === 'student' ? (
            <>
              <div style={{ flex: 1, minWidth: '150px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Class</label>
                <select 
                  className="input-field"
                  value={filters.class_name}
                  onChange={(e) => setFilters(f => ({ ...f, class_name: e.target.value, section: '' }))}
                >
                  <option value="">All Classes</option>
                  {classes.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Section</label>
                <select 
                  className="input-field"
                  value={filters.section}
                  onChange={(e) => setFilters(f => ({ ...f, section: e.target.value }))}
                  disabled={!filters.class_name}
                >
                  <option value="">All Sections</option>
                  {filters.class_name && (classSections[filters.class_name] || []).map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, minWidth: '150px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Role</label>
              <select 
                className="input-field"
                value={filters.role}
                onChange={(e) => setFilters(f => ({ ...f, role: e.target.value }))}
              >
                <option value="">All Roles</option>
                {roles.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          )}
        </div>
        
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '16px' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', marginRight: '8px' }}>Quick Select:</span>
          {[
            { label: 'Today', days: 0 },
            { label: 'Yesterday', days: 1 },
            { label: '7 Days', days: 7 },
            { label: '1 Month', days: 30 },
            { label: '1 Year', days: 365 }
          ].map(btn => (
            <button 
              key={btn.days}
              className="btn-secondary" 
              style={{ 
                padding: '4px 12px', 
                fontSize: '0.85rem',
                backgroundColor: activeQuickSelect === btn.days ? 'var(--color-primary)' : '',
                color: activeQuickSelect === btn.days ? 'white' : '',
                borderColor: activeQuickSelect === btn.days ? 'var(--color-primary)' : ''
              }} 
              onClick={() => handleQuickDate(btn.days)}
            >
              {btn.label}
            </button>
          ))}
          
          <button 
            className="btn-secondary" 
            onClick={() => {
              setFilters({ 
                fromDate: new Date().toISOString().split('T')[0], 
                toDate: new Date().toISOString().split('T')[0], 
                class_name: '', 
                section: '',
                role: ''
              });
              setActiveQuickSelect(0);
            }}
            style={{ padding: '4px 12px', fontSize: '0.85rem', marginLeft: 'auto', border: '1px solid var(--color-danger)', color: 'var(--color-danger)' }}
          >
            Clear Filters
          </button>
        </div>
      </div>
      
      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px', marginBottom: '24px' }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', borderLeft: '4px solid var(--color-primary)' }}>
          <div style={{ backgroundColor: 'var(--color-bg-secondary)', padding: '16px', borderRadius: '50%' }}>
            <Users size={24} color="var(--color-primary)" />
          </div>
          <div>
            <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginBottom: '4px' }}>Total Active {stats.label}</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>{stats.totalActiveCount}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>{stats.totalRecords} records marked</div>
          </div>
        </div>

        <div 
          className="card hover-effect" 
          style={{ 
            display: 'flex', alignItems: 'center', gap: '16px', 
            borderLeft: '4px solid #10B981',
            cursor: 'pointer',
            backgroundColor: activeTab === 'present' ? '#D1FAE5' : 'white',
            transition: 'background-color 0.2s'
          }}
          onClick={() => setActiveTab(activeTab === 'present' ? null : 'present')}
        >
          <div style={{ backgroundColor: '#D1FAE5', padding: '16px', borderRadius: '50%' }}>
            <UserCheck size={24} color="#059669" />
          </div>
          <div>
            <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginBottom: '4px' }}>Present ({stats.presentPercentage}% of marked)</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#059669' }}>{stats.presentCount}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-primary)', marginTop: '4px' }}>Click to view list &rarr;</div>
          </div>
        </div>
        
        <div 
          className="card hover-effect" 
          style={{ 
            display: 'flex', alignItems: 'center', gap: '16px', 
            borderLeft: '4px solid var(--color-danger)',
            cursor: 'pointer',
            backgroundColor: activeTab === 'absent' ? '#FEF2F2' : 'white',
            transition: 'background-color 0.2s'
          }}
          onClick={() => setActiveTab(activeTab === 'absent' ? null : 'absent')}
        >
          <div style={{ backgroundColor: '#FEE2E2', padding: '16px', borderRadius: '50%' }}>
            <UserX size={24} color="#DC2626" />
          </div>
          <div>
            <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginBottom: '4px' }}>Absent ({stats.absentPercentage}% of marked)</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#DC2626' }}>{stats.absentCount}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-primary)', marginTop: '4px' }}>Click to view list &rarr;</div>
          </div>
        </div>
        
        <div 
          className="card hover-effect" 
          style={{ 
            display: 'flex', alignItems: 'center', gap: '16px', 
            borderLeft: '4px solid #F59E0B',
            cursor: 'pointer',
            backgroundColor: activeTab === 'leave' ? '#FFFBEB' : 'white',
            transition: 'background-color 0.2s'
          }}
          onClick={() => setActiveTab(activeTab === 'leave' ? null : 'leave')}
        >
          <div style={{ backgroundColor: '#FEF3C7', padding: '16px', borderRadius: '50%' }}>
            <UserMinus size={24} color="#B45309" />
          </div>
          <div>
            <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginBottom: '4px' }}>Leave ({stats.leavePercentage}% of marked)</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#B45309' }}>{stats.leaveCount}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-primary)', marginTop: '4px' }}>Click to view list &rarr;</div>
          </div>
        </div>
      </div>
      
      {/* Detailed Table */}
      {activeTab && (
        <div className="card animate-fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--color-text-primary)' }}>
              {activeTab === 'present' ? `Present ${stats.label} List` : activeTab === 'absent' ? `Absent ${stats.label} List` : `Leave ${stats.label} List`}
            </h3>
            {(activeTab === 'absent' || activeTab === 'leave') && currentList.length > 0 && (
              <button 
                className="btn-primary" 
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', fontSize: '0.9rem' }}
                onClick={() => setShowWhatsappModal(true)}
              >
                <Send size={16} /> Send Auto Message
              </button>
            )}
          </div>
          
          {currentList.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  {mode === 'student' ? (
                    <>
                      <th>Roll Number</th>
                      <th>Student Name</th>
                      <th>Father's Name</th>
                      <th>Class</th>
                      <th>Section</th>
                    </>
                  ) : (
                    <>
                      <th>Staff Name</th>
                      <th>Role</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {currentList.map((item, idx) => (
                  <tr key={idx}>
                    <td>{formatDate(item.date)}</td>
                    {mode === 'student' ? (
                      <>
                        <td>{item.roll_number}</td>
                        <td style={{ fontWeight: 500 }}>{item.student_name}</td>
                        <td>{item.father_name}</td>
                        <td>{item.class_name}</td>
                        <td>{item.section}</td>
                      </>
                    ) : (
                      <>
                        <td style={{ fontWeight: 500 }}>{item.staff_name}</td>
                        <td>{item.role}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>
              No {activeTab} {stats.label.toLowerCase()} found for the selected filters.
            </div>
          )}
        </div>
      )}
      {showWhatsappModal && (
        <div className="modal-overlay">
          <div className="modal-content card" style={{ maxWidth: '500px', width: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--color-text-primary)' }}>
                Send WhatsApp Message to {activeTab === 'absent' ? 'Absent' : 'Leave'} {stats.label}
              </h2>
              <button 
                onClick={() => setShowWhatsappModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Message</label>
              <textarea 
                className="input-field"
                style={{ width: '100%', minHeight: '120px', resize: 'vertical' }}
                placeholder={`Type your message for the ${currentList.length} ${stats.label.toLowerCase()}...`}
                value={whatsappMessage}
                onChange={(e) => setWhatsappMessage(e.target.value)}
              />
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button 
                className="btn-secondary" 
                onClick={() => setShowWhatsappModal(false)}
                disabled={isSendingMsg}
              >
                Cancel
              </button>
              <button 
                className="btn-primary" 
                onClick={handleSendWhatsapp}
                disabled={isSendingMsg || !whatsappMessage.trim()}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {isSendingMsg ? 'Sending...' : <><Send size={16} /> Send Message</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceHistory;
