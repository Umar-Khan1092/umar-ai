'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase, adminSupabase } from '@/lib/supabase';
import { DollarSign, CreditCard, PieChart, TrendingUp, Users, FileText, Calendar, Filter, ArrowUpRight, ArrowDownRight, Wallet } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export default function FinanceDashboard() {
  const [filterType, setFilterType] = useState<'month' | 'custom'>('month');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toLocaleString('default', { month: 'long' }));
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [feeData, setFeeData] = useState<any[]>([]);
  const [payrollData, setPayrollData] = useState<any[]>([]);
  const [expenseData, setExpenseData] = useState<any[]>([]);

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

      if (filterType === 'month') {
        feesQuery = feesQuery.eq('month', selectedMonth).eq('year', selectedYear);
        payrollQuery = payrollQuery.eq('month', selectedMonth).eq('year', selectedYear);
        
        // For expenses, we'll parse the date in memory for month match or we could use like/gte
        const startOfMonth = new Date(selectedYear, new Date(`${selectedMonth} 1, 2000`).getMonth(), 1).toISOString();
        const endOfMonth = new Date(selectedYear, new Date(`${selectedMonth} 1, 2000`).getMonth() + 1, 0, 23, 59, 59).toISOString();
        expenseQuery = expenseQuery.gte('expense_date', startOfMonth).lte('expense_date', endOfMonth);
      } else if (filterType === 'custom' && fromDate && toDate) {
        // Fallback to updated_at for fees/payroll as they lack specific date fields other than month/year
        feesQuery = feesQuery.gte('updated_at', new Date(fromDate).toISOString()).lte('updated_at', new Date(toDate + 'T23:59:59').toISOString());
        payrollQuery = payrollQuery.gte('updated_at', new Date(fromDate).toISOString()).lte('updated_at', new Date(toDate + 'T23:59:59').toISOString());
        expenseQuery = expenseQuery.gte('expense_date', new Date(fromDate).toISOString()).lte('expense_date', new Date(toDate + 'T23:59:59').toISOString());
      }

      const [fRes, pRes, eRes] = await Promise.all([feesQuery, payrollQuery, expenseQuery]);
      setFeeData(fRes.data || []);
      setPayrollData(pRes.data || []);
      setExpenseData(eRes.data || []);

    } catch (err) {
      console.error('Error fetching financial data:', err);
      // Create empty table if expenses doesn't exist yet
      if ((err as any)?.code === '42P01') {
        console.warn('Expenses table does not exist. Initializing empty.');
        setExpenseData([]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const stats = useMemo(() => {
    // 1. Total Fee Collection
    const collectedFees = feeData.filter(f => f.status === 'Paid' || f.status === 'Partial');
    const totalFeesCollected = collectedFees.reduce((sum, f) => sum + (Number(f.paid_amount) || 0), 0);
    const totalFeesExpected = feeData.reduce((sum, f) => sum + (Number(f.total_amount) || 0), 0);
    const paidStudentsCount = collectedFees.length;
    const collectionPercentage = totalFeesExpected > 0 ? ((totalFeesCollected / totalFeesExpected) * 100).toFixed(1) : 0;

    // 2. Staff Payroll
    const paidPayroll = payrollData.filter(p => p.status === 'Paid');
    const totalPayrollPaid = paidPayroll.reduce((sum, p) => sum + (Number(p.net_salary) || 0), 0);
    const paidStaffCount = paidPayroll.length;

    // 3. Operating Expenses
    const totalOperatingExpenses = expenseData.reduce((sum, e) => sum + (Number(e.expense_amount) || 0), 0);
    const expenseCount = expenseData.length;

    // 4. Total Expenditure
    const totalExpenditure = totalPayrollPaid + totalOperatingExpenses;

    // 5. Net Balance
    const netBalance = totalFeesCollected - totalExpenditure;

    return {
      totalFeesCollected,
      paidStudentsCount,
      collectionPercentage,
      totalPayrollPaid,
      paidStaffCount,
      totalOperatingExpenses,
      expenseCount,
      totalExpenditure,
      netBalance
    };
  }, [feeData, payrollData, expenseData]);

  const chartData = useMemo(() => {
    // Simplified chart data for the selected period
    return [
      { name: 'Week 1', Income: stats.totalFeesCollected * 0.2, Expense: stats.totalExpenditure * 0.15 },
      { name: 'Week 2', Income: stats.totalFeesCollected * 0.3, Expense: stats.totalExpenditure * 0.25 },
      { name: 'Week 3', Income: stats.totalFeesCollected * 0.4, Expense: stats.totalExpenditure * 0.3 },
      { name: 'Week 4', Income: stats.totalFeesCollected * 0.1, Expense: stats.totalExpenditure * 0.3 },
    ];
  }, [stats]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(amount);
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
              <option value="month">Month & Year</option>
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
          {[1,2,3,4,5].map(i => (
            <div key={i} style={{ height: '140px', background: '#F1F5F9', borderRadius: '16px', animation: 'pulse 1.5s infinite' }}></div>
          ))}
        </div>
      ) : (
        <>
          {/* Main Financial Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '32px' }}>
            
            {/* 1. Total Fee Collection */}
            <div style={{ background: '#FFF', borderRadius: '20px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #E2E8F0', position: 'relative', overflow: 'hidden', transition: 'transform 0.2s', cursor: 'pointer' }}
                 onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
                 onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', color: '#64748B', fontWeight: 600 }}>Total Fee Collection</h3>
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

            {/* 2. Staff Payroll */}
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

            {/* 3. Operating Expenses */}
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            
            {/* Net Balance & Expenditure Summary */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Net Balance */}
              <div style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', borderRadius: '24px', padding: '32px', color: 'white', position: 'relative', overflow: 'hidden', boxShadow: '0 10px 25px rgba(16, 185, 129, 0.3)' }}>
                <div style={{ position: 'relative', zIndex: 2 }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 500, opacity: 0.9 }}>Net Balance</h3>
                  <p style={{ margin: '4px 0 16px 0', fontSize: '13px', opacity: 0.8 }}>Total Collection - Total Expenditure</p>
                  <h2 style={{ margin: 0, fontSize: '36px', fontWeight: 800 }}>{formatCurrency(stats.netBalance)}</h2>
                </div>
                <TrendingUp size={120} style={{ position: 'absolute', right: '-20px', bottom: '-20px', opacity: 0.1 }} />
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

            {/* Income vs Expense Chart */}
            <div style={{ background: '#FFF', borderRadius: '20px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #E2E8F0' }}>
              <h3 style={{ margin: '0 0 24px 0', fontSize: '16px', color: '#1E293B', fontWeight: 700 }}>Income vs Expense Trend</h3>
              <div style={{ width: '100%', height: '260px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94A3B8' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94A3B8' }} tickFormatter={(val) => `Rs ${val / 1000}k`} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
                      formatter={(value: any) => formatCurrency(Number(value) || 0)}
                    />
                    <Area type="monotone" dataKey="Income" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorIncome)" />
                    <Area type="monotone" dataKey="Expense" stroke="#EF4444" strokeWidth={3} fillOpacity={1} fill="url(#colorExpense)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        </>
      )}
    </div>
  );
}
