'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { CheckCircle, Search, ArrowLeft, CreditCard, Calendar, Filter, ChevronDown, GraduationCap, AlertCircle, Bell, X, User } from 'lucide-react';
import { HighlightText } from '@/components/ui/HighlightText';
import { formatDate } from '@/utils/formatDate';

import { supabase, adminSupabase } from '@/lib/supabase';

const db = adminSupabase || supabase;

export const FeeManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'generate' | 'receive' | 'custom' | 'reports'>('receive');
  const [reportsView, setReportsView] = useState<'pending' | 'paid'>('pending');
  
  // Parent Portal Notification State
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [notifSending, setNotifSending] = useState(false);
  const [notifResults, setNotifResults] = useState<{sent: number; failed: number} | null>(null);
  
  // State for Generation
  const [billingMonth, setBillingMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(10); // Default 10th
    return d.toISOString().split('T')[0];
  });
  
  const monthInputRef = useRef<HTMLInputElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateMessage, setGenerateMessage] = useState('');
  
  // Generation Options
  const [genNotifyParents, setGenNotifyParents] = useState(true);
  const [showGenConfirmModal, setShowGenConfirmModal] = useState(false);
  
  // Generation Options
  const [includeTuition, setIncludeTuition] = useState(true);
  const [includeTransport, setIncludeTransport] = useState(true);
  const [includeAcademy, setIncludeAcademy] = useState(true);
  const [selectedCustomFeesToInclude, setSelectedCustomFeesToInclude] = useState<string[]>([]);

  // Settings
  const [availableCustomFees, setAvailableCustomFees] = useState<string[]>([]);

  // State for Custom
  const [customFeeTitle, setCustomFeeTitle] = useState('');
  const [customFeeAmount, setCustomFeeAmount] = useState('');
  const [customTargetClass, setCustomTargetClass] = useState('');
  const [customTargetSection, setCustomTargetSection] = useState('');
  const [customDueDate, setCustomDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [useDefaultAmount, setUseDefaultAmount] = useState(true);
  const [isApplyingCustom, setIsApplyingCustom] = useState(false);
  const [customMessage, setCustomMessage] = useState('');

  // State for Receive
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState('');
  
  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => setSearchQuery(searchInput), 300);
    return () => clearTimeout(handler);
  }, [searchInput]);
  const [sectionFilter, setSectionFilter] = useState('');
  const [isPaying, setIsPaying] = useState<boolean>(false);
  
  // Modals for Remainings and Paid history
  const [showRemainingsModal, setShowRemainingsModal] = useState(false);
  const [selectedStudentForRemainings, setSelectedStudentForRemainings] = useState<any>(null);
  
  const [showPaidModal, setShowPaidModal] = useState(false);
  const [selectedStudentForPaid, setSelectedStudentForPaid] = useState<any>(null);
  
  // State for Month Filter (defaults to current month)
  const [monthFilter, setMonthFilter] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  
  const router = useRouter();
  const params = useParams();
  const paramClass = typeof params?.className === 'string' ? params.className : undefined;
  const paramSection = typeof params?.sectionName === 'string' ? params.sectionName : undefined;

  // State for Card Navigation
  const [selectedClassGroup, setSelectedClassGroup] = useState<{className: string, section: string} | null>(
    paramClass && paramSection ? { className: paramClass, section: paramSection } : null
  );

  // Modal states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentStudent, setPaymentStudent] = useState<any>(null);
  const [paymentBreakdown, setPaymentBreakdown] = useState<Record<string, string>>({});

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyVoucher, setHistoryVoucher] = useState<any>(null);

  useEffect(() => {
    if (paramClass && paramSection) {
      setSelectedClassGroup({ className: paramClass, section: paramSection });
    } else {
      setSelectedClassGroup(null);
    }
  }, [paramClass, paramSection]);

  const handleBackToClasses = () => {
    router.push('/classes');
  };

  const fetchVouchers = useCallback(async () => {
    try {
      const { data } = await db.from('fee_vouchers').select('*, students(name, roll_number, academic_class, section)').order('created_at', { ascending: false });
      if (data) {
        const mapped = data.map((v: any) => {
          const monthNumStr = String(["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].indexOf(v.month) + 1).padStart(2, '0');
          return {
            ...v,
            student_name: v.students?.name,
            roll_number: v.students?.roll_number,
            class_name: v.students?.academic_class,
            section: v.students?.section,
            billing_month: `${v.year}-${monthNumStr}`,
            custom_fee_amount: v.other_fee || 0,
            custom_fee_title: v.other_fee > 0 ? 'Other/Custom' : null,
            arrears: 0,
            issue_date: v.created_at ? v.created_at.split('T')[0] : ''
          };
        });
        setVouchers(mapped);
      }
    } catch (err: any) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchVouchers();
    const interval = setInterval(fetchVouchers, 10000);
    return () => clearInterval(interval);
  }, [fetchVouchers]);

  useEffect(() => {
    Promise.resolve(db.from('settings').select('*').eq('key', 'app_settings').single())
      .then(res => {
        const data = res.data?.value || {};
        const feesSet = new Set<string>();
        const classFees = data.class_fees || {};
        Object.values(classFees).forEach((cf: any) => {
          if (cf.custom_fees && Array.isArray(cf.custom_fees)) {
            cf.custom_fees.forEach((fee: any) => {
              if (fee.title) feesSet.add(fee.title);
            });
          }
        });
        setAvailableCustomFees(Array.from(feesSet));
      })
      .catch((err: any) => console.error(err));
  }, []);

  const confirmGenerate = () => {
    setShowGenConfirmModal(true);
  };

  const handleGenerate = async () => {
    setShowGenConfirmModal(false);
    setIsGenerating(true);
    setGenerateMessage('');
    try {
      const [studentsRes, settingsRes] = await Promise.all([
        db.from('students').select('*').neq('status', 'Struck Off'),
        db.from('settings').select('*').eq('key', 'app_settings').single()
      ]);

      const students = studentsRes.data || [];
      const settings = settingsRes.data?.value || {};
      const classFees = settings.class_fees || {};

      const [yearStr, monthNumStr] = billingMonth.split('-');
      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const monthName = monthNames[parseInt(monthNumStr) - 1];
      const yearNum = parseInt(yearStr);

      const existing = await db.from('fee_vouchers').select('id').eq('month', monthName).eq('year', yearNum);
      if ((existing.data || []).length > 0) {
        setGenerateMessage(`Vouchers for ${billingMonth} already exist. Please choose a different month.`);
        setIsGenerating(false);
        return;
      }

      const issuedDate = new Date().toISOString().split('T')[0];
      const monthLabel = new Date(billingMonth + '-01').toLocaleString('default', { month: 'long', year: 'numeric' });

      const vouchersToInsert = students.map((s: any) => {
        const fees = classFees[s.academic_class] || {};
        const tuition = includeTuition ? (s.tuition_required !== false ? parseFloat(s.monthly_fee || fees.monthly || '0') : 0) : 0;
        const transport = includeTransport ? (s.transport_required ? parseFloat(s.transport_fee || fees.transport || '0') : 0) : 0;
        const academy = includeAcademy ? (s.academy_required ? parseFloat(s.academy_fee || fees.academy || '0') : 0) : 0;

        let customFeeAmount = 0;
        let customFeeTitle = '';
        if (selectedCustomFeesToInclude.length > 0 && fees.custom_fees) {
          fees.custom_fees.filter((cf: any) => selectedCustomFeesToInclude.includes(cf.title)).forEach((cf: any) => {
            customFeeAmount += parseFloat(cf.amount || '0');
            customFeeTitle = cf.title;
          });
        }

        const total = tuition + transport + academy + customFeeAmount;
        return {
          student_id: s.id,
          student_name: s.name,
          roll_number: s.roll_number,
          class_name: s.academic_class,
          section: s.section,
          billing_month: billingMonth,
          due_date: dueDate,
          tuition_fee: tuition,
          transport_fee: transport,
          academy_fee: academy,
          custom_fee_amount: customFeeAmount,
          custom_fee_title: customFeeTitle || null,
          arrears: 0,
          total_amount: total,
          paid_amount: 0,
          status: 'Pending',
          issue_date: issuedDate,
          _student: s  // temp reference for notifications
        };
      }).filter((v: any) => v.total_amount > 0);

      if (vouchersToInsert.length === 0) {
        setGenerateMessage('No eligible students found or all students have zero fees.');
        setIsGenerating(false);
        return;
      }

      // Strip _student before inserting and map to actual schema
      const dbVouchers = vouchersToInsert.map(({ _student, ...v }: any) => {
        const [yearStr, monthNumStr] = v.billing_month.split('-');
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const monthName = monthNames[parseInt(monthNumStr) - 1];
        return {
          student_id: v.student_id,
          month: monthName,
          year: parseInt(yearStr),
          tuition_fee: v.tuition_fee,
          transport_fee: v.transport_fee,
          academy_fee: v.academy_fee,
          other_fee: (v.custom_fee_amount || 0) + (v.arrears || 0),
          discount: 0,
          total_amount: v.total_amount,
          paid_amount: v.paid_amount,
          status: v.status
        };
      });
      const { error } = await db.from('fee_vouchers').insert(dbVouchers);
      if (error) throw error;

      // ── Send Parent Portal Notifications ──
      if (genNotifyParents) {
        const notifications = vouchersToInsert.map((v: any) => {
          const s = v._student;
          const breakdown: string[] = [];
          if (v.tuition_fee > 0) breakdown.push(`Tuition: ₨${v.tuition_fee.toLocaleString()}`);
          if (v.transport_fee > 0) breakdown.push(`Transport: ₨${v.transport_fee.toLocaleString()}`);
          if (v.academy_fee > 0) breakdown.push(`Academy: ₨${v.academy_fee.toLocaleString()}`);
          if (v.custom_fee_amount > 0) breakdown.push(`${v.custom_fee_title || 'Other'}: ₨${v.custom_fee_amount.toLocaleString()}`);

          return {
            title: `📋 Fee Invoice — ${monthLabel}`,
            message: `Dear ${s.father_name || 'Parent/Guardian'},\n\nYour child's fee invoice for ${monthLabel} has been generated.\n\n${breakdown.join('\n')}\n\n💰 Total Due: ₨${v.total_amount.toLocaleString()}\n📅 Due Date: ${dueDate}\n📆 Issue Date: ${issuedDate}\n\nPlease visit the Fee tab in your portal to view and confirm the invoice. Kindly clear the dues by the due date to avoid late charges.\n\nThank you,\nSchool Administration`,
            target_role: 'Guardian',
            student_id: s.id
          };
        });

        // Insert in batches of 50
        for (let i = 0; i < notifications.length; i += 50) {
          await db.from('notifications').insert(notifications.slice(i, i + 50));
        }
        
        // ── Trigger Native Web Push ──
        try {
          const userIds = vouchersToInsert.map((v: any) => v.student_id).filter(Boolean);
          if (userIds.length > 0) {
            const authData = await supabase.auth.getSession();
            await fetch('/api/push/send', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authData.data.session?.access_token}`
              },
              body: JSON.stringify({
                userIds: userIds.map((id: string) => 'parent_' + id),
                title: 'New Fee Invoice',
                message: 'A new fee invoice has been generated for your child. Please check the portal.',
                url: '/guardian/guardianfees',
                category: 'Finance',
                skipHistory: true
              })
            });
          }
        } catch (pushErr) {
          console.error('Failed to trigger web push:', pushErr);
        }
      }

      setGenerateMessage(`✅ Generated ${vouchersToInsert.length} vouchers for ${monthLabel}${ genNotifyParents ? ' + notifications sent to Parent Portals' : ''}.`);
      setIsGenerating(false);
      setTimeout(() => {
        setGenerateMessage('');
        setActiveTab('reports');
        setReportsView('pending');
        fetchVouchers();
      }, 2000);
    } catch (err: any) {
      setGenerateMessage(`Error: ${err.message}`);
      setIsGenerating(false);
    }
  };

  const handleApplyCustom = async () => {
    if (!customFeeTitle) {
      alert("Please enter a Fee Title");
      return;
    }
    if (!useDefaultAmount && !customFeeAmount) {
      alert("Please enter an Amount or check 'Auto-calculate from Class Settings'");
      return;
    }

    const amountToApply = useDefaultAmount ? 0 : parseFloat(customFeeAmount);
    if (!window.confirm(`Apply ${customFeeTitle}?`)) return;

    setIsApplyingCustom(true);
    setCustomMessage('');
    try {
      let query = db.from('students').select('*').neq('status', 'Struck Off');
      if (customTargetClass) query = query.eq('academic_class', customTargetClass);
      if (customTargetSection) query = query.eq('section', customTargetSection);

      const studentsRes = await query;
      const students = studentsRes.data || [];

      let settingsFees: any = {};
      if (useDefaultAmount) {
        const settingsRes = await db.from('settings').select('*').eq('key', 'app_settings').single();
        settingsFees = settingsRes.data?.value?.class_fees || {};
      }

      const vouchersToInsert = students.map((s: any) => {
        const feeAmt = useDefaultAmount
          ? parseFloat(settingsFees[s.academic_class]?.custom_fees?.find((cf: any) => cf.title === customFeeTitle)?.amount || '0')
          : amountToApply;
        return {
          student_id: s.id, student_name: s.name, roll_number: s.roll_number,
          class_name: s.academic_class, section: s.section,
          billing_month: new Date().toISOString().substring(0, 7),
          due_date: customDueDate, tuition_fee: 0, transport_fee: 0, academy_fee: 0,
          custom_fee_amount: feeAmt, custom_fee_title: customFeeTitle,
          arrears: 0, total_amount: feeAmt, paid_amount: 0, status: 'Pending',
          issue_date: new Date().toISOString().split('T')[0]
        };
      }).filter((v: any) => v.total_amount > 0);

      if (vouchersToInsert.length === 0) {
        setCustomMessage('No eligible students found.');
        return;
      }

      const dbVouchers = vouchersToInsert.map((v: any) => {
        const [yearStr, monthNumStr] = v.billing_month.split('-');
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const monthName = monthNames[parseInt(monthNumStr) - 1];
        return {
          student_id: v.student_id,
          month: monthName,
          year: parseInt(yearStr),
          tuition_fee: v.tuition_fee,
          transport_fee: v.transport_fee,
          academy_fee: v.academy_fee,
          other_fee: (v.custom_fee_amount || 0) + (v.arrears || 0),
          discount: 0,
          total_amount: v.total_amount,
          paid_amount: v.paid_amount,
          status: v.status
        };
      });
      const { error } = await db.from('fee_vouchers').insert(dbVouchers);
      if (error) throw error;

      setCustomMessage(`✅ Applied "${customFeeTitle}" to ${vouchersToInsert.length} students.`);
      fetchVouchers();
    } catch (err: any) {
      setCustomMessage(`Error: ${err.message}`);
    } finally {
      setIsApplyingCustom(false);
    }
  };

  const handlePay = (studentGroup: any) => {
    setPaymentStudent(studentGroup);
    const initialBreakdown: Record<string, string> = {};
    studentGroup.pendingVouchers.forEach((v: any) => {
      initialBreakdown[v.id] = '';
    });
    setPaymentBreakdown(initialBreakdown);
    setShowPaymentModal(true);
  };

  const handleBreakdownChange = (field: string, value: string) => {
    let sanitized = value.replace(/^0+(?=\d)/, '');
    if (sanitized === '00' || sanitized === '000') sanitized = '0';
    setPaymentBreakdown(prev => ({ ...prev, [field]: sanitized }));
  };

  const submitPayment = async () => {
    if (!paymentStudent) return;

    setIsPaying(true);
    let successCount = 0;
    try {
      const paymentDate = new Date().toISOString().split('T')[0];
      const authData = await supabase.auth.getSession();

      for (const v of paymentStudent.pendingVouchers) {
        const amountStr = paymentBreakdown[v.id];
        if (!amountStr) continue;
        const amount = parseFloat(amountStr) || 0;
        if (amount <= 0) continue;

        const remaining = (v.total_amount || 0) - (v.paid_amount || 0);
        if (amount > remaining) {
           throw new Error(`Amount for ${v.billing_month} cannot exceed remaining balance.`);
        }

        const newAmountPaid = (v.paid_amount || 0) + amount;
        const newStatus = newAmountPaid >= v.total_amount ? 'Paid' : 'Partial';

        const { error } = await db.from('fee_vouchers').update({
          paid_amount: newAmountPaid,
          status: newStatus,
          paid_date: paymentDate
        }).eq('id', v.id);

        if (error) throw error;
        successCount++;

        // Send receipt notification
        if (newStatus === 'Paid') {
          const title = `✅ Fee Confirmed — ${v.billing_month}`;
          const message = `Dear Parent/Guardian,\n\nThis is to confirm that the fee payment for ${v.student_name} (${v.class_name} - ${v.section}) has been received.\n\n✅ Amount Paid: ₨${amount.toLocaleString()}\n📅 Payment Date: ${paymentDate}\n\nThank you for your cooperation.\n\nSchool Administration`;
          await db.from('notifications').insert({ title, message, target_role: 'Guardian', student_id: v.student_id });
          fetch('/api/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authData.data.session?.access_token}` },
            body: JSON.stringify({ userIds: ['parent_' + v.student_id], title, message, url: '/guardian/guardianfees', category: 'Finance', skipHistory: true })
          }).catch(e => console.error(e));
        } else if (newStatus === 'Partial') {
          const remainingStr = (v.total_amount - newAmountPaid).toLocaleString();
          const title = `⚠️ Partial Fee Received — ${v.billing_month}`;
          const message = `Dear Parent/Guardian,\n\nWe have received a partial payment of ₨${amount.toLocaleString()} for ${v.student_name}.\n\n⚠️ Remaining Balance: ₨${remainingStr}\n📅 Payment Date: ${paymentDate}\n\nPlease clear the remaining balance at your earliest convenience.\n\nSchool Administration`;
          await db.from('notifications').insert({ title, message, target_role: 'Guardian', student_id: v.student_id });
          fetch('/api/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authData.data.session?.access_token}` },
            body: JSON.stringify({ userIds: ['parent_' + v.student_id], title, message, url: '/guardian/guardianfees', category: 'Finance', skipHistory: true })
          }).catch(e => console.error(e));
        }
      }
      
      if (successCount > 0) {
        setShowPaymentModal(false);
        setPaymentStudent(null);
        fetchVouchers();
      } else {
        alert("Please enter at least one valid payment amount.");
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

  const handleOpenNotifModal = () => {
    setNotifResults(null);
    setNotifSending(false);
    setShowNotifModal(true);
  };

  const handleSendBulkNotification = async () => {
    const targetVouchers = reportsView === 'pending'
      ? filteredVouchers.filter(v => v.status === 'Pending' || v.status === 'Partial')
      : filteredVouchers.filter(v => v.status === 'Paid');

    if (targetVouchers.length === 0) {
      alert('No vouchers found for the current filter.');
      return;
    }

    setNotifSending(true);
    try {
      const monthLabel = monthFilter
        ? new Date(monthFilter + '-01').toLocaleString('default', { month: 'long', year: 'numeric' })
        : 'the selected period';

      const notifications = targetVouchers.map((v: any) => {
        const isPending = v.status !== 'Paid';
        const remaining = v.total_amount - (v.paid_amount || 0);
        return {
          title: isPending
            ? `⚠️ Fee Reminder — ${monthLabel}`
            : `✅ Fee Confirmed — ${monthLabel}`,
          message: isPending
            ? `Dear Parent/Guardian,\n\nThis is a reminder that the fee for ${v.student_name} (${v.class_name} - ${v.section}) for ${monthLabel} is still pending.\n\n💰 Total Due: ₨${v.total_amount.toLocaleString()}\n🔴 Remaining: ₨${remaining.toLocaleString()}\n📅 Due Date: ${v.due_date || 'N/A'}\n\nPlease visit the Parent Portal and clear the outstanding balance at your earliest convenience.\n\nSchool Administration`
            : `Dear Parent/Guardian,\n\nThis is to confirm that the fee payment for ${v.student_name} (${v.class_name} - ${v.section}) for ${monthLabel} has been received.\n\n✅ Amount Paid: ₨${(v.paid_amount || 0).toLocaleString()}\n📅 Paid On: ${v.paid_date || 'N/A'}\n\nThank you for your cooperation.\n\nSchool Administration`,
          target_role: 'Guardian',
          student_id: v.student_id
        };
      });

      let sent = 0;
      let failed = 0;
      for (let i = 0; i < notifications.length; i += 50) {
        const { error } = await db.from('notifications').insert(notifications.slice(i, i + 50));
        if (error) failed += Math.min(50, notifications.length - i);
        else sent += Math.min(50, notifications.length - i);
      }

      // ── Trigger Native Web Push ──
      try {
        const userIds = targetVouchers.map((v: any) => v.student_id).filter(Boolean);
        if (userIds.length > 0) {
          const authData = await supabase.auth.getSession();
          const isPending = reportsView === 'pending';
          const title = isPending ? 'Fee Payment Reminder' : 'Fee Payment Confirmed';
          const message = isPending
            ? `Dear Parent/Guardian, this is a reminder that the monthly fee for ${monthLabel} is pending.`
            : `Dear Parent/Guardian, we have received the fee payment for ${monthLabel}. Thank you.`;

          await fetch('/api/push/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authData.data.session?.access_token}`
            },
            body: JSON.stringify({
              userIds: userIds.map((id: string) => 'parent_' + id),
              title,
              message,
              url: '/guardian/guardianfees',
              category: 'Finance',
              skipHistory: true
            })
          });
        }
      } catch (pushErr) {
        console.error('Failed to trigger web push:', pushErr);
      }

      setNotifResults({ sent, failed });
    } catch (err: any) {
      alert('Failed to send notifications: ' + err.message);
    } finally {
      setNotifSending(false);
    }
  };

  const filteredVouchers = useMemo(() => {
    let result = vouchers.filter(v => 
      (v.student_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.roll_number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.billing_month || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (monthFilter) {
      result = result.filter(v => v.billing_month === monthFilter);
    }

    if (selectedClassGroup) {
      result = result.filter(v => v.class_name === selectedClassGroup.className && v.section === selectedClassGroup.section);
    } else {
      if (classFilter) {
        result = result.filter(v => v.class_name === classFilter);
      }
      if (sectionFilter) {
        result = result.filter(v => v.section === sectionFilter);
      }
    }
    return result;
  }, [vouchers, searchQuery, monthFilter, selectedClassGroup, classFilter, sectionFilter]);

  const groupedStudents = useMemo(() => {
    return Object.values(filteredVouchers.reduce((acc: any, v: any) => {
      if (!acc[v.student_id]) {
        acc[v.student_id] = {
          student_id: v.student_id,
          student_name: v.student_name,
          roll_number: v.roll_number,
          class_name: v.class_name,
          section: v.section,
          pendingVouchers: [],
          paidVouchers: [],
        };
      }
      if (v.status === 'Paid') {
        acc[v.student_id].paidVouchers.push(v);
      } else {
        acc[v.student_id].pendingVouchers.push(v);
      }
      return acc;
    }, {})).sort((a: any, b: any) => (a.student_name || '').localeCompare(b.student_name || ''));
  }, [filteredVouchers]);

  const availableClasses = useMemo(() => Array.from(new Set(
    vouchers.map(v => v.class_name).filter(Boolean)
  )).sort(), [vouchers]);

  const availableSections = useMemo(() => Array.from(new Set(
    vouchers
      .filter(v => !classFilter || v.class_name === classFilter)
      .map(v => v.section).filter(Boolean)
  )).sort(), [vouchers, classFilter]);

  const monthFilteredVouchers = useMemo(() => monthFilter ? vouchers.filter(v => v.billing_month === monthFilter) : vouchers, [vouchers, monthFilter]);
  
  const classGroups = useMemo(() => {
    const groups: Record<string, any> = {};
    monthFilteredVouchers.forEach((v: any) => {
      const className = v.class_name || 'Unknown';
      const section = v.section || 'Unknown';
      const key = `${className}-${section}`;
      
      if (!groups[key]) {
        groups[key] = { className, section, total: 0, pending: 0, paid: 0 };
      }
      groups[key].total += 1;
      if (v.status === 'Pending') groups[key].pending += 1;
      if (v.status === 'Paid') groups[key].paid += 1;
    });

    let result = Object.values(groups).sort((a: any, b: any) => {
      if (a.className === b.className) return a.section.localeCompare(b.section);
      return a.className.localeCompare(b.className);
    });
    
    if (classFilter) result = result.filter(g => g.className === classFilter);
    if (sectionFilter) result = result.filter(g => g.section === sectionFilter);
    if (searchQuery) {
      result = result.filter(g => 
        g.className.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.section.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return result;
  }, [monthFilteredVouchers, classFilter, sectionFilter, searchQuery]);

  const overallFilteredVouchers = useMemo(() => {
    let result = vouchers;

    if (monthFilter) {
      const [yearStr, monthNumStr] = monthFilter.split('-');
      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const monthName = monthNames[parseInt(monthNumStr) - 1];
      result = result.filter(v => v.month === monthName && v.year === parseInt(yearStr));
    }
    
    if (selectedClassGroup) {
      result = result.filter(v => v.class_name === selectedClassGroup.className && v.section === selectedClassGroup.section);
    } else {
      if (classFilter) {
        result = result.filter(v => v.class_name === classFilter);
      }
      if (sectionFilter) {
        result = result.filter(v => v.section === sectionFilter);
      }
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(v => 
        (v.student_name && v.student_name.toLowerCase().includes(q)) ||
        (v.roll_number && v.roll_number.toLowerCase().includes(q)) ||
        (v.id && v.id.toLowerCase().includes(q))
      );
    }

    return result;
  }, [vouchers, searchQuery, selectedClassGroup, classFilter, sectionFilter, monthFilter]);


  const groupedReportVouchers = useMemo(() => {
    const groups: Record<string, any> = {};
    filteredVouchers.forEach(v => {
      const key = v.student_id;
      if (!groups[key]) {
        groups[key] = {
          student_id: v.student_id,
          roll_number: v.roll_number,
          student_name: v.student_name,
          class_name: v.class_name,
          section: v.section,
          total_billed: 0,
          total_received: 0,
          total_remaining: 0,
          statuses: new Set<string>()
        };
      }
      groups[key].total_billed += (v.total_amount || 0);
      groups[key].total_received += (v.paid_amount || 0);
      groups[key].total_remaining += ((v.total_amount || 0) - (v.paid_amount || 0));
      groups[key].statuses.add(v.status);
    });
    return Object.values(groups).sort((a: any, b: any) => {
      if (a.class_name !== b.class_name) return (a.class_name || '').localeCompare(b.class_name || '');
      if (a.section !== b.section) return (a.section || '').localeCompare(b.section || '');
      return (a.student_name || '').localeCompare(b.student_name || '');
    });
  }, [filteredVouchers]);

  const groupedStudentVouchers = useMemo(() => {
    const groups: Record<string, any> = {};
    overallFilteredVouchers.forEach(v => {
      const key = v.student_id;
      if (!groups[key]) {
        groups[key] = {
          student_id: v.student_id,
          roll_number: v.roll_number,
          student_name: v.student_name,
          class_name: v.class_name,
          section: v.section,
          pendingVouchers: [],
          paidVouchers: [],
          totalDue: 0
        };
      }
      const remaining = (v.total_amount || 0) - (v.paid_amount || 0);
      if (remaining > 0) {
        groups[key].pendingVouchers.push(v);
        groups[key].totalDue += remaining;
      }
      if ((v.paid_amount || 0) > 0) {
        groups[key].paidVouchers.push(v);
      }
    });
    return Object.values(groups).sort((a: any, b: any) => {
      if (a.class_name !== b.class_name) return (a.class_name || '').localeCompare(b.class_name || '');
      if (a.section !== b.section) return (a.section || '').localeCompare(b.section || '');
      return (a.student_name || '').localeCompare(b.student_name || '');
    });
  }, [overallFilteredVouchers]);

  return (
    <div className="fee-management-page">
      {selectedClassGroup && (
        <button 
          className="btn-primary" 
          onClick={handleBackToClasses} 
          style={{ marginBottom: '16px', backgroundColor: '#DC2626', borderColor: '#DC2626', display: 'flex', alignItems: 'center', width: 'fit-content' }}
        >
          <ArrowLeft size={16} style={{ marginRight: '8px' }} /> Back to Classes
        </button>
      )}
      
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>{selectedClassGroup ? `${selectedClassGroup.className} - Section ${selectedClassGroup.section} Fees` : 'Fee Management'}</h2>
          <p className="subtitle">{selectedClassGroup ? 'Manage payments for this specific class.' : 'Generate monthly invoices and process payments.'}</p>
        </div>
      </div>

      {!selectedClassGroup && (
        <div className="profile-tabs-container" style={{ padding: 0, marginBottom: '16px' }}>
          <nav className="profile-nav-horizontal">
            <button 
              className={`profile-tab-horizontal ${activeTab === 'receive' ? 'active' : ''}`}
              onClick={() => setActiveTab('receive')}
            >
              <CreditCard size={16} />
              <span>Receive Payment</span>
            </button>
            <button 
              className={`profile-tab-horizontal ${activeTab === 'generate' ? 'active' : ''}`}
              onClick={() => setActiveTab('generate')}
            >
              <Calendar size={16} />
              <span>Generate Monthly Fees</span>
            </button>
            <button 
              className={`profile-tab-horizontal ${activeTab === 'reports' ? 'active' : ''}`}
              onClick={() => setActiveTab('reports')}
            >
              <Search size={16} />
              <span>Reports</span>
            </button>
          </nav>
        </div>
      )}

      {activeTab === 'generate' && (
        <div className="generate-section">
          <h3 className="card-heading">Generate Monthly Invoices</h3>
          <p className="body-text" style={{ marginBottom: '24px' }}>
            This process will automatically create an invoice for every active student for the specified month. 
            Any unpaid arrears from previous months will be carried over into the new invoice.
          </p>
          
          <div className="form-row">
            <div className="form-group">
              <label>Billing Month (YYYY-MM)</label>
              <input 
                type="month" 
                value={billingMonth} 
                onChange={(e) => setBillingMonth(e.target.value)} 
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label>Due Date</label>
              <input 
                type="date" 
                value={dueDate} 
                onChange={(e) => setDueDate(e.target.value)} 
                className="form-input"
              />
            </div>
          </div>
          
          <div className="form-group" style={{ marginTop: '16px' }}>
            <label style={{ marginBottom: '8px', display: 'block' }}>Fees to Include</label>
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 500 }}>
                <input 
                  type="checkbox" 
                  checked={includeTuition} 
                  onChange={(e) => setIncludeTuition(e.target.checked)} 
                />
                School Tuition Fee
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 500 }}>
                <input 
                  type="checkbox" 
                  checked={includeTransport} 
                  onChange={(e) => setIncludeTransport(e.target.checked)} 
                />
                Transport Fee
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 500 }}>
                <input 
                  type="checkbox" 
                  checked={includeAcademy} 
                  onChange={(e) => setIncludeAcademy(e.target.checked)} 
                />
                Academy Fee
              </label>
              
              {availableCustomFees.map(feeTitle => (
                <label key={feeTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 500 }}>
                  <input 
                    type="checkbox" 
                    checked={selectedCustomFeesToInclude.includes(feeTitle)} 
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedCustomFeesToInclude([...selectedCustomFeesToInclude, feeTitle]);
                      } else {
                        setSelectedCustomFeesToInclude(selectedCustomFeesToInclude.filter(f => f !== feeTitle));
                      }
                    }} 
                  />
                  {feeTitle}
                </label>
              ))}
            </div>
          </div>
          
          <div className="form-group" style={{ marginTop: '24px', padding: '16px', background: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px', color: '#1e40af' }}>
              <Bell size={18} />
              Parent Portal Notifications
            </h4>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: 600, color: 'var(--color-text-heading)' }}>
              <input
                type="checkbox"
                checked={genNotifyParents}
                onChange={(e) => setGenNotifyParents(e.target.checked)}
                style={{ width: '16px', height: '16px' }}
              />
              Send fee invoice notification to each parent's portal automatically
            </label>
            {genNotifyParents && (
              <p style={{ fontSize: '12px', color: '#3b82f6', marginTop: '8px', marginLeft: '26px' }}>
                Each parent will receive a professional invoice notification in their portal's Notifications tab with the full fee breakdown, due date, and payment instructions.
              </p>
            )}
          </div>

          <div className="action-row" style={{ marginTop: '24px' }}>
            <button
              className="btn-primary"
              onClick={confirmGenerate}
              disabled={isGenerating}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <CheckCircle size={16} /> {isGenerating ? 'Generating...' : 'Generate Now'}
            </button>
            {generateMessage && (
              <span className="status-msg" style={{ color: generateMessage.startsWith('✅') ? 'var(--color-success)' : generateMessage.startsWith('Error') ? '#DC2626' : 'var(--color-text-secondary)' }}>
                {generateMessage}
              </span>
            )}
          </div>
        </div>
      )}

      {activeTab === 'custom' && (
        <div className="generate-section">
          <h3 className="card-heading">Apply Ad-hoc / Custom Charges</h3>
          <p className="body-text" style={{ marginBottom: '24px' }}>
            Issue a custom fee voucher (like Printing Fee, Exam Fee, etc.) to all students, a specific class, or a section. This fee will immediately show up as due and will roll into their arrears for the next month if unpaid.
          </p>
          
          <div className="form-row">
            <div className="form-group">
              <label>Fee Title (e.g. Printing Fee)</label>
              <input 
                type="text" 
                value={customFeeTitle} 
                onChange={(e) => setCustomFeeTitle(e.target.value)} 
                className="form-input"
                placeholder="Enter title..."
              />
            </div>
            <div className="form-group">
              <label>Amount (PKR)</label>
              <input 
                type="number" 
                value={customFeeAmount} 
                onChange={(e) => setCustomFeeAmount(e.target.value)} 
                className="form-input"
                placeholder="0"
                min="0"
                disabled={useDefaultAmount}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 500, marginTop: '8px', fontSize: '13px' }}>
                <input 
                  type="checkbox" 
                  checked={useDefaultAmount} 
                  onChange={(e) => setUseDefaultAmount(e.target.checked)} 
                />
                Auto-calculate from Class Settings
              </label>
            </div>
          </div>
          
          <div className="form-row" style={{ marginTop: '16px' }}>
            <div className="form-group">
              <label>Target Class (Optional)</label>
              <select 
                value={customTargetClass} 
                onChange={(e) => setCustomTargetClass(e.target.value)}
                className="form-input"
              >
                <option value="">All Classes</option>
                {availableClasses.map((c: any) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Target Section (Optional)</label>
              <select 
                value={customTargetSection} 
                onChange={(e) => setCustomTargetSection(e.target.value)}
                className="form-input"
              >
                <option value="">All Sections</option>
                {availableSections.map((s: any) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Due Date</label>
              <input 
                type="date" 
                value={customDueDate} 
                onChange={(e) => setCustomDueDate(e.target.value)} 
                className="form-input"
              />
            </div>
          </div>
          
          <div className="action-row" style={{ marginTop: '24px' }}>
            <button 
              className="btn-primary" 
              onClick={handleApplyCustom} 
              disabled={isApplyingCustom}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <CheckCircle size={16} /> {isApplyingCustom ? 'Applying...' : 'Apply Fee'}
            </button>
            {customMessage && <span className="status-msg">{customMessage}</span>}
          </div>
        </div>
      )}

      {activeTab === 'receive' && (
        <div className="receive-section">
          <div className="records-controls" style={{ padding: '12px 0', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', flex: 1 }}>
              <div className="search-box">
                <Search size={18} className="search-icon" />
                <div className="search-divider"></div>
                <input 
                  type="text" 
                  placeholder="Search students, staff, classes..." 
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="search-input"
                />
              </div>
              
              {!selectedClassGroup && (
                <>
                  <div className="filter-group">
                    <Filter size={16} className="filter-icon" style={{ color: '#3b82f6', position: 'absolute', left: '12px' }} />
                    <select 
                      value={classFilter} 
                      onChange={(e) => setClassFilter(e.target.value)}
                      className="filter-select"
                      style={{ paddingLeft: '36px', appearance: 'none', paddingRight: '32px' }}
                    >
                      <option value="">All Classes</option>
                      {availableClasses.map((c: any) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <ChevronDown size={16} style={{ position: 'absolute', right: '12px', color: '#94a3b8', pointerEvents: 'none' }} />
                  </div>
                  
                  <div className="filter-group">
                    <Filter size={16} className="filter-icon" style={{ color: '#3b82f6', position: 'absolute', left: '12px' }} />
                    <select 
                      value={sectionFilter} 
                      onChange={(e) => setSectionFilter(e.target.value)}
                      className="filter-select"
                      style={{ paddingLeft: '36px', appearance: 'none', paddingRight: '32px' }}
                    >
                      <option value="">All Sections</option>
                      {availableSections.map((s: any) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <ChevronDown size={16} style={{ position: 'absolute', right: '12px', color: '#94a3b8', pointerEvents: 'none' }} />
                  </div>

                  <div className="filter-group" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', backgroundColor: monthFilter ? '#eff6ff' : '#f8fafc', border: monthFilter ? '1px solid #bfdbfe' : '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden', transition: 'all 0.2s' }}>
                      <div 
                        onClick={() => monthInputRef.current?.showPicker()}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '8px', 
                          padding: '8px 12px',
                          color: monthFilter ? '#1e40af' : '#475569', fontWeight: 600, fontSize: '13px',
                          cursor: 'pointer'
                        }}
                      >
                        <Calendar size={16} />
                        <span>{monthFilter ? new Date(parseInt(monthFilter.split('-')[0]), parseInt(monthFilter.split('-')[1]) - 1).toLocaleString('default', { month: 'long', year: 'numeric' }) : 'Overall (All Months)'}</span>
                      </div>
                      {monthFilter && (
                        <div 
                          onClick={(e) => { e.stopPropagation(); setMonthFilter(''); }}
                          style={{ padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', borderLeft: '1px solid #bfdbfe', color: '#3b82f6', background: 'rgba(59, 130, 246, 0.1)' }}
                          title="Switch to Overall"
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)'}
                        >
                          <X size={14} />
                        </div>
                      )}
                    </div>
                    <input 
                      ref={monthInputRef}
                      type="month" 
                      value={monthFilter}
                      onChange={(e) => setMonthFilter(e.target.value)}
                      style={{ 
                        position: 'absolute', top: 0, left: 0, width: 0, height: 0, 
                        opacity: 0, overflow: 'hidden', pointerEvents: 'none'
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
          
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Roll No</th>
                  <th>Student</th>
                  <th>Remainings</th>
                  <th>Payable</th>
                  <th>Paid</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {groupedStudents.length > 0 ? (
                  groupedStudents.map((student: any) => {
                    const totalRemaining = student.pendingVouchers.reduce((sum: number, v: any) => sum + (v.total_amount - (v.paid_amount || 0)), 0);
                    const totalPayable = student.pendingVouchers.reduce((sum: number, v: any) => sum + (v.total_amount || 0), 0) + student.paidVouchers.reduce((sum: number, v: any) => sum + (v.total_amount || 0), 0);
                    const totalPaid = student.paidVouchers.reduce((sum: number, v: any) => sum + (v.paid_amount || 0), 0) + student.pendingVouchers.reduce((sum: number, v: any) => sum + (v.paid_amount || 0), 0);
                    
                    return (
                    <tr key={student.student_id}>
                      <td>{student.roll_number || 'N/A'}</td>
                      <td>
                        <div className="student-info">
                          <span className="font-semibold">{student.student_name}</span>
                          <span className="text-sm text-gray-500">{student.class_name} {student.section}</span>
                        </div>
                      </td>
                      <td>
                        <div 
                          style={{ color: totalRemaining > 0 ? '#DC2626' : 'var(--color-text-secondary)', cursor: 'pointer', fontWeight: 600, display: 'inline-block', padding: '4px 8px', borderRadius: '4px', transition: 'background 0.2s' }}
                          onClick={() => { if (totalRemaining > 0) { setSelectedStudentForRemainings(student); setShowRemainingsModal(true); } }}
                          onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          {totalRemaining.toLocaleString()}
                        </div>
                      </td>
                      <td className="font-semibold" style={{ color: 'var(--color-text-heading)' }}>
                        {totalPayable.toLocaleString()}
                      </td>
                      <td>
                        <div 
                          style={{ color: totalPaid > 0 ? '#16A34A' : 'var(--color-text-secondary)', cursor: 'pointer', fontWeight: 600, display: 'inline-block', padding: '4px 8px', borderRadius: '4px', transition: 'background 0.2s' }}
                          onClick={() => { if (totalPaid > 0) { setSelectedStudentForPaid(student); setShowPaidModal(true); } }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f0fdf4'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          {totalPaid.toLocaleString()}
                        </div>
                      </td>
                      <td>
                        {totalRemaining > 0 ? (
                          <button 
                            className="btn-primary" 
                            style={{ padding: '6px 12px', fontSize: '13px' }}
                            onClick={() => handlePay(student)}
                          >
                            Pay Now
                          </button>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', fontSize: '12px', gap: '4px' }}>
                            <span style={{ color: 'var(--color-success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <CheckCircle size={14} /> Cleared
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>
                  )})
                ) : (
                  <tr>
                    <td colSpan={6} className="empty-state" style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>
                      No fee records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'reports' && (() => {
        const reportsTotalExpected = filteredVouchers.reduce((acc, v) => acc + (v.total_amount || 0), 0);
        const reportsTotalCollected = filteredVouchers.reduce((acc, v) => acc + (v.paid_amount || 0), 0);
        const reportsTotalPending = Math.max(0, reportsTotalExpected - reportsTotalCollected);
        const reportsCollectionRate = reportsTotalExpected > 0 ? ((reportsTotalCollected / reportsTotalExpected) * 100).toFixed(1) : '0.0';
        
        const reportsPendingCount = filteredVouchers.filter(v => v.status === 'Pending' || v.status === 'Partial').length;
        const reportsPaidCount = filteredVouchers.filter(v => v.status === 'Paid').length;

        // Grouped for reports view
        const rawGrouped = Object.values(filteredVouchers.reduce((acc: any, v: any) => {
          const key = v.student_id;
          if (!acc[key]) {
            acc[key] = {
              student_id: v.student_id,
              roll_number: v.roll_number,
              student_name: v.student_name,
              class_name: v.class_name,
              section: v.section,
              total_billed: 0,
              total_received: 0,
              total_remaining: 0
            };
          }
          acc[key].total_billed += (v.total_amount || 0);
          acc[key].total_received += (v.paid_amount || 0);
          acc[key].total_remaining += ((v.total_amount || 0) - (v.paid_amount || 0));
          return acc;
        }, {}));
        
        let reportsVouchers = rawGrouped.map((g: any) => {
          return {
            ...g,
            status: g.total_remaining === 0 ? 'Paid' : (g.total_received > 0 ? 'Partial' : 'Pending')
          };
        });
        
        if (reportsView === 'pending') {
          reportsVouchers = reportsVouchers.filter((v: any) => v.status === 'Pending' || v.status === 'Partial');
        } else {
          reportsVouchers = reportsVouchers.filter((v: any) => v.status === 'Paid');
        }
        
        reportsVouchers.sort((a: any, b: any) => {
          if (a.class_name !== b.class_name) return (a.class_name || '').localeCompare(b.class_name || '');
          if (a.section !== b.section) return (a.section || '').localeCompare(b.section || '');
          return (a.student_name || '').localeCompare(b.student_name || '');
        });

        return (
          <div className="reports-section">
            <div className="page-header" style={{ marginBottom: '24px' }}>
              <h3 className="card-heading" style={{ fontSize: '20px' }}>Financial Reports Dashboard</h3>
              <p className="body-text">At-a-glance financial summary and invoice tracking for the selected period.</p>
            </div>

            <div className="records-controls" style={{ padding: '12px 16px', marginBottom: '24px', display: 'flex', gap: '16px', flexWrap: 'wrap', backgroundColor: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-border)', alignItems: 'center' }}>
              <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--color-text-secondary)', marginRight: 'auto' }}>Filters:</div>
              <div className="filter-group">
                <Filter size={16} className="filter-icon" style={{ color: '#3b82f6', position: 'absolute', left: '12px' }} />
                <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="filter-select" style={{ paddingLeft: '36px', appearance: 'none', paddingRight: '32px' }}>
                  <option value="">All Classes</option>
                  {availableClasses.map((c: any) => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown size={16} style={{ position: 'absolute', right: '12px', color: '#94a3b8', pointerEvents: 'none' }} />
              </div>
              <div className="filter-group">
                <Filter size={16} className="filter-icon" style={{ color: '#3b82f6', position: 'absolute', left: '12px' }} />
                <select value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)} className="filter-select" style={{ paddingLeft: '36px', appearance: 'none', paddingRight: '32px' }}>
                  <option value="">All Sections</option>
                  {availableSections.map((s: any) => <option key={s} value={s}>{s}</option>)}
                </select>
                <ChevronDown size={16} style={{ position: 'absolute', right: '12px', color: '#94a3b8', pointerEvents: 'none' }} />
              </div>
              <div className="filter-group" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', backgroundColor: monthFilter ? '#eff6ff' : '#f8fafc', border: monthFilter ? '1px solid #bfdbfe' : '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden', transition: 'all 0.2s' }}>
                  <div 
                    onClick={() => monthInputRef.current?.showPicker()}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px', 
                      padding: '8px 12px',
                      color: monthFilter ? '#1e40af' : '#475569', fontWeight: 600, fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    <Calendar size={16} />
                    <span>{monthFilter ? new Date(parseInt(monthFilter.split('-')[0]), parseInt(monthFilter.split('-')[1]) - 1).toLocaleString('default', { month: 'long', year: 'numeric' }) : 'Overall (All Months)'}</span>
                  </div>
                  {monthFilter && (
                    <div 
                      onClick={(e) => { e.stopPropagation(); setMonthFilter(''); }}
                      style={{ padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', borderLeft: '1px solid #bfdbfe', color: '#3b82f6', background: 'rgba(59, 130, 246, 0.1)' }}
                      title="Switch to Overall"
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)'}
                    >
                      <X size={14} />
                    </div>
                  )}
                </div>
                <input ref={monthInputRef} type="month" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} style={{ position: 'absolute', top: 0, left: 0, width: 0, height: 0, opacity: 0, overflow: 'hidden', pointerEvents: 'none' }} />
              </div>
            </div>

            {/* Dashboard Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '32px' }}>
              <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '20px', border: '1px solid var(--color-border)', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                   <div style={{ padding: '6px', borderRadius: '8px', backgroundColor: '#eff6ff', color: '#3b82f6' }}><CreditCard size={18} /></div>
                   <h4 style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '14px', fontWeight: 600 }}>Total Expected Revenue</h4>
                 </div>
                 <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-text-heading)' }}>₨ {reportsTotalExpected.toLocaleString()}</div>
                 <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '8px' }}>Total amount billed for this period</div>
              </div>

              <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '20px', border: '1px solid var(--color-border)', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                   <div style={{ padding: '6px', borderRadius: '8px', backgroundColor: '#dcfce7', color: '#22c55e' }}><CheckCircle size={18} /></div>
                   <h4 style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '14px', fontWeight: 600 }}>Total Collected</h4>
                 </div>
                 <div style={{ fontSize: '28px', fontWeight: 700, color: '#15803d' }}>₨ {reportsTotalCollected.toLocaleString()}</div>
                 <div style={{ marginTop: '12px', background: '#e2e8f0', borderRadius: '6px', height: '8px', overflow: 'hidden' }}>
                    <div style={{ width: `${reportsCollectionRate}%`, background: '#22c55e', height: '100%', borderRadius: '6px' }}></div>
                 </div>
                 <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '6px', fontWeight: 500 }}>
                   <span>Collection Rate</span>
                   <span>{reportsCollectionRate}%</span>
                 </div>
              </div>

              <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '20px', border: '1px solid var(--color-border)', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                   <div style={{ padding: '6px', borderRadius: '8px', backgroundColor: '#fee2e2', color: '#ef4444' }}><AlertCircle size={18} /></div>
                   <h4 style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '14px', fontWeight: 600 }}>Total Pending</h4>
                 </div>
                 <div style={{ fontSize: '28px', fontWeight: 700, color: '#b91c1c' }}>₨ {reportsTotalPending.toLocaleString()}</div>
                 <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '8px' }}>Amount still owed</div>
              </div>

              {filteredVouchers.length > 0 && (
                <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '20px', border: '1px solid var(--color-border)', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                     <div style={{ padding: '6px', borderRadius: '8px', backgroundColor: '#f3e8ff', color: '#a855f7' }}><Calendar size={18} /></div>
                     <h4 style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '14px', fontWeight: 600 }}>Voucher Generated</h4>
                   </div>
                   <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-heading)', marginTop: '8px' }}>
                     {filteredVouchers[0]?.issue_date ? formatDate(filteredVouchers[0].issue_date) : 'N/A'}
                   </div>
                   <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '12px' }}>
                     {(filteredVouchers[0]?.tuition_fee || 0) > 0 && <span style={{ padding: '2px 8px', borderRadius: '12px', background: '#f1f5f9', fontSize: '11px', color: '#475569', border: '1px solid #e2e8f0' }}>Tuition</span>}
                     {(filteredVouchers[0]?.transport_fee || 0) > 0 && <span style={{ padding: '2px 8px', borderRadius: '12px', background: '#f1f5f9', fontSize: '11px', color: '#475569', border: '1px solid #e2e8f0' }}>Transport</span>}
                     {(filteredVouchers[0]?.academy_fee || 0) > 0 && <span style={{ padding: '2px 8px', borderRadius: '12px', background: '#f1f5f9', fontSize: '11px', color: '#475569', border: '1px solid #e2e8f0' }}>Academy</span>}
                     {(filteredVouchers[0]?.custom_fee_amount || 0) > 0 && <span style={{ padding: '2px 8px', borderRadius: '12px', background: '#f1f5f9', fontSize: '11px', color: '#475569', border: '1px solid #e2e8f0' }}>{filteredVouchers[0]?.custom_fee_title || 'Custom'}</span>}
                     {(filteredVouchers[0]?.arrears || 0) > 0 && <span style={{ padding: '2px 8px', borderRadius: '12px', background: '#f1f5f9', fontSize: '11px', color: '#475569', border: '1px solid #e2e8f0' }}>Arrears</span>}
                   </div>
                   <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '8px' }}>Included Fee Types</div>
                </div>
              )}
            </div>

            {/* Detailed Invoice Lists */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', borderBottom: '1px solid var(--color-border)', paddingBottom: '16px', overflowX: 'auto', alignItems: 'center' }}>
               <button 
                 onClick={() => setReportsView('pending')}
                 style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: reportsView === 'pending' ? '#fee2e2' : 'transparent', color: reportsView === 'pending' ? '#b91c1c' : 'var(--color-text-muted)', fontWeight: 600, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s', whiteSpace: 'nowrap' }}
               >
                 <AlertCircle size={16} /> Pending Invoices (Defaulters) ({reportsPendingCount})
               </button>
               <button 
                 onClick={() => setReportsView('paid')}
                 style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: reportsView === 'paid' ? '#dcfce7' : 'transparent', color: reportsView === 'paid' ? '#15803d' : 'var(--color-text-muted)', fontWeight: 600, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s', whiteSpace: 'nowrap' }}
               >
                 <CheckCircle size={16} /> Paid Invoices ({reportsPaidCount})
               </button>
               
               <div style={{ flex: 1 }}></div>

               <button
                  onClick={handleOpenNotifModal}
                  style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#6366f1', color: 'white', fontWeight: 600, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s', whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(99,102,241,0.3)' }}
                >
                  <Bell size={16} />
                  {reportsView === 'pending' ? 'Notify Defaulter Parents' : 'Notify Paid Parents'}
                </button>
            </div>
            
            <div className="table-container" style={{ maxHeight: '500px', overflowY: 'auto' }}>
              <table className="data-table">
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr>
                    <th>Student</th>
                    <th>Total Billed</th>
                    <th>Received</th>
                    <th>Status / Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {reportsVouchers.length > 0 ? (
                    reportsVouchers.map((v: any) => (
                      <tr key={v.student_id}>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--color-text-heading)', fontSize: '14px' }}>{v.student_name}</div>
                          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>Roll: {v.roll_number || 'N/A'} | {v.class_name} ({v.section})</div>
                        </td>
                        <td style={{ fontWeight: 600, fontSize: '14px' }}>₨ {v.total_billed.toLocaleString()}</td>
                        <td style={{ fontWeight: 600, fontSize: '14px', color: 'var(--color-success)' }}>₨ {v.total_received.toLocaleString()}</td>
                        <td>
                          {v.status === 'Paid' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', background: '#dcfce7', color: '#15803d', borderRadius: '6px', fontSize: '12px', fontWeight: 600, width: 'fit-content' }}>
                                <CheckCircle size={14} /> Paid
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', background: '#fee2e2', color: '#b91c1c', borderRadius: '6px', fontSize: '12px', fontWeight: 600, width: 'fit-content' }}>
                                <AlertCircle size={14} /> {v.status}
                              </div>
                              <span style={{ fontSize: '12px', fontWeight: 600, color: '#b91c1c' }}>Owes: ₨ {v.total_remaining.toLocaleString()}</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>
                        No records found for the current filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      
      {/* Professional Payment Modal */}
      {showPaymentModal && paymentStudent && (() => {
        let hasError = false;
        let anyReceived = false;
        let totalPayable = 0;
        let totalReceived = 0;
        
        return (
          <div className="modal-overlay" onClick={() => setShowPaymentModal(false)} style={{ backdropFilter: 'blur(4px)', background: 'rgba(15, 23, 42, 0.4)' }}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', borderRadius: '20px', padding: '0', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
              
              {/* Header */}
              <div style={{ background: 'linear-gradient(to right, #3b82f6, #2563eb)', padding: '24px', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <CreditCard size={26} /> Receive Payment
                  </h2>
                  <p style={{ margin: '6px 0 0', opacity: 0.9, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <User size={16} /> {paymentStudent.student_name} <span style={{ opacity: 0.6 }}>|</span> Roll: {paymentStudent.roll_number || 'N/A'} <span style={{ opacity: 0.6 }}>|</span> {paymentStudent.class_name} - {paymentStudent.section}
                  </p>
                </div>
                <button onClick={() => setShowPaymentModal(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', cursor: 'pointer', padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}>
                  <X size={20} />
                </button>
              </div>
              
              {/* Body */}
              <div style={{ padding: '24px', background: '#f8fafc' }}>
                <div style={{ background: 'white', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead style={{ background: '#f1f5f9' }}>
                      <tr>
                        <th style={{ padding: '14px 20px', fontSize: '13px', fontWeight: 600, color: '#475569', borderBottom: '1px solid #e2e8f0' }}>Pending Month</th>
                        <th style={{ padding: '14px 20px', fontSize: '13px', fontWeight: 600, color: '#475569', borderBottom: '1px solid #e2e8f0', textAlign: 'right' }}>Payable</th>
                        <th style={{ padding: '14px 20px', fontSize: '13px', fontWeight: 600, color: '#475569', borderBottom: '1px solid #e2e8f0', textAlign: 'center', width: '180px' }}>Payment Amount</th>
                        <th style={{ padding: '14px 20px', fontSize: '13px', fontWeight: 600, color: '#475569', borderBottom: '1px solid #e2e8f0', textAlign: 'right' }}>New Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentStudent.pendingVouchers.map((v: any) => {
                        const dateObj = new Date(v.billing_month + '-01');
                        const monthYear = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                        
                        const remaining = (v.total_amount || 0) - (v.paid_amount || 0);
                        const received = parseFloat(paymentBreakdown[v.id]) || 0;
                        const rowError = received > remaining;
                        const newRemaining = remaining - received;
                        
                        if (rowError) hasError = true;
                        if (received > 0) anyReceived = true;
                        
                        totalPayable += remaining;
                        totalReceived += received;
                        
                        return (
                          <tr key={v.id} style={{ borderBottom: '1px solid #f1f5f9', background: received > 0 ? '#eff6ff' : 'transparent', transition: 'background 0.2s' }}>
                            <td style={{ padding: '14px 20px', fontSize: '14px', color: '#1e293b', fontWeight: 600 }}>{monthYear}</td>
                            <td style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 600, color: '#475569' }}>₨ {remaining.toLocaleString()}</td>
                            <td style={{ padding: '10px 20px', textAlign: 'center' }}>
                              <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
                                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '13px', pointerEvents: 'none' }}>₨</span>
                                <input 
                                  type="number" 
                                  min="0" 
                                  max={remaining}
                                  step="any" 
                                  placeholder="0"
                                  className="form-input"
                                  style={{ 
                                    padding: '8px 12px 8px 30px', 
                                    textAlign: 'right', 
                                    borderColor: rowError ? '#ef4444' : (received > 0 ? '#3b82f6' : '#cbd5e1'),
                                    boxShadow: rowError ? '0 0 0 1px #ef4444' : (received > 0 ? '0 0 0 1px #3b82f6' : 'none'),
                                    borderRadius: '8px',
                                    fontWeight: received > 0 ? 600 : 400,
                                    color: received > 0 ? '#1d4ed8' : '#334155',
                                    backgroundColor: 'white',
                                    width: '100%'
                                  }} 
                                  value={paymentBreakdown[v.id] !== undefined ? paymentBreakdown[v.id] : ''} 
                                  onChange={e => handleBreakdownChange(v.id, e.target.value)} 
                                />
                              </div>
                            </td>
                            <td style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 700, color: newRemaining > 0 ? '#ef4444' : '#10b981' }}>
                              {newRemaining === 0 && received > 0 ? (
                                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}><CheckCircle size={16} /> Cleared</span>
                              ) : (
                                `₨ ${newRemaining >= 0 ? newRemaining.toLocaleString() : 0}`
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot style={{ background: '#f8fafc' }}>
                      <tr>
                        <td style={{ padding: '16px 20px', fontSize: '15px', color: '#1e293b', fontWeight: 700, borderTop: '2px solid #e2e8f0' }}>Total Summary</td>
                        <td style={{ padding: '16px 20px', fontSize: '16px', color: '#475569', fontWeight: 800, textAlign: 'right', borderTop: '2px solid #e2e8f0' }}>₨ {totalPayable.toLocaleString()}</td>
                        <td style={{ padding: '16px 20px', fontSize: '16px', color: '#2563eb', fontWeight: 800, textAlign: 'right', borderTop: '2px solid #e2e8f0' }}>₨ {totalReceived.toLocaleString()}</td>
                        <td style={{ padding: '16px 20px', fontSize: '16px', color: (totalPayable - totalReceived) > 0 ? '#ef4444' : '#10b981', fontWeight: 800, textAlign: 'right', borderTop: '2px solid #e2e8f0' }}>₨ {(totalPayable - totalReceived).toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                
                {hasError && (
                  <div style={{ marginTop: '16px', padding: '12px 16px', background: '#fef2f2', borderLeft: '4px solid #ef4444', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '12px', color: '#b91c1c' }}>
                    <AlertCircle size={20} />
                    <span style={{ fontSize: '14px', fontWeight: 500 }}>Error: One or more payment amounts exceed the remaining balance.</span>
                  </div>
                )}
              </div>
              
              {/* Footer */}
              <div style={{ padding: '20px 24px', background: 'white', display: 'flex', gap: '16px', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0' }}>
                <button 
                  onClick={() => setShowPaymentModal(false)}
                  style={{ padding: '10px 24px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', transition: 'background 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'}
                  onMouseLeave={e => e.currentTarget.style.background = '#f1f5f9'}
                >
                  Cancel
                </button>
                <button 
                  onClick={submitPayment} 
                  disabled={!!isPaying || hasError || !anyReceived}
                  style={{ 
                    padding: '10px 28px', 
                    background: (!!isPaying || hasError || !anyReceived) ? '#93c5fd' : '#2563eb', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '8px', 
                    fontWeight: 600, 
                    fontSize: '14px', 
                    cursor: (!!isPaying || hasError || !anyReceived) ? 'not-allowed' : 'pointer', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    transition: 'background 0.2s',
                    boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)'
                  }}
                  onMouseEnter={e => { if (!isPaying && !hasError && anyReceived) e.currentTarget.style.background = '#1d4ed8'; }}
                  onMouseLeave={e => { if (!isPaying && !hasError && anyReceived) e.currentTarget.style.background = '#2563eb'; }}
                >
                  {isPaying ? 'Processing...' : 'Confirm Payment'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      
      {/* History Modal */}
      {showHistoryModal && historyVoucher && (() => {
        const sumPayable = historyVoucher.total_amount || 0;
        const sumReceived = historyVoucher.paid_amount || 0;
        const sumRemainings = Math.max(0, sumPayable - sumReceived);

        return (
          <div className="modal-overlay" onClick={() => setShowHistoryModal(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px', borderRadius: '16px' }}>
              <h2 style={{ marginTop: 0, borderBottom: '1px solid var(--color-border)', paddingBottom: '12px' }}>
                Payment Summary - {historyVoucher.student_name}
              </h2>
              
              <div style={{ background: 'var(--color-bg-secondary)', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Total Payable:</span>
                  <span style={{ fontWeight: 600 }}>₨ {sumPayable.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Total Received:</span>
                  <span style={{ fontWeight: 600, color: 'var(--color-success)' }}>₨ {sumReceived.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--color-border)', paddingTop: '8px', marginTop: '8px' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Remaining Balance:</span>
                  <span style={{ fontWeight: 700, color: sumRemainings > 0 ? '#DC2626' : 'inherit' }}>₨ {sumRemainings.toLocaleString()}</span>
                </div>
              </div>
            
              <h3 style={{ fontSize: '15px', marginBottom: '12px' }}>Last Payment</h3>
              {historyVoucher.paid_date ? (
                <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', padding: '16px', background: 'var(--color-bg)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>{formatDate(historyVoucher.paid_date)}</span>
                    <span style={{ color: 'var(--color-success)', fontWeight: 600, fontSize: '15px' }}>₨ {sumReceived.toLocaleString()}</span>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '16px', textAlign: 'center', background: 'var(--color-bg-secondary)', borderRadius: '8px', color: 'var(--color-text-muted)' }}>
                  No payment history found.
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button className="btn-primary" onClick={() => setShowHistoryModal(false)}>Close</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Parent Portal Bulk Notification Modal */}
      {showNotifModal && (
        <div className="modal-overlay" onClick={() => !notifSending && setShowNotifModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '540px', borderRadius: '20px', padding: 0, overflow: 'hidden', boxShadow: '0 25px 50px rgba(0,0,0,0.15)' }}>
            {/* Modal Header */}
            <div style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', padding: '24px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Bell size={20} color="white" />
                </div>
                <div>
                  <h2 style={{ margin: 0, color: 'white', fontSize: '18px', fontWeight: 700 }}>Send Fee Notifications</h2>
                  <p style={{ margin: 0, color: 'rgba(255,255,255,0.8)', fontSize: '13px', marginTop: '2px' }}>
                    {reportsView === 'pending' ? 'Fee Defaulters Reminder' : 'Payment Confirmation'}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowNotifModal(false)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '8px', color: 'white', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>×</button>
            </div>

            <div style={{ padding: '24px 28px' }}>
              {!notifResults ? (
                <>
                  <div style={{ padding: '16px', background: '#f0f9ff', borderRadius: '12px', border: '1px solid #bae6fd', marginBottom: '20px' }}>
                    <p style={{ margin: 0, fontSize: '14px', color: '#0c4a6e', lineHeight: '1.7' }}>
                      📣 A professional <strong>{reportsView === 'pending' ? 'fee reminder' : 'payment confirmation'}</strong> will be automatically sent to each parent's portal for all <strong>{reportsView === 'pending' ? 'pending/partial' : 'paid'}</strong> invoices in the current filter.
                    </p>
                  </div>

                  <div style={{ marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Message Preview</div>
                  <div style={{ padding: '16px', background: 'var(--color-surface, #f8fafc)', borderRadius: '12px', border: '1px solid var(--color-border)', fontSize: '13.5px', color: 'var(--color-text-primary)', lineHeight: '1.8', fontFamily: 'Georgia, serif', whiteSpace: 'pre-line' }}>
                    {reportsView === 'pending'
                      ? 'Dear Parent/Guardian,\n\nOur records indicate that your child\'s monthly fee is currently outstanding. Kindly submit the payment at your earliest convenience to avoid any inconvenience.\n\nThank you,\nSchool Administration'
                      : 'Dear Parent/Guardian,\n\nYour child\'s fee payment for ' + (monthFilter ? new Date(monthFilter + '-01').toLocaleString('default', { month: 'long', year: 'numeric' }) : 'the selected period') + ' has been successfully received. Thank you for your timely payment.\n\nThank you,\nSchool Administration'
                    }
                  </div>
                </>
              ) : (
                <div>
                  {notifResults.sent > 0 && (
                    <div style={{ padding: '20px', background: '#f0fdf4', borderRadius: '12px', border: '1px solid #86efac', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <CheckCircle size={22} color="#16a34a" />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: '#15803d', fontSize: '16px' }}>{notifResults.sent} Notifications Sent</div>
                        <div style={{ color: '#4ade80', fontSize: '13px' }}>Successfully delivered to parent portals</div>
                      </div>
                    </div>
                  )}
                  {notifResults.failed > 0 && (
                    <div style={{ padding: '20px', background: '#fef2f2', borderRadius: '12px', border: '1px solid #fca5a5', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <AlertCircle size={22} color="#dc2626" />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: '#b91c1c', fontSize: '16px' }}>{notifResults.failed} Failed</div>
                        <div style={{ color: '#f87171', fontSize: '13px' }}>Some notifications could not be delivered</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '20px', marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button onClick={() => setShowNotifModal(false)} disabled={notifSending} style={{ padding: '10px 24px', borderRadius: '10px', border: '1px solid var(--color-border)', background: 'transparent', fontWeight: 600, fontSize: '14px', cursor: 'pointer', color: 'var(--color-text-primary)' }}>
                  {notifResults ? 'Close' : 'Cancel'}
                </button>
                {!notifResults && (
                  <button
                    onClick={handleSendBulkNotification}
                    disabled={notifSending}
                    style={{ padding: '10px 24px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', color: 'white', fontWeight: 600, fontSize: '14px', cursor: notifSending ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', opacity: notifSending ? 0.7 : 1, boxShadow: '0 4px 12px rgba(79,70,229,0.3)' }}
                  >
                    <Bell size={16} />
                    {notifSending ? 'Sending...' : 'Send Notifications'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Generation Confirmation Modal */}
      {showGenConfirmModal && (
        <div className="modal-overlay" onClick={() => setShowGenConfirmModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '540px', borderRadius: '20px', padding: 0, overflow: 'hidden', boxShadow: '0 25px 50px rgba(0,0,0,0.15)' }}>
            {/* Header */}
            <div style={{ background: 'linear-gradient(135deg, #059669 0%, #0891b2 100%)', padding: '24px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Calendar size={20} color="white" />
                </div>
                <div>
                  <h2 style={{ margin: 0, color: 'white', fontSize: '18px', fontWeight: 700 }}>Generate Monthly Fees</h2>
                  <p style={{ margin: 0, color: 'rgba(255,255,255,0.8)', fontSize: '13px', marginTop: '2px' }}>Review and confirm before proceeding</p>
                </div>
              </div>
              <button onClick={() => setShowGenConfirmModal(false)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '8px', color: 'white', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>×</button>
            </div>

            <div style={{ padding: '24px 28px' }}>
              {/* Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div style={{ padding: '16px', background: '#f0fdf4', borderRadius: '12px', border: '1px solid #86efac' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Billing Month</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#15803d' }}>{new Date(billingMonth + '-01').toLocaleString('default', { month: 'long', year: 'numeric' })}</div>
                </div>
                <div style={{ padding: '16px', background: '#fff7ed', borderRadius: '12px', border: '1px solid #fed7aa' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#fb923c', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Due Date</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#c2410c' }}>{dueDate}</div>
                </div>
              </div>

              {/* Fees to Include */}
              <div style={{ padding: '16px', background: 'var(--color-surface, #f8fafc)', borderRadius: '12px', border: '1px solid var(--color-border)', marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fees to Include</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {includeTuition && <span style={{ padding: '4px 12px', background: '#dbeafe', borderRadius: '20px', fontSize: '13px', color: '#1e40af', fontWeight: 500 }}>✓ Tuition</span>}
                  {includeTransport && <span style={{ padding: '4px 12px', background: '#dbeafe', borderRadius: '20px', fontSize: '13px', color: '#1e40af', fontWeight: 500 }}>✓ Transport</span>}
                  {includeAcademy && <span style={{ padding: '4px 12px', background: '#dbeafe', borderRadius: '20px', fontSize: '13px', color: '#1e40af', fontWeight: 500 }}>✓ Academy</span>}
                  {selectedCustomFeesToInclude.map(f => <span key={f} style={{ padding: '4px 12px', background: '#dbeafe', borderRadius: '20px', fontSize: '13px', color: '#1e40af', fontWeight: 500 }}>✓ {f}</span>)}
                </div>
              </div>

              {genNotifyParents && (
                <div style={{ padding: '14px 16px', background: '#f0f9ff', borderRadius: '12px', border: '1px solid #bae6fd', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Bell size={18} color="#0284c7" />
                  <p style={{ fontSize: '13px', color: '#0c4a6e', margin: 0, lineHeight: '1.5' }}>
                    <strong>Parent Portal Notifications Enabled</strong> — Each parent will automatically receive a fee invoice notification with the full breakdown.
                  </p>
                </div>
              )}

              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '20px', marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button onClick={() => setShowGenConfirmModal(false)} style={{ padding: '10px 24px', borderRadius: '10px', border: '1px solid var(--color-border)', background: 'transparent', fontWeight: 600, fontSize: '14px', cursor: 'pointer', color: 'var(--color-text-primary)' }}>Cancel</button>
                <button
                  onClick={handleGenerate}
                  style={{ padding: '10px 24px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #059669 0%, #0891b2 100%)', color: 'white', fontWeight: 600, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(5,150,105,0.3)' }}
                >
                  <CheckCircle size={16} /> Confirm & Generate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Remainings Details Modal */}
      {showRemainingsModal && selectedStudentForRemainings && (
        <div className="modal-overlay" onClick={() => setShowRemainingsModal(false)} style={{ backdropFilter: 'blur(4px)', background: 'rgba(15, 23, 42, 0.4)' }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', borderRadius: '20px', padding: '0', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ background: 'linear-gradient(to right, #ef4444, #dc2626)', padding: '20px 24px', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={24} /> Pending Dues
                </h2>
                <p style={{ margin: '4px 0 0', opacity: 0.9, fontSize: '14px' }}>{selectedStudentForRemainings.student_name} • Roll: {selectedStudentForRemainings.roll_number || 'N/A'}</p>
              </div>
              <button onClick={() => setShowRemainingsModal(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', cursor: 'pointer', padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}>
                <X size={18} />
              </button>
            </div>
            
            <div style={{ padding: '24px', background: '#f8fafc' }}>
              <div style={{ background: 'white', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead style={{ background: '#f1f5f9' }}>
                    <tr>
                      <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: '#475569', borderBottom: '1px solid #e2e8f0' }}>Pending Month</th>
                      <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: '#475569', borderBottom: '1px solid #e2e8f0', textAlign: 'right' }}>Remaining Dues</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedStudentForRemainings.pendingVouchers.map((v: any) => {
                      const dateObj = new Date(v.billing_month + '-01');
                      const monthYear = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                      const remaining = (v.total_amount || 0) - (v.paid_amount || 0);
                      return (
                        <tr key={v.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '12px 16px', fontSize: '14px', color: '#1e293b', fontWeight: 500 }}>{monthYear}</td>
                          <td style={{ padding: '12px 16px', fontSize: '14px', color: '#dc2626', fontWeight: 600, textAlign: 'right' }}>₨ {remaining.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot style={{ background: '#fdf2f2' }}>
                    <tr>
                      <td style={{ padding: '16px', fontSize: '15px', color: '#1e293b', fontWeight: 700, borderTop: '2px solid #fecaca' }}>Total Pending</td>
                      <td style={{ padding: '16px', fontSize: '16px', color: '#b91c1c', fontWeight: 800, textAlign: 'right', borderTop: '2px solid #fecaca' }}>
                        ₨ {selectedStudentForRemainings.pendingVouchers.reduce((sum: number, pv: any) => sum + (pv.total_amount - (pv.paid_amount || 0)), 0).toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Paid History Modal */}
      {showPaidModal && selectedStudentForPaid && (
        <div className="modal-overlay" onClick={() => setShowPaidModal(false)} style={{ backdropFilter: 'blur(4px)', background: 'rgba(15, 23, 42, 0.4)' }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', borderRadius: '20px', padding: '0', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ background: 'linear-gradient(to right, #16a34a, #15803d)', padding: '20px 24px', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle size={24} /> Payment History
                </h2>
                <p style={{ margin: '4px 0 0', opacity: 0.9, fontSize: '14px' }}>{selectedStudentForPaid.student_name} • Roll: {selectedStudentForPaid.roll_number || 'N/A'}</p>
              </div>
              <button onClick={() => setShowPaidModal(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', cursor: 'pointer', padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}>
                <X size={18} />
              </button>
            </div>
            
            <div style={{ padding: '24px', background: '#f8fafc' }}>
              <div style={{ background: 'white', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead style={{ background: '#f1f5f9' }}>
                    <tr>
                      <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: '#475569', borderBottom: '1px solid #e2e8f0' }}>Billing Month</th>
                      <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: '#475569', borderBottom: '1px solid #e2e8f0' }}>Payment Date</th>
                      <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: '#475569', borderBottom: '1px solid #e2e8f0', textAlign: 'right' }}>Amount Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedStudentForPaid.paidVouchers.map((v: any) => {
                      const dateObj = new Date(v.billing_month + '-01');
                      const monthYear = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                      const paidDateObj = v.paid_date ? new Date(v.paid_date) : null;
                      const paidDateStr = paidDateObj ? paidDateObj.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A';
                      
                      return (
                        <tr key={v.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '12px 16px', fontSize: '14px', color: '#1e293b', fontWeight: 500 }}>{monthYear}</td>
                          <td style={{ padding: '12px 16px', fontSize: '14px', color: '#64748b' }}>{paidDateStr}</td>
                          <td style={{ padding: '12px 16px', fontSize: '14px', color: '#16a34a', fontWeight: 600, textAlign: 'right' }}>₨ {(v.paid_amount || 0).toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot style={{ background: '#f0fdf4' }}>
                    <tr>
                      <td colSpan={2} style={{ padding: '16px', fontSize: '15px', color: '#1e293b', fontWeight: 700, borderTop: '2px solid #bbf7d0' }}>Total Paid</td>
                      <td style={{ padding: '16px', fontSize: '16px', color: '#15803d', fontWeight: 800, textAlign: 'right', borderTop: '2px solid #bbf7d0' }}>
                        ₨ {selectedStudentForPaid.paidVouchers.reduce((sum: number, pv: any) => sum + (pv.paid_amount || 0), 0).toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeeManagement;
