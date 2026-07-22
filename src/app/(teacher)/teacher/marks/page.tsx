'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Calendar, CheckCircle2, ChevronLeft, Search, ChevronRight, UserX, BookOpen, MessageSquare, Clock, Users, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { RemarkModal } from '@/components/RemarkModal';
import { supabase } from '@/lib/supabase';
import '@/app/teacherportal/TeacherPortal.css';

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  if (!year || !month || !day) return dateStr;
  return `${day}/${month}/${year}`;
};

export const TeacherMarksEntry: React.FC = () => {
  const { user } = useAuth();
  
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedExamId, setSelectedExamId] = useState('');
  const [selectedExamTitle, setSelectedExamTitle] = useState('');
  const [selectedTotalMarks, setSelectedTotalMarks] = useState(100);
  const [selectedPassingMarks, setSelectedPassingMarks] = useState(40);
  
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [dutyFilterClass, setDutyFilterClass] = useState('');
  const [dutyFilterSection, setDutyFilterSection] = useState('');
  
  const [students, setStudents] = useState<any[]>([]);
  const [marksData, setMarksData] = useState<Record<string, { marks: string, remarks: string }>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{type: 'success'|'error'|null, message: string}>({type: null, message: ''});
  const [remarkStudent, setRemarkStudent] = useState<{id: string, name: string} | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Submitted' | 'Pending'>('All');
  const [studentFilter, setStudentFilter] = useState<'All' | 'Pass' | 'Fail'>('All');

  const [duties, setDuties] = useState<any[]>([]);

  useEffect(() => {
    if (user?.role === 'Teacher' && user.email) {
      const getDuties = async () => {
        const staffRes = await supabase.from('staff').select('id').eq('username', user.email).maybeSingle();
        const staffId = staffRes.data?.id || user.id;

        const { data: examsData } = await supabase.from('exams').select('*');
        if (!examsData) return;
        
        const teacherDuties: any[] = [];
        examsData.forEach(exam => {
          if (exam.class_rules) {
            Object.keys(exam.class_rules).forEach(className => {
              const rule = exam.class_rules[className];
              if (rule && rule.sections) {
                rule.sections.forEach((section: string) => {
                  if (rule.subject_schedules) {
                    Object.keys(rule.subject_schedules).forEach(subject => {
                      const sched = rule.subject_schedules[subject];
                      if (sched.section_teachers && sched.section_teachers[section] === staffId) {
                        teacherDuties.push({
                          exam_id: exam.id,
                          exam_title: exam.title,
                          exam_type: exam.type,
                          class_name: className,
                          section: section,
                          subject: subject,
                          date: sched.date || '',
                          total_marks: sched.total_marks || 100,
                          passing_marks: sched.passing_marks || 40,
                        });
                      }
                    });
                  }
                });
              }
            });
          }
        });
        
        setDuties(teacherDuties);
      };
      
      getDuties();
    }
  }, [user]);

  useEffect(() => {
    if (selectedClass && selectedSection && selectedExamId) {
      setIsLoading(true);
      const loadStudents = async () => {
        const { data } = await supabase.from('students').select('*')
          .eq('academic_class', selectedClass)
          .eq('section', selectedSection)
          .neq('status', 'Struck Off');
          
        if (data) {
          setStudents(data);
          const initData: any = {};
          data.forEach((s: any) => {
            initData[s.id] = { marks: '', remarks: '' };
          });
          
          const { data: resData } = await supabase.from('results').select('*')
            .eq('exam_term', selectedExamTitle)
            .eq('class_name', selectedClass)
            .eq('section', selectedSection)
            .eq('subject', selectedSubject)
            .maybeSingle();
            
          if (resData && resData.records) {
            resData.records.forEach((r: any) => {
              if (initData[r.student_id]) {
                initData[r.student_id].marks = r.obtained_marks;
              }
            });
          }
          setMarksData(initData);
        }
        setIsLoading(false);
      };
      
      loadStudents();
    } else {
      setStudents([]);
      setMarksData({});
    }
  }, [selectedClass, selectedSection, selectedExamId, selectedExamTitle, selectedSubject]);

  const handleMarkChange = (studentId: string, field: 'marks' | 'remarks', value: string) => {
    setMarksData(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value
      }
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setStatusMsg({type: null, message: ''});
    try {
      const recordsToSave = Object.keys(marksData).map(studentId => ({
        student_id: studentId,
        obtained_marks: marksData[studentId].marks ? Number(marksData[studentId].marks) : 0
      }));
      
      const staffRes = await supabase.from('staff').select('id').eq('username', user?.email).maybeSingle();
      const staffId = staffRes.data?.id || user?.id;

      const payload = {
        exam_term: selectedExamTitle,
        class_name: selectedClass,
        section: selectedSection,
        subject: selectedSubject,
        total_marks: selectedTotalMarks,
        teacher_id: staffId,
        status: 'Submitted',
        records: recordsToSave
      };

      const { data: existing } = await supabase.from('results').select('id')
        .eq('exam_term', selectedExamTitle)
        .eq('class_name', selectedClass)
        .eq('section', selectedSection)
        .eq('subject', selectedSubject)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase.from('results').update(payload).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('results').insert(payload);
        if (error) throw error;
      }

      setStatusMsg({type: 'success', message: 'Marks submitted successfully to Admin!'});
      setTimeout(() => {
        setStatusMsg({type: null, message: ''});
        setSelectedClass('');
        setSelectedSection('');
        setSelectedExamId('');
      }, 2000);
    } catch(err: any) {
      setStatusMsg({type: 'error', message: err.message});
    } finally {
      setIsSaving(false);
    }
  };

  const baseFilteredDuties = duties.filter(d => {
    const searchLower = searchQuery.toLowerCase();
    const matchSearch = (d.class_name + ' ' + d.section + ' ' + (d.subject || '') + ' ' + d.exam_title).toLowerCase().includes(searchLower);
    const matchClass = dutyFilterClass ? d.class_name === dutyFilterClass : true;
    const matchSection = dutyFilterSection ? d.section === dutyFilterSection : true;
    const matchDate = d.date === selectedDate;
    return matchSearch && matchClass && matchSection && matchDate;
  });

  const totalExams = baseFilteredDuties.length;
  const submittedCount = 0; 
  const pendingCount = totalExams;

  const filteredDuties = baseFilteredDuties.filter(() => {
    if (statusFilter === 'Submitted') return false;
    if (statusFilter === 'Pending') return true;
    return true; 
  });

  const currentIndex = filteredDuties.findIndex(d => {
    return d.class_name === selectedClass && d.section === selectedSection && d.exam_id === selectedExamId;
  });

  const handleNext = () => {
    if (currentIndex < filteredDuties.length - 1) {
      const nextDuty = filteredDuties[currentIndex + 1];
      setSelectedClass(nextDuty.class_name);
      setSelectedSection(nextDuty.section);
      setSelectedSubject(nextDuty.subject || '');
      setSelectedExamId(nextDuty.exam_id);
      setSelectedExamTitle(nextDuty.exam_title);
      setSelectedTotalMarks(nextDuty.total_marks || 100);
      setSelectedPassingMarks(nextDuty.passing_marks || 40);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      const prevDuty = filteredDuties[currentIndex - 1];
      setSelectedClass(prevDuty.class_name);
      setSelectedSection(prevDuty.section);
      setSelectedSubject(prevDuty.subject || '');
      setSelectedExamId(prevDuty.exam_id);
      setSelectedExamTitle(prevDuty.exam_title);
      setSelectedTotalMarks(prevDuty.total_marks || 100);
      setSelectedPassingMarks(prevDuty.passing_marks || 40);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="teacher-page">
      {(!selectedClass || !selectedSection || !selectedExamId) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div style={{ display: 'flex', flexWrap: 'nowrap', gap: '6px', alignItems: 'center', width: '100%', paddingBottom: '4px' }}>
            <div className="control-group" style={{ flex: '1.2', minWidth: '115px', position: 'relative' }}>
              <Calendar size={14} style={{ position: 'absolute', left: '6px', top: '50%', transform: 'translateY(-50%)', color: '#8B5CF6', pointerEvents: 'none' }} />
              <input 
                type="date" 
                className="input-field premium-input" 
                style={{ margin: 0, padding: '8px 2px 8px 24px', fontSize: '11px', width: '100%', fontWeight: 'bold', color: 'black' }}
                value={selectedDate} 
                onChange={e => setSelectedDate(e.target.value)}
              />
            </div>
            
            <div style={{ flex: '1', minWidth: '80px', position: 'relative' }}>
              <BookOpen size={14} style={{ position: 'absolute', left: '6px', top: '50%', transform: 'translateY(-50%)', color: '#3B82F6', pointerEvents: 'none' }} />
              <select className="input-field premium-input" style={{ width: '100%', margin: 0, padding: '8px 16px 8px 24px', fontSize: '12px', fontWeight: 'bold', color: 'black' }} value={dutyFilterClass} onChange={e => setDutyFilterClass(e.target.value)}>
                <option value="">All Classes</option>
                {Array.from(new Set(duties.map(d => d.class_name))).map(c => (
                  <option key={c as string} value={c as string}>{c as string}</option>
                ))}
              </select>
            </div>

            <div style={{ flex: '1', minWidth: '80px', position: 'relative' }}>
              <Users size={14} style={{ position: 'absolute', left: '6px', top: '50%', transform: 'translateY(-50%)', color: '#F59E0B', pointerEvents: 'none' }} />
              <select className="input-field premium-input" style={{ width: '100%', margin: 0, padding: '8px 16px 8px 24px', fontSize: '12px', fontWeight: 'bold', color: 'black' }} value={dutyFilterSection} onChange={e => setDutyFilterSection(e.target.value)}>
                <option value="">All Sections</option>
                {Array.from(new Set(duties.map(d => d.section))).map(s => (
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
              <h3 style={{ fontSize: '16px', margin: 0 }}>{totalExams}</h3>
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

          <div style={{ marginBottom: '12px', position: 'relative' }}>
            <Search size={20} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
            <input 
              type="text" 
              placeholder="Search exams..."
              className="input-field premium-input"
              style={{ margin: 0, padding: '12px 16px 12px 48px', width: '100%', fontSize: '15px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ width: '100%' }}>
            {(() => {
              return filteredDuties.length > 0 ? (
              <motion.div layout className="teacher-cards-grid" style={{ display: 'grid', gap: '10px', gridTemplateColumns: '1fr' }}>
                <AnimatePresence>
                {filteredDuties.map((duty: any, idx: number) => {
                  return (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2, delay: idx * 0.05 }}
                    key={`${duty.exam_id}-${duty.class_name}-${duty.section}-${duty.subject || 'all'}`}
                    className="attendance-card-detailed"
                    style={{ padding: '12px', gap: '8px' }}
                    onClick={() => {
                      setSelectedClass(duty.class_name);
                      setSelectedSection(duty.section);
                      setSelectedSubject(duty.subject || '');
                      setSelectedExamId(duty.exam_id);
                      setSelectedExamTitle(duty.exam_title);
                      setSelectedTotalMarks(duty.total_marks || 100);
                      setSelectedPassingMarks(duty.passing_marks || 40);
                    }}
                  >
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap', marginBottom: '2px' }}>
                        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{duty.class_name} ({duty.section})</h3>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: 'white', backgroundColor: '#8B5CF6', padding: '2px 6px', borderRadius: '4px', whiteSpace: 'nowrap' }}>{duty.exam_type}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: '13px', color: '#334155', fontWeight: 600 }}>{duty.exam_title}</p>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                        <span style={{ fontSize: '11px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={11} /> {formatDate(duty.date)}</span>
                        {duty.subject && duty.subject !== 'All Subjects' && <span style={{ fontSize: '11px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px' }}><BookOpen size={11} /> {duty.subject}</span>}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                        <span style={{ fontSize: '11px', color: '#10B981', fontWeight: 600 }}>Total: {duty.total_marks}</span>
                        <span style={{ fontSize: '11px', color: '#F59E0B', fontWeight: 600 }}>Passing: {duty.passing_marks}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                      <span className={`status-badge status-pending`} style={{ padding: '2px 6px', fontSize: '10px' }}>Pending</span>
                      <ChevronRight size={18} color="#94A3B8" />
                    </div>
                  </motion.div>
                )})}
                </AnimatePresence>
              </motion.div>
              ) : (
                <div style={{ padding: '24px', backgroundColor: '#F8FAFC', borderRadius: '8px', color: 'var(--color-text-secondary)', textAlign: 'center', border: '1px dashed var(--color-border)' }}>
                  No assigned exams found for this date.
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

      {selectedClass && selectedSection && selectedExamId ? (
        <div className="attendance-container">
          <div className="attendance-bulk-actions" style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button 
                  onClick={() => { setSelectedClass(''); setSelectedSection(''); setSelectedSubject(''); setSelectedExamId(''); }}
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
                    {selectedClass} ({selectedSection}) {selectedSubject && selectedSubject !== 'All Subjects' && <span style={{ color: '#8B5CF6' }}>• {selectedSubject}</span>}
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748B' }}>
                    {selectedExamTitle} | Total: {selectedTotalMarks}
                  </p>
                </div>
              </div>
              <span className={`badge badge-warning`}>
                Pending
              </span>
            </div>
            
            <div style={{ display: 'flex', gap: '4px', width: '100%', paddingBottom: '4px' }}>
              {(() => {
                const total = students.length;
                let passCount = 0;
                let failCount = 0;
                students.forEach(s => {
                  const m = marksData[s.id]?.marks;
                  if (m && Number(m) >= selectedPassingMarks) passCount++;
                  else if (m && Number(m) < selectedPassingMarks) failCount++;
                });
                
                return (
                  <>
                    <motion.div whileTap={{ scale: 0.95 }} onClick={() => setStudentFilter('All')} style={{ padding: '6px 4px', borderRadius: '8px', backgroundColor: studentFilter === 'All' ? '#2563EB' : '#EFF6FF', color: studentFilter === 'All' ? 'white' : '#2563EB', fontWeight: 600, fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px', flex: '1', minWidth: '0' }}>
                      <Users size={12} color={studentFilter === 'All' ? 'white' : '#2563EB'} /> <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>All {total}</span>
                    </motion.div>
                    <motion.div whileTap={{ scale: 0.95 }} onClick={() => setStudentFilter('Pass')} style={{ padding: '6px 4px', borderRadius: '8px', backgroundColor: studentFilter === 'Pass' ? '#16A34A' : '#F0FDF4', color: studentFilter === 'Pass' ? 'white' : '#16A34A', fontWeight: 600, fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px', flex: '1', minWidth: '0' }}>
                      <CheckCircle2 size={12} color={studentFilter === 'Pass' ? 'white' : '#16A34A'} /> <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Pass {passCount}</span>
                    </motion.div>
                    <motion.div whileTap={{ scale: 0.95 }} onClick={() => setStudentFilter('Fail')} style={{ padding: '6px 4px', borderRadius: '8px', backgroundColor: studentFilter === 'Fail' ? '#EF4444' : '#FEF2F2', color: studentFilter === 'Fail' ? 'white' : '#EF4444', fontWeight: 600, fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px', flex: '1', minWidth: '0' }}>
                      <XCircle size={12} color={studentFilter === 'Fail' ? 'white' : '#EF4444'} /> <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Fail {failCount}</span>
                    </motion.div>
                  </>
                );
              })()}
            </div>
          </div>

          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="skeleton-box" style={{ height: '80px', width: '100%', borderRadius: '12px' }}></div>
              <div className="skeleton-box" style={{ height: '80px', width: '100%', borderRadius: '12px' }}></div>
              <div className="skeleton-box" style={{ height: '80px', width: '100%', borderRadius: '12px' }}></div>
            </div>
          ) : students.length > 0 ? (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '140px' }}>
                <AnimatePresence>
                {students.filter(s => {
                  const m = marksData[s.id]?.marks;
                  const isPass = m && Number(m) >= selectedPassingMarks;
                  const isFail = m && Number(m) < selectedPassingMarks;
                  if (studentFilter === 'Pass') return isPass;
                  if (studentFilter === 'Fail') return isFail;
                  return true;
                }).map((student) => {
                  const m = marksData[student.id]?.marks;
                  let percentage = 0;
                  let isPass = false;
                  if (m) {
                    percentage = (Number(m) / selectedTotalMarks) * 100;
                    isPass = Number(m) >= selectedPassingMarks;
                  }
                  
                  return (
                    <motion.div 
                      key={student.id} 
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      style={{ backgroundColor: '#FFFFFF', padding: '10px 12px', borderRadius: 'var(--tp-radius-md, 16px)', boxShadow: 'var(--tp-shadow-soft, 0 4px 12px rgba(0,0,0,0.05))', border: '1px solid #F1F5F9', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}
                    >
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <h4 style={{ margin: '0', fontSize: '14px', fontWeight: 600, color: '#1E293B', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{student.name}</h4>
                          <button onClick={() => setRemarkStudent({id: student.id, name: student.name})} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', display: 'flex', alignItems: 'center', padding: 0 }} title="Send Remark">
                            <MessageSquare size={14} />
                          </button>
                        </div>
                        <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#64748B' }}>Roll #{student.roll_number || 'N/A'}</p>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                        <input 
                          type="number" 
                          placeholder="Marks"
                          className="input-field premium-input"
                          style={{ margin: 0, padding: '6px 8px', width: '70px', textAlign: 'center', fontWeight: 'bold', fontSize: '13px' }}
                          value={marksData[student.id]?.marks || ''}
                          onChange={e => handleMarkChange(student.id, 'marks', e.target.value)}
                        />
                        {m && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B' }}>{percentage.toFixed(1)}%</span>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: 'white', backgroundColor: isPass ? '#10B981' : '#EF4444', padding: '2px 4px', borderRadius: '4px' }}>
                              {isPass ? 'PASS' : 'FAIL'}
                            </span>
                          </div>
                        )}
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
              <p style={{ margin: 0, color: '#64748B' }}>No students are enrolled in this class/section.</p>
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
                <button className="premium-btn" onClick={handleSave} disabled={isSaving} style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', padding: '10px 8px', borderRadius: '10px', fontSize: '13px', fontWeight: 700, backgroundColor: 'var(--tp-primary, #2563EB)', color: 'white', border: 'none', boxShadow: 'var(--tp-shadow-soft)', whiteSpace: 'nowrap' }}>
                  <CheckCircle2 size={16} />
                  Submit Marks
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {remarkStudent && (
        <RemarkModal 
          isOpen={!!remarkStudent}
          onClose={() => setRemarkStudent(null)}
          studentId={remarkStudent.id}
          studentName={remarkStudent.name}
          context="Marks"
          subject={selectedSubject}
        />
      )}
    </div>
  );
};

export default TeacherMarksEntry;
