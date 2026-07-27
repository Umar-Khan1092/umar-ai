'use client';

import React, { useState, useEffect } from 'react';
import { useGuardian } from '@/context/GuardianContext';
import { Banknote, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export const GuardianFees: React.FC = () => {
  const { activeStudent } = useGuardian();
  const [feeHistory, setFeeHistory] = useState<any[]>([]);
  const [balance, setBalance] = useState<number>(0);

  useEffect(() => {
    if (activeStudent) {
          Promise.resolve(supabase.from('fee_vouchers').select('*').eq('student_id', activeStudent.id))
        .then(res => {
          let data = (res.data || []).map((v: any) => {
            const monthNumStr = String(["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].indexOf(v.month) + 1).padStart(2, '0');
            return {
              ...v,
              fee_month: `${v.month} ${v.year}`,
              fee_sort_key: `${v.year}-${monthNumStr}`,
              issue_date: v.created_at ? v.created_at.split('T')[0] : ''
            };
          });

          // Sort so Pending is first, then Paid
          data.sort((a: any, b: any) => {
            const aPaid = (a.paid_amount || 0) >= (a.total_amount || 0);
            const bPaid = (b.paid_amount || 0) >= (b.total_amount || 0);
            if (aPaid === bPaid) {
              return b.fee_sort_key.localeCompare(a.fee_sort_key);
            }
            return aPaid ? 1 : -1;
          });

          setFeeHistory(data);
          const totalBilled = data.reduce((sum: number, v: any) => sum + (v.total_amount || 0), 0);
          const totalPaid = data.reduce((sum: number, v: any) => sum + (v.paid_amount || 0), 0);
          setBalance(totalBilled - totalPaid);
        })
        .catch((err: any) => console.error(err));
    }
  }, [activeStudent]);

  if (!activeStudent) return <div>Please select a student first.</div>;

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <h1 style={{ fontSize: '24px', color: '#1E293B', margin: '0 0 24px 0' }}>Fee Details</h1>

      {/* Outstanding Summary Card */}
      <div className="guardian-action-card" style={{ background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)', color: 'white', border: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Banknote size={24} color="white" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 500, color: 'rgba(255,255,255,0.9)' }}>Outstanding Balance</h2>
            <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>For {activeStudent.name}</p>
          </div>
        </div>
        <div>
          <span style={{ fontSize: '36px', fontWeight: 700 }}>Rs. {balance.toLocaleString()}</span>
        </div>
        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.9)' }}>
            {balance <= 0 ? 'No pending dues.' : 'Please clear dues promptly.'}
          </span>
          <CheckSquareIcon />
        </div>
      </div>

      {/* Payment History */}
      <div style={{ marginTop: '32px' }}>
        <h2 style={{ fontSize: '18px', margin: '0 0 16px 0', color: '#1E293B' }}>Payment History</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {feeHistory.length > 0 ? feeHistory.map((fee: any) => {
            const isFullyPaid = (fee.paid_amount || 0) >= (fee.total_amount || 0);
            const remaining = (fee.total_amount || 0) - (fee.paid_amount || 0);
            
            return (
              <div key={fee.id} style={{ background: '#ffffff', borderRadius: '12px', padding: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                {/* Header Section */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: isFullyPaid ? '#F0FDF4' : '#FEF2F2', color: isFullyPaid ? '#16A34A' : '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Clock size={18} />
                    </div>
                    <div>
                      <span style={{ fontSize: '13px', color: '#64748B', display: 'block' }}>Month</span>
                      <span style={{ fontSize: '16px', color: '#1E293B', fontWeight: 700 }}>{fee.fee_month}</span>
                    </div>
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 600, padding: '4px 10px', borderRadius: '100px', background: isFullyPaid ? '#DCFCE7' : '#FEE2E2', color: isFullyPaid ? '#166534' : '#991B1B' }}>
                    {isFullyPaid ? 'Paid' : 'Pending'}
                  </span>
                </div>
                
                {/* Information Rows */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '14px' }}>
                  
                  {/* Issue Date */}
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>Issue Date:</span>
                    <span style={{ color: '#1E293B', fontWeight: 500 }}>{fee.issue_date || '-'}</span>
                  </div>

                  {/* Due Date / Paid Date */}
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>Paid Date:</span>
                    <span style={{ color: '#1E293B', fontWeight: 500 }}>{fee.paid_date || '-'}</span>
                  </div>

                  {/* Divider */}
                  <div style={{ height: '1px', background: '#f1f5f9', margin: '4px 0' }}></div>

                  {/* Fees Breakdown */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ color: '#64748B', paddingTop: '2px' }}>Breakdown:</span>
                    <div style={{ textAlign: 'right', color: '#1E293B', fontWeight: 500, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {fee.tuition_fee > 0 && <span>Tuition: Rs {fee.tuition_fee}</span>}
                      {fee.transport_fee > 0 && <span>Transport: Rs {fee.transport_fee}</span>}
                      {fee.academy_fee > 0 && <span>Academy: Rs {fee.academy_fee}</span>}
                      {fee.other_fee > 0 && <span>Other: Rs {fee.other_fee}</span>}
                      {(!fee.tuition_fee && !fee.transport_fee && !fee.academy_fee && !fee.other_fee) && <span>-</span>}
                    </div>
                  </div>

                  {/* Divider */}
                  <div style={{ height: '1px', background: '#f1f5f9', margin: '4px 0' }}></div>

                  {/* Total Amount */}
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>Total Due:</span>
                    <span style={{ color: '#1E293B', fontWeight: 600 }}>Rs {fee.total_amount}</span>
                  </div>

                  {/* Remainings */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#64748B' }}>Remaining:</span>
                    <span style={{ color: remaining > 0 ? '#DC2626' : '#16A34A', fontWeight: 700, fontSize: '16px' }}>Rs {remaining}</span>
                  </div>

                </div>
                
                {/* Pay Action */}
                {remaining > 0 && (
                  <button style={{ width: '100%', padding: '12px', background: '#2563EB', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, marginTop: '16px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                    Pay Now
                  </button>
                )}
              </div>
            );
          }) : (
            <div className="guardian-action-card" style={{ padding: '24px', textAlign: 'center' }}>
              <p style={{ margin: 0, color: '#64748B' }}>No fee records found.</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

const CheckSquareIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 11 12 14 22 4"></polyline>
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
  </svg>
);

export default GuardianFees;
