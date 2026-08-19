'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { supabase, adminSupabase } from '@/lib/supabase';
import { useFormErrors } from '@/hooks/useFormErrors';


export const StudentRegistration: React.FC = () => {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    father_name: '',
    email: '',
    cnic: '',
    dob: '',
    gender: 'Male',
    academic_class: '',
    section: '',
    roll_number: '',
    monthly_fee: '',
    transport_fee: '',
    academy_fee: '',
    registration_fee_status: 'Pending',
    advance_fee_months: 'None',
    admission_date: new Date().toISOString().split('T')[0],
    guardian_email: '',
    guardian_whatsapp: ''
  });
  
  const [profileImage, _setProfileImage] = useState<File | null>(null);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });
  const { fieldErrors, setGlobalError, clearErrors } = useFormErrors();
  const [isLoading, setIsLoading] = useState(false);
  
  const [settingsClasses, setSettingsClasses] = useState<string[]>([]);
  const [settingsSections, setSettingsSections] = useState<string[]>([]);
  const [classFees, setClassFees] = useState<Record<string, { monthly: string, transport: string, academy: string, absent_fine: string }>>({});
  
  const [useTransport, setUseTransport] = useState(false);
  const [useAcademy, setUseAcademy] = useState(false);

  const [schoolInfo, setSchoolInfo] = useState<{name: string, logo: string}>({ name: 'School Name', logo: '' });
  
  // ── Sibling Detection ────────────────────────────────────────────────
  const [siblings, setSiblings] = useState<any[]>([]);
  const [siblingsLoading, setSiblingsLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const dbClient = adminSupabase || supabase;
        const res = await dbClient.from('settings').select('*').eq('key', 'app_settings').single();
        if (res.data?.value) {
          const data = res.data.value;
          setSchoolInfo({ name: data.institute_name || 'School Name', logo: data.institute_logo || '' });
          setSettingsClasses(data.classes || []);
          setSettingsSections(data.sections || []);
          setClassFees(data.class_fees || {});
          
          if (data.classes?.length > 0 && !formData.academic_class) {
            const firstClass = data.classes[0];
            setFormData((prev: any) => ({ 
              ...prev, 
              academic_class: firstClass,
              monthly_fee: data.class_fees?.[firstClass]?.monthly || ''
            }));
          }
          if (data.sections?.length > 0 && !formData.section) {
            setFormData((prev: any) => ({ ...prev, section: data.sections[0] }));
          }
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      }
    })();
  }, []);

  // ── Detect siblings when guardian_email or guardian_whatsapp changes ──
  useEffect(() => {
    const email = formData.guardian_email?.trim() || '';
    const wa = formData.guardian_whatsapp?.trim() || '';
    if (!email && !wa) {
      setSiblings([]);
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        setSiblingsLoading(true);
        const dbClient = adminSupabase || supabase;
        let query = dbClient.from('students').select('id, name, academic_class, section, father_name').neq('status', 'Ex-Students');
        
        if (wa) {
          query = query.eq('guardian_whatsapp', wa);
        } else if (email) {
          query = query.eq('email', email); // Assuming we also want to check email if whatsapp is empty
        } else {
          setSiblings([]);
          setSiblingsLoading(false);
          return;
        }

        const { data } = await query;
        if (!siblingsDismissed) {
          setSiblings(data || []);
        }
      } catch {
        setSiblings([]);
      } finally {
        setSiblingsLoading(false);
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [formData.guardian_email, formData.guardian_whatsapp]);

  const [siblingsDismissed, setSiblingsDismissed] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (fieldErrors[e.target.name]) {
      clearErrors();
    }
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      if (name === 'academic_class') {
        const fees = classFees[value];
        if (fees) {
          updated.monthly_fee = fees.monthly || '';
          if (useTransport) updated.transport_fee = fees.transport || '';
          if (useAcademy) updated.academy_fee = fees.academy || '';
        } else {
          updated.monthly_fee = '';
          if (useTransport) updated.transport_fee = '';
          if (useAcademy) updated.academy_fee = '';
        }
      }
      return updated;
    });
  };

  const handleTransportToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setUseTransport(checked);
    if (checked && formData.academic_class && classFees[formData.academic_class]) {
      setFormData(prev => ({ ...prev, transport_fee: classFees[formData.academic_class].transport || '' }));
    } else if (!checked) {
      setFormData(prev => ({ ...prev, transport_fee: '' }));
    }
  };

  const handleAcademyToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setUseAcademy(checked);
    if (checked && formData.academic_class && classFees[formData.academic_class]) {
      setFormData(prev => ({ ...prev, academy_fee: classFees[formData.academic_class].academy || '' }));
    } else if (!checked) {
      setFormData(prev => ({ ...prev, academy_fee: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setStatus({ type: null, message: '' });
    clearErrors();

    try {
      let profileImageUrl = null;
      if (profileImage) {
        const fileExt = profileImage.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('student-documents')
          .upload(fileName, profileImage);
        
        if (uploadError) {
          console.error('Image upload failed, creating student without image', uploadError);
        } else {
          const { data: urlData } = supabase.storage.from('student-documents').getPublicUrl(fileName);
          profileImageUrl = urlData.publicUrl;
        }
      }

      const insertPayload: any = {
        name: formData.name,
        father_name: formData.father_name,
        cnic: formData.cnic,
        dob: formData.dob,
        gender: formData.gender,
        academic_class: formData.academic_class,
        section: formData.section,
        roll_number: formData.roll_number || null,
        monthly_fee: parseFloat(formData.monthly_fee) || 0,
        transport_fee: parseFloat(formData.transport_fee) || 0,
        academy_fee: parseFloat(formData.academy_fee) || 0,
        registration_fee_status: formData.registration_fee_status,
        advance_fee_months: formData.advance_fee_months,
        admission_date: formData.admission_date,
        guardian_whatsapp: formData.guardian_whatsapp,
        guardian_password: formData.guardian_whatsapp,
        profile_image_url: profileImageUrl,
        status: 'Active',
      };

      // ── Create Supabase Auth user via server API route ──────────────
      if (formData.guardian_email && formData.guardian_whatsapp) {
        try {
          const res = await fetch('/api/admin/create-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: formData.guardian_email,
              password: formData.guardian_whatsapp,
              role: 'Guardian',
              name: formData.father_name,
            }),
          });
          const result = await res.json();
          if (result?.user?.id) {
            insertPayload.guardian_id = result.user.id;
          }
          // If graceful: true or alreadyExists: true, we continue without blocking
        } catch {
          // Network error — continue without auth user
        }
      }

      const dbClient = adminSupabase || supabase;
      const { error } = await dbClient.from('students').insert(insertPayload);
      if (error) throw error;
      
      setStatus({ type: 'success', message: 'Student registered successfully!' });
      setTimeout(() => router.push('/students'), 1500);
    } catch (err: any) {
      const mapped = setGlobalError(err.message || 'An error occurred');
      if (mapped['general']) {
        setStatus({ type: 'error', message: mapped['general'] });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="registration-page" style={{ position: 'relative', overflow: 'hidden', padding: '20px', backgroundColor: '#f8fafc' }}>
      
      <div style={{ marginBottom: '32px', paddingTop: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        {schoolInfo.logo && (
          <img 
            src={schoolInfo.logo} 
            alt="School Logo" 
            style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
          />
        )}
        <div>
          <h1 className="section-heading" style={{ margin: 0, fontSize: '28px', color: '#0f172a', fontWeight: '800', letterSpacing: '-0.02em' }}>{schoolInfo.name}</h1>
          <h2 style={{ fontSize: '16px', color: '#64748b', margin: '4px 0 0', fontWeight: '500' }}>Student Registration Form</h2>
        </div>
      </div>

      <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)', border: '1px solid #e2e8f0' }}>
      {status.type && (
        <div className={`toast ${status.type}`}>
          {status.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card form-card">
        <h2 className="card-heading">Personal Information</h2>
        <div className="form-grid">
          <Input label="Full Name" name="name" value={formData.name} onChange={handleChange} required error={fieldErrors['name']} />
          <Input label="Father's Name" name="father_name" value={formData.father_name} onChange={handleChange} required error={fieldErrors['father_name']} />
          <Input label="B-Form / CNIC" name="cnic" value={formData.cnic} onChange={handleChange} placeholder="00000-0000000-0" required error={fieldErrors['cnic']} />
          <Input label="Date of Birth" name="dob" type="date" value={formData.dob} onChange={handleChange} required error={fieldErrors['dob']} />
          
          <div className="input-group">
            <label className="input-label">Gender <span className="required-indicator">*</span></label>
            <select name="gender" className="input-field" value={formData.gender} onChange={handleChange} required>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <Input label="Guardian's Email (Required for login)" name="guardian_email" type="email" value={formData.guardian_email} onChange={handleChange} required placeholder="guardian@example.com" error={fieldErrors['guardian_email']} />
          <Input label="Guardian's WhatsApp" name="guardian_whatsapp" type="text" value={formData.guardian_whatsapp} onChange={handleChange} required placeholder="03xx-xxxxxxx" error={fieldErrors['guardian_whatsapp']} />
        </div>

        {/* ── Sibling Detection Panel ───────────────────────────── */}
        {!siblingsDismissed && (siblings.length > 0 || siblingsLoading) && (
          <div style={{
            marginTop: '16px',
            padding: '14px 16px',
            borderRadius: '10px',
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.35)',
            position: 'relative'
          }}>
            <button 
              type="button"
              onClick={() => {
                setSiblingsDismissed(true);
                setSiblings([]);
              }}
              style={{
                position: 'absolute', top: '10px', right: '10px',
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--color-text-muted)'
              }}
            >
              ✕
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <span style={{ fontSize: '16px' }}>👨‍👩‍👧</span>
              <strong style={{ fontSize: '14px', color: 'var(--color-warning)' }}>
                {siblingsLoading ? 'Checking for siblings...' : `Possible Sibling(s) Detected (${siblings.length})`}
              </strong>
            </div>
            {!siblingsLoading && siblings.map(s => (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '8px 10px', borderRadius: '8px',
                background: 'var(--color-surface)', marginBottom: '6px',
                fontSize: '13px', color: 'var(--color-text-main)'
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'var(--color-primary)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: '13px', flexShrink: 0,
                }}>
                  {s.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>{s.name}</div>
                  <div style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>
                    {s.academic_class} — {s.section} &bull; Father: {s.father_name}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <hr className="divider" />
        
        <h2 className="card-heading">Academic Information</h2>
        <div className="form-grid">
          <Input label="Admission Date" name="admission_date" type="date" value={formData.admission_date} onChange={handleChange} required error={fieldErrors['admission_date']} />
          <Input label="Roll Number (Optional)" name="roll_number" value={formData.roll_number} onChange={handleChange} placeholder="e.g. 104" error={fieldErrors['roll_number']} />
          
          <SearchableSelect 
            label="Class / Grade"
            name="academic_class"
            value={formData.academic_class}
            options={settingsClasses}
            onChange={handleSelectChange}
            required
            placeholder="Select a class"
            emptyMessage="No classes registered. Please add them in Settings."
          />

          <SearchableSelect 
            label="Section"
            name="section"
            value={formData.section}
            options={settingsSections}
            onChange={handleSelectChange}
            required
            placeholder="Select a section"
            emptyMessage="No sections registered. Please add them in Settings."
          />
        </div>

        <hr className="divider" />
        
        <h2 className="card-heading">Fee Details</h2>
        <div className="form-grid">
          <Input label="School Tuition Fee (PKR)" name="monthly_fee" type="number" value={formData.monthly_fee} onChange={handleChange} required />
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'flex-end' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer', background: 'var(--color-background)', padding: '10px', borderRadius: '6px' }}>
              <input type="checkbox" checked={useTransport} onChange={handleTransportToggle} />
              Enable Transport
            </label>
            <Input label="Transport Fee (PKR)" name="transport_fee" type="number" value={formData.transport_fee} onChange={handleChange} disabled={!useTransport} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'flex-end' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer', background: 'var(--color-background)', padding: '10px', borderRadius: '6px' }}>
              <input type="checkbox" checked={useAcademy} onChange={handleAcademyToggle} />
              Enable Academy
            </label>
            <Input label="Academy Fee (PKR)" name="academy_fee" type="number" value={formData.academy_fee} onChange={handleChange} disabled={!useAcademy} />
          </div>
          
          <div className="input-group">
            <label className="input-label">Registration Fee Status</label>
            <select name="registration_fee_status" className="input-field" value={formData.registration_fee_status} onChange={handleChange}>
              <option value="Pending">Pending</option>
              <option value="Paid">Paid</option>
            </select>
          </div>

          <div className="input-group">
            <label className="input-label">Advance Fee</label>
            <select name="advance_fee_months" className="input-field" value={formData.advance_fee_months} onChange={handleChange}>
              <option value="None">None</option>
              <option value="1 Month">1 Month</option>
              <option value="2 Months">2 Months</option>
              <option value="3 Months">3 Months</option>
              <option value="6 Months">6 Months</option>
              <option value="1 Year">1 Year</option>
            </select>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={() => router.push('/students')}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Register Student'}
          </button>
        </div>
      </form>
      </div>
    </div>
  );
};

export default StudentRegistration;
