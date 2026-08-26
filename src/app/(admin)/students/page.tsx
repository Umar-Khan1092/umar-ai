'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, Filter, MoreVertical, Edit, Download, Eye, UploadCloud, ArrowLeft, X, User, Users, GraduationCap } from 'lucide-react';
import { BulkUploadModal } from '@/components/ui/BulkUploadModal';
import { HighlightText } from '@/components/ui/HighlightText';
import { formatDate } from '@/utils/formatDate';
import { supabase, adminSupabase } from '@/lib/supabase';



interface ClassGroup {
  className: string;
  section: string;
  studentCount: number;
}

export const StudentRecords: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams?.get('q') || '';
  const urlClass = searchParams?.get('class');
  const urlSection = searchParams?.get('section');
  
  const [students, setStudents] = useState<any[]>([]);
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<ClassGroup[]>([]);
  
  const [selectedClassGroup, setSelectedClassGroup] = useState<ClassGroup | null>(null);

  const [searchInput, setSearchInput] = useState(initialQuery);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [classFilter, setClassFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [settingsClasses, setSettingsClasses] = useState<string[]>([]);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const [drawerStudent, setDrawerStudent] = useState<any | null>(null);

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchQuery(searchInput);
      if (searchInput.trim() !== '' && !selectedClassGroup) {
        router.replace(`/students?q=${encodeURIComponent(searchInput)}`);
      } else if (!selectedClassGroup) {
        router.replace('/students');
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput, selectedClassGroup, router]);

  const fetchStudents = async () => {
    try {
      setIsLoading(true);
      const dbClient = adminSupabase || supabase;
      const { data, error } = await dbClient.from('students').select('*').order('name');
      if (error) throw error;
      
      if (data) {
        setStudents(data);
        
        // Build class groups
        const activeData = data.filter((s: any) => s.status !== 'Ex-Students' && s.status !== 'Struck Off');
        const groups: Record<string, ClassGroup> = {};
        activeData.forEach((student: any) => {
          const className = student.academic_class || 'Unknown';
          const section = student.section || 'Unknown';
          const key = `${className}-${section}`;
          if (!groups[key]) groups[key] = { className, section, studentCount: 0 };
          groups[key].studentCount += 1;
        });

        const sortedGroups = Object.values(groups).sort((a, b) => {
          if (a.className === b.className) return a.section.localeCompare(b.section);
          return a.className.localeCompare(b.className);
        });

        setClassGroups(sortedGroups);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
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

  // Auto-select class group if URL params are present
  useEffect(() => {
    if (classGroups.length > 0 && urlClass && urlSection && !selectedClassGroup) {
      const match = classGroups.find(g => g.className === urlClass && g.section === urlSection);
      if (match) setSelectedClassGroup(match);
    }
  }, [classGroups, urlClass, urlSection, selectedClassGroup]);

  // Filter groups
  useEffect(() => {
    let result = classGroups;
    if (searchQuery && !selectedClassGroup) {
      result = result.filter(g => 
        g.className.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.section.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    if (classFilter && !selectedClassGroup) result = result.filter(g => g.className === classFilter);
    if (sectionFilter && !selectedClassGroup) result = result.filter(g => g.section === sectionFilter);
    setFilteredGroups(result);
  }, [searchQuery, classFilter, sectionFilter, classGroups, selectedClassGroup]);

  // Derived students for table view
  const { filteredStudents, metrics } = useMemo(() => {
    let baseResult = students;
    
    if (selectedClassGroup) {
      baseResult = baseResult.filter(s => 
        s.academic_class === selectedClassGroup.className && 
        s.section === selectedClassGroup.section
      );
    } else if (classFilter) {
      baseResult = baseResult.filter(s => s.academic_class === classFilter);
    }
    
    const activeCount = baseResult.filter(s => s.status !== 'Ex-Students' && s.status !== 'Struck Off').length;
    const exStudentsCount = baseResult.filter(s => s.status === 'Ex-Students' || s.status === 'Struck Off').length;
    
    let tableResult = baseResult.filter(s => s.status !== 'Ex-Students' && s.status !== 'Struck Off');
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
      metrics: { activeCount, exStudentsCount }
    };
  }, [students, searchQuery, classFilter, selectedClassGroup]);

  const handleStruckOff = async (studentId: string, studentName: string) => {
    if (window.confirm(`Are you sure you want to move ${studentName} to Ex-Students?`)) {
      try {
        const dbClient = adminSupabase || supabase;
        const { error } = await dbClient.from('students').update({ status: 'Ex-Students' }).eq('id', studentId);
        if (error) throw error;
        await fetchStudents();
        setActiveMenuId(null);
      } catch (err) {
        alert('Error: ' + (err as Error).message);
      }
    }
  };

  const generatePDF = useCallback(async (student: any) => {
    const { jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text("Student Record", 14, 22);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);
    autoTable(doc, {
      startY: 40,
      head: [['Field', 'Details']],
      body: [
        ['Full Name', student.name],
        ["Father's Name", student.father_name],
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

  const availableSections = Array.from(new Set(
    classGroups.filter(g => !classFilter || g.className === classFilter).map(g => g.section)
  )).sort();

  return (
    <div className="records-page fill-vertical-space" style={{ position: 'relative' }}>
      
      {/* ── CLASS GROUPS VIEW ── */}
      {!selectedClassGroup && (
        <div className="student-classes-page fill-vertical-space" style={{ padding: '0 0 24px 0', overflowY: 'auto' }}>
          <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h2 style={{ fontSize: '1.5rem', color: 'var(--color-text-main)', margin: '0 0 8px 0' }}>Classes & Sections</h2>
              <p className="subtitle" style={{ margin: 0, color: 'var(--color-text-muted)' }}>Select a class to view its enrolled students.</p>
            </div>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <div className="stat-card" style={{ padding: '12px 20px', backgroundColor: '#eff6ff', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
                <span className="stat-value" style={{ display: 'block', fontSize: '1.25rem', fontWeight: 700, color: '#1d4ed8' }}>
                  {classGroups.reduce((sum, g) => sum + g.studentCount, 0)}
                </span>
                <span className="stat-label" style={{ fontSize: '0.875rem', color: '#3b82f6', fontWeight: 600 }}>Total Active Students</span>
              </div>
            </div>
          </div>

          <div className="filters-bar horizontal-scroll-mobile" style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap', backgroundColor: '#fff', padding: '16px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div className="search-input-wrapper" style={{ flex: 1, minWidth: '250px', position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search classes or sections..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                style={{ width: '100%', padding: '10px 10px 10px 36px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
              />
            </div>
            <div className="filter-select-wrapper">
              <select value={classFilter} onChange={e => { setClassFilter(e.target.value); setSectionFilter(''); }} style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', outline: 'none' }}>
                <option value="">All Classes</option>
                {Array.from(new Set(classGroups.map(g => g.className))).sort().map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="filter-select-wrapper">
              <select value={sectionFilter} onChange={e => setSectionFilter(e.target.value)} style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', outline: 'none' }}>
                <option value="">All Sections</option>
                {availableSections.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="class-cards-grid">
            {isLoading ? (
              <div style={{ gridColumn: '1 / -1', padding: '48px', textAlign: 'center', color: '#64748b' }}>
                <div style={{ display: 'inline-block', width: '24px', height: '24px', border: '3px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                <div style={{ marginTop: '12px' }}>Loading classes...</div>
              </div>
            ) : filteredGroups.map(group => (
              <div key={`${group.className}-${group.section}`} className="class-card" style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', transition: 'all 0.2s', cursor: 'pointer', position: 'relative', overflow: 'hidden' }} onClick={() => setSelectedClassGroup(group)}>
                <div style={{ position: 'absolute', top: '-15px', right: '-15px', color: '#f1f5f9', zIndex: 0 }}>
                  <GraduationCap size={100} />
                </div>
                <div style={{ position: 'relative', zIndex: 1, textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <div className="class-icon" style={{ backgroundColor: '#eff6ff', color: '#3b82f6', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Users size={24} />
                    </div>
                    <div className="student-count-badge" style={{ backgroundColor: '#f0fdf4', color: '#166534', padding: '6px 12px', borderRadius: '20px', fontSize: '0.875rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid #bbf7d0' }}>
                      <Users size={14} /> {group.studentCount} Active
                    </div>
                  </div>
                  <h3 className="class-name" style={{ margin: '0 0 4px 0', fontSize: '1.25rem', color: '#0f172a', fontWeight: 700 }}>
                    <HighlightText text={group.className} highlight={searchQuery} />
                  </h3>
                  <div className="section-name" style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 500 }}>
                    Section <HighlightText text={group.section} highlight={searchQuery} />
                  </div>
                  <div style={{ marginTop: '20px', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                    <button style={{ backgroundColor: 'transparent', color: '#3b82f6', border: 'none', padding: 0, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      View Records <ArrowLeft size={16} style={{ transform: 'rotate(180deg)' }} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {filteredGroups.length === 0 && (
              <div className="empty-state" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '48px', backgroundColor: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                <GraduationCap size={48} style={{ color: '#cbd5e1', margin: '0 auto 16px' }} />
                <h3 style={{ margin: '0 0 8px', color: '#334155' }}>No Classes Found</h3>
                <p style={{ color: '#64748b', margin: 0 }}>Try adjusting your search or filters.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TABLE VIEW ── */}
      {selectedClassGroup && (
        <div style={{ animation: 'fadeIn 0.3s' }}>
          <div style={{ marginBottom: '16px' }}>
            <button 
              className="btn-primary" 
              onClick={() => setSelectedClassGroup(null)} 
              style={{ marginBottom: '16px', backgroundColor: '#e2e8f0', color: '#0f172a', display: 'flex', alignItems: 'center', width: 'fit-content' }}
            >
              <ArrowLeft size={16} style={{ marginRight: '8px' }} />
              Back to Classes
            </button>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ marginTop: '0', fontSize: '1.5rem', color: 'var(--color-text-main)', fontWeight: 700 }}>
                  Students in {selectedClassGroup.className} - {selectedClassGroup.section}
                </h2>
              </div>
              <div style={{ display: 'flex', gap: '16px' }}>
                <div className="kpi-badge">
                  <span className="kpi-label">Active Students</span>
                  <span className="kpi-value">{metrics.activeCount}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="records-controls" style={{ flexWrap: 'wrap' }}>
            <div className="search-box">
              <Search size={18} className="search-icon" />
              <input 
                type="text" 
                placeholder="Search students..." 
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="search-input"
              />
            </div>
            
            <div className="filters" style={{ flexWrap: 'wrap', gap: '12px', display: 'flex' }}>
              <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => setIsBulkUploadOpen(true)}>
                <UploadCloud size={16} /> Import CSV
              </button>
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
        </div>
      )}

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
