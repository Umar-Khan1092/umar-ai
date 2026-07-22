'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Calendar as CalendarIcon, LayoutList, Eye, Edit2, Trash2, ArrowRight, ArrowLeft, CheckCircle, Clock, BookOpen, Settings, Info } from 'lucide-react';
import { CustomTimePicker } from '@/components/ui/CustomTimePicker';
import { supabase } from '@/lib/supabase';

type SubjectSchedule = {
  date: string;
  time: string;
  duration: string;
  total_marks: number;
  passing_marks: number;
  use_uniform_teacher?: boolean;
  section_teachers: Record<string, string>;
};

type ClassRule = {
  sections: string[];
  subject_schedules: Record<string, SubjectSchedule>;
};

export const AdminExamSchedule: React.FC = () => {
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateStr;
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    let hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    return `${hour.toString().padStart(2, '0')}:${m} ${ampm}`;
  };

  const [activeTab, setActiveTab] = useState<'schedule' | 'list' | 'types' | 'datesheets'>('schedule');
  
  // Wizard State
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 5;

  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const [globalSections, setGlobalSections] = useState<string[]>([]);
  const [classSubjectsMap, setClassSubjectsMap] = useState<Record<string, string[]>>({});
  const [classSectionsMap, setClassSectionsMap] = useState<Record<string, string[]>>({});
  const [examTypes, setExamTypes] = useState<string[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  
  const [activeTimePicker, setActiveTimePicker] = useState<string | null>(null);
  const [exams, setExams] = useState<any[]>([]);
  const [editExamId, setEditExamId] = useState<string | null>(null);
  
  const [examBasic, setExamBasic] = useState({
    title: '',
    type: '',
    status: 'Active'
  });
  
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [classRules, setClassRules] = useState<Record<string, ClassRule>>({});
  
  // Similarity Check State
  const [useUniformConfig, setUseUniformConfig] = useState(false);
  const [globalConfig, setGlobalConfig] = useState({
    date: '',
    time: '',
    duration: '2 Hours',
    total_marks: 100,
    passing_marks: 40
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{type: 'success'|'error'|null, message: string}>({type: null, message: ''});

  useEffect(() => {
    fetchSettings();
    fetchExams();
    fetchTeachers();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data: res } = await supabase.from('settings').select('*').eq('key', 'app_settings').single();
      const data = res ? res.value : {};
      setAvailableClasses(data.classes || []);
      setGlobalSections(data.sections || []);
      setClassSubjectsMap(data.class_subjects || {});
      setClassSectionsMap(data.class_sections || {});
      
      const types = data.exam_types || [];
      setExamTypes(types);
      if (types.length > 0) {
        setExamBasic(prev => ({ ...prev, type: types[0] }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchExams = async () => {
    try {
      const { data, error } = await supabase.from('exams').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setExams(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTeachers = async () => {
    try {
      const { data, error } = await supabase.from('staff').select('*').eq('role', 'Teacher').eq('status', 'Active');
      if (error) throw error;
      setTeachers(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleBasicChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setExamBasic(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };


  const handleClassToggle = (cls: string) => {
    if (selectedClasses.includes(cls)) {
      setSelectedClasses(prev => prev.filter(c => c !== cls));
      const newRules = { ...classRules };
      delete newRules[cls];
      setClassRules(newRules);
    } else {
      setSelectedClasses([...selectedClasses, cls]);
      setClassRules(prev => ({
        ...prev,
        [cls]: {
          sections: [],
          subject_schedules: {}
        }
      }));
    }
  };

  const toggleSection = (cls: string, sec: string) => {
    const currentSections = classRules[cls].sections;
    let newSections = [];
    if (currentSections.includes(sec)) {
      newSections = currentSections.filter(s => s !== sec);
    } else {
      newSections = [...currentSections, sec];
    }
    
    setClassRules(prev => ({
      ...prev,
      [cls]: {
        ...prev[cls],
        sections: newSections
      }
    }));
  };
  
  const toggleSubject = (cls: string, sub: string) => {
    const currentSchedules = { ...classRules[cls].subject_schedules };
    if (currentSchedules[sub]) {
      delete currentSchedules[sub];
    } else {
      currentSchedules[sub] = {
        date: useUniformConfig ? globalConfig.date : '',
        time: useUniformConfig ? globalConfig.time : '',
        duration: useUniformConfig ? globalConfig.duration : '2 Hours',
        total_marks: useUniformConfig ? Number(globalConfig.total_marks) : 100,
        passing_marks: useUniformConfig ? Number(globalConfig.passing_marks) : 40,
        use_uniform_teacher: false,
        section_teachers: {}
      };
    }
    
    setClassRules(prev => ({
      ...prev,
      [cls]: {
        ...prev[cls],
        subject_schedules: currentSchedules
      }
    }));
  };

  const updateSubjectSchedule = (cls: string, sub: string, field: keyof SubjectSchedule, value: any) => {
    setClassRules(prev => ({
      ...prev,
      [cls]: {
        ...prev[cls],
        subject_schedules: {
          ...prev[cls].subject_schedules,
          [sub]: {
            ...prev[cls].subject_schedules[sub],
            [field]: value
          }
        }
      }
    }));
  };

  const handleTeacherAssignment = (cls: string, sub: string, section: string, teacherId: string) => {
    const currentTeachers = { ...classRules[cls].subject_schedules[sub].section_teachers };
    if (teacherId) {
      currentTeachers[section] = teacherId;
    } else {
      delete currentTeachers[section];
    }
    updateSubjectSchedule(cls, sub, 'section_teachers', currentTeachers);
  };

  const handleUniformTeacherAssignment = (cls: string, sub: string, teacherId: string) => {
    const sections = classRules[cls].sections;
    const currentTeachers: Record<string, string> = {};
    if (teacherId) {
      sections.forEach(sec => currentTeachers[sec] = teacherId);
    }
    updateSubjectSchedule(cls, sub, 'section_teachers', currentTeachers);
  };

  const selectAll = (cls: string, field: 'sections' | 'subjects') => {
    if (field === 'sections') {
      const allItems = (classSectionsMap[cls] && classSectionsMap[cls].length > 0) ? classSectionsMap[cls] : globalSections;
      setClassRules(prev => ({
        ...prev,
        [cls]: {
          ...prev[cls],
          sections: allItems
        }
      }));
    } else {
      const allItems = classSubjectsMap[cls] || [];
      const newSchedules = { ...classRules[cls].subject_schedules };
      allItems.forEach(sub => {
        if (!newSchedules[sub]) {
          newSchedules[sub] = {
            date: useUniformConfig ? globalConfig.date : '',
            time: useUniformConfig ? globalConfig.time : '',
            duration: useUniformConfig ? globalConfig.duration : '2 Hours',
            total_marks: useUniformConfig ? Number(globalConfig.total_marks) : 100,
            passing_marks: useUniformConfig ? Number(globalConfig.passing_marks) : 40,
            use_uniform_teacher: false,
            section_teachers: {}
          };
        }
      });
      setClassRules(prev => ({
        ...prev,
        [cls]: {
          ...prev[cls],
          subject_schedules: newSchedules
        }
      }));
    }
  };

  const selectAllClasses = () => {
    const newRules = { ...classRules };
    availableClasses.forEach(cls => {
      if (!newRules[cls]) {
        newRules[cls] = { sections: [], subject_schedules: {} };
      }
    });
    setSelectedClasses([...availableClasses]);
    setClassRules(newRules);
  };

  const deselectAllClasses = () => {
    setSelectedClasses([]);
    setClassRules({});
  };

  const deselectAll = (cls: string, field: 'sections' | 'subjects') => {
    if (field === 'sections') {
      setClassRules(prev => ({
        ...prev,
        [cls]: {
          ...prev[cls],
          sections: []
        }
      }));
    } else {
      setClassRules(prev => ({
        ...prev,
        [cls]: {
          ...prev[cls],
          subject_schedules: {}
        }
      }));
    }
  };

  const applyGlobalToAllSubjects = () => {
    const updatedRules = { ...classRules };
    for (const cls of selectedClasses) {
      if (updatedRules[cls] && updatedRules[cls].subject_schedules) {
        for (const subj of Object.keys(updatedRules[cls].subject_schedules)) {
          if (globalConfig.date) updatedRules[cls].subject_schedules[subj].date = globalConfig.date;
          if (globalConfig.time) updatedRules[cls].subject_schedules[subj].time = globalConfig.time;
          if (globalConfig.duration) updatedRules[cls].subject_schedules[subj].duration = globalConfig.duration;
          if (globalConfig.total_marks) updatedRules[cls].subject_schedules[subj].total_marks = Number(globalConfig.total_marks);
          if (globalConfig.passing_marks) updatedRules[cls].subject_schedules[subj].passing_marks = Number(globalConfig.passing_marks);
        }
      }
    }
    setClassRules(updatedRules);
  };
  
  const handleGlobalConfigChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setGlobalConfig(prev => ({ ...prev, [name]: value }));
  };

  // Wizard Navigation
  const validateStep = (step: number) => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    if (step === 1) {
      if (!examBasic.title) {
        newErrors['title'] = 'Exam title is required.';
        isValid = false;
      }

      if (selectedClasses.length === 0) {
        newErrors['classes'] = 'Please select at least one participating class.';
        isValid = false;
      }
      for (const cls of selectedClasses) {
        if (classRules[cls].sections.length === 0) {
          newErrors[`sections-${cls}`] = `Please select at least one section for ${cls}.`;
          isValid = false;
        }
      }
    }
    if (step === 2) {
      for (const cls of selectedClasses) {
        if (Object.keys(classRules[cls].subject_schedules).length === 0) {
          newErrors[`subjects-${cls}`] = `Please select at least one subject for ${cls}.`;
          isValid = false;
        }
      }
    }
    if (step === 4) {
      for (const cls of selectedClasses) {
        const rule = classRules[cls];
        for (const [sub, sched] of Object.entries(rule.subject_schedules)) {
          if (!sched.date) {
            newErrors[`date-${cls}-${sub}`] = 'Date is required.';
            isValid = false;
          }
          if (!sched.time) {
            newErrors[`time-${cls}-${sub}`] = 'Time is required.';
            isValid = false;
          }
          for (const sec of rule.sections) {
            if (!sched.section_teachers[sec]) {
              newErrors[`teacher-${cls}-${sub}-${sec}`] = 'Invigilator is required.';
              isValid = false;
            }
          }
        }
      }
    }

    setErrors(newErrors);
    if (!isValid) {
      setStatusMsg({ type: 'error', message: 'Please fix the highlighted errors before proceeding.' });
    } else {
      setStatusMsg({ type: null, message: '' });
    }
    return isValid;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      if (currentStep === 3 && useUniformConfig) {
        applyGlobalToAllSubjects();
      }
      setCurrentStep(prev => Math.min(prev + 1, totalSteps));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEdit = (exam: any) => {
    setEditExamId(exam.id);
    setExamBasic({
      title: exam.title,
      type: exam.type,
      status: exam.status || 'Active'
    });
    const classes = Object.keys(exam.class_rules || {});
    setSelectedClasses(classes);
    setClassRules(exam.class_rules || {});
    setActiveTab('schedule');
    setCurrentStep(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const handleCancelEdit = () => {
    setEditExamId(null);
    setExamBasic({ title: '', type: examTypes[0] || '', status: 'Active' });
    setSelectedClasses([]);
    setClassRules({});
    setCurrentStep(1);
  };

  const handleSubmit = async () => {
    if (!validateStep(4)) return;

    setIsLoading(true);
    setStatusMsg({ type: null, message: '' });

    try {
      const payload = {
        ...examBasic,
        class_rules: classRules
      };

      if (editExamId) {
        const { error } = await supabase.from('exams').update(payload).eq('id', editExamId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('exams').insert(payload);
        if (error) throw error;
      }

      setStatusMsg({ type: 'success', message: editExamId ? 'Exam updated successfully!' : 'Exam scheduled successfully!' });
      fetchExams();
      
      handleCancelEdit();
      setActiveTab('list');
      
      setTimeout(() => setStatusMsg({ type: null, message: '' }), 3000);
    } catch (err: any) {
      setStatusMsg({ type: 'error', message: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this exam schedule?')) return;
    try {
      const { error } = await supabase.from('exams').delete().eq('id', id);
      if (error) throw error;
      fetchExams();
      setStatusMsg({ type: 'success', message: 'Exam deleted successfully.' });
      setTimeout(() => setStatusMsg({ type: null, message: '' }), 3000);
    } catch (err: any) {
      setStatusMsg({ type: 'error', message: err.message });
    }
  };

  const getTeacherName = (id: string) => {
    const t = teachers.find(teacher => teacher.id === id);
    return t ? t.name : 'Unknown';
  };

  // Render Wizard Steps
  const renderWizardProgress = () => {
    const steps = [
      { label: 'Scope', icon: <Info size={16} /> },
      { label: 'Subjects', icon: <BookOpen size={16} /> },
      { label: 'Similarity', icon: <Settings size={16} /> },
      { label: 'Date Sheet', icon: <CalendarIcon size={16} /> },
      { label: 'Review', icon: <Eye size={16} /> }
    ];
    return (
      <div style={{ position: 'sticky', top: '0px', zIndex: 50, background: 'var(--color-background)', padding: '8px 0', borderBottom: '1px solid var(--color-border)', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ position: 'absolute', top: '50%', left: '0', right: '0', height: '2px', background: 'var(--color-border)', zIndex: 0, transform: 'translateY(-50%)' }}></div>
          {steps.map((step, index) => {
            const stepNum = index + 1;
            const isActive = currentStep === stepNum;
            const isPast = currentStep > stepNum;
            const isClickable = isPast || isActive;
            
            return (
              <div 
                key={step.label} 
                onClick={() => { if (isClickable && validateStep(currentStep)) setCurrentStep(stepNum) }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 1, cursor: isClickable ? 'pointer' : 'default', transition: 'transform 0.2s' }}
                onMouseEnter={e => isClickable && (e.currentTarget.style.transform = 'scale(1.05)')}
                onMouseLeave={e => isClickable && (e.currentTarget.style.transform = 'scale(1)')}
              >
                <div style={{ 
                  width: '36px', height: '36px', borderRadius: '50%', 
                  background: isActive ? 'var(--color-primary)' : isPast ? 'var(--color-success)' : 'var(--color-surface)',
                  border: `2px solid ${isActive || isPast ? 'transparent' : 'var(--color-border)'}`,
                  color: isActive || isPast ? '#fff' : 'var(--color-text-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: isActive ? '0 0 0 4px rgba(79, 70, 229, 0.15)' : 'none',
                  transition: 'all 0.3s ease'
                }}>
                  {isPast ? <CheckCircle size={18} /> : step.icon}
                </div>
                <span style={{ fontSize: '12px', marginTop: '6px', fontWeight: isActive ? 600 : 500, color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderStep1 = () => (
    <div className="card" style={{ padding: '20px', transform: 'none' }}>
      <h3 className="section-heading" style={{ fontSize: '16px', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px', marginBottom: '12px' }}>Step 1: Exam Scope</h3>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', margin: '0 0 16px 0' }}>Define the basic details of this exam and select which classes and sections will participate.</p>

      <div className="form-grid" style={{ marginBottom: '20px' }}>
        <div className="input-group">
          <label className="input-label">Exam Title <span style={{ color: 'var(--color-danger)' }}>*</span></label>
          <input type="text" className="input-field" name="title" value={examBasic.title} onChange={handleBasicChange} style={{ borderColor: errors['title'] ? 'var(--color-danger)' : '' }} placeholder="e.g. Mid-Term Examination 2024" />
          {errors['title'] && <span style={{ color: 'var(--color-danger)', fontSize: '12px' }}>{errors['title']}</span>}
        </div>
        <div className="input-group">
          <label className="input-label">Exam Type</label>
          <select className="input-field" name="type" value={examBasic.type} onChange={handleBasicChange}>
            {examTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="input-group">
          <label className="input-label">Status</label>
          <select className="input-field" name="status" value={examBasic.status} onChange={handleBasicChange}>
            <option value="Active">Active</option>
            <option value="Draft">Draft</option>
            <option value="Completed">Completed</option>
          </select>
        </div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <label className="input-label" style={{ margin: 0 }}>Participating Classes <span style={{ color: 'var(--color-danger)' }}>*</span></label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" onClick={selectAllClasses} style={{ fontSize: '12px', background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer' }}>Select All</button>
            <button type="button" onClick={deselectAllClasses} style={{ fontSize: '12px', background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer' }}>Deselect All</button>
          </div>
        </div>
        {errors['classes'] && <div style={{ color: 'var(--color-danger)', fontSize: '12px', marginBottom: '8px' }}>{errors['classes']}</div>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {availableClasses.map(cls => (
            <label key={cls} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', background: 'var(--color-background)', padding: '8px 16px', borderRadius: '6px', border: selectedClasses.includes(cls) ? '2px solid var(--color-primary)' : '1px solid var(--color-border)' }}>
              <input type="checkbox" checked={selectedClasses.includes(cls)} onChange={() => handleClassToggle(cls)} />
              <span style={{ fontSize: '14px', fontWeight: selectedClasses.includes(cls) ? 600 : 400 }}>{cls}</span>
            </label>
          ))}
        </div>
      </div>

      {selectedClasses.map(cls => {
        const sectionOptions = (classSectionsMap[cls] && classSectionsMap[cls].length > 0) ? classSectionsMap[cls] : globalSections;
        const allSectionsSelected = sectionOptions.length > 0 && classRules[cls]?.sections.length === sectionOptions.length;
        return (
          <div key={cls} style={{ borderLeft: `4px solid ${errors[`sections-${cls}`] ? 'var(--color-danger)' : 'var(--color-primary)'}`, paddingLeft: '16px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <strong style={{ fontSize: '15px', color: errors[`sections-${cls}`] ? 'var(--color-danger)' : 'var(--color-primary)' }}>{cls} — Sections</strong>
              {sectionOptions.length > 0 && (
                <button type="button" onClick={() => allSectionsSelected ? deselectAll(cls, 'sections') : selectAll(cls, 'sections')} style={{ fontSize: '12px', background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer' }}>
                  {allSectionsSelected ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>
            {errors[`sections-${cls}`] && <div style={{ color: 'var(--color-danger)', fontSize: '12px', marginBottom: '8px' }}>{errors[`sections-${cls}`]}</div>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {sectionOptions.map(sec => (
                <label key={sec} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', background: 'var(--color-background)', padding: '8px 16px', borderRadius: '6px', border: classRules[cls]?.sections.includes(sec) ? '2px solid var(--color-primary)' : '1px solid var(--color-border)' }}>
                  <input type="checkbox" checked={classRules[cls]?.sections.includes(sec) || false} onChange={() => toggleSection(cls, sec)} />
                  <span style={{ fontSize: '14px' }}>{sec}</span>
                </label>
              ))}
              {sectionOptions.length === 0 && <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>No sections configured in settings.</span>}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderStep2 = () => (
    <div className="card" style={{ padding: '20px', transform: 'none' }}>
      <h3 className="section-heading" style={{ fontSize: '16px', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px', marginBottom: '12px' }}>Step 2: Select Subjects Per Class</h3>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', margin: '0 0 16px 0' }}>Choose which subjects will be included in the exam for each selected class.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {selectedClasses.map(cls => {
          const subjects = classSubjectsMap[cls] || [];
          const rule = classRules[cls];
          const allSubjectsSelected = subjects.length > 0 && Object.keys(rule.subject_schedules).length === subjects.length;
          return (
            <div key={cls} style={{ borderLeft: `4px solid ${errors[`subjects-${cls}`] ? 'var(--color-danger)' : 'var(--color-primary)'}`, paddingLeft: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <strong style={{ fontSize: '15px', color: errors[`subjects-${cls}`] ? 'var(--color-danger)' : 'var(--color-primary)' }}>{cls} Subjects</strong>
                {subjects.length > 0 && (
                  <button type="button" onClick={() => allSubjectsSelected ? deselectAll(cls, 'subjects') : selectAll(cls, 'subjects')} style={{ fontSize: '12px', background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer' }}>
                    {allSubjectsSelected ? 'Deselect All' : 'Select All'}
                  </button>
                )}
              </div>
              {errors[`subjects-${cls}`] && <div style={{ color: 'var(--color-danger)', fontSize: '12px', marginBottom: '8px' }}>{errors[`subjects-${cls}`]}</div>}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {subjects.map(sub => (
                  <label key={sub} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', background: 'var(--color-background)', padding: '8px 16px', borderRadius: '6px', border: !!rule.subject_schedules[sub] ? '2px solid var(--color-primary)' : '1px solid var(--color-border)' }}>
                    <input type="checkbox" checked={!!rule.subject_schedules[sub]} onChange={() => toggleSubject(cls, sub)} />
                    <span style={{ fontSize: '14px', fontWeight: !!rule.subject_schedules[sub] ? 600 : 400 }}>{sub}</span>
                  </label>
                ))}
                {subjects.length === 0 && <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>No subjects mapped for this class.</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="card" style={{ padding: '20px', transform: 'none' }}>
      <h3 className="section-heading" style={{ fontSize: '16px', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px', marginBottom: '12px' }}>Step 3: Similarity Check</h3>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', margin: '0 0 16px 0' }}>Optionally set a uniform configuration to pre-fill the grid in the next step.</p>
      <div style={{ background: useUniformConfig ? '#EEF2FF' : 'var(--color-surface)', padding: '16px', borderRadius: '8px', border: useUniformConfig ? '2px solid var(--color-primary)' : '1px solid var(--color-border)', cursor: 'pointer' }} onClick={() => setUseUniformConfig(!useUniformConfig)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: useUniformConfig ? '16px' : '0' }}>
          <input type="checkbox" checked={useUniformConfig} onChange={() => {}} style={{ width: '20px', height: '20px', cursor: 'pointer' }}/>
          <div>
            <strong style={{ fontSize: '16px', color: 'var(--color-text-main)', display: 'block' }}>Yes, use a uniform configuration template</strong>
            <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Set default dates, times, or marks for all subjects.</span>
          </div>
        </div>
        {useUniformConfig && (
          <div className="form-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label" style={{ fontSize: '12px' }}>Default Date</label>
              <input type="date" className="input-field" name="date" value={globalConfig.date} onChange={handleGlobalConfigChange} />
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label" style={{ fontSize: '12px' }}>Default Time</label>
              <input type="text" readOnly className="input-field" name="time" value={globalConfig.time} onClick={() => setActiveTimePicker('global')} placeholder="--:--" style={{ cursor: 'pointer' }} />
              {activeTimePicker === 'global' && (
                <CustomTimePicker
                  time={globalConfig.time || '08:00 am'}
                  onSave={(newTime: string) => {
                    handleGlobalConfigChange({ target: { name: 'time', value: newTime } } as any);
                    setActiveTimePicker(null);
                  }}
                  onCancel={() => setActiveTimePicker(null)}
                />
              )}
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label" style={{ fontSize: '12px' }}>Duration</label>
              <input type="text" className="input-field" name="duration" value={globalConfig.duration} onChange={handleGlobalConfigChange} />
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label" style={{ fontSize: '12px' }}>Total Marks</label>
              <input type="number" className="input-field" name="total_marks" value={globalConfig.total_marks.toString()} onChange={handleGlobalConfigChange} />
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label" style={{ fontSize: '12px' }}>Pass Marks</label>
              <input type="number" className="input-field" name="passing_marks" value={globalConfig.passing_marks.toString()} onChange={handleGlobalConfigChange} />
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="card" style={{ padding: '20px', transform: 'none' }}>
      <h3 className="section-heading" style={{ fontSize: '16px', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px', marginBottom: '12px' }}>Step 4: Tailored Date Sheet Grid</h3>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', margin: '0 0 16px 0' }}>Configure exact dates, times, and assign specific teachers to sections for each subject.</p>

      {selectedClasses.length > 0 && selectedClasses.map(cls => {
        const rule = classRules[cls];
        if (Object.keys(rule.subject_schedules).length === 0) return null;

        return (
          <div key={cls} style={{ marginBottom: '32px', background: 'var(--color-background)', padding: '24px', borderRadius: '12px', border: '1px solid var(--color-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
            <h4 style={{ fontSize: '18px', color: 'var(--color-text-heading)', borderBottom: '2px solid var(--color-border)', paddingBottom: '12px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ background: 'var(--color-primary)', color: 'white', padding: '4px 10px', borderRadius: '6px', fontSize: '13px', fontWeight: 600 }}>Class</span> {cls}
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {Object.entries(rule.subject_schedules).map(([sub, sched]) => (
                <div key={sub} style={{ background: 'var(--color-surface)', padding: '20px', borderRadius: '8px', border: '1px solid var(--color-border)', borderLeft: '4px solid var(--color-primary)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{ fontWeight: 600, fontSize: '16px', color: 'var(--color-primary)' }}>{sub}</div>
                    {rule.sections.length > 0 && (
                      <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: 'var(--color-text-secondary)', background: 'var(--color-background)', padding: '6px 12px', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
                        <input type="checkbox" checked={!!sched.use_uniform_teacher} onChange={(e) => updateSubjectSchedule(cls, sub, 'use_uniform_teacher', e.target.checked)} />
                        Use same teacher for all sections
                      </label>
                    )}
                  </div>
                  
                  <div className="form-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '20px' }}>
                    <div className="input-group" style={{ marginBottom: 0 }}>
                      <label className="input-label" style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Date {useUniformConfig && <span style={{fontSize: '9px', color: 'var(--color-primary)'}}>(Locked)</span>}</span>
                        {sched.date && <span style={{ color: 'var(--color-primary)', fontWeight: 600, fontSize: '10px' }}>{new Date(sched.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' })}</span>}
                      </label>
                      <input type="date" className="input-field" style={{ padding: '6px', fontSize: '12px', borderColor: errors[`date-${cls}-${sub}`] ? 'var(--color-danger)' : '', backgroundColor: useUniformConfig ? '#f1f5f9' : 'white', cursor: useUniformConfig ? 'not-allowed' : 'text' }} name="date" value={sched.date} onChange={(e) => updateSubjectSchedule(cls, sub, 'date', e.target.value)} disabled={useUniformConfig} required />
                      {errors[`date-${cls}-${sub}`] && <span style={{ color: 'var(--color-danger)', fontSize: '10px', marginTop: '2px', display: 'block' }}>{errors[`date-${cls}-${sub}`]}</span>}
                    </div>
                    <div className="input-group" style={{ marginBottom: 0, position: 'relative' }}>
                      <label className="input-label" style={{ fontSize: '11px' }}>Time {useUniformConfig && <span style={{fontSize: '9px', color: 'var(--color-primary)'}}>(Locked)</span>}</label>
                      <input type="text" readOnly className="input-field" style={{ padding: '6px', fontSize: '12px', borderColor: errors[`time-${cls}-${sub}`] ? 'var(--color-danger)' : '', backgroundColor: useUniformConfig ? '#f1f5f9' : 'white', cursor: useUniformConfig ? 'not-allowed' : 'pointer' }} name="time" value={sched.time} onClick={() => !useUniformConfig && setActiveTimePicker(`${cls}-${sub}`)} disabled={useUniformConfig} required placeholder="--:--" />
                      {activeTimePicker === `${cls}-${sub}` && (
                        <CustomTimePicker 
                          time={sched.time || '08:00 am'}
                          onSave={(newTime: string) => {
                            updateSubjectSchedule(cls, sub, 'time', newTime);
                            setActiveTimePicker(null);
                          }}
                          onCancel={() => setActiveTimePicker(null)}
                        />
                      )}
                      {errors[`time-${cls}-${sub}`] && <span style={{ color: 'var(--color-danger)', fontSize: '10px', marginTop: '2px', display: 'block' }}>{errors[`time-${cls}-${sub}`]}</span>}
                    </div>
                    <div className="input-group" style={{ marginBottom: 0 }}>
                      <label className="input-label" style={{ fontSize: '11px' }}>Duration</label>
                      <input type="text" className="input-field" style={{ padding: '6px', fontSize: '12px', backgroundColor: useUniformConfig ? '#f1f5f9' : 'white', cursor: useUniformConfig ? 'not-allowed' : 'text' }} name="duration" value={sched.duration} onChange={(e) => updateSubjectSchedule(cls, sub, 'duration', e.target.value)} disabled={useUniformConfig} required />
                    </div>
                    <div className="input-group" style={{ marginBottom: 0 }}>
                      <label className="input-label" style={{ fontSize: '11px' }}>Total Marks</label>
                      <input type="number" className="input-field" style={{ padding: '6px', fontSize: '12px', backgroundColor: useUniformConfig ? '#f1f5f9' : 'white', cursor: useUniformConfig ? 'not-allowed' : 'text' }} name="total_marks" value={sched.total_marks.toString()} onChange={(e) => updateSubjectSchedule(cls, sub, 'total_marks', Number(e.target.value))} disabled={useUniformConfig} required />
                    </div>
                    <div className="input-group" style={{ marginBottom: 0 }}>
                      <label className="input-label" style={{ fontSize: '11px' }}>Pass Marks</label>
                      <input type="number" className="input-field" style={{ padding: '6px', fontSize: '12px', backgroundColor: useUniformConfig ? '#f1f5f9' : 'white', cursor: useUniformConfig ? 'not-allowed' : 'text' }} name="passing_marks" value={sched.passing_marks.toString()} onChange={(e) => updateSubjectSchedule(cls, sub, 'passing_marks', Number(e.target.value))} disabled={useUniformConfig} required />
                    </div>
                  </div>

                  {rule.sections.length > 0 && (
                    <div style={{ background: 'var(--color-background)', padding: '16px', borderRadius: '6px', border: '1px dashed var(--color-border)' }}>
                      <label className="input-label" style={{ fontSize: '12px', margin: '0 0 12px 0', display: 'block', color: 'var(--color-text-main)' }}>Assign Invigilators <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                      
                      {sched.use_uniform_teacher ? (
                        <div className="input-group" style={{ marginBottom: 0, maxWidth: '300px' }}>
                          <select 
                            className="input-field" 
                            style={{ padding: '6px 8px', fontSize: '13px', borderColor: errors[`teacher-${cls}-${sub}-${rule.sections[0]}`] ? 'var(--color-danger)' : '' }}
                            value={sched.section_teachers[rule.sections[0]] || ''} 
                            onChange={(e) => handleUniformTeacherAssignment(cls, sub, e.target.value)}
                          >
                            <option value="">-- Select Master Invigilator --</option>
                            {teachers.map(t => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                          {errors[`teacher-${cls}-${sub}-${rule.sections[0]}`] && <span style={{ color: 'var(--color-danger)', fontSize: '10px', marginTop: '2px', display: 'block' }}>Invigilator required for all sections</span>}
                        </div>
                      ) : (
                        <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                          {rule.sections.map(sec => (
                            <div key={sec} className="input-group" style={{ marginBottom: 0 }}>
                              <label className="input-label" style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Section {sec}</label>
                              <select 
                                className="input-field" 
                                style={{ padding: '6px 8px', fontSize: '13px', borderColor: errors[`teacher-${cls}-${sub}-${sec}`] ? 'var(--color-danger)' : '' }}
                                value={sched.section_teachers[sec] || ''} 
                                onChange={(e) => handleTeacherAssignment(cls, sub, sec, e.target.value)}
                              >
                                <option value="">-- Select Invigilator --</option>
                                {teachers.map(t => (
                                  <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                              </select>
                              {errors[`teacher-${cls}-${sub}-${sec}`] && <span style={{ color: 'var(--color-danger)', fontSize: '10px', marginTop: '2px', display: 'block' }}>{errors[`teacher-${cls}-${sub}-${sec}`]}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderStep5 = () => (
    <div className="card" style={{ padding: '20px' }}>
      <h3 className="section-heading" style={{ fontSize: '16px', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px', marginBottom: '12px' }}>Step 5: Review & Submit</h3>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', margin: '0 0 16px 0' }}>Review your date sheet. If everything is correct, click the Submit button below.</p>
      
      <div style={{ background: 'var(--color-surface)', padding: '16px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px dashed var(--color-border)' }}>
          <span style={{ background: '#E0E7FF', color: '#4338CA', padding: '6px 12px', borderRadius: '4px', fontSize: '14px', fontWeight: 600 }}>{examBasic.type}</span>
          <h2 style={{ margin: 0, fontSize: '20px', color: 'var(--color-text-heading)' }}>{examBasic.title}</h2>
          <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)', padding: '4px 8px', borderRadius: '4px' }}>Status: {examBasic.status}</span>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {selectedClasses.map(cls => {
            const r = classRules[cls];
            const subjects = Object.keys(r.subject_schedules);
            
            return (
              <div key={cls} style={{ fontSize: '13px', background: 'var(--color-background)', padding: '16px', borderRadius: '8px', borderLeft: '4px solid var(--color-primary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <strong style={{ color: 'var(--color-text-main)', fontSize: '15px' }}>{cls}</strong>
                  <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>Participating Sections: {r.sections.join(', ')}</span>
                </div>
                
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: 'var(--color-surface)', borderBottom: '2px solid var(--color-border)' }}>
                        <th style={{ padding: '8px 12px', color: 'var(--color-text-secondary)', fontWeight: 600, fontSize: '12px' }}>Subject</th>
                        <th style={{ padding: '8px 12px', color: 'var(--color-text-secondary)', fontWeight: 600, fontSize: '12px' }}>Date & Time</th>
                        <th style={{ padding: '8px 12px', color: 'var(--color-text-secondary)', fontWeight: 600, fontSize: '12px' }}>Details</th>
                        <th style={{ padding: '8px 12px', color: 'var(--color-text-secondary)', fontWeight: 600, fontSize: '12px' }}>Invigilators</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subjects.map(sub => {
                        const sched = r.subject_schedules[sub];
                        return (
                          <tr key={sub} style={{ borderBottom: '1px solid var(--color-border)' }}>
                            <td style={{ padding: '12px', fontWeight: 500 }}>{sub}</td>
                            <td style={{ padding: '12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                                <CalendarIcon size={12} style={{ color: 'var(--color-primary)' }}/> {formatDate(sched.date)}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-text-muted)' }}>
                                <Clock size={12}/> {formatTime(sched.time)}
                              </div>
                            </td>
                            <td style={{ padding: '12px', color: 'var(--color-text-secondary)' }}>
                              <div>Dur: {sched.duration}</div>
                              <div>Marks: {sched.passing_marks}/{sched.total_marks}</div>
                            </td>
                            <td style={{ padding: '12px' }}>
                              {r.sections.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  {r.sections.map(sec => {
                                    const tid = sched.section_teachers[sec];
                                    return (
                                      <div key={sec} style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                                        <span style={{ color: 'var(--color-text-muted)' }}>{sec}:</span>
                                        <span style={{ fontWeight: 500 }}>{tid ? getTeacherName(tid) : 'Unassigned'}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>No sections</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <div className="page-content" style={{ padding: '16px 24px' }}>
      <div style={{ marginBottom: '12px' }}>
        <h1 className="page-title" style={{ marginBottom: '4px', fontSize: '24px' }}>Exam Management</h1>
        <p className="body-text" style={{ color: 'var(--color-text-secondary)', margin: 0 }}>Rule-based scheduling for enterprise academic calendars.</p>
      </div>
      <div className="profile-tabs-container card profile-tabs-card" style={{ marginBottom: '16px', padding: '0 16px' }}>
        <nav className="profile-nav-horizontal" style={{ borderBottom: 'none', overflowX: 'auto' }}>
          <button 
            className={`profile-tab-horizontal ${activeTab === 'schedule' ? 'active' : ''}`}
            onClick={() => { setActiveTab('schedule'); handleCancelEdit(); }}
          >
            <CalendarIcon size={16} /> Schedule New Exam
          </button>
          <button 
            className={`profile-tab-horizontal ${activeTab === 'list' ? 'active' : ''}`}
            onClick={() => setActiveTab('list')}
          >
            <LayoutList size={16} /> Scheduled Rules
          </button>
          <button 
            className={`profile-tab-horizontal ${activeTab === 'datesheets' ? 'active' : ''}`}
            onClick={() => setActiveTab('datesheets')}
          >
            <BookOpen size={16} /> View Date Sheets
          </button>
        </nav>
      </div>

      {statusMsg.type && (
        <div className={`toast ${statusMsg.type}`} style={{ marginBottom: '24px' }}>
          {statusMsg.message}
        </div>
      )}

      {activeTab === 'datesheets' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {exams.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '60px', color: 'var(--color-text-muted)' }}>
              <CalendarIcon size={48} style={{ opacity: 0.2, margin: '0 auto 16px' }} />
              <h3>No exams scheduled yet.</h3>
            </div>
          ) : (
            exams.map(exam => {
              // Extract all unique sections per class that are participating in this exam
              const classNames = Object.keys(exam.class_rules || {});
              
              return (
                <div key={exam.id} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <div style={{ borderBottom: '2px solid var(--color-primary)', paddingBottom: '8px', marginBottom: '8px' }}>
                    <h2 style={{ margin: 0, color: 'var(--color-primary)' }}>{exam.title} ({exam.type})</h2>
                  </div>
                  
                  {classNames.map(cls => {
                    const rule = exam.class_rules[cls] as ClassRule;
                    
                    if (rule.sections.length === 0) return null;
                    
                    return rule.sections.map(sec => {
                      // Gather subject schedules for this specific class and section
                      const scheduleEntries: any[] = [];
                      for (const [sub, sched] of Object.entries(rule.subject_schedules)) {
                        scheduleEntries.push({
                          subject: sub,
                          date: sched.date,
                          time: sched.time,
                          duration: sched.duration
                        });
                      }
                      
                      // Sort by date and then time
                      scheduleEntries.sort((a, b) => {
                        if (a.date !== b.date) return a.date.localeCompare(b.date);
                        return a.time.localeCompare(b.time);
                      });
                      
                      return (
                        <div key={`${cls}-${sec}`} className="card" style={{ padding: '0', overflow: 'hidden' }}>
                          <div style={{ backgroundColor: 'var(--color-bg-secondary)', padding: '16px', borderBottom: '1px solid var(--color-border)' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--color-text-primary)' }}>
                              Class {cls} Section {sec}
                              <span style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', marginLeft: '12px', fontWeight: 'normal' }}>
                                (Incharge: Not Assigned)
                              </span>
                            </h3>
                          </div>
                          <table className="data-table" style={{ margin: 0, boxShadow: 'none', border: 'none', width: '100%' }}>
                            <thead>
                              <tr>
                                <th style={{ padding: '12px 16px', backgroundColor: 'white', borderBottom: '2px solid var(--color-border)' }}>Day & Date</th>
                                <th style={{ padding: '12px 16px', backgroundColor: 'white', borderBottom: '2px solid var(--color-border)' }}>Time</th>
                                <th style={{ padding: '12px 16px', backgroundColor: 'white', borderBottom: '2px solid var(--color-border)' }}>Subject</th>
                              </tr>
                            </thead>
                            <tbody>
                              {scheduleEntries.map((entry: any, i: number) => {
                                const d = new Date(entry.date);
                                const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
                                return (
                                  <tr key={i} style={{ borderBottom: '1px solid var(--color-border)', transition: 'background-color 0.2s' }}>
                                    <td style={{ padding: '12px 16px', fontWeight: 500 }}>
                                      <div style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>{dayName}</div>
                                      <div>{formatDate(entry.date)}</div>
                                    </td>
                                    <td style={{ padding: '12px 16px' }}>{formatTime(entry.time)} ({entry.duration})</td>
                                    <td style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--color-primary)' }}>{entry.subject}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      );
                    });
                  })}
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === 'list' && (
        <div className="exam-scheduled-list" style={{ maxWidth: '1000px', margin: '0 auto' }}>
          {/* List View Rendering Code */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: '16px', marginBottom: '24px' }}>
              <div>
                <h3 className="section-heading" style={{ fontSize: '18px', margin: 0, marginBottom: '4px' }}>Scheduled Date Sheets</h3>
                <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: 0 }}>View and manage your active exam schedules and date sheets.</p>
              </div>
              <button className="btn-primary" onClick={() => { setActiveTab('schedule'); handleCancelEdit(); }} style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center' }}>
                <Plus size={16} style={{ marginRight: '6px' }}/> Schedule New
              </button>
            </div>
            
            {exams.length === 0 ? (
              <div className="empty-state-placeholder" style={{ padding: '40px' }}>
                <CalendarIcon size={32} style={{ color: 'var(--color-text-muted)', marginBottom: '16px' }} />
                <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>No exams scheduled yet. Click 'Schedule New' to get started.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {exams.map(exam => {
                  const classNames = Object.keys(exam.class_rules || {});
                  
                  return (
                    <div key={exam.id} style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-card)', padding: '20px', background: 'var(--color-surface)', position: 'relative' }}>
                      <div style={{ position: 'absolute', top: '20px', right: '20px', display: 'flex', gap: '8px' }}>
                        <button onClick={() => handleEdit(exam)} title="Edit Rule" style={{ color: 'var(--color-text-secondary)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Edit2 size={16} />
                        </button>
                        <button 
                          title="Delete Rule"
                          onClick={() => handleDelete(exam.id)}
                          style={{ color: 'var(--color-danger)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--color-border)', paddingBottom: '16px' }}>
                        <span style={{ background: '#E0E7FF', color: '#4338CA', padding: '4px 10px', borderRadius: '4px', fontSize: '13px', fontWeight: 600 }}>{exam.type}</span>
                        <h4 style={{ margin: 0, fontSize: '18px', color: 'var(--color-text-heading)' }}>{exam.title}</h4>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {classNames.map(cls => {
                          const r = exam.class_rules[cls] as ClassRule;
                          const subjects = Object.keys(r.subject_schedules);
                          
                          return (
                            <div key={cls} style={{ fontSize: '13px', background: 'var(--color-background)', padding: '16px', borderRadius: '8px', borderLeft: '4px solid var(--color-primary)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                                <strong style={{ color: 'var(--color-text-main)', fontSize: '15px' }}>{cls}</strong>
                                <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>Participating Sections: {r.sections.join(', ')}</span>
                              </div>
                              
                              <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                  <thead>
                                    <tr style={{ background: 'var(--color-surface)', borderBottom: '2px solid var(--color-border)' }}>
                                      <th style={{ padding: '8px 12px', color: 'var(--color-text-secondary)', fontWeight: 600, fontSize: '12px' }}>Subject</th>
                                      <th style={{ padding: '8px 12px', color: 'var(--color-text-secondary)', fontWeight: 600, fontSize: '12px' }}>Date & Time</th>
                                      <th style={{ padding: '8px 12px', color: 'var(--color-text-secondary)', fontWeight: 600, fontSize: '12px' }}>Details</th>
                                      <th style={{ padding: '8px 12px', color: 'var(--color-text-secondary)', fontWeight: 600, fontSize: '12px' }}>Invigilators</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {subjects.map(sub => {
                                      const sched = r.subject_schedules[sub];
                                      return (
                                        <tr key={sub} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                          <td style={{ padding: '12px', fontWeight: 500 }}>{sub}</td>
                                          <td style={{ padding: '12px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                                              <CalendarIcon size={12} style={{ color: 'var(--color-primary)' }}/> {formatDate(sched.date)}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-text-muted)' }}>
                                              <Clock size={12}/> {formatTime(sched.time)}
                                            </div>
                                          </td>
                                          <td style={{ padding: '12px', color: 'var(--color-text-secondary)' }}>
                                            <div>Dur: {sched.duration}</div>
                                            <div>Marks: {sched.passing_marks}/{sched.total_marks}</div>
                                          </td>
                                          <td style={{ padding: '12px' }}>
                                            {r.sections.length > 0 ? (
                                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                {r.sections.map(sec => {
                                                  const tid = sched.section_teachers[sec];
                                                  return (
                                                    <div key={sec} style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                                                      <span style={{ color: 'var(--color-text-muted)' }}>{sec}:</span>
                                                      <span style={{ fontWeight: 500 }}>{tid ? getTeacherName(tid) : 'Unassigned'}</span>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            ) : (
                                              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>No sections</span>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'schedule' && (
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '20px', color: 'var(--color-text-heading)' }}>{editExamId ? 'Edit Exam Wizard' : 'Schedule Exam Wizard'}</h2>
              <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '13px' }}>Follow the steps to configure your date sheet.</p>
            </div>
            {editExamId && (
               <span style={{ fontSize: '11px', background: 'var(--color-warning)', padding: '4px 8px', borderRadius: '4px', color: '#B45309', fontWeight: 600 }}>Editing Mode</span>
            )}
          </div>

          {renderWizardProgress()}
          
          <div style={{ minHeight: '300px' }}>
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}
            {currentStep === 3 && renderStep3()}
            {currentStep === 4 && renderStep4()}
            {currentStep === 5 && renderStep5()}
          </div>

          <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', padding: '12px 20px', background: 'var(--color-surface)', position: 'sticky', bottom: '16px', boxShadow: '0 -4px 12px rgba(0,0,0,0.05)', zIndex: 40 }}>
            {currentStep > 1 ? (
              <button type="button" className="btn-secondary" onClick={prevStep} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ArrowLeft size={16} /> Back
              </button>
            ) : (
               <button type="button" className="btn-secondary" onClick={handleCancelEdit}>Cancel</button>
            )}
            
            <div style={{ display: 'flex', gap: '12px' }}>
              {currentStep < totalSteps ? (
                <button type="button" className="btn-primary" onClick={nextStep} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Next Step <ArrowRight size={16} />
                </button>
              ) : (
                <button type="button" className="btn-primary" onClick={handleSubmit} disabled={isLoading} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--color-success)', borderColor: 'var(--color-success)' }}>
                  {isLoading ? 'Saving...' : <><CheckCircle size={16} /> {editExamId ? 'Update Exam' : 'Confirm & Schedule'}</>}
                </button>
              )}
            </div>
          </div>
          
        </div>
      )}
    </div>
  );
};

export default AdminExamSchedule;
