'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { CheckCircle, Clock, BookOpen } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export const AdminResults: React.FC = () => {
  const [results, setResults] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [exams, setExams] = useState<any[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusMsg, setStatusMsg] = useState<{type: 'success'|'error'|null, message: string}>({type: null, message: ''});
  
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [editedRecords, setEditedRecords] = useState<any[]>([]);

  const [filters, setFilters] = useState({
    class_name: '',
    section: ''
  });

  const [activeTab, setActiveTab] = useState<'Pending' | 'Submitted'>('Pending');

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      fetchData(true);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async (background = false) => {
    if (!background) setIsLoading(true);
    try {
      const [resData, stuData, tchData, setData, examData] = await Promise.all([
        supabase.from('results').select('*').then(r => r.data || []),
        supabase.from('students').select('*').then(r => r.data || []),
        supabase.from('staff').select('*').then(r => r.data || []),
        supabase.from('settings').select('*').eq('key', 'app_settings').single().then(r => r.data?.value || null),
        supabase.from('exams').select('*').then(r => r.data || [])
      ]);
      setResults(resData);
      setStudents(stuData.filter((s:any) => s.status !== 'Struck Off'));
      setTeachers(tchData.filter((t:any) => t.role === 'Teacher'));
      setSettings(setData);
      setExams(examData);
    } catch(err) {
      console.error(err);
    } finally {
      if (!background) setIsLoading(false);
    }
  };

  const combos = useMemo(() => {
    const pendingList: any[] = [];
    const submittedList: any[] = [];
    const processedSubmissions = new Set();

    exams.forEach(exam => {
      if (exam.class_rules) {
        Object.keys(exam.class_rules).forEach(className => {
          const rule = exam.class_rules[className];
          if (rule && rule.sections) {
            rule.sections.forEach((section: string) => {
              if (rule.subject_schedules) {
                Object.keys(rule.subject_schedules).forEach(subjectName => {
                  const sched = rule.subject_schedules[subjectName];
                  
                  // Filter by Class and Section dropdowns
                  if (filters.class_name && className !== filters.class_name) return;
                  if (filters.section && section !== filters.section) return;

                  // Search filter
                  const searchStr = `${exam.title} ${className} ${section} ${subjectName}`.toLowerCase();
                  if (searchTerm && !searchStr.includes(searchTerm.toLowerCase())) return;

                  const submission = results.find(r => r.exam_term === exam.title && r.class_name === className && r.section === section && r.subject === subjectName);
                  
                  const examinerId = sched.section_teachers?.[section] || null;
                  const examDate = sched.date || 'Not Scheduled';
                  
                  const teacherName = submission && submission.teacher_id 
                    ? (teachers.find(t => t.id === submission.teacher_id)?.name || 'Unknown Teacher') 
                    : (examinerId ? (teachers.find(t => t.id === examinerId)?.name || 'Unassigned') : 'Unassigned');

                  const unifiedRecord = {
                    exam_term: exam.title,
                    class_name: className,
                    section: section,
                    subject: subjectName,
                    exam_date: examDate,
                    teacher_name: teacherName,
                    status: submission ? submission.status : 'Pending',
                    result_record: submission || null,
                    total_marks: sched.total_marks || 100
                  };

                  if (submission) {
                    submittedList.push(unifiedRecord);
                    processedSubmissions.add(submission.id);
                  } else {
                    pendingList.push(unifiedRecord);
                  }
                });
              }
            });
          }
        });
      }
    });

    // Add any submitted results that weren't part of the formal schedule
    results.forEach(submission => {
      if (!processedSubmissions.has(submission.id)) {
        if (filters.class_name && submission.class_name !== filters.class_name) return;
        if (filters.section && submission.section !== filters.section) return;
        
        const searchStr = `${submission.exam_term} ${submission.class_name} ${submission.section} ${submission.subject}`.toLowerCase();
        if (searchTerm && !searchStr.includes(searchTerm.toLowerCase())) return;

        const teacherName = submission.teacher_id ? (teachers.find(t => t.id === submission.teacher_id)?.name || 'Unknown Teacher') : 'Unassigned';

        submittedList.push({
          exam_term: submission.exam_term,
          class_name: submission.class_name,
          section: submission.section,
          subject: submission.subject,
          exam_date: 'Not Scheduled',
          teacher_name: teacherName,
          status: submission.status,
          result_record: submission,
          total_marks: 100 // fallback
        });
      }
    });

    submittedList.sort((a, b) => {
      const rankA = a.status === 'Published' ? 2 : 1;
      const rankB = b.status === 'Published' ? 2 : 1;
      if (rankA !== rankB) return rankA - rankB;
      return a.class_name.localeCompare(b.class_name);
    });

    pendingList.sort((a, b) => a.exam_term.localeCompare(b.exam_term) || a.class_name.localeCompare(b.class_name));

    return { 
      pendingList,
      submittedList,
      pendingCount: pendingList.length,
      submittedCount: submittedList.length
    };
  }, [exams, results, filters.class_name, filters.section, searchTerm, teachers]);

  const openRecord = (record: any) => {
    setSelectedRecord(record);
    
    // Map records to include student details (Name, Roll No)
    const mappedRecords = record.records.map((r: any) => {
      const student = students.find(s => s.id === r.student_id);
      return {
        ...r,
        student_name: student ? student.name : 'Unknown Student',
        roll_number: student ? student.roll_number : r.student_id.split('-')[0]
      };
    });
    
    // Sort by roll number if possible
    mappedRecords.sort((a: any, b: any) => {
      const numA = parseInt(a.roll_number) || 0;
      const numB = parseInt(b.roll_number) || 0;
      return numA - numB;
    });

    setEditedRecords(mappedRecords);
  };

  const handleMarkChange = (studentId: string, value: string) => {
    const obtained_marks = value === '' ? 0 : parseFloat(value);
    setEditedRecords(prev => prev.map(r => r.student_id === studentId ? { ...r, obtained_marks } : r));
  };

  const saveEditsAndPublish = async () => {
    setIsActionLoading(true);
    try {
      const submitPayload = {
        exam_term: selectedRecord.exam_term,
        class_name: selectedRecord.class_name,
        section: selectedRecord.section,
        subject: selectedRecord.subject,
        total_marks: selectedRecord.total_marks,
        teacher_id: selectedRecord.teacher_id,
        status: 'Published',
        records: editedRecords.map(r => ({ student_id: r.student_id, obtained_marks: r.obtained_marks }))
      };

      if (selectedRecord.id) {
        const { error } = await supabase.from('results').update(submitPayload).eq('id', selectedRecord.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('results').insert(submitPayload);
        if (error) throw error;
      }
      
      setStatusMsg({type: 'success', message: 'Result published successfully!'});
      setTimeout(() => setStatusMsg({type: null, message: ''}), 3000);
      setSelectedRecord(null);
      fetchData(true);
    } catch(err: any) {
      setStatusMsg({type: 'error', message: err.message});
    } finally {
      setIsActionLoading(false);
    }
  };
  
  const rejectToDraft = async () => {
    setIsActionLoading(true);
    try {
      const { error } = await supabase.from('results').update({ status: 'Draft' }).eq('id', selectedRecord.id);
      if (error) throw error;
      
      setStatusMsg({type: 'success', message: 'Result rejected back to Teacher.'});
      setTimeout(() => setStatusMsg({type: null, message: ''}), 3000);
      setSelectedRecord(null);
      fetchData(true);
    } catch(err: any) {
      setStatusMsg({type: 'error', message: err.message});
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div className="page-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', color: 'var(--color-primary)', margin: '0 0 8px 0' }}>Results Approval</h1>
          <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>Review teacher-submitted results, edit marks, and publish.</p>
        </div>
      </div>

      {statusMsg.type && (
        <div className={`toast ${statusMsg.type}`} style={{ position: 'relative', top: 0, left: 0, right: 0, transform: 'none', margin: '0 0 24px 0' }}>
          {statusMsg.message}
        </div>
      )}

      {/* Class, Section Filters */}
      <div className="card" style={{ marginBottom: '24px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Search</label>
          <input 
            type="text" 
            className="input-field" 
            placeholder="Search subject, class..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
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
          onClick={() => { setFilters({ class_name: '', section: '' }); setSearchTerm(''); }}
          style={{ height: '38px' }}
        >
          Clear Filters
        </button>
      </div>

      {/* Pending vs Submitted Tracker (Act as Tabs) */}
      <div style={{ display: 'flex', gap: '24px', marginBottom: '24px' }}>
        <div style={{ flex: 1 }}>
          <div 
            className="card hover-effect" 
            style={{ display: 'flex', alignItems: 'center', gap: '16px', borderLeft: activeTab === 'Pending' ? '4px solid #F59E0B' : '4px solid transparent', cursor: 'pointer', backgroundColor: activeTab === 'Pending' ? 'var(--color-background)' : 'var(--color-surface)', boxShadow: activeTab === 'Pending' ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : '' }}
            onClick={() => setActiveTab('Pending')}
          >
            <div style={{ backgroundColor: '#FEF3C7', padding: '16px', borderRadius: '50%' }}>
              <Clock size={24} color="#D97706" />
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginBottom: '4px' }}>Pending Results</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>{combos.pendingCount}</div>
              {combos.pendingList.length > 0 && (
                <div style={{ fontSize: '0.8rem', color: 'var(--color-warning)', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={Array.from(new Set(combos.pendingList.map((r:any) => r.teacher_name).filter(Boolean))).join(', ')}>
                  Teachers pending: {Array.from(new Set(combos.pendingList.map((r:any) => r.teacher_name).filter(Boolean))).join(', ')}
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <div 
            className="card hover-effect" 
            style={{ display: 'flex', alignItems: 'center', gap: '16px', borderLeft: activeTab === 'Submitted' ? '4px solid #10B981' : '4px solid transparent', cursor: 'pointer', backgroundColor: activeTab === 'Submitted' ? 'var(--color-background)' : 'var(--color-surface)', boxShadow: activeTab === 'Submitted' ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : '' }}
            onClick={() => setActiveTab('Submitted')}
          >
            <div style={{ backgroundColor: '#D1FAE5', padding: '16px', borderRadius: '50%' }}>
              <CheckCircle size={24} color="#059669" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginBottom: '4px' }}>Submitted Results</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>{combos.submittedCount}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="admin-split-layout">
        <div className="admin-split-left" style={{ flex: 1.3 }}>
          {isLoading ? (
            <div className="card">Loading results...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, overflowY: 'auto' }}>
              
              {/* PENDING VIEW */}
              {activeTab === 'Pending' && combos.pendingList.length === 0 && (
                <div className="empty-state card">No pending results found.</div>
              )}
              {activeTab === 'Pending' && combos.pendingList.length > 0 && (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ maxHeight: '600px', overflowY: 'auto', overflowX: 'auto' }}>
                    <table className="data-table" style={{ margin: 0, minWidth: '600px', width: '100%', fontSize: '13px' }}>
                      <thead>
                        <tr>
                          <th style={{ padding: '8px 12px' }}>Exam</th>
                          <th style={{ padding: '8px 12px' }}>Subject</th>
                          <th style={{ padding: '8px 12px' }}>Class/Sec</th>
                          <th style={{ padding: '8px 12px' }}>Date</th>
                          <th style={{ padding: '8px 12px' }}>Examiner</th>
                        </tr>
                      </thead>
                      <tbody>
                        {combos.pendingList.map((r: any, idx: number) => (
                          <tr key={idx}>
                            <td style={{ padding: '8px 12px' }}>{r.exam_term}</td>
                            <td style={{ padding: '8px 12px', fontWeight: 500 }}>{r.subject}</td>
                            <td style={{ padding: '8px 12px' }}>{r.class_name} {r.section}</td>
                            <td style={{ padding: '8px 12px' }}>{r.exam_date}</td>
                            <td style={{ padding: '8px 12px' }}>{r.teacher_name}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* SUBMITTED VIEW */}
              {activeTab === 'Submitted' && combos.submittedList.length === 0 && (
                <div className="empty-state card">No submitted results found.</div>
              )}
              {activeTab === 'Submitted' && combos.submittedList.length > 0 && (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ maxHeight: '600px', overflowY: 'auto', overflowX: 'auto' }}>
                    <table className="data-table" style={{ margin: 0, minWidth: '600px', width: '100%', fontSize: '13px' }}>
                      <thead>
                        <tr>
                          <th style={{ padding: '8px 12px' }}>Exam</th>
                          <th style={{ padding: '8px 12px' }}>Subject</th>
                          <th style={{ padding: '8px 12px' }}>Class/Sec</th>
                          <th style={{ padding: '8px 12px' }}>Examiner Name</th>
                          <th style={{ padding: '8px 12px' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {combos.submittedList.map((r: any, idx: number) => {
                          const isSelected = selectedRecord?.id === r.result_record?.id;
                          
                          return (
                            <tr key={idx} style={{ backgroundColor: isSelected ? 'var(--color-selected-row)' : 'transparent', cursor: 'pointer' }} onClick={() => { if (r.result_record) openRecord(r.result_record); }}>
                              <td style={{ padding: '8px 12px' }}>{r.exam_term}</td>
                              <td style={{ padding: '8px 12px', fontWeight: 500 }}>{r.subject}</td>
                              <td style={{ padding: '8px 12px' }}>{r.class_name} {r.section}</td>
                              <td style={{ padding: '8px 12px' }}>{r.teacher_name}</td>
                              <td style={{ padding: '8px 12px' }}>
                                <span className={`badge ${r.status === 'Published' ? 'badge-success' : 'badge-warning'}`} style={{ cursor: 'pointer', opacity: 0.9 }}>
                                  {r.status === 'Published' ? 'Approved' : 'Not Approved'}
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

            </div>
          )}
        </div>

        {/* ADMIN SPLIT RIGHT - DETAILED VIEW */}
        <div className="admin-split-right" style={{ flex: 1 }}>
          {selectedRecord ? (
            <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ padding: '20px', borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>{selectedRecord.subject} Result - {selectedRecord.class_name} ({selectedRecord.section})</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                      Total Marks: {selectedRecord.total_marks}
                    </p>
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                      Exam: {selectedRecord.exam_term}
                    </p>
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
                        Approve & Publish
                      </button>
                    </>
                  )}
                  {selectedRecord.status === 'Published' && (
                    <span className="badge badge-success">Already Published</span>
                  )}
                </div>
              </div>

              <div style={{ flex: 1, maxHeight: '600px', overflowY: 'auto', overflowX: 'auto' }}>
                <table className="data-table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th>Roll #</th>
                      <th>Student Name</th>
                      <th>Obtained Marks</th>
                      <th>Percentage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editedRecords.map((r: any) => {
                      const percentage = selectedRecord.total_marks > 0 
                        ? ((r.obtained_marks / selectedRecord.total_marks) * 100).toFixed(1) 
                        : 0;

                      return (
                        <tr key={r.student_id}>
                          <td>{r.roll_number}</td>
                          <td style={{ fontWeight: 500 }}>{r.student_name}</td>
                          <td>
                            {selectedRecord.status === 'Published' ? (
                              <span style={{ fontWeight: 600 }}>{r.obtained_marks}</span>
                            ) : (
                              <input 
                                type="number" 
                                className="input-field" 
                                style={{ width: '100px', margin: 0 }}
                                value={r.obtained_marks}
                                onChange={e => handleMarkChange(r.student_id, e.target.value)}
                                max={selectedRecord.total_marks}
                                min={0}
                              />
                            )}
                          </td>
                          <td>
                            <span className={`badge ${parseFloat(percentage as string) >= 50 ? 'badge-success' : 'badge-error'}`}>
                              {percentage}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="card empty-state" style={{ height: '100%', minHeight: '300px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <BookOpen size={48} color="var(--color-border)" style={{ marginBottom: '16px' }} />
              <h3>Select a Result Record</h3>
              <p style={{ color: 'var(--color-text-secondary)' }}>Click on a submitted result to review marks, make edits, and publish.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminResults;
