'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, Clock, BookOpen, Users, Plus, Edit2, Trash2, Save, X, Check, Bell, ChevronLeft, Search, GraduationCap } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase, adminSupabase } from '@/lib/supabase';
import { triggerWebPush } from '@/lib/push';
import Image from 'next/image';
import { localDb } from '@/lib/db';
import { SyncEngine } from '@/lib/syncEngine';

const EXAM_TYPES = ['Weekly Test', 'Monthly Test', 'Class Quiz', 'Mid Term', 'Final Term', 'Oral', 'Routine Test'];

export const TeacherExams: React.FC = () => {
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [exams, setExams] = useState<any[]>([]);
  const [submittedExamIds, setSubmittedExamIds] = useState<Set<string>>(new Set());
  const [mySubjects, setMySubjects] = useState<any[]>([]);
  const [staffId, setStaffId] = useState<string>('');
  
  const [examTab, setExamTab] = useState<'All' | 'Pending' | 'Completed'>('All');
  const [isSwitchingTab, setIsSwitchingTab] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    type: EXAM_TYPES[0],
    class_name: '',
    section: '',
    subject: '',
    date: '',
    total_marks: 100,
    passing_marks: 40
  });

  // Marks Entry States
  const [activeView, setActiveView] = useState<'list' | 'marks'>('list');
  const [selectedExam, setSelectedExam] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [marksData, setMarksData] = useState<Record<string, { marks: number | string }>>({});
  const [marksTab, setMarksTab] = useState<'All' | 'Pass' | 'Fail'>('All');
  const [isSubmittingMarks, setIsSubmittingMarks] = useState(false);
  const [marksStatusMsg, setMarksStatusMsg] = useState<{type: 'success' | 'error' | null, message: string}>({type: null, message: ''});
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  useEffect(() => {
    if (user?.id) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const dbClient = adminSupabase || supabase;
      const staffRes = await dbClient.from('staff').select('id').ilike('username', user?.email ?? '').maybeSingle();
      
      if (!staffRes.data) {
        setLoading(false);
        return;
      }
      
      const sId = staffRes.data.id;
      setStaffId(sId);
      
      // Fetch timetable to get my classes/sections/subjects
      const { data: timetable } = await dbClient.from('timetable').select('*').eq('teacher_id', sId);
      if (timetable) {
        const uniqueSubjects: any[] = [];
        const seen = new Set();
        timetable.forEach(t => {
          const key = `${t.academic_class}|${t.section}|${t.subject}`;
          if (!seen.has(key)) {
            seen.add(key);
            uniqueSubjects.push({
              class_name: t.academic_class,
              section: t.section,
              subject: t.subject
            });
          }
        });
        setMySubjects(uniqueSubjects);
        if (uniqueSubjects.length > 0) {
          setFormData(prev => ({
            ...prev,
            class_name: uniqueSubjects[0].class_name,
            section: uniqueSubjects[0].section,
            subject: uniqueSubjects[0].subject
          }));
        }
      }
      
      const { data: allExams } = await dbClient.from('exams').select('*').order('created_at', { ascending: false });
      if (allExams) {
        const myExams = allExams.filter(exam => {
          let isMine = false;
          if (exam.class_rules) {
             Object.values(exam.class_rules).forEach((rule: any) => {
               if (rule.subject_schedules) {
                 Object.values(rule.subject_schedules).forEach((sched: any) => {
                   if (sched.section_teachers) {
                     Object.values(sched.section_teachers).forEach((tId: any) => {
                       if (tId === sId) isMine = true;
                     });
                   }
                 });
               }
             });
          }
          return isMine;
        });
        setExams(myExams);
      }
      
      const { data: myResults } = await dbClient.from('results').select('exam_id').eq('staff_id', sId);
      if (myResults) {
        setSubmittedExamIds(new Set(myResults.map(r => r.exam_id)));
      }
      
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const availableClasses = Array.from(new Set(mySubjects.map(s => s.class_name)));
  const availableSections = Array.from(new Set(mySubjects.filter(s => s.class_name === formData.class_name).map(s => s.section)));
  const availableSubjects = mySubjects.filter(s => s.class_name === formData.class_name && s.section === formData.section).map(s => s.subject);

  const handleClassChange = (cls: string) => {
    const sec = mySubjects.find(s => s.class_name === cls)?.section || '';
    const sub = mySubjects.find(s => s.class_name === cls && s.section === sec)?.subject || '';
    setFormData(prev => ({ ...prev, class_name: cls, section: sec, subject: sub }));
  };

  const handleSectionChange = (sec: string) => {
    const sub = mySubjects.find(s => s.class_name === formData.class_name && s.section === sec)?.subject || '';
    setFormData(prev => ({ ...prev, section: sec, subject: sub }));
  };

  const handleSaveExam = async () => {
    if (!formData.date || !formData.subject) return;
    setIsSaving(true);
    
    const autoTitle = `${formData.type} - ${formData.subject}`;
    
    try {
      const classRules = {
        [formData.class_name]: {
          sections: [formData.section],
          subject_schedules: {
            [formData.subject]: {
              date: formData.date,
              time: '09:00', // Default time
              duration: '1 Hour',
              total_marks: formData.total_marks,
              passing_marks: formData.passing_marks,
              use_uniform_teacher: false,
              section_teachers: {
                [formData.section]: staffId
              }
            }
          }
        }
      };
      
      if (editId) {
        await supabase.from('exams').update({
          title: autoTitle,
          type: formData.type,
          status: 'Active',
          class_rules: classRules
        }).eq('id', editId);
      } else {
        await supabase.from('exams').insert({
          title: autoTitle,
          type: formData.type,
          status: 'Active',
          class_rules: classRules
        });
      }
      
      if (!editId) {
        // Automatically send notification
        const { data: students } = await supabase.from('students')
          .select('id')
          .eq('academic_class', formData.class_name)
          .eq('section', formData.section);
          
        if (students && students.length > 0) {
          const msg = `An exam '${autoTitle}' for ${formData.subject} is scheduled on ${formData.date}. Total Marks: ${formData.total_marks}.`;
          const notifs = students.map(s => ({
            target_role: 'Guardian',
            sender_role: 'Teacher',
            title: `New Exam Scheduled: ${formData.subject}`,
            message: msg,
            category: 'Exams',
            student_id: s.id
          }));
          
          await supabase.from('notifications').insert(notifs);
          
          triggerWebPush({
            roles: ['Guardian'],
            title: `New Exam Scheduled: ${formData.subject}`,
            message: msg,
            url: '/guardian/guardianacademics',
            category: 'Exams'
          });
        }
      }
      
      setIsModalOpen(false);
      setEditId(null);
      loadData();
    } catch (err: any) {
      alert('Error saving exam: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (exam: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const className = Object.keys(exam.class_rules)[0];
    const rule = exam.class_rules[className];
    const section = rule.sections[0];
    const subject = Object.keys(rule.subject_schedules)[0];
    const sched = rule.subject_schedules[subject];
    
    setFormData({
      type: exam.type,
      class_name: className,
      section: section,
      subject: subject,
      date: sched.date,
      total_marks: sched.total_marks,
      passing_marks: sched.passing_marks
    });
    setEditId(exam.id);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this exam?')) {
      await supabase.from('exams').delete().eq('id', id);
      loadData();
    }
  };

  const openMarksEntry = async (exam: any) => {
    setSelectedExam(exam);
    setActiveView('marks');
    setLoading(true);
    setMarksStatusMsg({type: null, message: ''});
    
    try {
      const className = Object.keys(exam.class_rules)[0];
      const rule = exam.class_rules[className];
      const section = rule.sections[0];
      const subject = Object.keys(rule.subject_schedules)[0];
      
      let stdData: any[] = [];
      if (navigator.onLine) {
        const { data } = await supabase.from('students')
          .select('*')
          .eq('academic_class', className)
          .eq('section', section)
          .order('name');
        if (data) {
          stdData = data;
          await localDb.students.bulkPut(data.map((s: any) => ({
            id: s.id,
            name: s.name,
            roll_number: s.roll_number || s.roll_no || '',
            academic_class: s.academic_class,
            section: s.section,
            photo_url: s.photo_url
          })));
        }
      } else {
        stdData = await localDb.students
          .filter(s => s.academic_class === className && s.section === section)
          .toArray();
      }
        
      setStudents(stdData || []);
      
      const { data: resData } = await supabase.from('results').select('*')
        .eq('exam_id', exam.id)
        .eq('subject', subject);
        
      const initData: any = {};
      (stdData || []).forEach(s => {
        initData[s.id] = { marks: '' };
      });
      
      if (resData) {
        resData.forEach((r: any) => {
          if (initData[r.student_id]) {
            initData[r.student_id].marks = r.marks;
          }
        });
      }
      setMarksData(initData);
      
    } catch(err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitMarks = async () => {
    if (!selectedExam) return;
    setIsSubmittingMarks(true);
    setMarksStatusMsg({type: null, message: ''});

    const className = Object.keys(selectedExam.class_rules)[0];
    const rule = selectedExam.class_rules[className];
    const subject = Object.keys(rule.subject_schedules)[0];
    const sched = rule.subject_schedules[subject];

    try {
      const recordsToSave = Object.keys(marksData).map(studentId => ({
        student_id: studentId,
        exam_id: selectedExam.id,
        subject: subject,
        marks: marksData[studentId].marks !== '' ? Number(marksData[studentId].marks) : 0,
        total_marks: sched.total_marks,
        staff_id: staffId,
        is_submitted: true
      }));

      const studentIds = Object.keys(marksData);
      if (studentIds.length > 0) {
        if (navigator.onLine) {
          await supabase.from('results')
            .delete()
            .eq('exam_id', selectedExam.id)
            .eq('subject', subject)
            .in('student_id', studentIds);
            
          const { error } = await supabase.from('results').insert(recordsToSave);
          if (error) throw error;
          
          // Notify Parents
          const msg = `Results for ${selectedExam.title} have been published. Check the Academics tab!`;
          const notifs = studentIds.map(sId => ({
            target_role: 'Guardian',
            sender_role: 'Teacher',
            title: `Results Published: ${subject}`,
            message: msg,
            category: 'Academics',
            student_id: sId
          }));
          await supabase.from('notifications').insert(notifs);
          
          triggerWebPush({
            roles: ['Guardian'],
            title: `Results Published: ${subject}`,
            message: msg,
            url: '/guardian/guardianacademics',
            category: 'Academics'
          });
        } else {
          // Offline sync queue
          // Note: for offline deletion matching exactly the complex in() query, 
          // we might just queue the inserts which will override or fail if PK conflicts.
          // Or we can queue an update for each student.
          for (const data of recordsToSave) {
            await SyncEngine.queueAction('results', 'INSERT', data);
          }
        }
      }

      setMarksStatusMsg({type: 'success', message: navigator.onLine ? 'Marks submitted successfully!' : 'Offline: Marks saved locally and will sync later.'});
      // Mark the exam as Completed so it shifts from Pending → Completed tab
      try {
        await supabase.from('exams').update({ status: 'Completed' }).eq('id', selectedExam.id);
        setSubmittedExamIds(prev => new Set([...prev, selectedExam.id]));
      } catch (_) { /* silent — submitted marks are saved */ }
      setTimeout(() => {
        setActiveView('list');
      }, 1500);
    } catch(err: any) {
      setMarksStatusMsg({type: 'error', message: err.message});
    } finally {
      setIsSubmittingMarks(false);
      setShowSubmitConfirm(false);
    }
  };

  const updateStudentMark = (studentId: string, val: string) => {
    const className = Object.keys(selectedExam.class_rules)[0];
    const sched = selectedExam.class_rules[className].subject_schedules[Object.keys(selectedExam.class_rules[className].subject_schedules)[0]];
    const total = sched.total_marks;
    
    let numVal = Number(val);
    if (numVal < 0) numVal = 0;
    if (numVal > total) numVal = total;
    
    setMarksData(prev => ({
      ...prev,
      [studentId]: { marks: val === '' ? '' : numVal }
    }));
  };

  const filteredStudents = students.filter(s => {
    if (marksTab === 'All') return true;
    
    const markVal = marksData[s.id]?.marks;
    if (markVal === '' || markVal === undefined) return false;
    
    const className = Object.keys(selectedExam.class_rules)[0];
    const sched = selectedExam.class_rules[className].subject_schedules[Object.keys(selectedExam.class_rules[className].subject_schedules)[0]];
    const passing = sched.passing_marks;
    
    if (marksTab === 'Pass') return Number(markVal) >= passing;
    if (marksTab === 'Fail') return Number(markVal) < passing;
    
    return true;
  });

  if (loading) {
    return <div className="teacher-page"><div style={{ height: '200px', backgroundColor: '#F1F5F9', borderRadius: '16px', opacity: 0.6 }} /></div>;
  }

  if (activeView === 'marks' && selectedExam) {
    const className = Object.keys(selectedExam.class_rules)[0];
    const section = selectedExam.class_rules[className].sections[0];
    const subject = Object.keys(selectedExam.class_rules[className].subject_schedules)[0];
    const sched = selectedExam.class_rules[className].subject_schedules[subject];

    const passCount = students.filter(s => {
      const markVal = marksData[s.id]?.marks;
      return markVal !== '' && markVal !== undefined && Number(markVal) >= sched.passing_marks;
    }).length;
    
    const failCount = students.filter(s => {
      const markVal = marksData[s.id]?.marks;
      return markVal !== '' && markVal !== undefined && Number(markVal) < sched.passing_marks;
    }).length;

    const tabsData = [
      { id: 'All', label: `All (${students.length})` },
      { id: 'Pass', label: `Pass (${passCount})` },
      { id: 'Fail', label: `Fail (${failCount})` }
    ];

    return (
      <div className="teacher-page" style={{ padding: '16px 16px 100px 16px', backgroundColor: '#F8FAFC', minHeight: '100vh' }}>
        <button onClick={() => setActiveView('list')} style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '8px', color: '#64748B', fontWeight: 600, fontSize: '14px', cursor: 'pointer', padding: 0, marginBottom: '16px' }}>
          <ChevronLeft size={20} /> Back to Schedule
        </button>
        
        <div style={{ backgroundColor: '#FFF', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', marginBottom: '24px' }}>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: 700, color: '#1E293B' }}>{selectedExam.title}</h2>
          <div style={{ display: 'flex', gap: '16px', color: '#64748B', fontSize: '13px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><BookOpen size={14} /> Class {className}-{section}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Calendar size={14} /> {sched.date}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Check size={14} /> Total: {sched.total_marks}</span>
          </div>
        </div>

        {/* Status Message */}
        {marksStatusMsg.type && (
          <div style={{ padding: '12px 16px', borderRadius: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', fontWeight: 500, backgroundColor: marksStatusMsg.type === 'success' ? '#ECFDF5' : '#FEF2F2', color: marksStatusMsg.type === 'success' ? '#059669' : '#DC2626' }}>
            {marksStatusMsg.message}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', overflowX: 'auto', paddingBottom: '4px' }}>
          {tabsData.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setMarksTab(tab.id as any)}
              style={{
                flex: 1,
                padding: '10px 16px',
                borderRadius: '12px',
                border: 'none',
                backgroundColor: marksTab === tab.id ? '#2563EB' : '#FFF',
                color: marksTab === tab.id ? '#FFF' : '#64748B',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
                boxShadow: marksTab === tab.id ? '0 4px 12px rgba(37, 99, 235, 0.2)' : '0 1px 3px rgba(0,0,0,0.05)',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredStudents.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', backgroundColor: '#FFF', borderRadius: '16px' }}>
              <GraduationCap size={48} color="#94A3B8" style={{ margin: '0 auto 16px', opacity: 0.5 }} />
              <p style={{ color: '#64748B', margin: 0, fontWeight: 500 }}>No students found in this category.</p>
            </div>
          ) : (
            filteredStudents.map(student => {
              const mark = marksData[student.id]?.marks;
              const hasMark = mark !== '' && mark !== undefined;
              const isPassing = hasMark && Number(mark) >= sched.passing_marks;
              const progressColor = !hasMark ? '#94A3B8' : (isPassing ? '#16A34A' : '#DC2626');

              return (
                <div key={student.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', backgroundColor: '#FFF', borderRadius: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', borderLeft: `4px solid ${progressColor}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {student.photo_url ? (
                      <Image src={student.photo_url} alt={student.name} width={40} height={40} style={{ borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B', fontWeight: 600, fontSize: '16px' }}>
                        {student.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#1E293B' }}>{student.name}</h4>
                      <span style={{ fontSize: '12px', color: '#64748B' }}>Roll: {student.roll_number || student.roll_no || 'N/A'}</span>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                     <input 
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="--"
                      value={mark ?? ''}
                      onChange={e => {
                        const raw = e.target.value.replace(/[^0-9]/g, '');
                        updateStudentMark(student.id, raw);
                      }}
                      style={{ 
                        width: '70px', 
                        padding: '10px', 
                        borderRadius: '8px', 
                        border: `2px solid ${hasMark ? progressColor : '#CBD5E1'}`,
                        textAlign: 'center',
                        fontSize: '16px',
                        fontWeight: 700,
                        color: '#1E293B',
                        outline: 'none',
                        backgroundColor: '#F8FAFC',
                        transition: 'border-color 0.2s',
                        MozAppearance: 'textfield'
                      }}
                    />
                    {hasMark && (
                      <span style={{ fontSize: '11px', fontWeight: 700, color: progressColor }}>
                        {((Number(mark) / sched.total_marks) * 100).toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Submit Sticky Footer */}
        <div style={{
          position: 'fixed', bottom: '60px', left: 0, right: 0, padding: '12px', backgroundColor: '#FFF', boxShadow: '0 -4px 12px rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'center', zIndex: 40
        }}>
          <button 
            onClick={() => setShowSubmitConfirm(true)}
            disabled={isSubmittingMarks}
            style={{ width: '100%', maxWidth: '300px', padding: '12px', borderRadius: '10px', backgroundColor: '#10B981', color: '#FFF', border: 'none', fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: isSubmittingMarks ? 'not-allowed' : 'pointer', opacity: isSubmittingMarks ? 0.7 : 1, transition: 'all 0.2s ease', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)' }}
          >
            <Check size={20} /> Submit Marks
          </button>
        </div>

        {/* Submit Confirmation Modal */}
        {showSubmitConfirm && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(4px)' }}>
            <div style={{ backgroundColor: '#FFF', borderRadius: '24px', padding: '32px', maxWidth: '380px', width: '100%', boxShadow: '0 25px 50px rgba(0,0,0,0.15)', textAlign: 'center' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <Check size={32} color="#10B981" />
              </div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: 700, color: '#1E293B' }}>Submit Marks?</h3>
              <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: '#64748B', lineHeight: '1.6' }}>
                You are about to submit marks for <strong>{selectedExam?.title}</strong>. Once submitted, this exam will be marked as <strong>Completed</strong> and marks cannot be changed.
              </p>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setShowSubmitConfirm(false)}
                  style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', backgroundColor: '#F1F5F9', color: '#475569', fontWeight: 600, cursor: 'pointer', fontSize: '15px' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitMarks}
                  disabled={isSubmittingMarks}
                  style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', backgroundColor: '#10B981', color: '#FFF', fontWeight: 700, cursor: isSubmittingMarks ? 'not-allowed' : 'pointer', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: isSubmittingMarks ? 0.7 : 1 }}
                >
                  {isSubmittingMarks ? <div style={{ width: '18px', height: '18px', border: '3px solid #FFF', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> : <Check size={18} />}
                  {isSubmittingMarks ? 'Submitting...' : 'Yes, Submit'}
                </button>
              </div>
            </div>
          </div>
        )}

        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="teacher-page" style={{ paddingBottom: '80px', padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: 700, color: '#1E293B' }}>My Exams</h2>
          <p style={{ margin: 0, fontSize: '14px', color: '#64748B' }}>Schedule exams and enter marks</p>
        </div>
        <button 
          onClick={() => {
            setEditId(null);
            setFormData(prev => ({ ...prev, date: '' }));
            setIsModalOpen(true);
          }}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '12px', backgroundColor: '#2563EB', color: '#FFF', border: 'none', fontWeight: 600, fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)' }}
        >
          <Plus size={18} /> Schedule
        </button>
      </div>

      {mySubjects.length === 0 && (
        <div style={{ padding: '24px', backgroundColor: '#FEF2F2', borderRadius: '12px', color: '#991B1B', marginBottom: '24px' }}>
          You have no assigned classes in your timetable. Please contact Admin.
        </div>
      )}

      {/* Header Tabs */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', borderBottom: '1px solid #E2E8F0', paddingBottom: '12px' }}>
        {['All', 'Pending', 'Completed'].map(tab => {
          const isActive = examTab === tab;
          let count = exams.length;
          if (tab === 'Pending') count = exams.filter(e => !submittedExamIds.has(e.id)).length;
          if (tab === 'Completed') count = exams.filter(e => submittedExamIds.has(e.id)).length;

          return (
            <button
              key={tab}
              onClick={() => {
                if (examTab === tab) return;
                setIsSwitchingTab(true);
                setExamTab(tab as any);
                setTimeout(() => setIsSwitchingTab(false), 300);
              }}
              style={{
                background: isActive ? '#DBEAFE' : 'transparent',
                color: isActive ? '#1D4ED8' : '#64748B',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '100px',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {tab}
              <span style={{
                backgroundColor: isActive ? '#BFDBFE' : '#F1F5F9',
                color: isActive ? '#1D4ED8' : '#94A3B8',
                padding: '2px 8px',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: 700
              }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {isSwitchingTab ? (
          <div style={{ padding: '40px', display: 'flex', justifyContent: 'center' }}>
            <div className="dotted-spinner">
              <span></span><span></span><span></span>
            </div>
          </div>
        ) : (() => {
          const filteredExams = exams.filter(e => {
            if (examTab === 'Pending') return !submittedExamIds.has(e.id);
            if (examTab === 'Completed') return submittedExamIds.has(e.id);
            return true;
          });
          
          if (filteredExams.length === 0) {
            return (
              <div style={{ textAlign: 'center', padding: '40px', backgroundColor: '#FFF', borderRadius: '16px', border: '1px dashed #CBD5E1' }}>
                <Calendar size={48} color="#94A3B8" style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                <p style={{ color: '#64748B', fontWeight: 500 }}>No exams found.</p>
              </div>
            );
          }
          
          return filteredExams.map((exam) => {
            const className = Object.keys(exam.class_rules)[0];
            const rule = exam.class_rules[className];
            const section = rule.sections[0];
            const subject = Object.keys(rule.subject_schedules)[0];
            const sched = rule.subject_schedules[subject];
            
            return (
              <div 
                key={exam.id} 
                onClick={() => !submittedExamIds.has(exam.id) && openMarksEntry(exam)}
                style={{ backgroundColor: '#FFF', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: `4px solid ${submittedExamIds.has(exam.id) ? '#10B981' : '#3B82F6'}`, cursor: submittedExamIds.has(exam.id) ? 'default' : 'pointer', opacity: submittedExamIds.has(exam.id) ? 0.85 : 1, transition: 'transform 0.1s' }}
                onPointerDown={e => { if (!submittedExamIds.has(exam.id)) e.currentTarget.style.transform = 'scale(0.98)'; }}
                onPointerUp={e => e.currentTarget.style.transform = 'scale(1)'}
                onPointerLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1E293B' }}>{exam.title}</h3>
                    <span style={{ fontSize: '11px', fontWeight: 600, backgroundColor: submittedExamIds.has(exam.id) ? '#DCFCE7' : '#DBEAFE', color: submittedExamIds.has(exam.id) ? '#16A34A' : '#1D4ED8', padding: '4px 10px', borderRadius: '100px' }}>{exam.type}</span>
                    {submittedExamIds.has(exam.id) && (
                      <span style={{ fontSize: '11px', fontWeight: 600, backgroundColor: '#DCFCE7', color: '#15803D', padding: '4px 10px', borderRadius: '100px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Check size={10} /> Completed
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: '#64748B', fontSize: '13px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><BookOpen size={14} /> Class {className}-{section} ({subject})</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={14} /> {sched.date}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {submittedExamIds.has(exam.id) ? (
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#DCFCE7', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Marks submitted — locked">
                      <Check size={16} />
                    </div>
                  ) : (
                    <>
                      <button onClick={(e) => handleEdit(exam, e)} style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#F1F5F9', color: '#475569', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <Edit2 size={16} />
                      </button>
                      <button onClick={(e) => handleDelete(exam.id, e)} style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#FEF2F2', color: '#DC2626', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        })()}
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: '#FFF', borderRadius: '24px', width: '100%', maxWidth: '500px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h2 style={{ margin: '0 0 20px 0', fontSize: '20px', fontWeight: 700, color: '#1E293B' }}>
              {editId ? 'Edit Exam' : 'Schedule New Exam'}
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Class</label>
                  <select style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #CBD5E1', outline: 'none', backgroundColor: '#FFF' }} value={formData.class_name} onChange={e => handleClassChange(e.target.value)}>
                    {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Section</label>
                  <select style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #CBD5E1', outline: 'none', backgroundColor: '#FFF' }} value={formData.section} onChange={e => handleSectionChange(e.target.value)}>
                    {availableSections.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Subject</label>
                  <select style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #CBD5E1', outline: 'none', backgroundColor: '#FFF' }} value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})}>
                    {availableSubjects.map(sub => <option key={sub} value={sub}>{sub}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Exam Type</label>
                  <select style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #CBD5E1', outline: 'none', backgroundColor: '#FFF' }} value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                    {EXAM_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Date</label>
                <input type="date" style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #CBD5E1', outline: 'none' }} value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Total Marks</label>
                  <input type="number" style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #CBD5E1', outline: 'none' }} value={formData.total_marks} onChange={e => setFormData({...formData, total_marks: Number(e.target.value)})} />
                </div>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Passing Marks</label>
                  <input type="number" style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #CBD5E1', outline: 'none' }} value={formData.passing_marks} onChange={e => setFormData({...formData, passing_marks: Number(e.target.value)})} />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
              <button onClick={() => setIsModalOpen(false)} style={{ padding: '12px 20px', borderRadius: '12px', fontSize: '14px', fontWeight: 600, backgroundColor: '#F1F5F9', color: '#475569', border: 'none', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSaveExam} disabled={isSaving || !formData.date || !formData.subject} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '12px', fontSize: '14px', fontWeight: 600, backgroundColor: '#2563EB', color: '#FFFFFF', border: 'none', cursor: (isSaving || !formData.date || !formData.subject) ? 'not-allowed' : 'pointer', opacity: (isSaving || !formData.date || !formData.subject) ? 0.7 : 1 }}>
                {isSaving ? (
                  <div style={{ width: '16px', height: '16px', border: '2px solid #FFF', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                ) : <Save size={18} />}
                Ok
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes dot-pulse {
          0%, 100% { transform: scale(0.2); opacity: 0.2; }
          50% { transform: scale(1); opacity: 1; }
        }
        .dotted-spinner {
          display: flex; gap: 6px; justify-content: center; align-items: center;
        }
        .dotted-spinner span {
          width: 8px; height: 8px; border-radius: 50%; background-color: #2563EB;
          animation: dot-pulse 1s infinite;
        }
        .dotted-spinner span:nth-child(1) { animation-delay: 0s; }
        .dotted-spinner span:nth-child(2) { animation-delay: 0.2s; }
        .dotted-spinner span:nth-child(3) { animation-delay: 0.4s; }
      `}</style>
    </div>
  );
};

export default TeacherExams;
