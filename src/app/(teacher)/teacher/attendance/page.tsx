'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Calendar, CheckCircle2, XCircle, Clock, AlertTriangle, ChevronLeft, Search, ChevronRight, UserX, BookOpen, Users, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { RemarkModal } from '@/components/RemarkModal';
import { supabase, adminSupabase } from '@/lib/supabase';


export const TakeAttendance: React.FC = () => {
  const { user } = useAuth();
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [students, setStudents] = useState<any[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{type: 'success'|'error'|null, message: string}>({type: null, message: ''});
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [remarkStudent, setRemarkStudent] = useState<{id: string, name: string} | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Submitted' | 'Pending'>('All');
  const [dutyFilterClass, setDutyFilterClass] = useState('');
  const [dutyFilterSection, setDutyFilterSection] = useState('');

  const [duties, setDuties] = useState<any[]>([]);
  const [recordStatus, setRecordStatus] = useState<string>('Draft');

  const [globalStudents, setGlobalStudents] = useState<any[]>([]);
  const [globalAttendances, setGlobalAttendances] = useState<any[]>([]);

  // Fetch all students for stats
  useEffect(() => {
    supabase.from('students').select('*').neq('status', 'Struck Off').then(res => {
      if (res.data) setGlobalStudents(res.data);
    });
  }, []);

  // Fetch all attendances for the selected date for this teacher
  useEffect(() => {
    if (user?.id) {
      supabase.from('student_attendance').select('*').eq('teacher_id', user.id).eq('date', selectedDate).then(res => {
        if (res.data) setGlobalAttendances(res.data);
      });
    }
  }, [user, selectedDate, recordStatus]);

  const computeStats = (duty: any) => {
    let total = 0, present = 0, absent = 0, leave = 0;
    
    const attRecord = globalAttendances.find(a => a.date === selectedDate && a.class_name === duty.class_name && a.section === duty.section && (duty.subject ? a.subject === duty.subject : !a.subject));
    
    if (attRecord && attRecord.records) {
      total = attRecord.records.length;
      attRecord.records.forEach((r: any) => {
        if (r.status === 'Present') present++;
        if (r.status === 'Absent') absent++;
        if (r.status === 'Leave') leave++;
      });
    } else {
      const studentsInClass = globalStudents.filter(s => s.academic_class === duty.class_name && s.section === duty.section);
      total = studentsInClass.length;
      present = total;
    }
    
    return { total, present, absent, leave };
  };

  // Fetch classes and sections from the timetable (where teacher is assigned)
  useEffect(() => {
    if (user?.role === 'Teacher' && user.email) {
      (async () => {
        // Use adminSupabase (service role) to bypass RLS when reading settings/staff
        const dbClient = adminSupabase || supabase;
        
        try {
          // Look up staff record by email (case-insensitive)
          const staffRes = await dbClient.from('staff').select('id').ilike('username', user.email ?? '').limit(1).maybeSingle();
          const staffId = staffRes.data?.id || user.id;
          
          console.log('Teacher Staff ID:', staffId);
          
          // Read assigned classes directly from timetable
          const ttRes = await dbClient
            .from('timetable')
            .select('academic_class, section, subject')
            .eq('teacher_id', staffId);
          
          console.log('Timetable entries:', ttRes.data);
          
          if (ttRes.data && ttRes.data.length > 0) {
            // Build unique class+section duties (for daily incharge attendance)
            const uniqueDuties: any[] = [];
            const seen = new Set<string>();
            for (const entry of ttRes.data) {
              // Each unique class+section is a duty
              const key = `${entry.academic_class}-${entry.section}`;
              if (!seen.has(key)) {
                seen.add(key);
                uniqueDuties.push({
                  class_name: entry.academic_class,
                  section: entry.section,
                  incharge_teacher_id: staffId
                });
              }
            }
            console.log('Unique duties from timetable:', uniqueDuties);
            setDuties(uniqueDuties);
          } else {
            console.log('No timetable entries found for teacher');
            setDuties([]);
          }
        } catch (err) {
          console.error('Error fetching timetable duties:', err);
        }
      })();
    }
  }, [user]);

  // Fetch students when class/section changes
  useEffect(() => {
    if (selectedClass && selectedSection) {
      setIsLoading(true);
      
      const fetchAtt = async () => {
        const { data: stdData } = await supabase.from('students').select('*')
          .eq('academic_class', selectedClass)
          .eq('section', selectedSection)
          .neq('status', 'Struck Off');
        if (stdData) setStudents(stdData);
        
        let query = supabase.from('student_attendance').select('*')
          .eq('date', selectedDate)
          .eq('class_name', selectedClass)
          .eq('section', selectedSection);
        
        if (selectedSubject) query = query.eq('subject', selectedSubject);
        else query = query.is('subject', null);
        
        const { data: attData } = await query.maybeSingle();
        if (attData) {
          setAttendanceRecords(attData.records || []);
          setRecordStatus(attData.status || 'Draft');
        } else {
          const defaultRecords = (stdData || []).map((s: any) => ({
            student_id: s.id,
            status: 'Present'
          }));
          setAttendanceRecords(defaultRecords);
          setRecordStatus('Draft');
        }
        setIsLoading(false);
      };
      
      fetchAtt();
    } else {
      setStudents([]);
      setAttendanceRecords([]);
    }
  }, [selectedClass, selectedSection, selectedSubject, selectedDate, user]);

  const isValidSelection = () => {
    if (user?.role === 'Teacher') {
      // Check if teacher is assigned to this class+section in the timetable
      return duties.some(d => d.class_name === selectedClass && d.section === selectedSection);
    }
    return true;
  };

  const isLocked = recordStatus === 'Submitted' || recordStatus === 'Published';

  const updateStatus = (studentId: string, status: string) => {
    setAttendanceRecords(prev => {
      const exists = prev.find(r => r.student_id === studentId);
      if (exists) {
        return prev.map(r => r.student_id === studentId ? { ...r, status } : r);
      }
      return [...prev, { student_id: studentId, status }];
    });
  };

  const getStatus = (studentId: string) => {
    const record = attendanceRecords.find(r => r.student_id === studentId);
    return record ? record.status : 'Present'; // Default to present if no record
  };

  const handleSave = async (submitToAdmin: boolean = false) => {
    if (students.length === 0) {
      setStatusMsg({type: 'error', message: 'No students found in this class.'});
      return;
    }
    
    setIsSaving(true);
    setStatusMsg({type: null, message: ''});

    // Auto-fill all student records with Default Present status if not set, and include details
    const finalRecords = students.map(s => {
      const existing = attendanceRecords.find(r => r.student_id === s.id);
      return {
        student_id: s.id,
        status: existing ? existing.status : 'Present',
        student_name: s.name,
        father_name: s.father_name,
        roll_number: s.roll_number || s.roll_no || ''
      };
    });

    try {
      const payload = {
        date: selectedDate,
        class_name: selectedClass,
        section: selectedSection,
        subject: selectedSubject || null,
        teacher_id: user?.id,
        records: finalRecords,
        status: submitToAdmin ? 'Submitted' : 'Draft'
      };
      
      let query = supabase.from('student_attendance').select('id')
        .eq('date', selectedDate)
        .eq('class_name', selectedClass)
        .eq('section', selectedSection);
      if (selectedSubject) query = query.eq('subject', selectedSubject);
      else query = query.is('subject', null);
      
      const { data: existing } = await query.maybeSingle();
      
      if (existing) {
        const { error } = await supabase.from('student_attendance').update(payload).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('student_attendance').insert(payload);
        if (error) throw error;
      }

      try {
        const token = (await supabase.auth.getSession()).data.session?.access_token;
        const dateFormatted = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
        
        // Auto-notify parents for Absent/Leave students
        if (submitToAdmin) {
          const notificationsToSend = finalRecords.filter(r => r.status === 'Absent' || r.status === 'Leave');
          await Promise.all(notificationsToSend.map(async (r: any) => {
            const title = `📅 Attendance Alert: ${r.status}`;
            const message = `Dear Parent, your child ${r.student_name || 'Student'} (${selectedClass} - ${selectedSection}) was marked ${r.status} today (${dateFormatted}). Please ensure to contact the administration if you have not requested leave.`;
            
            try {
              await fetch('/api/push/send', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                  userIds: ['parent_' + r.student_id],
                  title,
                  message,
                  category: 'Attendance',
                  url: '/guardian/guardianhome'
                })
              });
            } catch (err) {
              console.error('Failed to notify parent for', r.student_name, err);
            }
          }));
        }
      } catch (err) {
        console.error('Failed to process notifications', err);
      }

      setStatusMsg({type: 'success', message: submitToAdmin ? 'Attendance published and parents notified!' : 'Draft saved successfully!'});
      if (submitToAdmin) setRecordStatus('Published');
      setTimeout(() => setStatusMsg({type: null, message: ''}), 3000);
    } catch(err: any) {
      setStatusMsg({type: 'error', message: err.message});
    } finally {
      setIsSaving(false);
    }
  };

  const baseFilteredDuties = duties.filter(d => {
    const matchSearch = (d.class_name + ' ' + d.section).toLowerCase().includes(searchQuery.toLowerCase());
    const matchClass = dutyFilterClass ? d.class_name === dutyFilterClass : true;
    const matchSection = dutyFilterSection ? d.section === dutyFilterSection : true;
    return matchSearch && matchClass && matchSection;
  });

  const totalClasses = baseFilteredDuties.length;
  const submittedClassesList = baseFilteredDuties.filter((d: any) => {
    const res = globalAttendances.find(a => a.date === selectedDate && a.class_name === d.class_name && a.section === d.section && (d.subject ? a.subject === d.subject : !a.subject));
    return res && res.status !== 'Draft';
  });
  const submittedCount = submittedClassesList.length;
  const pendingCount = totalClasses - submittedCount;

  const filteredDuties = baseFilteredDuties.filter(d => {
    const isSubmitted = submittedClassesList.includes(d);
    if (statusFilter === 'Submitted') return isSubmitted;
    if (statusFilter === 'Pending') return !isSubmitted;
    return true; // All
  });

  const currentIndex = filteredDuties.findIndex(d => {
    return d.class_name === selectedClass && d.section === selectedSection && (d.subject || '') === selectedSubject;
  });

  const handleNext = () => {
    if (currentIndex < filteredDuties.length - 1) {
      const nextDuty = filteredDuties[currentIndex + 1];
      setSelectedClass(nextDuty.class_name);
      setSelectedSection(nextDuty.section);
      setSelectedSubject(nextDuty.subject || '');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      const prevDuty = filteredDuties[currentIndex - 1];
      setSelectedClass(prevDuty.class_name);
      setSelectedSection(prevDuty.section);
      setSelectedSubject(prevDuty.subject || '');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Derive dependent sections
  const availableClasses = Array.from(new Set(duties.map(d => d.class_name)));
  const availableSections = Array.from(new Set(
    duties
      .filter(d => dutyFilterClass ? d.class_name === dutyFilterClass : true)
      .map(d => d.section)
  ));

  return (
    <div className="teacher-page">
      {(!selectedClass || !selectedSection) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', width: '100%', paddingBottom: '4px' }}>
            <div className="control-group" style={{ flex: '1 1 200px', position: 'relative' }}>
              <Calendar size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#8B5CF6', pointerEvents: 'none' }} />
              <input 
                type="date" 
                max={new Date().toISOString().split('T')[0]}
                className="input-field premium-input" 
                style={{ margin: 0, padding: '10px 10px 10px 32px', fontSize: '14px', width: '100%', fontWeight: 'bold', color: 'black' }}
                value={selectedDate} 
                onChange={e => {
                  if (e.target.value > new Date().toISOString().split('T')[0]) {
                    alert('You cannot select a future date for attendance.');
                  } else {
                    setSelectedDate(e.target.value);
                  }
                }}
              />
            </div>
            
            <div style={{ flex: '1 1 150px', position: 'relative' }}>
              <BookOpen size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#3B82F6', pointerEvents: 'none' }} />
              <select className="input-field premium-input" style={{ width: '100%', margin: 0, padding: '10px 16px 10px 32px', fontSize: '14px', fontWeight: 'bold', color: 'black' }} value={dutyFilterClass} onChange={e => { setDutyFilterClass(e.target.value); setDutyFilterSection(''); }}>
                <option value="">All Classes</option>
                {availableClasses.map(c => (
                  <option key={c as string} value={c as string}>{c as string}</option>
                ))}
              </select>
            </div>

            <div style={{ flex: '1 1 150px', position: 'relative' }}>
              <Users size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#F59E0B', pointerEvents: 'none' }} />
              <select className="input-field premium-input" style={{ width: '100%', margin: 0, padding: '10px 16px 10px 32px', fontSize: '14px', fontWeight: 'bold', color: 'black' }} value={dutyFilterSection} onChange={e => setDutyFilterSection(e.target.value)}>
                <option value="">All Sections</option>
                {availableSections.map(s => (
                  <option key={s as string} value={s as string}>{s as string}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '4px', width: '100%', paddingBottom: '8px' }}>
            <div 
              onClick={() => setStatusFilter('All')}
              className={`summary-card ${statusFilter === 'All' ? 'active' : ''}`}
              style={{ padding: '6px 8px', flex: '1', minWidth: '0' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginBottom: '4px', whiteSpace: 'nowrap' }}>
                <BookOpen size={12} color={statusFilter === 'All' ? '#FFFFFF' : '#3B82F6'} />
                <p style={{ fontSize: '10px', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>All</p>
              </div>
              <h3 style={{ fontSize: '16px', margin: 0 }}>{totalClasses}</h3>
            </div>
            <div 
              onClick={() => setStatusFilter('Pending')}
              className={`summary-card ${statusFilter === 'Pending' ? 'active' : ''}`}
              style={{ padding: '6px 8px', flex: '1', minWidth: '0' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginBottom: '4px', whiteSpace: 'nowrap' }}>
                <Clock size={12} color={statusFilter === 'Pending' ? '#FFFFFF' : '#F59E0B'} />
                <p style={{ fontSize: '10px', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>Pend</p>
              </div>
              <h3 style={{ fontSize: '16px', margin: 0 }}>{pendingCount}</h3>
            </div>
            <div 
              onClick={() => setStatusFilter('Submitted')}
              className={`summary-card ${statusFilter === 'Submitted' ? 'active' : ''}`}
              style={{ padding: '6px 8px', flex: '1', minWidth: '0' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginBottom: '4px', whiteSpace: 'nowrap' }}>
                <CheckCircle2 size={12} color={statusFilter === 'Submitted' ? '#FFFFFF' : '#10B981'} />
                <p style={{ fontSize: '10px', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>Done</p>
              </div>
              <h3 style={{ fontSize: '16px', margin: 0 }}>{submittedCount}</h3>
            </div>
            <div 
              className="summary-card"
              style={{ padding: '6px 8px', flex: '1', minWidth: '0', backgroundColor: '#F8FAFC' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginBottom: '4px', whiteSpace: 'nowrap' }}>
                <Calendar size={12} color="#8B5CF6" />
                <p style={{ fontSize: '10px', margin: 0, color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis' }}>Day</p>
              </div>
              <h3 style={{ fontSize: '14px', margin: 0, color: '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'short' })}</h3>
            </div>
          </div>

          <div style={{ width: '100%' }}>
            {(() => {
              return filteredDuties.length > 0 ? (
              <motion.div layout className="teacher-cards-grid" style={{ display: 'grid', gap: '10px', gridTemplateColumns: '1fr' }}>
                <AnimatePresence>
                {filteredDuties.slice().sort((a: any, b: any) => {
                  const statA = globalAttendances.find(att => att.date === selectedDate && att.class_name === a.class_name && att.section === a.section) ? 1 : 0;
                  const statB = globalAttendances.find(att => att.date === selectedDate && att.class_name === b.class_name && att.section === b.section) ? 1 : 0;
                  return statA - statB;
                }).map((duty: any, idx: number) => {
                  const stats = computeStats(duty);
                  const attRecord = globalAttendances.find(a => a.date === selectedDate && a.class_name === duty.class_name && a.section === duty.section && (duty.subject ? a.subject === duty.subject : !a.subject));
                  const currentStatus = attRecord ? attRecord.status : 'Pending';
                  
                  return (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2, delay: idx * 0.05 }}
                    key={`${duty.class_name}-${duty.section}-${duty.subject || 'incharge'}`}
                    className="attendance-card-detailed"
                    onClick={() => {
                      setSelectedClass(duty.class_name);
                      setSelectedSection(duty.section);
                      setSelectedSubject(duty.subject || '');
                    }}
                  >
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap' }}>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{duty.class_name}</h3>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'white', backgroundColor: '#06B6D4', padding: '2px 6px', borderRadius: '4px', whiteSpace: 'nowrap' }}>Section {duty.section}</span>
                        {duty.subject && <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', backgroundColor: '#F1F5F9', padding: '2px 6px', borderRadius: '4px', whiteSpace: 'nowrap' }}>{duty.subject}</span>}
                      </div>
                      <p style={{ margin: 0, fontSize: '14px', color: '#64748B' }}>{stats.total} Students</p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                      <span className={`status-badge status-${currentStatus.toLowerCase()}`}>{currentStatus}</span>
                      <ChevronRight size={20} color="#94A3B8" />
                    </div>
                  </motion.div>
                )})}
                </AnimatePresence>
              </motion.div>
              ) : (
                <div style={{ padding: '24px', backgroundColor: '#F8FAFC', borderRadius: '8px', color: 'var(--color-text-secondary)', textAlign: 'center', border: '1px dashed var(--color-border)' }}>
                  No assigned classes found.
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {statusMsg.type && (
        <div className={`toast ${statusMsg.type}`} style={{ position: 'relative', top: 0, left: 0, right: 0, transform: 'none', margin: '16px 0' }}>
          {statusMsg.message}
        </div>
      )}

      {selectedClass && selectedSection ? (
        isValidSelection() ? (
        <div className="attendance-container">
          <div className="attendance-bulk-actions" style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button 
                  onClick={() => { setSelectedClass(''); setSelectedSection(''); setSelectedSubject(''); }}
                  style={{ 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', 
                    backgroundColor: 'white', color: 'var(--color-text-main)', 
                    border: '1px solid var(--color-border)', padding: '6px', cursor: 'pointer',
                    borderRadius: '8px'
                  }}
                  className="icon-button"
                >
                  <ChevronLeft size={20} />
                </button>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', color: 'var(--color-text)' }}>
                    {selectedClass} ({selectedSection}) {selectedSubject && <span style={{ color: '#8B5CF6' }}>• {selectedSubject}</span>}
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748B' }}>
                    {new Date(selectedDate).toLocaleDateString()} | {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long' })}
                  </p>
                </div>
              </div>
              <span className={`badge ${recordStatus === 'Draft' ? 'badge-warning' : recordStatus === 'Submitted' ? 'badge-info' : 'badge-success'}`}>
                Status: {recordStatus}
              </span>
            </div>
            
            <div style={{ display: 'flex', gap: '4px', width: '100%', paddingBottom: '4px' }}>
              {(() => {
                const total = students.length;
                const absentCount = attendanceRecords.filter(r => r.status === 'Absent').length;
                const leaveCount = attendanceRecords.filter(r => r.status === 'Leave').length;
                const presentCount = total - absentCount - leaveCount;
                
                return (
                  <>
                    <motion.div whileTap={{ scale: 0.95 }} onClick={() => setFilterStatus(null)} style={{ padding: '6px 4px', borderRadius: '8px', backgroundColor: filterStatus === null ? '#2563EB' : '#EFF6FF', color: filterStatus === null ? 'white' : '#2563EB', fontWeight: 600, fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px', flex: '1', minWidth: '0' }}>
                      <Users size={12} color={filterStatus === null ? 'white' : '#2563EB'} /> <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>All {total}</span>
                    </motion.div>
                    <motion.div whileTap={{ scale: 0.95 }} onClick={() => setFilterStatus('Present')} style={{ padding: '6px 4px', borderRadius: '8px', backgroundColor: filterStatus === 'Present' ? '#16A34A' : '#F0FDF4', color: filterStatus === 'Present' ? 'white' : '#16A34A', fontWeight: 600, fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px', flex: '1', minWidth: '0' }}>
                      <CheckCircle2 size={12} color={filterStatus === 'Present' ? 'white' : '#16A34A'} /> <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>P {presentCount}</span>
                    </motion.div>
                    <motion.div whileTap={{ scale: 0.95 }} onClick={() => setFilterStatus('Absent')} style={{ padding: '6px 4px', borderRadius: '8px', backgroundColor: filterStatus === 'Absent' ? '#EF4444' : '#FEF2F2', color: filterStatus === 'Absent' ? 'white' : '#EF4444', fontWeight: 600, fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px', flex: '1', minWidth: '0' }}>
                      <XCircle size={12} color={filterStatus === 'Absent' ? 'white' : '#EF4444'} /> <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>A {absentCount}</span>
                    </motion.div>
                    <motion.div whileTap={{ scale: 0.95 }} onClick={() => setFilterStatus('Leave')} style={{ padding: '6px 4px', borderRadius: '8px', backgroundColor: filterStatus === 'Leave' ? '#F59E0B' : '#FFFBEB', color: filterStatus === 'Leave' ? 'white' : '#F59E0B', fontWeight: 600, fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px', flex: '1', minWidth: '0' }}>
                      <Clock size={12} color={filterStatus === 'Leave' ? 'white' : '#F59E0B'} /> <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>L {leaveCount}</span>
                    </motion.div>
                  </>
                );
              })()}
            </div>
          </div>

          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="skeleton-box" style={{ height: '48px', width: '100%', borderRadius: '14px' }}></div>
              <div className="skeleton-box" style={{ height: '100px', width: '100%', borderRadius: '20px' }}></div>
              <div className="skeleton-box" style={{ height: '100px', width: '100%', borderRadius: '20px' }}></div>
              <div className="skeleton-box" style={{ height: '100px', width: '100%', borderRadius: '20px' }}></div>
            </div>
          ) : students.length > 0 ? (
            <>
              <div style={{ marginBottom: '24px', position: 'relative' }}>
                <Search size={20} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                <input 
                  type="text" 
                  placeholder="Search student..."
                  className="input-field premium-input"
                  style={{ margin: 0, padding: '12px 16px 12px 48px', width: '100%', fontSize: '15px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '140px' }}>
                <AnimatePresence>
                {students.filter(s => {
                  const status = getStatus(s.id);
                  const matchesFilter = filterStatus ? status === filterStatus : true;
                  const searchLower = searchQuery.toLowerCase();
                  const matchesSearch = !searchQuery || 
                    (s.name && s.name.toLowerCase().includes(searchLower)) || 
                    (s.roll_number && String(s.roll_number).toLowerCase().includes(searchLower));
                  return matchesFilter && matchesSearch;
                }).map((student) => {
                  const status = getStatus(student.id);
                  return (
                    <motion.div 
                      key={student.id} 
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      style={{ backgroundColor: '#FFFFFF', padding: '10px 12px', borderRadius: 'var(--tp-radius-md, 16px)', boxShadow: 'var(--tp-shadow-soft, 0 4px 12px rgba(0,0,0,0.05))', border: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}
                    >
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <h4 style={{ margin: '0 0 2px 0', fontSize: '14px', fontWeight: 600, color: '#1E293B', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{student.name}</h4>
                          <button onClick={() => setRemarkStudent({id: student.id, name: student.name})} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', display: 'flex', alignItems: 'center', padding: 0 }} title="Send Remark">
                            <MessageSquare size={14} />
                          </button>
                        </div>
                        <p style={{ margin: 0, fontSize: '11px', color: '#64748B' }}>Roll #{student.roll_number || 'N/A'} {student.father_name ? ` | ${student.father_name}` : ''}</p>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <motion.button whileTap={{ scale: 0.95 }}
                          onClick={() => updateStatus(student.id, 'Present')}
                          disabled={isLocked}
                          className={`large-action-pill ${status === 'Present' ? 'active-p' : ''}`}
                          style={{ padding: '6px', minWidth: '36px', borderRadius: '8px', flex: '0 0 auto', fontSize: '12px' }}
                        >P</motion.button>
                        <motion.button whileTap={{ scale: 0.95 }}
                          onClick={() => updateStatus(student.id, 'Absent')}
                          disabled={isLocked}
                          className={`large-action-pill ${status === 'Absent' ? 'active-a' : ''}`}
                          style={{ padding: '6px', minWidth: '36px', borderRadius: '8px', flex: '0 0 auto', fontSize: '12px' }}
                        >A</motion.button>
                        <motion.button whileTap={{ scale: 0.95 }}
                          onClick={() => updateStatus(student.id, 'Leave')}
                          disabled={isLocked}
                          className={`large-action-pill ${status === 'Leave' ? 'active-l' : ''}`}
                          style={{ padding: '6px', minWidth: '36px', borderRadius: '8px', flex: '0 0 auto', fontSize: '12px' }}
                        >L</motion.button>
                      </div>
                    </motion.div>
                  );
                })}
                </AnimatePresence>
              </div>
            </>
          ) : (

            <div className="empty-state" style={{ padding: '40px 20px', textAlign: 'center' }}>
              <UserX size={48} color="#CBD5E1" style={{ marginBottom: '16px' }} />
              <h3 style={{ margin: '0 0 8px 0', color: '#1E293B' }}>No students found</h3>
              <p style={{ margin: 0, color: '#64748B' }}>Try adjusting your filters or search query.</p>
            </div>
          )}

          {students.length > 0 && (
            <div style={{ position: 'fixed', bottom: '56px', left: 0, right: 0, borderRadius: '16px 16px 0 0', padding: '10px 12px', background: 'white', borderTop: '1px solid #F1F5F9', boxShadow: '0 -4px 12px rgba(0,0,0,0.05)', display: 'flex', gap: '8px', zIndex: 40, alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '6px', flex: 1 }}>
                <button 
                  onClick={handleBack} 
                  disabled={currentIndex <= 0}
                  className="premium-btn"
                  style={{ flex: 1, backgroundColor: '#F1F5F9', color: currentIndex <= 0 ? '#94A3B8' : '#334155', border: 'none', padding: '10px 4px', fontSize: '13px', fontWeight: 600, cursor: currentIndex <= 0 ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
                >
                  Back
                </button>
                <button 
                  onClick={handleNext} 
                  disabled={currentIndex === -1 || currentIndex >= filteredDuties.length - 1}
                  className="premium-btn"
                  style={{ flex: 1, backgroundColor: '#F1F5F9', color: (currentIndex === -1 || currentIndex >= filteredDuties.length - 1) ? '#94A3B8' : '#334155', border: 'none', padding: '10px 4px', fontSize: '13px', fontWeight: 600, cursor: (currentIndex === -1 || currentIndex >= filteredDuties.length - 1) ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
                >
                  Next {(currentIndex !== -1 && currentIndex < filteredDuties.length - 1) ? `(${filteredDuties.length - 1 - currentIndex})` : ''}
                </button>
              </div>
              <div style={{ display: 'flex', flex: 1.2, justifyContent: 'flex-end' }}>
                {isLocked ? (
                  <button disabled style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', padding: '10px 8px', borderRadius: '10px', fontSize: '13px', fontWeight: 700, backgroundColor: '#94A3B8', color: 'white', border: 'none', cursor: 'not-allowed', whiteSpace: 'nowrap' }}>
                    <CheckCircle2 size={16} />
                    Published
                  </button>
                ) : (
                  <button className="premium-btn" onClick={() => handleSave(true)} disabled={isSaving} style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', padding: '10px 8px', borderRadius: '10px', fontSize: '13px', fontWeight: 700, backgroundColor: 'var(--tp-primary, #2563EB)', color: 'white', border: 'none', boxShadow: 'var(--tp-shadow-soft)', whiteSpace: 'nowrap' }}>
                    <CheckCircle2 size={16} />
                    Publish & Notify
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
        ) : (
          <div className="empty-state card">
            <AlertTriangle size={48} color="#DC2626" style={{ marginBottom: '16px' }} />
            <h3>You are not assigned to this class and section combination.</h3>
          </div>
        )
      ) : null}

      {remarkStudent && (
        <RemarkModal 
          isOpen={!!remarkStudent}
          onClose={() => setRemarkStudent(null)}
          studentId={remarkStudent.id}
          studentName={remarkStudent.name}
          context="Attendance"
        />
      )}
    </div>
  );
};

export default TakeAttendance;
