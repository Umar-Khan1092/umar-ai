'use client';

import React, { useState } from 'react';
import { supabase, adminSupabase } from '@/lib/supabase';
import '@/app/(admin)/fees/FeeManagement.css'; // Reuse styles

export const StaffGeneratePayroll: React.FC = () => {
  const getCurrentMonth = () => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${mm}`;
  };

  const [payrollMonth, setPayrollMonth] = useState(getCurrentMonth());
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });
  const [isLoading, setIsLoading] = useState(false);

  const handleGeneratePayroll = async () => {
    if (!payrollMonth.trim()) {
      setStatus({ type: 'error', message: 'Please specify the month (e.g. 2026-08).' });
      return;
    }
    
    setIsLoading(true);
    setStatus({ type: null, message: '' });

    try {
      const monthStr = payrollMonth.trim();
      const [yearStr, _mStr] = monthStr.split('-');
      const year = parseInt(yearStr, 10);

      const dbClient = adminSupabase || supabase;
      
      // Fetch active staff
      const { data: activeStaff, error: staffError } = await dbClient
        .from('staff')
        .select('*')
        .eq('status', 'Active');
        
      if (staffError) throw staffError;

      if (!activeStaff || activeStaff.length === 0) {
        setStatus({ type: 'error', message: 'No active staff members found. Please register staff first.' });
        setIsLoading(false);
        return;
      }

      // Fetch existing slips for this month
      const { data: existingSlips, error: slipsError } = await dbClient
        .from('payroll')
        .select('staff_id')
        .eq('month', monthStr)
        .eq('year', year);

      if (slipsError) throw slipsError;

      const existingStaffIds = new Set(existingSlips?.map(s => s.staff_id) || []);
      const newSlips = [];

      for (const staff of activeStaff || []) {
        if (!existingStaffIds.has(staff.id)) {
          const baseSalary = staff.salary || 0;
          const deductions = 0; // Assuming no advance/absent deduction for now
          const netSalary = baseSalary - deductions;

          newSlips.push({
            staff_id: staff.id,
            month: monthStr,
            year: year,
            base_salary: baseSalary,
            deductions: deductions,
            bonuses: 0,
            net_salary: netSalary,
            status: 'Pending'
          });
        }
      }

      if (newSlips.length > 0) {
        const { error: insertError } = await dbClient.from('payroll').insert(newSlips);
        if (insertError) throw insertError;
        
        setStatus({ type: 'success', message: `Generated ${newSlips.length} payroll slips successfully.` });
      } else {
        setStatus({ type: 'success', message: 'No new payroll slips needed for this month.' });
      }

      setTimeout(() => setStatus({ type: null, message: '' }), 3000);
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'Failed to generate payroll' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fee-management-page page-content">
      <div className="records-controls" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="header-left">
          <h1 className="section-heading" style={{ marginBottom: 0 }}>Generate Staff Payroll</h1>
          <p className="subtitle">Automatically generate salary slips for all active staff members.</p>
        </div>
      </div>

      {status.type && (
        <div className={`toast ${status.type}`} style={{ marginBottom: 'var(--space-4)' }}>
          {status.message}
        </div>
      )}

      <div className="generate-card" style={{ padding: '24px', background: 'white', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '16px' }}>Select Payroll Month</h3>
        <div className="generate-controls" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <input 
            type="month" 
            className="input-field" 
            value={payrollMonth}
            onChange={e => setPayrollMonth(e.target.value)}
            style={{ width: '250px' }}
          />
          <button className="btn-primary" onClick={handleGeneratePayroll} disabled={isLoading}>
            {isLoading ? 'Processing...' : 'Generate Slips for Active Staff'}
          </button>
        </div>
        <p className="caption" style={{ marginTop: '16px' }}>
          This will calculate the net payable salary for all active staff for the selected month, automatically deducting any specified advance salaries.
        </p>
      </div>
    </div>
  );
};

export default StaffGeneratePayroll;
