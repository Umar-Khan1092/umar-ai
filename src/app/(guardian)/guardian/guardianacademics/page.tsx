'use client';

import React, { useState, useEffect } from 'react';
import { useGuardian } from '@/context/GuardianContext';
import { FileSpreadsheet, Calendar, Image as ImageIcon, Send, X, User, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { triggerWebPush } from '@/lib/push';
import { useSearchParams } from 'next/navigation';

export const GuardianAcademics: React.FC = () => {
  const { activeStudent } = useGuardian();
  const searchParams = useSearchParams();
  const [isInitialized, setIsInitialized] = useState(false);
  const [activeTab, setActiveTab] = useState<'attendance' | 'results' | 'timetable'>('attendance');

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'attendance' || tab === 'results' || tab === 'timetable') {
      setActiveTab(tab as any);
    }
    setIsInitialized(true);
  }, [searchParams]);

  const [results, setResults] = useState<any[]>([]);
  const [globalResults, setGlobalResults] = useState<any[]>([]);
  const [timetable, setTimetable] = useState<any[]>([]);
  const [examTypeFilter, setExamTypeFilter] = useState<string>('All');
  const [subjectFilter, setSubjectFilter] = useState<string>('All');
  const [dateFilterType, setDateFilterType] = useState<'Overall' | 'Month' | 'Custom'>('Overall');
  const [filterMonth, setFilterMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [attendance, setAttendance] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);

  // Send Remark Modal State
  const [isRemarkModalOpen, setIsRemarkModalOpen] = useState(false);
  const [remarkTarget, setRemarkTarget] = useState<{ teacher_id: string, teacher_name: string, subject: string } | null>(null);
  const [remarkMessage, setRemarkMessage] = useState('');
  const [isSendingRemark, setIsSendingRemark] = useState(false);

  useEffect(() => {
    if (activeStudent) {
      // Fetch results
      Promise.resolve(supabase.from('results').select('*, exams(id, title, type, created_at)').eq('student_id', activeStudent.id))
        .then(res => { if (res.data) setResults(res.data); })
        .catch((err: any) => console.error(err));
        
      // Fetch global generated results
      Promise.resolve(supabase.from('result_generation').select('*').eq('student_id', activeStudent.id))
        .then(res => { if (res.data) setGlobalResults(res.data); })
        .catch((err: any) => console.error(err));
        
      // Fetch timetable
      if (activeStudent.academic_class) {
        Promise.all([
          supabase.from('timetable').select('*').eq('academic_class', activeStudent.academic_class),
          supabase.from('staff').select('id, name')
        ]).then(([ttRes, staffRes]) => {
            const data = ttRes.data || [];
            const staff = staffRes.data || [];
            const mappedData = data.map((t: any) => ({
              ...t,
              class_name: t.academic_class,
              teacher_name: staff.find(s => s.id === t.teacher_id)?.name || 'Unknown'
            }));
            const sectionData = mappedData.filter((item: any) => !activeStudent.section || item.section === activeStudent.section);
            setTimetable(sectionData.length > 0 ? sectionData : mappedData);
          })
          .catch((err: any) => console.error(err));
      }

      // Fetch attendance - get published sessions that include this student
      Promise.resolve(supabase.from('student_attendance').select('*').eq('status', 'Published'))
        .then(res => {
          const data = res.data || [];
          // Extract student-specific records from sessions
          const studentRecords: any[] = [];
          data.forEach((session: any) => {
            const record = (session.records || []).find((r: any) => r.student_id === activeStudent.id);
            if (record) {
              studentRecords.push({ date: session.date, status: record.status, subject: session.subject });
            }
          });
          setAttendance(studentRecords.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        })
        .catch((err: any) => console.error(err));

      // Fetch settings for report card config
      Promise.resolve(supabase.from('settings').select('*').eq('key', 'app_settings').single())
        .then(res => { if (res.data?.value) setSettings(res.data.value); })
        .catch((err: any) => console.error(err));
    }
  }, [activeStudent]);

  if (!activeStudent) return <div>Please select a student first.</div>;

  const totalPresent = attendance.filter(a => a.status === 'Present').length;
  const totalAbsent = attendance.filter(a => a.status === 'Absent').length;
  const totalLeave = attendance.filter(a => a.status === 'Leave').length;
  const attendanceRate = attendance.length > 0 ? Math.round((totalPresent / attendance.length) * 100) : 0;

  const handleSendRemark = async () => {
    if (!remarkTarget || !remarkMessage.trim()) return;
    
    setIsSendingRemark(true);
    try {
      // 1. Send to Teacher
      await supabase.from('notifications').insert({
        recipient_id: remarkTarget.teacher_id,
        target_role: 'Teacher',
        sender_role: 'Guardian',
        title: `Remark from Parent of ${activeStudent.name}`,
        message: remarkMessage,
        category: 'Remarks',
        student_id: activeStudent.id,
        subject: remarkTarget.subject
      });

      // 2. Send to Admin
      await supabase.from('notifications').insert({
        target_role: 'Admin',
        sender_role: 'Guardian',
        title: `Remark from Parent of ${activeStudent.name}`,
        message: remarkMessage,
        category: 'Remarks',
        student_id: activeStudent.id,
        subject: remarkTarget.subject
      });

      triggerWebPush({
        userIds: ['staff_' + remarkTarget.teacher_id],
        roles: ['Admin'],
        title: `Remark from Parent of ${activeStudent.name}`,
        message: remarkMessage,
        url: '/admin-notices',
        category: 'Chat',
        metadata: {
          subject: remarkTarget.subject,
          className: activeStudent.academic_class,
          section: activeStudent.section,
          studentName: activeStudent.name
        }
      });

      setRemarkMessage('');
      setIsRemarkModalOpen(false);
      setRemarkTarget(null);
      alert('Remark sent successfully!');
    } catch (err: any) {
      console.error(err);
      alert('Failed to send remark. Please try again.');
    } finally {
      setIsSendingRemark(false);
    }
  };

  const calculateGrade = (percentage: number) => {
    if (percentage >= 94) return 'A+';
    if (percentage >= 85) return 'A';
    if (percentage >= 75) return 'B';
    if (percentage >= 65) return 'C';
    if (percentage >= 50) return 'D';
    return 'F';
  };

  const getFilteredAndGroupedResults = () => {
    // 1. Filter
    let filtered = results.filter(r => {
      const matchExam = examTypeFilter === 'All' || r.exams?.type === examTypeFilter;
      const matchSubject = subjectFilter === 'All' || r.subject === subjectFilter;
      const matchDate = () => {
        if (dateFilterType === 'Overall') return true;
        const examDate = new Date(r.exams?.created_at || r.created_at);
        
        if (dateFilterType === 'Month' && filterMonth) {
          const [year, month] = filterMonth.split('-');
          return examDate.getFullYear() === parseInt(year) && (examDate.getMonth() + 1) === parseInt(month);
        }
        
        if (dateFilterType === 'Custom') {
          if (filterStartDate) {
            const start = new Date(filterStartDate);
            start.setHours(0, 0, 0, 0);
            if (examDate < start) return false;
          }
          if (filterEndDate) {
            const end = new Date(filterEndDate);
            end.setHours(23, 59, 59, 999);
            if (examDate > end) return false;
          }
          return true;
        }
        return true;
      };
      return matchExam && matchSubject && matchDate();
    });

    // 2. Group by Exam TYPE (not exam ID), so one card per exam type
    const grouped: Record<string, { examType: string, results: any[] }> = {};
    filtered.forEach(r => {
      const etype = r.exams?.type || 'Other';
      if (!grouped[etype]) {
        grouped[etype] = { examType: etype, results: [] };
      }
      grouped[etype].results.push(r);
    });

    // 3. Convert to array and sort by latest exam date first
    return Object.values(grouped).sort((a, b) => {
      const latestA = Math.max(...a.results.map(r => new Date(r.exams?.created_at || 0).getTime()));
      const latestB = Math.max(...b.results.map(r => new Date(r.exams?.created_at || 0).getTime()));
      return latestB - latestA;
    });
  };

  if (!isInitialized) {
    return (
      <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="loader" style={{ borderTopColor: '#2563EB' }}></div>
      </div>
    );
  }

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <h1 style={{ fontSize: '24px', color: '#1E293B', margin: '0 0 24px 0', textTransform: 'capitalize' }}>
        {activeTab === 'results' ? 'Marks (نمبر)' : activeTab === 'attendance' ? 'Attendance (حاضری)' : 'Timetable (ٹائم ٹیبل)'}
      </h1>

      {/* Tab Content */}
      {activeTab === 'attendance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            <div className="guardian-action-card" style={{ padding: '16px', textAlign: 'center', borderTop: '4px solid #16A34A' }}>
              <h3 style={{ margin: 0, fontSize: '24px', color: '#16A34A' }}>{totalPresent}</h3>
              <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: '13px', fontWeight: 500 }}>Total Present</p>
            </div>
            <div className="guardian-action-card" style={{ padding: '16px', textAlign: 'center', borderTop: '4px solid #DC2626' }}>
              <h3 style={{ margin: 0, fontSize: '24px', color: '#DC2626' }}>{totalAbsent}</h3>
              <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: '13px', fontWeight: 500 }}>Total Absent</p>
            </div>
            <div className="guardian-action-card" style={{ padding: '16px', textAlign: 'center', borderTop: '4px solid #F59E0B' }}>
              <h3 style={{ margin: 0, fontSize: '24px', color: '#F59E0B' }}>{totalLeave}</h3>
              <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: '13px', fontWeight: 500 }}>Total Leave</p>
            </div>
            <div className="guardian-action-card" style={{ padding: '16px', textAlign: 'center', borderTop: '4px solid #2563EB' }}>
              <h3 style={{ margin: 0, fontSize: '24px', color: '#2563EB' }}>{attendanceRate}%</h3>
              <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: '13px', fontWeight: 500 }}>Attendance Rate</p>
            </div>
          </div>

          {/* Detailed List */}
          <h3 style={{ fontSize: '16px', color: '#1E293B', margin: '8px 0 0 0' }}>Recent Records</h3>
          {attendance.length > 0 ? (
            attendance.map((record, idx) => (
              <div key={idx} className="guardian-action-card" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#1E293B', fontWeight: 600 }}>
                    {new Date(record.date).toLocaleDateString('en-GB')}
                  </p>
                  {record.fine > 0 && (
                    <p style={{ margin: 0, fontSize: '12px', color: '#DC2626', fontWeight: 500 }}>Fine: Rs {record.fine}</p>
                  )}
                </div>
                <div style={{
                  padding: '4px 12px',
                  borderRadius: '100px',
                  fontSize: '12px',
                  fontWeight: 600,
                  background: record.status === 'Present' ? '#DCFCE7' : record.status === 'Absent' ? '#FEE2E2' : '#FEF3C7',
                  color: record.status === 'Present' ? '#16A34A' : record.status === 'Absent' ? '#DC2626' : '#D97706'
                }}>
                  {record.status}
                </div>
              </div>
            ))
          ) : (
            <div className="guardian-action-card" style={{ padding: '24px', textAlign: 'center' }}>
              <Calendar size={48} color="#94A3B8" style={{ margin: '0 auto 16px auto', opacity: 0.5 }} />
              <p style={{ color: '#64748B', margin: 0 }}>No attendance records found yet.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'results' && (
        <div>
          {/* Filters */}
          <div style={{ marginBottom: '24px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 200px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>Exam Type</label>
              <select 
                value={examTypeFilter} 
                onChange={e => setExamTypeFilter(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', outline: 'none', backgroundColor: '#FFF', color: '#1E293B', fontWeight: 500 }}
              >
                <option value="All">All Exams</option>
                {Array.from(new Set(results.filter(r => r.exams).map(r => r.exams?.type))).filter(Boolean).map(type => (
                  <option key={type as string} value={type as string}>{type as string}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: '1 1 200px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>Subject</label>
              <select 
                value={subjectFilter} 
                onChange={e => setSubjectFilter(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', outline: 'none', backgroundColor: '#FFF', color: '#1E293B', fontWeight: 500 }}
              >
                <option value="All">All Subjects</option>
                {Array.from(new Set(results.map(r => r.subject))).filter(Boolean).map(subj => (
                  <option key={subj as string} value={subj as string}>{subj as string}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: '1 1 300px', display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 120px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>Date Filter</label>
                <select 
                  value={dateFilterType} 
                  onChange={e => setDateFilterType(e.target.value as any)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', outline: 'none', backgroundColor: '#FFF', color: '#1E293B', fontWeight: 500 }}
                >
                  <option value="Overall">Overall</option>
                  <option value="Month">By Month</option>
                  <option value="Custom">Custom Range</option>
                </select>
              </div>

              {dateFilterType === 'Month' && (
                <div style={{ flex: '1 1 120px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>Select Month</label>
                  <input
                    type="month"
                    value={filterMonth}
                    onChange={(e) => setFilterMonth(e.target.value)}
                    style={{ width: '100%', padding: '7px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', outline: 'none', backgroundColor: '#FFF', color: '#1E293B', fontWeight: 500 }}
                  />
                </div>
              )}

              {dateFilterType === 'Custom' && (
                <>
                  <div style={{ flex: '1 1 120px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>Start Date</label>
                    <input
                      type="date"
                      value={filterStartDate}
                      onChange={(e) => setFilterStartDate(e.target.value)}
                      style={{ width: '100%', padding: '7px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', outline: 'none', backgroundColor: '#FFF', color: '#1E293B', fontWeight: 500 }}
                    />
                  </div>
                  <div style={{ flex: '1 1 120px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>End Date</label>
                    <input
                      type="date"
                      value={filterEndDate}
                      onChange={(e) => setFilterEndDate(e.target.value)}
                      style={{ width: '100%', padding: '7px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', outline: 'none', backgroundColor: '#FFF', color: '#1E293B', fontWeight: 500 }}
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Grouped Result Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '32px' }}>
            {getFilteredAndGroupedResults().map((group, idx) => {
              const totalMarks = group.results.reduce((sum, r) => sum + (r.total_marks || 0), 0);
              const obtainedMarks = group.results.reduce((sum, r) => sum + (r.marks || 0), 0);
              const percentage = totalMarks > 0 ? Math.round((obtainedMarks / totalMarks) * 100) : 0;
              const grade = calculateGrade(percentage);
              // Get latest exam date across all results in this type
              const latestDate = group.results.reduce((latest, r) => {
                const d = new Date(r.exams?.created_at || 0);
                return d > latest ? d : latest;
              }, new Date(0));

              // Sort results: by date desc, then by subject
              const sortedResults = [...group.results].sort((a, b) => {
                const dateA = new Date(a.exams?.created_at || 0).getTime();
                const dateB = new Date(b.exams?.created_at || 0).getTime();
                if (dateB !== dateA) return dateB - dateA;
                return (a.subject || '').localeCompare(b.subject || '');
              });

              return (
                <div key={idx} style={{ backgroundColor: '#FFF', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                  {/* Result Card Header */}
                  <div style={{ backgroundColor: '#F8FAFC', padding: '16px', borderBottom: '1px solid #E2E8F0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '16px', color: '#1E293B', fontWeight: 700 }}>{group.examType}</h3>
                        <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748B' }}>
                          {group.results.length} result{group.results.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right', fontSize: '13px', color: '#334155' }}>
                        <div style={{ fontWeight: 600 }}>{activeStudent.name}</div>
                        <div>S/O {activeStudent.father_name}</div>
                        <div>Class {activeStudent.academic_class} — Sec {activeStudent.section}</div>
                      </div>
                    </div>
                  </div>

                  {/* Subjects Table with Date column */}
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#F1F5F9', color: '#475569', fontSize: '13px', borderBottom: '1px solid #E2E8F0' }}>
                          <th style={{ padding: '12px 16px', fontWeight: 600 }}>Subject</th>
                          <th style={{ padding: '12px 16px', fontWeight: 600 }}>Date</th>
                          <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'center' }}>Total Marks</th>
                          <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'center' }}>Obtained Marks</th>
                          <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'center' }}>Percentage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedResults.map((r, i) => {
                          const subjPerc = r.total_marks > 0 ? Math.round((r.marks / r.total_marks) * 100) : 0;
                          const examDate = r.exams?.created_at ? new Date(r.exams.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
                          return (
                            <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                              <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 500, color: '#1E293B' }}>{r.subject}</td>
                              <td style={{ padding: '12px 16px', fontSize: '13px', color: '#64748B', whiteSpace: 'nowrap' }}>{examDate}</td>
                              <td style={{ padding: '12px 16px', fontSize: '14px', color: '#64748B', textAlign: 'center' }}>{r.total_marks}</td>
                              <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 600, color: '#1E293B', textAlign: 'center' }}>{r.marks}</td>
                              <td style={{ padding: '12px 16px', fontSize: '14px', color: subjPerc >= 50 ? '#16A34A' : '#DC2626', fontWeight: 600, textAlign: 'center' }}>{subjPerc}%</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Result Card Footer Summary */}
                  <div style={{ backgroundColor: '#F8FAFC', padding: '16px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <div style={{ display: 'flex', gap: '24px' }}>
                      <div>
                        <span style={{ fontSize: '12px', color: '#64748B', display: 'block' }}>Total Marks</span>
                        <span style={{ fontSize: '16px', fontWeight: 700, color: '#1E293B' }}>{totalMarks}</span>
                      </div>
                      <div>
                        <span style={{ fontSize: '12px', color: '#64748B', display: 'block' }}>Obtained</span>
                        <span style={{ fontSize: '16px', fontWeight: 700, color: '#2563EB' }}>{obtainedMarks}</span>
                      </div>
                      <div>
                        <span style={{ fontSize: '12px', color: '#64748B', display: 'block' }}>Percentage</span>
                        <span style={{ fontSize: '16px', fontWeight: 700, color: percentage >= 50 ? '#16A34A' : '#DC2626' }}>{percentage}%</span>
                      </div>
                    </div>
                    <div style={{ backgroundColor: grade === 'F' ? '#FEE2E2' : grade === 'D' ? '#FEF3C7' : '#DCFCE7', padding: '8px 24px', borderRadius: '100px', textAlign: 'center' }}>
                      <span style={{ fontSize: '12px', color: grade === 'F' ? '#991B1B' : grade === 'D' ? '#92400E' : '#166534', fontWeight: 600, display: 'block', textTransform: 'uppercase' }}>Overall Grade</span>
                      <span style={{ fontSize: '20px', fontWeight: 800, color: grade === 'F' ? '#DC2626' : grade === 'D' ? '#D97706' : '#15803D' }}>{grade}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {getFilteredAndGroupedResults().length === 0 && (
              <div style={{ padding: '40px 20px', textAlign: 'center', backgroundColor: '#F8FAFC', borderRadius: '12px', border: '1px dashed #CBD5E1' }}>
                <p style={{ margin: 0, color: '#64748B', fontSize: '15px' }}>No marks records found for the selected filters.</p>
              </div>
            )}
          </div>
          {/* Official Report Cards */}
          {globalResults.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '32px' }}>
              <h2 style={{ fontSize: '18px', color: '#1E293B', margin: 0 }}>Official Report Cards</h2>
              {globalResults.map((gr, idx) => {
                const sr = gr.student_result;
                const rcConfig = settings?.report_card_config || {
                  theme: 'classic',
                  primaryColor: '#1E3A8A',
                  headerTitle: 'EDUCATITON ERRP',
                  headerSubtitle: 'Term Report Card',
                  headerFont: 'sans-serif',
                  showSchoolLogo: true,
                  showStudentPhoto: true,
                };

                return (
                  <div key={idx} style={{ 
                    backgroundColor: 'white',
                    padding: '24px',
                    border: rcConfig.theme === 'bordered' ? `12px solid ${rcConfig.primaryColor}` : '1px solid var(--color-border)',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                    fontFamily: rcConfig.theme === 'minimal' ? 'Inter, sans-serif' : 'Times New Roman, serif',
                    display: 'flex',
                    flexDirection: 'column'
                  }}>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `2px solid ${rcConfig.primaryColor}`, paddingBottom: '16px', marginBottom: '24px' }}>
                      {rcConfig.showStudentPhoto && (
                        <div style={{ width: '45px', height: '55px', backgroundColor: '#F1F5F9', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', overflow: 'hidden' }}>
                          {activeStudent.photo ? <img src={activeStudent.photo} alt="Student" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <ImageIcon size={18} />}
                        </div>
                      )}
                      <div style={{ flex: 1, textAlign: 'center', padding: '0 16px' }}>
                        <h2 style={{ 
                          margin: '0 0 4px 0', 
                          fontSize: '18px', 
                          color: rcConfig.theme === 'classic' ? rcConfig.primaryColor : '#1E293B',
                          fontFamily: rcConfig.headerFont === 'sans-serif' ? 'Inter, sans-serif' : 'Times New Roman, serif'
                        }}>
                          {rcConfig.headerTitle || settings?.institute_name || 'EDUCATITON ERRP'}
                        </h2>
                        <p style={{ margin: 0, fontSize: '12px', color: '#64748B', fontFamily: rcConfig.headerFont === 'sans-serif' ? 'Inter, sans-serif' : 'Times New Roman, serif' }}>
                          {rcConfig.headerSubtitle !== undefined ? rcConfig.headerSubtitle : 'Term Report Card'} ({gr.exam_term})
                        </p>
                      </div>
                      {rcConfig.showSchoolLogo && (
                        <div style={{ width: '50px', height: '50px', backgroundColor: '#F1F5F9', borderRadius: '50%', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', overflow: 'hidden' }}>
                          {settings?.institute_logo ? <img src={settings.institute_logo} alt="School" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <ImageIcon size={20} />}
                        </div>
                      )}
                    </div>

                    {/* Student Info */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '24px', fontSize: '12px', color: '#1E293B' }}>
                      <div><strong>Name:</strong> {activeStudent.name || `${activeStudent.first_name || ''} ${activeStudent.last_name || ''}`.trim() || 'N/A'}</div>
                      <div><strong>Roll No:</strong> {activeStudent.roll_number || activeStudent.admission_number || 'N/A'}</div>
                      <div><strong>Father's Name:</strong> {activeStudent.father_name || 'N/A'}</div>
                      <div><strong>Class:</strong> {gr.class_name} - {activeStudent.section || gr.section}</div>
                    </div>

                    {/* Marks Table */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ backgroundColor: rcConfig.theme === 'minimal' ? 'transparent' : rcConfig.primaryColor, color: rcConfig.theme === 'minimal' ? rcConfig.primaryColor : 'white', borderBottom: rcConfig.theme === 'minimal' ? `2px solid ${rcConfig.primaryColor}` : 'none' }}>
                          <th style={{ padding: '8px', textAlign: 'left', border: rcConfig.theme === 'minimal' ? 'none' : '1px solid rgba(255,255,255,0.2)' }}>Subject</th>
                          <th style={{ padding: '8px', textAlign: 'center', border: rcConfig.theme === 'minimal' ? 'none' : '1px solid rgba(255,255,255,0.2)' }}>Total Marks</th>
                          <th style={{ padding: '8px', textAlign: 'center', border: rcConfig.theme === 'minimal' ? 'none' : '1px solid rgba(255,255,255,0.2)', width: '80px' }}>Obtained Marks</th>
                          <th style={{ padding: '8px', textAlign: 'center', border: rcConfig.theme === 'minimal' ? 'none' : '1px solid rgba(255,255,255,0.2)', width: '60px' }}>Grade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gr.subjects_config.map((sub: any) => {
                          const val = parseFloat(sr.marks[sub.name] || '0');
                          const subPercentage = sub.total_marks > 0 ? (val / sub.total_marks) * 100 : 0;
                          let subGrade = '-';
                          if (settings?.grade_scales && settings.grade_scales.length > 0) {
                            const sortedGrades = [...settings.grade_scales].sort((a: any, b: any) => b.minMarks - a.minMarks);
                            for (const grade of sortedGrades) {
                              if (subPercentage >= grade.minMarks) {
                                subGrade = grade.name;
                                break;
                              }
                            }
                          } else {
                            if (subPercentage >= 80) subGrade = 'A+';
                            else if (subPercentage >= 70) subGrade = 'A';
                            else if (subPercentage >= 60) subGrade = 'B';
                            else if (subPercentage >= 50) subGrade = 'C';
                            else if (subPercentage >= 40) subGrade = 'D';
                            else subGrade = 'F';
                          }
                          
                          return (
                            <tr key={sub.name} style={{ borderBottom: '1px solid #E2E8F0', color: '#1E293B' }}>
                              <td style={{ padding: '8px', borderLeft: rcConfig.theme === 'minimal' ? 'none' : '1px solid #E2E8F0' }}>{sub.name}</td>
                              <td style={{ padding: '8px', textAlign: 'center', borderLeft: rcConfig.theme === 'minimal' ? 'none' : '1px solid #E2E8F0' }}>{sub.total_marks}</td>
                              <td style={{ padding: '8px', textAlign: 'center', borderLeft: rcConfig.theme === 'minimal' ? 'none' : '1px solid #E2E8F0', fontWeight: 600 }}>{String(val)}</td>
                              <td style={{ padding: '8px', textAlign: 'center', fontWeight: 600, borderLeft: rcConfig.theme === 'minimal' ? 'none' : '1px solid #E2E8F0', borderRight: rcConfig.theme === 'minimal' ? 'none' : '1px solid #E2E8F0', color: (val < sub.passing_marks) ? '#DC2626' : 'inherit' }}>
                                {subGrade}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {/* Footer / Live Stats */}
                    <div style={{ marginTop: 'auto', borderTop: '1px solid #E2E8F0', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '11px', color: '#64748B', textTransform: 'uppercase' }}>Total Score</div>
                        <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#1E293B' }}>{sr.total_obtained} / {sr.total_max}</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '11px', color: '#64748B', textTransform: 'uppercase' }}>Percentage</div>
                        <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#1E293B' }}>{sr.percentage.toFixed(1)}%</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '11px', color: '#64748B', textTransform: 'uppercase' }}>Result</div>
                        <div style={{ fontWeight: 'bold', fontSize: '14px', color: sr.status === 'Pass' ? '#16A34A' : '#DC2626' }}>
                          {sr.status} ({sr.grade})
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}


        </div>
      )}

      {activeTab === 'timetable' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {timetable.length > 0 ? (
            (() => {
              const compressed: Record<string, any> = {};
              const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

              timetable.forEach(period => {
                const key = `${period.subject}|${period.start_time}|${period.end_time}|${period.teacher_name}`;
                if (!compressed[key]) {
                  compressed[key] = {
                    subject: period.subject,
                    teacher_name: period.teacher_name,
                    teacher_id: period.teacher_id,
                    start_time: period.start_time,
                    end_time: period.end_time,
                    days: []
                  };
                }
                if (!compressed[key].days.includes(period.day)) {
                  compressed[key].days.push(period.day);
                }
              });

              const compressedList = Object.values(compressed).sort((a: any, b: any) => 
                a.start_time.localeCompare(b.start_time) || a.subject.localeCompare(b.subject)
              );

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {compressedList.map((item: any, idx: number) => {
                    item.days.sort((d1: string, d2: string) => DAYS.indexOf(d1) - DAYS.indexOf(d2));
                    const daysDisplay = item.days.length === DAYS.length ? 'Full Week' : item.days.join(', ');
                    
                    return (
                      <div key={idx} className="guardian-action-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: '4px solid #2563EB', backgroundColor: '#FFFFFF' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', color: '#1E293B', fontWeight: 600 }}>{item.subject}</h3>
                            <p style={{ margin: 0, fontSize: '14px', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <User size={14} color="#64748B" /> {item.teacher_name || 'N/A'}
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              setRemarkTarget({ teacher_id: item.teacher_id, teacher_name: item.teacher_name, subject: item.subject });
                              setRemarkMessage('');
                              setIsRemarkModalOpen(true);
                            }}
                            style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', cursor: 'pointer', color: '#2563EB', padding: '6px 12px', borderRadius: '100px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, transition: 'all 0.2s' }}
                            title="Send remark to teacher"
                          >
                            <Send size={14} /> Remark
                          </button>
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', paddingTop: '12px', borderTop: '1px solid #F1F5F9' }}>
                          <span style={{ fontSize: '13px', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500 }}>
                            <Clock size={14} color="#64748B" /> {item.start_time} - {item.end_time}
                          </span>
                          <span style={{ fontSize: '11px', color: '#475569', backgroundColor: '#F8FAFC', padding: '4px 10px', borderRadius: '12px', fontWeight: 600, border: '1px solid #E2E8F0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            {daysDisplay}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()
          ) : (
            <div className="guardian-action-card" style={{ padding: '24px', textAlign: 'center' }}>
              <Calendar size={48} color="#2563EB" style={{ margin: '0 auto 16px auto' }} />
              <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', color: '#1E293B' }}>Class Timetable</h2>
              <p style={{ color: '#64748B', margin: 0 }}>Class timetable for {activeStudent.academic_class} is not available.</p>
            </div>
          )}
        </div>
      )}

      {/* Remark Modal */}
      {isRemarkModalOpen && remarkTarget && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#1E293B' }}>Send Remark</h3>
              <button onClick={() => setIsRemarkModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                <X size={20} />
              </button>
            </div>
            
            <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#64748B' }}>
              Send a remark to <strong>{remarkTarget.teacher_name}</strong> regarding <strong>{remarkTarget.subject}</strong>.
            </p>
            
            <textarea
              value={remarkMessage}
              onChange={(e) => setRemarkMessage(e.target.value.slice(0, 500))}
              placeholder="Type your remark here (max 500 characters)..."
              style={{ width: '100%', height: '120px', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0', resize: 'none', fontFamily: 'inherit', fontSize: '14px', marginBottom: '8px', boxSizing: 'border-box' }}
            />
            <div style={{ textAlign: 'right', fontSize: '12px', color: remarkMessage.length >= 500 ? '#EF4444' : '#94A3B8', marginBottom: '16px' }}>
              {remarkMessage.length} / 500
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setIsRemarkModalOpen(false)}
                style={{ padding: '8px 16px', borderRadius: '6px', background: '#F1F5F9', color: '#475569', border: 'none', cursor: 'pointer', fontWeight: 500 }}
              >
                Cancel
              </button>
              <button 
                onClick={handleSendRemark}
                disabled={isSendingRemark || !remarkMessage.trim()}
                style={{ padding: '8px 16px', borderRadius: '6px', background: '#2563EB', color: '#fff', border: 'none', cursor: remarkMessage.trim() && !isSendingRemark ? 'pointer' : 'not-allowed', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px', opacity: remarkMessage.trim() && !isSendingRemark ? 1 : 0.6 }}
              >
                {isSendingRemark ? 'Sending...' : <><Send size={16} /> Send Remark</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GuardianAcademics;
