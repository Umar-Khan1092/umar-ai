'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { BarChart, PieChart, TrendingUp, Users, Award, AlertTriangle, UserCheck, ChevronDown, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const _MultiSelect = ({ options, selected, onChange, placeholder }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleClickOutside = (event: any) => {
      if (ref.current && !ref.current.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter((item: string) => item !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  const isAllSelected = options.length > 0 && selected.length === options.length;

  const toggleAll = () => {
    if (isAllSelected) onChange([]);
    else onChange([...options]);
  };

  return (
    <div ref={ref} style={{ position: 'relative', flex: 1, minWidth: '160px' }}>
      <label className="input-label" style={{ fontSize: '12px', marginBottom: '4px', display: 'block' }}>{placeholder}</label>
      <div 
        className="input-field" 
        onClick={() => setIsOpen(!isOpen)}
        style={{ margin: 0, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', padding: '8px 12px' }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '14px' }}>
          {selected.length === 0 ? `Select ${placeholder}` : selected.length === options.length ? `All ${placeholder}` : `${selected.length} selected`}
        </span>
        <ChevronDown size={16} color="var(--color-text-secondary)" />
      </div>
      
      {isOpen && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', backgroundColor: 'white', border: '1px solid var(--color-border)', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', zIndex: 10, maxHeight: '250px', overflowY: 'auto' }}>
          {options.length > 0 && (
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--color-border)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '14px' }}>
                <input type="checkbox" checked={isAllSelected} onChange={toggleAll} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                Select All
              </label>
            </div>
          )}
          {options.length === 0 && (
             <div style={{ padding: '8px 12px', color: 'var(--color-text-secondary)', fontSize: '13px' }}>No options available</div>
          )}
          {options.map((opt: string) => (
            <div key={opt} style={{ padding: '8px 12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggleOption(opt)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                {opt}
              </label>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
void _MultiSelect;

export const AdminAcademicsAnalytics: React.FC = () => {
  const currentDate = new Date();
  const currentMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

  const [fromDate, _setFromDate] = useState<string>(currentMonthStr); // kept for future use
  const [toDate, _setToDate] = useState<string>(currentMonthStr); // kept for future use
  void fromDate; void toDate;
  
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const [availableSections, setAvailableSections] = useState<string[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [availableAssessments, setAvailableAssessments] = useState<string[]>([]);
  
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedAssessments, setSelectedAssessments] = useState<string[]>([]);

  const [settingsData, setSettingsData] = useState<any>(null);
  const [resultsData, setResultsData] = useState<any[]>([]);
  const [studentsData, setStudentsData] = useState<any[]>([]);
  const [staffData, setStaffData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalType, setModalType] = useState<'failures' | 'aplus' | null>(null);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([
      supabase.from('settings').select('*').eq('key', 'app_settings').single().then(res => res.data?.value || null),
      supabase.from('results').select('*').then(res => res.data || []),
      supabase.from('students').select('*').then(res => res.data || []),
      supabase.from('staff').select('*').then(res => res.data || [])
    ]).then(([settings, results, students, staff]) => {
      setSettingsData(settings);
      if (settings && settings.classes) {
        setAvailableClasses(settings.classes);
        setSelectedClasses(settings.classes.length > 0 ? [settings.classes[0]] : []);
      }
      if (settings) {
        let types: string[] = [];
        if (settings.assessment_types && settings.assessment_types.length > 0) {
          types = settings.assessment_types.map((a: any) => a.name);
        } else if (settings.exam_types && settings.exam_types.length > 0) {
          types = settings.exam_types;
        } else {
          types = ['Weekly Test', 'Monthly Test', 'Mid Term', 'Final Term'];
        }
        setAvailableAssessments(types);
        setSelectedAssessments(types.length > 0 ? [types[0]] : []);
      }
      setResultsData(results);
      setStudentsData(students);
      setStaffData(staff);
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!settingsData) return;
    
    // Compute available sections based on selected classes
    let sections = new Set<string>();
    if (settingsData.class_sections) {
      selectedClasses.forEach(c => {
        if (settingsData.class_sections[c]) {
          settingsData.class_sections[c].forEach((s: string) => sections.add(`${c}|${s}`));
        }
      });
    }
    const sectionList = Array.from(sections);
    setAvailableSections(sectionList);
    const validSelectedSections = selectedSections.filter(s => sectionList.includes(s));
    setSelectedSections(validSelectedSections.length > 0 || sectionList.length === 0 ? validSelectedSections : [sectionList[0]]);
    
    // Compute available subjects
    let subjects = new Set<string>();
    if (settingsData.class_subjects) {
      selectedClasses.forEach(c => {
        if (settingsData.class_subjects[c]) {
          settingsData.class_subjects[c].forEach((s: string) => subjects.add(`${c}|${s}`));
        }
      });
    }
    const subjectList = Array.from(subjects);
    setAvailableSubjects(subjectList);
    const validSelectedSubjects = selectedSubjects.filter(s => subjectList.includes(s));
    setSelectedSubjects(validSelectedSubjects.length > 0 || subjectList.length === 0 ? validSelectedSubjects : [subjectList[0]]);
    
  }, [selectedClasses, settingsData]);

  const analytics = useMemo(() => {
    if (isLoading) return null;

    let validResults = resultsData.filter(r => r.status === 'Published' || r.status === 'Submitted' || r.status === 'Draft'); 
    validResults = validResults.filter(r => {
      if (selectedClasses.length > 0 && !selectedClasses.includes(r.class_name)) return false;
      if (selectedSections.length > 0 && !selectedSections.includes(`${r.class_name}|${r.section}`)) return false;
      if (selectedSubjects.length > 0 && !selectedSubjects.includes(`${r.class_name}|${r.subject}`)) return false;
      if (selectedAssessments.length > 0 && !selectedAssessments.includes(r.exam_term)) return false;
      return true;
    });

    if (validResults.length === 0) return null;

    let totalObtained = 0;
    let totalMax = 0;
    let passCount = 0;
    let failCount = 0;
    let aPlusCount = 0;
    
    const studentTotals: Record<string, { obtained: number, max: number }> = {};
    const subjectTotals: Record<string, { obtained: number, max: number }> = {};
    const teacherTotals: Record<string, { pass: number, total: number }> = {};

    let failStudentIds = new Set<string>();
    let aPlusStudentIds = new Set<string>();

    validResults.forEach(r => {
      const maxMarks = r.total_marks || 100;
      if (!subjectTotals[r.subject]) subjectTotals[r.subject] = { obtained: 0, max: 0 };
      if (r.teacher_id && !teacherTotals[r.teacher_id]) teacherTotals[r.teacher_id] = { pass: 0, total: 0 };

      r.records.forEach((rec: any) => {
        const marks = rec.obtained_marks || 0;
        totalObtained += marks;
        totalMax += maxMarks;

        subjectTotals[r.subject].obtained += marks;
        subjectTotals[r.subject].max += maxMarks;

        if (!studentTotals[rec.student_id]) studentTotals[rec.student_id] = { obtained: 0, max: 0 };
        studentTotals[rec.student_id].obtained += marks;
        studentTotals[rec.student_id].max += maxMarks;

        const percentage = (marks / maxMarks) * 100;
        if (percentage >= 40) {
          passCount++;
          if (r.teacher_id) teacherTotals[r.teacher_id].pass++;
        } else {
          failCount++;
          failStudentIds.add(rec.student_id);
        }
        if (r.teacher_id) teacherTotals[r.teacher_id].total++;
        if (percentage >= 90) {
          aPlusCount++;
          aPlusStudentIds.add(rec.student_id);
        }
      });
    });

    const classAverage = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;
    const passRate = (passCount + failCount) > 0 ? (passCount / (passCount + failCount)) * 100 : 0;

    const topStudents = Object.keys(studentTotals).map(sid => {
      const sInfo = studentsData.find(s => s.id === sid);
      const st = studentTotals[sid];
      return {
        name: sInfo ? sInfo.name : 'Unknown Student',
        className: sInfo ? sInfo.academic_class : '-',
        section: sInfo ? sInfo.section : '-',
        marks: st.obtained,
        total: st.max,
        percentage: st.max > 0 ? (st.obtained / st.max) * 100 : 0
      };
    }).sort((a, b) => b.percentage - a.percentage).slice(0, 5);

    const subjectAverages = Object.keys(subjectTotals).map(subj => {
      const st = subjectTotals[subj];
      return { subject: subj, avg: st.max > 0 ? (st.obtained / st.max) * 100 : 0 };
    });

    const teacherPerformance = Object.keys(teacherTotals).map(tid => {
      const tInfo = staffData.find(t => t.id === tid);
      const tt = teacherTotals[tid];
      return {
        name: tInfo ? tInfo.name : 'Unknown Teacher',
        passRate: tt.total > 0 ? (tt.pass / tt.total) * 100 : 0
      };
    });

    const getStudentDetails = (sid: string) => {
      const s = studentsData.find(st => st.id === sid);
      return s ? { name: s.name, father_name: s.father_name, class: s.academic_class, section: s.section } : null;
    };

    const failStudentsList = Array.from(failStudentIds).map(getStudentDetails).filter(Boolean);
    const aPlusStudentsList = Array.from(aPlusStudentIds).map(getStudentDetails).filter(Boolean);

    return { classAverage, passRate, aPlusCount, failCount, topStudents, subjectAverages, teacherPerformance, failStudentsList, aPlusStudentsList };
  }, [resultsData, studentsData, staffData, selectedClasses, selectedSections, selectedSubjects, selectedAssessments, isLoading]);

  return (
    <div className="page-content" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '24px', marginBottom: '8px' }}>Academics Analytics</h1>
          <p className="body-text" style={{ color: 'var(--color-text-secondary)', margin: 0 }}>Analyze performance metrics, class averages, and top students.</p>
        </div>
      </div>

      <div className="card" style={{ padding: '24px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '20px', background: 'var(--color-surface)' }}>
        {/* Filters Row */}
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          {/* Classes */}
          <div style={{ flex: '1 1 200px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '15px', color: 'var(--color-text-main)', fontWeight: 600 }}>Classes</span>
              <button onClick={() => setSelectedClasses(selectedClasses.length === availableClasses.length ? [] : availableClasses)} style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: '13px', fontWeight: 500, cursor: 'pointer', padding: 0 }}>
                Select All
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', padding: '12px', border: '1px solid var(--color-border)', borderRadius: '4px', maxHeight: '200px', overflowY: 'auto', background: 'var(--color-surface)' }}>
              {availableClasses.map(c => (
                <label key={c} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', color: 'var(--color-text-secondary)', marginRight: '8px' }}>
                  <input type="checkbox" style={{ accentColor: '#2563EB', width: '16px', height: '16px', cursor: 'pointer' }} checked={selectedClasses.includes(c)} onChange={e => {
                    if (e.target.checked) setSelectedClasses([...selectedClasses, c]);
                    else setSelectedClasses(selectedClasses.filter(x => x !== c));
                  }} />
                  {c}
                </label>
              ))}
              {availableClasses.length === 0 && <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>No classes found</span>}
            </div>
          </div>

          {/* Sections */}
          <div style={{ flex: '1 1 200px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '15px', color: 'var(--color-text-main)', fontWeight: 600 }}>Sections</span>
              <button onClick={() => setSelectedSections(selectedSections.length === availableSections.length ? [] : availableSections)} style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: '13px', fontWeight: 500, cursor: 'pointer', padding: 0 }}>
                Select All
              </button>
            </div>
            <div style={{ padding: '12px', border: '1px solid var(--color-border)', borderRadius: '4px', maxHeight: '200px', overflowY: 'auto', background: 'var(--color-surface)' }}>
              {selectedClasses.length === 0 ? (
                <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Please select a class</span>
              ) : (
                selectedClasses.map((c, i) => {
                  const classSections = settingsData.class_sections?.[c] || [];
                  if (classSections.length === 0) return null;
                  return (
                    <div key={c} style={{ marginBottom: i === selectedClasses.length - 1 ? 0 : '12px', paddingBottom: i === selectedClasses.length - 1 ? 0 : '12px', borderBottom: i === selectedClasses.length - 1 ? 'none' : '1px solid var(--color-border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#8898AA', textTransform: 'uppercase' }}>
                          {c}
                        </div>
                        <button onClick={() => {
                          const classCompKeys = classSections.map((s: string) => `${c}|${s}`);
                          const allChecked = classCompKeys.every((compKey: string) => selectedSections.includes(compKey));
                          if (allChecked) {
                            setSelectedSections(selectedSections.filter(s => !classCompKeys.includes(s)));
                          } else {
                            setSelectedSections(Array.from(new Set([...selectedSections, ...classCompKeys])));
                          }
                        }} style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: '11px', fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                          Select All
                        </button>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                        {classSections.map((s: string) => {
                          const compKey = `${c}|${s}`;
                          return (
                          <label key={compKey} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', color: 'var(--color-text-secondary)', marginRight: '8px' }}>
                            <input type="checkbox" style={{ accentColor: '#2563EB', width: '16px', height: '16px', cursor: 'pointer' }} checked={selectedSections.includes(compKey)} onChange={e => {
                              if (e.target.checked) setSelectedSections([...selectedSections, compKey]);
                              else setSelectedSections(selectedSections.filter(x => x !== compKey));
                            }} />
                            {s}
                          </label>
                        )})}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          
          {/* Subjects */}
          <div style={{ flex: '1 1 200px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '15px', color: 'var(--color-text-main)', fontWeight: 600 }}>Subjects</span>
              <button onClick={() => setSelectedSubjects(selectedSubjects.length === availableSubjects.length ? [] : availableSubjects)} style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: '13px', fontWeight: 500, cursor: 'pointer', padding: 0 }}>
                Select All
              </button>
            </div>
            <div style={{ padding: '12px', border: '1px solid var(--color-border)', borderRadius: '4px', maxHeight: '200px', overflowY: 'auto', background: 'var(--color-surface)' }}>
              {selectedClasses.length === 0 ? (
                <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Please select a class</span>
              ) : (
                selectedClasses.map((c, i) => {
                  const classSubjects = settingsData.class_subjects?.[c] || [];
                  if (classSubjects.length === 0) return null;
                  return (
                    <div key={c} style={{ marginBottom: i === selectedClasses.length - 1 ? 0 : '12px', paddingBottom: i === selectedClasses.length - 1 ? 0 : '12px', borderBottom: i === selectedClasses.length - 1 ? 'none' : '1px solid var(--color-border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#8898AA', textTransform: 'uppercase' }}>
                          {c}
                        </div>
                        <button onClick={() => {
                          const classCompKeys = classSubjects.map((s: string) => `${c}|${s}`);
                          const allChecked = classCompKeys.every((compKey: string) => selectedSubjects.includes(compKey));
                          if (allChecked) {
                            setSelectedSubjects(selectedSubjects.filter(s => !classCompKeys.includes(s)));
                          } else {
                            setSelectedSubjects(Array.from(new Set([...selectedSubjects, ...classCompKeys])));
                          }
                        }} style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: '11px', fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                          Select All
                        </button>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                        {classSubjects.map((s: string) => {
                          const compKey = `${c}|${s}`;
                          return (
                          <label key={compKey} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', color: 'var(--color-text-secondary)', marginRight: '8px' }}>
                            <input type="checkbox" style={{ accentColor: '#2563EB', width: '16px', height: '16px', cursor: 'pointer' }} checked={selectedSubjects.includes(compKey)} onChange={e => {
                              if (e.target.checked) setSelectedSubjects([...selectedSubjects, compKey]);
                              else setSelectedSubjects(selectedSubjects.filter(x => x !== compKey));
                            }} />
                            {s}
                          </label>
                        )})}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Assessment Types */}
          <div style={{ flex: '1 1 200px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '15px', color: 'var(--color-text-main)', fontWeight: 600 }}>Assessment Types</span>
              <button onClick={() => setSelectedAssessments(selectedAssessments.length === availableAssessments.length ? [] : availableAssessments)} style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: '13px', fontWeight: 500, cursor: 'pointer', padding: 0 }}>
                Select All
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', padding: '12px', border: '1px solid var(--color-border)', borderRadius: '4px', maxHeight: '200px', overflowY: 'auto', background: 'var(--color-surface)' }}>
              {availableAssessments.map(a => (
                <label key={a} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', color: 'var(--color-text-secondary)', marginRight: '8px' }}>
                  <input type="checkbox" style={{ accentColor: '#2563EB', width: '16px', height: '16px', cursor: 'pointer' }} checked={selectedAssessments.includes(a)} onChange={e => {
                    if (e.target.checked) setSelectedAssessments([...selectedAssessments, a]);
                    else setSelectedAssessments(selectedAssessments.filter(x => x !== a));
                  }} />
                  {a}
                </label>
              ))}
              {availableAssessments.length === 0 && <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>No assessment types found</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Content */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px', color: 'var(--color-text-secondary)' }}>
          <Loader2 size={32} className="spin" style={{ marginBottom: '16px', color: 'var(--color-primary)', animation: 'spin 1s linear infinite' }} />
          <div>Loading analytics data...</div>
        </div>
      ) : !analytics ? (
        <div className="card" style={{ padding: '60px', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '16px' }}>
          <AlertTriangle size={48} color="var(--color-text-muted)" style={{ margin: '0 auto 16px auto', display: 'block' }} />
          No tests taken yet matching the selected filters.
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '24px' }}>
            <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', borderLeft: '4px solid #3B82F6' }}>
              <div style={{ backgroundColor: '#DBEAFE', padding: '12px', borderRadius: '50%' }}>
                <TrendingUp size={24} color="#2563EB" />
              </div>
              <div>
                <div style={{ color: 'var(--color-text-secondary)', fontSize: '13px', fontWeight: 600 }}>Class Average</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--color-text-heading)' }}>{analytics.classAverage.toFixed(1)}%</div>
              </div>
            </div>

            <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', borderLeft: '4px solid #10B981' }}>
              <div style={{ backgroundColor: '#D1FAE5', padding: '12px', borderRadius: '50%' }}>
                <UserCheck size={24} color="#059669" />
              </div>
              <div>
                <div style={{ color: 'var(--color-text-secondary)', fontSize: '13px', fontWeight: 600 }}>Pass Rate</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--color-text-heading)' }}>{analytics.passRate.toFixed(1)}%</div>
              </div>
            </div>

            <div className="card" onClick={() => analytics.aPlusCount > 0 && setModalType('aplus')} style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', borderLeft: '4px solid #F59E0B', cursor: analytics.aPlusCount > 0 ? 'pointer' : 'default', transition: 'box-shadow 0.2s', boxShadow: analytics.aPlusCount > 0 ? 'var(--shadow-sm)' : 'none' }}>
              <div style={{ backgroundColor: '#FEF3C7', padding: '12px', borderRadius: '50%' }}>
                <Award size={24} color="#D97706" />
              </div>
              <div>
                <div style={{ color: 'var(--color-text-secondary)', fontSize: '13px', fontWeight: 600 }}>A+ Grades</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--color-text-heading)' }}>{analytics.aPlusCount}</div>
              </div>
            </div>

            <div className="card" onClick={() => analytics.failCount > 0 && setModalType('failures')} style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', borderLeft: '4px solid #EF4444', cursor: analytics.failCount > 0 ? 'pointer' : 'default', transition: 'box-shadow 0.2s', boxShadow: analytics.failCount > 0 ? 'var(--shadow-sm)' : 'none' }}>
              <div style={{ backgroundColor: '#FEE2E2', padding: '12px', borderRadius: '50%' }}>
                <AlertTriangle size={24} color="#DC2626" />
              </div>
              <div>
                <div style={{ color: 'var(--color-text-secondary)', fontSize: '13px', fontWeight: 600 }}>Failures</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--color-text-heading)' }}>{analytics.failCount}</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
            {/* Left Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Top Students */}
              <div className="card" style={{ padding: '24px' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Award size={18} color="var(--color-primary)" /> Top Performers {selectedClasses.length > 0 ? `(${selectedClasses.length} Classes)` : ''}
                </h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead style={{ background: 'var(--color-bg-secondary)' }}>
                    <tr>
                      <th style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Rank</th>
                      <th style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Student Name</th>
                      <th style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Class</th>
                      <th style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Section</th>
                      <th style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Total Marks</th>
                      <th style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Percentage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.topStudents.map((student, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: i === 0 ? '#D97706' : 'var(--color-text-main)' }}>#{i+1}</td>
                        <td style={{ padding: '12px 16px' }}>{student.name}</td>
                        <td style={{ padding: '12px 16px' }}>{student.className}</td>
                        <td style={{ padding: '12px 16px' }}>{student.section}</td>
                        <td style={{ padding: '12px 16px' }}>{student.marks} / {student.total}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{student.percentage.toFixed(1)}%</td>
                      </tr>
                    ))}
                    {analytics.topStudents.length === 0 && (
                       <tr>
                         <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>No student records found</td>
                       </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Subject Averages */}
              <div className="card" style={{ padding: '24px' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <BarChart size={18} color="var(--color-primary)" /> Subject Averages
                </h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {analytics.subjectAverages.length > 0 ? analytics.subjectAverages.map((sub, i) => (
                    <div key={i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '13px' }}>
                        <span style={{ fontWeight: 500 }}>{sub.subject}</span>
                        <span>{sub.avg.toFixed(1)}%</span>
                      </div>
                      <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${sub.avg}%`, backgroundColor: sub.avg < 75 ? '#F59E0B' : 'var(--color-primary)' }}></div>
                      </div>
                    </div>
                  )) : (
                    <div style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: '24px 0' }}>No subject data available</div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Teacher Performance */}
              <div className="card" style={{ padding: '24px' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={18} color="var(--color-primary)" /> Teacher Performance
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {analytics.teacherPerformance.length > 0 ? analytics.teacherPerformance.map((teacher, i) => (
                    <div key={i} style={{ padding: '12px', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '8px' }}>
                      <div style={{ fontWeight: 500, fontSize: '14px', marginBottom: '4px' }}>{teacher.name}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                        <span>Pass Rate:</span>
                        <span style={{ fontWeight: 600, color: teacher.passRate > 90 ? '#10B981' : '#3B82F6' }}>{teacher.passRate.toFixed(1)}%</span>
                      </div>
                    </div>
                  )) : (
                     <div style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: '12px 0' }}>No teacher data available</div>
                  )}
                </div>
              </div>
              
              {/* Quick Insights */}
              <div className="card" style={{ padding: '24px', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#166534', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <PieChart size={18} /> Quick Insights
                </h3>
                <ul style={{ margin: 0, paddingLeft: '20px', color: '#14532D', fontSize: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {analytics.subjectAverages.length > 0 && (
                    <li><strong>{analytics.subjectAverages.sort((a,b) => a.avg - b.avg)[0].subject}</strong> has the lowest average ({analytics.subjectAverages.sort((a,b) => a.avg - b.avg)[0].avg.toFixed(1)}%). Additional focus is recommended.</li>
                  )}
                  <li>Overall pass rate is <strong>{analytics.passRate.toFixed(1)}%</strong> for the selected filters.</li>
                  <li><strong>{analytics.aPlusCount} students</strong> achieved A+ grades across all tests.</li>
                </ul>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Modal for A+ / Failures */}
      {modalType && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setModalType(null)}>
          <div className="card" onClick={e => e.stopPropagation()} style={{ padding: '24px', width: '90%', maxWidth: '700px', maxHeight: '80vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                {modalType === 'aplus' ? <Award size={20} color="#D97706" /> : <AlertTriangle size={20} color="#DC2626" />}
                {modalType === 'aplus' ? 'A+ Grade Students' : 'Failed Students'}
              </h2>
              <button onClick={() => setModalType(null)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>&times;</button>
            </div>
            
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ background: 'var(--color-bg-secondary)' }}>
                <tr>
                  <th style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--color-text-secondary)', fontWeight: 600, borderBottom: '1px solid var(--color-border)' }}>Name</th>
                  <th style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--color-text-secondary)', fontWeight: 600, borderBottom: '1px solid var(--color-border)' }}>Father's Name</th>
                  <th style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--color-text-secondary)', fontWeight: 600, borderBottom: '1px solid var(--color-border)' }}>Class</th>
                  <th style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--color-text-secondary)', fontWeight: 600, borderBottom: '1px solid var(--color-border)' }}>Section</th>
                </tr>
              </thead>
              <tbody>
                {(modalType === 'aplus' ? analytics?.aPlusStudentsList : analytics?.failStudentsList)?.map((s: any, i: number) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '12px 16px' }}>{s.name}</td>
                    <td style={{ padding: '12px 16px' }}>{s.father_name}</td>
                    <td style={{ padding: '12px 16px' }}>{s.class}</td>
                    <td style={{ padding: '12px 16px' }}>{s.section}</td>
                  </tr>
                ))}
                {(modalType === 'aplus' ? analytics?.aPlusStudentsList : analytics?.failStudentsList)?.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>No records found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAcademicsAnalytics;
