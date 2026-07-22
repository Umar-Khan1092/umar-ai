'use client';

import React, { useState, useEffect } from 'react';
import '@/app/(admin)/settings/Settings.css';
import '@/components/ui/Input.css';
import { Clock, Calendar, Plus, X, Save, Edit2, LayoutGrid, LayoutList, Trash2, Upload, AlertTriangle, ArrowLeft } from 'lucide-react';
import { CustomTimePicker } from '@/components/ui/CustomTimePicker';
import { supabase, adminSupabase } from '@/lib/supabase';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'classes' | 'sections' | 'classForm' | 'degreeForm'>('classes');
  
  const [classes, setClasses] = useState<string[]>([]);
  const [sections, setSections] = useState<string[]>([]);
  const [classSubjects, setClassSubjects] = useState<Record<string, string[]>>({});
  const [classSections, setClassSections] = useState<Record<string, string[]>>({});
  const [classFees, setClassFees] = useState<Record<string, { monthly: string, transport: string, academy: string, absent_fine: string, custom_fees?: { title: string, amount: string }[] }>>({});
  
  const [schoolStartClass, setSchoolStartClass] = useState<string>('');
  const [schoolEndClass, setSchoolEndClass] = useState<string>('');
  
  const [instituteName, setInstituteName] = useState('');
  const [originalInstituteName, setOriginalInstituteName] = useState('');
  const [instituteLogo, setInstituteLogo] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [classPromotions, setClassPromotions] = useState<Record<string, string>>({});
  const [classTypes, setClassTypes] = useState<Record<string, 'Subject-wise' | 'Single Teacher'>>({});

  const [editingStartClass, setEditingStartClass] = useState(false);
  const [editingEndClass, setEditingEndClass] = useState(false);

  // School Schedule State
  const [workingDays, setWorkingDays] = useState<string[]>(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);
  const [schoolStartTime, setSchoolStartTime] = useState<string>('08:00');
  const [schoolEndTime, setSchoolEndTime] = useState<string>('14:00');
  const [editingWorkingDays, setEditingWorkingDays] = useState(false);
  const [showSchoolStartPicker, setShowSchoolStartPicker] = useState(false);
  const [showSchoolEndPicker, setShowSchoolEndPicker] = useState(false);

  // Delete Confirm Modal
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{type: 'class' | 'section', name: string} | null>(null);
  
  // Form State - Class
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [modalClassName, setModalClassName] = useState('');
  const [originalModalClassName, setOriginalModalClassName] = useState('');
  const [modalNumSubjects, setModalNumSubjects] = useState<number | ''>('');
  const [modalSubjects, setModalSubjects] = useState<string[]>([]);
  const [modalClassSections, setModalClassSections] = useState<string[]>([]);
  const [modalFees, setModalFees] = useState<{ monthly: string, transport: string, academy: string, absent_fine: string, custom_fees?: { title: string, amount: string }[] }>({ monthly: '', transport: '', academy: '', absent_fine: '', custom_fees: [] });
  const [modalNextClass, setModalNextClass] = useState<string>('');
  const [modalClassType, setModalClassType] = useState<'Subject-wise' | 'Single Teacher'>('Subject-wise');
  const [originalFormState, setOriginalFormState] = useState<string>('');
  
  // Fee Checkboxes
  const [hasAbsentFine, setHasAbsentFine] = useState(false);
  const [hasTransportFee, setHasTransportFee] = useState(false);
  const [hasAcademyFee, setHasAcademyFee] = useState(false);

  // Form State - Degree Program
  const [degreeProgramName, setDegreeProgramName] = useState('');
  const [degreeTotalSemesters, setDegreeTotalSemesters] = useState<number | ''>('');

  const [newSection, setNewSection] = useState('');
  
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const dbClient = adminSupabase || supabase;
    Promise.resolve(dbClient.from('settings').select('*').eq('key', 'app_settings').single())
      .then(res => {
        const data = res.data?.value || {};
        setClasses(data.classes || []);
        setSections(data.sections || []);
        setClassSubjects(data.class_subjects || {});
        setClassSections(data.class_sections || {});
        setClassFees(data.class_fees || {});
        setSchoolStartClass(data.school_start_class || '');
        setSchoolEndClass(data.school_end_class || '');
        if (data.working_days) setWorkingDays(data.working_days);
        if (data.school_start_time) setSchoolStartTime(data.school_start_time);
        if (data.school_end_time) setSchoolEndTime(data.school_end_time);
        if (data.institute_name) {
          setInstituteName(data.institute_name);
          setOriginalInstituteName(data.institute_name);
        }
        if (data.institute_logo) setInstituteLogo(data.institute_logo);
        setClassPromotions(data.class_promotions || {});
        setClassTypes(data.class_types || {});
      })
      .catch((err: any) => console.error('Failed to load settings:', err));
  }, []);

  const getFormStateStr = (name: string, numSub: any, subs: any, secs: any, fees: any, nxt: string, flags: any) => {
    return JSON.stringify({ name, numSub, subs, secs, fees, nxt, flags });
  };

  const isFormDirty = () => {
    const flags = { hasAbsentFine, hasTransportFee, hasAcademyFee };
    return originalFormState !== getFormStateStr(modalClassName, modalNumSubjects, modalSubjects, modalClassSections, modalFees, modalNextClass, flags);
  };

  const handleOpenAddForm = () => {
    setFormMode('add');
    setModalClassName('');
    setOriginalModalClassName('');
    setModalNumSubjects('');
    setModalSubjects([]);
    setModalClassSections([]);
    setModalFees({ monthly: '', transport: '', academy: '', absent_fine: '', custom_fees: [] });
    setModalNextClass('');
    setModalClassType('Subject-wise');
    setHasAbsentFine(false);
    setHasTransportFee(false);
    setHasAcademyFee(false);
    const flags = { hasAbsentFine: false, hasTransportFee: false, hasAcademyFee: false };
    setOriginalFormState(getFormStateStr('', '', [], [], { monthly: '', transport: '', academy: '', absent_fine: '', custom_fees: [] }, '', flags));
    setActiveTab('classForm');
  };

  const handleOpenDegreeForm = () => {
    setDegreeProgramName('');
    setDegreeTotalSemesters('');
    setModalFees({ monthly: '', transport: '', academy: '', absent_fine: '', custom_fees: [] });
    setHasAbsentFine(false);
    setHasTransportFee(false);
    setHasAcademyFee(false);
    setActiveTab('degreeForm');
  };

  const handleOpenEditForm = (cls: string) => {
    setFormMode('edit');
    setModalClassName(cls);
    setOriginalModalClassName(cls);
    const existingSubjects = classSubjects[cls] || [];
    const existingSections = classSections[cls] || [];
    setModalNumSubjects(existingSubjects.length);
    setModalSubjects([...existingSubjects]);
    setModalClassSections([...existingSections]);
    const fees = classFees[cls] || { monthly: '', transport: '', academy: '', absent_fine: '', custom_fees: [] };
    setModalFees(fees);
    const nextClass = classPromotions[cls] || '';
    setModalNextClass(nextClass);
    setModalClassType(classTypes[cls] || 'Subject-wise');
    
    setHasAbsentFine(!!fees.absent_fine);
    setHasTransportFee(!!fees.transport);
    setHasAcademyFee(!!fees.academy);

    const flags = { hasAbsentFine: !!fees.absent_fine, hasTransportFee: !!fees.transport, hasAcademyFee: !!fees.academy };
    setOriginalFormState(getFormStateStr(cls, existingSubjects.length, [...existingSubjects], [...existingSections], fees, nextClass, flags));
    setActiveTab('classForm');
  };

  const handleNumSubjectsChange = (val: string) => {
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 0) {
      setModalNumSubjects(num);
      setModalSubjects(prev => {
        const newArr = [...prev];
        while (newArr.length < num) newArr.push('');
        while (newArr.length > num) newArr.pop();
        return newArr;
      });
    } else if (val === '') {
      setModalNumSubjects('');
      setModalSubjects([]);
    }
  };

  const handleSubjectNameChange = (index: number, val: string) => {
    setModalSubjects(prev => {
      const newArr = [...prev];
      newArr[index] = val;
      return newArr;
    });
  };

  const handleAddCustomFee = () => {
    setModalFees({ ...modalFees, custom_fees: [...(modalFees.custom_fees || []), { title: '', amount: '' }] });
  };

  const handleUpdateCustomFee = (index: number, field: 'title' | 'amount', value: string) => {
    const updated = [...(modalFees.custom_fees || [])];
    updated[index] = { ...updated[index], [field]: value };
    setModalFees({ ...modalFees, custom_fees: updated });
  };

  const handleRemoveCustomFee = (index: number) => {
    const updated = [...(modalFees.custom_fees || [])];
    updated.splice(index, 1);
    setModalFees({ ...modalFees, custom_fees: updated });
  };

  const toBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });

  const syncBackend = async (payloadOverride: any = {}) => {
    setIsLoading(true);
    setStatus({ type: null, message: '' });

    try {
      let finalLogoPath = instituteLogo;
      if (logoFile) {
        finalLogoPath = await toBase64(logoFile);
        setInstituteLogo(finalLogoPath);
        setLogoFile(null);
      }

      // Use service-role client for reads AND writes to bypass RLS on the settings table.
      // Settings is an admin-only page so this is safe.
      const dbClient = adminSupabase || supabase;

      const { data: currentData } = await dbClient.from('settings').select('*').eq('key', 'app_settings').single();
      const currentSettings = currentData?.value || {};

      const payload = { 
        ...currentSettings,
        institute_name: instituteName,
        institute_logo: finalLogoPath,
        classes, sections, class_subjects: classSubjects, class_sections: classSections, class_fees: classFees, 
        class_promotions: classPromotions,
        school_start_class: schoolStartClass, school_end_class: schoolEndClass,
        working_days: workingDays, school_start_time: schoolStartTime, school_end_time: schoolEndTime,
        ...payloadOverride
      };

      const { data: updatedData, error } = await dbClient.from('settings').upsert({ key: 'app_settings', value: payload }, { onConflict: 'key' }).select();
      if (error) throw error;
      if (!updatedData || updatedData.length === 0) throw new Error('Settings save returned no data — please check your Supabase project.');
      console.log('Settings successfully saved to DB:', updatedData);
      
      setStatus({ type: 'success', message: 'Settings saved successfully!' });
      setTimeout(() => setStatus({ type: null, message: '' }), 3000);
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'An error occurred' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveClass = async () => {
    if (!modalClassName.trim()) return;
    
    let updatedClasses = [...classes];
    let updatedSubjects = { ...classSubjects };
    let updatedClassSections = { ...classSections };
    let updatedFees = { ...classFees };
    let updatedPromotions = { ...classPromotions };
    let updatedClassTypes = { ...classTypes };
    
    const cleanSubjects = modalSubjects.map(s => s.trim()).filter(Boolean);
    
    if (formMode === 'add') {
      if (!updatedClasses.includes(modalClassName.trim())) {
        updatedClasses.push(modalClassName.trim());
      }
    } else if (formMode === 'edit') {
      const newName = modalClassName.trim();
      if (originalModalClassName !== newName) {
        updatedClasses = updatedClasses.map(c => c === originalModalClassName ? newName : c);
        delete updatedSubjects[originalModalClassName];
        delete updatedClassSections[originalModalClassName];
        delete updatedFees[originalModalClassName];
        delete updatedPromotions[originalModalClassName];
        delete updatedClassTypes[originalModalClassName];
      }
    }
    
    const finalFees = {
      monthly: modalFees.monthly,
      absent_fine: hasAbsentFine ? modalFees.absent_fine : '',
      transport: hasTransportFee ? modalFees.transport : '',
      academy: hasAcademyFee ? modalFees.academy : '',
      custom_fees: modalFees.custom_fees
    };

    updatedSubjects[modalClassName.trim()] = cleanSubjects;
    updatedClassSections[modalClassName.trim()] = modalClassSections;
    updatedFees[modalClassName.trim()] = finalFees;
    updatedPromotions[modalClassName.trim()] = modalNextClass;
    updatedClassTypes[modalClassName.trim()] = modalClassType;
    
    setClasses(updatedClasses);
    setClassSubjects(updatedSubjects);
    setClassSections(updatedClassSections);
    setClassFees(updatedFees);
    setClassPromotions(updatedPromotions);
    setClassTypes(updatedClassTypes);
    
    await syncBackend({ 
      classes: updatedClasses, 
      class_subjects: updatedSubjects, 
      class_sections: updatedClassSections,
      class_fees: updatedFees,
      class_promotions: updatedPromotions,
      class_types: updatedClassTypes
    });
    
    setActiveTab('classes');
  };

  const handleSaveDegree = async () => {
    if (!degreeProgramName.trim() || !degreeTotalSemesters) return;
    const count = Number(degreeTotalSemesters);
    if (count < 1) return;

    let updatedClasses = [...classes];
    let updatedSubjects = { ...classSubjects };
    let updatedFees = { ...classFees };
    let updatedPromotions = { ...classPromotions };

    const baseFees = {
      monthly: modalFees.monthly,
      absent_fine: hasAbsentFine ? modalFees.absent_fine : '',
      transport: hasTransportFee ? modalFees.transport : '',
      academy: hasAcademyFee ? modalFees.academy : '',
      custom_fees: modalFees.custom_fees
    };

    const newClassNames = [];
    for (let i = 1; i <= count; i++) {
      const className = `${degreeProgramName.trim()} Semester ${i}`;
      if (!updatedClasses.includes(className)) {
        updatedClasses.push(className);
      }
      newClassNames.push(className);
      updatedSubjects[className] = [];
      updatedFees[className] = baseFees;
    }

    for (let i = 0; i < count; i++) {
      const current = newClassNames[i];
      if (i < count - 1) {
        updatedPromotions[current] = newClassNames[i + 1];
      } else {
        updatedPromotions[current] = 'Completed';
      }
    }

    setClasses(updatedClasses);
    setClassSubjects(updatedSubjects);
    setClassFees(updatedFees);
    setClassPromotions(updatedPromotions);

    await syncBackend({
      classes: updatedClasses,
      class_subjects: updatedSubjects,
      class_fees: updatedFees,
      class_promotions: updatedPromotions
    });

    setActiveTab('classes');
  };

  const confirmDelete = (type: 'class' | 'section', name: string) => {
    setDeleteTarget({ type, name });
    setDeleteConfirmOpen(true);
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    
    let payloadOverride: any = {};

    if (deleteTarget.type === 'class') {
      const cls = deleteTarget.name;
      const updatedClasses = classes.filter(c => c !== cls);
      const newSubjects = { ...classSubjects }; delete newSubjects[cls];
      const newClassSections = { ...classSections }; delete newClassSections[cls];
      const newClassFees = { ...classFees }; delete newClassFees[cls];
      const newClassPromotions = { ...classPromotions }; delete newClassPromotions[cls];
      
      setClasses(updatedClasses);
      setClassSubjects(newSubjects);
      setClassSections(newClassSections);
      setClassFees(newClassFees);
      setClassPromotions(newClassPromotions);
      
      payloadOverride = {
        classes: updatedClasses,
        class_subjects: newSubjects,
        class_sections: newClassSections,
        class_fees: newClassFees,
        class_promotions: newClassPromotions
      };
    } else {
      const updatedSections = sections.filter(s => s !== deleteTarget.name);
      setSections(updatedSections);
      payloadOverride = { sections: updatedSections };
    }
    setDeleteConfirmOpen(false);
    setDeleteTarget(null);
    
    await syncBackend(payloadOverride);
  };

  const handleAddSection = async () => {
    if (newSection.trim() && !sections.includes(newSection.trim())) {
      const updatedSections = [...sections, newSection.trim()];
      setSections(updatedSections);
      setNewSection('');
      await syncBackend({ sections: updatedSections });
    }
  };

  const handleUpdateBranding = async () => {
    await syncBackend({ institute_name: instituteName });
    setOriginalInstituteName(instituteName);
  };

  const handleSetStartEndClass = async (type: 'start' | 'end', val: string) => {
    if (type === 'start') {
      setSchoolStartClass(val);
      await syncBackend({ school_start_class: val });
    } else {
      setSchoolEndClass(val);
      await syncBackend({ school_end_class: val });
    }
  };

  return (
    <div className="page-content" style={{ padding: 'var(--space-6)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <div>
          <h1 className="section-heading" style={{ marginBottom: '8px' }}>System Settings</h1>
          <p className="subtitle">Configure academics and system preferences.</p>
        </div>
      </div>

      {status.type && (
        <div className={`toast ${status.type}`} style={{ marginBottom: 'var(--space-4)' }}>
          {status.message}
        </div>
      )}

      {activeTab !== 'classForm' && activeTab !== 'degreeForm' && (
        <>
          <div className="card" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 className="section-heading" style={{ margin: 0 }}>Institute Branding</h2>
              <button className="btn-primary" onClick={handleUpdateBranding} disabled={isLoading || (instituteName === originalInstituteName && logoFile === null)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Save size={16} />
                {isLoading ? 'Saving...' : 'Update Branding'}
              </button>
            </div>
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 300px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Institute Name</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="e.g. Springfield High School" 
                  value={instituteName}
                  onChange={(e) => setInstituteName(e.target.value)}
                />
              </div>
              <div style={{ flex: '1 1 300px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Institute Logo</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '64px', height: '64px', borderRadius: '8px', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: 'var(--color-bg-secondary)' }}>
                    {logoFile ? (
                      <img src={URL.createObjectURL(logoFile)} alt="Logo Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    ) : instituteLogo ? (
                      <img src={instituteLogo} alt="Institute Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    ) : (
                      <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>No Logo</span>
                    )}
                  </div>
                  <div>
                    <label className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <Upload size={16} />
                      Upload New Logo
                      <input 
                        type="file" 
                        accept="image/*" 
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setLogoFile(e.target.files[0]);
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="profile-tabs-container card profile-tabs-card" style={{ marginBottom: '16px' }}>
            <nav className="profile-nav-horizontal" style={{ borderBottom: 'none' }}>
              <button 
                className={`profile-tab-horizontal ${activeTab === 'classes' ? 'active' : ''}`}
                onClick={() => setActiveTab('classes')}
              >
                <LayoutGrid size={16} /> Classes & Subjects
              </button>
              <button 
                className={`profile-tab-horizontal ${activeTab === 'sections' ? 'active' : ''}`}
                onClick={() => setActiveTab('sections')}
              >
                <LayoutList size={16} /> Sections
              </button>
            </nav>
          </div>
        </>
      )}

      {activeTab === 'classes' && (
        <div className="classes-tab-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 className="section-heading" style={{ margin: 0 }}>Manage Classes & Programs</h2>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn-secondary" onClick={handleOpenDegreeForm} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus size={16} /> Add Degree Program (Semesters)
              </button>
              <button className="btn-primary" onClick={handleOpenAddForm} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus size={16} /> Add New Class
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div className="premium-class-card" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--color-text-main)' }}>Starting Class</h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {editingStartClass ? (
                    <button className="btn-primary" onClick={() => { handleSetStartEndClass('start', schoolStartClass); setEditingStartClass(false); }} title="Save" style={{ padding: '6px 12px', fontSize: '13px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <Save size={14} /> Save
                    </button>
                  ) : (
                    <button className="btn-secondary" onClick={() => setEditingStartClass(true)} title="Edit" style={{ padding: '6px 12px', fontSize: '13px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <Edit2 size={14} /> Edit
                    </button>
                  )}
                  {schoolStartClass && editingStartClass && (
                    <button className="icon-btn danger" onClick={() => { setSchoolStartClass(''); handleSetStartEndClass('start', ''); setEditingStartClass(false); }} title="Remove">
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>
              
              {editingStartClass ? (
                <select className="input-field" value={schoolStartClass} onChange={(e) => setSchoolStartClass(e.target.value)}>
                  <option value="">-- Select Start Class --</option>
                  <optgroup label="Pre-Primary">
                    <option value="Playgroup">Playgroup</option>
                    <option value="Nursery">Nursery</option>
                    <option value="Prep">Prep</option>
                  </optgroup>
                  <optgroup label="Primary">
                    <option value="Class 1">Class 1</option>
                    <option value="Class 2">Class 2</option>
                    <option value="Class 3">Class 3</option>
                    <option value="Class 4">Class 4</option>
                    <option value="Class 5">Class 5</option>
                  </optgroup>
                  <optgroup label="Middle">
                    <option value="Class 6">Class 6</option>
                    <option value="Class 7">Class 7</option>
                    <option value="Class 8">Class 8</option>
                  </optgroup>
                  <optgroup label="Secondary (Matric)">
                    <option value="Class 9">Class 9</option>
                    <option value="Class 10">Class 10</option>
                  </optgroup>
                  <optgroup label="Higher Secondary (Inter)">
                    <option value="Class 11">Class 11</option>
                    <option value="Class 12">Class 12</option>
                  </optgroup>
                  <optgroup label="Degree">
                    <option value="Bachelors (BS)">Bachelors (BS)</option>
                    <option value="Masters">Masters</option>
                  </optgroup>
                </select>
              ) : (
                <div style={{ padding: '8px 12px', background: 'var(--color-bg-secondary)', borderRadius: '6px', fontSize: '14px', color: 'var(--color-text-main)' }}>
                  {schoolStartClass || 'Not Set'}
                </div>
              )}
            </div>
            
            <div className="premium-class-card" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--color-text-main)' }}>End Class</h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {editingEndClass ? (
                    <button className="btn-primary" onClick={() => { handleSetStartEndClass('end', schoolEndClass); setEditingEndClass(false); }} title="Save" style={{ padding: '6px 12px', fontSize: '13px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <Save size={14} /> Save
                    </button>
                  ) : (
                    <button className="btn-secondary" onClick={() => setEditingEndClass(true)} title="Edit" style={{ padding: '6px 12px', fontSize: '13px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <Edit2 size={14} /> Edit
                    </button>
                  )}
                  {schoolEndClass && editingEndClass && (
                    <button className="icon-btn danger" onClick={() => { setSchoolEndClass(''); handleSetStartEndClass('end', ''); setEditingEndClass(false); }} title="Remove">
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>
              
              {editingEndClass ? (
                <select className="input-field" value={schoolEndClass} onChange={(e) => setSchoolEndClass(e.target.value)}>
                  <option value="">-- Select End Class --</option>
                  <optgroup label="Pre-Primary">
                    <option value="Playgroup">Playgroup</option>
                    <option value="Nursery">Nursery</option>
                    <option value="Prep">Prep</option>
                  </optgroup>
                  <optgroup label="Primary">
                    <option value="Class 1">Class 1</option>
                    <option value="Class 2">Class 2</option>
                    <option value="Class 3">Class 3</option>
                    <option value="Class 4">Class 4</option>
                    <option value="Class 5">Class 5</option>
                  </optgroup>
                  <optgroup label="Middle">
                    <option value="Class 6">Class 6</option>
                    <option value="Class 7">Class 7</option>
                    <option value="Class 8">Class 8</option>
                  </optgroup>
                  <optgroup label="Secondary (Matric)">
                    <option value="Class 9">Class 9</option>
                    <option value="Class 10">Class 10</option>
                  </optgroup>
                  <optgroup label="Higher Secondary (Inter)">
                    <option value="Class 11">Class 11</option>
                    <option value="Class 12">Class 12</option>
                  </optgroup>
                  <optgroup label="Degree">
                    <option value="Bachelors (BS)">Bachelors (BS)</option>
                    <option value="Masters">Masters</option>
                  </optgroup>
                </select>
              ) : (
                <div style={{ padding: '8px 12px', background: 'var(--color-bg-secondary)', borderRadius: '6px', fontSize: '14px', color: 'var(--color-text-main)' }}>
                  {schoolEndClass || 'Not Set'}
                </div>
              )}
            </div>
          </div>

          <h2 style={{ fontSize: '1.25rem', marginTop: '32px', marginBottom: '16px', color: 'var(--color-text-main)', borderBottom: '2px solid var(--color-border)', paddingBottom: '8px' }}>School Schedule & Timing</h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px', marginBottom: '20px' }}>
            <div className="premium-class-card" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--color-text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}><Calendar size={18} color="var(--color-primary)" /> Working Days</h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {editingWorkingDays ? (
                    <button className="btn-primary" onClick={() => { syncBackend({ working_days: workingDays }); setEditingWorkingDays(false); }} title="Save" style={{ padding: '6px 12px', fontSize: '13px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <Save size={14} /> Save
                    </button>
                  ) : (
                    <button className="btn-secondary" onClick={() => setEditingWorkingDays(true)} title="Edit" style={{ padding: '6px 12px', fontSize: '13px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <Edit2 size={14} /> Edit
                    </button>
                  )}
                </div>
              </div>
              
              {editingWorkingDays ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                  {DAYS.map(day => (
                    <label key={day} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', cursor: 'pointer', background: 'var(--color-bg-secondary)', padding: '6px 12px', borderRadius: '20px', border: workingDays.includes(day) ? '1px solid var(--color-primary)' : '1px solid transparent' }}>
                      <input 
                        type="checkbox" 
                        checked={workingDays.includes(day)} 
                        onChange={(e) => {
                          if (e.target.checked) setWorkingDays(prev => [...prev, day]);
                          else setWorkingDays(prev => prev.filter(d => d !== day));
                        }} 
                      />
                      {day}
                    </label>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {workingDays.length > 0 ? workingDays.map(day => (
                    <span key={day} style={{ padding: '4px 10px', background: 'var(--color-primary)', color: 'white', borderRadius: '12px', fontSize: '12px', fontWeight: 500 }}>
                      {day}
                    </span>
                  )) : (
                    <span style={{ color: 'var(--color-text-light)', fontSize: '14px' }}>No working days selected</span>
                  )}
                </div>
              )}
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '32px' }}>
            <div className="premium-class-card" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--color-text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}><Clock size={18} color="var(--color-primary)" /> School Start Time</h3>
              </div>
              <div style={{ position: 'relative' }}>
                <div 
                  onClick={() => setShowSchoolStartPicker(true)}
                  style={{ padding: '10px 16px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: '15px', color: 'var(--color-text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <span style={{ fontWeight: 600 }}>{schoolStartTime || '08:00'}</span>
                  <Edit2 size={14} color="var(--color-text-light)" />
                </div>
                {showSchoolStartPicker && (
                  <CustomTimePicker 
                    time={schoolStartTime}
                    onSave={(newTime) => {
                      setSchoolStartTime(newTime);
                      setShowSchoolStartPicker(false);
                      syncBackend({ school_start_time: newTime });
                    }}
                    onCancel={() => setShowSchoolStartPicker(false)}
                  />
                )}
              </div>
            </div>
            
            <div className="premium-class-card" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--color-text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}><Clock size={18} color="var(--color-primary)" /> School End Time</h3>
              </div>
              <div style={{ position: 'relative' }}>
                <div 
                  onClick={() => setShowSchoolEndPicker(true)}
                  style={{ padding: '10px 16px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: '15px', color: 'var(--color-text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <span style={{ fontWeight: 600 }}>{schoolEndTime || '14:00'}</span>
                  <Edit2 size={14} color="var(--color-text-light)" />
                </div>
                {showSchoolEndPicker && (
                  <CustomTimePicker 
                    time={schoolEndTime}
                    onSave={(newTime) => {
                      setSchoolEndTime(newTime);
                      setShowSchoolEndPicker(false);
                      syncBackend({ school_end_time: newTime });
                    }}
                    onCancel={() => setShowSchoolEndPicker(false)}
                  />
                )}
              </div>
            </div>
          </div>

          <div className="settings-grid">
            {classes.length === 0 ? (
              <div className="empty-state-placeholder" style={{ gridColumn: '1 / -1' }}>
                <p className="body-text">No classes configured yet.</p>
              </div>
            ) : (
              classes.map(cls => (
                <div key={cls} className="premium-class-card">
                  <div className="premium-card-header">
                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--color-text-main)' }}>{cls}</h3>
                    <div className="premium-card-actions">
                      <button className="icon-btn" onClick={() => handleOpenEditForm(cls)} title="Edit Configuration">
                        <Edit2 size={16} />
                      </button>
                      <button className="icon-btn danger" onClick={() => confirmDelete('class', cls)} title="Delete Class">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div style={{ marginTop: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <span style={{ fontSize: '12px', background: 'var(--color-bg-secondary)', color: 'var(--color-text-main)', padding: '4px 8px', borderRadius: '4px', fontWeight: 500 }}>
                        {classTypes[cls] || 'Subject-wise'} Model
                      </span>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '8px' }}>Assigned Subjects</p>
                    <div className="subjects-horizontal-list">
                      {(classSubjects[cls] || []).length === 0 ? (
                        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>None assigned</span>
                      ) : (
                        (classSubjects[cls] || []).map((sub, idx) => (
                          <span key={idx} className="tag">{sub}</span>
                        ))
                      )}
                    </div>

                    <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: 'var(--color-background)', padding: '8px', borderRadius: '6px' }}>
                      <div style={{ fontSize: '12px' }}>
                        <span style={{ color: 'var(--color-text-muted)' }}>Monthly Fee:</span> <strong>{classFees[cls]?.monthly || 'N/A'}</strong>
                      </div>
                      {classFees[cls]?.absent_fine && (
                        <div style={{ fontSize: '12px' }}>
                          <span style={{ color: 'var(--color-text-muted)' }}>Absent Fine:</span> <strong>{classFees[cls].absent_fine}</strong>
                        </div>
                      )}
                      {classFees[cls]?.transport && (
                        <div style={{ fontSize: '12px' }}>
                          <span style={{ color: 'var(--color-text-muted)' }}>Transport:</span> <strong>{classFees[cls].transport}</strong>
                        </div>
                      )}
                      {classFees[cls]?.academy && (
                        <div style={{ fontSize: '12px' }}>
                          <span style={{ color: 'var(--color-text-muted)' }}>Academy:</span> <strong>{classFees[cls].academy}</strong>
                        </div>
                      )}
                    </div>

                    {(classFees[cls]?.custom_fees || []).length > 0 && (
                      <div style={{ marginTop: '8px' }}>
                        <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Custom Fees</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {(classFees[cls]?.custom_fees || []).map((cf, idx) => (
                            <span key={idx} className="tag" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
                              {cf.title}: ₨{cf.amount}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'sections' && (
        <div className="card" style={{ maxWidth: '600px' }}>
          <h2 className="card-heading">Manage Sections</h2>
          <p className="body-text" style={{ marginBottom: '16px', fontSize: 'var(--font-size-sm)' }}>
            Define section categories (e.g., Section A, B, Science, Arts).
          </p>
          
          <div className="add-item-row">
            <input 
              type="text" 
              className="input-field" 
              placeholder="Enter section name..." 
              value={newSection}
              onChange={(e) => setNewSection(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddSection()}
            />
            <button className="btn-secondary" onClick={handleAddSection} style={{ padding: '8px 12px' }}>
              <Plus size={16} />
            </button>
          </div>

          <div className="tags-container">
            {sections.length === 0 ? (
              <span className="body-text" style={{ fontSize: 'var(--font-size-sm)' }}>No sections added yet.</span>
            ) : (
              sections.map(sec => (
                <div key={sec} className="tag">
                  {sec}
                  <button type="button" className="tag-remove" onClick={() => confirmDelete('section', sec)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'classForm' && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', borderBottom: '1px solid var(--color-border)', paddingBottom: '16px' }}>
            <button className="icon-btn" onClick={() => setActiveTab('classes')} style={{ background: 'var(--color-bg-secondary)' }}>
              <ArrowLeft size={18} />
            </button>
            <h2 className="card-heading" style={{ margin: 0 }}>
              {formMode === 'add' ? 'Add New Class' : `Edit Class: ${originalModalClassName}`}
            </h2>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1000px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label">Class Name *</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={modalClassName}
                  onChange={e => setModalClassName(e.target.value)}
                  placeholder="e.g., Grade 10"
                />
              </div>
              
              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label">Next Class / Promotion Path</label>
                <select 
                  className="input-field" 
                  value={modalNextClass}
                  onChange={(e) => setModalNextClass(e.target.value)}
                >
                  <option value="">-- Manual Promotion --</option>
                  {classes.filter(c => c !== originalModalClassName).map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                  <option value="Completed" style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>Completed (Ex-Student)</option>
                </select>
              </div>
            </div>

            <div className="input-group" style={{ margin: 0, maxWidth: '500px' }}>
              <label className="input-label">Class Type (Academics Model) *</label>
              <select 
                className="input-field" 
                value={modalClassType}
                onChange={(e) => setModalClassType(e.target.value as 'Subject-wise' | 'Single Teacher')}
              >
                <option value="Subject-wise">Subject-wise (Different teachers for each subject)</option>
                <option value="Single Teacher">Single Teacher (One teacher handles all subjects)</option>
              </select>
            </div>

            <div style={{ borderTop: '1px dashed var(--color-border)', paddingTop: '24px' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>Subjects</h3>
              <div className="input-group" style={{ maxWidth: '300px' }}>
                <label className="input-label">Number of Subjects *</label>
                <input 
                  type="number" 
                  className="input-field" 
                  value={modalNumSubjects}
                  onChange={e => handleNumSubjectsChange(e.target.value)}
                  placeholder="Enter a number..."
                  min="0"
                />
              </div>

              {modalSubjects.length > 0 && (
                <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                  {modalSubjects.map((sub, idx) => (
                    <div key={idx}>
                      <label style={{ fontSize: '12px', marginBottom: '4px', display: 'block', color: 'var(--color-text-muted)' }}>Subject {idx + 1}</label>
                      <input 
                        type="text" 
                        className="input-field" 
                        value={sub}
                        onChange={e => handleSubjectNameChange(idx, e.target.value)}
                        placeholder="e.g. Mathematics"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ borderTop: '1px dashed var(--color-border)', paddingTop: '24px' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>Sections</h3>
              {sections.length === 0 ? (
                <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>No global sections available. Add them in the Sections tab.</div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                  {sections.map(sec => (
                    <div key={sec} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input 
                        type="checkbox" 
                        id={`modal-sec-${sec}`}
                        checked={modalClassSections.includes(sec)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setModalClassSections(prev => [...prev, sec]);
                          } else {
                            setModalClassSections(prev => prev.filter(s => s !== sec));
                          }
                        }}
                      />
                      <label htmlFor={`modal-sec-${sec}`} className="input-label" style={{ margin: 0 }}>{sec}</label>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ borderTop: '1px dashed var(--color-border)', paddingTop: '24px' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>Fee Structure</h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
                <div className="input-group" style={{ margin: 0 }}>
                  <label className="input-label">Monthly Fee (PKR)</label>
                  <input type="number" className="input-field" value={modalFees.monthly} onChange={e => setModalFees({ ...modalFees, monthly: e.target.value })} placeholder="e.g. 5000" />
                </div>
                
                <div className="input-group" style={{ margin: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <input type="checkbox" id="chk-absent" checked={hasAbsentFine} onChange={(e) => setHasAbsentFine(e.target.checked)} />
                    <label htmlFor="chk-absent" className="input-label" style={{ margin: 0 }}>Enable Absent Fine</label>
                  </div>
                  {hasAbsentFine && (
                    <input type="number" className="input-field" value={modalFees.absent_fine} onChange={e => setModalFees({ ...modalFees, absent_fine: e.target.value })} placeholder="e.g. 100" />
                  )}
                </div>

                <div className="input-group" style={{ margin: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <input type="checkbox" id="chk-transport" checked={hasTransportFee} onChange={(e) => setHasTransportFee(e.target.checked)} />
                    <label htmlFor="chk-transport" className="input-label" style={{ margin: 0 }}>Enable Transport Fee</label>
                  </div>
                  {hasTransportFee && (
                    <input type="number" className="input-field" value={modalFees.transport} onChange={e => setModalFees({ ...modalFees, transport: e.target.value })} placeholder="e.g. 2000" />
                  )}
                </div>

                <div className="input-group" style={{ margin: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <input type="checkbox" id="chk-academy" checked={hasAcademyFee} onChange={(e) => setHasAcademyFee(e.target.checked)} />
                    <label htmlFor="chk-academy" className="input-label" style={{ margin: 0 }}>Enable Academy Fee</label>
                  </div>
                  {hasAcademyFee && (
                    <input type="number" className="input-field" value={modalFees.academy} onChange={e => setModalFees({ ...modalFees, academy: e.target.value })} placeholder="e.g. 3000" />
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', gridColumn: 'span 2' }}>
                  <button className="btn-primary" onClick={handleAddCustomFee} style={{ padding: '6px 12px', fontSize: '12px', height: 'fit-content' }}>
                    <Plus size={14} /> Add Custom Fee
                  </button>
                </div>
              </div>

              {(modalFees.custom_fees || []).length > 0 && (
                <div style={{ marginTop: '24px' }}>
                  <h4 style={{ fontSize: '1rem', marginBottom: '12px', color: 'var(--color-text-main)' }}>Custom Fees</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {(modalFees.custom_fees || []).map((cf, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <input 
                          type="text" 
                          className="input-field" 
                          placeholder="Fee Title (e.g. Exam Fee)" 
                          value={cf.title} 
                          onChange={e => handleUpdateCustomFee(idx, 'title', e.target.value)} 
                          style={{ flex: 1 }}
                        />
                        <input 
                          type="number" 
                          className="input-field" 
                          placeholder="Amount" 
                          value={cf.amount} 
                          onChange={e => handleUpdateCustomFee(idx, 'amount', e.target.value)} 
                          style={{ width: '150px' }}
                        />
                        <button className="icon-btn danger" onClick={() => handleRemoveCustomFee(idx)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px', borderTop: '1px solid var(--color-border)', paddingTop: '24px' }}>
              <button className="btn-secondary" onClick={() => setActiveTab('classes')}>Cancel</button>
              {formMode === 'add' ? (
                <button className="btn-primary" onClick={handleSaveClass} disabled={!modalClassName.trim() || !modalNumSubjects || modalSubjects.some(s => !s.trim()) || isLoading}>
                  {isLoading ? 'Saving...' : 'Save Class'}
                </button>
              ) : (
                <button className="btn-primary" onClick={handleSaveClass} disabled={!isFormDirty() || !modalClassName.trim() || !modalNumSubjects || modalSubjects.some(s => !s.trim()) || isLoading}>
                  {isLoading ? 'Updating...' : 'Update Class'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'degreeForm' && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', borderBottom: '1px solid var(--color-border)', paddingBottom: '16px' }}>
            <button className="icon-btn" onClick={() => setActiveTab('classes')} style={{ background: 'var(--color-bg-secondary)' }}>
              <ArrowLeft size={18} />
            </button>
            <h2 className="card-heading" style={{ margin: 0 }}>Add Degree Program (Semesters)</h2>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1000px' }}>
            <div style={{ background: '#f0f9ff', padding: '16px', borderRadius: '8px', borderLeft: '4px solid var(--color-primary)' }}>
              <p style={{ margin: 0, color: '#0369a1', fontSize: '0.95rem' }}>
                <strong>How it works:</strong> Enter the program name (e.g. "BS Computer Science") and the total number of semesters (e.g. "8"). The system will automatically create 8 separate classes (BS Computer Science Semester 1 through 8) and link their promotion paths sequentially!
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label">Program Name *</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={degreeProgramName}
                  onChange={e => setDegreeProgramName(e.target.value)}
                  placeholder="e.g., BS Software Engineering"
                />
              </div>
              
              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label">Total Semesters *</label>
                <input 
                  type="number" 
                  className="input-field" 
                  value={degreeTotalSemesters}
                  onChange={e => setDegreeTotalSemesters(Number(e.target.value) || '')}
                  placeholder="e.g., 8"
                  min="1"
                  max="12"
                />
              </div>
            </div>

            <div style={{ borderTop: '1px dashed var(--color-border)', paddingTop: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Base Fee Structure (Applies to all semesters)</h3>
                <button className="btn-primary" onClick={handleAddCustomFee} style={{ padding: '6px 12px', fontSize: '12px' }}>
                  <Plus size={14} /> Add Custom Fee
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <div className="input-group" style={{ margin: 0 }}>
                  <label className="input-label">Monthly / Semester Fee (PKR)</label>
                  <input type="number" className="input-field" value={modalFees.monthly} onChange={e => setModalFees({ ...modalFees, monthly: e.target.value })} placeholder="e.g. 50000" />
                </div>
                
                <div className="input-group" style={{ margin: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <input type="checkbox" id="deg-chk-absent" checked={hasAbsentFine} onChange={(e) => setHasAbsentFine(e.target.checked)} />
                    <label htmlFor="deg-chk-absent" className="input-label" style={{ margin: 0 }}>Enable Absent Fine</label>
                  </div>
                  {hasAbsentFine && (
                    <input type="number" className="input-field" value={modalFees.absent_fine} onChange={e => setModalFees({ ...modalFees, absent_fine: e.target.value })} placeholder="e.g. 100" />
                  )}
                </div>

                <div className="input-group" style={{ margin: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <input type="checkbox" id="deg-chk-transport" checked={hasTransportFee} onChange={(e) => setHasTransportFee(e.target.checked)} />
                    <label htmlFor="deg-chk-transport" className="input-label" style={{ margin: 0 }}>Enable Transport Fee</label>
                  </div>
                  {hasTransportFee && (
                    <input type="number" className="input-field" value={modalFees.transport} onChange={e => setModalFees({ ...modalFees, transport: e.target.value })} placeholder="e.g. 2000" />
                  )}
                </div>

                <div className="input-group" style={{ margin: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <input type="checkbox" id="deg-chk-academy" checked={hasAcademyFee} onChange={(e) => setHasAcademyFee(e.target.checked)} />
                    <label htmlFor="deg-chk-academy" className="input-label" style={{ margin: 0 }}>Enable Academy Fee</label>
                  </div>
                  {hasAcademyFee && (
                    <input type="number" className="input-field" value={modalFees.academy} onChange={e => setModalFees({ ...modalFees, academy: e.target.value })} placeholder="e.g. 3000" />
                  )}
                </div>
              </div>

              {(modalFees.custom_fees || []).length > 0 && (
                <div style={{ marginTop: '24px' }}>
                  <h4 style={{ fontSize: '1rem', marginBottom: '12px', color: 'var(--color-text-main)' }}>Custom Fees</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {(modalFees.custom_fees || []).map((cf, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <input 
                          type="text" 
                          className="input-field" 
                          placeholder="Fee Title (e.g. Exam Fee)" 
                          value={cf.title} 
                          onChange={e => handleUpdateCustomFee(idx, 'title', e.target.value)} 
                          style={{ flex: 1 }}
                        />
                        <input 
                          type="number" 
                          className="input-field" 
                          placeholder="Amount" 
                          value={cf.amount} 
                          onChange={e => handleUpdateCustomFee(idx, 'amount', e.target.value)} 
                          style={{ width: '150px' }}
                        />
                        <button className="icon-btn danger" onClick={() => handleRemoveCustomFee(idx)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px', borderTop: '1px solid var(--color-border)', paddingTop: '24px' }}>
              <button className="btn-secondary" onClick={() => setActiveTab('classes')}>Cancel</button>
              <button className="btn-primary" onClick={handleSaveDegree} disabled={!degreeProgramName.trim() || !degreeTotalSemesters || isLoading}>
                {isLoading ? 'Generating...' : 'Generate Semesters'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmOpen && deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteConfirmOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '16px 0' }}>
              <AlertTriangle size={48} color="var(--color-danger)" style={{ marginBottom: '16px' }} />
              <h3 style={{ margin: '0 0 8px 0', color: 'var(--color-text-main)' }}>Confirm Deletion</h3>
              <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>
                Are you sure you want to delete the {deleteTarget.type} <strong>{deleteTarget.name}</strong>? This action will remove it from all configurations.
              </p>
            </div>
            <div className="modal-footer" style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button className="btn-secondary" onClick={() => setDeleteConfirmOpen(false)}>Cancel</button>
              <button className="btn-primary" onClick={executeDelete} disabled={isLoading} style={{ background: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}>
                {isLoading ? 'Deleting...' : `Delete ${deleteTarget.type}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
