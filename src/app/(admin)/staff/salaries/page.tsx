'use client';

import React, { useState, useEffect } from 'react';
import { CheckCircle, Search, Clock, FileText, MessageCircle, X, AlertCircle } from 'lucide-react';
import { HighlightText } from '@/components/ui/HighlightText';
import { supabase, adminSupabase } from '@/lib/supabase';
import { WhatsAppSalaryModal } from '@/components/ui/WhatsAppSalaryModal';
 // We can reuse the Fee styles

export const StaffSalaries: React.FC = () => {
  const [slips, setSlips] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7));
  const [roleFilter, setRoleFilter] = useState('');

  // Confirmation Modal State
  const [confirmSlip, setConfirmSlip] = useState<any>(null);

  // WhatsApp Modal State
  const [showWaModal, setShowWaModal] = useState(false);
  const [waSlip, setWaSlip] = useState<any>(null);

  // View Slip State
  const [viewSlip, setViewSlip] = useState<any>(null);

  useEffect(() => {
    fetchPayroll();
    
    // Real-time subscription for payroll updates
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payroll' },
        () => {
          fetchPayroll();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchPayroll = async () => {
    try {
      const dbClient = adminSupabase || supabase;
      const [payrollRes, staffRes] = await Promise.all([
        dbClient.from('payroll').select('*'),
        dbClient.from('staff').select('*')
      ]);
      
      if (payrollRes.error) throw payrollRes.error;
      if (staffRes.error) throw staffRes.error;
      
      const enrichedSlips = (payrollRes.data || []).map(slip => {
        const staff = (staffRes.data || []).find(s => s.id === slip.staff_id);
        return {
          ...slip,
          staff_name: staff ? staff.name : 'Unknown',
          staff_role: staff ? staff.role : 'Teacher',
          base_salary: slip.base_salary || 0,
          advance_deduction: slip.deductions || 0,
          absent_deduction: 0,
          net_payable: slip.net_salary || 0
        };
      });
      
      setSlips(enrichedSlips);
    } catch (err) {
      console.error("Error fetching payroll data:", err);
    }
  };


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
      const { error } = await dbClient
        .from('payroll')
        .update({ 
          status: 'Paid'
        })
        .eq('id', confirmSlip.id);
        
      if (error) throw error;
      
      // Auto-notify teacher on portal
      await dbClient.from('notifications').insert({
        title: `💰 Salary Disbursed — ${formatMonthName(confirmSlip.month)}`,
        message: `Dear ${confirmSlip.staff_name},\n\nYour salary for ${formatMonthName(confirmSlip.month)} has been disbursed.\n\n✅ Net Paid: Rs ${confirmSlip.net_payable}\n📅 Payment Date: ${new Date().toLocaleString()}\n\nSchool Administration`,
        target_role: 'Teacher',
        recipient_id: confirmSlip.staff_id
      });

      const authData = await supabase.auth.getSession();
      fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authData.data.session?.access_token}` },
        body: JSON.stringify({ userIds: ['staff_' + confirmSlip.staff_id], title: `💰 Salary Disbursed`, message: `Your salary for ${formatMonthName(confirmSlip.month)} has been disbursed.`, url: '/teacher/profile', skipHistory: true })
      }).catch(e => console.error(e));

      setSlips(prev => prev.map(s => s.id === slipId ? { ...s, status: 'Paid', payment_date: new Date().toISOString() } : s));
    } catch (err: any) {
      console.error(err);
      alert('Error updating payment status: ' + (err.message || 'Unknown error'));
    } finally {
      setConfirmSlip(null);
    }
  };

  const handleOpenWaModal = (slip: any) => {
    setWaSlip(slip);
    setShowWaModal(true);
  };

  const handleSendWa = (_message: string) => {
    setShowWaModal(false);
    setWaSlip(null);
  };

  const filteredSlips = slips.filter(s => {
    const matchesSearch = s.staff_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter ? s.status === statusFilter : true;
    const matchesMonth = monthFilter ? s.month === monthFilter : true;
    const matchesRole = roleFilter ? s.staff_role === roleFilter : true;
    return matchesSearch && matchesStatus && matchesMonth && matchesRole;
  });

  return (
    <div className="fee-management-page fill-vertical-space">
      <div className="records-controls" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="header-left">
          <h1 className="section-heading" style={{ marginBottom: 0 }}>Staff Salaries Ledger</h1>
          <p className="subtitle">Process salary disbursements and view history.</p>
        </div>
      </div>

      <div className="receive-card">
          <div className="records-controls filters-bar" style={{ padding: '0 0 var(--space-4) 0', borderBottom: 'none', display: 'flex', flexDirection: 'row', gap: '8px', flexWrap: 'nowrap', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <div className="search-box" style={{ flex: '1 1 auto', minWidth: '0' }}>
              <Search size={16} className="search-icon" style={{ flexShrink: 0 }} />
              <div className="search-divider" style={{ flexShrink: 0 }}></div>
              <input 
                type="text" 
                placeholder="Search students, staff..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="search-input"
                style={{ minWidth: '0' }}
              />
            </div>
            
            <div className="filter-group" style={{ flex: '1 1 auto', minWidth: '0' }}>
              <input 
                type="month" 
                className="filter-select"
                value={monthFilter}
                onChange={e => setMonthFilter(e.target.value)}
                style={{ minWidth: '0' }}
              />
            </div>
            
            <div className="filter-group" style={{ flex: '1 1 auto', minWidth: '0' }}>
              <select 
                className="filter-select" 
                value={roleFilter} 
                onChange={e => setRoleFilter(e.target.value)}
                style={{ minWidth: '0', textOverflow: 'ellipsis' }}
              >
                <option value="">All Roles</option>
                <option value="Teacher">Teacher</option>
                <option value="Admin">Admin</option>
                <option value="Accountant">Accountant</option>
                <option value="Janitor">Janitor</option>
                <option value="Guard">Guard</option>
              </select>
            </div>
            
            <div className="filter-group" style={{ flex: '1 1 auto', minWidth: '0' }}>
              <select 
                className="filter-select" 
                value={statusFilter} 
                onChange={e => setStatusFilter(e.target.value)}
                style={{ minWidth: '0', textOverflow: 'ellipsis' }}
              >
                <option value="">All Statuses</option>
                <option value="Paid">Paid</option>
                <option value="Pending">Pending</option>
              </select>
            </div>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Month</th>
                  <th>Staff Info</th>
                  <th>Base Salary</th>
                  <th>Deductions</th>
                  <th>Net Payable</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSlips.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: 'var(--space-4)' }}>
                      No payroll records found.
                    </td>
                  </tr>
                ) : (
                  filteredSlips.map((slip, index) => (
                    <tr key={slip.id}>
                      <td style={{ color: 'var(--color-text-muted)', fontSize: '12px', fontWeight: 500 }}>
                        {String(index + 1).padStart(2, '0')}
                      </td>
                      <td><strong><HighlightText text={formatMonthName(slip.month)} highlight={searchQuery} /></strong></td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>
                          <HighlightText text={slip.staff_name} highlight={searchQuery} />
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{slip.staff_role}</div>
                      </td>
                      <td style={{ padding: '8px 12px' }}>Rs {slip.base_salary}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <div style={{ fontSize: '12px' }}>
                          {slip.advance_deduction > 0 ? <div style={{ color: '#DC2626' }}>Adv: - Rs {slip.advance_deduction}</div> : null}
                          {slip.absent_deduction > 0 ? <div style={{ color: '#DC2626' }}>Abs: - Rs {slip.absent_deduction}</div> : null}
                          {slip.advance_deduction === 0 && slip.absent_deduction === 0 ? '-' : null}
                        </div>
                      </td>
                      <td style={{ padding: '8px 12px' }}><strong>Rs {slip.net_payable}</strong></td>
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
                              <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', flex: 1, justifyContent: 'center' }} onClick={() => handleOpenWaModal(slip)}>
                                <MessageCircle size={14} /> Send
                              </button>
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
              <div className="modal-actions" style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
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

      {/* WhatsApp Modal */}
        {showWaModal && waSlip && (
          <WhatsAppSalaryModal 
            slip={waSlip} 
            onClose={() => setShowWaModal(false)} 
            onSend={handleSendWa} 
          />
        )}

    </div>
  );
};

export default StaffSalaries;
