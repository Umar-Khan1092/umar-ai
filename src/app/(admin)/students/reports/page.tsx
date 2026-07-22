'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase, adminSupabase } from '@/lib/supabase';
import { Filter } from 'lucide-react';
import '@/app/(admin)/students/StudentRecords.css';

export default function StudentReports() {
  const [students, setStudents] = useState<any[]>([]);
  const [settingsClasses, setSettingsClasses] = useState<string[]>([]);
  
  const [classFilter, setClassFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [monthFilter, setMonthFilter] = useState('');

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

  const { activeCount, newAdmissionsCount, exStudentsCount } = useMemo(() => {
    let baseResult = students;
    
    if (classFilter) {
      baseResult = baseResult.filter(s => s.academic_class === classFilter);
    }
    
    // Active / Ex-Students
    const activeCount = baseResult.filter(s => s.status !== 'Ex-Students' && s.status !== 'Struck Off').length;
    const exStudentsCount = baseResult.filter(s => s.status === 'Ex-Students' || s.status === 'Struck Off').length;
    
    // Admissions filter
    let admissions = baseResult;
    if (fromDate) admissions = admissions.filter(s => s.admission_date >= fromDate);
    if (toDate) admissions = admissions.filter(s => s.admission_date <= toDate);
    if (monthFilter) {
      admissions = admissions.filter(s => s.admission_date && s.admission_date.startsWith(monthFilter));
    }
    const newAdmissionsCount = admissions.length;

    return { activeCount, newAdmissionsCount, exStudentsCount };
  }, [students, classFilter, fromDate, toDate, monthFilter]);

  return (
    <div className="records-page" style={{ padding: '24px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
      <h2 style={{ marginTop: '0', fontSize: '1.25rem', color: 'var(--color-text-main)', marginBottom: '24px' }}>
        Student Reports
      </h2>
      
      <div className="filters" style={{ flexWrap: 'wrap', gap: '16px', display: 'flex', marginBottom: '32px', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px' }}>
        <div className="filter-group">
          <Filter size={16} className="filter-icon" />
          <select 
            value={classFilter} 
            onChange={(e) => setClassFilter(e.target.value)}
            className="filter-select"
            style={{ padding: '8px 12px 8px 36px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
          >
            <option value="">All Registered Classes</option>
            {settingsClasses.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="filter-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px', color: '#475569', fontWeight: 500 }}>From:</span>
          <input 
            type="date" 
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="filter-select"
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
          />
        </div>

        <div className="filter-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px', color: '#475569', fontWeight: 500 }}>To:</span>
          <input 
            type="date" 
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="filter-select"
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
          />
        </div>
        
        <div className="filter-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', borderLeft: '1px solid #e2e8f0', paddingLeft: '16px' }}>
          <span style={{ fontSize: '14px', color: '#475569', fontWeight: 500 }}>Month/Year:</span>
          <input 
            type="month" 
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="filter-select"
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        <div className="kpi-badge" style={{ padding: '24px', borderRadius: '12px', minWidth: '200px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <span className="kpi-label" style={{ display: 'block', fontSize: '14px', color: '#64748b', marginBottom: '8px', fontWeight: 600 }}>TOTAL ACTIVE STUDENTS</span>
          <span className="kpi-value" style={{ fontSize: '32px', color: '#0f172a', fontWeight: 700 }}>{activeCount}</span>
        </div>
        
        <div className="kpi-badge" style={{ padding: '24px', borderRadius: '12px', minWidth: '200px', backgroundColor: '#dcfce7', border: '1px solid #bbf7d0' }}>
          <span className="kpi-label" style={{ display: 'block', fontSize: '14px', color: '#166534', marginBottom: '8px', fontWeight: 600 }}>NEW ADMISSIONS</span>
          <span className="kpi-value" style={{ fontSize: '32px', color: '#14532d', fontWeight: 700 }}>{newAdmissionsCount}</span>
        </div>
        
        <div className="kpi-badge" style={{ padding: '24px', borderRadius: '12px', minWidth: '200px', backgroundColor: '#fee2e2', border: '1px solid #fecaca' }}>
          <span className="kpi-label" style={{ display: 'block', fontSize: '14px', color: '#991b1b', marginBottom: '8px', fontWeight: 600 }}>EX-STUDENTS</span>
          <span className="kpi-value" style={{ fontSize: '32px', color: '#7f1d1d', fontWeight: 700 }}>{exStudentsCount}</span>
        </div>
      </div>
    </div>
  );
}
