'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, CheckCircle, Clock, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export const AdminAttendanceApproval: React.FC = () => {
  const [attendances, setAttendances] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [searchTerm] = useState('');
  const [statusMsg, setStatusMsg] = useState<{type: 'success'|'error'|null, message: string}>({type: null, message: ''});
  
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [editedRecords, setEditedRecords] = useState<any[]>([]);
  const [isActionLoading, setIsActionLoading] = useState(false);

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
      
      const { data: pubData } = await supabase.from('settings').select('key').like('key', 'att_published_%');
      const pubKeys = new Set((pubData || []).map(r => r.key));
      
      const grouped: { [key: string]: any } = {};
      (attData || []).forEach((row: any) => {
        const key = `${row.date}_${row.academic_class}_${row.section}`;
        if (!grouped[key]) {
          grouped[key] = {
            id: key,
            date: row.date,
            class_name: row.academic_class,
            section: row.section,
            status: 'Draft',
            teacher_id: row.teacher_id,
            records: []
          };
        }
        if (row.is_locked) {
          grouped[key].status = 'Submitted';
        }
        if (pubKeys.has(`att_published_${row.date}_${row.academic_class}_${row.section}`)) {
          grouped[key].status = 'Published';
        }
        grouped[key].records.push({
          id: row.id,
          student_id: row.student_id,
          status: row.status
        });
      });

      const enriched = Object.values(grouped).map((a: any) => ({
        ...a,
        teacher_name: (staffData || []).find((s: any) => s.id?.toString() === a.teacher_id?.toString())?.name || 'Unknown'
      }));
      enriched.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
          .select('id, name, father_name, roll_number, guardian_id')
          .in('id', studentIds);
          
        if (studentsData && studentsData.length > 0) {
          const enriched = (record.records || []).map((r: any) => {
            const student = studentsData.find((s: any) => s.id === r.student_id);
            return {
              ...r,
              student_name: r.student_name || student?.name || 'N/A',
              father_name: r.father_name || student?.father_name || 'N/A',
              roll_number: r.roll_number || student?.roll_number || 'N/A',
              guardian_id: student?.guardian_id || null
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
      for (const r of editedRecords) {
        if (r.id) {
          const { error } = await supabase.from('student_attendance').update({
            status: r.status,
            is_locked: true
          }).eq('id', r.id);
          if (error) throw error;
        }
      }
      
      // Mark as published in settings
      await supabase.from('settings').upsert({
        key: `att_published_${selectedRecord.date}_${selectedRecord.class_name}_${selectedRecord.section}`,
        value: { publishedAt: new Date().toISOString() }
      }, { onConflict: 'key' });
      
      // Auto-notify parents (Task 2 flow)
      try {
        const token = (await supabase.auth.getSession()).data.session?.access_token;
        const dateFormatted = new Date(selectedRecord.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
        
        // Group by guardian_id + status + fine
        const groupedNotifications: { [key: string]: any } = {};
        
        (editedRecords || []).forEach((r: any) => {
          const key = r.guardian_id ? `${r.guardian_id}_${r.status}_${r.fine || 0}` : `student_${r.student_id}`;
          if (!groupedNotifications[key]) {
            groupedNotifications[key] = {
              userIds: ['parent_' + r.student_id], // Will target guardian_id via push API
              names: [r.student_name || 'Student'],
              status: r.status,
              fine: r.fine || 0
            };
          } else {
            groupedNotifications[key].names.push(r.student_name || 'Student');
            groupedNotifications[key].userIds.push('parent_' + r.student_id);
          }
        });

        await Promise.all(Object.values(groupedNotifications).map(async (group: any) => {
          const title = `📅 Attendance Recorded: ${group.status}`;
          const namesStr = group.names.join(' & ');
          const message = `Dear Parent, your ${group.names.length > 1 ? 'children' : 'child'} ${namesStr} (${selectedRecord.class_name} - ${selectedRecord.section}) ${group.names.length > 1 ? 'were' : 'was'} marked ${group.status} on ${dateFormatted}.${group.status === 'Absent' && group.fine ? ` An absentee fine of Rs. ${group.fine} has been applied.` : ''}`;
          
          await fetch('/api/push/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              userIds: group.userIds,
              title,
              message,
              category: 'Attendance',
              url: '/guardian/guardianhome'
            })
          });
        }));
      } catch (err) {
        console.error('Error sending attendance notifications to parents:', err);
      }

      setStatusMsg({type: 'success', message: 'Attendance published and fines applied!'});
      setTimeout(() => setStatusMsg({type: null, message: ''}), 3000);
      setSelectedRecord(null);
      fetchAttendances();
    } catch(err: any) {
      setStatusMsg({type: 'error', message: err.message});
    } finally {
      setPublishing(false);
    }
  };
  
  const rejectToDraft = async () => {
    setRejecting(true);
    try {
      if (selectedRecord && selectedRecord.records) {
        for (const r of selectedRecord.records) {
          if (r.id) {
            const { error } = await supabase.from('student_attendance').update({ is_locked: false }).eq('id', r.id);
            if (error) throw error;
          }
        }
        
        // Remove published marker if it exists
        await supabase.from('settings').delete().eq('key', `att_published_${selectedRecord.date}_${selectedRecord.class_name}_${selectedRecord.section}`);
      }
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

          const teacher_name = teachers.find(t => t.id?.toString() === incharge_id?.toString())?.name || 'Unassigned';
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
        teacher_name: (submission && submission.teacher_name !== 'Unknown') ? submission.teacher_name : combo.teacher_name
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
    
    const allList = [...pendingList, ...submittedList];

    return {
      allList,
      allCount: allList.length,
      pendingList,
      pendingCount: pendingList.length,
      submittedList,
      submittedCount: submittedList.length
    };
  }, [attendances, teachers, settings, attSettings, searchTerm, filters]);

  const handleTabSwitch = (tab: 'All' | 'Pending' | 'Completed') => {
    if (tab === activeTab) return;
    setIsTabSwitching(true);
    setActiveTab(tab);
    setTimeout(() => setIsTabSwitching(false), 400); // Give enough time for the dotted spinner to show
  };

  const [activeTab, setActiveTab] = useState<'All' | 'Pending' | 'Completed'>('All');
  const [isTabSwitching, setIsTabSwitching] = useState(false);

  const _getStatusColor = (status: string) => {
    if (status === 'Pending') return { border: '#F59E0B', bg: '#FEF3C7', text: '#D97706' };
    if (status === 'Submitted' || status === 'Draft') return { border: '#3B82F6', bg: '#EFF6FF', text: '#2563EB', label: 'Not Approved' };
    if (status === 'Published') return { border: '#10B981', bg: '#F0FDF4', text: '#059669', label: 'Approved' };
    return { border: '#CBD5E1', bg: '#F8FAFC', text: '#64748B' };
  };
  void _getStatusColor;

  return (
    <div className="page-content fill-vertical-space">
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
            style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '16px', borderLeft: activeTab === 'All' ? '4px solid #3B82F6' : '4px solid transparent', cursor: 'pointer', backgroundColor: activeTab === 'All' ? '#F0F9FF' : 'white', boxShadow: activeTab === 'All' ? '0 10px 15px -3px rgba(59, 130, 246, 0.1)' : '0 1px 3px rgba(0,0,0,0.1)', transition: 'all 0.3s ease' }}
            onClick={() => handleTabSwitch('All')}
          >
            <div style={{ backgroundColor: '#DBEAFE', padding: '16px', borderRadius: '50%' }}>
              <Users size={24} color="#2563EB" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginBottom: '4px', fontWeight: 500 }}>All Classes</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>{combos.allCount}</div>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex' }}>
          <div 
            className="card hover-effect" 
            style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '16px', borderLeft: activeTab === 'Pending' ? '4px solid #F59E0B' : '4px solid transparent', cursor: 'pointer', backgroundColor: activeTab === 'Pending' ? '#FFFBEB' : 'white', boxShadow: activeTab === 'Pending' ? '0 10px 15px -3px rgba(245, 158, 11, 0.1)' : '0 1px 3px rgba(0,0,0,0.1)', transition: 'all 0.3s ease' }}
            onClick={() => handleTabSwitch('Pending')}
          >
            <div style={{ backgroundColor: '#FEF3C7', padding: '16px', borderRadius: '50%' }}>
              <Clock size={24} color="#D97706" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginBottom: '4px', fontWeight: 500 }}>Pending</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>{combos.pendingCount}</div>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex' }}>
          <div 
            className="card hover-effect" 
            style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '16px', borderLeft: activeTab === 'Completed' ? '4px solid #10B981' : '4px solid transparent', cursor: 'pointer', backgroundColor: activeTab === 'Completed' ? '#F0FDF4' : 'white', boxShadow: activeTab === 'Completed' ? '0 10px 15px -3px rgba(16, 185, 129, 0.1)' : '0 1px 3px rgba(0,0,0,0.1)', transition: 'all 0.3s ease' }}
            onClick={() => handleTabSwitch('Completed')}
          >
            <div style={{ backgroundColor: '#D1FAE5', padding: '16px', borderRadius: '50%' }}>
              <CheckCircle size={24} color="#059669" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginBottom: '4px', fontWeight: 500 }}>Completed</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>{combos.submittedCount}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="admin-split-layout">
        <div className="admin-split-left" style={{ display: 'flex', flexDirection: 'column' }}>
          {isLoading ? (
            <div className="card" style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
              <div className="dotted-spinner">
                <div className="dot"></div>
                <div className="dot"></div>
                <div className="dot"></div>
              </div>
            </div>
          ) : isTabSwitching ? (
            <div className="card" style={{ display: 'flex', justifyContent: 'center', padding: '40px', flex: 1 }}>
              <div className="dotted-spinner">
                <div className="dot"></div>
                <div className="dot"></div>
                <div className="dot"></div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
              
              {/* PENDING VIEW */}
              {activeTab === 'Pending' && combos.pendingList.length === 0 && (
                <div className="empty-state card" style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>No pending attendance records.</div>
              )}
              {activeTab === 'Pending' && combos.pendingList.length > 0 && (
                <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid #E5E7EB', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                  <div style={{ maxHeight: '450px', overflowY: 'auto', overflowX: 'hidden' }}>
                    <table className="data-table" style={{ margin: 0, width: '100%', fontSize: '13.5px', tableLayout: 'fixed', wordWrap: 'break-word' }}>
                      <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#F9FAFB' }}>
                        <tr>
                          <th style={{ padding: '12px 16px', width: '45%', color: '#6B7280', fontWeight: 600, borderBottom: '1px solid #E5E7EB' }}>Incharge</th>
                          <th style={{ padding: '12px 16px', width: '30%', color: '#6B7280', fontWeight: 600, borderBottom: '1px solid #E5E7EB' }}>Class</th>
                          <th style={{ padding: '12px 16px', width: '25%', color: '#6B7280', fontWeight: 600, borderBottom: '1px solid #E5E7EB' }}>Section</th>
                        </tr>
                      </thead>
                      <tbody>
                        {combos.pendingList.map((r: any, idx: number) => (
                          <tr key={idx} className="table-row-hover" style={{ transition: 'background-color 0.2s ease', borderBottom: '1px solid #F3F4F6' }}>
                            <td style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#E0E7FF', color: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' }}>
                                {r.teacher_name.charAt(0)}
                              </div>
                              <span style={{ fontWeight: 500, color: '#111827' }}>{r.teacher_name}</span>
                            </td>
                            <td style={{ padding: '12px 16px', fontWeight: 600, color: '#374151' }}>{r.class_name}</td>
                            <td style={{ padding: '12px 16px', color: '#4B5563' }}>{r.section}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* COMPLETED VIEW */}
              {activeTab === 'Completed' && combos.submittedList.length === 0 && (
                <div className="empty-state card" style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>No completed attendance records.</div>
              )}
              {activeTab === 'Completed' && combos.submittedList.length > 0 && (
                <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid #E5E7EB', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                  <div style={{ maxHeight: '450px', overflowY: 'auto', overflowX: 'hidden' }}>
                    <table className="data-table" style={{ margin: 0, width: '100%', fontSize: '13.5px', tableLayout: 'fixed', wordWrap: 'break-word' }}>
                      <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#F9FAFB' }}>
                        <tr>
                          <th style={{ padding: '12px 16px', width: '35%', color: '#6B7280', fontWeight: 600, borderBottom: '1px solid #E5E7EB' }}>Incharge</th>
                          <th style={{ padding: '12px 16px', width: '25%', color: '#6B7280', fontWeight: 600, borderBottom: '1px solid #E5E7EB' }}>Class</th>
                          <th style={{ padding: '12px 16px', width: '15%', color: '#6B7280', fontWeight: 600, borderBottom: '1px solid #E5E7EB' }}>Section</th>
                          <th style={{ padding: '12px 16px', width: '25%', color: '#6B7280', fontWeight: 600, borderBottom: '1px solid #E5E7EB', textAlign: 'center' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {combos.submittedList.map((r: any, idx: number) => {
                          const isSelected = selectedRecord?.id === r.attendance_record?.id;
                          
                          return (
                            <tr key={idx} className="table-row-hover" style={{ backgroundColor: isSelected ? '#EFF6FF' : 'transparent', cursor: 'pointer', transition: 'background-color 0.2s ease', borderBottom: '1px solid #F3F4F6' }} onClick={() => { if (r.attendance_record) openRecord(r.attendance_record); }}>
                              <td style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#E0E7FF', color: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' }}>
                                  {r.teacher_name.charAt(0)}
                                </div>
                                <span style={{ fontWeight: 500, color: '#111827' }}>{r.teacher_name}</span>
                              </td>
                              <td style={{ padding: '12px 16px', fontWeight: 600, color: '#374151' }}>{r.class_name}</td>
                              <td style={{ padding: '12px 16px', color: '#4B5563' }}>{r.section}</td>
                              <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                <span className={`badge ${r.status === 'Published' ? 'badge-success' : 'badge-warning'}`} style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                  {r.status === 'Published' ? 'Approved' : 'Review'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ALL VIEW */}
              {activeTab === 'All' && combos.allList.length === 0 && (
                <div className="empty-state card" style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>No attendance records found.</div>
              )}
              {activeTab === 'All' && combos.allList.length > 0 && (
                <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid #E5E7EB', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                  <div style={{ maxHeight: '450px', overflowY: 'auto', overflowX: 'hidden' }}>
                    <table className="data-table" style={{ margin: 0, width: '100%', fontSize: '13.5px', tableLayout: 'fixed', wordWrap: 'break-word' }}>
                      <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#F9FAFB' }}>
                        <tr>
                          <th style={{ padding: '12px 16px', width: '35%', color: '#6B7280', fontWeight: 600, borderBottom: '1px solid #E5E7EB' }}>Incharge</th>
                          <th style={{ padding: '12px 16px', width: '25%', color: '#6B7280', fontWeight: 600, borderBottom: '1px solid #E5E7EB' }}>Class</th>
                          <th style={{ padding: '12px 16px', width: '15%', color: '#6B7280', fontWeight: 600, borderBottom: '1px solid #E5E7EB' }}>Section</th>
                          <th style={{ padding: '12px 16px', width: '25%', color: '#6B7280', fontWeight: 600, borderBottom: '1px solid #E5E7EB', textAlign: 'center' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {combos.allList.map((r: any, idx: number) => {
                          const isSelected = selectedRecord?.id === r.attendance_record?.id;
                          const isPending = !r.attendance_record;
                          
                          return (
                            <tr key={idx} className="table-row-hover" style={{ backgroundColor: isSelected ? '#EFF6FF' : 'transparent', cursor: isPending ? 'default' : 'pointer', transition: 'background-color 0.2s ease', borderBottom: '1px solid #F3F4F6' }} onClick={() => { if (r.attendance_record) openRecord(r.attendance_record); }}>
                              <td style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#E0E7FF', color: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' }}>
                                  {r.teacher_name.charAt(0)}
                                </div>
                                <span style={{ fontWeight: 500, color: '#111827' }}>{r.teacher_name}</span>
                              </td>
                              <td style={{ padding: '12px 16px', fontWeight: 600, color: '#374151' }}>{r.class_name}</td>
                              <td style={{ padding: '12px 16px', color: '#4B5563' }}>{r.section}</td>
                              <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                {isPending ? (
                                  <span className="badge badge-error" style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,0.05)', backgroundColor: '#FEF2F2', color: '#DC2626' }}>
                                    Missing
                                  </span>
                                ) : (
                                  <span className={`badge ${r.status === 'Published' ? 'badge-success' : 'badge-warning'}`} style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                    {r.status === 'Published' ? 'Approved' : 'Review'}
                                  </span>
                                )}
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
            <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid #E5E7EB', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)' }}>
              <div style={{ padding: '24px', borderBottom: '1px solid #E5E7EB', background: 'linear-gradient(to right, #F8FAFC, #FFFFFF)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: '0 0 10px 0', fontSize: '20px', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ padding: '8px', background: '#DBEAFE', borderRadius: '8px' }}>
                      <CheckCircle size={20} color="#2563EB" />
                    </div>
                    Attendance: {selectedRecord.class_name} ({selectedRecord.section})
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px', paddingLeft: '46px' }}>
                    <p style={{ margin: 0, fontSize: '14px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={14} /> {selectedRecord.date ? `${selectedRecord.date.split('-')[2]}/${selectedRecord.date.split('-')[1]}/${selectedRecord.date.split('-')[0]}` : ''}
                    </p>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '14px', background: '#F1F5F9', padding: '4px 12px', borderRadius: '20px' }}>
                      <span style={{ color: '#059669', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>P: {getStats(selectedRecord).present}</span>
                      <span style={{ color: '#DC2626', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>A: {getStats(selectedRecord).absent}</span>
                      <span style={{ color: '#D97706', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>L: {getStats(selectedRecord).leave}</span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  {(selectedRecord.status === 'Submitted' || selectedRecord.status === 'Draft') && (
                    <>
                      <button className="btn-secondary" onClick={rejectToDraft} disabled={rejecting || publishing} style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '10px', padding: '10px 16px', fontWeight: 600, transition: 'all 0.2s ease', background: 'transparent' }}>
                        {rejecting ? <div className="spinner" style={{ width: '16px', height: '16px', border: '2px solid var(--color-danger)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> : <Clock size={16} />}
                        Reject to Draft
                      </button>
                      <button className="btn-primary" onClick={saveEditsAndPublish} disabled={rejecting || publishing} style={{ display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '10px', padding: '10px 20px', fontWeight: 600, transition: 'all 0.2s ease', boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)' }}>
                        {publishing ? <div className="spinner" style={{ width: '16px', height: '16px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> : <CheckCircle size={16} />}
                        Accept & Publish
                      </button>
                    </>
                  )}
                  {selectedRecord.status === 'Published' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#D1FAE5', padding: '10px 16px', borderRadius: '10px', color: '#065F46', fontWeight: 600, border: '1px solid #A7F3D0' }}>
                      <CheckCircle size={18} />
                      Already Published
                    </div>
                  )}
                </div>
              </div>

              <div style={{ maxHeight: '550px', overflowY: 'auto' }}>
                <table className="data-table" style={{ margin: 0, width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ position: 'sticky', top: 0, background: '#F8FAFC', zIndex: 10, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                    <tr>
                      <th style={{ padding: '14px 24px', textAlign: 'left', color: '#475569', fontWeight: 600, borderBottom: '1px solid #E2E8F0' }}>Roll #</th>
                      <th style={{ padding: '14px 24px', textAlign: 'left', color: '#475569', fontWeight: 600, borderBottom: '1px solid #E2E8F0' }}>Student Profile</th>
                      <th style={{ padding: '14px 24px', textAlign: 'left', color: '#475569', fontWeight: 600, borderBottom: '1px solid #E2E8F0' }}>Status</th>
                      <th style={{ padding: '14px 24px', textAlign: 'left', color: '#475569', fontWeight: 600, borderBottom: '1px solid #E2E8F0' }}>Fine (Rs)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editedRecords.map((r: any) => (
                      <tr key={r.student_id} className="table-row-hover" style={{ borderBottom: '1px solid #F1F5F9', transition: 'background-color 0.2s ease' }}>
                        <td style={{ padding: '14px 24px', color: '#64748B', fontWeight: 500 }}>{r.roll_number || r.student_id.split('-')[0]}</td>
                        <td style={{ padding: '14px 24px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 600, color: '#1E293B', fontSize: '14.5px' }}>{r.student_name || 'N/A'}</span>
                            <span style={{ color: '#94A3B8', fontSize: '13px' }}>{r.father_name || 'N/A'}</span>
                          </div>
                        </td>
                        <td style={{ padding: '14px 24px' }}>
                          <span className={`badge ${r.status === 'Present' ? 'badge-success' : r.status === 'Absent' ? 'badge-error' : 'badge-warning'}`} style={{ padding: '6px 12px', borderRadius: '12px', fontWeight: 600, fontSize: '12.5px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                            {r.status}
                          </span>
                        </td>
                        <td style={{ padding: '14px 24px' }}>
                          {r.status === 'Absent' ? (
                            <div className="input-group" style={{ margin: 0, width: '110px' }}>
                              <span style={{ padding: '8px', background: '#F1F5F9', border: '1px solid #E2E8F0', borderRight: 'none', borderRadius: '6px 0 0 6px', color: '#64748B', fontWeight: 600 }}>Rs</span>
                              <input 
                                type="number" 
                                className="input-field" 
                                style={{ margin: 0, borderRadius: '0 6px 6px 0', border: '1px solid #E2E8F0', padding: '8px 12px', transition: 'border-color 0.2s ease, box-shadow 0.2s ease' }}
                                value={r.fine || 0}
                                onChange={e => handleFineChange(r.student_id, e.target.value)}
                                disabled={selectedRecord.status === 'Published'}
                              />
                            </div>
                          ) : (
                            <span style={{ color: '#CBD5E1', fontWeight: 500, paddingLeft: '16px' }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="empty-state card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', border: '2px dashed #E2E8F0', background: '#F8FAFC' }}>
              <div style={{ background: '#E0E7FF', padding: '24px', borderRadius: '50%', marginBottom: '20px', color: '#4F46E5', boxShadow: '0 10px 15px -3px rgba(79, 70, 229, 0.1)' }}>
                <CheckCircle size={48} />
              </div>
              <h3 style={{ margin: '0 0 8px 0', color: '#1E293B', fontSize: '20px' }}>Select an Attendance Record</h3>
              <p style={{ margin: 0, color: '#64748B', maxWidth: '300px', textAlign: 'center', lineHeight: '1.5' }}>
                Click on any submitted class from the left panel to review and publish attendance.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminAttendanceApproval;
