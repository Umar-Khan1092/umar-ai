'use client';

import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Award } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Grade {
  id: string;
  name: string;
  minMarks: number | string;
  maxMarks: number | string;
  gradePoint: number | string;
  remark: string;
}

export const AdminGradeScales: React.FC = () => {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState<{type: 'success' | 'error' | null, message: string}>({type: null, message: ''});
  
  React.useEffect(() => {
    Promise.resolve(supabase.from('settings').select('*').eq('key', 'app_settings').single())
      .then(res => {
        const data = res.data?.value || {};
        if (data.grade_scales && data.grade_scales.length > 0) {
          setGrades(data.grade_scales);
        } else {
          // Default grades if empty
          setGrades([
            { id: '1', name: 'A+', minMarks: 90, maxMarks: 100, gradePoint: 4.0, remark: 'Outstanding' },
            { id: '2', name: 'A', minMarks: 80, maxMarks: 89, gradePoint: 3.7, remark: 'Excellent' },
            { id: '3', name: 'B+', minMarks: 70, maxMarks: 79, gradePoint: 3.3, remark: 'Very Good' },
            { id: '4', name: 'B', minMarks: 60, maxMarks: 69, gradePoint: 3.0, remark: 'Good' },
            { id: '5', name: 'C', minMarks: 50, maxMarks: 59, gradePoint: 2.0, remark: 'Satisfactory' },
            { id: '6', name: 'Fail', minMarks: 0, maxMarks: 49, gradePoint: 0.0, remark: 'Needs Improvement' },
          ]);
        }
        setIsLoading(false);
      })
      .catch((err: any) => {
        console.error('Failed to load settings:', err);
        setIsLoading(false);
      });
  }, []);

  const syncBackend = async (updatedGrades: Grade[], successMessage = 'Saved successfully!') => {
    try {
      const { data: currentData } = await supabase.from('settings').select('*').eq('key', 'app_settings').single();
      const currentSettings = currentData?.value || {};
      const newSettings = { ...currentSettings, grade_scales: updatedGrades };
      
      const { error } = await supabase.from('settings').update({ value: newSettings }).eq('key', 'app_settings');
      if (error) throw error;
      
      setStatusMsg({ type: 'success', message: successMessage });
      setTimeout(() => setStatusMsg({ type: null, message: '' }), 3000);
    } catch (err: any) {
      setStatusMsg({ type: 'error', message: err.message });
      setTimeout(() => setStatusMsg({ type: null, message: '' }), 3000);
    }
  };

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newGrade, setNewGrade] = useState<Partial<Grade>>({
    name: '', minMarks: '', maxMarks: '', gradePoint: '', remark: ''
  });

  const handleSave = () => {
    if (newGrade.name) {
      let updatedGrades;
      let msg = 'Saved successfully!';
      if (editingId) {
        updatedGrades = grades.map(g => g.id === editingId ? { ...(newGrade as Grade), id: editingId } : g).sort((a, b) => Number(b.minMarks) - Number(a.minMarks));
        msg = 'Updated successfully!';
      } else {
        updatedGrades = [...grades, { ...(newGrade as Grade), id: Date.now().toString() }].sort((a, b) => Number(b.minMarks) - Number(a.minMarks));
      }
      setGrades(updatedGrades);
      syncBackend(updatedGrades, msg);
      setIsAdding(false);
      setEditingId(null);
      setNewGrade({ name: '', minMarks: '', maxMarks: '', gradePoint: '', remark: '' });
    }
  };

  const handleDelete = (id: string) => {
    if (!window.confirm("Are you sure you want to delete this grade scale?")) return;
    const updatedGrades = grades.filter(c => c.id !== id);
    setGrades(updatedGrades);
    syncBackend(updatedGrades, 'Deleted successfully!');
  };

  const handleEdit = (grade: Grade) => {
    setNewGrade({ ...grade });
    setEditingId(grade.id);
    setIsAdding(true);
  };

  return (
    <div className="page-content" style={{ padding: '16px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: '4px', fontSize: '24px' }}>Grade Scales Configurator</h1>
          <p className="body-text" style={{ color: 'var(--color-text-secondary)', margin: 0 }}>Define custom grading logic to automatically calculate grades from marks.</p>
        </div>
        <button className="btn-primary" onClick={() => { setIsAdding(true); setEditingId(null); setNewGrade({ name: '', minMarks: '', maxMarks: '', gradePoint: '', remark: '' }); }} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={16} /> Add Grade Rule
        </button>
      </div>

      {statusMsg.type && (
        <div className={`toast ${statusMsg.type}`} style={{ marginBottom: '24px' }}>
          {statusMsg.message}
        </div>
      )}

      {isLoading ? (
        <div className="card" style={{ padding: '24px', textAlign: 'center' }}>Loading grade scales...</div>
      ) : isAdding ? (
        <div className="card" style={{ padding: '24px', marginBottom: '32px', background: 'var(--color-surface)' }}>
          <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px', color: 'var(--color-text-heading)' }}>{editingId ? 'Edit Grade Rule' : 'Create New Grade Rule'}</h3>
          
          <div className="form-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
            <div className="input-group">
              <label className="input-label">Grade Name</label>
              <input type="text" className="input-field" value={newGrade.name} onChange={e => setNewGrade({...newGrade, name: e.target.value})} placeholder="e.g. A+" />
            </div>
            <div className="input-group">
              <label className="input-label">Min Marks (%)</label>
              <input type="number" className="input-field" value={newGrade.minMarks} onChange={e => setNewGrade({...newGrade, minMarks: e.target.value === '' ? '' : Number(e.target.value)})} placeholder="0" />
            </div>
            <div className="input-group">
              <label className="input-label">Max Marks (%)</label>
              <input type="number" className="input-field" value={newGrade.maxMarks} onChange={e => setNewGrade({...newGrade, maxMarks: e.target.value === '' ? '' : Number(e.target.value)})} placeholder="100" />
            </div>
            <div className="input-group">
              <label className="input-label">Grade Point</label>
              <input type="number" step="0.1" className="input-field" value={newGrade.gradePoint} onChange={e => setNewGrade({...newGrade, gradePoint: e.target.value === '' ? '' : Number(e.target.value)})} placeholder="4.0" />
            </div>
            <div className="input-group">
              <label className="input-label">Auto-Remark</label>
              <input type="text" className="input-field" value={newGrade.remark} onChange={e => setNewGrade({...newGrade, remark: e.target.value})} placeholder="e.g. Excellent" />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <button className="btn-primary" onClick={handleSave}>Save Rule</button>
            <button className="btn-secondary" onClick={() => { setIsAdding(false); setEditingId(null); }}>Cancel</button>
          </div>
        </div>
      ) : (

      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'var(--color-background)', borderBottom: '1px solid var(--color-border)' }}>
              <th style={{ padding: '16px', fontWeight: 600, color: 'var(--color-text-secondary)', fontSize: '13px', textTransform: 'uppercase' }}>Grade Name</th>
              <th style={{ padding: '16px', fontWeight: 600, color: 'var(--color-text-secondary)', fontSize: '13px', textTransform: 'uppercase' }}>Range (%)</th>
              <th style={{ padding: '16px', fontWeight: 600, color: 'var(--color-text-secondary)', fontSize: '13px', textTransform: 'uppercase' }}>Grade Point</th>
              <th style={{ padding: '16px', fontWeight: 600, color: 'var(--color-text-secondary)', fontSize: '13px', textTransform: 'uppercase' }}>Auto-Remark</th>
              <th style={{ padding: '16px', fontWeight: 600, color: 'var(--color-text-secondary)', fontSize: '13px', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {grades.map((grade) => (
              <tr key={grade.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ background: grade.name.includes('Fail') ? '#FEE2E2' : '#E0E7FF', color: grade.name.includes('Fail') ? '#991B1B' : '#4338CA', padding: '8px', borderRadius: '8px' }}>
                      <Award size={18} />
                    </div>
                    <span style={{ fontWeight: 600, fontSize: '16px', color: 'var(--color-text-heading)' }}>{grade.name}</span>
                  </div>
                </td>
                <td style={{ padding: '16px', color: 'var(--color-text-primary)' }}>
                  {grade.minMarks}% - {grade.maxMarks}%
                </td>
                <td style={{ padding: '16px', color: 'var(--color-text-primary)' }}>
                  {Number(grade.gradePoint).toFixed(1)}
                </td>
                <td style={{ padding: '16px', color: 'var(--color-text-secondary)' }}>
                  {grade.remark}
                </td>
                <td style={{ padding: '16px', textAlign: 'right' }}>
                  <button onClick={() => handleEdit(grade)} style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', padding: '8px' }} className="hover-bg"><Edit2 size={16} /></button>
                  <button onClick={() => handleDelete(grade.id)} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: '8px' }} className="hover-bg"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
};

export default AdminGradeScales;
