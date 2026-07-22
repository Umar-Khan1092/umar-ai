'use client';

import React, { useState, useEffect } from 'react';
import { BookOpen, User, Plus, Trash2 } from 'lucide-react';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { supabase } from '@/lib/supabase';

interface TimetableEntry {
  id?: string;
  class_name: string;
  section: string;
  day: string;
  start_time: string;
  end_time: string;
  subject: string;
  teacher_id?: string;
  teacher_name?: string;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const StaffLectures: React.FC = () => {
  const [staffList, setStaffList] = useState<any[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  
  const [classes, setClasses] = useState<string[]>([]);
  const [sections, setSections] = useState<string[]>([]);
  const [classSubjects, setClassSubjects] = useState<Record<string, string[]>>({});
  const [teacherTimetable, setTeacherTimetable] = useState<TimetableEntry[]>([]);
  
  const [newLecture, setNewLecture] = useState<Partial<TimetableEntry>>({ class_name: '', section: '', subject: '', start_time: '', end_time: '' });
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });

  useEffect(() => {
    Promise.resolve(supabase.from('staff').select('*').neq('status', 'Struck Off').eq('role', 'Teacher'))
      .then(res => { if (res.data) setStaffList(res.data); })
      .catch((err: any) => console.error(err));
      
    Promise.resolve(supabase.from('settings').select('*').eq('key', 'app_settings').single())
      .then(res => {
        const data = res.data?.value || {};
        setClasses(data.classes || []);
        setSections(data.sections || []);
        setClassSubjects(data.class_subjects || {});
      })
      .catch((err: any) => console.error(err));
  }, []);

  useEffect(() => {
    if (selectedStaff) {
      Promise.resolve(supabase.from('timetable').select('*').eq('teacher_id', selectedStaff.id))
        .then(res => { if (res.data) setTeacherTimetable(res.data); })
        .catch((err: any) => console.error(err));
    }
  }, [selectedStaff]);

