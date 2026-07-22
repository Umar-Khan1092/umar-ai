'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { supabase, adminSupabase } from '@/lib/supabase';
import { useFormErrors } from '@/hooks/useFormErrors';
import '@/app/registration/Registration.css';

export const EditStaff: React.FC = () => {
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : undefined;
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    cnic: '',
    email: '',
    whatsapp_number: '',
    qualification: '',
    experience: '',
    salary_type: 'Fixed',
    salary: 0,
    absent_deduction_rate: 0,
    advance_salary: 'No',
    advance_amount: '',
    joining_date: '',
    status: 'Active',
    username: '',
    password: '',
    role: 'Teacher',
    allowed_assessments: [] as string[]
  });

  useEffect(() => {
    // Optional: fetch settings if needed
  }, []);



  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });
  const { fieldErrors, setGlobalError, clearErrors } = useFormErrors();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    if (!id) return;
    const loadStaff = async () => {
      try {
        const dbClient = adminSupabase || supabase;
        const { data: staff, error } = await dbClient
          .from('staff')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;

        if (staff) {
          setFormData({
            name: staff.name || '',
            cnic: staff.cnic || '',
            email: staff.username || '',
            whatsapp_number: staff.phone || '',
            qualification: staff.qualification || '',
            experience: staff.experience || '',
            salary_type: staff.salary_type || 'Fixed',
            salary: staff.salary || 0,
            absent_deduction_rate: 0,
            advance_salary: 'No',
            advance_amount: '',
            joining_date: staff.join_date || '',
            status: staff.status || 'Active',
            username: staff.username || '',
            password: staff.password || '',
            role: staff.role || 'Teacher',
            allowed_assessments: staff.allowed_assessments || []
          });
        }
      } catch (err) {
        setStatusMsg({ type: 'error', message: 'Error loading data' });
      } finally {
        setIsFetching(false);
      }
    };
    loadStaff();
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (fieldErrors[e.target.name]) {
      clearErrors();
    }
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setStatusMsg({ type: null, message: '' });
    clearErrors();

    try {
      if (!id) throw new Error('Missing ID');
      
      const staffPayload = {
        name: formData.name,
        cnic: formData.cnic,
        phone: formData.whatsapp_number,
        qualification: formData.qualification,
        experience: formData.experience,
        salary_type: formData.salary_type,
        salary: Number(formData.salary),
        status: formData.status,
        join_date: formData.joining_date,
        role: formData.role,
        ...(formData.role === 'Teacher' ? {
          username: formData.email,
          password: formData.whatsapp_number
        } : {
          username: null,
          password: null,
          allowed_assessments: null
        })
      };

      const dbClient = adminSupabase || supabase;
      
      // Update Supabase Auth User if Teacher
      if (adminSupabase && formData.role === 'Teacher') {
        // Fetch the old user by old email (which is staffPayload.username initially or just what we loaded)
        const { data: existingStaff } = await dbClient.from('staff').select('username').eq('id', id).single();
        const oldEmail = existingStaff?.username;
        
        if (oldEmail) {
          const { data: usersData } = await adminSupabase.auth.admin.listUsers();
          const authUser = usersData?.users.find(u => u.email === oldEmail);
          if (authUser) {
            const { error: authUpdateError } = await adminSupabase.auth.admin.updateUserById(authUser.id, {
              email: formData.email,
              password: formData.whatsapp_number,
              user_metadata: { role: 'Teacher', name: formData.name, username: formData.email }
            });
            if (authUpdateError) {
              throw authUpdateError;
            }
          }
        }
      }

      const { error: updateError } = await dbClient.from('staff').update(staffPayload).eq('id', id);

      if (updateError) {
        if (updateError.message.includes('unique constraint') && updateError.message.includes('username')) {
          setStatusMsg({ type: 'error', message: 'Email already exists' });
          return;
        }
        throw updateError;
      }
      
      setStatusMsg({ type: 'success', message: 'Staff member updated successfully!' });
      setTimeout(() => router.push('/staff/records'), 1500);
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
    return <div className="registration-page"><div className="card form-card"><p>Loading...</p></div></div>;
  }

  return (
    <div className="registration-page">
      <div style={{ marginBottom: '16px' }}>
        <h1 className="section-heading" style={{ marginBottom: 0 }}>Edit Staff Record</h1>
      </div>

      {statusMsg.type && (
        <div className={`toast ${statusMsg.type}`}>
          {statusMsg.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card form-card">
        <h2 className="card-heading">Personal Details</h2>
        <div className="form-grid">
          <Input label="Full Name" name="name" value={formData.name} onChange={handleChange} required error={fieldErrors['name']} />
          <Input label="CNIC" name="cnic" value={formData.cnic} onChange={handleChange} required error={fieldErrors['cnic']} />

        </div>

        <hr className="divider" />
        
        <h2 className="card-heading">Professional Details</h2>
        <div className="form-grid">
          <Input label="Joining Date" name="joining_date" type="date" value={formData.joining_date} onChange={handleChange} required />
          <Input label="Highest Qualification" name="qualification" value={formData.qualification} onChange={handleChange} required />
          <Input label="Experience (Years)" name="experience" value={formData.experience} onChange={handleChange} required />
          
          <div className="input-group">
            <label className="input-label">Salary Type <span className="required-indicator">*</span></label>
            <select name="salary_type" className="input-field" value={formData.salary_type} onChange={handleChange} required>
              <option value="Fixed">Fixed</option>
              <option value="Per Lecture">Per Lecture</option>
            </select>
          </div>
          <Input label="Salary Amount (PKR)" name="salary" type="number" value={formData.salary} onChange={handleChange} required />
          {formData.salary_type === 'Fixed' && (
            <Input label="Absent Deduction (per day)" name="absent_deduction_rate" type="number" value={formData.absent_deduction_rate} onChange={handleChange} required />
          )}
          
          <div className="input-group">
            <label className="input-label">Advance Salary Provided?</label>
            <select name="advance_salary" className="input-field" value={formData.advance_salary} onChange={handleChange}>
              <option value="No">No</option>
              <option value="Yes">Yes</option>
            </select>
          </div>
          {formData.advance_salary === 'Yes' && (
            <Input label="Advance Amount (PKR)" name="advance_amount" type="number" value={formData.advance_amount} onChange={handleChange} required />
          )}
        </div>

        <hr className="divider" />
        
        <h2 className="card-heading">Role & Access</h2>
        <div className="form-grid">
          <div className="input-group">
            <label className="input-label">Role <span className="required-indicator">*</span></label>
            <select name="role" className="input-field" value={formData.role} onChange={handleChange} required>
              <option value="Teacher">Teacher</option>
              <option value="Peon">Peon</option>
              <option value="Driver">Driver</option>
            </select>
          </div>
          {formData.role === 'Teacher' && (
            <>
              <Input label="Email Address" name="email" type="email" value={formData.email} onChange={handleChange} required error={fieldErrors['email']} />
              <Input label="WhatsApp Number" name="whatsapp_number" type="text" value={formData.whatsapp_number} onChange={handleChange} required placeholder="e.g. 03001234567" error={fieldErrors['whatsapp_number']} />
            </>
          )}
        </div>

        <hr className="divider" />
        
        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={() => router.push('/staff/records')}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditStaff;
