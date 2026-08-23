'use client';

import React, { useState, useEffect } from 'react';
import { ArrowRight, UserCheck } from 'lucide-react';

import { supabase } from '@/lib/supabase';

export const PromoteStudents: React.FC = () => {
  const [students, setStudents] = useState<any[]>([]);
  const [settingsClasses, setSettingsClasses] = useState<string[]>([]);
  const [settingsSections, setSettingsSections] = useState<string[]>([]);
  const [classSections, setClassSections] = useState<Record<string, string[]>>({});
  
  // Selections
  const [currentClass, setCurrentClass] = useState('');
  const [currentSections, setCurrentSections] = useState<string[]>([]);
  const [targetClass, setTargetClass] = useState('');
  const [targetSection, setTargetSection] = useState('');
  const [schoolEndClass, setSchoolEndClass] = useState('');
  const [classPromotions, setClassPromotions] = useState<Record<string, string>>({});
  
  // Filtered lists
  const [classStudents, setClassStudents] = useState<any[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

  const activeSectionsForClass = currentClass 
    ? Array.from(new Set(students.filter(s => s.academic_class === currentClass && s.status !== 'Ex-Students').map(s => s.section))).filter(Boolean).sort()
    : [];
  
  const [isPromoting, setIsPromoting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{type: 'success' | 'error' | null, message: string}>({type: null, message: ''});

  useEffect(() => {
    // Fetch all Active students
    Promise.resolve(supabase.from('students').select('*').neq('status', 'Struck Off'))
      .then(res => { if (res.data) setStudents(res.data); })
      .catch((err: any) => console.error(err));

    // Fetch classes and sections
    Promise.resolve(supabase.from('settings').select('*').eq('key', 'app_settings').single())
      .then(res => {
        const data = res.data?.value || {};
        setSettingsClasses(data.classes || []);
        setSettingsSections(data.sections || []);
        setClassSections(data.class_sections || {});
        setSchoolEndClass(data.school_end_class || '');
        setClassPromotions(data.class_promotions || {});
      })
      .catch((err: any) => console.error(err));
  }, []);

  // Auto-select target class based on promotion map or school end class
  useEffect(() => {
    if (currentClass) {
      const mappedNext = classPromotions[currentClass];
      if (mappedNext) {
        setTargetClass(mappedNext);
        if (mappedNext === 'Completed') {
          setTargetSection('Completed');
        }
      } else if (currentClass === schoolEndClass) {
        setTargetClass('Completed');
        setTargetSection('Completed');
      } else {
        setTargetClass('');
        setTargetSection('');
      }
    }
  }, [currentClass, schoolEndClass, classPromotions]);

  // Update table when current class/section changes
  useEffect(() => {
    if (currentClass) {
      let filtered = students.filter(s => s.academic_class === currentClass);
      if (currentSections.length > 0) {
        filtered = filtered.filter(s => currentSections.includes(s.section));
      }
      setClassStudents(filtered);
      // Default to checking all students in this class
      setSelectedStudentIds(new Set(filtered.map(s => s.id)));
    } else {
      setClassStudents([]);
      setSelectedStudentIds(new Set());
    }
  }, [currentClass, currentSections, students]);

  const toggleStudent = (id: string) => {
    const newSet = new Set(selectedStudentIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedStudentIds(newSet);
  };

  const toggleAll = () => {
    if (selectedStudentIds.size === classStudents.length) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(classStudents.map(s => s.id)));
    }
  };

  const handlePromote = async () => {
    if (!currentClass) return alert("Select a current class first.");
    if (!targetClass || !targetSection) return alert("Select a target class and section.");
    if (selectedStudentIds.size === 0) return alert("No students selected for promotion.");
    
    if (!window.confirm(`Promote ${selectedStudentIds.size} students to ${targetClass} (${targetSection})?`)) return;

    setIsPromoting(true);
    setStatusMsg({type: null, message: ''});
    
    try {
      const { error } = await supabase
        .from('students')
        .update({ academic_class: targetClass, section: targetSection })
        .in('id', Array.from(selectedStudentIds));
      
      if (error) throw error;
      
      setStatusMsg({ type: 'success', message: 'Students promoted successfully' });
      
      // Update local state to reflect changes instantly
      setStudents(prev => prev.map(s => {
        if (selectedStudentIds.has(s.id)) {
          return { ...s, academic_class: targetClass, section: targetSection };
        }
        return s;
      }));
      
      // Reset form
      setCurrentClass('');
      setCurrentSections([]);
      setTargetClass('');
      setTargetSection('');
      
    } catch (err: any) {
      setStatusMsg({ type: 'error', message: err.message });
    } finally {
      setIsPromoting(false);
    }
  };

  return (
    <div className="records-page">
      <div className="records-header">
        <div>
          <h1 className="section-heading" style={{ marginBottom: '4px' }}>Promote Students</h1>
          <p className="body-text">Bulk upgrade students to new classes at the end of the academic year.</p>
        </div>
      </div>
      
      {statusMsg.type && (
        <div className={`toast ${statusMsg.type}`}>
          {statusMsg.message}
        </div>
      )}

      <div className="card" style={{ padding: '24px', display: 'flex', gap: '32px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '24px' }}>
        <div style={{ flex: 1, minWidth: '300px' }}>
          <h3 className="card-heading" style={{ fontSize: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px' }}>1. Select Current Class</h3>
          <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Current Class</label>
              <select className="input-field" value={currentClass} onChange={e => setCurrentClass(e.target.value)}>
                <option value="">-- Select Class --</option>
                {settingsClasses.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Sections (Select multiple)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '12px', padding: '12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-button)', backgroundColor: 'var(--color-background)' }}>
                {activeSectionsForClass.map(s => (
                  <label key={s} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.9rem' }}>
                    <input 
                      type="checkbox" 
                      checked={currentSections.includes(s)} 
                      onChange={(e) => {
                        if (e.target.checked) setCurrentSections([...currentSections, s]);
                        else setCurrentSections(currentSections.filter(sec => sec !== s));
                      }}
                    />
                    {s}
                  </label>
                ))}
                {!currentClass && <span className="body-text" style={{fontSize: '0.8rem'}}>Select a current class first.</span>}
                {currentClass && activeSectionsForClass.length === 0 && <span className="body-text" style={{fontSize: '0.8rem'}}>No active students in this class.</span>}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px' }}>
          <ArrowRight size={32} color="var(--color-primary)" style={{ opacity: 0.5 }} />
        </div>

        <div style={{ flex: 1, minWidth: '300px' }}>
          <h3 className="card-heading" style={{ fontSize: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px' }}>2. Select Target Class</h3>
          <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Promote To Class</label>
              <select className="input-field" value={targetClass} onChange={e => setTargetClass(e.target.value)}>
                <option value="">-- Select Target --</option>
                <option value="Completed" style={{fontWeight: 'bold', color: 'var(--color-primary)'}}>Completed (Graduated)</option>
                {settingsClasses.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Promote To Section</label>
              <select className="input-field" value={targetSection} onChange={e => setTargetSection(e.target.value)} disabled={targetClass === 'Completed'} style={{ opacity: targetClass === 'Completed' ? 0.6 : 1, cursor: targetClass === 'Completed' ? 'not-allowed' : 'pointer' }}>
                <option value="">-- Select Section --</option>
                <option value="Completed" style={{fontWeight: 'bold', color: 'var(--color-primary)'}}>Completed</option>
                {(targetClass && classSections[targetClass] ? classSections[targetClass] : settingsSections).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)' }}>
          <h3 className="card-heading" style={{ margin: 0 }}>3. Select Students to Promote</h3>
          <div style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
            Selected: <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{selectedStudentIds.size}</span> / {classStudents.length}
          </div>
        </div>
        
        {currentClass ? (
          <div className="table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <table className="data-table">
              <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--color-background)', zIndex: 10 }}>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>
                    <input 
                      type="checkbox" 
                      checked={selectedStudentIds.size > 0 && selectedStudentIds.size === classStudents.length}
                      onChange={toggleAll}
                      style={{ cursor: 'pointer' }}
                    />
                  </th>
                  <th>Roll No</th>
                  <th>Student Name</th>
                  <th>Father's Name</th>
                  <th>Current Class</th>
                </tr>
              </thead>
              <tbody>
                {classStudents.length > 0 ? (
                  classStudents.map(student => (
                    <tr key={student.id} onClick={() => toggleStudent(student.id)} style={{ cursor: 'pointer', backgroundColor: selectedStudentIds.has(student.id) ? 'transparent' : 'var(--color-surface-hover)' }}>
                      <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          checked={selectedStudentIds.has(student.id)} 
                          onChange={() => toggleStudent(student.id)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
                      <td>{student.roll_number || '-'}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div className="avatar">
                            {student.profile_image_url ? (
                              <img src={`${student.profile_image_url}`} alt={student.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              student.name.charAt(0)
                            )}
                          </div>
                          <span style={{ fontWeight: 500, color: selectedStudentIds.has(student.id) ? 'inherit' : 'var(--color-text-muted)' }}>
                            {student.name}
                          </span>
                        </div>
                      </td>
                      <td>{student.father_name}</td>
                      <td>{student.academic_class} ({student.section})</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>
                      No active students found in this class/section. (Struck Off students are excluded).
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state-placeholder" style={{ padding: '64px' }}>
            <UserCheck size={48} color="var(--color-border)" style={{ marginBottom: '16px' }} />
            <p className="body-text">Select a Current Class above to view students.</p>
          </div>
        )}
        
        <div style={{ padding: '24px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end' }}>
          <button 
            className="btn-primary" 
            onClick={handlePromote}
            disabled={isPromoting || selectedStudentIds.size === 0 || !targetClass}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            {isPromoting ? 'Promoting...' : `Promote ${selectedStudentIds.size} Students`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PromoteStudents;
