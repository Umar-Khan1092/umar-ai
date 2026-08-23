'use client';

import React, { useState, useEffect } from 'react';

import { Calendar, Plus, Trash2, Clock, AlertTriangle, Info } from 'lucide-react';
import { CustomTimePicker } from '@/components/ui/CustomTimePicker';
import { formatTime } from '@/utils/formatDate';
import { supabase, adminSupabase } from '@/lib/supabase';

interface TimetableEntry {
  id?: string;
  class_name: string;
  section: string;
  day: string;
  start_time: string;
  end_time: string;
  subject: string;
  teacher_id: string;
  teacher_name: string;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const AdminTimetable: React.FC = () => {
  const [classes, setClasses] = useState<string[]>([]);
  const [sections, setSections] = useState<string[]>([]);
  const [classSubjects, setClassSubjects] = useState<Record<string, string[]>>({});
  const [classSections, setClassSections] = useState<Record<string, string[]>>({});
  const [teachers, setTeachers] = useState<any[]>([]);
  
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  
  const [viewMode, setViewMode] = useState<'manage' | 'global'>('manage');
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [globalTimetable, setGlobalTimetable] = useState<TimetableEntry[]>([]);
  const [classIncharges, setClassIncharges] = useState<Record<string, string>>({});
  const [editingInchargeFor, setEditingInchargeFor] = useState<string | null>(null);
  const [schoolStartTime, setSchoolStartTime] = useState<string>('08:00 am');
  const [schoolEndTime, setSchoolEndTime] = useState<string>('02:00 pm');
  
  const [globalFilters, setGlobalFilters] = useState<{ teacher_id: string, class_name: string, section: string }>({
    teacher_id: '',
    class_name: '',
    section: ''
  });
  
  const [newEntry, setNewEntry] = useState<{
    days: string[];
    start_time: string;
    end_time: string;
    subjects: string[];
    teacher_id: string;
    is_attendance_incharge: boolean;
    editing_block_ids?: string[];
  }>({
    days: [],
    start_time: '08:00 am',
    end_time: '09:00 am',
    subjects: [],
    teacher_id: '',
    is_attendance_incharge: false
  });
  
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });

  useEffect(() => {
    const fetchInit = async () => {
      try {
        const dbClient = adminSupabase || supabase;
        const { data: settingsData } = await dbClient.from('settings').select('*').eq('key', 'app_settings').single();
        if (settingsData && settingsData.value) {
          const data = settingsData.value;
          setClasses(data.classes || []);
          setSections(data.sections || []);
          setClassSubjects(data.class_subjects || {});
          setClassSections(data.class_sections || {});
          setClassIncharges(data.class_incharges || {});
          if (data.school_start_time) setSchoolStartTime(data.school_start_time);
          if (data.school_end_time) setSchoolEndTime(data.school_end_time);
          
          if (data.classes && data.classes.length > 0) setSelectedClasses([data.classes[0]]);
          if (data.sections && data.sections.length > 0) setSelectedSections([data.sections[0]]);
        }
        
        const { data: staffData } = await dbClient.from('staff').select('*').eq('role', 'Teacher').eq('status', 'Active');
        if (staffData) setTeachers(staffData);
      } catch (err) {
        console.error(err);
      }
    };
    fetchInit();
  }, []);

  const fetchTimetable = async () => {
    if (selectedClasses.length === 0 || selectedSections.length === 0) return;
    
    try {
      const dbClient = adminSupabase || supabase;
      const [ttRes, staffRes] = await Promise.all([
        dbClient.from('timetable')
          .select('*')
          .eq('academic_class', selectedClasses[0])
          .eq('section', selectedSections[0]),
        dbClient.from('staff').select('id, name')
      ]);
      if (ttRes.error) throw ttRes.error;
      const mapped = (ttRes.data || []).map(t => ({
        ...t,
        class_name: t.academic_class,
        teacher_name: (staffRes.data || []).find(s => s.id === t.teacher_id)?.name || 'Unknown'
      }));
      setTimetable(mapped);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchGlobalTimetable = async () => {
    try {
      const dbClient = adminSupabase || supabase;
      const [ttRes, staffRes] = await Promise.all([
        dbClient.from('timetable').select('*'),
        dbClient.from('staff').select('id, name')
      ]);
      if (ttRes.error) throw ttRes.error;
      const mapped = (ttRes.data || []).map(t => ({
        ...t,
        class_name: t.academic_class,
        teacher_name: (staffRes.data || []).find(s => s.id === t.teacher_id)?.name || 'Unknown'
      }));
      setGlobalTimetable(mapped);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchTimetable();
  }, [selectedClasses, selectedSections]);

  useEffect(() => {
    if (viewMode === 'global') {
      fetchGlobalTimetable();
    }
  }, [viewMode]);

  const timeToMinutes = (timeStr: string) => {
    if (!timeStr) return 0;
    const parts = timeStr.toLowerCase().split(' ');
    const time = parts[0];
    const modifier = parts[1] || '';
    let [hours, minutes] = time.split(':').map(Number);
    if (modifier === 'pm' && hours < 12) hours += 12;
    if (modifier === 'am' && hours === 12) hours = 0;
    return hours * 60 + (minutes || 0);
  };

  const handleAddPeriod = async () => {
    if (selectedClasses.length === 0 || selectedSections.length === 0) {
      setStatus({ type: 'error', message: 'Please select at least one Class and Section.' });
      return;
    }
    
    if (newEntry.days.length === 0 || !newEntry.start_time || !newEntry.end_time || newEntry.subjects.length === 0 || !newEntry.teacher_id) {
      setStatus({ type: 'error', message: 'Please fill all period details.' });
      return;
    }

    const startMins = timeToMinutes(newEntry.start_time);
    const endMins = timeToMinutes(newEntry.end_time);
    const schoolStartMins = timeToMinutes(schoolStartTime);
    const schoolEndMins = timeToMinutes(schoolEndTime);
    
    if (startMins < schoolStartMins || endMins > schoolEndMins) {
      setStatus({ type: 'error', message: `Lectures must be scheduled within school hours (${schoolStartTime} - ${schoolEndTime}).` });
      return;
    }

    // ── Conflict Check ──────────────────────────────────────────────────
    const conflicts: string[] = [];
    for (const day of newEntry.days) {
      for (const existing of globalTimetable) {
        if (newEntry.editing_block_ids?.includes(existing.id || '')) continue;
        
        if (existing.day === day) {
          const exStart = timeToMinutes(existing.start_time);
          const exEnd = timeToMinutes(existing.end_time);
          
          if (startMins < exEnd && endMins > exStart) {
            if (existing.teacher_id === newEntry.teacher_id) {
              conflicts.push(`Teacher ${existing.teacher_name} is busy on ${day} (${existing.start_time} - ${existing.end_time}).`);
            }
            if (selectedClasses.includes(existing.class_name) && selectedSections.includes(existing.section)) {
              conflicts.push(`Class ${existing.class_name}-${existing.section} already has ${existing.subject} on ${day} (${existing.start_time} - ${existing.end_time}).`);
            }
          }
        }
      }
    }
    
    if (conflicts.length > 0) {
      setStatus({ type: 'error', message: `Conflict detected: ${conflicts[0]}` });
      return;
    }


    try {
      const insertPayload: any[] = [];
      for (const cls of selectedClasses) {
        for (const sec of selectedSections) {
          for (const day of newEntry.days) {
            for (const sub of newEntry.subjects) {
              insertPayload.push({
                academic_class: cls,
                section: sec,
                day,
                start_time: newEntry.start_time,
                end_time: newEntry.end_time,
                subject: sub,
                teacher_id: newEntry.teacher_id
              });
            }
          }
        }
      }

      const dbClient = adminSupabase || supabase;
      
      // If editing, delete old blocks first
      if (newEntry.editing_block_ids && newEntry.editing_block_ids.length > 0) {
        const { error: delError } = await dbClient.from('timetable').delete().in('id', newEntry.editing_block_ids);
        if (delError) throw delError;
      }

      const { error: ttError } = await dbClient.from('timetable').insert(insertPayload);
      if (ttError) throw ttError;

      const optimisticEntries = insertPayload.map(p => ({
        id: Math.random().toString(),
        class_name: p.academic_class,
        section: p.section,
        day: p.day,
        start_time: p.start_time,
        end_time: p.end_time,
        subject: p.subject,
        teacher_id: p.teacher_id,
        teacher_name: teachers.find(t => t.id === p.teacher_id)?.name || 'Unknown'
      }));
      setGlobalTimetable(prev => [...prev, ...optimisticEntries]);

      // If set as attendance incharge, update the settings API
      if (newEntry.is_attendance_incharge) {
        const newIncharges = { ...classIncharges };
        selectedClasses.forEach(c => {
          selectedSections.forEach(s => {
            newIncharges[`${c}-${s}`] = newEntry.teacher_id;
          });
        });
        setClassIncharges(newIncharges);

        const dbClient = adminSupabase || supabase;
        const { data: currSettings } = await dbClient.from('settings').select('*').eq('key', 'app_settings').maybeSingle();
        if (currSettings) {
          await dbClient.from('settings').update({ value: { ...currSettings.value, class_incharges: newIncharges } }).eq('key', 'app_settings');
        }

        const { data: attRes } = await dbClient.from('settings').select('*').eq('key', 'attendance_settings').maybeSingle();
        const attSettings = attRes ? attRes.value : [];
        const updatedAttSettings = [...attSettings];
        
        selectedClasses.forEach(c => {
          selectedSections.forEach(s => {
            const idx = updatedAttSettings.findIndex(st => st.class_name === c && st.section === s);
            if (idx >= 0) {
              updatedAttSettings[idx] = { ...updatedAttSettings[idx], mode: 'Incharge', incharge_teacher_id: newEntry.teacher_id };
            } else {
              updatedAttSettings.push({ class_name: c, section: s, mode: 'Incharge', incharge_teacher_id: newEntry.teacher_id });
            }
          });
        });
        
        if (attRes) {
          await dbClient.from('settings').update({ value: updatedAttSettings }).eq('key', 'attendance_settings');
        } else {
          await dbClient.from('settings').insert({ key: 'attendance_settings', value: updatedAttSettings });
        }
      }
      
      setStatus({ type: 'success', message: 'Periods added successfully!' });
      setNewEntry(prev => ({ ...prev, start_time: '08:00 am', end_time: '09:00 am', subjects: [], teacher_id: '', is_attendance_incharge: false, editing_block_ids: undefined }));
      fetchTimetable();
      fetchGlobalTimetable();
      
      setTimeout(() => setStatus({ type: null, message: '' }), 4000);
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message });
    }
  };

  const handleAssignIncharge = async (cls: string, secs: string[], teacherId: string) => {
    const newIncharges = { ...classIncharges };
    secs.forEach(sec => {
      newIncharges[`${cls}-${sec}`] = teacherId;
    });
    setClassIncharges(newIncharges);
    
    // Fetch settings, update class_incharges, and save
    try {
      const { data: currSettings } = await supabase.from('settings').select('*').eq('key', 'app_settings').maybeSingle();
      if (currSettings) {
        await supabase.from('settings').update({ value: { ...currSettings.value, class_incharges: newIncharges } }).eq('key', 'app_settings');
      }
      
      const { data: attRes } = await supabase.from('settings').select('*').eq('key', 'attendance_settings').maybeSingle();
      const attSettings = attRes ? attRes.value : [];
      const updatedAttSettings = [...attSettings];
      
      secs.forEach(sec => {
        const idx = updatedAttSettings.findIndex(st => st.class_name === cls && st.section === sec);
        if (idx >= 0) {
          updatedAttSettings[idx] = { ...updatedAttSettings[idx], mode: 'Incharge', incharge_teacher_id: teacherId };
        } else {
          updatedAttSettings.push({ class_name: cls, section: sec, mode: 'Incharge', incharge_teacher_id: teacherId });
        }
      });
      
      if (attRes) {
        await supabase.from('settings').update({ value: updatedAttSettings }).eq('key', 'attendance_settings');
      } else {
        await supabase.from('settings').insert({ key: 'attendance_settings', value: updatedAttSettings });
      }
    } catch (err) {
      console.error('Failed to assign incharge', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this period?')) return;
    
    try {
      const dbClient = adminSupabase || supabase;
      const { error } = await dbClient.from('timetable').delete().eq('id', id);
      if (error) throw error;
      fetchTimetable();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="page-content">
      <div style={{ marginBottom: 'var(--space-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="section-heading" style={{ marginBottom: '4px' }}>Timetable Scheduler</h1>
          <p className="subtitle">Manage weekly schedules or view the global time table.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            className={`btn-primary ${viewMode === 'manage' ? '' : 'btn-secondary'}`} 
            onClick={() => setViewMode('manage')}
          >
            Manage Timetable
          </button>
          <button 
            className={`btn-primary ${viewMode === 'global' ? '' : 'btn-secondary'}`} 
            onClick={() => setViewMode('global')}
          >
            Global Time Table
          </button>
        </div>
      </div>

      {viewMode === 'manage' ? (
        <>
          {status.type && (
            <div className={`toast ${status.type}`} style={{ marginBottom: 'var(--space-3)' }}>
              {status.type === 'error' && <AlertTriangle size={16} style={{ marginRight: '8px' }} />}
              {status.message}
            </div>
          )}

          {/* Main Workspace */}
          <div style={{ display: 'grid', gridTemplateColumns: '450px 1fr', gap: '24px', alignItems: 'start' }}>
            {/* Add Period Form */}
            <div className="card" style={{ height: 'fit-content', maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
              <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus size={18} color="var(--color-primary)" /> Bulk Scheduler
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {/* Multi-select Classes */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <label className="input-label" style={{ margin: 0 }}>Classes</label>
                    <button type="button" onClick={() => setSelectedClasses(selectedClasses.length === classes.length ? [] : [...classes])} style={{ fontSize: '11px', background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer' }}>
                      {selectedClasses.length === classes.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '100px', overflowY: 'auto', border: '1px solid var(--color-border)', padding: '8px', borderRadius: '4px' }}>
                    {classes.map(c => (
                      <label key={c} style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={selectedClasses.includes(c)} onChange={(e) => {
                          if (e.target.checked) setSelectedClasses([...selectedClasses, c]);
                          else setSelectedClasses(selectedClasses.filter(x => x !== c));
                        }} /> {c}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Multi-select Sections */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <label className="input-label" style={{ margin: 0 }}>Sections</label>
                    <button type="button" onClick={() => {
                       const allSecs = Array.from(new Set(selectedClasses.flatMap(c => classSections[c] || [])));
                       setSelectedSections(selectedSections.length === allSecs.length ? [] : allSecs);
                    }} style={{ fontSize: '11px', background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer' }}>
                      Select All
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '160px', overflowY: 'auto', border: '1px solid var(--color-border)', padding: '12px', borderRadius: '4px' }}>
                    {selectedClasses.length === 0 && <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Select a class first...</div>}
                    {selectedClasses.map(cls => {
                      const secs = classSections[cls] || [];
                      if (secs.length === 0) return null;
                      return (
                        <div key={cls}>
                          <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '6px', borderBottom: '1px solid var(--color-border)', paddingBottom: '2px' }}>{cls}</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {secs.map(s => (
                              <label key={`${cls}-${s}`} style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                                <input type="checkbox" checked={selectedSections.includes(s)} onChange={(e) => {
                                  if (e.target.checked) {
                                    if (!selectedSections.includes(s)) setSelectedSections([...selectedSections, s]);
                                  } else {
                                    setSelectedSections(selectedSections.filter(x => x !== s));
                                  }
                                }} /> {s}
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Multi-select Days */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <label className="input-label" style={{ margin: 0 }}>Days</label>
                    <button type="button" onClick={() => setNewEntry(prev => ({...prev, days: prev.days.length === DAYS.length ? [] : [...DAYS]}))} style={{ fontSize: '11px', background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer' }}>
                      {newEntry.days.length === DAYS.length ? 'Deselect All' : 'Full Week'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '100px', overflowY: 'auto', border: '1px solid var(--color-border)', padding: '8px', borderRadius: '4px' }}>
                    {DAYS.map(d => (
                      <label key={d} style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={newEntry.days.includes(d)} onChange={(e) => {
                          if (e.target.checked) setNewEntry(prev => ({...prev, days: [...prev.days, d]}));
                          else setNewEntry(prev => ({...prev, days: prev.days.filter(x => x !== d)}));
                        }} /> {d}
                      </label>
                    ))}
                  </div>
                </div>
                
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: 'var(--color-text-primary)' }}>
                    <input 
                      type="checkbox" 
                      style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--color-primary)' }}
                      checked={newEntry.start_time === schoolStartTime && newEntry.end_time === schoolEndTime}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setNewEntry(prev => ({ ...prev, start_time: schoolStartTime, end_time: schoolEndTime }));
                        } else {
                          setNewEntry(prev => ({ ...prev, start_time: '08:00 am', end_time: '09:00 am' }));
                        }
                      }}
                    />
                    Assign for Full Time ({schoolStartTime} - {schoolEndTime})
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ position: 'relative' }}>
                    <label className="input-label" style={{ display: 'block', marginBottom: '4px' }}>Start Time</label>
                    <input 
                      type="text" 
                      readOnly
                      className="input-field" 
                      value={newEntry.start_time} 
                      onClick={() => setShowStartTimePicker(true)} 
                      placeholder="--:--"
                      style={{ cursor: 'pointer', background: 'white' }}
                    />
                    {showStartTimePicker && (
                      <CustomTimePicker 
                        time={newEntry.start_time || '08:00 am'}
                        minTime={schoolStartTime}
                        maxTime={schoolEndTime}
                        onSave={(newTime) => {
                          setNewEntry(prev => ({ ...prev, start_time: newTime }));
                          setShowStartTimePicker(false);
                        }}
                        onCancel={() => setShowStartTimePicker(false)}
                      />
                    )}
                  </div>
                  <div style={{ position: 'relative' }}>
                    <label className="input-label" style={{ display: 'block', marginBottom: '4px' }}>End Time</label>
                    <input 
                      type="text" 
                      readOnly
                      className="input-field" 
                      value={newEntry.end_time} 
                      onClick={() => setShowEndTimePicker(true)} 
                      placeholder="--:--"
                      style={{ cursor: 'pointer', background: 'white' }}
                    />
                    {showEndTimePicker && (
                      <CustomTimePicker 
                        time={newEntry.end_time || '09:00 am'}
                        minTime={schoolStartTime}
                        maxTime={schoolEndTime}
                        onSave={(newTime) => {
                          setNewEntry(prev => ({ ...prev, end_time: newTime }));
                          setShowEndTimePicker(false);
                        }}
                        onCancel={() => setShowEndTimePicker(false)}
                      />
                    )}
                  </div>
                </div>
                
                {/* Multi-select Subjects */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <label className="input-label" style={{ margin: 0 }}>Subjects</label>
                    <button type="button" onClick={() => {
                       const allSubs = Array.from(new Set(selectedClasses.flatMap(c => classSubjects[c] || [])));
                       setNewEntry(prev => ({...prev, subjects: prev.subjects.length === allSubs.length ? [] : allSubs}));
                    }} style={{ fontSize: '11px', background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer' }}>
                      Select All
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '160px', overflowY: 'auto', border: '1px solid var(--color-border)', padding: '12px', borderRadius: '4px' }}>
                    {selectedClasses.length === 0 && <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Select a class first...</div>}
                    {selectedClasses.map(cls => {
                      const subjects = classSubjects[cls] || [];
                      if (subjects.length === 0) return null;
                      return (
                        <div key={cls}>
                          <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '6px', borderBottom: '1px solid var(--color-border)', paddingBottom: '2px' }}>{cls}</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {subjects.map(sub => (
                              <label key={`${cls}-${sub}`} style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                                <input type="checkbox" checked={newEntry.subjects.includes(sub)} onChange={(e) => {
                                  if (e.target.checked) {
                                    if (!newEntry.subjects.includes(sub)) setNewEntry(prev => ({...prev, subjects: [...prev.subjects, sub]}));
                                  } else {
                                    setNewEntry(prev => ({...prev, subjects: prev.subjects.filter(x => x !== sub)}));
                                  }
                                }} /> {sub}
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                <div className="input-group">
                  <label className="input-label">Assign Teacher</label>
                  <select 
                    className="input-field" 
                    value={newEntry.teacher_id} 
                    onChange={e => setNewEntry(prev => ({ ...prev, teacher_id: e.target.value }))}
                  >
                    <option value="">Select Teacher...</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input 
                      type="checkbox" 
                      id="incharge-check" 
                      checked={newEntry.is_attendance_incharge} 
                      onChange={e => setNewEntry(prev => ({...prev, is_attendance_incharge: e.target.checked}))} 
                    />
                    <label htmlFor="incharge-check" style={{ fontSize: '13px', cursor: 'pointer', margin: 0 }}>Assign as Daily Attendance Incharge</label>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '8px', display: 'block' }}>All active teachers are available. The system will auto-assign these lectures to their profile if not already present. Checking the box gives them attendance portal access for the selected classes.</span>
                </div>
                
                {(() => {
                  const startMin = timeToMinutes(newEntry.start_time);
                  const endMin = timeToMinutes(newEntry.end_time);
                  const sStartMin = timeToMinutes(schoolStartTime);
                  const sEndMin = timeToMinutes(schoolEndTime);
                  const isFullDay = startMin === sStartMin && endMin === sEndMin;
                  
                  const conflicts: string[] = [];
                  const suggestions: string[] = [];

                  if (startMin >= endMin && newEntry.start_time && newEntry.end_time) {
                    conflicts.push("End time must be after start time");
                  } else if (!isFullDay && newEntry.subjects.length > 1) {
                    conflicts.push("You can only assign one subject per period, unless assigning a teacher for the full school day.");
                  } else if (startMin > 0 && endMin > 0) {
                    globalTimetable.forEach(entry => {
                      if (newEntry.editing_block_ids && entry.id && newEntry.editing_block_ids.includes(entry.id)) return;

                      const isSameTime = (startMin < timeToMinutes(entry.end_time) && endMin > timeToMinutes(entry.start_time));
                      const isSameDay = newEntry.days.includes(entry.day);
                      const isSameClassSec = selectedClasses.includes(entry.class_name) && selectedSections.includes(entry.section);
                      const isSameTeacher = newEntry.teacher_id && entry.teacher_id === newEntry.teacher_id;

                      if (isSameTime && isSameDay) {
                        if (isSameClassSec) {
                          conflicts.push(`Class ${entry.class_name} (${entry.section}) has ${entry.subject} on ${entry.day} at ${formatTime(entry.start_time)}-${formatTime(entry.end_time)}`);
                        } else if (isSameTeacher) {
                          const tName = teachers.find(t => t.id === newEntry.teacher_id)?.name || 'Teacher';
                          conflicts.push(`${tName} is already teaching ${entry.class_name} (${entry.section}) on ${entry.day} at ${formatTime(entry.start_time)}-${formatTime(entry.end_time)}`);
                        }
                      }

                      if (isSameClassSec && newEntry.teacher_id && entry.teacher_id !== newEntry.teacher_id && newEntry.subjects.includes(entry.subject)) {
                        const tName = teachers.find(t => t.id === entry.teacher_id)?.name || 'Another Teacher';
                        const msg = `${entry.subject} is also taught by ${tName} to ${entry.class_name} (${entry.section}).`;
                        if (!suggestions.includes(msg)) suggestions.push(msg);
                      }
                    });
                  }
                  
                  // Glitch detection: check if the selected class/section already has a DIFFERENT incharge assigned
                  const checkGlitch = () => {
                    if (newEntry.is_attendance_incharge && newEntry.teacher_id) {
                      for (const c of selectedClasses) {
                        for (const s of selectedSections) {
                          const key = `${c}-${s}`;
                          const existingInchargeId = classIncharges[key];
                          if (existingInchargeId && existingInchargeId !== newEntry.teacher_id) {
                            const existingTeacher = teachers.find(t => t.id === existingInchargeId);
                            return `Glitch detected: Class ${c} (${s}) already has an Attendance Incharge (${existingTeacher?.name || 'Another Teacher'}). Assigning this will overwrite the previous incharge!`;
                          }
                        }
                      }
                    }
                    return null;
                  };
                  const glitchWarning = checkGlitch();
                  
                  // Only show top 2 conflicts to save space
                  const displayConflicts = conflicts.slice(0, 2);
                  const hasMoreConflicts = conflicts.length > 2;

                  return (
                    <div style={{ marginTop: '8px' }}>
                      {glitchWarning && (
                        <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #F87171', borderRadius: '4px', padding: '8px 12px', marginBottom: '12px' }}>
                          <div style={{ color: '#B91C1C', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <AlertTriangle size={14} /> {glitchWarning}
                          </div>
                        </div>
                      )}
                      {suggestions.length > 0 && (
                        <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '4px', padding: '8px 12px', marginBottom: '12px' }}>
                          <div style={{ color: '#047857', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                            <Info size={14} /> Note
                          </div>
                          <ul style={{ margin: 0, paddingLeft: '20px', color: '#065F46', fontSize: '12px' }}>
                            {suggestions.map((s, i) => <li key={i}>{s}</li>)}
                          </ul>
                        </div>
                      )}
                      {conflicts.length > 0 && (
                        <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #F87171', borderRadius: '4px', padding: '8px 12px', marginBottom: '12px' }}>
                          <div style={{ color: '#B91C1C', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                            <AlertTriangle size={14} /> Schedule Conflict Detected
                          </div>
                          <ul style={{ margin: 0, paddingLeft: '20px', color: '#DC2626', fontSize: '12px' }}>
                            {displayConflicts.map((c, i) => <li key={i}>{c}</li>)}
                            {hasMoreConflicts && <li>...and {conflicts.length - 2} more conflicts</li>}
                          </ul>
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn-primary" onClick={handleAddPeriod} style={{ flex: 1 }} disabled={!newEntry.teacher_id || conflicts.length > 0}>
                          Save Period
                        </button>
                        {newEntry.editing_block_ids && (
                          <button 
                            className="btn-secondary" 
                            style={{ flex: 1 }}
                            onClick={() => {
                              setNewEntry({
                                days: [],
                                start_time: '',
                                end_time: '',
                                subjects: [],
                                teacher_id: '',
                                is_attendance_incharge: false
                              });
                              setViewMode('global');
                            }}
                          >
                            Cancel Edit
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          
          {/* Weekly Grid Preview */}
          <div className="card" style={{ maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px', position: 'sticky', top: 0, backgroundColor: 'var(--color-surface)', zIndex: 10, paddingBottom: '8px' }}>
              <Calendar size={18} color="var(--color-primary)" /> Preview: {selectedClasses[0] || 'Class'} - {selectedSections[0] || 'Section'}
            </h3>
            
            {selectedClasses.length > 1 || selectedSections.length > 1 ? (
               <div style={{ background: '#EFF6FF', padding: '12px', borderRadius: '8px', color: '#1D4ED8', fontSize: '13px', marginBottom: '16px' }}>
                 Showing preview for the first selected class/section only. All selected combinations will be scheduled.
               </div>
            ) : null}
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {DAYS.map(day => {
                const dayPeriods = timetable.filter(t => t.day === day).sort((a, b) => a.start_time.localeCompare(b.start_time));
                
                return (
                  <div key={day} style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                    <div style={{ backgroundColor: '#F8FAFC', padding: '12px 16px', fontWeight: 'bold', borderBottom: dayPeriods.length > 0 ? '1px solid var(--color-border)' : 'none' }}>
                      {day}
                    </div>
                    {dayPeriods.length > 0 && (
                      <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {dayPeriods.map(period => (
                          <div key={period.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: 'white', border: '1px solid var(--color-border)', borderRadius: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                              <div style={{ fontWeight: 'bold', color: 'var(--color-primary)', width: '120px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Clock size={14} /> {formatTime(period.start_time)} - {formatTime(period.end_time)}
                              </div>
                              <div style={{ fontWeight: '500', width: '150px' }}>{period.subject}</div>
                              <div style={{ color: 'var(--color-text-muted)' }}>{period.teacher_name}</div>
                            </div>
                            <button className="icon-btn danger" onClick={() => handleDelete(period.id!)}>
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {dayPeriods.length === 0 && (
                      <div style={{ padding: '16px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                        No periods scheduled.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* Filters for Global Time Table */}
          <div className="card" style={{ padding: '16px', display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Filter by Teacher</label>
              <select 
                className="input-field" 
                value={globalFilters.teacher_id} 
                onChange={e => setGlobalFilters(f => ({ ...f, teacher_id: e.target.value }))}
              >
                <option value="">All Teachers</option>
                {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Filter by Class</label>
              <select 
                className="input-field" 
                value={globalFilters.class_name} 
                onChange={e => setGlobalFilters(f => ({ ...f, class_name: e.target.value, section: '' }))}
              >
                <option value="">All Classes</option>
                {classes.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Filter by Section</label>
              <select 
                className="input-field" 
                value={globalFilters.section} 
                onChange={e => setGlobalFilters(f => ({ ...f, section: e.target.value }))}
                disabled={!globalFilters.class_name}
              >
                <option value="">All Sections</option>
                {(globalFilters.class_name ? (classSections[globalFilters.class_name] || sections) : sections).map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <button 
              className="btn-secondary" 
              onClick={() => setGlobalFilters({ teacher_id: '', class_name: '', section: '' })}
              style={{ height: '38px' }}
            >
              Clear Filters
            </button>
          </div>

          {(() => {
            // Apply Filters
            let filteredTimetable = globalTimetable;
            if (globalFilters.teacher_id) {
              filteredTimetable = filteredTimetable.filter(e => e.teacher_id === globalFilters.teacher_id);
            }
            if (globalFilters.class_name) {
              filteredTimetable = filteredTimetable.filter(e => e.class_name === globalFilters.class_name);
            }
            if (globalFilters.section) {
              filteredTimetable = filteredTimetable.filter(e => e.section === globalFilters.section);
            }

            if (filteredTimetable.length === 0) {
              return <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>No schedules found matching the selected filters.</div>;
            }

            // 1. Group by Class + Section
            const sectionSchedules: Record<string, TimetableEntry[]> = {};
            filteredTimetable.forEach(entry => {
              const key = `${entry.class_name}|${entry.section}`;
              if (!sectionSchedules[key]) sectionSchedules[key] = [];
              sectionSchedules[key].push(entry);
            });

            // 2. Generate Signatures
            const sectionSignatures = Object.entries(sectionSchedules).map(([key, entries]) => {
              const [cls, sec] = key.split('|');
              // Sort deterministically to create a stable signature
              const sortedEntries = [...entries].sort((a, b) => 
                a.day.localeCompare(b.day) || 
                a.start_time.localeCompare(b.start_time) || 
                a.subject.localeCompare(b.subject)
              );
              const sig = sortedEntries.map(e => `${e.day}_${e.start_time}_${e.end_time}_${e.subject}_${e.teacher_id}`).join('|');
              return { cls, sec, entries: sortedEntries, sig };
            });

            // 3. Merge identical sections
            type MergedGroup = { cls: string, sections: string[], entries: TimetableEntry[], all_entry_ids: string[] };
            const groupedBySignature: Record<string, MergedGroup> = {};
            sectionSignatures.forEach(({ cls, sec, entries, sig }) => {
              const key = `${cls}::${sig}`;
              if (!groupedBySignature[key]) {
                groupedBySignature[key] = { cls, sections: [], entries, all_entry_ids: [] }; 
              }
              groupedBySignature[key].sections.push(sec);
              groupedBySignature[key].all_entry_ids.push(...entries.map(e => e.id!));
            });

            const mergedGroups = Object.values(groupedBySignature).sort((a, b) => a.cls.localeCompare(b.cls) || a.sections[0].localeCompare(b.sections[0]));

            if (mergedGroups.length === 0) {
              return (
                <div className="card" style={{ textAlign: 'center', padding: '60px', color: 'var(--color-text-muted)' }}>
                  <Calendar size={48} style={{ opacity: 0.2, margin: '0 auto 16px' }} />
                  <h3>No timetable entries found.</h3>
                </div>
              );
            }

            return mergedGroups.map((group, idx) => {
              const uniqueTeachers = Array.from(new Set(group.entries.map(e => e.teacher_id)));
              const isModel1 = uniqueTeachers.length === 1;

              const minStartTime = group.entries.reduce((min, e) => e.start_time < min ? e.start_time : min, group.entries[0].start_time);
              const maxEndTime = group.entries.reduce((max, e) => e.end_time > max ? e.end_time : max, group.entries[0].end_time);
              const uniqueDays = Array.from(new Set(group.entries.map(e => e.day)));
              const daysText = uniqueDays.length === DAYS.length ? 'Full Week' : uniqueDays.join(', ');

              const handleEdit = () => {
                // Populate bulk scheduler form with this group's data
                setSelectedClasses([group.cls]);
                setSelectedSections([...group.sections]);
                
                // For form population, just take the properties from the first entry if it's a simple block,
                // but since this might be a complex schedule, we might just load days/subjects from the aggregate
                setNewEntry({
                  days: uniqueDays,
                  subjects: Array.from(new Set(group.entries.map(e => e.subject))),
                  start_time: minStartTime,
                  end_time: maxEndTime,
                  teacher_id: uniqueTeachers[0],
                  editing_block_ids: group.all_entry_ids
                } as any);
                setViewMode('manage');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              };

              const handleDelete = async () => {
                if (!window.confirm(`Delete the entire schedule for Class ${group.cls} (${group.sections.join(', ')})?`)) return;
                try {
                  const dbClient = adminSupabase || supabase;
                  for (const id of group.all_entry_ids) {
                    await dbClient.from('timetable').delete().eq('id', id);
                  }
                  fetchGlobalTimetable();
                } catch (err) {
                  console.error(err);
                }
              };

              return (
                <div key={idx} className="card" style={{ padding: '0', overflow: 'hidden' }}>
                  <div style={{ backgroundColor: 'var(--color-bg-secondary)', padding: '16px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span>Class {group.cls} <span style={{ color: 'var(--color-text-muted)', fontSize: '1rem', fontWeight: 'normal' }}>({group.sections.sort().join(', ')})</span></span>
                        
                        {/* Auto-detect if all sections in this block share the same incharge, or show the Assign dropdown */}
                        {(() => {
                          const incharges = group.sections.map(sec => classIncharges[`${group.cls}-${sec}`]);
                          const allSame = incharges.every(i => i === incharges[0]);
                          const inchargeId = allSame ? incharges[0] : null;

                          if (editingInchargeFor === group.cls) {
                            return (
                              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                <select 
                                  style={{ fontSize: '0.85rem', padding: '2px 4px', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                                  onChange={async (e) => {
                                    if (e.target.value) {
                                      await handleAssignIncharge(group.cls, group.sections, e.target.value);
                                      setEditingInchargeFor(null);
                                    }
                                  }}
                                  value=""
                                >
                                  <option value="" disabled>Select New Incharge...</option>
                                  {teachers.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                  ))}
                                </select>
                                <button className="icon-btn" style={{ padding: '2px', color: 'var(--color-error)' }} onClick={() => setEditingInchargeFor(null)} title="Cancel">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                              </div>
                            );
                          } else if (inchargeId) {
                            const teacherName = teachers.find(t => t.id === inchargeId)?.name || 'Unknown';
                            return (
                              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.85rem', backgroundColor: 'var(--color-primary)', color: 'white', padding: '2px 8px', borderRadius: '12px' }}>Incharge: {teacherName}</span>
                                <button className="icon-btn" style={{ padding: '2px', color: 'var(--color-text-muted)' }} onClick={() => setEditingInchargeFor(group.cls)} title="Edit Incharge">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                                </button>
                              </div>
                            );
                          } else {
                            return (
                              <select 
                                style={{ fontSize: '0.85rem', padding: '2px 4px', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                                onChange={(e) => {
                                  if (e.target.value) handleAssignIncharge(group.cls, group.sections, e.target.value);
                                }}
                                value=""
                              >
                                <option value="" disabled>Assign Incharge...</option>
                                {teachers.map(t => (
                                  <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                              </select>
                            );
                          }
                        })()}
                      </h3>
                      {isModel1 && (
                        <div style={{ display: 'flex', gap: '24px', marginTop: '12px', fontSize: '0.95rem' }}>
                          <div><span style={{ color: 'var(--color-text-muted)' }}>Class Teacher:</span> <span style={{ fontWeight: 500 }}>{group.entries[0].teacher_name}</span></div>
                          <div><span style={{ color: 'var(--color-text-muted)' }}>Timing:</span> <span style={{ fontWeight: 500 }}>{formatTime(minStartTime)} - {formatTime(maxEndTime)}</span></div>
                          <div><span style={{ color: 'var(--color-text-muted)' }}>Days:</span> <span style={{ fontWeight: 500 }}>{daysText}</span></div>
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="icon-btn" title="Edit Schedule" onClick={handleEdit}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                      </button>
                      <button className="icon-btn danger" title="Delete Schedule" onClick={handleDelete}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {isModel1 ? (
                    <div style={{ padding: '16px' }} className="table-container-wrapper">
                      <h4 style={{ margin: '0 0 12px 0', color: 'var(--color-text-secondary)', fontSize: '1rem' }}>Timetable</h4>
                      <div className="table-container">
                        <table className="data-table" style={{ margin: 0, width: '100%' }}>
                          <thead>
                            <tr>
                              <th style={{ backgroundColor: 'white' }}>Section</th>
                              {Array.from(new Set(group.entries.map(e => e.subject))).sort().map(sub => (
                                <th key={sub} style={{ backgroundColor: 'white', textAlign: 'center' }}>{sub}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {group.sections.sort().map(sec => (
                              <tr key={sec}>
                                <td style={{ fontWeight: 500 }}>{sec}</td>
                                {Array.from(new Set(group.entries.map(e => e.subject))).sort().map(sub => (
                                  <td key={sub} style={{ textAlign: 'center', color: 'var(--color-primary)' }}>✓</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="table-container">
                      <table className="data-table" style={{ margin: 0, borderTop: 'none', width: '100%' }}>
                        <thead>
                          <tr>
                            <th style={{ backgroundColor: 'white' }}>Subject</th>
                            <th style={{ backgroundColor: 'white' }}>Teacher</th>
                            <th style={{ backgroundColor: 'white' }}>Time</th>
                            <th style={{ backgroundColor: 'white' }}>Days</th>
                          </tr>
                        </thead>
                      <tbody>
                        {(() => {
                          // Compress entries by Subject + Teacher + Time
                          const compressed: Record<string, { subject: string, teacher_name: string, start_time: string, end_time: string, days: string[] }> = {};
                          
                          group.entries.forEach(period => {
                            const key = `${period.subject}|${period.teacher_id}|${period.start_time}|${period.end_time}`;
                            if (!compressed[key]) {
                              compressed[key] = {
                                subject: period.subject,
                                teacher_name: period.teacher_name,
                                start_time: period.start_time,
                                end_time: period.end_time,
                                days: []
                              };
                            }
                            if (!compressed[key].days.includes(period.day)) {
                              compressed[key].days.push(period.day);
                            }
                          });

                          return Object.values(compressed)
                            .sort((a, b) => a.start_time.localeCompare(b.start_time) || a.subject.localeCompare(b.subject))
                            .map((period, i) => {
                              // Sort days according to standard order
                              period.days.sort((d1, d2) => DAYS.indexOf(d1) - DAYS.indexOf(d2));
                              const daysDisplay = period.days.length === DAYS.length ? 'Full Week' : period.days.join(', ');

                              return (
                                <tr key={i}>
                                  <td style={{ fontWeight: 500, color: 'var(--color-primary)' }}>{period.subject}</td>
                                  <td style={{ fontWeight: 500 }}>{period.teacher_name}</td>
                                  <td>{formatTime(period.start_time)} - {formatTime(period.end_time)}</td>
                                  <td style={{ color: 'var(--color-text-secondary)' }}>{daysDisplay}</td>
                                </tr>
                              );
                            });
                        })()}
                      </tbody>
                    </table>
                  </div>
                  )}
                </div>
              );
            });
          })()}
        </div>
      )}
    </div>
  );
};

export default AdminTimetable;
