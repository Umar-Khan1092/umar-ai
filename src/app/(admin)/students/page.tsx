'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search, Filter, MoreVertical, Edit, Download, Eye, UploadCloud, ArrowLeft, X, User } from 'lucide-react';
import { BulkUploadModal } from '@/components/ui/BulkUploadModal';
import { HighlightText } from '@/components/ui/HighlightText';
import { formatDate } from '@/utils/formatDate';
import { supabase, adminSupabase } from '@/lib/supabase';
import '@/app/(admin)/students/StudentRecords.css';


export const StudentRecords: React.FC = () => {
  const router = useRouter();
  const params = useParams();
  const className = typeof params?.className === 'string' ? params.className : undefined;
  const sectionName = typeof params?.sectionName === 'string' ? params.sectionName : undefined;
  const [students, setStudents] = useState<any[]>([]);
  
  const pathname = usePathname() ?? '';
  const searchParams = useSearchParams();
  const initialQuery = searchParams?.get('q') || '';
  
  const [searchInput, setSearchInput] = useState(initialQuery);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [classFilter, setClassFilter] = useState('');
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  
  const [settingsClasses, setSettingsClasses] = useState<string[]>([]);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Drawer state
  const [drawerStudent, setDrawerStudent] = useState<any | null>(null);


  // Debounce Search
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchQuery(searchInput);
      if (!className && !sectionName) {
        if (searchInput.trim() !== '') {
          router.replace(`/students?q=${encodeURIComponent(searchInput)}`);
        } else if (pathname === '/students') {
          router.replace('/students');
        }
      }
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [searchInput, className, sectionName, pathname, router]);

  const fetchStudents = async () => {
    try {
      const dbClient = adminSupabase || supabase;
      const { data, error } = await dbClient.from('students').select('*').order('name');
      if (error) throw error;
      
      if (data) {
        let allStudents = data;
        
        if (className && sectionName) {
          allStudents = allStudents.filter((s: any) => 
            s.academic_class === className && s.section === sectionName
          );
        }

        setStudents(allStudents);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchStudents();

    const dbClient = adminSupabase || supabase;
    Promise.resolve(
      dbClient.from('settings').select('*').eq('key', 'app_settings').single()
    ).then(res => {
      if (res.data?.value) setSettingsClasses(res.data.value.classes || []);
    }).catch(err => console.error(err));
  }, []);

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // ── Derived: filter students via useMemo (no extra state/effect needed) ──
  const { filteredStudents, metrics } = useMemo(() => {
    let baseResult = students;
    
    if (classFilter) {
      baseResult = baseResult.filter(s => s.academic_class === classFilter);
    }
    
    // Metrics
    const activeCount = baseResult.filter(s => s.status !== 'Ex-Students').length;
    const exStudentsCount = baseResult.filter(s => s.status === 'Ex-Students').length;
    
    let admissions = baseResult;
    if (fromDate) admissions = admissions.filter(s => s.admission_date >= fromDate);
    if (toDate) admissions = admissions.filter(s => s.admission_date <= toDate);
    const newAdmissionsCount = admissions.length;

    // Search filter for table
    let tableResult = baseResult.filter(s => s.status !== 'Ex-Students'); // Main table shows only active
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      tableResult = tableResult.filter(s =>
        s.name.toLowerCase().includes(q) ||
        (s.father_name && s.father_name.toLowerCase().includes(q)) ||
        (s.roll_number && s.roll_number.toLowerCase().includes(q))
      );
    }

    return { 
      filteredStudents: tableResult,
      metrics: { activeCount, exStudentsCount, newAdmissionsCount }
    };
  }, [students, searchQuery, classFilter, fromDate, toDate]);


  const handleStruckOff = async (studentId: string, studentName: string) => {
    if (window.confirm(`Are you sure you want to move ${studentName} to Ex-Students?`)) {
      try {
        const dbClient = adminSupabase || supabase;
        const { error } = await dbClient.from('students').update({ status: 'Ex-Students' }).eq('id', studentId);
        
        if (error) throw error;
        
        // Remove from current list
        setStudents(prev => prev.filter(s => s.id !== studentId));
        setActiveMenuId(null);
      } catch (err) {
        alert('Error: ' + (err as Error).message);
      }
    }
  };

  // ── Generate PDF — dynamically import jsPDF to keep initial bundle lean ──
  const generatePDF = useCallback(async (student: any) => {
    const { jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.text("Student Record", 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);
    
    // Student Info Details
    autoTable(doc, {
      startY: 40,
      head: [['Field', 'Details']],
      body: [
        ['Full Name', student.name],
        ['Father\'s Name', student.father_name],
        ['Roll Number', student.roll_number || 'N/A'],
        ['CNIC / B-Form', student.cnic],
        ['Date of Birth', formatDate(student.dob)],
        ['Gender', student.gender],
        ['Class', student.academic_class],
        ['Section', student.section],
        ['Guardian WhatsApp', student.guardian_whatsapp || 'N/A'],
        ['Admission Date', formatDate(student.admission_date)],
        ['Monthly Fee', `PKR ${student.monthly_fee}`],
        ['Registration Fee Status', student.registration_fee_status],
        ['Advance Fee Months', student.advance_fee_months],
        ['Status', student.status]
      ],
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 5 },
      headStyles: { fillColor: [41, 128, 185] }
    });
    
    doc.save(`Student_Record_${student.name.replace(/\s+/g, '_')}.pdf`);
  }, []);



  return (
    <div className="records-page">
      {className && sectionName && (
        <div style={{ marginBottom: '16px' }}>
          <button 
            className="btn-primary" 
            onClick={() => router.push('/classes')} 
            style={{ marginBottom: '16px', backgroundColor: '#e2e8f0', color: '#0f172a', display: 'flex', alignItems: 'center', width: 'fit-content' }}
          >
            <ArrowLeft size={16} style={{ marginRight: '8px' }} />
            Back to Classes
          </button>
          
          <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ marginTop: '0', fontSize: '1.25rem', color: 'var(--color-text-main)' }}>
                {className && sectionName ? `Students in ${className} - Section ${sectionName}` : 'Global Student Search'}
              </h2>
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div className="kpi-badge">
                <span className="kpi-label">Active Students</span>
                <span className="kpi-value">{activeStudentsCount}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {(!className || !sectionName) && (
        <div style={{ marginBottom: '16px' }}>
          <button 
            className="btn-primary" 
            onClick={() => router.push('/classes')} 
            style={{ marginBottom: '16px', backgroundColor: '#e2e8f0', color: '#0f172a', display: 'flex', alignItems: 'center', width: 'fit-content' }}
          >
            <ArrowLeft size={16} style={{ marginRight: '8px' }} />
            Back to Classes
          </button>
          <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h2 style={{ marginTop: '0', fontSize: '1.25rem', color: 'var(--color-text-main)' }}>
                Global Student Search
              </h2>
            </div>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <div className="kpi-badge">
                <span className="kpi-label">Total Active Students</span>
                <span className="kpi-value">{metrics.activeCount}</span>
              </div>
              <div className="kpi-badge" style={{ backgroundColor: '#dcfce7', color: '#166534' }}>
                <span className="kpi-label">New Admissions</span>
                <span className="kpi-value">{metrics.newAdmissionsCount}</span>
              </div>
              <div className="kpi-badge" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
                <span className="kpi-label">Ex-Students</span>
                <span className="kpi-value">{metrics.exStudentsCount}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="records-controls" style={{ flexWrap: 'wrap' }}>
        <div className="search-box">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search students, staff, classes..." 
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="search-input"
          />
        </div>
        
        <div className="filters" style={{ flexWrap: 'wrap', gap: '12px', display: 'flex' }}>
          <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => setIsBulkUploadOpen(true)}>
            <UploadCloud size={16} /> Import CSV
          </button>
          
          <div className="filter-group">
            <span style={{ fontSize: '12px', color: '#64748b' }}>From:</span>
            <input 
              type="date" 
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="filter-select"
            />
          </div>

          <div className="filter-group">
            <span style={{ fontSize: '12px', color: '#64748b' }}>To:</span>
            <input 
              type="date" 
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="filter-select"
            />
          </div>

          {!className && (
            <div className="filter-group">
              <Filter size={16} className="filter-icon" />
              <select 
                value={classFilter} 
                onChange={(e) => setClassFilter(e.target.value)}
                className="filter-select"
              >
                <option value="">All Classes</option>
                {settingsClasses.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>


      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Roll No.</th>
              <th>Student Name</th>
              <th>Father's Name</th>
              <th>Class</th>
              <th>Section</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.length > 0 ? (
              filteredStudents.map(student => (
                <tr key={student.id}>
                  <td>
                    <HighlightText text={student.roll_number || '-'} highlight={searchQuery} />
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div className="avatar">
                        {student.profile_image_url ? (
                          <img src={`${student.profile_image_url}`} alt={student.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <User size={16} />
                        )}
                      </div>
                      <span className="clickable-name" onClick={() => setDrawerStudent(student)}>
                        <HighlightText text={student.name} highlight={searchQuery} />
                      </span>
                    </div>
                  </td>
                  <td>
                    <HighlightText text={student.father_name} highlight={searchQuery} />
                  </td>
                  <td>{student.academic_class}</td>
                  <td>{student.section}</td>
                  <td>
                    <div className="action-buttons">
                      <button className="icon-btn primary-action" title="Preview Profile" onClick={() => setDrawerStudent(student)}>
                        <Eye size={16} />
                      </button>
                      <button className="icon-btn" title="Edit" onClick={() => router.push(`/students/edit/${student.id}`)}>
                        <Edit size={16} />
                      </button>
                      <button className="icon-btn" title="Download PDF" onClick={() => generatePDF(student)}>
                        <Download size={16} />
                      </button>
                      
                      <div className="menu-container">
                        <button 
                          className="icon-btn more-btn" 
                          title="More Options"
                          onClick={() => setActiveMenuId(activeMenuId === student.id ? null : student.id)}
                        >
                          <MoreVertical size={16} />
                        </button>
                        
                        {activeMenuId === student.id && (
                          <div className="dropdown-menu">
                            <button 
                              className="dropdown-item danger"
                              onClick={() => handleStruckOff(student.id, student.name)}
                            >
                              Ex-Students
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>
                  No students found matching your criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <BulkUploadModal 
        isOpen={isBulkUploadOpen} 
        onClose={() => setIsBulkUploadOpen(false)} 
        entityType="student" 
        onSuccess={fetchStudents} 
      />

      {/* Slide-over Drawer */}
      <div className={`drawer-overlay ${drawerStudent ? 'open' : ''}`} onClick={() => setDrawerStudent(null)}></div>
      <div className={`drawer-panel ${drawerStudent ? 'open' : ''}`}>
        <div className="drawer-header">
          <h3>Student Preview</h3>
          <button className="drawer-close-btn" onClick={() => setDrawerStudent(null)}>
            <X size={20} />
          </button>
        </div>
        {drawerStudent && (
          <div className="drawer-content">
            <div className="drawer-profile-header">
              <div className="drawer-avatar">
                {drawerStudent.name.charAt(0)}
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '20px', color: '#0f172a' }}>{drawerStudent.name}</h3>
                <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>{drawerStudent.roll_number || 'N/A'}</p>
              </div>
            </div>
            
            <div className="drawer-info-group">
              <div className="drawer-info-label">Father's Name</div>
              <div className="drawer-info-value">{drawerStudent.father_name}</div>
            </div>
            
            <div className="drawer-info-group">
              <div className="drawer-info-label">Class & Section</div>
              <div className="drawer-info-value">{drawerStudent.academic_class} - Section {drawerStudent.section}</div>
            </div>
            
            <div className="drawer-info-group">
              <div className="drawer-info-label">Guardian WhatsApp</div>
              <div className="drawer-info-value">{drawerStudent.guardian_whatsapp || 'N/A'}</div>
            </div>
            
            <div className="drawer-info-group">
              <div className="drawer-info-label">Date of Birth</div>
              <div className="drawer-info-value">{formatDate(drawerStudent.dob)}</div>
            </div>
            
            <div className="drawer-info-group">
              <div className="drawer-info-label">Monthly Fee</div>
              <div className="drawer-info-value">PKR {drawerStudent.monthly_fee}</div>
            </div>
            
            <div className="drawer-info-group">
              <div className="drawer-info-label">Registration Fee Status</div>
              <div className="drawer-info-value">
                <span className={`status-badge ${drawerStudent.registration_fee_status === 'Paid' ? 'success' : 'warning'}`}>
                  {drawerStudent.registration_fee_status || 'Pending'}
                </span>
              </div>
            </div>
          </div>
        )}
        {drawerStudent && (
          <div className="drawer-footer">
            <button className="btn-primary" onClick={() => router.push(`/students/profile/${drawerStudent.id}`)}>
              View Full Profile
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentRecords;
