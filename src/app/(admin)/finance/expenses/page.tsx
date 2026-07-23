'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase, adminSupabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Search, Plus, Filter, Calendar, Edit, Trash2, Receipt, ArrowUpDown, ChevronLeft, ChevronRight, CheckCircle2, AlertCircle, X } from 'lucide-react';

const EXPENSE_TYPES = ['Electricity', 'Internet', 'Stationery', 'Maintenance', 'Transport', 'Salary Advance', 'Repairs', 'Other'];

export default function ExpenseManagement() {
  const { user } = useAuth();
  
  const [expenses, setExpenses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [dateFilter, setDateFilter] = useState(''); // YYYY-MM
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  // Form State
  const [form, setForm] = useState({
    id: '',
    expense_name: '',
    expense_type: 'Other',
    expense_amount: '',
    expense_date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    setIsLoading(true);
    const dbClient = adminSupabase || supabase;
    try {
      const { data, error } = await dbClient.from('expenses').select('*').order('expense_date', { ascending: sortOrder === 'asc' });
      if (error && error.code === '42P01') {
        console.warn('Expenses table does not exist. Creating schema is required.');
        setExpenses([]);
      } else if (error) {
        throw error;
      } else {
        setExpenses(data || []);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (expense?: any) => {
    if (expense) {
      setForm({
        id: expense.id,
        expense_name: expense.expense_name,
        expense_type: expense.expense_type,
        expense_amount: expense.expense_amount.toString(),
        expense_date: expense.expense_date
      });
    } else {
      setForm({
        id: '',
        expense_name: '',
        expense_type: 'Other',
        expense_amount: '',
        expense_date: new Date().toISOString().split('T')[0]
      });
    }
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.expense_name || !form.expense_amount) {
      setStatus({ type: 'error', message: 'Name and amount are required.' });
      return;
    }

    try {
      const dbClient = adminSupabase || supabase;
      const payload = {
        expense_name: form.expense_name,
        expense_type: form.expense_type,
        expense_amount: parseFloat(form.expense_amount),
        expense_date: form.expense_date,
        created_by: user?.id,
        updated_at: new Date().toISOString()
      };

      if (form.id) {
        const { error } = await dbClient.from('expenses').update(payload).eq('id', form.id);
        if (error) throw error;
        setStatus({ type: 'success', message: 'Expense updated successfully.' });
      } else {
        const { error } = await dbClient.from('expenses').insert([{ ...payload, created_at: new Date().toISOString() }]);
        if (error) throw error;
        setStatus({ type: 'success', message: 'Expense added successfully.' });
      }

      setShowModal(false);
      fetchExpenses();
      setTimeout(() => setStatus({ type: null, message: '' }), 3000);
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'Failed to save expense.' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    try {
      const dbClient = adminSupabase || supabase;
      const { error } = await dbClient.from('expenses').delete().eq('id', id);
      if (error) throw error;
      fetchExpenses();
      setStatus({ type: 'success', message: 'Expense deleted successfully.' });
      setTimeout(() => setStatus({ type: null, message: '' }), 3000);
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message });
    }
  };

  const filteredExpenses = useMemo(() => {
    let result = [...expenses];
    if (searchQuery) {
      result = result.filter(e => e.expense_name.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    if (filterType !== 'All') {
      result = result.filter(e => e.expense_type === filterType);
    }
    if (dateFilter) {
      result = result.filter(e => e.expense_date.startsWith(dateFilter));
    }
    if (sortOrder === 'desc') {
      result.sort((a, b) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime());
    } else {
      result.sort((a, b) => new Date(a.expense_date).getTime() - new Date(b.expense_date).getTime());
    }
    return result;
  }, [expenses, searchQuery, filterType, dateFilter, sortOrder]);

  const totalPages = Math.ceil(filteredExpenses.length / itemsPerPage);
  const paginatedExpenses = filteredExpenses.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'var(--font-inter, sans-serif)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '28px', color: '#1E293B', fontWeight: 700 }}>Expense Management</h1>
          <p style={{ margin: '4px 0 0 0', color: '#64748B', fontSize: '15px' }}>Track and manage school expenditures</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          style={{ background: '#3B82F6', color: '#FFF', border: 'none', padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.2)' }}
        >
          <Plus size={18} /> Add New Expense
        </button>
      </div>

      {status.type && (
        <div style={{ padding: '12px 16px', background: status.type === 'success' ? '#F0FDF4' : '#FEF2F2', color: status.type === 'success' ? '#16A34A' : '#DC2626', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '8px', marginBottom: '24px', border: `1px solid ${status.type === 'success' ? '#BBF7D0' : '#FECACA'}` }}>
          {status.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          {status.message}
        </div>
      )}

      {/* Filters and Controls */}
      <div style={{ background: '#FFF', padding: '16px', borderRadius: '12px', border: '1px solid #E2E8F0', marginBottom: '24px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 250px' }}>
          <Search size={18} color="#94A3B8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input 
            type="text" 
            placeholder="Search expenses..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '10px 12px 10px 38px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px' }}
          />
        </div>
        
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#F8FAFC', padding: '4px 12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <Filter size={16} color="#64748B" />
            <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '14px', color: '#334155', cursor: 'pointer' }}>
              <option value="All">All Types</option>
              {EXPENSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#F8FAFC', padding: '4px 12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <Calendar size={16} color="#64748B" />
            <input 
              type="month" 
              value={dateFilter} 
              onChange={e => setDateFilter(e.target.value)} 
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '14px', color: '#334155', cursor: 'pointer' }} 
            />
          </div>

          <button onClick={() => setSortOrder(p => p === 'desc' ? 'asc' : 'desc')} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#F8FAFC', padding: '4px 12px', borderRadius: '8px', border: '1px solid #E2E8F0', cursor: 'pointer', color: '#334155', fontSize: '14px' }}>
            <ArrowUpDown size={16} /> {sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
          </button>
        </div>
      </div>

      {/* Table Area */}
      <div style={{ background: '#FFF', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
        {isLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>Loading expenses...</div>
        ) : filteredExpenses.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <Receipt size={48} color="#CBD5E1" style={{ margin: '0 auto 16px' }} />
            <h3 style={{ margin: '0 0 8px 0', color: '#1E293B', fontSize: '18px' }}>No expenses found</h3>
            <p style={{ margin: 0, color: '#64748B', fontSize: '14px' }}>Try adjusting your filters or add a new expense.</p>
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    <th style={{ padding: '16px 24px', fontSize: '13px', fontWeight: 600, color: '#475569', textTransform: 'uppercase' }}>Expense Name</th>
                    <th style={{ padding: '16px 24px', fontSize: '13px', fontWeight: 600, color: '#475569', textTransform: 'uppercase' }}>Type</th>
                    <th style={{ padding: '16px 24px', fontSize: '13px', fontWeight: 600, color: '#475569', textTransform: 'uppercase' }}>Date</th>
                    <th style={{ padding: '16px 24px', fontSize: '13px', fontWeight: 600, color: '#475569', textTransform: 'uppercase' }}>Amount</th>
                    <th style={{ padding: '16px 24px', fontSize: '13px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedExpenses.map(expense => (
                    <tr key={expense.id} style={{ borderBottom: '1px solid #F1F5F9', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '16px 24px' }}>
                        <p style={{ margin: 0, fontSize: '15px', fontWeight: 500, color: '#1E293B' }}>{expense.expense_name}</p>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <span style={{ padding: '4px 10px', background: '#EFF6FF', color: '#2563EB', borderRadius: '20px', fontSize: '13px', fontWeight: 500 }}>
                          {expense.expense_type}
                        </span>
                      </td>
                      <td style={{ padding: '16px 24px', color: '#64748B', fontSize: '14px' }}>
                        {new Date(expense.expense_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                      <td style={{ padding: '16px 24px', fontWeight: 600, color: '#1E293B', fontSize: '15px' }}>
                        {formatCurrency(expense.expense_amount)}
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button onClick={() => handleOpenModal(expense)} style={{ padding: '8px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#FFF', color: '#64748B', cursor: 'pointer' }}>
                            <Edit size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ padding: '16px 24px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', color: '#64748B' }}>Showing {(page - 1) * itemsPerPage + 1} to {Math.min(page * itemsPerPage, filteredExpenses.length)} of {filteredExpenses.length} entries</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '6px', background: page === 1 ? 'transparent' : '#FFF', border: '1px solid', borderColor: page === 1 ? 'transparent' : '#CBD5E1', borderRadius: '6px', cursor: page === 1 ? 'not-allowed' : 'pointer', color: '#64748B' }}><ChevronLeft size={18} /></button>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: '6px', background: page === totalPages ? 'transparent' : '#FFF', border: '1px solid', borderColor: page === totalPages ? 'transparent' : '#CBD5E1', borderRadius: '6px', cursor: page === totalPages ? 'not-allowed' : 'pointer', color: '#64748B' }}><ChevronRight size={18} /></button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
          <div style={{ background: '#FFF', borderRadius: '16px', width: '100%', maxWidth: '500px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#1E293B' }}>{form.id ? 'Edit Expense' : 'Add New Expense'}</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', display: 'flex' }}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSave} style={{ padding: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500, color: '#334155' }}>Expense Name</label>
                  <input type="text" required value={form.expense_name} onChange={e => setForm({...form, expense_name: e.target.value})} placeholder="e.g., Office Supplies" style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px' }} />
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500, color: '#334155' }}>Expense Type</label>
                    <select required value={form.expense_type} onChange={e => setForm({...form, expense_type: e.target.value})} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', background: '#FFF' }}>
                      {EXPENSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500, color: '#334155' }}>Amount (PKR)</label>
                    <input type="number" required min="0" step="0.01" value={form.expense_amount} onChange={e => setForm({...form, expense_amount: e.target.value})} placeholder="0.00" style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px' }} />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500, color: '#334155' }}>Expense Date</label>
                  <input type="date" required value={form.expense_date} onChange={e => setForm({...form, expense_date: e.target.value})} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px' }} />
                </div>
              </div>

              <div style={{ marginTop: '32px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ padding: '10px 20px', background: '#F1F5F9', border: 'none', borderRadius: '8px', color: '#475569', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '10px 20px', background: '#3B82F6', border: 'none', borderRadius: '8px', color: '#FFF', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>{form.id ? 'Update Expense' : 'Save Expense'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
