'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase, adminSupabase } from '@/lib/supabase';
import { Filter, Users, UserPlus, UserMinus, Eye, X, TrendingUp } from 'lucide-react';


export default function StudentReports() {
  const [students, setStudents] = useState<any[]>([]);
  const [settingsClasses, setSettingsClasses] = useState<string[]>([]);
  
  const [classFilter, setClassFilter] = useState('');
  
  // Default to current month (YYYY-MM)
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [monthFilter, setMonthFilter] = useState(currentMonth);
  
  const [viewingRecords, setViewingRecords] = useState<'new_admissions' | 'ex_students' | null>(null);

  useEffect(() => {
    fetchStudents();

    const dbClient = adminSupabase || supabase;
    Promise.resolve(
      dbClient.from('settings').select('*').eq('key', 'app_settings').single()
    ).then(res => {
      if (res.data?.value) setSettingsClasses(res.data.value.classes || []);
    }).catch(err => console.error(err));
  }, []);

  const fetchStudents = async () => {
    try {
      const dbClient = adminSupabase || supabase;
      const { data, error } = await dbClient.from('students').select('*').order('name');
      if (error) throw error;
      if (data) setStudents(data);
    } catch (err) {
      console.error(err);
    }
  };

  const { activeCount, newAdmissions, exStudents, topClasses } = useMemo(() => {
    let baseResult = students;
    
    if (classFilter) {
      baseResult = baseResult.filter(s => s.academic_class === classFilter);
    }
    
    // Active / Ex-Students
    const activeCount = baseResult.filter(s => s.status !== 'Ex-Students' && s.status !== 'Struck Off').length;
    const exStudents = baseResult.filter(s => s.status === 'Ex-Students' || s.status === 'Struck Off');
    
    // Admissions filter
    let admissions = baseResult;
    if (monthFilter) {
      admissions = admissions.filter(s => s.admission_date && s.admission_date.startsWith(monthFilter));
    }

    // Top 6 classes where new admissions happened
    const classCounts: Record<string, number> = {};
    admissions.forEach(s => {
      if (s.academic_class) {
        classCounts[s.academic_class] = (classCounts[s.academic_class] || 0) + 1;
      }
    });

    const topClasses = Object.entries(classCounts)
      .map(([name, count]) => ({ name, count, percentage: ((count / (admissions.length || 1)) * 100).toFixed(1) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    return { activeCount, newAdmissions: admissions, exStudents, topClasses };
  }, [students, classFilter, monthFilter]);

  const recordList = viewingRecords === 'new_admissions' ? newAdmissions : 
                     viewingRecords === 'ex_students' ? exStudents : [];
                     
  const listTitle = viewingRecords === 'new_admissions' ? 'New Admissions' : 'Ex-Students';

  return (
    <div className="records-page" style={{ padding: '24px', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ marginTop: '0', fontSize: '1.5rem', color: '#0f172a', fontWeight: 700, marginBottom: '8px' }}>
            Student Reports
          </h2>
          <p style={{ margin: 0, color: '#64748b' }}>Overview and analytics for student enrollment.</p>
        </div>
      </div>
      
      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '32px', backgroundColor: '#ffffff', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
        <div className="filter-group" style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1', minWidth: '250px' }}>
          <div style={{ padding: '8px', backgroundColor: '#e0e7ff', borderRadius: '8px', color: '#4338ca' }}>
            <Filter size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>REGISTERED CLASS</label>
            <select 
              value={classFilter} 
              onChange={(e) => setClassFilter(e.target.value)}
              className="filter-select"
              style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', width: '100%', outline: 'none', transition: 'border-color 0.2s', backgroundColor: '#f8fafc' }}
            >
              <option value="">All Classes</option>
              {settingsClasses.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="filter-group" style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1', minWidth: '250px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>ADMISSION MONTH & YEAR</label>
            <input 
              type="month" 
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="filter-select"
              style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', width: '100%', outline: 'none', transition: 'border-color 0.2s', backgroundColor: '#f8fafc' }}
            />
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        <div style={{ padding: '24px', borderRadius: '16px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-10px', right: '-10px', color: '#f1f5f9', zIndex: 0 }}>
            <Users size={120} />
          </div>
          <div style={{ zIndex: 1 }}>
            <span style={{ display: 'block', fontSize: '13px', color: '#64748b', marginBottom: '8px', fontWeight: 600, letterSpacing: '0.05em' }}>TOTAL ACTIVE STUDENTS</span>
            <span style={{ fontSize: '36px', color: '#0f172a', fontWeight: 800 }}>{activeCount}</span>
          </div>
        </div>
        
        <div style={{ padding: '24px', borderRadius: '16px', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', boxShadow: '0 4px 12px rgba(16,185,129,0.05)', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-10px', right: '-10px', color: '#d1fae5', zIndex: 0 }}>
            <UserPlus size={120} />
          </div>
          <div style={{ zIndex: 1 }}>
            <span style={{ display: 'block', fontSize: '13px', color: '#065f46', marginBottom: '8px', fontWeight: 600, letterSpacing: '0.05em' }}>NEW ADMISSIONS</span>
            <span style={{ fontSize: '36px', color: '#047857', fontWeight: 800 }}>{newAdmissions.length}</span>
            <div style={{ marginTop: '16px' }}>
              <button onClick={() => setViewingRecords('new_admissions')} style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#10b981', color: 'white', padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '13px', transition: 'background-color 0.2s' }}>
                <Eye size={16} /> View Records
              </button>
            </div>
          </div>
        </div>
        
        <div style={{ padding: '24px', borderRadius: '16px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', boxShadow: '0 4px 12px rgba(239,68,68,0.05)', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-10px', right: '-10px', color: '#fee2e2', zIndex: 0 }}>
            <UserMinus size={120} />
          </div>
          <div style={{ zIndex: 1 }}>
            <span style={{ display: 'block', fontSize: '13px', color: '#991b1b', marginBottom: '8px', fontWeight: 600, letterSpacing: '0.05em' }}>EX-STUDENTS</span>
            <span style={{ fontSize: '36px', color: '#b91c1c', fontWeight: 800 }}>{exStudents.length}</span>
            <div style={{ marginTop: '16px' }}>
              <button onClick={() => setViewingRecords('ex_students')} style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#ef4444', color: 'white', padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '13px', transition: 'background-color 0.2s' }}>
                <Eye size={16} /> View Records
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Top Classes Analytics */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
        <h3 style={{ margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '10px', color: '#0f172a', fontSize: '1.1rem' }}>
          <TrendingUp size={20} color="#3b82f6" /> Top Classes by New Admissions
        </h3>
        
        {topClasses.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
            {topClasses.map((item, idx) => (
              <div key={idx} style={{ padding: '16px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, color: '#334155', marginBottom: '4px' }}>{item.name}</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>{item.count} students</div>
                </div>
                <div style={{ backgroundColor: '#dbeafe', color: '#1d4ed8', padding: '6px 10px', borderRadius: '20px', fontWeight: 700, fontSize: '12px' }}>
                  {item.percentage}%
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
            No new admissions found for the selected filters.
          </div>
        )}
      </div>

      {/* Records Modal */}
      {viewingRecords && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '900px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a' }}>{listTitle} Records</h3>
              <button onClick={() => setViewingRecords(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}>
                <X size={24} />
              </button>
            </div>
            
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
              {recordList.length > 0 ? (
                <div className="table-responsive" style={{ margin: 0, borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ backgroundColor: '#f8fafc' }}>
                      <tr>
                        <th style={{ padding: '12px 16px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: '13px', borderBottom: '1px solid #e2e8f0' }}>Roll No</th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: '13px', borderBottom: '1px solid #e2e8f0' }}>Name</th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: '13px', borderBottom: '1px solid #e2e8f0' }}>Father Name</th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: '13px', borderBottom: '1px solid #e2e8f0' }}>Class</th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: '13px', borderBottom: '1px solid #e2e8f0' }}>Section</th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: '13px', borderBottom: '1px solid #e2e8f0' }}>Admission Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recordList.map(s => (
                        <tr key={s.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '12px 16px', color: '#334155' }}>{s.roll_no || '-'}</td>
                          <td style={{ padding: '12px 16px', color: '#0f172a', fontWeight: 500 }}>{s.name}</td>
                          <td style={{ padding: '12px 16px', color: '#475569' }}>{s.father_name || '-'}</td>
                          <td style={{ padding: '12px 16px', color: '#334155' }}>{s.academic_class}</td>
                          <td style={{ padding: '12px 16px', color: '#334155' }}>{s.section || '-'}</td>
                          <td style={{ padding: '12px 16px', color: '#334155' }}>
                            {s.admission_date ? new Date(s.admission_date).toLocaleDateString('en-GB') : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                  No records found.
                </div>
              )}
            </div>
            
            <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', backgroundColor: '#f8fafc', borderRadius: '0 0 16px 16px' }}>
              <button onClick={() => setViewingRecords(null)} style={{ padding: '10px 24px', backgroundColor: '#e2e8f0', color: '#0f172a', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
