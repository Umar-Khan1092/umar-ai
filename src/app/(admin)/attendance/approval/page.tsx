'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, CheckCircle, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export const AdminAttendanceApproval: React.FC = () => {
  const [attendances, setAttendances] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [searchTerm] = useState('');
  const [statusMsg, setStatusMsg] = useState<{type: 'success'|'error'|null, message: string}>({type: null, message: ''});
  
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [editedRecords, setEditedRecords] = useState<any[]>([]);

  // New states for tracking and filters
  const [settings, setSettings] = useState<any>(null);
  const [attSettings, setAttSettings] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    date: new Date().toISOString().split('T')[0],
    class_name: '',
    section: ''
  });

  useEffect(() => {
    fetchAttendances();
    
    const subscription = supabase
      .channel('attendance_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'student_attendance' }, (payload) => {
        fetchAttendances(true);
      })
      .subscribe();
    
    Promise.resolve(supabase.from('settings').select('*').eq('key', 'app_settings').single())
      .then(res => { if (res.data) setSettings(res.data.value); })
      .catch((err: any) => console.error(err));
      
    Promise.resolve(supabase.from('settings').select('*').eq('key', 'attendance_settings').single())
      .then(res => { if (res.data) setAttSettings(res.data.value); })
      .catch((err: any) => console.error(err));
      
    Promise.resolve(supabase.from('staff').select('*').eq('role', 'Teacher'))
      .then(res => { if (res.data) setTeachers(res.data); })
      .catch((err: any) => console.error(err));
      
    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const fetchAttendances = async (background = false) => {
    if (!background) setIsLoading(true);
    try {
      const { data: attData, error } = await supabase.from('student_attendance').select('*').order('date', { ascending: false });
      if (error) throw error;
      
      const { data: staffData } = await supabase.from('staff').select('id, name');
      
      const enriched = (attData || []).map((a: any) => ({
        ...a,
        teacher_name: (staffData || []).find((s: any) => s.id === a.teacher_id)?.name || 'Unknown'
      }));
      setAttendances(enriched);
      setIsLoading(false);
    } catch(err) {
      console.error(err);
      setIsLoading(false);
    }
  };

  const openRecord = async (record: any) => {
    setSelectedRecord(record);
    setEditedRecords([...(record.records || [])]);

    try {
      const studentIds = (record.records || []).map((r: any) => r.student_id);
      if (studentIds.length > 0) {
        const { data: studentsData } = await supabase
          .from('students')
          .select('id, name, father_name, roll_number')
          .in('id', studentIds);
          
        if (studentsData && studentsData.length > 0) {
          const enriched = (record.records || []).map((r: any) => {
            const student = studentsData.find((s: any) => s.id === r.student_id);
            return {
              ...r,
              student_name: r.student_name || student?.name || 'N/A',
              father_name: r.father_name || student?.father_name || 'N/A',
              roll_number: r.roll_number || student?.roll_number || 'N/A'
            };
          });
          setEditedRecords(enriched);
        }
      }
    } catch (err) {
      console.error('Error enriching student attendance list:', err);
    }
  };

  const handleFineChange = (studentId: string, value: string) => {
    const fine = value === '' ? 0 : parseFloat(value);
    setEditedRecords(prev => prev.map(r => r.student_id === studentId ? { ...r, fine } : r));
  };

  const saveEditsAndPublish = async () => {
    setIsActionLoading(true);
    try {
      const { error } = await supabase.from('student_attendance').update({
        records: editedRecords,
        status: 'Published'
      }).eq('id', selectedRecord.id);
      
      if (error) throw error;
      
      setStatusMsg({type: 'success', message: 'Attendance published and fines applied!'});
      setTimeout(() => setStatusMsg({type: null, message: ''}), 3000);
      setSelectedRecord(null);
      fetchAttendances();
    } catch(err: any) {
      setStatusMsg({type: 'error', message: err.message});
    } finally {
      setIsActionLoading(false);
    }
  };
  
  const rejectToDraft = async () => {
    setIsActionLoading(true);
    try {
      const { error } = await supabase.from('student_attendance').update({ status: 'Draft' }).eq('id', selectedRecord.id);
      if (error) throw error;
      setStatusMsg({type: 'success', message: 'Attendance rejected back to Teacher.'});
      setTimeout(() => setStatusMsg({type: null, message: ''}), 3000);
      setSelectedRecord(null);
      fetchAttendances();
    } catch(err: any) {
      setStatusMsg({type: 'error', message: err.message});
    } finally {
      setIsActionLoading(false);
    }
  };

  const getStats = (record: any) => {
    if (!record || !record.records) return { present: 0, absent: 0, leave: 0 };
    return {
      present: record.records.filter((r: any) => r.status === 'Present').length,
      absent: record.records.filter((r: any) => r.status === 'Absent').length,
      leave: record.records.filter((r: any) => r.status === 'Leave').length,
    };
  };

  // Compute pending vs submitted logic
  const combos = useMemo(() => {
    const allCombos: { class_name: string, section: string, incharge_id?: string, teacher_name?: string }[] = [];
    if (settings && settings.classes) {
      settings.classes.forEach((c: string) => {
        const sections = settings.class_sections?.[c] || [];
        sections.forEach((s: string) => {
          let incharge_id = undefined;
          
          // First try to get it from attendance settings
          if (attSettings && attSettings.length > 0) {
            const attConfig = attSettings.find((st: any) => st.class_name === c && st.section === s);
            if (attConfig && attConfig.incharge_teacher_id) {
              incharge_id = attConfig.incharge_teacher_id;
            }
          }
          
          if (!incharge_id && settings.class_incharges) {
            incharge_id = settings.class_incharges[`${c}-${s}`];
          }

          const teacher_name = teachers.find(t => t.id === incharge_id)?.name || 'Unassigned';
          allCombos.push({ class_name: c, section: s, incharge_id, teacher_name });
        });
      });
    }

    const submissionsForDate = attendances.filter(a => a.date === filters.date);

    const pendingList: any[] = [];
    const submittedList: any[] = [];

    allCombos.forEach(combo => {
      // Respect filters (Search, Class, Section)
      const matchSearch = combo.class_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          combo.section.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (combo.teacher_name || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchClass = filters.class_name ? combo.class_name === filters.class_name : true;
      const matchSection = filters.section ? combo.section === filters.section : true;
      
      if (!matchSearch || !matchClass || !matchSection) return;

      const submission = submissionsForDate.find(a => a.class_name === combo.class_name && a.section === combo.section);
      const unifiedRecord = {
        ...combo,
        attendance_record: submission || null,
        status: submission ? submission.status : 'Pending',
        teacher_name: submission ? submission.teacher_name : combo.teacher_name
      };

      if (!submission) {
        pendingList.push(unifiedRecord);
      } else {
        submittedList.push(unifiedRecord);
      }
    });

    // Sort submitted list: Draft first, Published last, then by Class Name
    submittedList.sort((a, b) => {
      const rankA = a.status === 'Published' ? 2 : 1;
      const rankB = b.status === 'Published' ? 2 : 1;
      if (rankA !== rankB) return rankA - rankB;
      return a.class_name.localeCompare(b.class_name);
    });

    // Sort pending list by Class Name
    pendingList.sort((a, b) => a.class_name.localeCompare(b.class_name));

    return { 
      pendingList,
      submittedList,
      pendingCount: pendingList.length,
      submittedCount: submittedList.length
    };
  }, [settings, attSettings, teachers, attendances, filters.date, searchTerm, filters.class_name, filters.section]);

  const [activeTab, setActiveTab] = useState<'Pending' | 'Submitted'>('Pending');

  const _getStatusColor = (status: string) => {
    if (status === 'Pending') return { border: '#F59E0B', bg: '#FEF3C7', text: '#D97706' };
    if (status === 'Submitted' || status === 'Draft') return { border: '#3B82F6', bg: '#EFF6FF', text: '#2563EB', label: 'Not Approved' };
    if (status === 'Published') return { border: '#10B981', bg: '#F0FDF4', text: '#059669', label: 'Approved' };
    return { border: '#CBD5E1', bg: '#F8FAFC', text: '#64748B' };
  };
  void _getStatusColor;

  return (
    <div className="page-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', color: 'var(--color-primary)', margin: '0 0 8px 0' }}>Attendance Approval</h1>
          <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>Review teacher-submitted attendance and apply fines for absentees.</p>
        </div>
      </div>

      {statusMsg.type && (
        <div className={`toast ${statusMsg.type}`} style={{ position: 'relative', top: 0, left: 0, right: 0, transform: 'none', margin: '0 0 24px 0' }}>
          {statusMsg.message}
        </div>
      )}

      {/* Date, Class, Section Filters */}
      <div className="card" style={{ marginBottom: '24px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Date</label>
          <input 
            type="date" 
            className="input-field" 
            value={filters.date}
            onChange={(e) => setFilters(f => ({ ...f, date: e.target.value }))}
          />
        </div>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Class</label>
          <select 
            className="input-field"
            value={filters.class_name}
            onChange={(e) => setFilters(f => ({ ...f, class_name: e.target.value, section: '' }))}
          >
            <option value="">All Classes</option>
            {settings?.classes?.map((c: string) => <option key={c} value={c}>{c}</option>)}
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
            {filters.class_name && (settings?.class_sections[filters.class_name] || []).map((s: string) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <button 
          className="btn-secondary" 
          onClick={() => setFilters({ date: new Date().toISOString().split('T')[0], class_name: '', section: '' })}
          style={{ height: '38px' }}
        >
          Clear Filters
        </button>
      </div>

      <div style={{ display: 'flex', gap: '24px', marginBottom: '24px', alignItems: 'stretch' }}>
        <div style={{ flex: 1, display: 'flex' }}>
          <div 
            className="card hover-effect" 
            style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '16px', borderLeft: activeTab === 'Pending' ? '4px solid #F59E0B' : '4px solid transparent', cursor: 'pointer', backgroundColor: activeTab === 'Pending' ? '#F8FAFC' : 'white', boxShadow: activeTab === 'Pending' ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : '' }}
            onClick={() => setActiveTab('Pending')}
          >
            <div style={{ backgroundColor: '#FEF3C7', padding: '16px', borderRadius: '50%' }}>
              <Clock size={24} color="#D97706" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginBottom: '4px' }}>Pending Attendance</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>{combos.pendingCount}</div>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex' }}>
          <div 
            className="card hover-effect" 
            style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '16px', borderLeft: activeTab === 'Submitted' ? '4px solid #10B981' : '4px solid transparent', cursor: 'pointer', backgroundColor: activeTab === 'Submitted' ? '#F8FAFC' : 'white', boxShadow: activeTab === 'Submitted' ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : '' }}
            onClick={() => setActiveTab('Submitted')}
          >
            <div style={{ backgroundColor: '#D1FAE5', padding: '16px', borderRadius: '50%' }}>
              <CheckCircle size={24} color="#059669" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginBottom: '4px' }}>Submitted Attendance</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>{combos.submittedCount}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="admin-split-layout">
        <div className="admin-split-left">
          {/* SEARCH BAR WAS REMOVED FROM HERE */}

          {isLoading ? (
            <div className="card">Loading attendance...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, overflowY: 'auto' }}>
              
              {/* PENDING VIEW */}
              {activeTab === 'Pending' && combos.pendingList.length === 0 && (
                <div className="empty-state card">No pending attendance records.</div>
              )}
              {activeTab === 'Pending' && combos.pendingList.length > 0 && (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ maxHeight: '400px', overflowY: 'auto', overflowX: 'hidden' }}>
                    <table className="data-table" style={{ margin: 0, width: '100%', fontSize: '13px', tableLayout: 'fixed', wordWrap: 'break-word' }}>
                      <thead>
                        <tr>
                          <th style={{ padding: '8px 12px', width: '45%' }}>Incharge</th>
                          <th style={{ padding: '8px 12px', width: '30%' }}>Class</th>
                          <th style={{ padding: '8px 12px', width: '25%' }}>Section</th>
                        </tr>
                      </thead>
                      <tbody>
                        {combos.pendingList.map((r: any, idx: number) => (
                          <tr key={idx}>
                            <td style={{ padding: '8px 12px' }}>{r.teacher_name}</td>
                            <td style={{ padding: '8px 12px', fontWeight: 500 }}>{r.class_name}</td>
                            <td style={{ padding: '8px 12px' }}>{r.section}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* SUBMITTED VIEW */}
              {activeTab === 'Submitted' && combos.submittedList.length === 0 && (
                <div className="empty-state card">No submitted attendance records.</div>
              )}
              {activeTab === 'Submitted' && combos.submittedList.length > 0 && (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ maxHeight: '400px', overflowY: 'auto', overflowX: 'hidden' }}>
                    <table className="data-table" style={{ margin: 0, width: '100%', fontSize: '13px', tableLayout: 'fixed', wordWrap: 'break-word' }}>
                      <thead>
                        <tr>
                          <th style={{ padding: '8px 12px', width: '35%' }}>Incharge</th>
                          <th style={{ padding: '8px 12px', width: '25%' }}>Class</th>
                          <th style={{ padding: '8px 12px', width: '15%' }}>Section</th>
                          <th style={{ padding: '8px 12px', width: '25%' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {combos.submittedList.map((r: any, idx: number) => {
                          const isSelected = selectedRecord?.id === r.attendance_record?.id;
                          
                          return (
                            <tr key={idx} style={{ backgroundColor: isSelected ? '#F0F9FF' : 'transparent', cursor: 'pointer' }} onClick={() => { if (r.attendance_record) openRecord(r.attendance_record); }}>
                              <td style={{ padding: '8px 12px' }}>{r.teacher_name}</td>
                              <td style={{ padding: '8px 12px', fontWeight: 500 }}>{r.class_name}</td>
                              <td style={{ padding: '8px 12px' }}>{r.section}</td>
                              <td style={{ padding: '8px 12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span className={`badge ${r.status === 'Published' ? 'badge-success' : 'badge-warning'}`} style={{ cursor: 'pointer', opacity: 0.9 }}>
                                    {r.status === 'Published' ? 'Approved' : 'Not Approved'}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>

        {/* ADMIN SPLIT RIGHT - DETAILED VIEW */}
        <div className="admin-split-right">
          {selectedRecord ? (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '20px', borderBottom: '1px solid var(--color-border)', backgroundColor: '#F8FAFC', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>Attendance: {selectedRecord.class_name} ({selectedRecord.section})</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                      Date: {selectedRecord.date ? `${selectedRecord.date.split('-')[2]}/${selectedRecord.date.split('-')[1]}/${selectedRecord.date.split('-')[0]}` : ''}
                    </p>
                    <div style={{ display: 'flex', gap: '8px', fontSize: '13px' }}>
                      <span style={{ color: '#059669', fontWeight: 600 }}>P: {getStats(selectedRecord).present}</span>
                      <span style={{ color: '#DC2626', fontWeight: 600 }}>A: {getStats(selectedRecord).absent}</span>
                      <span style={{ color: '#D97706', fontWeight: 600 }}>L: {getStats(selectedRecord).leave}</span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {(selectedRecord.status === 'Submitted' || selectedRecord.status === 'Draft') && (
                    <>
                      <button className="btn-secondary" onClick={rejectToDraft} disabled={isActionLoading} style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {isActionLoading ? <div className="spinner" style={{ width: '14px', height: '14px', border: '2px solid var(--color-danger)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> : null}
                        Reject (To Draft)
                      </button>
                      <button className="btn-primary" onClick={saveEditsAndPublish} disabled={isActionLoading} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {isActionLoading ? <div className="spinner" style={{ width: '14px', height: '14px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> : null}
                        Accept & Publish
                      </button>
                    </>
                  )}
                  {selectedRecord.status === 'Published' && (
                    <span className="badge badge-success">Already Published</span>
                  )}
                </div>
              </div>

              <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                <table className="data-table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th>Roll #</th>
                      <th>Student Name</th>
                      <th>Father Name</th>
                      <th>Status</th>
                      <th>Fine (Rs)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editedRecords.map((r: any) => (
                      <tr key={r.student_id}>
                        <td>{r.roll_number || r.student_id.split('-')[0]}</td>
                        <td style={{ fontWeight: 500 }}>{r.student_name || 'N/A'}</td>
                        <td style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>{r.father_name || 'N/A'}</td>
                        <td>
                          <span className={`badge ${r.status === 'Present' ? 'badge-success' : r.status === 'Absent' ? 'badge-error' : 'badge-warning'}`}>
                            {r.status}
                          </span>
                        </td>
                        <td>
                          {r.status === 'Absent' ? (
                            <input 
                              type="number" 
                              className="input-field" 
                              style={{ width: '100px', margin: 0 }}
                              value={r.fine || 0}
                              onChange={e => handleFineChange(r.student_id, e.target.value)}
                              disabled={selectedRecord.status === 'Published'}
                            />
                          ) : (
                            <span style={{ color: 'var(--color-text-muted)' }}>-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="card empty-state" style={{ height: '100%', minHeight: '300px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <Calendar size={48} color="var(--color-border)" style={{ marginBottom: '16px' }} />
              <h3>Select an Attendance Record</h3>
              <p style={{ color: 'var(--color-text-secondary)' }}>Click on a submitted record to review, apply absentee fines, and publish.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminAttendanceApproval;
