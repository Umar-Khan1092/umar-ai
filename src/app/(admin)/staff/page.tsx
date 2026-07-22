'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Filter, MoreVertical, Edit, Download, Eye, UploadCloud } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase, adminSupabase } from '@/lib/supabase';
import { BulkUploadModal } from '@/components/ui/BulkUploadModal';
import '@/app/(admin)/staff/StaffRecords.css';

export const StaffRecords: React.FC = () => {
  const router = useRouter();
  const [staffList, setStaffList] = useState<any[]>([]);
  const [filteredStaff, setFilteredStaff] = useState<any[]>([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [salaryTypeFilter, setSalaryTypeFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const fetchStaff = async () => {
    try {
      const dbClient = adminSupabase || supabase;
      const { data, error } = await dbClient
        .from('staff')
        .select('*')
        .neq('status', 'Struck Off');
        
      if (error) throw error;
      
      setStaffList(data || []);
      setFilteredStaff(data || []);
    } catch (err) {
      console.error("Error fetching staff:", err);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  useEffect(() => {
    let result = staffList;

    if (searchQuery) {
      result = result.filter(s => 
        (s.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.cnic || '').toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (salaryTypeFilter) {
      result = result.filter(s => s.salary_type === salaryTypeFilter);
    }

    if (roleFilter) {
      result = result.filter(s => s.role === roleFilter);
    }

    setFilteredStaff(result);
  }, [searchQuery, salaryTypeFilter, roleFilter, staffList]);

  const handleStruckOff = async (staffId: string, staffName: string) => {
    if (window.confirm(`Are you sure you want to struck off ${staffName}?`)) {
      try {
        const dbClient = adminSupabase || supabase;
        const { error } = await dbClient
          .from('staff')
          .update({ status: 'Struck Off' })
          .eq('id', staffId);
          
        if (error) throw error;
        
        setStaffList(prev => prev.filter(s => s.id !== staffId));
        setActiveMenuId(null);
      } catch (err: any) {
        alert('Error: ' + err.message);
      }
    }
  };

  const generatePDF = (staff: any) => {
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text("Staff Record", 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);
    
    autoTable(doc, {
      startY: 40,
      head: [['Field', 'Details']],
      body: [
        ['Full Name', staff.name],
        ['CNIC', staff.cnic],
        ['Email', staff.username || '-'],
        ['WhatsApp', staff.phone || '-'],
        ['Qualification', staff.qualification],
        ['Experience', staff.experience],
        ['Joining Date', staff.joining_date],
        ['Salary Type', staff.salary_type],
        ['Salary', `PKR ${staff.salary}`],
        ['Advance Salary', staff.advance_salary],
        ['Advance Amount', staff.advance_amount || '-'],
        ['Status', staff.status]
      ],
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 5 },
      headStyles: { fillColor: [41, 128, 185] }
    });
    
    doc.save(`Staff_Record_${staff.name.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className="records-page">
      <div className="records-controls">
        <div className="search-box">
          <Search size={18} className="search-icon" />
          <div className="search-divider"></div>
          <input 
            type="text" 
            placeholder="Search students, staff, classes..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
        
        <div className="filters">
          <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => setIsBulkUploadOpen(true)}>
            <UploadCloud size={16} /> Import CSV
          </button>
          
          <div className="filter-group">
            <Filter size={16} className="filter-icon" />
            <select 
              value={salaryTypeFilter} 
              onChange={(e) => setSalaryTypeFilter(e.target.value)}
              className="filter-select"
            >
              <option value="">All Salary Types</option>
              <option value="Fixed">Fixed</option>
              <option value="Per Lecture">Per Lecture</option>
            </select>
          </div>
          
          <div className="filter-group">
            <Filter size={16} className="filter-icon" />
            <select 
              value={roleFilter} 
              onChange={(e) => setRoleFilter(e.target.value)}
              className="filter-select"
            >
              <option value="">All Roles</option>
              <option value="Teacher">Teacher</option>
              <option value="Admin">Admin</option>
              <option value="Principal">Principal</option>
              <option value="Accountant">Accountant</option>
              <option value="Clerk">Clerk</option>
              <option value="Peon">Peon</option>
              <option value="Guard">Guard</option>
              <option value="Sweeper">Sweeper</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>CNIC</th>
              <th>Qualification</th>
              <th>Experience</th>
              <th>Salary Type</th>
              <th>Salary (PKR)</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredStaff.length > 0 ? (
              filteredStaff.map(staff => (
                <tr key={staff.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div className="avatar">
                        {staff.profile_image_url ? (
                          <img src={`${staff.profile_image_url}`} alt={staff.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          staff.name.charAt(0)
                        )}
                      </div>
                      <span className="clickable-name" onClick={() => router.push(`/staff/profile/${staff.id}`)}>
                        {staff.name}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className={`status-badge ${staff.role === 'Admin' ? 'active' : 'inactive'}`} style={{ background: staff.role === 'Teacher' ? '#e0f2fe' : staff.role === 'Admin' ? '#fce7f3' : '#f1f5f9', color: staff.role === 'Teacher' ? '#0369a1' : staff.role === 'Admin' ? '#be185d' : '#475569' }}>
                      {staff.role || 'Teacher'}
                    </span>
                  </td>
                  <td>{staff.cnic}</td>
                  <td>{staff.qualification}</td>
                  <td>{staff.experience} Years</td>
                  <td>{staff.salary_type}</td>
                  <td>{staff.salary}</td>
                  <td>
                    <div className="action-buttons">
                      <button className="icon-btn" title="View Profile" onClick={() => router.push(`/staff/profile/${staff.id}`)} style={{ color: 'var(--color-primary)' }}>
                        <Eye size={16} />
                      </button>
                      <button className="icon-btn edit-btn" title="Edit" onClick={() => router.push(`/staff/edit/${staff.id}`)}>
                        <Edit size={16} />
                      </button>
                      <button className="icon-btn print-btn" title="Download PDF" onClick={() => generatePDF(staff)}>
                        <Download size={16} />
                      </button>
                      
                      <div className="menu-container">
                        <button 
                          className="icon-btn more-btn" 
                          title="More Options"
                          onClick={() => setActiveMenuId(activeMenuId === staff.id ? null : staff.id)}
                        >
                          <MoreVertical size={16} />
                        </button>
                        
                        {activeMenuId === staff.id && (
                          <div className="dropdown-menu">
                            <button 
                              className="dropdown-item danger"
                              onClick={() => handleStruckOff(staff.id, staff.name)}
                            >
                              Struck Off
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
                  No staff members found matching your criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <BulkUploadModal 
        isOpen={isBulkUploadOpen} 
        onClose={() => setIsBulkUploadOpen(false)} 
        entityType="staff" 
        onSuccess={fetchStaff} 
      />
    </div>
  );
};

export default StaffRecords;
