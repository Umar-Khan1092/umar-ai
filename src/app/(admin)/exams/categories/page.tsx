'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Check, CheckSquare, Square } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface AssessmentType {
  id: string;
  name: string;
  category: string;
  description: string;
  defaultWeightage: number;
  appearsOnReportCard: boolean;
  requiresDateSheet: boolean;
  requiresTime: boolean;
  requiresInvigilator: boolean;
  allowTeacherCreation: boolean;
}

export const AdminExamCategories: React.FC = () => {
  const [types, setTypes] = useState<AssessmentType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState<{type: 'success' | 'error' | null, message: string}>({type: null, message: ''});

  useEffect(() => {
    Promise.resolve(supabase.from('settings').select('*').eq('key', 'app_settings').single())
      .then(res => {
        const data = res.data?.value || {};
        if (data.assessment_types && data.assessment_types.length > 0) {
          setTypes(data.assessment_types);
        } else {
          // Default fallback if empty
          setTypes([
            { id: '1', name: 'Weekly Test', category: 'Continuous Assessment', description: 'Routine continuous assessment', defaultWeightage: 5, appearsOnReportCard: true, requiresDateSheet: false, requiresTime: false, requiresInvigilator: false, allowTeacherCreation: true },
            { id: '2', name: 'Monthly Test', category: 'Continuous Assessment', description: 'End of month evaluation', defaultWeightage: 10, appearsOnReportCard: true, requiresDateSheet: false, requiresTime: false, requiresInvigilator: false, allowTeacherCreation: true },
            { id: '3', name: 'Mid Term', category: 'Term Exam', description: 'Half-yearly comprehensive exam', defaultWeightage: 30, appearsOnReportCard: true, requiresDateSheet: true, requiresTime: true, requiresInvigilator: true, allowTeacherCreation: false },
            { id: '4', name: 'Final Term', category: 'Term Exam', description: 'End of year final exam', defaultWeightage: 70, appearsOnReportCard: true, requiresDateSheet: true, requiresTime: true, requiresInvigilator: true, allowTeacherCreation: false },
          ]);
        }
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch assessment types:', err);
        setIsLoading(false);
      });
  }, []);

  const syncBackend = async (updatedTypes: AssessmentType[], successMessage = 'Saved successfully!') => {
    try {
      const { data: currentData } = await supabase.from('settings').select('*').eq('key', 'app_settings').single();
      const currentSettings = currentData?.value || {};
      const newSettings = { ...currentSettings, assessment_types: updatedTypes };
      
      const { error } = await supabase.from('settings').update({ value: newSettings }).eq('key', 'app_settings');
      if (error) throw error;
      
      setStatusMsg({ type: 'success', message: successMessage });
      setTimeout(() => setStatusMsg({ type: null, message: '' }), 3000);
    } catch (err: any) {
      setStatusMsg({ type: 'error', message: err.message });
      setTimeout(() => setStatusMsg({ type: null, message: '' }), 3000);
    }
  };

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<AssessmentType>>({ 
    name: '', category: 'Continuous Assessment', description: '', defaultWeightage: 0,
    appearsOnReportCard: true, requiresDateSheet: false, requiresTime: false, requiresInvigilator: false, allowTeacherCreation: true
  });

  const openAddForm = () => {
    setEditingId(null);
    setFormData({ 
      name: '', category: 'Continuous Assessment', description: '', defaultWeightage: 0,
      appearsOnReportCard: true, requiresDateSheet: false, requiresTime: false, requiresInvigilator: false, allowTeacherCreation: true
    });
    setIsFormOpen(true);
  };

  const openEditForm = (type: AssessmentType) => {
    setEditingId(type.id);
    setFormData({ ...type });
    setIsFormOpen(true);
  };

  const handleSave = () => {
    if (formData.name) {
      let updatedTypes;
      let msg = 'Saved successfully!';
      if (editingId) {
        updatedTypes = types.map(t => t.id === editingId ? { ...(formData as AssessmentType), id: editingId } : t);
        msg = 'Updated successfully!';
      } else {
        updatedTypes = [...types, { ...(formData as AssessmentType), id: Date.now().toString() }];
      }
      
      setTypes(updatedTypes);
      syncBackend(updatedTypes, msg);
      setIsFormOpen(false);
    }
  };

  const handleDelete = (id: string) => {
    if (!window.confirm("Are you sure you want to delete this assessment type?")) return;
    const updatedTypes = types.filter(c => c.id !== id);
    setTypes(updatedTypes);
    syncBackend(updatedTypes, 'Deleted successfully!');
  };

  const toggleToggle = (key: keyof AssessmentType) => {
    setFormData({ ...formData, [key]: !formData[key] });
  };

  const renderToggle = (label: string, key: keyof AssessmentType) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--color-background)', borderRadius: '8px', border: '1px solid var(--color-border)', cursor: 'pointer' }} onClick={() => toggleToggle(key)}>
      <span style={{ fontSize: '14px', fontWeight: 500 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: '4px', background: formData[key] ? 'var(--color-primary)' : 'transparent', border: `1px solid ${formData[key] ? 'var(--color-primary)' : 'var(--color-border)'}`, color: 'white' }}>
        {formData[key] && <Check size={14} />}
      </div>
    </div>
  );

  return (
    <div className="page-content" style={{ padding: '16px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: '4px', fontSize: '24px' }}>Assessment Types Master</h1>
          <p className="body-text" style={{ color: 'var(--color-text-secondary)', margin: 0 }}>Configure the properties of all assessments (Tests, Quizzes, Term Exams) to drive the system's behavior.</p>
        </div>
        <button className="btn-primary" onClick={openAddForm} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={16} /> Add Assessment Type
        </button>
      </div>

      {statusMsg.type && (
        <div className={`toast ${statusMsg.type}`} style={{ marginBottom: '24px' }}>
          {statusMsg.message}
        </div>
      )}

      {isLoading ? (
        <div className="card" style={{ padding: '24px', textAlign: 'center' }}>Loading assessment types...</div>
      ) : (
        <>
          {isFormOpen && (
            <div className="card" style={{ padding: '24px', marginBottom: '32px', background: 'var(--color-surface)' }}>
              <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px', color: 'var(--color-text-heading)' }}>
                {editingId ? 'Edit Assessment Type' : 'Create New Assessment Type'}
              </h3>
              
              <div className="form-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div className="input-group">
                  <label className="input-label">Assessment Name</label>
                  <input type="text" className="input-field" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Surprise Quiz" />
                </div>
                <div className="input-group">
                  <label className="input-label">Category</label>
                  <select className="input-field" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                    <option value="Continuous Assessment">Continuous Assessment</option>
                    <option value="Term Exam">Term Exam</option>
                    <option value="Project/Practical">Project / Practical</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="input-group" style={{ gridColumn: 'span 2' }}>
                  <label className="input-label">Short Description</label>
                  <input type="text" className="input-field" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Optional description" />
                </div>
              </div>

              <h4 style={{ fontSize: '15px', color: 'var(--color-text-heading)', marginBottom: '12px', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px' }}>Configuration Toggles</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                {renderToggle('Requires Date Sheet?', 'requiresDateSheet')}
                {renderToggle('Requires Time Schedule?', 'requiresTime')}
                {renderToggle('Requires Invigilator?', 'requiresInvigilator')}
                {renderToggle('Allow Teacher to Create?', 'allowTeacherCreation')}
                {renderToggle('Appears on Report Card?', 'appearsOnReportCard')}
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '16px', borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
                <button className="btn-primary" onClick={handleSave}>Save Configuration</button>
                <button className="btn-secondary" onClick={() => setIsFormOpen(false)}>Cancel</button>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
            {types.map(type => (
              <div key={type.id} className="card" style={{ padding: '0', overflow: 'hidden', borderLeft: `6px solid ${type.requiresDateSheet ? 'var(--color-primary)' : 'var(--color-success)'}` }}>
                <div style={{ display: 'flex', padding: '20px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                      <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--color-text-heading)' }}>{type.name}</h3>
                      <span style={{ fontSize: '12px', padding: '4px 10px', background: 'var(--color-background)', borderRadius: '20px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>{type.category}</span>
                    </div>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', margin: 0 }}>{type.description}</p>
                  </div>

                  <div style={{ display: 'flex', gap: '32px', paddingLeft: '24px', borderLeft: '1px solid var(--color-border)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: type.requiresDateSheet ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
                        {type.requiresDateSheet ? <CheckSquare size={14} style={{ color: 'var(--color-primary)' }}/> : <Square size={14} />} Requires Date Sheet
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: type.requiresInvigilator ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
                        {type.requiresInvigilator ? <CheckSquare size={14} style={{ color: 'var(--color-primary)' }}/> : <Square size={14} />} Requires Invigilator
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: type.allowTeacherCreation ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
                        {type.allowTeacherCreation ? <CheckSquare size={14} style={{ color: 'var(--color-success)' }}/> : <Square size={14} />} Teacher Can Create
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: type.appearsOnReportCard ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
                        {type.appearsOnReportCard ? <CheckSquare size={14} style={{ color: 'var(--color-success)' }}/> : <Square size={14} />} Appears on Report Card
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', borderLeft: '1px solid var(--color-border)', paddingLeft: '24px' }}>
                      <button onClick={() => openEditForm(type)} style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', padding: '8px', borderRadius: '4px' }} className="hover-bg" title="Edit"><Edit2 size={16} /></button>
                      <button onClick={() => handleDelete(type.id)} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: '8px', borderRadius: '4px' }} className="hover-bg" title="Delete"><Trash2 size={16} /></button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default AdminExamCategories;
