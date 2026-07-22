'use client';

import React, { useState, useEffect } from 'react';
import { Filter, Calendar, FileText, CheckCircle, Clock, AlertCircle, X } from 'lucide-react';
import { supabase, adminSupabase } from '@/lib/supabase';
import '@/app/(admin)/fees/FeeManagement.css'; // Reuse table/card styles

export const StaffReports: React.FC = () => {
  const [slips, setSlips] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  
  // Default to current month/year "YYYY-MM"
  const getCurrentMonth = () => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${mm}`;
  };

  const [roleFilter, setRoleFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState(getCurrentMonth());
  
  const [activeTab, setActiveTab] = useState<'pending' | 'paid'>('pending');

  const [confirmSlip, setConfirmSlip] = useState<any>(null);
  const [viewSlip, setViewSlip] = useState<any>(null);

  const fetchData = async () => {
    try {
      const dbClient = adminSupabase || supabase;
      const [payrollRes, staffRes] = await Promise.all([
        dbClient.from('payroll').select('*'),
        dbClient.from('staff').select('*')
      ]);
      if (payrollRes.data) setSlips(payrollRes.data);
      if (staffRes.data) setStaffList(staffRes.data);
    } catch (err) {
      console.error("Error fetching payroll data:", err);
    }
  };

  useEffect(() => {
    fetchData();

    // Real-time subscription for payroll updates
    const channel = supabase
      .channel('schema-db-changes-reports')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payroll' },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const formatMonthName = (monthStr: string) => {
    if (/^\d{4}-\d{2}$/.test(monthStr)) {
      const [year, month] = monthStr.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1);
      return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    return monthStr;
  };

  const handlePayConfirm = async () => {
    if (!confirmSlip) return;
    const slipId = confirmSlip.id;
    try {
      const dbClient = adminSupabase || supabase;
      const paymentDate = new Date().toISOString().split('T')[0];
      const { error } = await dbClient
        .from('payroll')
        .update({ status: 'Paid' })
        .eq('id', slipId);

      if (error) throw error;
      
      setSlips(prev => prev.map(s => s.id === slipId ? { ...s, status: 'Paid', payment_date: paymentDate } : s));
    } catch (err: any) {
      console.error(err);
      alert('Error updating payment status: ' + (err.message || 'Unknown error'));
    } finally {
      setConfirmSlip(null);
    }
  };

  // Combine staff roles into slips if not already present
  const enrichedSlips = slips.map(slip => {
    const staff = staffList.find(s => s.id === slip.staff_id);
    return {
      ...slip,
      staff_name: staff ? staff.name : 'Unknown',
      role: staff ? staff.role : 'Teacher',
      base_salary: slip.base_salary || 0,
      advance_deduction: slip.deductions || 0,
      absent_deduction: 0,
      net_payable: slip.net_salary || 0
    };
  });

  // Apply filters
  let filteredSlips = enrichedSlips;
  
  if (roleFilter) {
    filteredSlips = filteredSlips.filter(s => s.role === roleFilter);
  }
  
  if (monthFilter) {
    filteredSlips = filteredSlips.filter(s => s.month === monthFilter);
  }

  // KPIs
  let totalExpected = 0;
  let totalPaid = 0;
  let totalPending = 0;

  filteredSlips.forEach(s => {
    const amount = parseFloat(s.net_payable) || 0;
    totalExpected += amount;
    if (s.status === 'Paid') {
      totalPaid += amount;
    } else {
      totalPending += amount;
    }
  });

  // Payroll Generated Date
  let generatedDateStr = 'No Payroll Generated';
  const slipsForMonth = enrichedSlips.filter(s => s.month === monthFilter);
  if (slipsForMonth.length > 0) {
    const firstSlip = slipsForMonth[0];
    const dateToUse = firstSlip.created_at || firstSlip.generated_at;
    if (dateToUse) {
      const d = new Date(dateToUse);
      generatedDateStr = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }
  }

  // Table Data
  const pendingSlips = filteredSlips.filter(s => s.status !== 'Paid');
  const paidSlips = filteredSlips.filter(s => s.status === 'Paid');

  const displaySlips = activeTab === 'pending' ? pendingSlips : paidSlips;

  return (
    <div className="fee-management-page page-content">
      <div className="records-controls" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="header-left">
          <h1 className="section-heading" style={{ marginBottom: 0 }}>Staff Payroll Reports</h1>
          <p className="subtitle">Analyze salary disbursement, pending payments, and historical data.</p>
        </div>
      </div>

      <div className="records-controls" style={{ marginBottom: '24px', background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid var(--color-border)', flexWrap: 'wrap' }}>
        <div className="filters" style={{ width: '100%', gap: '16px', flexWrap: 'wrap', justifyContent: 'flex-start' }}>
          
          <div className="filter-group">
            <Filter size={16} className="filter-icon" style={{ marginRight: '8px', color: '#64748b' }} />
            <select 
              value={roleFilter} 
              onChange={(e) => setRoleFilter(e.target.value)}
              className="filter-select"
            >
              <option value="">All Roles</option>
              <option value="Teacher">Teacher</option>
              <option value="Admin">Admin</option>
              <option value="Principal">Principal</option>
              <option value="Accountant">Accountant</option>
              <option value="Clerk">Clerk</option>
              <option value="Peon">Peon</option>
              <option value="Guard">Guard</option>
              <option value="Sweeper">Sweeper</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="filter-group">
            <Calendar size={16} className="filter-icon" style={{ marginRight: '8px', color: '#64748b' }} />
            <input 
              type="month"
              value={monthFilter} 
              onChange={(e) => setMonthFilter(e.target.value)}
              className="filter-select"
              style={{ border: 'none', background: 'transparent', outline: 'none' }}
            />
          </div>
          
        </div>
      </div>

      {/* KPIs */}
      <div className="reports-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        <div className="kpi-card" style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ color: 'var(--color-text-secondary)', fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>Expected Salaries</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a' }}>Rs {totalExpected.toLocaleString()}</div>
        </div>
        
        <div className="kpi-card" style={{ background: '#ecfdf5', padding: '20px', borderRadius: '12px', border: '1px solid #a7f3d0' }}>
          <div style={{ color: '#047857', fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>Paid Salaries</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#059669' }}>Rs {totalPaid.toLocaleString()}</div>
        </div>
        
        <div className="kpi-card" style={{ background: '#fef2f2', padding: '20px', borderRadius: '12px', border: '1px solid #fecaca' }}>
          <div style={{ color: '#b91c1c', fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>Pending Salaries</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#dc2626' }}>Rs {totalPending.toLocaleString()}</div>
        </div>

        <div className="kpi-card" style={{ background: '#f3e8ff', padding: '20px', borderRadius: '12px', border: '1px solid #e9d5ff' }}>
          <div style={{ color: '#7e22ce', fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>Payroll Generated Date</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#6b21a8' }}>{generatedDateStr}</div>
          </div>
        </div>
      </div>

      {/* Tabs for Data Grid */}
      <div className="profile-tabs-container card profile-tabs-card" style={{ marginBottom: '16px' }}>
        <nav className="profile-nav-horizontal" style={{ borderBottom: 'none', padding: '0 16px' }}>
          <button 
            className={`profile-tab-horizontal ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveTab('pending')}
            style={{ color: activeTab === 'pending' ? '#dc2626' : undefined, borderBottomColor: activeTab === 'pending' ? '#dc2626' : undefined }}
          >
            Pending Records ({pendingSlips.length})
          </button>
          <button 
            className={`profile-tab-horizontal ${activeTab === 'paid' ? 'active' : ''}`}
            onClick={() => setActiveTab('paid')}
            style={{ color: activeTab === 'paid' ? '#059669' : undefined, borderBottomColor: activeTab === 'paid' ? '#059669' : undefined }}
          >
            Paid Records ({paidSlips.length})
          </button>
        </nav>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Month</th>
              <th>Staff Name</th>
              <th>Role</th>
              <th>Base Salary</th>
              <th>Deductions</th>
              <th>Net Payable</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {displaySlips.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-muted)' }}>
                  No records found for the selected filters.
                </td>
              </tr>
            ) : (
              displaySlips.map((slip, idx) => (
                <tr key={slip.id || idx}>
                  <td><span className="fw-medium">{slip.month}</span></td>
                  <td><span className="fw-medium">{slip.staff_name}</span></td>
                  <td>
                    <span className={`status-badge ${slip.role === 'Admin' ? 'active' : 'inactive'}`} style={{ background: slip.role === 'Teacher' ? '#e0f2fe' : slip.role === 'Admin' ? '#fce7f3' : '#f1f5f9', color: slip.role === 'Teacher' ? '#0369a1' : slip.role === 'Admin' ? '#be185d' : '#475569' }}>
                      {slip.role || 'Teacher'}
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px' }}>Rs {slip.base_salary}</td>
                  <td style={{ padding: '8px 12px' }}>
                    <div style={{ fontSize: '12px' }}>
                      {slip.advance_deduction > 0 ? <div style={{ color: '#DC2626' }}>Adv: - Rs {slip.advance_deduction}</div> : null}
                      {slip.absent_deduction > 0 ? <div style={{ color: '#DC2626' }}>Abs: - Rs {slip.absent_deduction}</div> : null}
                      {slip.advance_deduction === 0 && slip.absent_deduction === 0 ? '-' : null}
                    </div>
                  </td>
                  <td style={{ fontWeight: 600, padding: '8px 12px' }}>Rs {slip.net_payable}</td>
                  <td>
                    <span className={`status-badge ${slip.status === 'Paid' ? 'success' : 'warning'}`}>
                      {slip.status === 'Paid' ? <CheckCircle size={12} /> : <Clock size={12} />}
                      {slip.status}
                    </span>
                  </td>
                  <td>
                    {slip.status === 'Pending' ? (
                      <button className="btn-primary" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => setConfirmSlip(slip)}>
                        Pay Now
                      </button>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <span style={{ color: 'var(--color-success)', fontSize: '12px', fontWeight: 'bold' }}>
                          Disbursed {slip.payment_date ? `on ${new Date(slip.payment_date).toLocaleString()}` : ''}
                        </span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', flex: 1, justifyContent: 'center' }} onClick={() => setViewSlip(slip)}>
                            <FileText size={14} /> View
                          </button>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Confirmation Modal */}
      {confirmSlip && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2>Confirm Payment</h2>
              <button className="icon-btn" onClick={() => setConfirmSlip(null)}><X size={20} /></button>
            </div>
            <div style={{ padding: '24px 0', textAlign: 'center' }}>
              <AlertCircle size={48} style={{ color: '#F59E0B', margin: '0 auto 16px' }} />
              <p style={{ fontSize: '16px', color: 'var(--color-text)', marginBottom: '8px' }}>
                Are you sure you want to mark the salary for <strong>{confirmSlip.staff_name}</strong> as Paid?
              </p>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#059669', margin: '16px 0' }}>
                Rs {confirmSlip.net_payable}
              </div>
              <p style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>
                This action will update their status and notify them on the portal.
              </p>
            </div>
            <div className="modal-footer" style={{ borderTop: 'none', paddingTop: 0, justifyContent: 'center', gap: '16px' }}>
              <button className="btn-secondary" onClick={() => setConfirmSlip(null)}>Cancel</button>
              <button className="btn-primary" onClick={handlePayConfirm}>Yes, Pay & Notify</button>
            </div>
          </div>
        </div>
      )}



      {/* HTML Receipt Modal */}
      {viewSlip && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px', width: '100%' }}>
            <div className="modal-header">
              <h2>Salary Receipt</h2>
              <button className="icon-btn" onClick={() => setViewSlip(null)}><X size={20} /></button>
            </div>
            <div id="receipt-print-area" style={{ padding: '32px 24px', background: 'white', position: 'relative', overflow: 'hidden' }}>
              {/* Watermark */}
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(-45deg)', fontSize: '120px', fontWeight: 900, color: 'rgba(5, 150, 105, 0.05)', pointerEvents: 'none', zIndex: 0, letterSpacing: '10px' }}>
                PAID
              </div>
              
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                  <h1 style={{ color: 'var(--color-primary)', margin: '0 0 8px 0', fontSize: '24px' }}>School Management System</h1>
                  <h2 style={{ color: 'var(--color-text)', margin: 0, fontSize: '18px', fontWeight: 500 }}>Staff Salary Receipt</h2>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px', background: '#f8fafc', padding: '16px', borderRadius: '8px' }}>
                  <div>
                    <p style={{ margin: '0 0 8px 0', fontSize: '14px' }}><span style={{ color: 'var(--color-text-muted)' }}>Staff Name:</span> <strong>{viewSlip.staff_name}</strong></p>
                    <p style={{ margin: '0 0 8px 0', fontSize: '14px' }}><span style={{ color: 'var(--color-text-muted)' }}>Role:</span> <strong>{viewSlip.staff_role}</strong></p>
                    <p style={{ margin: 0, fontSize: '14px' }}><span style={{ color: 'var(--color-text-muted)' }}>Invoice ID:</span> <strong>{viewSlip.id ? String(viewSlip.id).substring(0, 8).toUpperCase() : 'UNKNOWN'}</strong></p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: '0 0 8px 0', fontSize: '14px' }}><span style={{ color: 'var(--color-text-muted)' }}>Salary Month:</span> <strong>{formatMonthName(viewSlip.month)}</strong></p>
                    <p style={{ margin: '0 0 8px 0', fontSize: '14px' }}><span style={{ color: 'var(--color-text-muted)' }}>Date:</span> <strong>{new Date().toLocaleDateString()}</strong></p>
                    <p style={{ margin: 0, fontSize: '14px' }}><span style={{ color: 'var(--color-text-muted)' }}>Paid At:</span> <strong>{viewSlip.payment_date ? new Date(viewSlip.payment_date).toLocaleString() : 'N/A'}</strong></p>
                  </div>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '32px' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-primary)', color: 'white' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left', borderTopLeftRadius: '6px' }}>Description</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', borderTopRightRadius: '6px' }}>Amount (PKR)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '12px 16px' }}>Base Salary</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>{viewSlip.base_salary.toLocaleString()}</td>
                    </tr>
                    {viewSlip.advance_deduction > 0 && (
                      <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '12px 16px' }}>Advance Deduction</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#dc2626' }}>- {viewSlip.advance_deduction.toLocaleString()}</td>
                      </tr>
                    )}
                    {viewSlip.absent_deduction > 0 && (
                      <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '12px 16px' }}>Absent Deduction ({viewSlip.absent_days || 0} days)</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#dc2626' }}>- {viewSlip.absent_deduction.toLocaleString()}</td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#ecfdf5', color: '#059669', fontWeight: 'bold' }}>
                      <td style={{ padding: '16px', fontSize: '16px' }}>Net Payable</td>
                      <td style={{ padding: '16px', textAlign: 'right', fontSize: '18px' }}>{viewSlip.net_payable.toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>

                <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '12px', marginTop: '48px', borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
                  This is a computer-generated receipt and does not require a physical signature.
                </div>
              </div>
            </div>
            <div className="modal-footer" style={{ justifyContent: 'center' }}>
              <button className="btn-secondary" onClick={() => setViewSlip(null)}>Close</button>
              <button 
                className="btn-primary" 
                onClick={() => {
                  const printContent = document.getElementById('receipt-print-area');
                  const windowPrint = window.open('', '', 'width=900,height=650');
                  if (windowPrint && printContent) {
                    windowPrint.document.write(`
                      <html>
                        <head>
                          <title>Print Receipt</title>
                          <style>
                            body { font-family: system-ui, -apple-system, sans-serif; padding: 20px; }
                            table { width: 100%; border-collapse: collapse; }
                            th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
                            th { background: #f8fafc; }
                          </style>
                        </head>
                        <body>
                          ${printContent.innerHTML}
                        </body>
                      </html>
                    `);
                    windowPrint.document.close();
                    windowPrint.focus();
                    windowPrint.print();
                    // windowPrint.close();
                  }
                }}
              >
                Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffReports;
