'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase, adminSupabase } from '@/lib/supabase';
import { DollarSign, CreditCard, PieChart, TrendingUp, TrendingDown, Users, FileText, Filter, ArrowDownRight, Wallet, AlertCircle } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

export default function FinanceDashboard() {
  const [filterType, setFilterType] = useState<'month' | 'year' | 'custom'>('month');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toLocaleString('default', { month: 'long' }));
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [feeData, setFeeData] = useState<any[]>([]);
  const [payrollData, setPayrollData] = useState<any[]>([]);
  const [expenseData, setExpenseData] = useState<any[]>([]);
  const [studentsData, setStudentsData] = useState<any[]>([]);

  useEffect(() => {
    fetchFinancialData();
  }, [filterType, selectedMonth, selectedYear, fromDate, toDate]);

  const fetchFinancialData = async () => {
    setIsLoading(true);
    const dbClient = adminSupabase || supabase;
    try {
      let feesQuery = dbClient.from('fee_vouchers').select('*');
      let payrollQuery = dbClient.from('payroll').select('*');
      let expenseQuery = dbClient.from('expenses').select('*');
      let studentsQuery = dbClient.from('students').select('id, academic_class, section, status');

      if (filterType === 'month') {
        feesQuery = feesQuery.eq('month', selectedMonth).eq('year', selectedYear);
        payrollQuery = payrollQuery.eq('month', selectedMonth).eq('year', selectedYear);
        
        const startOfMonth = new Date(selectedYear, new Date(`${selectedMonth} 1, 2000`).getMonth(), 1).toISOString();
        const endOfMonth = new Date(selectedYear, new Date(`${selectedMonth} 1, 2000`).getMonth() + 1, 0, 23, 59, 59).toISOString();
        expenseQuery = expenseQuery.gte('expense_date', startOfMonth).lte('expense_date', endOfMonth);
      } else if (filterType === 'year') {
        feesQuery = feesQuery.eq('year', selectedYear);
        payrollQuery = payrollQuery.eq('year', selectedYear);
        
        const startOfYear = new Date(selectedYear, 0, 1).toISOString();
        const endOfYear = new Date(selectedYear, 11, 31, 23, 59, 59).toISOString();
        expenseQuery = expenseQuery.gte('expense_date', startOfYear).lte('expense_date', endOfYear);
      } else if (filterType === 'custom' && fromDate && toDate) {
        feesQuery = feesQuery.gte('updated_at', new Date(fromDate).toISOString()).lte('updated_at', new Date(toDate + 'T23:59:59').toISOString());
        payrollQuery = payrollQuery.gte('updated_at', new Date(fromDate).toISOString()).lte('updated_at', new Date(toDate + 'T23:59:59').toISOString());
        expenseQuery = expenseQuery.gte('expense_date', new Date(fromDate).toISOString()).lte('expense_date', new Date(toDate + 'T23:59:59').toISOString());
      }

      const [fRes, pRes, eRes, sRes] = await Promise.all([feesQuery, payrollQuery, expenseQuery, studentsQuery]);
      
      setFeeData(fRes.data || []);
      setPayrollData(pRes.data || []);
      setStudentsData(sRes.data || []);

      if (eRes.error && eRes.error.code === '42P01') {
        console.warn('Expenses table missing. Generating empty state.');
        setExpenseData([]);
      } else {
        setExpenseData(eRes.data || []);
      }

    } catch (err) {
      console.error('Error fetching financial data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const stats = useMemo(() => {
    const totalFeesExpected = feeData.reduce((sum, f) => sum + (Number(f.total_amount) || 0), 0);
    const collectedFeesList = feeData.filter(f => f.status === 'Paid' || f.status === 'Partial');
    const totalFeesCollected = collectedFeesList.reduce((sum, f) => sum + (Number(f.paid_amount) || 0), 0);
    const pendingFees = Math.max(0, totalFeesExpected - totalFeesCollected);
    
    const paidStudentsCount = collectedFeesList.length;
    const collectionPercentage = totalFeesExpected > 0 ? ((totalFeesCollected / totalFeesExpected) * 100).toFixed(1) : 0;

    const paidPayroll = payrollData.filter(p => p.status === 'Paid');
    const totalPayrollPaid = paidPayroll.reduce((sum, p) => sum + (Number(p.net_salary) || 0), 0);
    const paidStaffCount = paidPayroll.length;

    const totalOperatingExpenses = expenseData.reduce((sum, e) => sum + (Number(e.expense_amount) || 0), 0);
    const expenseCount = expenseData.length;

    const totalExpenditure = totalPayrollPaid + totalOperatingExpenses;
    const netBalance = totalFeesCollected - totalExpenditure;

    return {
      totalFeesCollected,
      pendingFees,
      paidStudentsCount,
      collectionPercentage,
      totalPayrollPaid,
      paidStaffCount,
      totalOperatingExpenses,
      expenseCount,
      totalExpenditure,
      netBalance,
      isProfit: netBalance >= 0
    };
  }, [feeData, payrollData, expenseData]);

  const classSummary = useMemo(() => {
    const classMap: Record<string, any> = {};
    const activeStudents = studentsData.filter(s => s.status !== 'Struck Off');

    activeStudents.forEach(s => {
      if (!s.academic_class || !s.section) return;
      const key = `${s.academic_class} - ${s.section}`;
      if (!classMap[key]) {
        classMap[key] = { class: s.academic_class, section: s.section, registered: 0, expected: 0, collected: 0 };
      }
      classMap[key].registered += 1;
    });

    feeData.forEach(f => {
      const student = activeStudents.find(s => s.id === f.student_id);
      if (student && student.academic_class && student.section) {
        const key = `${student.academic_class} - ${student.section}`;
        if (classMap[key]) {
          classMap[key].expected += (Number(f.total_amount) || 0);
          classMap[key].collected += (Number(f.paid_amount) || 0);
        }
      }
    });

    return Object.values(classMap).map(c => ({
      ...c,
      pending: Math.max(0, c.expected - c.collected),
      percentage: c.expected > 0 ? ((c.collected / c.expected) * 100).toFixed(1) : '0.0'
    })).sort((a, b) => a.class.localeCompare(b.class));
  }, [studentsData, feeData]);

  const chartData = useMemo(() => {
    const map = new Map<string, { Income: number, Expenses: number, timestamp: number }>();
    
    const getKey = (dateStr: string) => {
        const d = new Date(dateStr);
        if (filterType === 'year') {
           return { key: d.toLocaleString('default', { month: 'short' }), ts: new Date(d.getFullYear(), d.getMonth(), 1).getTime() };
        } else {
           return { key: `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`, ts: new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() };
        }
    };

    if (filterType === 'month') {
        const days = new Date(selectedYear, new Date(`${selectedMonth} 1, 2000`).getMonth() + 1, 0).getDate();
        for(let i=1; i<=days; i++) {
           const d = new Date(selectedYear, new Date(`${selectedMonth} 1, 2000`).getMonth(), i);
           map.set(`${d.getDate()} ${d.toLocaleString('default', {month: 'short'})}`, { Income: 0, Expenses: 0, timestamp: d.getTime() });
        }
    } else if (filterType === 'year') {
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        months.forEach((m, i) => {
           map.set(m, { Income: 0, Expenses: 0, timestamp: new Date(selectedYear, i, 1).getTime() });
        });
    } else if (filterType === 'custom' && fromDate && toDate) {
        let curr = new Date(fromDate);
        const end = new Date(toDate);
        while(curr <= end) {
           map.set(`${curr.getDate()} ${curr.toLocaleString('default', {month: 'short'})}`, { Income: 0, Expenses: 0, timestamp: curr.getTime() });
           curr.setDate(curr.getDate() + 1);
        }
    }

    feeData.filter(f => f.status === 'Paid' || f.status === 'Partial').forEach(f => {
        if(!f.updated_at) return;
        const { key } = getKey(f.updated_at);
        if(map.has(key)) {
           map.get(key)!.Income += (Number(f.paid_amount) || 0);
        }
    });

    payrollData.filter(p => p.status === 'Paid').forEach(p => {
        if(!p.updated_at) return;
        const { key } = getKey(p.updated_at);
        if(map.has(key)) {
           map.get(key)!.Expenses += (Number(p.net_salary) || 0);
        }
    });

    expenseData.forEach(e => {
        if(!e.expense_date) return;
        const { key } = getKey(e.expense_date);
        if(map.has(key)) {
           map.get(key)!.Expenses += (Number(e.expense_amount) || 0);
        }
    });

    return Array.from(map.entries()).map(([name, data]) => {
        return {
            name,
            timestamp: data.timestamp,
            Income: data.Income,
            Expenses: data.Expenses,
            NetBalance: data.Income - data.Expenses,
        };
    }).sort((a,b) => a.timestamp - b.timestamp);
  }, [feeData, payrollData, expenseData, filterType, selectedMonth, selectedYear, fromDate, toDate]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(amount);
  };

  const formatCompactCurrency = (value: number) => {
    return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', notation: 'compact', compactDisplay: 'short' }).format(value);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const income = payload.find((p: any) => p.dataKey === 'Income')?.value || 0;
      const expenses = payload.find((p: any) => p.dataKey === 'Expenses')?.value || 0;
      const netBalance = payload.find((p: any) => p.dataKey === 'NetBalance')?.value || 0;
      const isProfit = netBalance >= 0;
  
      return (
        <div style={{ background: '#FFF', padding: '16px', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', border: '1px solid #E2E8F0', minWidth: '220px' }}>
          <p style={{ margin: '0 0 12px 0', fontWeight: 700, color: '#1E293B', fontSize: '14px', borderBottom: '1px solid #E2E8F0', paddingBottom: '8px' }}>{label}</p>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: '#64748B', fontSize: '13px' }}>Income</span>
            <span style={{ color: '#10B981', fontWeight: 600, fontSize: '13px' }}>{formatCurrency(income)}</span>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ color: '#64748B', fontSize: '13px' }}>Expenses</span>
            <span style={{ color: '#EF4444', fontWeight: 600, fontSize: '13px' }}>{formatCurrency(expenses)}</span>
          </div>
  
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #E2E8F0', paddingTop: '12px' }}>
            <span style={{ color: '#1E293B', fontWeight: 700, fontSize: '13px' }}>Net Balance</span>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: isProfit ? '#10B981' : '#EF4444', fontWeight: 700, fontSize: '14px' }}>
                {formatCurrency(Math.abs(netBalance))}
              </div>
              <div style={{ color: isProfit ? '#10B981' : '#EF4444', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', marginTop: '2px' }}>
                {isProfit ? 'Profit' : 'Loss'}
              </div>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'var(--font-inter, sans-serif)' }}>
      {/* Header & Filters */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '28px', color: '#1E293B', fontWeight: 700 }}>Finance Dashboard</h1>
          <p style={{ margin: '4px 0 0 0', color: '#64748B', fontSize: '15px' }}>Monthly Financial Overview & Reports</p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', background: '#FFF', padding: '12px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', border: '1px solid #E2E8F0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderRight: '1px solid #E2E8F0', paddingRight: '12px' }}>
            <Filter size={18} color="#64748B" />
            <select 
              value={filterType} 
              onChange={e => setFilterType(e.target.value as any)}
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '14px', fontWeight: 600, color: '#334155', cursor: 'pointer' }}
            >
              <option value="month">Month</option>
              <option value="year">Year</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>
          
          {filterType === 'month' ? (
            <div style={{ display: 'flex', gap: '8px' }}>
              <select 
                value={selectedMonth} 
                onChange={e => setSelectedMonth(e.target.value)}
                style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '14px' }}
              >
                {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <input 
                type="number" 
                value={selectedYear} 
                onChange={e => setSelectedYear(parseInt(e.target.value))}
                style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '14px', width: '80px' }}
              />
            </div>
          ) : filterType === 'year' ? (
            <div style={{ display: 'flex', gap: '8px' }}>
              <input 
                type="number" 
                value={selectedYear} 
                onChange={e => setSelectedYear(parseInt(e.target.value))}
                style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '14px', width: '100px' }}
              />
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '14px' }} />
              <span style={{ color: '#94A3B8' }}>to</span>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '14px' }} />
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          {[1,2,3,4,5,6].map(i => (
            <div key={i} style={{ height: '140px', background: '#F1F5F9', borderRadius: '16px', animation: 'pulse 1.5s infinite' }}></div>
          ))}
        </div>
      ) : (
        <>
          {/* Main Financial Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '32px' }}>
            
            {/* 1. Fee Collection */}
            <div style={{ background: '#FFF', borderRadius: '20px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #E2E8F0', position: 'relative', overflow: 'hidden', transition: 'transform 0.2s', cursor: 'pointer' }}
                 onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
                 onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', color: '#64748B', fontWeight: 600 }}>Fee Collection</h3>
                  <p style={{ margin: '4px 0 16px 0', fontSize: '13px', color: '#94A3B8' }}>Student Fee Revenue</p>
                  <h2 style={{ margin: 0, fontSize: '28px', color: '#1E293B', fontWeight: 800 }}>{formatCurrency(stats.totalFeesCollected)}</h2>
                </div>
                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3B82F6' }}>
                  <Wallet size={24} />
                </div>
              </div>
              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: '#64748B', background: '#F8FAFC', padding: '10px 12px', borderRadius: '10px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Users size={14} /> {stats.paidStudentsCount} students paid</span>
                <span style={{ color: '#10B981', fontWeight: 600 }}>{stats.collectionPercentage}% collected</span>
              </div>
            </div>

            {/* 2. Pending Fees */}
            <div style={{ background: '#FFF', borderRadius: '20px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #E2E8F0', position: 'relative', overflow: 'hidden', transition: 'transform 0.2s', cursor: 'pointer' }}
                 onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
                 onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', color: '#64748B', fontWeight: 600 }}>Pending Fees</h3>
                  <p style={{ margin: '4px 0 16px 0', fontSize: '13px', color: '#94A3B8' }}>Uncollected Dues</p>
                  <h2 style={{ margin: 0, fontSize: '28px', color: '#1E293B', fontWeight: 800 }}>{formatCurrency(stats.pendingFees)}</h2>
                </div>
                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EF4444' }}>
                  <AlertCircle size={24} />
                </div>
              </div>
            </div>

            {/* 3. Staff Payroll */}
            <div style={{ background: '#FFF', borderRadius: '20px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #E2E8F0', position: 'relative', overflow: 'hidden', transition: 'transform 0.2s', cursor: 'pointer' }}
                 onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
                 onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', color: '#64748B', fontWeight: 600 }}>Staff Payroll</h3>
                  <p style={{ margin: '4px 0 16px 0', fontSize: '13px', color: '#94A3B8' }}>Salary Disbursement</p>
                  <h2 style={{ margin: 0, fontSize: '28px', color: '#1E293B', fontWeight: 800 }}>{formatCurrency(stats.totalPayrollPaid)}</h2>
                </div>
                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F59E0B' }}>
                  <CreditCard size={24} />
                </div>
              </div>
              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: '#64748B', background: '#F8FAFC', padding: '10px 12px', borderRadius: '10px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Users size={14} /> {stats.paidStaffCount} staff paid</span>
              </div>
            </div>

            {/* 4. Operating Expenses */}
            <div style={{ background: '#FFF', borderRadius: '20px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #E2E8F0', position: 'relative', overflow: 'hidden', transition: 'transform 0.2s', cursor: 'pointer' }}
                 onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
                 onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', color: '#64748B', fontWeight: 600 }}>Operating Expenses</h3>
                  <p style={{ margin: '4px 0 16px 0', fontSize: '13px', color: '#94A3B8' }}>School Operational Costs</p>
                  <h2 style={{ margin: 0, fontSize: '28px', color: '#1E293B', fontWeight: 800 }}>{formatCurrency(stats.totalOperatingExpenses)}</h2>
                </div>
                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#FCE7F3', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EC4899' }}>
                  <FileText size={24} />
                </div>
              </div>
              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: '#64748B', background: '#F8FAFC', padding: '10px 12px', borderRadius: '10px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><PieChart size={14} /> {stats.expenseCount} expense records</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
            
            {/* Profit & Loss and Net Balance Overview */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Profit / Loss Card */}
              <div style={{ background: stats.isProfit ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)' : 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)', borderRadius: '24px', padding: '32px', color: 'white', position: 'relative', overflow: 'hidden', boxShadow: stats.isProfit ? '0 10px 25px rgba(16, 185, 129, 0.3)' : '0 10px 25px rgba(239, 68, 68, 0.3)' }}>
                <div style={{ position: 'relative', zIndex: 2 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, opacity: 0.9 }}>
                      {stats.isProfit ? 'Profit' : 'Loss'}
                    </h3>
                    <div style={{ background: 'rgba(255,255,255,0.2)', padding: '6px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: 700 }}>
                      Net Balance
                    </div>
                  </div>
                  <p style={{ margin: '4px 0 20px 0', fontSize: '14px', opacity: 0.8 }}>Total Collection - (Payroll + Expenses)</p>
                  <h2 style={{ margin: 0, fontSize: '42px', fontWeight: 800 }}>{formatCurrency(Math.abs(stats.netBalance))}</h2>
                </div>
                {stats.isProfit ? (
                  <TrendingUp size={140} style={{ position: 'absolute', right: '-20px', bottom: '-20px', opacity: 0.15 }} />
                ) : (
                  <TrendingDown size={140} style={{ position: 'absolute', right: '-20px', bottom: '-20px', opacity: 0.15 }} />
                )}
              </div>

              {/* Total Expenditure */}
              <div style={{ background: '#FFF', borderRadius: '20px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', color: '#64748B', fontWeight: 600 }}>Total Expenditure</h3>
                  <p style={{ margin: '4px 0 16px 0', fontSize: '13px', color: '#94A3B8' }}>Payroll + Operating Expenses</p>
                  <h2 style={{ margin: 0, fontSize: '28px', color: '#EF4444', fontWeight: 800 }}>{formatCurrency(stats.totalExpenditure)}</h2>
                </div>
                <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EF4444' }}>
                  <ArrowDownRight size={28} />
                </div>
              </div>
            </div>

            {/* Class-wise Finance Summary */}
            <div style={{ background: '#FFF', borderRadius: '20px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #E2E8F0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', color: '#1E293B', fontWeight: 700 }}>Class-wise Finance Summary</h3>
              
              {classSummary.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>No class data available for this period.</div>
              ) : (
                <div style={{ overflowX: 'auto', flexGrow: 1 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '500px' }}>
                    <thead>
                      <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                        <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: '#475569', textTransform: 'uppercase' }}>Class & Section</th>
                        <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: '#475569', textTransform: 'uppercase' }}>Registered</th>
                        <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: '#475569', textTransform: 'uppercase' }}>Collected</th>
                        <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: '#475569', textTransform: 'uppercase' }}>Pending</th>
                        <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: '#475569', textTransform: 'uppercase' }}>%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classSummary.map((c, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1E293B', fontSize: '14px' }}>{c.class} ({c.section})</td>
                          <td style={{ padding: '12px 16px', color: '#64748B', fontSize: '14px' }}>{c.registered}</td>
                          <td style={{ padding: '12px 16px', color: '#10B981', fontWeight: 600, fontSize: '14px' }}>{formatCurrency(c.collected)}</td>
                          <td style={{ padding: '12px 16px', color: '#EF4444', fontWeight: 600, fontSize: '14px' }}>{formatCurrency(c.pending)}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ background: Number(c.percentage) >= 90 ? '#D1FAE5' : Number(c.percentage) >= 50 ? '#FEF3C7' : '#FEE2E2', color: Number(c.percentage) >= 90 ? '#059669' : Number(c.percentage) >= 50 ? '#D97706' : '#DC2626', padding: '4px 8px', borderRadius: '20px', fontSize: '12px', fontWeight: 700 }}>
                              {c.percentage}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* New Full-Width Financial Performance Chart */}
          <div style={{ background: '#FFF', borderRadius: '20px', padding: '32px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #E2E8F0', width: '100%' }}>
            <h3 style={{ margin: 0, fontSize: '20px', color: '#1E293B', fontWeight: 700 }}>Financial Performance Trend</h3>
            <p style={{ margin: '4px 0 32px 0', fontSize: '14px', color: '#64748B' }}>Income, Expenses and Net Balance over the selected period.</p>
            
            <div style={{ width: '100%', height: '400px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 20, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 13, fill: '#64748B', fontWeight: 500 }} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 13, fill: '#64748B', fontWeight: 500 }} 
                    tickFormatter={(val) => formatCompactCurrency(val)} 
                    dx={-10}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#CBD5E1', strokeWidth: 1, strokeDasharray: '4 4' }} />
                  <Legend 
                    verticalAlign="top" 
                    height={36} 
                    iconType="circle"
                    wrapperStyle={{ fontSize: '14px', fontWeight: 600, color: '#334155' }}
                  />
                  <Line type="monotone" name="Income" dataKey="Income" stroke="#10B981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6, strokeWidth: 0 }} />
                  <Line type="monotone" name="Expenses" dataKey="Expenses" stroke="#EF4444" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6, strokeWidth: 0 }} />
                  <Line type="monotone" name="Net Balance" dataKey="NetBalance" stroke="#3B82F6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6, strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
