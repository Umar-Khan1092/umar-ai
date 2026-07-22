'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Filter, MoreVertical, Edit, Download, Eye } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/lib/supabase';
import '@/app/(admin)/students/StudentRecords.css';

export const StruckOffStudents: React.FC = () => {
  const router = useRouter();
  const [students, setStudents] = useState<any[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<any[]>([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [feeStatusFilter, setFeeStatusFilter] = useState('');
  
  const [settingsClasses, setSettingsClasses] = useState<string[]>([]);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    supabase.from('students').select('*').in('status', ['Ex-Students', 'Struck Off']).then(res => {
      if (res.data) {
        setStudents(res.data);
        setFilteredStudents(res.data);
      }
    });

    supabase.from('settings').select('*').eq('key', 'app_settings').single().then(res => {
      if (res.data && res.data.value) {
        setSettingsClasses(res.data.value.classes || []);
      }
    });
  }, []);

  useEffect(() => {
    let result = students;

    if (searchQuery) {
      result = result.filter(s => 
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.father_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.roll_number && s.roll_number.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    if (classFilter) {
      result = result.filter(s => s.academic_class === classFilter);
    }

    if (feeStatusFilter) {
      result = result.filter(s => s.registration_fee_status === feeStatusFilter);
    }

    setFilteredStudents(result);
  }, [searchQuery, classFilter, feeStatusFilter, students]);

  const handleRestore = async (studentId: string, studentName: string) => {
    if (window.confirm(`Are you sure you want to restore ${studentName}? This will move them back to active Student Records.`)) {
      try {
        const { error } = await supabase.from('students').update({ status: 'Active' }).eq('id', studentId);
        
        if (error) throw error;
        
        // Remove from current list
        setStudents(prev => prev.filter(s => s.id !== studentId));
        setActiveMenuId(null);
      } catch (err: any) {
        alert('Error: ' + err.message);
      }
    }
  };

  const toggleStudent = (id: string) => {
    const newSet = new Set(selectedStudentIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedStudentIds(newSet);
  };

  const toggleAll = () => {
    if (selectedStudentIds.size === filteredStudents.length && filteredStudents.length > 0) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(filteredStudents.map(s => s.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedStudentIds.size === 0) return;
    if (!window.confirm(`Are you sure you want to PERMANENTLY delete ${selectedStudentIds.size} students? This cannot be undone.`)) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('students').delete().in('id', Array.from(selectedStudentIds));
      if (error) throw error;
      
      setStudents(prev => prev.filter(s => !selectedStudentIds.has(s.id)));
      setSelectedStudentIds(new Set());
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteIndividual = async (studentId: string, studentName: string) => {
    if (window.confirm(`Are you sure you want to PERMANENTLY delete ${studentName}? This cannot be undone.`)) {
      try {
        const { error } = await supabase.from('students').delete().eq('id', studentId);
        if (error) throw error;
        
        setStudents(prev => prev.filter(s => s.id !== studentId));
        setActiveMenuId(null);
      } catch (err: any) {
        alert('Error: ' + err.message);
      }
    }
  };

  const generatePDF = (student: any) => {
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
        ['Date of Birth', student.dob],
        ['Gender', student.gender],
        ['Class', student.academic_class],
        ['Section', student.section],
        ['Admission Date', student.admission_date],
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
  };

  return (
    <div className="records-page">
      <div className="records-header">
        <div>
          <h1 className="section-heading" style={{ marginBottom: '4px' }}>Ex-Students</h1>
          <p className="body-text">View and manage inactive or struck-off students.</p>
        </div>
      </div>

      <div className="records-controls card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div className="search-box">
            <Search size={18} className="search-icon" />
            <div className="search-divider"></div>
            <input 
              type="text" 
              placeholder="Search by name, father name, or roll no..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
          
          <div className="filters">
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
            
            <div className="filter-group">
              <select 
                value={feeStatusFilter} 
                onChange={(e) => setFeeStatusFilter(e.target.value)}
                className="filter-select"
              >
                <option value="">All Fee Status</option>
                <option value="Paid">Paid</option>
                <option value="Pending">Pending</option>
              </select>
            </div>
          </div>
        </div>

        {selectedStudentIds.size > 0 && (
          <button 
            className="btn-primary" 
            style={{ backgroundColor: 'var(--color-danger)' }}
            onClick={handleBulkDelete}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : `Delete Selected (${selectedStudentIds.size})`}
          </button>
        )}
      </div>

      <div className="table-container card">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '40px', textAlign: 'center' }}>
                <input 
                  type="checkbox" 
                  checked={selectedStudentIds.size > 0 && selectedStudentIds.size === filteredStudents.length}
                  onChange={toggleAll}
                  style={{ cursor: 'pointer' }}
                />
              </th>
              <th>Roll No.</th>
              <th>Student Name</th>
              <th>Father's Name</th>
              <th>Class</th>
              <th>Section</th>
              <th>Fee Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.length > 0 ? (
              filteredStudents.map(student => (
                <tr key={student.id} onClick={() => toggleStudent(student.id)} style={{ cursor: 'pointer', backgroundColor: selectedStudentIds.has(student.id) ? 'transparent' : 'var(--color-surface-hover)' }}>
                  <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                    <input 
                      type="checkbox" 
                      checked={selectedStudentIds.has(student.id)} 
                      onChange={() => toggleStudent(student.id)}
                      style={{ cursor: 'pointer' }}
                    />
                  </td>
                  <td>{student.roll_number || '-'}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div className="avatar">
                        {student.profile_image_url ? (
                          <img src={`${student.profile_image_url}`} alt={student.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          student.name.charAt(0)
                        )}
                      </div>
                      <span className="clickable-name" onClick={() => router.push(`/students/profile/${student.id}`)}>
                        {student.name}
                      </span>
                    </div>
                  </td>
                  <td>{student.father_name}</td>
                  <td>{student.academic_class}</td>
                  <td>{student.section}</td>
                  <td>
                    <span className={`status-badge ${student.registration_fee_status === 'Paid' ? 'success' : 'warning'}`}>
                      {student.registration_fee_status || 'Pending'}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button className="icon-btn" title="View Profile" onClick={() => router.push(`/students/profile/${student.id}`)} style={{ color: 'var(--color-primary)' }}>
                        <Eye size={16} />
                      </button>
                      <button className="icon-btn edit-btn" title="Edit" onClick={() => router.push(`/students/edit/${student.id}`)}>
                        <Edit size={16} />
                      </button>
                      <button className="icon-btn print-btn" title="Download PDF" onClick={() => generatePDF(student)}>
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
                              className="dropdown-item"
                              style={{ color: 'var(--color-primary)' }}
                              onClick={(e) => { e.stopPropagation(); handleRestore(student.id, student.name); }}
                            >
                              Restore (Mark Active)
                            </button>
                            <button 
                              className="dropdown-item"
                              style={{ color: 'var(--color-danger)' }}
                              onClick={(e) => { e.stopPropagation(); handleDeleteIndividual(student.id, student.name); }}
                            >
                              Delete Permanently
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
                <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>
                  No students found matching your criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StruckOffStudents;
