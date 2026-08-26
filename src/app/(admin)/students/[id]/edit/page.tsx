'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { supabase, adminSupabase } from '@/lib/supabase';
import { useFormErrors } from '@/hooks/useFormErrors';
import '@/app/registration/Registration.css';

export const EditStudent: React.FC = () => {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [formData, setFormData] = useState({
    name: '',
    father_name: '',
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
    admission_date: '',
    guardian_email: '',
    guardian_whatsapp: '',
    status: 'Active'
  });
  
  const [profileImage, _setProfileImage] = useState<File | null>(null);

  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });
  const { fieldErrors, setGlobalError, clearErrors } = useFormErrors();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  
  const [settingsClasses, setSettingsClasses] = useState<string[]>([]);
  const [classSectionsMap, setClassSectionsMap] = useState<Record<string, string[]>>({});
  const [classFees, setClassFees] = useState<Record<string, any>>({});

  useEffect(() => {
    const dbClient = adminSupabase || supabase;
    Promise.resolve(dbClient.from('settings').select('*').eq('key', 'app_settings').single())
      .then(res => {
        if (res.data && res.data.value) {
          setSettingsClasses(res.data.value.classes || []);
          setClassSectionsMap(res.data.value.class_sections || {});
          setClassFees(res.data.value.class_fees || {});
        }
      })
      .catch((err: any) => console.error('Failed to load settings:', err));

    // Fetch student data
    if (id) {
      Promise.resolve(dbClient.from('students').select('*').eq('id', id).single())
        .then(({ data: student }) => {
          if (student) {
            setFormData({
              name: student.name || '',
              father_name: student.father_name || '',
              cnic: student.cnic || '',
              dob: student.dob || '',
              gender: student.gender || 'Male',
              academic_class: student.academic_class || '',
              section: student.section || '',
              roll_number: student.roll_number || '',
              monthly_fee: student.monthly_fee || '',
              transport_fee: student.transport_fee || '',
              academy_fee: student.academy_fee || '',
              registration_fee_status: student.registration_fee_status || 'Pending',
              advance_fee_months: student.advance_fee_months || 'None',
              admission_date: student.admission_date || '',
              guardian_email: '',
              guardian_whatsapp: student.guardian_whatsapp || '',
              status: student.status || 'Active'
            });
            
            // Fetch guardian email if guardian_id exists
            if (student.guardian_id && adminSupabase) {
              adminSupabase.auth.admin.getUserById(student.guardian_id)
                .then((res: any) => {
                  if (res.data?.user?.email) {
                    setFormData(prev => ({ ...prev, guardian_email: res.data.user.email }));
                  }
                })
                .catch((e: any) => console.error('Failed to fetch guardian email', e));
            }
          }
        })
        .catch((err: any) => console.error('Failed to load student:', err))
        .finally(() => setIsFetching(false));
    }
  }, [id]);

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
        const availableSections = classSectionsMap[value] || [];
        updated.section = availableSections.length > 0 ? availableSections[0] : '';
        if (fees) {
          updated.monthly_fee = fees.monthly ? String(fees.monthly) : '';
          // Only update transport/academy if they were already using it or if it's set in the old profile
          if (Number(prev.transport_fee) > 0 && fees.transport) {
            updated.transport_fee = String(fees.transport);
          }
          if (Number(prev.academy_fee) > 0 && fees.academy) {
            updated.academy_fee = String(fees.academy);
          }
        }
      }
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setStatusMsg({ type: null, message: '' });
    clearErrors();

    try {
      let profileImageUrl = undefined;
      if (profileImage) {
        const fileExt = profileImage.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('student-documents')
          .upload(fileName, profileImage);
        
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('student-documents').getPublicUrl(fileName);
          profileImageUrl = urlData.publicUrl;
        }
      }

      const updatePayload: any = {
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
        transport_required: (parseFloat(formData.transport_fee) || 0) > 0,
        academy_required: (parseFloat(formData.academy_fee) || 0) > 0,
        registration_fee_status: formData.registration_fee_status,
        advance_fee_months: formData.advance_fee_months,
        admission_date: formData.admission_date,
        guardian_whatsapp: formData.guardian_whatsapp,
        guardian_password: formData.guardian_whatsapp,
        status: formData.status
      };
      
      if (profileImageUrl) {
        updatePayload.profile_image_url = profileImageUrl;
      }

      const dbClient = adminSupabase || supabase;
      
      // Update Supabase Auth User
      if (adminSupabase && formData.guardian_email && formData.guardian_whatsapp) {
        const { data: existingStudent } = await dbClient.from('students').select('guardian_id').eq('id', id).single();
        if (existingStudent?.guardian_id) {
          const { error: authUpdateError } = await adminSupabase.auth.admin.updateUserById(existingStudent.guardian_id, {
            email: formData.guardian_email,
            password: formData.guardian_whatsapp,
            user_metadata: { role: 'Guardian', name: formData.father_name, username: formData.guardian_email }
          });
          if (authUpdateError) {
            throw authUpdateError;
          }
        }
      }

      const { error } = await dbClient.from('students').update(updatePayload).eq('id', id);
      if (error) throw error;
      
      setStatusMsg({ type: 'success', message: 'Student updated successfully!' });
      setTimeout(() => router.push('/students/records'), 1500);
    } catch (err: any) {
      const mapped = setGlobalError(err.message || 'An error occurred');
      if (mapped['general']) {
        setStatusMsg({ type: 'error', message: mapped['general'] });
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return <div className="page-content">Loading...</div>;
  }

  return (
    <div className="registration-page">
      <div style={{ marginBottom: '16px' }}>
        <h1 className="section-heading" style={{ marginBottom: 0 }}>Edit Student</h1>
      </div>

      {statusMsg.type && (
        <div className={`toast ${statusMsg.type}`}>
          {statusMsg.message}
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

        <hr className="divider" />
        
        <h2 className="card-heading">Academic Information</h2>
        <div className="form-grid">
          <Input label="Admission Date" name="admission_date" type="date" value={formData.admission_date} onChange={handleChange} required error={fieldErrors['admission_date']} />

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
            options={classSectionsMap[formData.academic_class] || []}
            onChange={handleSelectChange}
            required
            placeholder="Select a section"
            emptyMessage="No sections registered for this class."
          />

          <Input label="Roll Number (Optional)" name="roll_number" value={formData.roll_number} onChange={handleChange} placeholder="e.g. 104" error={fieldErrors['roll_number']} />
        </div>

        <hr className="divider" />
        
        <h2 className="card-heading">Fee Details</h2>
        <div className="form-grid">
          <Input label="School Tuition Fee (PKR)" name="monthly_fee" type="number" value={formData.monthly_fee} onChange={handleChange} required />
          <Input label="Transport Fee (PKR)" name="transport_fee" type="number" value={formData.transport_fee} onChange={handleChange} placeholder="Optional" />
          <Input label="Academy Fee (PKR)" name="academy_fee" type="number" value={formData.academy_fee} onChange={handleChange} placeholder="Optional" />
          
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

        <div className="form-actions" style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>   <button type="button" className="btn-secondary" onClick={() => router.push('/students/records')}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Update Student'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditStudent;
