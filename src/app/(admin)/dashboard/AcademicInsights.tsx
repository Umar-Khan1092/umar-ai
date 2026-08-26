'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { BarChart3, TrendingUp, Trophy, AlertTriangle, Filter, Check, X, ChevronDown, Calendar, BookOpen, Users, Layers, LayoutGrid } from 'lucide-react';

// Custom Click Outside Hook
function useOnClickOutside(ref: any, handler: any) {
  useEffect(() => {
    const listener = (event: any) => {
      if (!ref.current || ref.current.contains(event.target)) return;
      handler(event);
    };
    document.addEventListener('mousedown', listener);
    return () => document.removeEventListener('mousedown', listener);
  }, [ref, handler]);
}

export const AcademicInsights: React.FC = () => {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Multi-select filters
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [selectedExams, setSelectedExams] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);

  // Date Filter States
  const [dateFilterType, setDateFilterType] = useState<'Overall' | 'Month' | 'Single' | 'Range'>('Overall');
  const [dateMonth, setDateMonth] = useState<string>(''); // YYYY-MM
  const [dateSingle, setDateSingle] = useState<string>(''); // YYYY-MM-DD
  const [dateStart, setDateStart] = useState<string>(''); // YYYY-MM-DD
  const [dateEnd, setDateEnd] = useState<string>(''); // YYYY-MM-DD

  const [activeTab, setActiveTab] = useState<'PassingRate' | 'SubjectPerformance' | 'TopPerformers' | 'AtRisk'>('PassingRate');

  const [exams, setExams] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);

  // Settings
  const [globalClasses, setGlobalClasses] = useState<string[]>([]);
  const [globalSectionsMapping, setGlobalSectionsMapping] = useState<Record<string, string[]>>({});
  const [globalSubjectsMapping, setGlobalSubjectsMapping] = useState<Record<string, string[]>>({});
  const globalExamTypes = ['Weekly Test', 'Monthly Test', 'Class Quiz', 'Mid Term', 'Final Term', 'Oral', 'Routine Test'];

  // Dropdown UI states
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  useOnClickOutside(dropdownRef, () => setOpenDropdown(null));

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resData, stuData, examData, settingsData] = await Promise.all([
        supabase.from('results').select('*').eq('is_submitted', true),
        supabase.from('students').select('id, name, roll_number, academic_class, section'),
        supabase.from('exams').select('id, title, created_at'),
        supabase.from('settings').select('value').eq('key', 'app_settings').single()
      ]);
      setResults(resData.data || []);
      setStudents(stuData.data || []);
      setExams(examData.data || []);

      const settings = settingsData.data?.value || {};
      setGlobalClasses(settings.classes || []);
      setGlobalSectionsMapping(settings.class_sections || {});
      setGlobalSubjectsMapping(settings.class_subjects || {});
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getResultInfo = (r: any) => {
    const student = students.find(s => s.id === r.student_id);
    const exam = exams.find(e => e.id === r.exam_id);
    return {
      class_name: student ? student.academic_class : 'Unknown',
      section: student ? student.section : 'Unknown',
      exam_term: exam ? exam.title : 'Unknown',
      created_at: r.created_at // Using result submission date
    };
  };

  // --- CASCADING LOGIC ---
  const availableClasses = globalClasses;
  
  // Sections based on selected classes
  const availableSections = useMemo(() => {
    const classesToUse = selectedClasses.length > 0 ? selectedClasses : availableClasses;
    const sections = new Set<string>();
    classesToUse.forEach(c => {
      if (globalSectionsMapping[c]) {
        globalSectionsMapping[c].forEach(s => sections.add(s));
      }
    });
    return Array.from(sections).sort();
  }, [selectedClasses, availableClasses, globalSectionsMapping]);

  // Subjects based on selected classes and sections (Grouped)
  const availableSubjectsGrouped = useMemo(() => {
    const classesToUse = selectedClasses.length > 0 ? selectedClasses : availableClasses;
    const grouped: Record<string, string[]> = {};
    classesToUse.forEach(c => {
      if (globalSubjectsMapping[c] && globalSubjectsMapping[c].length > 0) {
        grouped[c] = [...globalSubjectsMapping[c]];
      }
    });
    return grouped;
  }, [selectedClasses, availableClasses, globalSubjectsMapping]);

  const availableExams = globalExamTypes;

  // Filtered results
  const filteredResults = useMemo(() => {
    return results.filter(r => {
      const info = getResultInfo(r);
      const classMatch = selectedClasses.length === 0 || selectedClasses.includes(info.class_name);
      const secMatch = selectedSections.length === 0 || selectedSections.includes(info.section);
      
      // Because exam title might be "Mid Term - Class 10", we do partial match or exact match depending on how it's saved.
      // Usually in seed we saved it as "Mid Term - Class X" or just "Mid Term"
      let examMatch = selectedExams.length === 0;
      if (selectedExams.length > 0) {
         examMatch = selectedExams.some(e => info.exam_term.includes(e));
      }

      const subjMatch = selectedSubjects.length === 0 || selectedSubjects.includes(r.subject);
      
      // Date Match
      let dateMatch = true;
      if (info.created_at) {
        const resultDate = new Date(info.created_at);
        if (dateFilterType === 'Month' && dateMonth) {
          const [year, month] = dateMonth.split('-');
          if (resultDate.getFullYear().toString() !== year || (resultDate.getMonth() + 1).toString().padStart(2, '0') !== month) {
            dateMatch = false;
          }
        } else if (dateFilterType === 'Single' && dateSingle) {
          if (resultDate.toISOString().split('T')[0] !== dateSingle) {
            dateMatch = false;
          }
        } else if (dateFilterType === 'Range' && dateStart && dateEnd) {
          const start = new Date(dateStart);
          const end = new Date(dateEnd);
          end.setHours(23, 59, 59, 999);
          if (resultDate < start || resultDate > end) {
            dateMatch = false;
          }
        }
      }

      return classMatch && secMatch && examMatch && subjMatch && dateMatch;
    });
  }, [results, selectedClasses, selectedSections, selectedExams, selectedSubjects, students, exams, dateFilterType, dateMonth, dateSingle, dateStart, dateEnd]);

  // Analytics logic
  const analytics = useMemo(() => {
    let totalRecords = 0;
    let totalPassed = 0;
    
    const subjectStats: Record<string, { totalMarks: number, obtainedMarks: number, count: number }> = {};
    const studentStats: Record<string, { studentId: string, name: string, roll: string, totalObtained: number, totalMax: number, subjects: number, failedSubjects: number }> = {};

    filteredResults.forEach(r => {
      const total_marks = r.total_marks || 100;
      const obtained_marks = r.marks || 0;
      const passMark = total_marks * 0.4;
      
      totalRecords++;
      if (obtained_marks >= passMark) totalPassed++;

      if (!subjectStats[r.subject]) {
        subjectStats[r.subject] = { totalMarks: 0, obtainedMarks: 0, count: 0 };
      }

      subjectStats[r.subject].totalMarks += total_marks;
      subjectStats[r.subject].obtainedMarks += obtained_marks;
      subjectStats[r.subject].count++;

      if (!studentStats[r.student_id]) {
        const stu = students.find(s => s.id === r.student_id);
        studentStats[r.student_id] = { 
          studentId: r.student_id, 
          name: stu ? stu.name : 'Unknown Student', 
          roll: stu ? stu.roll_number : 'N/A',
          totalObtained: 0, 
          totalMax: 0, 
          subjects: 0, 
          failedSubjects: 0 
        };
      }
      studentStats[r.student_id].totalObtained += obtained_marks;
      studentStats[r.student_id].totalMax += total_marks;
      studentStats[r.student_id].subjects++;
      if (obtained_marks < passMark) {
        studentStats[r.student_id].failedSubjects++;
      }
    });

    const passRate = totalRecords > 0 ? Math.round((totalPassed / totalRecords) * 100) : 0;
    const failRate = totalRecords > 0 ? 100 - passRate : 0;

    const subjects = Object.keys(subjectStats).map(sub => {
      const stat = subjectStats[sub];
      return {
        subject: sub,
        avgPercentage: stat.totalMarks > 0 ? Math.round((stat.obtainedMarks / stat.totalMarks) * 100) : 0,
        count: stat.count
      };
    }).sort((a, b) => b.avgPercentage - a.avgPercentage);

    const studentsList = Object.values(studentStats).map(s => ({
      ...s,
      percentage: s.totalMax > 0 ? Math.round((s.totalObtained / s.totalMax) * 100) : 0
    }));

    const topPerformers = [...studentsList].sort((a, b) => b.percentage - a.percentage).slice(0, 10);
    const atRisk = [...studentsList].filter(s => s.failedSubjects >= 2 || s.percentage < 40).sort((a, b) => a.percentage - b.percentage);

    return { totalRecords, passRate, failRate, subjects, topPerformers, atRisk };
  }, [filteredResults, students]);

  const toggleFilter = (setter: any, value: string) => {
    setter((prev: string[]) => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
  };

  const removeFilter = (type: string, value: string) => {
    if (type === 'class') toggleFilter(setSelectedClasses, value);
    if (type === 'section') toggleFilter(setSelectedSections, value);
    if (type === 'exam') toggleFilter(setSelectedExams, value);
    if (type === 'subject') toggleFilter(setSelectedSubjects, value);
  };

  // Dropdown Component helper
  const DropdownButton = ({ id, label, icon: Icon, activeCount }: any) => (
    <button
      onClick={() => setOpenDropdown(openDropdown === id ? null : id)}
      style={{
        display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px',
        background: openDropdown === id ? '#F1F5F9' : '#FFFFFF',
        border: '1px solid #E2E8F0', borderRadius: '8px',
        color: '#1E293B', fontSize: '14px', fontWeight: 500,
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)', transition: 'all 0.2s', cursor: 'pointer'
      }}
    >
      <Icon size={16} color="#64748B" />
      <span>{label}</span>
      {activeCount > 0 && (
        <span style={{ background: '#3B82F6', color: 'white', borderRadius: '12px', padding: '2px 8px', fontSize: '12px', fontWeight: 600 }}>
          {activeCount}
        </span>
      )}
      <ChevronDown size={16} color="#94A3B8" style={{ marginLeft: 'auto', transform: openDropdown === id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
    </button>
  );

  const CheckboxItem = ({ label, checked, onChange }: any) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 16px', cursor: 'pointer', transition: 'background 0.1s' }} onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      <input type="checkbox" checked={checked} onChange={onChange} style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#3B82F6' }} />
      <span style={{ fontSize: '14px', color: '#334155' }}>{label}</span>
    </label>
  );

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '64px' }}>
        <div className="spinner" style={{ width: '32px', height: '32px', border: '3px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      </div>
    );
  }

  return (
    <div className="academic-insights" style={{ animation: 'fadeIn 0.3s ease-out' }}>
      
      {/* PROFESSIONAL FILTERS SECTION */}
      <div style={{ background: 'white', padding: '24px', borderRadius: '12px', border: '1px solid var(--color-border)', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#1e293b' }}>
            <Filter size={18} color="#3b82f6" /> Professional Analytics Filters
          </h3>
          <span style={{ fontSize: '13px', color: '#64748b' }}>Showing data for {analytics.totalRecords.toLocaleString()} results</span>
        </div>
        
        {/* Dropdowns Row */}
        <div ref={dropdownRef} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', position: 'relative' }}>
          
          {/* Classes Dropdown */}
          <div style={{ position: 'relative' }}>
            <DropdownButton id="classes" label="Classes" icon={LayoutGrid} activeCount={selectedClasses.length} />
            {openDropdown === 'classes' && (
              <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, width: '240px', background: 'white', border: '1px solid #E2E8F0', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 50, maxHeight: '300px', overflowY: 'auto' }}>
                <div style={{ padding: '8px', borderBottom: '1px solid #E2E8F0' }}>
                  <button onClick={() => setSelectedClasses([])} style={{ width: '100%', padding: '6px', background: selectedClasses.length === 0 ? '#EFF6FF' : 'transparent', color: selectedClasses.length === 0 ? '#2563EB' : '#475569', borderRadius: '6px', fontSize: '13px', fontWeight: 600, textAlign: 'left', cursor: 'pointer', border: 'none' }}>
                    All Classes (Default)
                  </button>
                </div>
                <div style={{ padding: '8px 0' }}>
                  {availableClasses.map(c => (
                    <CheckboxItem key={c} label={c} checked={selectedClasses.includes(c)} onChange={() => toggleFilter(setSelectedClasses, c)} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sections Dropdown */}
          <div style={{ position: 'relative' }}>
            <DropdownButton id="sections" label="Sections" icon={Layers} activeCount={selectedSections.length} />
            {openDropdown === 'sections' && (
              <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, width: '220px', background: 'white', border: '1px solid #E2E8F0', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 50, maxHeight: '300px', overflowY: 'auto' }}>
                <div style={{ padding: '8px', borderBottom: '1px solid #E2E8F0' }}>
                  <button onClick={() => setSelectedSections([])} style={{ width: '100%', padding: '6px', background: selectedSections.length === 0 ? '#EFF6FF' : 'transparent', color: selectedSections.length === 0 ? '#2563EB' : '#475569', borderRadius: '6px', fontSize: '13px', fontWeight: 600, textAlign: 'left', cursor: 'pointer', border: 'none' }}>
                    All Sections (Default)
                  </button>
                </div>
                <div style={{ padding: '8px 0' }}>
                  {availableSections.length === 0 ? <div style={{ padding: '8px 16px', fontSize: '13px', color: '#94A3B8' }}>No sections available</div> : null}
                  {availableSections.map(s => (
                    <CheckboxItem key={s} label={`Section ${s}`} checked={selectedSections.includes(s)} onChange={() => toggleFilter(setSelectedSections, s)} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Exam Types Dropdown */}
          <div style={{ position: 'relative' }}>
            <DropdownButton id="exams" label="Exam Types" icon={BookOpen} activeCount={selectedExams.length} />
            {openDropdown === 'exams' && (
              <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, width: '240px', background: 'white', border: '1px solid #E2E8F0', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 50, maxHeight: '300px', overflowY: 'auto' }}>
                <div style={{ padding: '8px', borderBottom: '1px solid #E2E8F0' }}>
                  <button onClick={() => setSelectedExams([])} style={{ width: '100%', padding: '6px', background: selectedExams.length === 0 ? '#EFF6FF' : 'transparent', color: selectedExams.length === 0 ? '#2563EB' : '#475569', borderRadius: '6px', fontSize: '13px', fontWeight: 600, textAlign: 'left', cursor: 'pointer', border: 'none' }}>
                    All Exam Types (Default)
                  </button>
                </div>
                <div style={{ padding: '8px 0' }}>
                  {availableExams.map(e => (
                    <CheckboxItem key={e} label={e} checked={selectedExams.includes(e)} onChange={() => toggleFilter(setSelectedExams, e)} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Subjects Dropdown (Grouped) */}
          <div style={{ position: 'relative' }}>
            <DropdownButton id="subjects" label="Subjects" icon={Users} activeCount={selectedSubjects.length} />
            {openDropdown === 'subjects' && (
              <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, width: '280px', background: 'white', border: '1px solid #E2E8F0', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 50, maxHeight: '400px', overflowY: 'auto' }}>
                <div style={{ padding: '8px', borderBottom: '1px solid #E2E8F0', position: 'sticky', top: 0, background: 'white', zIndex: 2 }}>
                  <button onClick={() => setSelectedSubjects([])} style={{ width: '100%', padding: '6px', background: selectedSubjects.length === 0 ? '#EFF6FF' : 'transparent', color: selectedSubjects.length === 0 ? '#2563EB' : '#475569', borderRadius: '6px', fontSize: '13px', fontWeight: 600, textAlign: 'left', cursor: 'pointer', border: 'none' }}>
                    All Subjects (Default)
                  </button>
                </div>
                <div style={{ padding: '8px 0' }}>
                  {Object.keys(availableSubjectsGrouped).length === 0 ? <div style={{ padding: '8px 16px', fontSize: '13px', color: '#94A3B8' }}>No subjects available</div> : null}
                  {Object.entries(availableSubjectsGrouped).map(([className, subjects]) => (
                    <div key={className} style={{ marginBottom: '8px' }}>
                      <div style={{ padding: '4px 16px', fontSize: '12px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', background: '#F8FAFC' }}>
                        {className}
                      </div>
                      {subjects.map(sub => (
                        <CheckboxItem key={`${className}-${sub}`} label={sub} checked={selectedSubjects.includes(sub)} onChange={() => toggleFilter(setSelectedSubjects, sub)} />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Date Range Dropdown */}
          <div style={{ position: 'relative' }}>
            <DropdownButton id="date" label={`Date: ${dateFilterType}`} icon={Calendar} activeCount={dateFilterType !== 'Overall' ? 1 : 0} />
            {openDropdown === 'date' && (
              <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, width: '320px', background: 'white', border: '1px solid #E2E8F0', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 50, padding: '16px' }}>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', overflowX: 'auto', paddingBottom: '4px' }}>
                  {['Overall', 'Month', 'Single', 'Range'].map(type => (
                    <button key={type} onClick={() => setDateFilterType(type as any)} style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: dateFilterType === type ? '1px solid #3B82F6' : '1px solid #E2E8F0', background: dateFilterType === type ? '#EFF6FF' : 'white', color: dateFilterType === type ? '#1D4ED8' : '#64748B' }}>
                      {type}
                    </button>
                  ))}
                </div>

                {dateFilterType === 'Overall' && (
                  <div style={{ fontSize: '13px', color: '#64748B', textAlign: 'center', padding: '12px' }}>
                    Showing all time data (Default)
                  </div>
                )}

                {dateFilterType === 'Month' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Select Month & Year</label>
                    <input type="month" value={dateMonth} onChange={(e) => setDateMonth(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '14px', outline: 'none' }} />
                  </div>
                )}

                {dateFilterType === 'Single' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Select Specific Date</label>
                    <input type="date" value={dateSingle} onChange={(e) => setDateSingle(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '14px', outline: 'none' }} />
                  </div>
                )}

                {dateFilterType === 'Range' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>From Date</label>
                      <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '13px', outline: 'none' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>To Date</label>
                      <input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '13px', outline: 'none' }} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Active Filters Summary Area */}
        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px dashed #E2E8F0' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748B', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Filters</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            
            {selectedClasses.map(c => (
              <div key={`class-${c}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#EFF6FF', color: '#1D4ED8', padding: '4px 10px', borderRadius: '16px', fontSize: '13px', fontWeight: 500, border: '1px solid #BFDBFE' }}>
                <LayoutGrid size={12} /> {c}
                <button onClick={() => removeFilter('class', c)} style={{ background: 'none', border: 'none', color: '#1E3A8A', cursor: 'pointer', padding: 0, display: 'flex' }}><X size={14} /></button>
              </div>
            ))}

            {selectedSections.map(s => (
              <div key={`sec-${s}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#F0FDF4', color: '#15803D', padding: '4px 10px', borderRadius: '16px', fontSize: '13px', fontWeight: 500, border: '1px solid #BBF7D0' }}>
                <Layers size={12} /> Section {s}
                <button onClick={() => removeFilter('section', s)} style={{ background: 'none', border: 'none', color: '#14532D', cursor: 'pointer', padding: 0, display: 'flex' }}><X size={14} /></button>
              </div>
            ))}

            {selectedExams.map(e => (
              <div key={`exam-${e}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#FAF5FF', color: '#7E22CE', padding: '4px 10px', borderRadius: '16px', fontSize: '13px', fontWeight: 500, border: '1px solid #E9D5FF' }}>
                <BookOpen size={12} /> {e}
                <button onClick={() => removeFilter('exam', e)} style={{ background: 'none', border: 'none', color: '#581C87', cursor: 'pointer', padding: 0, display: 'flex' }}><X size={14} /></button>
              </div>
            ))}

            {selectedSubjects.map(s => (
              <div key={`sub-${s}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#FFFBEB', color: '#B45309', padding: '4px 10px', borderRadius: '16px', fontSize: '13px', fontWeight: 500, border: '1px solid #FDE68A' }}>
                <Users size={12} /> {s}
                <button onClick={() => removeFilter('subject', s)} style={{ background: 'none', border: 'none', color: '#78350F', cursor: 'pointer', padding: 0, display: 'flex' }}><X size={14} /></button>
              </div>
            ))}

            {dateFilterType !== 'Overall' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#F8FAFC', color: '#334155', padding: '4px 10px', borderRadius: '16px', fontSize: '13px', fontWeight: 500, border: '1px solid #E2E8F0' }}>
                <Calendar size={12} /> 
                {dateFilterType === 'Month' ? `Month: ${dateMonth || 'Not set'}` : ''}
                {dateFilterType === 'Single' ? `Date: ${dateSingle || 'Not set'}` : ''}
                {dateFilterType === 'Range' ? `Range: ${dateStart || '?'} to ${dateEnd || '?'}` : ''}
                <button onClick={() => setDateFilterType('Overall')} style={{ background: 'none', border: 'none', color: '#0F172A', cursor: 'pointer', padding: 0, display: 'flex' }}><X size={14} /></button>
              </div>
            )}

            {(selectedClasses.length === 0 && selectedSections.length === 0 && selectedExams.length === 0 && selectedSubjects.length === 0 && dateFilterType === 'Overall') && (
              <span style={{ fontSize: '13px', color: '#94A3B8', fontStyle: 'italic', padding: '4px 0' }}>All filters set to Default (Viewing all data)</span>
            )}

          </div>
        </div>
      </div>

      {/* Analytics Tabs */}
      <div className="profile-tabs-container card profile-tabs-card" style={{ marginBottom: '24px' }}>
        <nav className="profile-nav-horizontal" style={{ borderBottom: 'none', padding: '0 16px', overflowX: 'auto' }}>
          <button 
            className={`profile-tab-horizontal ${activeTab === 'PassingRate' ? 'active' : ''}`}
            onClick={() => setActiveTab('PassingRate')}
          >
            <BarChart3 size={16} />
            <span>Passing Rate</span>
          </button>
          <button 
            className={`profile-tab-horizontal ${activeTab === 'SubjectPerformance' ? 'active' : ''}`}
            onClick={() => setActiveTab('SubjectPerformance')}
          >
            <TrendingUp size={16} />
            <span>Subject Performance</span>
          </button>
          <button 
            className={`profile-tab-horizontal ${activeTab === 'TopPerformers' ? 'active' : ''}`}
            onClick={() => setActiveTab('TopPerformers')}
          >
            <Trophy size={16} />
            <span>Top Performers</span>
          </button>
          <button 
            className={`profile-tab-horizontal ${activeTab === 'AtRisk' ? 'active' : ''}`}
            onClick={() => setActiveTab('AtRisk')}
          >
            <AlertTriangle size={16} />
            <span>At-Risk Students</span>
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div style={{ background: 'white', padding: '32px', borderRadius: '12px', border: '1px solid var(--color-border)', minHeight: '300px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        {filteredResults.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
            <Filter size={48} style={{ opacity: 0.2, margin: '0 auto 16px' }} />
            <h3 style={{ margin: '0 0 8px', color: '#1e293b', fontSize: '18px' }}>No Results Found</h3>
            <p style={{ margin: 0 }}>Try adjusting your filters or ensure exams have been published.</p>
          </div>
        ) : (
          <>
            {activeTab === 'PassingRate' && (
              <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '32px', color: '#1e293b' }}>Overall Passing Rate (40% Standard)</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '48px', flexWrap: 'wrap' }}>
                  
                  {/* Circular visual representation */}
                  <div style={{ position: 'relative', width: '200px', height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: `conic-gradient(#10B981 ${analytics.passRate}%, #EF4444 ${analytics.passRate}%)`, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                    <div style={{ position: 'absolute', width: '150px', height: '150px', background: 'white', borderRadius: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)' }}>
                      <span style={{ fontSize: '36px', fontWeight: 800, color: '#1e293b', lineHeight: 1 }}>{analytics.passRate}%</span>
                      <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600, marginTop: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Passed</span>
                    </div>
                  </div>
                  
                  {/* Legend */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, minWidth: '250px' }}>
                    <div style={{ padding: '20px', background: '#F0FDF4', borderRadius: '10px', border: '1px solid #BBF7D0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: '#10B981' }}></div>
                        <span style={{ fontWeight: 600, color: '#166534', fontSize: '16px' }}>Passed</span>
                      </div>
                      <span style={{ fontWeight: 700, fontSize: '20px', color: '#166534' }}>{analytics.passRate}%</span>
                    </div>
                    
                    <div style={{ padding: '20px', background: '#FEF2F2', borderRadius: '10px', border: '1px solid #FECACA', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: '#EF4444' }}></div>
                        <span style={{ fontWeight: 600, color: '#991B1B', fontSize: '16px' }}>Failed</span>
                      </div>
                      <span style={{ fontWeight: 700, fontSize: '20px', color: '#991B1B' }}>{analytics.failRate}%</span>
                    </div>

                    <div style={{ fontSize: '13px', color: '#64748b', marginTop: '12px', background: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <BarChart3 size={16} /> Based on {analytics.totalRecords.toLocaleString()} individual student exam records.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'SubjectPerformance' && (
              <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '24px', color: '#1e293b' }}>Subject-wise Performance</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
                  {analytics.subjects.map(s => (
                    <div key={s.subject} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '20px', borderRadius: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <span style={{ fontWeight: 600, color: '#334155', fontSize: '15px' }}>{s.subject}</span>
                        <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '15px' }}>{s.avgPercentage}% Avg</span>
                      </div>
                      <div style={{ width: '100%', height: '10px', background: '#E2E8F0', borderRadius: '5px', overflow: 'hidden' }}>
                        <div style={{ 
                          height: '100%', 
                          width: `${s.avgPercentage}%`, 
                          background: s.avgPercentage >= 75 ? '#10B981' : s.avgPercentage >= 50 ? '#3B82F6' : s.avgPercentage >= 40 ? '#F59E0B' : '#EF4444',
                          borderRadius: '5px'
                        }}></div>
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '12px', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Status: <span style={{ fontWeight: 600, color: s.avgPercentage >= 75 ? '#10B981' : s.avgPercentage >= 40 ? '#3B82F6' : '#EF4444' }}>{s.avgPercentage >= 75 ? 'Excellent' : s.avgPercentage >= 40 ? 'Average' : 'Needs Attention'}</span></span>
                        <span>{s.count} Entries</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'TopPerformers' && (
              <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '24px', color: '#1e293b' }}>Top Performers</h3>
                {analytics.topPerformers.length > 0 ? (
                  <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
                    {analytics.topPerformers.map((s, idx) => (
                      <div key={s.studentId} style={{ display: 'flex', alignItems: 'center', padding: '16px', border: '1px solid #E2E8F0', borderRadius: '12px', background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                        <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: idx === 0 ? '#FEF3C7' : idx === 1 ? '#F1F5F9' : idx === 2 ? '#FFEDD5' : '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '16px', color: idx === 0 ? '#D97706' : idx === 1 ? '#64748B' : idx === 2 ? '#C2410C' : '#3B82F6', marginRight: '16px', border: idx < 3 ? `1px solid ${idx === 0 ? '#FDE68A' : idx === 1 ? '#E2E8F0' : '#FED7AA'}` : 'none' }}>
                          #{idx + 1}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '15px' }}>{s.name}</div>
                          <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>Roll: {s.roll}</div>
                        </div>
                        <div style={{ textAlign: 'right', background: '#F0FDF4', padding: '8px 12px', borderRadius: '8px', border: '1px solid #BBF7D0' }}>
                          <div style={{ fontWeight: 700, fontSize: '16px', color: '#166534' }}>{s.percentage}%</div>
                          <div style={{ fontSize: '11px', color: '#15803D', fontWeight: 500, marginTop: '2px' }}>{s.totalObtained}/{s.totalMax}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>No student data available.</div>
                )}
              </div>
            )}

            {activeTab === 'AtRisk' && (
              <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 600, margin: 0, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle size={20} color="#EF4444" /> At-Risk Students
                  </h3>
                  <span style={{ fontSize: '13px', color: '#64748b', background: '#F1F5F9', padding: '6px 12px', borderRadius: '20px' }}>
                    Failing 2+ subjects or &lt;40% overall
                  </span>
                </div>
                
                {analytics.atRisk.length > 0 ? (
                  <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead style={{ background: '#F8FAFC' }}>
                        <tr>
                          <th style={{ padding: '14px 20px', borderBottom: '1px solid #E2E8F0', fontWeight: 600, color: '#475569', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Student</th>
                          <th style={{ padding: '14px 20px', borderBottom: '1px solid #E2E8F0', fontWeight: 600, color: '#475569', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Failed Subjects</th>
                          <th style={{ padding: '14px 20px', borderBottom: '1px solid #E2E8F0', fontWeight: 600, color: '#475569', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Overall Percentage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.atRisk.map((s, i) => (
                          <tr key={s.studentId} style={{ borderBottom: i === analytics.atRisk.length - 1 ? 'none' : '1px solid #E2E8F0', background: 'white', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#FAFAF9'} onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                            <td style={{ padding: '16px 20px' }}>
                              <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '14px' }}>{s.name}</div>
                              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Roll: {s.roll} | ID: {s.studentId.substring(0,8)}...</div>
                            </td>
                            <td style={{ padding: '16px 20px' }}>
                              <span style={{ padding: '6px 12px', background: '#FEF2F2', color: '#DC2626', borderRadius: '20px', fontSize: '12px', fontWeight: 600, display: 'inline-block', border: '1px solid #FECACA' }}>
                                {s.failedSubjects} Subject(s)
                              </span>
                            </td>
                            <td style={{ padding: '16px 20px', fontWeight: 700, fontSize: '15px', color: s.percentage < 40 ? '#DC2626' : '#334155' }}>
                              {s.percentage}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ padding: '48px 20px', textAlign: 'center', background: '#F0FDF4', borderRadius: '12px', border: '1px solid #BBF7D0' }}>
                    <div style={{ width: '64px', height: '64px', background: '#DCFCE7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                      <Check size={32} color="#16A34A" />
                    </div>
                    <h4 style={{ color: '#166534', margin: '0 0 8px', fontSize: '18px', fontWeight: 600 }}>Excellent Performance!</h4>
                    <p style={{ color: '#15803D', margin: 0, fontSize: '14px' }}>No students are currently marked as at-risk in the selected filters.</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

    </div>
  );
};
