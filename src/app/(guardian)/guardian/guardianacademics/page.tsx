'use client';

import React, { useState, useEffect } from 'react';
import { useGuardian } from '@/context/GuardianContext';
import { FileSpreadsheet, Calendar, Image as ImageIcon, Send, X, User, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export const GuardianAcademics: React.FC = () => {
  const { activeStudent } = useGuardian();
  const [activeTab, setActiveTab] = useState<'attendance' | 'results' | 'timetable'>('attendance');
  const [results, setResults] = useState<any[]>([]);
  const [globalResults, setGlobalResults] = useState<any[]>([]);
  const [timetable, setTimetable] = useState<any[]>([]);
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
      Promise.resolve(supabase.from('results').select('*').eq('student_id', activeStudent.id))
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
        recipient_role: 'Teacher',
        target_role: 'Teacher',
        sender_id: activeStudent.id, 
        sender_role: 'Guardian',
        title: `Remark from Parent of ${activeStudent.name}`,
        message: remarkMessage,
        context: 'Remarks',
        student_id: activeStudent.id,
        subject: remarkTarget.subject
      });

      // 2. Send to Admin
      await supabase.from('notifications').insert({
        recipient_id: 'admin',
        recipient_role: 'Admin',
        target_role: 'Admin',
        sender_id: activeStudent.id,
        sender_role: 'Guardian',
        title: `Remark from Parent of ${activeStudent.name}`,
        message: remarkMessage,
        context: 'Remarks',
        student_id: activeStudent.id,
        subject: remarkTarget.subject
      });

      setRemarkMessage('');
      setIsRemarkModalOpen(false);
      alert('Remark sent successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to send remark. Please try again.');
    } finally {
      setIsSendingRemark(false);
    }
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <h1 style={{ fontSize: '24px', color: '#1E293B', margin: '0 0 24px 0' }}>Academics</h1>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', overflowX: 'auto', paddingBottom: '4px' }}>
        {['attendance', 'results', 'timetable'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            style={{
              padding: '8px 16px',
              borderRadius: '100px',
              border: 'none',
              background: activeTab === tab ? '#2563EB' : '#F1F5F9',
              color: activeTab === tab ? '#FFFFFF' : '#64748B',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              textTransform: 'capitalize',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

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

          {results.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h2 style={{ fontSize: '18px', color: '#1E293B', margin: '0 0 8px 0' }}>Individual Subject Results</h2>
              {results.map((res: any, idx: number) => (
                <div key={idx} className="guardian-action-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', color: '#1E293B' }}>{res.exam_title || res.exam_term || res.exam_id}</h3>
                      <p style={{ margin: 0, fontSize: '14px', color: '#64748B' }}>{res.subject_name || res.subject}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '18px', fontWeight: 700, color: res.status_label === 'Pass' ? '#16A34A' : '#E11D48' }}>
                        {res.percentage ? `${res.percentage}%` : `${Math.round((res.obtained_marks / res.total_marks)*100)}%`}
                      </span>
                      <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748B' }}>{res.obtained_marks} / {res.total_marks}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : globalResults.length === 0 && (
            <div className="guardian-action-card" style={{ padding: '24px', textAlign: 'center' }}>
              <FileSpreadsheet size={48} color="#7C3AED" style={{ margin: '0 auto 16px auto' }} />
              <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', color: '#1E293B' }}>No Published Results</h2>
              <p style={{ color: '#64748B', margin: 0 }}>There are no published exam results available right now.</p>
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
