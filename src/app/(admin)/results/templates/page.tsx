'use client';

import React, { useState } from 'react';
import { Plus, Edit2, Trash2, FileText, CheckCircle2, Percent, LayoutList } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface TemplateAssessment {
  assessmentTypeId: string;
  weightage: number | string;
  isIndependent: boolean;
}

interface ResultTemplate {
  id: string;
  name: string;
  assignedClasses: string[];
  assessments: TemplateAssessment[];
}

// We'll load assessment types and classes from the backend settings API

export const AdminResultTemplates: React.FC = () => {
  const [templates, setTemplates] = useState<ResultTemplate[]>([]);
  const [assessmentTypes, setAssessmentTypes] = useState<any[]>([]);
  const [classesList, setClassesList] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState<{type: 'success' | 'error' | null, message: string}>({type: null, message: ''});

  React.useEffect(() => {
    Promise.resolve(supabase.from('settings').select('*').eq('key', 'app_settings').single())
      .then(res => {
        const data = res.data?.value || {};
        if (data.result_templates) setTemplates(data.result_templates);
        if (data.assessment_types) setAssessmentTypes(data.assessment_types);
        if (data.classes) setClassesList(data.classes);
        setIsLoading(false);
      })
      .catch((err: any) => {
        console.error('Failed to load settings:', err);
        setIsLoading(false);
      });
  }, []);

  const syncBackend = async (updatedTemplates: ResultTemplate[], successMessage = 'Saved successfully!') => {
    try {
      const { data: currentData } = await supabase.from('settings').select('*').eq('key', 'app_settings').single();
      const currentSettings = currentData?.value || {};
      const newSettings = { ...currentSettings, result_templates: updatedTemplates };
      
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
  
  const [formData, setFormData] = useState<Omit<ResultTemplate, 'id'>>({
    name: '',
    assignedClasses: [],
    assessments: []
  });

  const handleOpenForm = (template?: ResultTemplate) => {
    if (template) {
      setEditingId(template.id);
      setFormData({
        name: template.name,
        assignedClasses: [...template.assignedClasses],
        assessments: template.assessments.map(a => ({ ...a }))
      });
    } else {
      setEditingId(null);
      setFormData({
        name: '',
        assignedClasses: [],
        assessments: []
      });
    }
    setIsFormOpen(true);
  };

  const handleSave = () => {
    if (!formData.name.trim() || formData.assessments.length === 0) return;

    let updatedTemplates;
    let msg = 'Saved successfully!';
    if (editingId) {
      updatedTemplates = templates.map(t => t.id === editingId ? { ...formData, id: editingId } : t);
      msg = 'Updated successfully!';
    } else {
      updatedTemplates = [...templates, { ...formData, id: Date.now().toString() }];
    }
    setTemplates(updatedTemplates);
    syncBackend(updatedTemplates, msg);
    setIsFormOpen(false);
  };

  const handleDelete = (id: string) => {
    if (!window.confirm("Are you sure you want to delete this template?")) return;
    const updatedTemplates = templates.filter(t => t.id !== id);
    setTemplates(updatedTemplates);
    syncBackend(updatedTemplates, 'Deleted successfully!');
  };

  const toggleClass = (className: string) => {
    setFormData(prev => ({
      ...prev,
      assignedClasses: prev.assignedClasses.includes(className)
        ? prev.assignedClasses.filter(c => c !== className)
        : [...prev.assignedClasses, className]
    }));
  };

  const addAssessmentToTemplate = (typeId: string) => {
    if (formData.assessments.some(a => a.assessmentTypeId === typeId)) return;
    setFormData(prev => ({
      ...prev,
      // Default to Independent = true (0 weightage), so it doesn't count unless explicitly included
      assessments: [...prev.assessments, { assessmentTypeId: typeId, weightage: 0, isIndependent: true }]
    }));
  };

  const updateAssessment = (index: number, field: keyof TemplateAssessment, value: any) => {
    const updated = [...formData.assessments];
    updated[index] = { ...updated[index], [field]: value };
    
    // If setting to independent, zero out the weightage
    if (field === 'isIndependent' && value === true) {
      updated[index].weightage = 0;
    }
    
    setFormData({ ...formData, assessments: updated });
  };

  const removeAssessment = (index: number) => {
    setFormData(prev => ({
      ...prev,
      assessments: prev.assessments.filter((_, i) => i !== index)
    }));
  };

  const totalWeightage = formData.assessments
    .filter(a => !a.isIndependent)
    .reduce((sum, a) => sum + (Number(a.weightage) || 0), 0);

  const hasNonIndependent = formData.assessments.some(a => !a.isIndependent);
  const isWeightageValid = !hasNonIndependent || totalWeightage === 100;
  
  const hasNoAssessments = formData.assessments.length === 0;
  const isNameEmpty = !formData.name.trim();

  return (
    <div className="page-content" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '24px', marginBottom: '8px' }}>Result Templates</h1>
          <p className="body-text" style={{ color: 'var(--color-text-secondary)', margin: 0 }}>Configure how different assessments combine to form the final report card grades.</p>
        </div>
        <button className="btn-primary" onClick={() => handleOpenForm()} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={16} /> Create Template
        </button>
      </div>

      {statusMsg.type && (
        <div className={`toast ${statusMsg.type}`} style={{ marginBottom: '24px' }}>
          {statusMsg.message}
        </div>
      )}

      {isLoading ? (
        <div className="card" style={{ padding: '24px', textAlign: 'center' }}>Loading result templates...</div>
      ) : isFormOpen ? (
        <div className="card" style={{ padding: '24px', background: 'var(--color-surface)', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '20px', marginBottom: '24px' }}>{editingId ? 'Edit Result Template' : 'New Result Template'}</h2>
          
          <div className="input-group" style={{ maxWidth: '400px' }}>
            <label className="input-label">Template Name <span style={{ color: 'var(--color-danger)' }}>*</span></label>
            <input 
              type="text" 
              className={`input-field ${isNameEmpty ? 'border-danger' : ''}`}
              style={{ border: isNameEmpty ? '1px solid var(--color-danger)' : undefined }}
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              placeholder="e.g. Primary Classes Result Template"
            />
            {isNameEmpty && <span style={{ color: 'var(--color-danger)', fontSize: '12px', marginTop: '4px', display: 'block' }}>Template Name is required.</span>}
          </div>

          <div style={{ marginTop: '32px' }}>
            <h3 style={{ fontSize: '16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <LayoutList size={18} color="var(--color-primary)" /> Assigned Classes
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>Select the classes that will use this result format.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {classesList.map(cls => (
                <button
                  key={cls}
                  onClick={() => toggleClass(cls)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '20px',
                    border: `1px solid ${formData.assignedClasses.includes(cls) ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    background: formData.assignedClasses.includes(cls) ? 'var(--color-primary)' : 'white',
                    color: formData.assignedClasses.includes(cls) ? 'white' : 'var(--color-text-main)',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 500,
                    transition: 'all 0.2s'
                  }}
                >
                  {cls}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: '32px', borderTop: '1px solid var(--color-border)', paddingTop: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Percent size={18} color="var(--color-primary)" /> Weightage Engine <span style={{ color: 'var(--color-danger)' }}>*</span>
              </h3>
              <div style={{ padding: '6px 12px', background: isWeightageValid ? '#dcfce7' : '#fee2e2', color: isWeightageValid ? '#166534' : '#991b1b', borderRadius: '20px', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                Total Weight: {totalWeightage}%
                {isWeightageValid && <CheckCircle2 size={14} />}
              </div>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '24px' }}>
              Add assessments to this template and assign their weightage. Mark an assessment as "Independent" if it should appear on the report card but NOT count towards the final percentage.
            </p>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
              <select 
                className="input-field" 
                style={{ maxWidth: '300px', border: hasNoAssessments ? '1px solid var(--color-danger)' : undefined }}
                onChange={(e) => {
                  if (e.target.value) {
                    addAssessmentToTemplate(e.target.value);
                    e.target.value = '';
                  }
                }}
                value=""
              >
                <option value="">+ Add Assessment Type...</option>
                {assessmentTypes
                  .filter(at => !formData.assessments.some(fa => fa.assessmentTypeId === at.id))
                  .map(at => (
                    <option key={at.id} value={at.id}>{at.name} ({at.category})</option>
                  ))
                }
              </select>
            </div>

            {formData.assessments.length > 0 && (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', background: 'white', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                <thead style={{ background: 'var(--color-bg-secondary)' }}>
                  <tr>
                    <th style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Assessment Type</th>
                    <th style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Independent Marking?</th>
                    <th style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--color-text-secondary)', fontWeight: 600, width: '150px' }}>Weightage (%)</th>
                    <th style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--color-text-secondary)', fontWeight: 600, width: '80px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.assessments.map((assessment, index) => {
                    const typeObj = assessmentTypes.find(t => t.id === assessment.assessmentTypeId);
                    return (
                      <tr key={index} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '16px', fontWeight: 500, color: 'var(--color-text-main)' }}>
                          {typeObj?.name || 'Unknown'}
                        </td>
                        <td style={{ padding: '16px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                            <input 
                              type="checkbox" 
                              checked={assessment.isIndependent}
                              onChange={e => updateAssessment(index, 'isIndependent', e.target.checked)}
                            />
                            Independent (Don't count in Total %)
                          </label>
                        </td>
                        <td style={{ padding: '16px' }}>
                          <input 
                            type="number" 
                            className="input-field" 
                            style={{ padding: '6px 12px' }}
                            value={assessment.weightage}
                            onChange={e => updateAssessment(index, 'weightage', e.target.value === '' ? '' : Number(e.target.value))}
                            disabled={assessment.isIndependent}
                            min="0"
                            max="100"
                          />
                        </td>
                        <td style={{ padding: '16px', textAlign: 'right' }}>
                          <button onClick={() => removeAssessment(index)} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: '4px' }}>
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            
            {hasNoAssessments && (
              <p style={{ color: 'var(--color-danger)', fontSize: '13px', marginTop: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={14} /> Please add at least one assessment type.
              </p>
            )}
            
            {formData.assessments.length > 0 && !isWeightageValid && (
              <p style={{ color: 'var(--color-danger)', fontSize: '13px', marginTop: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={14} /> If you have non-independent assessments, their total weightage must equal exactly 100% (currently {totalWeightage}%).
              </p>
            )}
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
            <button className="btn-primary" onClick={handleSave} disabled={isNameEmpty || hasNoAssessments || !isWeightageValid}>Save Template</button>
            <button className="btn-secondary" onClick={() => setIsFormOpen(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '24px' }}>
          {templates.map(template => (
            <div key={template.id} className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ background: '#e0e7ff', color: '#4338ca', padding: '12px', borderRadius: '12px' }}>
                    <FileText size={24} />
                  </div>
                  <div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', color: 'var(--color-text-heading)' }}>{template.name}</h3>
                    <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                      {template.assignedClasses.length} Classes Assigned
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="icon-btn" onClick={() => handleOpenForm(template)} title="Edit"><Edit2 size={16} /></button>
                  <button className="icon-btn danger" onClick={() => handleDelete(template.id)} title="Delete"><Trash2 size={16} /></button>
                </div>
              </div>

              <div style={{ background: 'var(--color-bg-secondary)', padding: '16px', borderRadius: '8px', marginBottom: '16px', flex: 1 }}>
                <h4 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--color-text-muted)', margin: '0 0 12px 0', letterSpacing: '0.05em' }}>Weightage Breakdown</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {template.assessments.length === 0 ? (
                    <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>No assessments configured.</span>
                  ) : (
                    template.assessments.map((a, idx) => {
                      const typeObj = assessmentTypes.find(t => t.id === a.assessmentTypeId);
                      return (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                          <span style={{ color: 'var(--color-text-main)', fontWeight: 500 }}>{typeObj?.name}</span>
                          {a.isIndependent ? (
                            <span style={{ color: 'var(--color-text-muted)', fontSize: '12px', fontStyle: 'italic' }}>Independent</span>
                          ) : (
                            <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{a.weightage}%</span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--color-text-muted)', margin: '0 0 8px 0', letterSpacing: '0.05em' }}>Applied To</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {template.assignedClasses.length === 0 ? (
                    <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Not assigned to any class yet</span>
                  ) : (
                    template.assignedClasses.slice(0, 5).map(cls => (
                      <span key={cls} style={{ background: 'white', border: '1px solid var(--color-border)', fontSize: '12px', padding: '4px 10px', borderRadius: '12px', color: 'var(--color-text-secondary)' }}>
                        {cls}
                      </span>
                    ))
                  )}
                  {template.assignedClasses.length > 5 && (
                    <span style={{ background: 'var(--color-bg-secondary)', fontSize: '12px', padding: '4px 10px', borderRadius: '12px', color: 'var(--color-text-muted)' }}>
                      +{template.assignedClasses.length - 5} more
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminResultTemplates;
