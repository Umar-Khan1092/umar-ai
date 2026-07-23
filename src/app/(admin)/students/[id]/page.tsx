'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { ArrowLeft, User, BookOpen, CreditCard, Calendar, FileText, FileBadge, MessageSquare, Users, Hash, MapPin, CheckCircle } from 'lucide-react';
import { ChevronLeft, Print, Download, Edit, Settings, AlertTriangle, MessageCircle, Send, Clock, Activity, FileSpreadsheet, Phone, Mail, Receipt, Info, Trash2, Check, ExternalLink } from 'lucide-react';
import { formatDate } from '@/utils/formatDate';
import { supabase, adminSupabase } from '@/lib/supabase';
import { triggerWebPush } from '@/lib/push';
import '@/app/(admin)/students/[id]/StudentProfile.css';

export const StudentProfile: React.FC = () => {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [student, setStudent] = useState<any>(null);
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const dbClient = adminSupabase || supabase;
        const { data: st } = await dbClient.from('students').select('*').eq('id', id).single();
        if (st) {
          setStudent(st);
          
          const { data: fees } = await dbClient.from('fee_vouchers').select('*').eq('student_id', id);
          if (fees) {
            setVouchers(fees);
            const totalBilled = fees.reduce((sum: number, v: any) => sum + (v.total_amount || 0), 0);
            const totalPaid = fees.reduce((sum: number, v: any) => sum + (v.amount_paid || 0), 0);
            setBalance(totalBilled - totalPaid);
          }

          const { data: resData } = await dbClient.from('results').select('*').eq('student_id', id);
          if (resData) setResults(resData);

          const { data: attData } = await dbClient.from('attendance')
            .select('*')
            .eq('class_name', st.academic_class)
            .eq('section', st.section);
          
          if (attData) {
            const studentAtt: any[] = [];
            for (const a of attData) {
              const rec = (a.records || []).find((r: any) => r.student_id === id);
              if (rec) {
                studentAtt.push({
                  date: a.date,
                  status: rec.status,
                  fine: rec.fine || 0
                });
              }
            }
            setAttendance(studentAtt);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    
    fetchData();
    
    const fetchNotifications = async () => {
      const { data } = await supabase.from('notifications').select('*').eq('student_id', id).order('timestamp', { ascending: true });
      if (data) setNotifications(data);
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, [id]);

  // Modal states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentVoucher, setPaymentVoucher] = useState<any>(null);
  const [paymentBreakdown, setPaymentBreakdown] = useState<Record<string, string>>({});
  const [isPaying, setIsPaying] = useState(false);

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyVoucher, setHistoryVoucher] = useState<any>(null);

  const [newRemark, setNewRemark] = useState('');
  const [isSubmittingRemark, setIsSubmittingRemark] = useState(false);

  if (!student) {
    return <div className="page-content">Loading profile...</div>;
  }



  const handlePay = (voucher: any) => {
    const acc = voucher.amount_paid_breakdown || {};
    setPaymentVoucher(voucher);
    setPaymentBreakdown({
      tuition: Math.max(0, (voucher.tuition_fee || 0) - (acc.tuition || 0)).toString(),
      transport: Math.max(0, (voucher.transport_fee || 0) - (acc.transport || 0)).toString(),
      academy: Math.max(0, (voucher.academy_fee || 0) - (acc.academy || 0)).toString(),
      custom: Math.max(0, (voucher.custom_fee_amount || 0) - (acc.custom || 0)).toString(),
      arrears: Math.max(0, (voucher.arrears || 0) - (acc.arrears || 0)).toString()
    });
    setShowPaymentModal(true);
  };

  const handleBreakdownChange = (field: string, value: string) => {
    let sanitized = value.replace(/^0+(?=\d)/, '');
    if (sanitized === '00' || sanitized === '000') sanitized = '0';
    setPaymentBreakdown(prev => ({ ...prev, [field]: sanitized }));
  };

  const submitPayment = async () => {
    if (!paymentVoucher) return;
    
    let amount = 0;
    const breakdownToSubmit: Record<string, number> = {};
    for (const [k, v] of Object.entries(paymentBreakdown)) {
      const val = parseFloat(v) || 0;
      if (val > 0) {
        amount += val;
        breakdownToSubmit[k] = val;
      }
    }
    
    if (amount <= 0) {
      alert("Amount must be greater than 0.");
      return;
    }
    
    setIsPaying(true);
    try {
      const prevAcc = paymentVoucher.amount_paid_breakdown || {};
      const newAcc = { ...prevAcc };
      for (const k in breakdownToSubmit) {
        newAcc[k] = (newAcc[k] || 0) + breakdownToSubmit[k];
      }

      const totalPaidSoFar = (paymentVoucher.amount_paid || 0) + amount;
      const newStatus = totalPaidSoFar >= paymentVoucher.total_amount ? 'Paid' : 'Partial';

      const { error } = await supabase.from('fee_vouchers').update({
        amount_paid: totalPaidSoFar,
        amount_paid_breakdown: newAcc,
        payment_date: new Date().toISOString().split('T')[0],
        status: newStatus
      }).eq('id', paymentVoucher.id);
      
      if (error) throw error;
      
      setShowPaymentModal(false);
      setPaymentVoucher(null);
      
      const { data } = await supabase.from('fee_vouchers').select('*').eq('student_id', id);
      if (data) {
        setVouchers(data);
        const totalBilled = data.reduce((sum: number, v: any) => sum + (v.total_amount || 0), 0);
        const totalPaid = data.reduce((sum: number, v: any) => sum + (v.amount_paid || 0), 0);
        setBalance(totalBilled - totalPaid);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsPaying(false);
    }
  };

  const handleRemainingsClick = (voucher: any) => {
    setHistoryVoucher(voucher);
    setShowHistoryModal(true);
  };

  const handleAdvancePayment = async () => {
    const amountStr = window.prompt(`Enter advance payment amount for ${student.name}:`);
    if (amountStr === null) return;
    
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      alert("Invalid amount.");
      return;
    }
    
    try {
      const { error } = await supabase.from('fee_vouchers').insert({
        student_id: id,
        student_name: student.name,
        student_class: student.academic_class,
        student_section: student.section,
        billing_month: new Date().toLocaleString('default', { month: 'short', year: 'numeric' }),
        issue_date: new Date().toISOString().split('T')[0],
        total_amount: 0,
        amount_paid: amount,
        payment_date: new Date().toISOString().split('T')[0],
        status: 'Paid',
        custom_fee_title: 'Advance Payment',
        custom_fee_amount: 0
      });
      if (error) throw error;
      
      const { data } = await supabase.from('fee_vouchers').select('*').eq('student_id', id);
      if (data) {
        setVouchers(data);
        const totalBilled = data.reduce((sum: number, v: any) => sum + (v.total_amount || 0), 0);
        const totalPaid = data.reduce((sum: number, v: any) => sum + (v.amount_paid || 0), 0);
        setBalance(totalBilled - totalPaid);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAddRemark = async () => {
    if (!newRemark.trim()) return;
    setIsSubmittingRemark(true);
    try {
      const { error } = await supabase.from('notifications').insert({
        recipient_id: user?.role === 'Guardian' ? 'Admin' : student.guardian_whatsapp || student.guardian_phone || 'Parent',
        recipient_role: user?.role === 'Guardian' ? 'Admin' : 'Guardian',
        sender_id: user?.id || '',
        sender_role: user?.role || 'Admin',
        display_sender_name: user?.name || 'Admin',
        message: newRemark.trim(),
        context: 'General',
        student_id: id,
        student_name: student.name,
        student_class: student.academic_class,
        student_section: student.section,
        timestamp: new Date().toISOString()
      });
      if (error) throw error;
      
      const isToAdmin = user?.role === 'Guardian';
      triggerWebPush({
        roles: isToAdmin ? ['Admin'] : ['Guardian'],
        userIds: isToAdmin ? undefined : [student.id], // Wait, for guardian the user_id is the student_id!
        title: `Remark from ${user?.name || 'Admin'}`,
        message: newRemark.trim(),
        url: isToAdmin ? '/admin-notices' : '/guardian/guardianhome',
        category: 'Chat'
      });
      
      const { data } = await supabase.from('notifications').select('*').eq('student_id', id).order('timestamp', { ascending: true });
      if (data) setNotifications(data);
      setNewRemark('');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmittingRemark(false);
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'academic', label: 'Academic', icon: BookOpen },
    { id: 'fee_history', label: 'Fee History', icon: CreditCard },
    { id: 'attendance', label: 'Attendance', icon: Calendar },
    { id: 'results', label: 'Results', icon: FileBadge },
    { id: 'remarks', label: 'Remarks', icon: MessageSquare },
  ];

  return (
    <div className="profile-page">
      {user?.role !== 'Guardian' && (
        <button className="btn-secondary back-btn" onClick={() => router.push('/students/records')}>
          <ArrowLeft size={16} style={{ marginRight: '8px' }} />
          Back to Records
        </button>
      )}

      {user?.role === 'Guardian' && (
        <button className="btn-secondary back-btn" onClick={() => router.push('/guardian')}>
          <ArrowLeft size={16} style={{ marginRight: '8px' }} />
          Back to Dashboard
        </button>
      )}

      <div className="profile-header card">
        <div className="profile-avatar-large">
          {student.profile_image_url ? (
            <img src={`${student.profile_image_url}`} alt={student.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            student.name.charAt(0)
          )}
        </div>
        <div className="profile-info-header">
          <h1 className="profile-name">{student.name}</h1>
          <div className="profile-badges">
            <span className="badge">Roll No: {student.roll_number || 'N/A'}</span>
            <span className="badge">Class {student.academic_class} - {student.section}</span>
            <span className={`badge ${student.status === 'Active' ? 'active' : 'inactive'}`}>
              {student.status || 'Active'}
            </span>
            {balance > 0 && <span className="badge warning">Remainings: ₨ {balance.toLocaleString()}</span>}
            {balance < 0 && <span className="badge success">Advance Credit: ₨ {Math.abs(balance).toLocaleString()}</span>}
            {balance === 0 && <span className="badge success">Balance Cleared</span>}
          </div>
        </div>
      </div>

      <div className="card profile-tabs-card" style={{ padding: 0 }}>
        <nav className="profile-nav-horizontal">
          {tabs.map(tab => (
            <button 
              key={tab.id}
              className={`profile-tab-horizontal ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon size={16} />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="profile-content card">
        {activeTab === 'overview' && (
          <div className="tab-pane">
            <h2 className="section-heading">Overview</h2>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label"><Users size={14} /> Father's Name</span>
                <span className="info-value">{student.father_name}</span>
              </div>
              <div className="info-item">
                <span className="info-label"><Hash size={14} /> CNIC / B-Form</span>
                <span className="info-value">{student.cnic}</span>
              </div>
              <div className="info-item">
                <span className="info-label"><Calendar size={14} /> Date of Birth</span>
                <span className="info-value">{formatDate(student.dob)}</span>
              </div>
              <div className="info-item">
                <span className="info-label"><User size={14} /> Gender</span>
                <span className="info-value">{student.gender}</span>
              </div>
              <div className="info-item">
                <span className="info-label"><MessageSquare size={14} /> Guardian WhatsApp</span>
                <span className="info-value">{student.guardian_whatsapp || 'Not Provided'}</span>
              </div>
              <div className="info-item">
                <span className="info-label"><FileText size={14} /> Guardian Password</span>
                <span className="info-value">{student.guardian_password || 'Not Provided'}</span>
              </div>
              <div className="info-item">
                <span className="info-label"><Calendar size={14} /> Admission Date</span>
                <span className="info-value">{formatDate(student.admission_date)}</span>
              </div>
              
              <div className="info-item" style={{ gridColumn: '1 / -1' }}>
                <h3 style={{ marginBottom: '16px', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px' }}>Fee Summary</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <div className="card" style={{ padding: '16px', borderTop: '4px solid #DC2626' }}>
                    <p style={{ margin: '0 0 4px', color: 'var(--color-text-secondary)', fontSize: '13px', fontWeight: 500 }}>Total Remainings</p>
                    <h3 style={{ margin: 0, fontSize: '24px', color: '#DC2626' }}>₨ {balance > 0 ? balance.toLocaleString() : 0}</h3>
                  </div>
                  <div className="card" style={{ padding: '16px', borderTop: '4px solid var(--color-success)' }}>
                    <p style={{ margin: '0 0 4px', color: 'var(--color-text-secondary)', fontSize: '13px', fontWeight: 500 }}>Advance Credit</p>
                    <h3 style={{ margin: 0, fontSize: '24px', color: 'var(--color-success)' }}>₨ {balance < 0 ? Math.abs(balance).toLocaleString() : 0}</h3>
                  </div>
                  <div className="card" style={{ padding: '16px', borderTop: '4px solid var(--color-warning)' }}>
                    <p style={{ margin: '0 0 4px', color: 'var(--color-text-secondary)', fontSize: '13px', fontWeight: 500 }}>Pending Months</p>
                    <h3 style={{ margin: 0, fontSize: '24px', color: 'var(--color-warning)' }}>{vouchers.filter(v => v.status !== 'Paid').length}</h3>
                  </div>
                </div>
              </div>
              
              {/* Fee Configuration removed */}
              {student.tuition_required !== false && (
                <div className="info-item">
                  <span className="info-label"><CreditCard size={14} /> Tuition Fee</span>
                  <span className="info-value">₨ {student.monthly_fee || 'Not set'}</span>
                </div>
              )}
              {!!student.transport_required && (
                <div className="info-item">
                  <span className="info-label"><MapPin size={14} /> Transport Fee</span>
                  <span className="info-value">₨ {student.transport_fee || 'Not set'}</span>
                </div>
              )}
              {!!student.academy_required && (
                <div className="info-item">
                  <span className="info-label"><BookOpen size={14} /> Academy Fee</span>
                  <span className="info-value">₨ {student.academy_fee || 'Not set'}</span>
                </div>
              )}
            </div>
          </div>
        )}
        {activeTab === 'documents' && (
          <div className="tab-pane">
            <h2 className="section-heading">Documents</h2>
            {student.document_urls && student.document_urls.length > 0 ? (
              <div className="documents-list">
                {student.document_urls.map((docUrl: string, idx: number) => {
                  const fileName = docUrl.split('_').slice(1).join('_') || `Document_${idx + 1}`;
                  return (
                    <a key={idx} href={`${docUrl}`} target="_blank" rel="noreferrer" className="document-card">
                      <FileText size={24} className="doc-icon" />
                      <span className="doc-name">{fileName}</span>
                    </a>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state-placeholder">
                <p className="body-text">No documents uploaded for this student.</p>
              </div>
            )}
          </div>
        )}
        {activeTab === 'fee_history' && (
          <div className="tab-pane">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 className="section-heading" style={{ margin: 0 }}>Fee History</h2>
              <button className="btn-primary" onClick={handleAdvancePayment}>
                + Receive Advance Payment
              </button>
            </div>
            {vouchers.length > 0 ? (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Issue Date</th>
                      <th>Fees Breakdown</th>
                      <th>Remainings</th>
                      <th>Total Due</th>
                      <th>Paid Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vouchers.map(v => (
                      <tr key={v.id}>
                        <td>{v.billing_month}</td>
                        <td>{v.issue_date}</td>
                        <td>
                          <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                            Tuition: ₨{v.tuition_fee || 0}
                            {(v.transport_fee || 0) > 0 && ` | Trans: ₨${v.transport_fee}`}
                            {(v.academy_fee || 0) > 0 && ` | Acad: ₨${v.academy_fee}`}
                          </div>
                        </td>
                        <td 
                          style={{ color: '#DC2626', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                          onClick={() => handleRemainingsClick(v)}
                        >
                          ₨ {v.total_amount - (v.amount_paid || 0)}
                        </td>
                        <td style={{ fontWeight: 600 }}>₨ {v.total_amount}</td>
                        <td>{v.payment_date || '-'}</td>
                        <td>
                          {v.status !== 'Paid' ? (
                            <button 
                              className="btn-primary" 
                              style={{ padding: '4px 8px', fontSize: '11px' }} 
                              onClick={() => handlePay(v)}
                            >
                              {v.status === 'Partial' ? 'Pay Remainings' : 'Pay Now'}
                            </button>
                          ) : (
                            <div style={{ fontSize: '12px', color: 'var(--color-success)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                                <CheckCircle size={14} /> Paid
                              </span>
                              {v.payment_date && (
                                <span style={{ color: 'var(--color-text-muted)' }}>
                                  on {formatDate(v.payment_date)}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state-placeholder">
                <p className="body-text">No fee vouchers generated yet.</p>
              </div>
            )}
          </div>
        )}
        {activeTab === 'results' && (
          <div className="tab-pane">
            <h2 className="section-heading">Academic Results</h2>
            {results.length > 0 ? (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Exam Term</th>
                      <th>Subject</th>
                      <th>Total Marks</th>
                      <th>Obtained Marks</th>
                      <th>Percentage</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((res: any, idx: number) => {
                      const pct = res.total_marks > 0 ? ((res.obtained_marks / res.total_marks) * 100) : 0;
                      const isPass = pct >= 40;
                      return (
                        <tr key={idx}>
                          <td>{res.exam_term}</td>
                          <td style={{ fontWeight: 500 }}>{res.subject}</td>
                          <td>{res.total_marks}</td>
                          <td style={{ fontWeight: 600 }}>{res.obtained_marks}</td>
                          <td>{pct.toFixed(1)}%</td>
                          <td>
                            <span className={`badge ${isPass ? 'badge-success' : 'badge-error'}`}>
                              {isPass ? 'Pass' : 'Fail'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state-placeholder">
                <p className="body-text">No published exam results available for this student.</p>
              </div>
            )}
          </div>
        )}
        {activeTab === 'attendance' && (
          <div className="tab-pane">
            <h2 className="section-heading">Attendance Record</h2>
            
            {/* Attendance Summary */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
              <div className="card" style={{ flex: 1, textAlign: 'center', padding: '16px', borderTop: '4px solid var(--color-success)' }}>
                <h3 style={{ margin: 0, fontSize: '24px', color: 'var(--color-success)' }}>{attendance.filter(a => a.status === 'Present').length}</h3>
                <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)', fontSize: '13px', fontWeight: 500 }}>Total Present</p>
              </div>
              <div className="card" style={{ flex: 1, textAlign: 'center', padding: '16px', borderTop: '4px solid var(--color-error)' }}>
                <h3 style={{ margin: 0, fontSize: '24px', color: 'var(--color-error)' }}>{attendance.filter(a => a.status === 'Absent').length}</h3>
                <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)', fontSize: '13px', fontWeight: 500 }}>Total Absent</p>
              </div>
              <div className="card" style={{ flex: 1, textAlign: 'center', padding: '16px', borderTop: '4px solid var(--color-warning)' }}>
                <h3 style={{ margin: 0, fontSize: '24px', color: 'var(--color-warning)' }}>{attendance.filter(a => a.status === 'Leave').length}</h3>
                <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)', fontSize: '13px', fontWeight: 500 }}>Total Leave</p>
              </div>
              <div className="card" style={{ flex: 1, textAlign: 'center', padding: '16px', borderTop: '4px solid var(--color-primary)' }}>
                <h3 style={{ margin: 0, fontSize: '24px', color: 'var(--color-primary)' }}>
                  {attendance.length > 0 ? Math.round((attendance.filter(a => a.status === 'Present').length / attendance.length) * 100) : 0}%
                </h3>
                <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)', fontSize: '13px', fontWeight: 500 }}>Attendance Rate</p>
              </div>
            </div>

            {/* Attendance Details Table */}
            {attendance.length > 0 ? (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Fine Incurred</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.map((record, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 500 }}>{formatDate(record.date)}</td>
                        <td>
                          <span className={`badge ${record.status === 'Present' ? 'badge-success' : record.status === 'Absent' ? 'badge-error' : 'badge-warning'}`}>
                            {record.status}
                          </span>
                        </td>
                        <td style={{ color: record.fine > 0 ? 'var(--color-error)' : 'var(--color-text-muted)' }}>
                          {record.fine > 0 ? `₨ ${record.fine}` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state-placeholder">
                <p className="body-text">No attendance records found for this student.</p>
              </div>
            )}
          </div>
        )}
        {activeTab === 'remarks' && (
          <div className="tab-section" style={{ display: 'flex', flexDirection: 'column', height: '600px', background: '#E5DDD5', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
            <div style={{ padding: '16px', background: '#075E54', color: 'white', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#128C7E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>{student.name} - Communications</h3>
                <p style={{ margin: 0, fontSize: '12px', opacity: 0.8 }}>Parent & Teacher Connect</p>
              </div>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {notifications.length > 0 ? (
                notifications.map((n: any, idx: number) => {
                  const isMine = n.sender_role === user?.role;
                  return (
                    <div key={n.id || idx} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                      <div style={{
                        maxWidth: '75%',
                        background: isMine ? '#DCF8C6' : 'white',
                        padding: '10px 14px',
                        borderRadius: '12px',
                        borderTopRightRadius: isMine ? '0' : '12px',
                        borderTopLeftRadius: isMine ? '12px' : '0',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                        position: 'relative'
                      }}>
                        {!isMine && (
                          <div style={{ fontSize: '11px', fontWeight: 600, color: n.sender_role === 'Admin' ? '#35897E' : '#E53935', marginBottom: '4px' }}>
                            {n.display_sender_name}
                          </div>
                        )}
                        <p style={{ margin: '0 0 4px 0', fontSize: '14px', lineHeight: '1.4', color: '#303030' }}>{n.message}</p>
                        <div style={{ fontSize: '10px', color: '#999', textAlign: 'right', marginTop: '2px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '4px' }}>
                          {new Date(n.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          {isMine && <CheckCircle size={12} color="#4FC3F7" />}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ textAlign: 'center', margin: 'auto', background: 'rgba(255,255,255,0.7)', padding: '12px 24px', borderRadius: '16px', fontSize: '14px', color: '#555' }}>
                  No messages yet. Start the conversation!
                </div>
              )}
            </div>
            
            <div style={{ padding: '12px 16px', background: '#F0F0F0', display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
              <textarea
                className="input-field"
                style={{ flex: 1, margin: 0, maxHeight: '100px', minHeight: '44px', borderRadius: '22px', padding: '12px 16px', border: 'none', resize: 'none' }}
                placeholder="Type a message..."
                value={newRemark}
                onChange={e => setNewRemark(e.target.value)}
              />
              <button
                style={{ 
                  width: '44px', height: '44px', borderRadius: '50%', background: '#128C7E', color: 'white', 
                  border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                  opacity: (!newRemark.trim() || isSubmittingRemark) ? 0.6 : 1
                }}
                onClick={handleAddRemark}
                disabled={!newRemark.trim() || isSubmittingRemark}
              >
                <MessageSquare size={20} />
              </button>
            </div>
          </div>
        )}
        {activeTab !== 'overview' && activeTab !== 'documents' && activeTab !== 'fee_history' && activeTab !== 'results' && activeTab !== 'attendance' && activeTab !== 'remarks' && (
          <div className="empty-state-placeholder">
            <p className="body-text">{tabs.find(t => t.id === activeTab)?.label} information will be displayed here.</p>
          </div>
        )}
      </div>
      
      {/* Payment Modal */}
      {showPaymentModal && paymentVoucher && (() => {
        const acc = paymentVoucher.amount_paid_breakdown || {};
        const maxPayable: Record<string, number> = {
          tuition: Math.max(0, (paymentVoucher.tuition_fee || 0) - (acc.tuition || 0)),
          transport: Math.max(0, (paymentVoucher.transport_fee || 0) - (acc.transport || 0)),
          academy: Math.max(0, (paymentVoucher.academy_fee || 0) - (acc.academy || 0)),
          custom: Math.max(0, (paymentVoucher.custom_fee_amount || 0) - (acc.custom || 0)),
          arrears: Math.max(0, (paymentVoucher.arrears || 0) - (acc.arrears || 0))
        };
        
        let hasError = false;
        let sumPayable = 0;
        let sumReceived = 0;
        let sumRemaining = 0;
        
        const activeFields = Object.keys(maxPayable).filter(k => maxPayable[k] > 0);
        for (const k of activeFields) {
          sumPayable += maxPayable[k];
          const received = parseFloat(paymentBreakdown[k]) || 0;
          sumReceived += received;
          sumRemaining += (maxPayable[k] - received);
          if (received > maxPayable[k]) {
            hasError = true;
          }
        }
        
        return (
          <div className="modal-overlay" onClick={() => setShowPaymentModal(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', borderRadius: '16px' }}>
              <h2 style={{ marginTop: 0, borderBottom: '1px solid var(--color-border)', paddingBottom: '12px' }}>
                Receive Payment
              </h2>
              <div style={{ marginBottom: '16px' }}>
                <p style={{ margin: '0 0 8px', fontWeight: 500 }}>Student: <span style={{ fontWeight: 600 }}>{paymentVoucher.student_name}</span></p>
                
                <div style={{ background: 'var(--color-bg-secondary)', padding: '16px', borderRadius: '12px', fontSize: '14px' }}>
                  <table className="data-table" style={{ margin: 0, background: 'transparent', boxShadow: 'none' }}>
                    <thead>
                      <tr>
                        <th style={{ background: 'transparent', padding: '8px 4px', borderBottom: '1px solid var(--color-border)' }}>Fee Breakdown</th>
                        <th style={{ background: 'transparent', padding: '8px 4px', textAlign: 'right', borderBottom: '1px solid var(--color-border)' }}>Payable</th>
                        <th style={{ background: 'transparent', padding: '8px 4px', textAlign: 'right', borderBottom: '1px solid var(--color-border)' }}>Received Payment</th>
                        <th style={{ background: 'transparent', padding: '8px 4px', textAlign: 'right', borderBottom: '1px solid var(--color-border)' }}>Remaining</th>
                      </tr>
                    </thead>
                    <tbody>
                      {maxPayable.tuition > 0 && (() => {
                        const rec = parseFloat(paymentBreakdown.tuition) || 0;
                        return (
                          <tr>
                            <td style={{ padding: '8px 4px', borderBottom: '1px solid var(--color-border)' }}>Tuition</td>
                            <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 500, borderBottom: '1px solid var(--color-border)' }}>₨ {maxPayable.tuition}</td>
                            <td style={{ padding: '8px 4px', textAlign: 'right', borderBottom: '1px solid var(--color-border)' }}>
                              <input type="number" min="0" step="any" className="input-field" style={{ width: '100px', padding: '6px', textAlign: 'right', borderColor: rec > maxPayable.tuition ? 'red' : undefined }} value={paymentBreakdown.tuition || ''} onChange={e => handleBreakdownChange('tuition', e.target.value)} />
                            </td>
                            <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 500, color: (maxPayable.tuition - rec) > 0 ? '#DC2626' : 'inherit', borderBottom: '1px solid var(--color-border)' }}>₨ {maxPayable.tuition - rec}</td>
                          </tr>
                        );
                      })()}
                      {maxPayable.transport > 0 && (() => {
                        const rec = parseFloat(paymentBreakdown.transport) || 0;
                        return (
                          <tr>
                            <td style={{ padding: '8px 4px', borderBottom: '1px solid var(--color-border)' }}>Transport</td>
                            <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 500, borderBottom: '1px solid var(--color-border)' }}>₨ {maxPayable.transport}</td>
                            <td style={{ padding: '8px 4px', textAlign: 'right', borderBottom: '1px solid var(--color-border)' }}>
                              <input type="number" min="0" step="any" className="input-field" style={{ width: '100px', padding: '6px', textAlign: 'right', borderColor: rec > maxPayable.transport ? 'red' : undefined }} value={paymentBreakdown.transport || ''} onChange={e => handleBreakdownChange('transport', e.target.value)} />
                            </td>
                            <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 500, color: (maxPayable.transport - rec) > 0 ? '#DC2626' : 'inherit', borderBottom: '1px solid var(--color-border)' }}>₨ {maxPayable.transport - rec}</td>
                          </tr>
                        );
                      })()}
                      {maxPayable.academy > 0 && (() => {
                        const rec = parseFloat(paymentBreakdown.academy) || 0;
                        return (
                          <tr>
                            <td style={{ padding: '8px 4px', borderBottom: '1px solid var(--color-border)' }}>Academy</td>
                            <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 500, borderBottom: '1px solid var(--color-border)' }}>₨ {maxPayable.academy}</td>
                            <td style={{ padding: '8px 4px', textAlign: 'right', borderBottom: '1px solid var(--color-border)' }}>
                              <input type="number" min="0" step="any" className="input-field" style={{ width: '100px', padding: '6px', textAlign: 'right', borderColor: rec > maxPayable.academy ? 'red' : undefined }} value={paymentBreakdown.academy || ''} onChange={e => handleBreakdownChange('academy', e.target.value)} />
                            </td>
                            <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 500, color: (maxPayable.academy - rec) > 0 ? '#DC2626' : 'inherit', borderBottom: '1px solid var(--color-border)' }}>₨ {maxPayable.academy - rec}</td>
                          </tr>
                        );
                      })()}
                      {maxPayable.custom > 0 && (() => {
                        const rec = parseFloat(paymentBreakdown.custom) || 0;
                        return (
                          <tr>
                            <td style={{ padding: '8px 4px', borderBottom: '1px solid var(--color-border)' }}>{paymentVoucher.custom_fee_title || 'Custom'}</td>
                            <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 500, borderBottom: '1px solid var(--color-border)' }}>₨ {maxPayable.custom}</td>
                            <td style={{ padding: '8px 4px', textAlign: 'right', borderBottom: '1px solid var(--color-border)' }}>
                              <input type="number" min="0" step="any" className="input-field" style={{ width: '100px', padding: '6px', textAlign: 'right', borderColor: rec > maxPayable.custom ? 'red' : undefined }} value={paymentBreakdown.custom || ''} onChange={e => handleBreakdownChange('custom', e.target.value)} />
                            </td>
                            <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 500, color: (maxPayable.custom - rec) > 0 ? '#DC2626' : 'inherit', borderBottom: '1px solid var(--color-border)' }}>₨ {maxPayable.custom - rec}</td>
                          </tr>
                        );
                      })()}
                      {maxPayable.arrears > 0 && (() => {
                        const rec = parseFloat(paymentBreakdown.arrears) || 0;
                        return (
                          <tr>
                            <td style={{ padding: '8px 4px', borderBottom: '1px solid var(--color-border)' }}>Arrears</td>
                            <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 500, borderBottom: '1px solid var(--color-border)' }}>₨ {maxPayable.arrears}</td>
                            <td style={{ padding: '8px 4px', textAlign: 'right', borderBottom: '1px solid var(--color-border)' }}>
                              <input type="number" min="0" step="any" className="input-field" style={{ width: '100px', padding: '6px', textAlign: 'right', borderColor: rec > maxPayable.arrears ? 'red' : undefined }} value={paymentBreakdown.arrears || ''} onChange={e => handleBreakdownChange('arrears', e.target.value)} />
                            </td>
                            <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 500, color: (maxPayable.arrears - rec) > 0 ? '#DC2626' : 'inherit', borderBottom: '1px solid var(--color-border)' }}>₨ {maxPayable.arrears - rec}</td>
                          </tr>
                        );
                      })()}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td style={{ padding: '8px 4px', fontWeight: 600 }}>Total</td>
                        <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 600 }}>₨ {sumPayable}</td>
                        <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 600, color: 'var(--color-success)' }}>₨ {sumReceived}</td>
                        <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 600, color: sumRemaining > 0 ? '#DC2626' : 'inherit' }}>₨ {sumRemaining}</td>
                      </tr>
                    </tfoot>
                  </table>
                  {hasError && <p style={{ color: 'red', marginTop: '12px', fontSize: '13px' }}>Error: Received Payment cannot exceed the Payable amount for any field.</p>}
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button className="btn-secondary" onClick={() => setShowPaymentModal(false)}>Cancel</button>
                <button className="btn-primary" onClick={submitPayment} disabled={!!isPaying || hasError || sumReceived <= 0}>
                  {isPaying ? 'Processing...' : 'Submit Payment'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      
      {/* History Modal */}
      {showHistoryModal && historyVoucher && (() => {
        const acc = historyVoucher.amount_paid_breakdown || {};
        const breakdownItems = [
          { name: 'Tuition', payable: historyVoucher.tuition_fee || 0, received: acc.tuition || 0, remainings: Math.max(0, (historyVoucher.tuition_fee || 0) - (acc.tuition || 0)) },
          { name: 'Transport', payable: historyVoucher.transport_fee || 0, received: acc.transport || 0, remainings: Math.max(0, (historyVoucher.transport_fee || 0) - (acc.transport || 0)) },
          { name: 'Academy', payable: historyVoucher.academy_fee || 0, received: acc.academy || 0, remainings: Math.max(0, (historyVoucher.academy_fee || 0) - (acc.academy || 0)) },
          { name: historyVoucher.custom_fee_title || 'Custom', payable: historyVoucher.custom_fee_amount || 0, received: acc.custom || 0, remainings: Math.max(0, (historyVoucher.custom_fee_amount || 0) - (acc.custom || 0)) },
          { name: 'Arrears', payable: historyVoucher.arrears || 0, received: acc.arrears || 0, remainings: Math.max(0, (historyVoucher.arrears || 0) - (acc.arrears || 0)) }
        ].filter(item => item.payable > 0);
        
        const sumPayable = breakdownItems.reduce((acc, curr) => acc + curr.payable, 0);
        const sumReceived = breakdownItems.reduce((acc, curr) => acc + curr.received, 0);
        const sumRemainings = breakdownItems.reduce((acc, curr) => acc + curr.remainings, 0);

        return (
          <div className="modal-overlay" onClick={() => setShowHistoryModal(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '650px', borderRadius: '16px', maxHeight: '90vh', overflowY: 'auto' }}>
              <h2 style={{ marginTop: 0, borderBottom: '1px solid var(--color-border)', paddingBottom: '12px' }}>
                Payment History - {historyVoucher.student_name}
              </h2>
              
              <h3 style={{ fontSize: '15px', marginBottom: '12px', marginTop: '16px' }}>Current Payment Status</h3>
              <div style={{ background: 'var(--color-bg-secondary)', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
                <table className="data-table" style={{ margin: 0, background: 'transparent', boxShadow: 'none', borderCollapse: 'collapse', width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ background: 'transparent', padding: '10px 8px', borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>Breakdown</th>
                      <th style={{ background: 'transparent', padding: '10px 8px', textAlign: 'right', borderBottom: '1px solid var(--color-border)' }}>Payable</th>
                      <th style={{ background: 'transparent', padding: '10px 8px', textAlign: 'right', borderBottom: '1px solid var(--color-border)' }}>Received</th>
                      <th style={{ background: 'transparent', padding: '10px 8px', textAlign: 'right', borderBottom: '1px solid var(--color-border)' }}>Remainings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdownItems.map((item, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '10px 8px' }}>{item.name}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right' }}>₨ {item.payable}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right', color: 'var(--color-success)', fontWeight: 500 }}>₨ {item.received}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right', color: item.remainings > 0 ? '#DC2626' : 'inherit', fontWeight: 500 }}>
                          ₨ {item.remainings}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td style={{ padding: '10px 8px', fontWeight: 600 }}>Total</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600 }}>₨ {sumPayable}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600, color: 'var(--color-success)' }}>₨ {sumReceived}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600, color: sumRemainings > 0 ? '#DC2626' : 'inherit' }}>₨ {sumRemainings}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            
              <h3 style={{ fontSize: '15px', marginBottom: '12px' }}>Transaction Log</h3>
              {historyVoucher.payment_history && historyVoucher.payment_history.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {historyVoucher.payment_history.map((tx: any, i: number) => (
                    <div key={i} style={{ border: '1px solid var(--color-border)', borderRadius: '8px', padding: '16px', background: 'var(--color-bg)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <span style={{ fontWeight: 600, fontSize: '14px' }}>{formatDate(tx.date)}</span>
                        <span style={{ color: 'var(--color-success)', fontWeight: 600, fontSize: '15px' }}>₨ {tx.amount} ({tx.method})</span>
                      </div>
                      {tx.breakdown && Object.keys(tx.breakdown).length > 0 && (
                        <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {Object.entries(tx.breakdown).map(([k, v]) => (
                            <span key={k} style={{ background: 'var(--color-bg-secondary)', padding: '4px 10px', borderRadius: '16px', border: '1px solid var(--color-border)' }}>
                              {k.charAt(0).toUpperCase() + k.slice(1)}: ₨{Number(v)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', fontStyle: 'italic', padding: '16px', background: 'var(--color-bg-secondary)', borderRadius: '8px' }}>No payments made yet.</p>
              )}
            
            <div style={{ marginTop: '24px', textAlign: 'right' }}>
              <button className="btn-secondary" onClick={() => setShowHistoryModal(false)}>Close</button>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
};

export default StudentProfile;
