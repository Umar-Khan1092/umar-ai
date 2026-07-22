'use client';

import React, { useState } from 'react';
import { Save, Palette, Image as ImageIcon, Layout, CheckCircle2, Type, Signature, Eye } from 'lucide-react';
import { supabase } from '@/lib/supabase';
export const AdminReportCardDesigner: React.FC = () => {
  const defaultConfig = {
    theme: 'classic',
    showSchoolLogo: true,
    showStudentPhoto: true,
    showPrincipalSignature: true,
    showInchargeSignature: true,
    showGradingKey: true,
    showAttendance: true,
    showRemarks: true,
    watermarkText: 'EDUCATITON ERRP',
    primaryColor: '#2563EB',
    headerTitle: '',
    headerSubtitle: 'Term Report Card - 2026',
    headerFont: 'serif'
  };
  const [config, setConfig] = useState(defaultConfig);
  const [instituteName, setInstituteName] = useState('School Name');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{type: 'success' | 'error' | null, message: string}>({type: null, message: ''});

  React.useEffect(() => {
    Promise.resolve(supabase.from('settings').select('*').eq('key', 'app_settings').single())
      .then(res => {
        const data = res.data?.value || {};
        if (data.report_card_design && Object.keys(data.report_card_design).length > 0) {
          setConfig(prev => ({ ...prev, ...data.report_card_design }));
        }
        if (data.institute_name) {
          setInstituteName(data.institute_name);
        }
        setIsLoading(false);
      })
      .catch((err: any) => {
        console.error('Failed to load settings:', err);
        setIsLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { data: currentData } = await supabase.from('settings').select('*').eq('key', 'app_settings').single();
      const currentSettings = currentData?.value || {};
      const newSettings = { ...currentSettings, report_card_design: config };
      
      const { error } = await supabase.from('settings').update({ value: newSettings }).eq('key', 'app_settings');
      if (error) throw error;
      setToast({ type: 'success', message: 'Report Card design saved successfully.' });
      setTimeout(() => setToast({ type: null, message: '' }), 3000);
    } catch (err: any) {
      setToast({ type: 'error', message: err.message });
      setTimeout(() => setToast({ type: null, message: '' }), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (key: keyof typeof config, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="page-content" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '24px', marginBottom: '8px' }}>Report Card Designer</h1>
          <p className="body-text" style={{ color: 'var(--color-text-secondary)', margin: 0 }}>Configure the visual layout and elements of the student report cards.</p>
        </div>
        <button className="btn-primary" onClick={handleSave} disabled={isSaving} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isSaving ? 'Saving...' : <><Save size={16} /> Save Design</>}
        </button>
      </div>

      {toast.type && (
        <div className={`toast ${toast.type}`} style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {toast.type === 'success' && <CheckCircle2 size={18} />}
          {toast.message}
        </div>
      )}

      {isLoading ? (
        <div className="card" style={{ padding: '24px', textAlign: 'center' }}>Loading design settings...</div>
      ) : (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
        {/* Left Column: Settings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* General Layout */}
          <div className="card" style={{ padding: '24px', background: 'var(--color-surface)' }}>
            <h3 style={{ fontSize: '16px', margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layout size={18} color="var(--color-primary)" /> General Layout
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label">Theme Style</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  {['minimal', 'classic', 'bordered'].map(theme => (
                    <div 
                      key={theme}
                      onClick={() => handleChange('theme', theme)}
                      style={{ 
                        padding: '12px', 
                        border: config.theme === theme ? '2px solid var(--color-primary)' : '1px solid var(--color-border)', 
                        borderRadius: '8px', 
                        cursor: 'pointer',
                        textAlign: 'center',
                        textTransform: 'capitalize',
                        fontWeight: config.theme === theme ? 600 : 400,
                        backgroundColor: config.theme === theme ? `${config.primaryColor}10` : 'transparent',
                        color: config.theme === theme ? config.primaryColor : 'var(--color-text-main)'
                      }}
                    >
                      {theme}
                    </div>
                  ))}
                </div>
              </div>

              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label">Primary Color (Headers & Accents)</label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <input 
                    type="color" 
                    value={config.primaryColor}
                    onChange={e => handleChange('primaryColor', e.target.value)}
                    style={{ width: '48px', height: '48px', padding: 0, border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                  />
                  <input 
                    type="text" 
                    className="input-field" 
                    value={config.primaryColor}
                    onChange={e => handleChange('primaryColor', e.target.value)}
                    style={{ flex: 1, margin: 0 }}
                  />
                </div>
              </div>

              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label">Watermark Text (Optional)</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={config.watermarkText || ''}
                  onChange={e => handleChange('watermarkText', e.target.value)}
                  placeholder="e.g. SCHOOL NAME"
                  style={{ margin: 0 }}
                />
              </div>
              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label">Report Card Title</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={config.headerTitle !== undefined ? config.headerTitle : ''}
                  onChange={e => handleChange('headerTitle', e.target.value)}
                  placeholder="Leave empty to use Institute Name"
                  style={{ margin: 0 }}
                />
              </div>

              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label">Report Card Subtitle</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={config.headerSubtitle !== undefined ? config.headerSubtitle : ''}
                  onChange={e => handleChange('headerSubtitle', e.target.value)}
                  placeholder="e.g. Term Report Card - 2026"
                  style={{ margin: 0 }}
                />
              </div>

              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label">Header Font Style</label>
                <select 
                  className="input-field" 
                  value={config.headerFont || 'serif'}
                  onChange={e => handleChange('headerFont', e.target.value)}
                  style={{ margin: 0 }}
                >
                  <option value="serif">Serif (Classic)</option>
                  <option value="sans-serif">Sans-Serif (Modern)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Display Elements */}
          <div className="card" style={{ padding: '24px', background: 'var(--color-surface)' }}>
            <h3 style={{ fontSize: '16px', margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Eye size={18} color="var(--color-primary)" /> Display Elements
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={config.showSchoolLogo}
                  onChange={e => handleChange('showSchoolLogo', e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px' }}>
                  <ImageIcon size={16} color="var(--color-text-secondary)" /> Show School Logo
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={config.showStudentPhoto}
                  onChange={e => handleChange('showStudentPhoto', e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px' }}>
                  <ImageIcon size={16} color="var(--color-text-secondary)" /> Show Student Photo
                </div>
              </label>
              
              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={config.showGradingKey}
                  onChange={e => handleChange('showGradingKey', e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px' }}>
                  <Type size={16} color="var(--color-text-secondary)" /> Show Grading Key Table
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={config.showAttendance}
                  onChange={e => handleChange('showAttendance', e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px' }}>
                  <Layout size={16} color="var(--color-text-secondary)" /> Show Attendance Summary
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={config.showRemarks}
                  onChange={e => handleChange('showRemarks', e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px' }}>
                  <Type size={16} color="var(--color-text-secondary)" /> Show Teacher Remarks
                </div>
              </label>
            </div>
          </div>

          {/* Signatures */}
          <div className="card" style={{ padding: '24px', background: 'var(--color-surface)' }}>
            <h3 style={{ fontSize: '16px', margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Signature size={18} color="var(--color-primary)" /> Signature Lines
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={config.showPrincipalSignature}
                  onChange={e => handleChange('showPrincipalSignature', e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '15px' }}>Principal Signature Line</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={config.showInchargeSignature}
                  onChange={e => handleChange('showInchargeSignature', e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '15px' }}>Class Incharge Signature Line</span>
              </label>
            </div>
          </div>
        </div>
        {/* Right Column: Live Preview */}
        <div>
          <div className="card" style={{ padding: '0', background: 'var(--color-surface)', height: '100%', minHeight: '600px', display: 'flex', flexDirection: 'column', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Palette size={18} /> Live Preview
              </h3>
              <span style={{ fontSize: '12px', padding: '4px 10px', backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)', borderRadius: '12px', color: 'var(--color-text-secondary)' }}>A4 Size Mockup</span>
            </div>
            
            <div style={{ padding: '32px', flex: 1, backgroundColor: 'var(--color-background)', display: 'flex', justifyContent: 'center', overflowY: 'auto', overflowX: 'hidden' }}>
              {/* Paper Element */}
              <div style={{ 
                width: '100%', 
                maxWidth: '500px', 
                backgroundColor: 'white', 
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                position: 'relative',
                padding: '24px',
                border: config.theme === 'bordered' ? `12px solid ${config.primaryColor}` : 'none',
                fontFamily: config.theme === 'minimal' ? 'Inter, sans-serif' : 'Times New Roman, serif',
                overflow: 'hidden',
                wordBreak: 'break-word'
              }}>
                {/* Watermark */}
                {config.watermarkText && (
                  <div style={{ 
                    position: 'absolute', 
                    top: '50%', 
                    left: '50%', 
                    transform: 'translate(-50%, -50%) rotate(-45deg)', 
                    fontSize: '48px', 
                    fontWeight: 'bold', 
                    color: 'rgba(0,0,0,0.08)', 
                    pointerEvents: 'none',
                    whiteSpace: 'pre-wrap',
                    textAlign: 'center',
                    width: '100%',
                    zIndex: 0,
                    userSelect: 'none'
                  }}>
                    {config.watermarkText}
                  </div>
                )}

                <div style={{ position: 'relative', zIndex: 1 }}>
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `2px solid ${config.primaryColor}`, paddingBottom: '16px', marginBottom: '24px' }}>
                    {config.showSchoolLogo && (
                      <div style={{ width: '60px', height: '60px', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
                        <ImageIcon size={24} />
                      </div>
                    )}
                    <div style={{ flex: 1, textAlign: config.showSchoolLogo ? (config.showStudentPhoto ? 'center' : 'left') : 'left', padding: '0 16px' }}>
                      <h2 style={{ 
                        margin: '0 0 4px 0', 
                        fontSize: '20px', 
                        color: config.theme === 'classic' ? config.primaryColor : 'var(--color-text-heading)',
                        fontFamily: config.headerFont === 'sans-serif' ? 'Inter, sans-serif' : 'Times New Roman, serif'
                      }}>
                        {config.headerTitle || instituteName || 'EDUCATITON ERRP'}
                      </h2>
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: config.headerFont === 'sans-serif' ? 'Inter, sans-serif' : 'Times New Roman, serif' }}>
                        {config.headerSubtitle !== undefined ? config.headerSubtitle : 'Term Report Card - 2026'}
                      </p>
                    </div>
                    {config.showStudentPhoto && (
                      <div style={{ width: '50px', height: '60px', backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
                        <ImageIcon size={20} />
                      </div>
                    )}
                  </div>

                  {/* Student Info */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '24px', fontSize: '12px' }}>
                    <div><strong>Name:</strong> John Doe</div>
                    <div><strong>Roll No:</strong> 1042</div>
                    <div><strong>Class:</strong> 9 - A</div>
                    <div><strong>Term:</strong> Final Term</div>
                  </div>

                  {/* Marks Table */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px', fontSize: '11px' }}>
                    <thead>
                      <tr style={{ backgroundColor: config.theme === 'minimal' ? 'transparent' : config.primaryColor, color: config.theme === 'minimal' ? config.primaryColor : 'white', borderBottom: config.theme === 'minimal' ? `2px solid ${config.primaryColor}` : 'none' }}>
                        <th style={{ padding: '8px', textAlign: 'left', border: config.theme === 'minimal' ? 'none' : '1px solid rgba(255,255,255,0.2)' }}>Subject</th>
                        <th style={{ padding: '8px', textAlign: 'center', border: config.theme === 'minimal' ? 'none' : '1px solid rgba(255,255,255,0.2)' }}>Marks</th>
                        <th style={{ padding: '8px', textAlign: 'center', border: config.theme === 'minimal' ? 'none' : '1px solid rgba(255,255,255,0.2)' }}>Grade</th>
                        {config.showRemarks && <th style={{ padding: '8px', textAlign: 'left', border: config.theme === 'minimal' ? 'none' : '1px solid rgba(255,255,255,0.2)' }}>Remarks</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {['Mathematics', 'Physics', 'Chemistry', 'English'].map((sub, i) => (
                        <tr key={sub} style={{ borderBottom: '1px solid #E2E8F0' }}>
                          <td style={{ padding: '8px', borderLeft: config.theme === 'minimal' ? 'none' : '1px solid #E2E8F0' }}>{sub}</td>
                          <td style={{ padding: '8px', textAlign: 'center', borderLeft: config.theme === 'minimal' ? 'none' : '1px solid #E2E8F0' }}>{85 + i}</td>
                          <td style={{ padding: '8px', textAlign: 'center', borderLeft: config.theme === 'minimal' ? 'none' : '1px solid #E2E8F0' }}>A</td>
                          {config.showRemarks && <td style={{ padding: '8px', borderLeft: config.theme === 'minimal' ? 'none' : '1px solid #E2E8F0', borderRight: config.theme === 'minimal' ? 'none' : '1px solid #E2E8F0' }}>Excellent</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div style={{ display: 'flex', gap: '16px', marginBottom: '40px' }}>
                    {/* Attendance */}
                    {config.showAttendance && (
                      <div style={{ flex: 1, border: '1px solid var(--color-border)', padding: '12px', fontSize: '11px' }}>
                        <h4 style={{ margin: '0 0 8px 0', color: config.primaryColor }}>Attendance</h4>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Total Days:</span> <span>120</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Present:</span> <span>115</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                          <span>Percentage:</span> <span>95.8%</span>
                        </div>
                      </div>
                    )}

                    {/* Grading Key */}
                    {config.showGradingKey && (
                      <div style={{ flex: 1, border: '1px solid var(--color-border)', padding: '12px', fontSize: '11px' }}>
                        <h4 style={{ margin: '0 0 8px 0', color: config.primaryColor }}>Grading Key</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                          <div>A+: 90-100</div>
                          <div>A: 80-89</div>
                          <div>B: 70-79</div>
                          <div>C: 60-69</div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Signatures */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '40px' }}>
                    {config.showInchargeSignature && (
                      <div style={{ textAlign: 'center', width: '120px' }}>
                        <div style={{ borderTop: '1px solid black', paddingTop: '8px', fontSize: '12px' }}>Class Incharge</div>
                      </div>
                    )}
                    {config.showPrincipalSignature && (
                      <div style={{ textAlign: 'center', width: '120px' }}>
                        <div style={{ borderTop: '1px solid black', paddingTop: '8px', fontSize: '12px' }}>Principal</div>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};

export default AdminReportCardDesigner;
