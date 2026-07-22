'use client';

import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export const AttendanceConfig: React.FC = () => {
  const [classes, setClasses] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [settings, setSettings] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{type: 'success'|'error'|null, message: string}>({type: null, message: ''});

  useEffect(() => {
    // Fetch unique classes/sections from students
    supabase.from('students').select('academic_class, section')
      .then(res => {
        const data = res.data || [];
        const uniqueClasses = Array.from(new Set(data.map((s: any) => `${s.academic_class}|${s.section}`)))
          .filter((val: any) => val !== 'undefined|undefined' && !val.includes('null'))
          .map((val: any) => {
            const [c, s] = val.split('|');
            return { class_name: c, section: s };
          })
          .sort((a: any, b: any) => a.class_name.localeCompare(b.class_name));
        setClasses(uniqueClasses);
      });

    // Fetch teachers
    supabase.from('staff').select('*').eq('role', 'Teacher')
      .then(res => { if (res.data) setStaff(res.data); });

    // Fetch current attendance settings
    supabase.from('settings').select('*').eq('key', 'attendance_settings').single()
      .then(res => {
        if (res.data?.value) setSettings(res.data.value);
      });
  }, []);

  const getSetting = (className: string, section: string) => {
    const existing = settings.find(s => s.class_name === className && s.section === section);
    return existing || { class_name: className, section, mode: 'Incharge', incharge_teacher_id: '' };
  };

  const updateSetting = (className: string, section: string, field: string, value: string) => {
    setSettings(prev => {
      const exists = prev.find(s => s.class_name === className && s.section === section);
      if (exists) {
        return prev.map(s => s.class_name === className && s.section === section ? { ...s, [field]: value } : s);
      }
      return [...prev, { class_name: className, section, mode: 'Incharge', incharge_teacher_id: '', [field]: value }];
    });
  };

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      // Upsert attendance settings into settings table
      const { error } = await supabase
        .from('settings')
        .upsert({ key: 'attendance_settings', value: settings }, { onConflict: 'key' });
      
      if (error) throw error;
      
      setStatusMsg({type: 'success', message: 'Attendance Configurations Saved!'});
      setTimeout(() => setStatusMsg({type: null, message: ''}), 3000);
    } catch(err: any) {
      setStatusMsg({type: 'error', message: err.message});
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="page-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', color: 'var(--color-primary)', margin: '0 0 8px 0' }}>Attendance Configuration</h1>
          <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>Map teachers as class incharges and configure attendance mode per class.</p>
        </div>
        <button className="btn-primary" onClick={saveSettings} disabled={isSaving} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Save size={18} /> {isSaving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>

      {statusMsg.type && (
        <div className={`toast ${statusMsg.type}`} style={{ position: 'relative', top: 0, left: 0, right: 0, transform: 'none', margin: '0 0 24px 0' }}>
          {statusMsg.message}
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data-table" style={{ margin: 0 }}>
          <thead>
            <tr>
              <th>Class</th>
              <th>Section</th>
              <th>Attendance Modality</th>
              <th>Class Incharge (For Daily Mode)</th>
            </tr>
          </thead>
          <tbody>
            {classes.length > 0 ? classes.map((c, idx) => {
              const setting = getSetting(c.class_name, c.section);
              return (
                <tr key={idx}>
                  <td style={{ fontWeight: 600 }}>{c.class_name}</td>
                  <td>{c.section}</td>
                  <td>
                    <select 
                      className="input-field"
                      value={setting.mode}
                      onChange={e => updateSetting(c.class_name, c.section, 'mode', e.target.value)}
                    >
                      <option value="Incharge">Daily (Morning Incharge)</option>
                      <option value="Lecture">Lecture-Based (Subject Teachers)</option>
                    </select>
                  </td>
                  <td>
                    {setting.mode === 'Incharge' ? (
                      <select 
                        className="input-field"
                        value={setting.incharge_teacher_id || ''}
                        onChange={e => updateSetting(c.class_name, c.section, 'incharge_teacher_id', e.target.value)}
                      >
                        <option value="">-- Select Teacher --</option>
                        {staff.map(t => (
                          <option key={t.id} value={t.id}>{t.name} ({t.id})</option>
                        ))}
                      </select>
                    ) : (
                      <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>
                        Inherited from Timetable Schedule
                      </span>
                    )}
                  </td>
                </tr>
              )
            }) : (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '24px' }}>Loading classes...</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AttendanceConfig;
