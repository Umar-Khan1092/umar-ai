'use client';

import React, { useState, useEffect } from 'react';
import { Save, CheckCircle2, ArrowRight, ArrowLeft, Users, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface SubjectConfig {
  name: string;
  total_marks: number;
  passing_marks: number;
}

interface Student {
  id: string;
  name?: string;
  father_name?: string;
  roll_number?: string;
  first_name?: string;
  last_name?: string;
  admission_number?: string;
  section?: string;
}

export const AdminResultGeneration: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'Generate' | 'Drafts' | 'Published'>('Generate');
  const [step, setStep] = useState<number>(1);
  const [settings, setSettings] = useState<any>(null);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [savedResults, setSavedResults] = useState<any[]>([]);
  
  // Step 1 State
  const [examTerm, setExamTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [subjectsConfig, setSubjectsConfig] = useState<SubjectConfig[]>([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  
  // Step 2 State
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [marks, setMarks] = useState<Record<string, Record<string, string>>>({}); // studentId -> { subjectName: markString }
  
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{type: 'success'|'error', message: string}>({ type: 'success', message: '' });

  // Publishing Modality State
  const [publishModal, setPublishModal] = useState<{isOpen: boolean, data?: any} | null>(null);

  useEffect(() => {
    Promise.resolve(supabase.from('settings').select('*').eq('key', 'app_settings').single())
      .then(res => {
        const data = res.data?.value || {};
        setSettings(data);
        if (data.classes?.length > 0) setSelectedClass(data.classes[0]);
        if (data.exam_types?.length > 0) setExamTerm(data.exam_types[0]);
      })
      .catch((err: any) => console.error("Error fetching settings:", err));
      
    Promise.resolve(supabase.from('students').select('*'))
      .then(res => setAllStudents(res.data || []))
      .catch((err: any) => console.error("Error fetching students:", err));
  }, []);

  useEffect(() => {
    if (selectedClass && settings?.class_sections?.[selectedClass]?.length > 0) {
      setSelectedSections([settings.class_sections[selectedClass][0]]);
    } else {
      setSelectedSections([]);
    }
  }, [selectedClass, settings]);

  useEffect(() => {
    if (selectedClass && settings?.class_subjects?.[selectedClass]) {
      const classSubs = settings.class_subjects[selectedClass];
      setSubjectsConfig(classSubs.map((sub: string) => ({
        name: sub,
        total_marks: 100,
        passing_marks: 33
      })));
    } else {
      setSubjectsConfig([]);
    }
  }, [selectedClass, settings]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: '', type: 'success' }), 3000);
  };

  const handleNextStep = () => {
    if (!examTerm) return showToast('Please enter an Exam Title', 'error');
    if (!selectedClass || selectedSections.length === 0) return showToast('Please select Class and at least one Section', 'error');
    if (subjectsConfig.length === 0) return showToast('Please configure at least one subject', 'error');

    setIsLoading(true);
    // Use already fetched students to avoid delay
    const classStudents = allStudents.filter((s: any) => s.academic_class === selectedClass && selectedSections.includes(s.section) && s.status !== 'Struck Off');
    setStudents(classStudents);
    setSelectedStudentIds(new Set(classStudents.map((s: any) => s.id)));
    
    // Initialize marks
    const newMarks: Record<string, Record<string, string>> = {};
    classStudents.forEach((s: any) => {
      newMarks[s.id] = {};
      subjectsConfig.forEach(sub => {
        newMarks[s.id][sub.name] = '';
      });
    });
    setMarks(newMarks);
    setStep(2);
    setIsLoading(false);
  };

  const calculateGrade = (percentage: number) => {
    if (!settings?.grade_scales || settings.grade_scales.length === 0) {
      // Fallback
      if (percentage >= 80) return 'A+';
      if (percentage >= 70) return 'A';
      if (percentage >= 60) return 'B';
      if (percentage >= 50) return 'C';
      if (percentage >= 40) return 'D';
      return 'F';
    }
    
    // Sort descending by minMarks to find the highest matching grade
    const sortedGrades = [...settings.grade_scales].sort((a: any, b: any) => b.minMarks - a.minMarks);
    for (const grade of sortedGrades) {
      if (percentage >= grade.minMarks) {
        return grade.name;
      }
    }
    return 'F'; // Default if nothing matches
  };

  const getLiveStats = (studentId: string) => {
    let totalObtained = 0;
    let totalMax = 0;
    let allPassed = true;
    
    subjectsConfig.forEach(sub => {
      const val = parseFloat(marks[studentId]?.[sub.name] || '0');
      totalObtained += val;
      totalMax += sub.total_marks;
      if (val < sub.passing_marks) allPassed = false;
    });
    
    const percentage = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;
    const grade = calculateGrade(percentage);
    const status = allPassed ? 'Pass' : 'Fail';
    
    return { percentage, grade, status, totalObtained, totalMax };
  };

  const fetchSavedResults = () => {
    Promise.resolve(supabase.from('generated_results').select('*'))
      .then(res => setSavedResults(res.data || []))
      .catch((err: any) => console.error("Error fetching saved results:", err));
  };

  useEffect(() => {
    if (activeTab === 'Drafts' || activeTab === 'Published') {
      fetchSavedResults();
    }
  }, [activeTab]);

  const handleSaveGlobal = (status: 'Draft' | 'Published', notifyParents: boolean = false) => {
    if (selectedStudentIds.size === 0) return showToast('Please select at least one student', 'error');

    setIsLoading(true);
    
    const resultsPayload: any[] = [];
    
    Array.from(selectedStudentIds).forEach(studentId => {
      const studentMarks = marks[studentId] || {};
      let totalObtained = 0;
      let totalMax = 0;
      let allPassed = true;
      
      const parsedMarks: Record<string, number> = {};
      
      subjectsConfig.forEach(sub => {
        const val = parseFloat(studentMarks[sub.name] || '0');
        parsedMarks[sub.name] = val;
        totalObtained += val;
        totalMax += sub.total_marks;
        if (val < sub.passing_marks) allPassed = false;
      });
      
      const percentage = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;
      const grade = calculateGrade(percentage);
      const status = allPassed ? 'Pass' : 'Fail';
      
      resultsPayload.push({
        student_id: studentId,
        marks: parsedMarks,
        total_obtained: totalObtained,
        total_max: totalMax,
        percentage: Number(percentage.toFixed(2)),
        grade,
        status,
        position: '' // Will be filled below
      });
    });
    
    // Calculate positions globally
    resultsPayload.sort((a, b) => b.percentage - a.percentage);
    
    let currentRank = 1;
    for (let i = 0; i < resultsPayload.length; i++) {
      if (i > 0 && resultsPayload[i].percentage < resultsPayload[i-1].percentage) {
        currentRank = i + 1;
      }
      
      let positionStr = `${currentRank}th`;
      if (currentRank === 1) positionStr = '1st';
      else if (currentRank === 2) positionStr = '2nd';
      else if (currentRank === 3) positionStr = '3rd';
      
      resultsPayload[i].position = positionStr;
    }
    
    const payload = {
      exam_term: examTerm,
      class_name: selectedClass,
      section: selectedSections.join(', '),
      subjects_config: subjectsConfig,
      students_results: resultsPayload,
      status: status,
      notify_parents: notifyParents
    };

    Promise.resolve(supabase.from('generated_results').insert(payload))
      .then(({ error }) => {
        if (error) throw error;
        showToast(`Global Results ${status} successfully!`, 'success');
        if (notifyParents) {
          triggerGlobalResultNotifications(resultsPayload, examTerm, selectedClass);
        }
        setPublishModal(null);
        setActiveTab(status === 'Draft' ? 'Drafts' : 'Published');
        setStep(1); // Reset to start
      })
      .catch(() => showToast('Error saving results', 'error'))
      .finally(() => setIsLoading(false));
  };

  const triggerGlobalResultNotifications = async (studentsResults: any[], term: string, className: string) => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const studentIds = studentsResults.map(r => r.student_id);
      if (studentIds.length === 0) return;
      
      const { data: studentsData } = await supabase
        .from('students')
        .select('id, name')
        .in('id', studentIds);

      await Promise.all(studentsResults.map(async (r: any) => {
        const studentName = studentsData?.find(s => s.id === r.student_id)?.name || 'your child';
        const title = `🏆 Term Results Published: ${term}`;
        const message = `Dear Parent, the final results for ${studentName} (${className}) for ${term} have been published. Status: ${r.status}, Grade: ${r.grade}, Position: ${r.position}, Total Obtained: ${r.total_obtained} / ${r.total_max} (${r.percentage}%).`;
        
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
            category: 'Results',
            url: '/guardian/guardianacademics'
          })
        });
      }));
    } catch (err) {
      console.error('Failed to send global result notifications:', err);
    }
  };

  const handleMarkChange = (studentId: string, subjectName: string, val: string) => {
    setMarks(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [subjectName]: val
      }
    }));
  };

  const toggleStudent = (id: string) => {
    const next = new Set(selectedStudentIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedStudentIds(next);
  };

  if (!settings) return <div style={{ padding: '24px' }}>Loading...</div>;

  return (
    <div className="page-content" style={{ padding: '16px 24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: '4px', fontSize: '24px' }}>Global Result Generation</h1>
          <p className="body-text" style={{ color: 'var(--color-text-secondary)', margin: 0 }}>
            Centrally compile, calculate, and publish results for an entire class.
          </p>
        </div>
      </div>

          <div className="tab-container" style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid var(--color-border)', paddingBottom: '0' }}>
            {['Generate', 'Drafts', 'Published'].map(tab => (
              <button 
                key={tab}
                className={`tab-button ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab as any)}
                style={{ 
                  padding: '12px 24px', 
                  border: 'none', 
                  backgroundColor: 'transparent', 
                  cursor: 'pointer',
                  borderBottom: activeTab === tab ? '2px solid var(--color-primary)' : '2px solid transparent',
                  color: activeTab === tab ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                  fontWeight: activeTab === tab ? 600 : 400
                }}
              >
                {tab === 'Generate' ? 'Generate New' : tab}
              </button>
            ))}
          </div>

      {toast.message && (
        <div className={`toast ${toast.type}`} style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {toast.type === 'success' && <CheckCircle2 size={18} />}
          {toast.message}
        </div>
      )}

      {activeTab === 'Generate' && (
        <>
          {step === 1 && (
            <div className="card" style={{ padding: '24px' }}>
              <h2 style={{ fontSize: '18px', marginBottom: '20px', borderBottom: '1px solid var(--color-border)', paddingBottom: '12px' }}>
                1. Exam Configuration
              </h2>
              
              <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                <div className="input-group">
                  <label className="input-label">Assessment Type (Analytics)</label>
                  <select 
                    className="input-field" 
                    value={examTerm}
                    onChange={e => setExamTerm(e.target.value)}
                  >
                    {settings?.exam_types?.map((type: string) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                    {(!settings?.exam_types || settings.exam_types.length === 0) && (
                      <option value="First Term">First Term</option>
                    )}
                  </select>
                </div>
            
            <div className="input-group">
              <label className="input-label">Select Class</label>
              <select className="input-field" value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
                {settings.classes?.map((c: string) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="input-group" style={{ position: 'relative' }}>
              <label className="input-label">Select Section(s)</label>
              <div 
                className="input-field" 
                style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '40px', backgroundColor: 'white' }}
                onClick={() => {
                  const el = document.getElementById('section-dropdown-menu');
                  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
                }}
              >
                <span style={{ color: selectedSections.length ? 'inherit' : 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedSections.length > 0 ? selectedSections.join(', ') : 'Select Sections...'}
                </span>
                <span style={{ fontSize: '10px' }}>▼</span>
              </div>
              
              <div 
                id="section-dropdown-menu"
                style={{ 
                  display: 'none',
                  position: 'absolute', 
                  top: '100%', 
                  left: 0, 
                  right: 0, 
                  backgroundColor: 'var(--color-background)', 
                  border: '1px solid var(--color-border)', 
                  borderRadius: '8px', 
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)', 
                  zIndex: 10,
                  marginTop: '4px',
                  maxHeight: '200px',
                  overflowY: 'auto'
                }}
              >
                {settings.class_sections?.[selectedClass]?.map((s: string) => (
                  <label 
                    key={s} 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '10px', 
                      padding: '10px 16px', 
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--color-border)',
                      color: 'var(--color-text)'
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input 
                      type="checkbox" 
                      checked={selectedSections.includes(s)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedSections([...selectedSections, s]);
                        else setSelectedSections(selectedSections.filter(sec => sec !== s));
                      }}
                      style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                    />
                    <span style={{ fontSize: '14px' }}>{s}</span>
                  </label>
                ))}
                {(!settings.class_sections?.[selectedClass] || settings.class_sections[selectedClass].length === 0) && (
                  <div style={{ padding: '12px 16px', color: 'var(--color-text-secondary)', fontSize: '14px' }}>
                    No sections found
                  </div>
                )}
              </div>
              <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Users size={14} /> 
                <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{allStudents.filter((s: any) => s.academic_class === selectedClass && selectedSections.includes(s.section) && s.status !== 'Struck Off').length}</span> Students found in selected section(s)
              </div>
            </div>
          </div>

          <h2 style={{ fontSize: '18px', marginTop: '32px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Subjects & Marks Config for {selectedClass}</span>
          </h2>

          <div style={{ backgroundColor: 'var(--color-background)', padding: '16px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '12px', borderBottom: '1px solid var(--color-border)' }}>Subject Name</th>
                  <th style={{ textAlign: 'left', padding: '12px', borderBottom: '1px solid var(--color-border)', width: '150px' }}>Total Marks</th>
                  <th style={{ textAlign: 'left', padding: '12px', borderBottom: '1px solid var(--color-border)', width: '150px' }}>Passing Marks</th>
                </tr>
              </thead>
              <tbody>
                {subjectsConfig.map((sub, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '12px' }}>{sub.name}</td>
                    <td style={{ padding: '12px' }}>
                      <input 
                        type="number" 
                        className="input-field" 
                        value={sub.total_marks}
                        onChange={e => {
                          const newConf = [...subjectsConfig];
                          newConf[idx].total_marks = Number(e.target.value);
                          setSubjectsConfig(newConf);
                        }}
                        style={{ margin: 0, padding: '8px' }}
                      />
                    </td>
                    <td style={{ padding: '12px' }}>
                      <input 
                        type="number" 
                        className="input-field" 
                        value={sub.passing_marks}
                        onChange={e => {
                          const newConf = [...subjectsConfig];
                          newConf[idx].passing_marks = Number(e.target.value);
                          setSubjectsConfig(newConf);
                        }}
                        style={{ margin: 0, padding: '8px' }}
                      />
                    </td>
                  </tr>
                ))}
                {subjectsConfig.length === 0 && (
                  <tr>
                    <td colSpan={3} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                      No subjects defined for this class in settings.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
            <button className="btn-primary" onClick={handleNextStep} disabled={isLoading || subjectsConfig.length === 0} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              Next: Select Students <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--color-border)', paddingBottom: '12px' }}>
            <h2 style={{ fontSize: '18px', margin: 0 }}>
              2. Select Students
            </h2>
            <button className="btn-secondary" onClick={() => setStep(1)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px' }}>
              <ArrowLeft size={16} /> Back to Config
            </button>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div className="input-group" style={{ margin: 0, width: '300px' }}>
              <input 
                type="text" 
                className="input-field" 
                placeholder="Search by name or roll no..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ margin: 0 }}
              />
            </div>
            <div>
              <button 
                className="btn-secondary" 
                onClick={() => {
                  if (selectedStudentIds.size === students.length) setSelectedStudentIds(new Set());
                  else setSelectedStudentIds(new Set(students.map(s => s.id)));
                }}
              >
                {selectedStudentIds.size === students.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
          </div>

          <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: '8px' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--color-background)', zIndex: 1 }}>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '12px', width: '40px' }}></th>
                  <th style={{ padding: '12px' }}>Roll No</th>
                  <th style={{ padding: '12px' }}>Name</th>
                  <th style={{ padding: '12px' }}>Father's Name</th>
                  <th style={{ padding: '12px' }}>Class</th>
                  <th style={{ padding: '12px' }}>Section</th>
                </tr>
              </thead>
              <tbody>
              {students.filter(s => 
                `${s.name || ''} ${s.first_name || ''} ${s.last_name || ''} ${s.father_name || ''} ${s.roll_number || ''} ${s.admission_number || ''}`.toLowerCase().includes(searchQuery.toLowerCase())
              ).map(student => (
                <tr key={student.id} style={{ cursor: 'pointer', backgroundColor: selectedStudentIds.has(student.id) ? 'var(--color-bg-secondary)' : 'transparent', borderBottom: '1px solid var(--color-border)' }} onClick={() => toggleStudent(student.id)}>
                  <td style={{ padding: '12px' }}>
                    <input 
                      type="checkbox" 
                      checked={selectedStudentIds.has(student.id)}
                      onChange={() => {}} // handled by row click
                      style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                    />
                  </td>
                  <td style={{ padding: '12px' }}>{student.roll_number || student.admission_number || 'N/A'}</td>
                  <td style={{ padding: '12px' }}>{student.name || `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'N/A'}</td>
                  <td style={{ padding: '12px' }}>{student.father_name || 'N/A'}</td>
                  <td style={{ padding: '12px' }}>{(student as any).academic_class || selectedClass}</td>
                  <td style={{ padding: '12px' }}>{student.section}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          
          {students.length === 0 && (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              No students found in this class.
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
            <button className="btn-primary" onClick={() => setStep(3)} disabled={selectedStudentIds.size === 0} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              Next: Enter Marks <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--color-border)', paddingBottom: '12px' }}>
            <h2 style={{ fontSize: '18px', margin: 0 }}>
              3. Enter Student Marks
            </h2>
            <button className="btn-secondary" onClick={() => setStep(2)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px' }}>
              <ArrowLeft size={16} /> Back to Selection
            </button>
          </div>
          
          <div style={{ display: 'flex', gap: '24px', marginBottom: '24px' }}>
            <div style={{ backgroundColor: 'var(--color-background)', padding: '12px 16px', borderRadius: '8px', flex: 1 }}>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Exam Title</div>
              <div style={{ fontWeight: 600 }}>{examTerm}</div>
            </div>
            <div style={{ backgroundColor: 'var(--color-background)', padding: '12px 16px', borderRadius: '8px', flex: 1 }}>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Class</div>
              <div style={{ fontWeight: 600 }}>{selectedClass} - {selectedSections.join(', ')}</div>
            </div>
            <div style={{ backgroundColor: 'var(--color-background)', padding: '12px 16px', borderRadius: '8px', flex: 1 }}>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Selected Students</div>
              <div style={{ fontWeight: 600 }}>{selectedStudentIds.size} / {students.length}</div>
            </div>
          </div>

          {/* Top Controls for Step 2 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div className="input-group" style={{ margin: 0, width: '300px' }}>
              <input 
                type="text" 
                className="input-field" 
                placeholder="Search by name or roll no..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ margin: 0 }}
              />
            </div>
            <div>
              <button 
                className="btn-secondary" 
                onClick={() => {
                  if (selectedStudentIds.size === students.length) setSelectedStudentIds(new Set());
                  else setSelectedStudentIds(new Set(students.map(s => s.id)));
                }}
              >
                {selectedStudentIds.size === students.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '24px' }}>
            {students.filter(s => 
              selectedStudentIds.has(s.id) && `${s.name || ''} ${s.first_name || ''} ${s.last_name || ''} ${s.father_name || ''} ${s.roll_number || ''} ${s.admission_number || ''}`.toLowerCase().includes(searchQuery.toLowerCase())
            ).map(student => {
              const stats = getLiveStats(student.id);
              const isSelected = selectedStudentIds.has(student.id);
              
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
                <div key={student.id} style={{ 
                  opacity: isSelected ? 1 : 0.6, 
                  boxShadow: isSelected ? `0 0 0 2px var(--color-primary)` : '0 4px 6px rgba(0,0,0,0.1)',
                  backgroundColor: 'white',
                  position: 'relative',
                  padding: '24px',
                  border: rcConfig.theme === 'bordered' ? `12px solid ${rcConfig.primaryColor}` : '1px solid var(--color-border)',
                  fontFamily: rcConfig.theme === 'minimal' ? 'Inter, sans-serif' : 'Times New Roman, serif',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  {/* Checkbox at top right */}
                  <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 10 }}>
                    <input 
                      type="checkbox" 
                      checked={isSelected}
                      onChange={() => toggleStudent(student.id)}
                      style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                    />
                  </div>

                  <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column' }}>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `2px solid ${rcConfig.primaryColor}`, paddingBottom: '16px', marginBottom: '24px' }}>
                      {rcConfig.showStudentPhoto && (
                        <div style={{ width: '45px', height: '55px', backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', overflow: 'hidden' }}>
                          {(student as any).photo ? <img src={(student as any).photo} alt="Student" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <ImageIcon size={18} />}
                        </div>
                      )}
                      <div style={{ flex: 1, textAlign: 'center', padding: '0 16px' }}>
                        <h2 style={{ 
                          margin: '0 0 4px 0', 
                          fontSize: '18px', 
                          color: rcConfig.theme === 'classic' ? rcConfig.primaryColor : 'var(--color-text-heading)',
                          fontFamily: rcConfig.headerFont === 'sans-serif' ? 'Inter, sans-serif' : 'Times New Roman, serif'
                        }}>
                          {rcConfig.headerTitle || settings?.institute_name || 'EDUCATITON ERRP'}
                        </h2>
                        <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: rcConfig.headerFont === 'sans-serif' ? 'Inter, sans-serif' : 'Times New Roman, serif' }}>
                          {rcConfig.headerSubtitle !== undefined ? rcConfig.headerSubtitle : 'Term Report Card'}
                        </p>
                      </div>
                      {rcConfig.showSchoolLogo && (
                        <div style={{ width: '50px', height: '50px', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '50%', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', overflow: 'hidden' }}>
                          {settings?.institute_logo ? <img src={settings.institute_logo} alt="School" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <ImageIcon size={20} />}
                        </div>
                      )}
                    </div>

                    {/* Student Info */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '24px', fontSize: '12px' }}>
                      <div><strong>Name:</strong> {student.name || `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'N/A'}</div>
                      <div><strong>Roll No:</strong> {student.roll_number || student.admission_number || 'N/A'}</div>
                      <div><strong>Father's Name:</strong> {student.father_name || 'N/A'}</div>
                      <div><strong>Class:</strong> {selectedClass} - {student.section}</div>
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
                        {subjectsConfig.map(sub => {
                          const val = parseFloat(marks[student.id]?.[sub.name] || '0');
                          const subPercentage = sub.total_marks > 0 ? (val / sub.total_marks) * 100 : 0;
                          const subGrade = marks[student.id]?.[sub.name] ? calculateGrade(subPercentage) : '-';
                          
                          return (
                          <tr key={sub.name} style={{ borderBottom: '1px solid #E2E8F0' }}>
                            <td style={{ padding: '8px', borderLeft: rcConfig.theme === 'minimal' ? 'none' : '1px solid #E2E8F0' }}>{sub.name}</td>
                            <td style={{ padding: '8px', textAlign: 'center', borderLeft: rcConfig.theme === 'minimal' ? 'none' : '1px solid #E2E8F0' }}>{sub.total_marks}</td>
                            <td style={{ padding: '4px', textAlign: 'center', borderLeft: rcConfig.theme === 'minimal' ? 'none' : '1px solid #E2E8F0' }}>
                              <input 
                                type="number" 
                                value={marks[student.id]?.[sub.name] || ''}
                                onChange={e => handleMarkChange(student.id, sub.name, e.target.value)}
                                disabled={!isSelected}
                                style={{ 
                                  width: '100%', 
                                  padding: '4px', 
                                  textAlign: 'center', 
                                  border: '1px solid var(--color-border)', 
                                  borderRadius: '4px',
                                  borderColor: (marks[student.id]?.[sub.name] && Number(marks[student.id]?.[sub.name]) < sub.passing_marks) ? 'var(--color-danger)' : 'var(--color-border)' 
                                }}
                                placeholder="0"
                              />
                            </td>
                            <td style={{ padding: '8px', textAlign: 'center', fontWeight: 600, borderLeft: rcConfig.theme === 'minimal' ? 'none' : '1px solid #E2E8F0', borderRight: rcConfig.theme === 'minimal' ? 'none' : '1px solid #E2E8F0', color: (marks[student.id]?.[sub.name] && val < sub.passing_marks) ? 'var(--color-danger)' : 'inherit' }}>
                              {subGrade}
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {/* Footer / Live Stats */}
                    <div style={{ marginTop: 'auto', borderTop: '1px solid var(--color-border)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Total Score</div>
                        <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{stats.totalObtained} / {stats.totalMax}</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Percentage</div>
                        <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{stats.percentage.toFixed(1)}%</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Result</div>
                        <div style={{ fontWeight: 'bold', fontSize: '14px', color: stats.status === 'Pass' ? 'var(--color-success)' : 'var(--color-danger)' }}>
                          {stats.status} ({stats.grade})
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {students.length === 0 && (
              <div style={{ gridColumn: '1 / -1', padding: '32px', textAlign: 'center', color: 'var(--color-text-secondary)', backgroundColor: 'var(--color-background)', borderRadius: '8px' }}>
                No students found in this class.
              </div>
            )}
          </div>

          <div style={{ 
            position: 'fixed', 
            bottom: '40px', 
            right: '40px', 
            display: 'flex', 
            gap: '16px', 
            zIndex: 100 
          }}>
            <button 
              className="btn-secondary" 
              onClick={() => handleSaveGlobal('Draft')} 
              disabled={isLoading || selectedStudentIds.size === 0} 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                backgroundColor: 'white',
                padding: '12px 20px',
                borderRadius: '30px'
              }}
            >
              <Save size={18} /> Save as Draft
            </button>
            <button 
              className="btn-primary" 
              onClick={() => setPublishModal({ isOpen: true })} 
              disabled={isLoading || selectedStudentIds.size === 0} 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                padding: '12px 20px',
                borderRadius: '30px',
                backgroundColor: 'var(--color-success)'
              }}
            >
              <CheckCircle2 size={18} /> Publish Global Result
            </button>
          </div>
        </div>
      )}
      </>
      )}

      {(activeTab === 'Drafts' || activeTab === 'Published') && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
            {savedResults.filter(r => r.status === (activeTab === 'Drafts' ? 'Draft' : 'Published')).map(res => (
              <div key={res.id} className="card" style={{ padding: '20px' }}>
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: '8px' }}>
                  {res.exam_term}
                </div>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>
                  {res.class_name} - {res.section}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
                  <Users size={16} /> {res.students_results?.length || 0} Students
                </div>
                
                {activeTab === 'Drafts' ? (
                  <button 
                    className="btn-primary" 
                    style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '8px' }}
                    onClick={() => {
                      // Optionally load draft into Generate tab to edit
                      setExamTerm(res.exam_term);
                      setSelectedClass(res.class_name);
                      setSelectedSections(res.section.split(', '));
                      setSubjectsConfig(res.subjects_config);
                      setActiveTab('Generate');
                      setStep(2);
                    }}
                  >
                    Resume Draft <ArrowRight size={16} />
                  </button>
                ) : (
                  <button 
                    className="btn-secondary" 
                    style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '8px' }}
                    onClick={() => setPublishModal({ isOpen: true, data: res })}
                  >
                    Notify Parents Manually
                  </button>
                )}
              </div>
            ))}
            {savedResults.filter(r => r.status === (activeTab === 'Drafts' ? 'Draft' : 'Published')).length === 0 && (
              <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                No {activeTab.toLowerCase()} results found.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Publishing Modality */}
      {publishModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
          <div className="card" style={{ width: '400px', padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <h2 style={{ margin: 0, fontSize: '20px' }}>Publish Results</h2>
            <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
              Do you want to send the published result notifications to the Parent Portal now?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
              <button 
                className="btn-secondary" 
                onClick={() => setPublishModal(null)}
              >
                Cancel
              </button>
              <button 
                className="btn-secondary" 
                onClick={() => {
                  if (publishModal.data) {
                     setPublishModal(null);
                  } else {
                     handleSaveGlobal('Published', false);
                  }
                }}
              >
                Later
              </button>
              <button 
                className="btn-primary" 
                onClick={() => {
                  if (publishModal.data) {
                     Promise.resolve(supabase.from('generated_results').update({ notify_parents: true, status: 'Published' }).eq('id', publishModal.data.id))
                     .then(({ error }) => {
                       if (error) throw error;
                       triggerGlobalResultNotifications(publishModal.data.students_results || [], publishModal.data.exam_term, publishModal.data.class_name);
                       showToast('Notifications sent to parents!', 'success');
                       setPublishModal(null);
                       fetchSavedResults();
                     })
                     .catch(() => showToast('Error sending notifications', 'error'));
                  } else {
                     handleSaveGlobal('Published', true);
                  }
                }}
              >
                Send Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminResultGeneration;
