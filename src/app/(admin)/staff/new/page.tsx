'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { supabase, adminSupabase } from '@/lib/supabase';
import { useFormErrors } from '@/hooks/useFormErrors';
import '@/app/registration/Registration.css';

export const StaffRegistration: React.FC = () => {
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
    username: '',
    password: '',
    role: 'Teacher',
    allowed_assessments: [] as string[]
  });

  useEffect(() => {
    // Optional: Fetch settings if needed in the future
  }, []);

  const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });
  const { fieldErrors, setGlobalError, clearErrors } = useFormErrors();
  const [isLoading, setIsLoading] = useState(false);


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (fieldErrors[e.target.name]) {
      clearErrors();
    }
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setStatus({ type: null, message: '' });
    clearErrors();

    try {
      // 1. Insert into staff table
      const staffPayload = {
        name: formData.name,
        cnic: formData.cnic,
        phone: formData.whatsapp_number,
        qualification: formData.qualification,
        experience: formData.experience,
        salary_type: formData.salary_type,
        salary: Number(formData.salary),
        status: 'Active',
        join_date: formData.joining_date,
        role: formData.role,
        ...(formData.role === 'Teacher' && {
          username: formData.email,
          password: formData.whatsapp_number
        })
      };

      if (formData.role === 'Teacher' && formData.email) {
        try {
          const res = await fetch('/api/admin/create-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: formData.email,
              password: formData.whatsapp_number,
              role: 'Teacher',
              name: formData.name,
            }),
          });
          const result = await res.json();
          if (result.error && (result.error.includes('already registered') || result.error.includes('already exists'))) {
            setStatus({ type: 'error', message: 'Email is already registered for another user' });
            return;
          } else if (result.error && !result.alreadyExists && !result.graceful) {
            throw new Error(result.error);
          }
        } catch (err: any) {
          if (err.message !== 'Failed to fetch') {
            throw err;
          }
        }
      }

      const dbClient = adminSupabase || supabase;
      const { error: insertError } = await dbClient.from('staff').insert([staffPayload]);

      if (insertError) {
        if (insertError.message.includes('unique constraint') && insertError.message.includes('username')) {
          setStatus({ type: 'error', message: 'Username already exists' });
          return;
        }
        throw insertError;
      }
      
      setStatus({ type: 'success', message: 'Staff member registered successfully!' });
      setTimeout(() => router.push('/staff/records'), 1500);
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
    <div className="registration-page">
      <div style={{ marginBottom: '16px' }}>
        <h1 className="section-heading" style={{ marginBottom: 0 }}>Register New Staff</h1>
      </div>

      {status.type && (
        <div className={`toast ${status.type}`}>
          {status.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card form-card">
        <h2 className="card-heading">Personal Details</h2>
        <div className="form-grid">
          <Input label="Full Name" name="name" value={formData.name} onChange={handleChange} required error={fieldErrors['name']} />
          <Input label="CNIC" name="cnic" value={formData.cnic} onChange={handleChange} placeholder="00000-0000000-0" required error={fieldErrors['cnic']} />

        </div>

        <hr className="divider" />
        
        <h2 className="card-heading">Professional Details</h2>
        <div className="form-grid">
          <Input label="Joining Date" name="joining_date" type="date" value={formData.joining_date} onChange={handleChange} required />
          <Input label="Highest Qualification" name="qualification" value={formData.qualification} onChange={handleChange} placeholder="e.g. MS Computer Science" required />
          <Input label="Experience (Years)" name="experience" value={formData.experience} onChange={handleChange} placeholder="e.g. 5" required />
          
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
            {isLoading ? 'Saving...' : 'Register Staff'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default StaffRegistration;