  const handleSelectChange = (name: string, value: string) => {
    setNewLecture(prev => {
      const updated = { ...prev, [name]: value };
      if (name === 'class_name') {
        updated.subject = ''; // Reset subject when class changes
      }
      return updated;
    });
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewLecture(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleDayToggle = (day: string) => {
    if (day === 'Every Day') {
      if (selectedDays.length === DAYS.length) {
        setSelectedDays([]);
      } else {
        setSelectedDays([...DAYS]);
      }
      return;
    }
    
    setSelectedDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleAssignLecture = async () => {
    if (!selectedStaff) return;
    if (!newLecture.class_name || !newLecture.section || !newLecture.subject || !newLecture.start_time || !newLecture.end_time || selectedDays.length === 0) {
      setStatus({ type: 'error', message: 'Please fill all fields, select at least one day, and provide Start/End Times.' });
      return;
    }

    try {
      if (editingId && selectedDays.length === 1) {
        // Editing a single period
        const payload = {
          ...newLecture,
          day: selectedDays[0],
          teacher_id: selectedStaff.id,
          teacher_name: selectedStaff.name
        };
        
        const { error } = await supabase.from('timetable').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        // Creating new periods
        for (const day of selectedDays) {
          const payload = {
            ...newLecture,
            day,
            teacher_id: selectedStaff.id,
            teacher_name: selectedStaff.name
          };
          const { error } = await supabase.from('timetable').insert(payload);
          if (error) throw error;
        }
      }

      setStatus({ type: 'success', message: editingId ? 'Lecture updated successfully!' : 'Lecture assigned successfully to timetable!' });
      setNewLecture({ class_name: '', section: '', subject: '', start_time: '', end_time: '' });
      setSelectedDays([]);
      setEditingId(null);
      
      // Refresh timetable
      const res = await supabase.from('timetable').select('*').eq('teacher_id', selectedStaff.id);
      if (res.data) setTeacherTimetable(res.data);
      
      setTimeout(() => setStatus({ type: null, message: '' }), 3000);
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'An error occurred' });
    }
  };

  const handleRemoveLecture = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this period from the timetable?')) return;

    try {
      const { error } = await supabase.from('timetable').delete().eq('id', id);
      if (error) throw error;
      
      setTeacherTimetable(prev => prev.filter(t => t.id !== id));
      if (editingId === id) cancelEdit();
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditLecture = (lecture: TimetableEntry) => {
    setEditingId(lecture.id!);
    setNewLecture({
      class_name: lecture.class_name,
      section: lecture.section,
      subject: lecture.subject,
      start_time: lecture.start_time,
      end_time: lecture.end_time
    });
    setSelectedDays([lecture.day]);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setNewLecture({ class_name: '', section: '', subject: '', start_time: '', end_time: '' });
    setSelectedDays([]);
  };

  const filteredTeachers = staffList.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="page-content">
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <h1 className="section-heading" style={{ marginBottom: '4px' }}>Workload & Lectures</h1>
        <p className="subtitle">Assign classes and subjects to teaching staff.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 'var(--space-4)', alignItems: 'start' }}>
        {/* Left Sidebar - Staff List */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: 'var(--space-3)', borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', marginBottom: '8px' }}>Teaching Staff</h3>
            <input 
              type="text" 
              className="input-field" 
              placeholder="Search teachers..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            {filteredTeachers.length === 0 ? (
              <p className="body-text" style={{ padding: 'var(--space-3)' }}>No teachers found.</p>
            ) : (
              filteredTeachers.map(staff => (
                <div 
                  key={staff.id}
                  onClick={() => setSelectedStaff(staff)}
                  style={{
                    padding: 'var(--space-3)',
                    borderBottom: '1px solid var(--color-border)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    backgroundColor: selectedStaff?.id === staff.id ? 'var(--color-background)' : 'white',
                    borderLeft: selectedStaff?.id === staff.id ? '4px solid var(--color-primary)' : '4px solid transparent',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                    {staff.profile_image_url ? (
                      <img src={`${staff.profile_image_url}`} alt={staff.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <User size={20} color="var(--color-text-muted)" />
                    )}
                  </div>
                  <div style={{ overflow: 'hidden' }}>
                    <h4 style={{ margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{staff.name}</h4>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-muted)' }}>{staff.qualification}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Content - Workload */}
        <div className="card">
          {!selectedStaff ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', color: 'var(--color-text-muted)' }}>
              <BookOpen size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
              <h3>Select a teacher to manage their workload</h3>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: 'var(--space-4)' }}>
                <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: 'var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {selectedStaff.profile_image_url ? (
                    <img src={`${selectedStaff.profile_image_url}`} alt={selectedStaff.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <User size={30} color="var(--color-text-muted)" />
                  )}
                </div>
                <div>
                  <h2 style={{ margin: 0 }}>{selectedStaff.name}'s Workload</h2>
                  <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>{selectedStaff.qualification} • {(selectedStaff.assigned_lectures || []).length} Lectures Assigned</p>
                </div>
              </div>

              {status.type && (
                <div className={`toast ${status.type}`} style={{ marginBottom: 'var(--space-3)' }}>
                  {status.message}
                </div>
              )}

              {/* Assignment Form */}
              <div style={{ backgroundColor: 'var(--color-background)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem' }}>{editingId ? 'Edit Lecture' : 'Assign New Lecture'}</h3>
                  {editingId && (
                    <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={cancelEdit}>Cancel Edit</button>
                  )}
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <SearchableSelect 
                    label="Class"
                    name="class_name"
                    value={newLecture.class_name || ''}
                    options={classes}
                    onChange={handleSelectChange}
                    placeholder="Select Class"
                  />
                  <SearchableSelect 
                    label="Section"
                    name="section"
                    value={newLecture.section || ''}
                    options={sections}
                    onChange={handleSelectChange}
                    placeholder="Select Section"
                  />
                  <SearchableSelect 
                    label="Subject"
                    name="subject"
                    value={newLecture.subject || ''}
                    options={newLecture.class_name ? ['All Subjects', ...(classSubjects[newLecture.class_name] || [])] : []}
                    onChange={handleSelectChange}
                    placeholder={newLecture.class_name ? "Select Subject" : "Select Class first"}
                  />
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px', alignItems: 'end', marginBottom: '16px' }}>
                  <div>
                    <label className="input-label" style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>Start Time</label>
                    <input type="time" name="start_time" value={newLecture.start_time || ''} onChange={handleTimeChange} className="input-field" />
                  </div>
                  <div>
                    <label className="input-label" style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>End Time</label>
                    <input type="time" name="end_time" value={newLecture.end_time || ''} onChange={handleTimeChange} className="input-field" />
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label className="input-label" style={{ display: 'block', marginBottom: '8px', fontSize: '12px' }}>Select Days</label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button 
                      className={`btn-secondary ${selectedDays.length === DAYS.length ? 'active' : ''}`}
                      onClick={() => handleDayToggle('Every Day')}
                      style={{ padding: '4px 8px', fontSize: '12px', backgroundColor: selectedDays.length === DAYS.length ? 'var(--color-primary)' : '', color: selectedDays.length === DAYS.length ? 'white' : '' }}
                      disabled={editingId !== null}
                    >
                      Every Day
                    </button>
                    {DAYS.map(day => (
                      <button 
                        key={day}
                        className={`btn-secondary ${selectedDays.includes(day) ? 'active' : ''}`}
                        onClick={() => handleDayToggle(day)}
                        style={{ padding: '4px 8px', fontSize: '12px', backgroundColor: selectedDays.includes(day) ? 'var(--color-primary)' : '', color: selectedDays.includes(day) ? 'white' : '' }}
                        disabled={editingId !== null && !selectedDays.includes(day)}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn-primary" onClick={handleAssignLecture} style={{ height: '38px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {editingId ? 'Save Changes' : <><Plus size={16} /> Assign to Timetable</>}
                  </button>
                </div>
              </div>

              {/* Current Lectures */}
              <div>
                <h3 style={{ marginTop: 0, marginBottom: '12px', fontSize: '1rem' }}>Lectures in Timetable</h3>
                {teacherTimetable.length === 0 ? (
                  <p className="body-text">No lectures scheduled in the timetable yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {teacherTimetable.sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || a.start_time.localeCompare(b.start_time)).map((lecture: TimetableEntry) => (
                      <div key={lecture.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <div style={{ backgroundColor: 'var(--color-primary)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', width: '80px', textAlign: 'center' }}>
                            {lecture.day.substring(0, 3)}
                          </div>
                          <div style={{ backgroundColor: 'var(--color-border)', color: 'var(--color-text-main)', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                            {lecture.class_name}-{lecture.section}
                          </div>
                          <div style={{ fontWeight: '500', width: '120px' }}>
                            {lecture.subject}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-text-muted)', fontSize: '12px', backgroundColor: 'var(--color-background)', padding: '4px 8px', borderRadius: '4px' }}>
                            <BookOpen size={12} /> {lecture.start_time} - {lecture.end_time}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => handleEditLecture(lecture)}>
                            Edit
                          </button>
                          <button className="icon-btn danger" onClick={() => handleRemoveLecture(lecture.id!)}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StaffLectures;
