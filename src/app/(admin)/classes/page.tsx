'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, GraduationCap, Search, Filter } from 'lucide-react';
import '@/app/(admin)/classes/StudentClasses.css';
import { supabase, adminSupabase } from '@/lib/supabase';

interface ClassGroup {
  className: string;
  section: string;
  studentCount: number;
}

export const StudentClasses: React.FC = () => {
  const router = useRouter();
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<ClassGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const dbClient = adminSupabase || supabase;
        const res = await dbClient.from('students').select('*').neq('status', 'Struck Off');
        const data = res.data || [];
        
        const groups: Record<string, ClassGroup> = {};
        data.forEach((student: any) => {
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
        setFilteredGroups(sortedGroups);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    let result = classGroups;

    if (searchQuery) {
      result = result.filter(g => 
        g.className.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.section.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (classFilter) {
      result = result.filter(g => g.className === classFilter);
    }

    if (sectionFilter) {
      result = result.filter(g => g.section === sectionFilter);
    }

    setFilteredGroups(result);
  }, [searchQuery, classFilter, sectionFilter, classGroups]);

  if (isLoading) {
    return <div className="loading-state">Loading classes...</div>;
  }

  const availableClasses = Array.from(new Set(
    classGroups.map(g => g.className)
  )).sort();

  const availableSections = Array.from(new Set(
    classGroups
      .filter(g => !classFilter || g.className === classFilter)
      .map(g => g.section)
  )).sort();

  const totalActiveStudents = classGroups.reduce((sum, g) => sum + g.studentCount, 0);

  return (
    <div className="student-classes-page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>Classes & Sections</h2>
          <p className="subtitle">Select a class to view its enrolled students.</p>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <div className="kpi-badge">
            <span className="kpi-label">Active Students</span>
            <span className="kpi-value">{totalActiveStudents}</span>
          </div>
          <div className="kpi-badge">
            <span className="kpi-label">Classes</span>
            <span className="kpi-value">{availableClasses.length}</span>
          </div>
          <div className="kpi-badge">
            <span className="kpi-label">Sections</span>
            <span className="kpi-value">{availableSections.length}</span>
          </div>
        </div>
      </div>

      <div className="records-controls">
        <div className="search-box">
          <Search size={18} className="search-icon" />
          <div className="search-divider"></div>
          <input 
            type="text" 
            placeholder="Search by class or section..." 
            value={searchQuery}
            onChange={(e) => {
              const val = e.target.value;
              setSearchQuery(val);
              if (val.trim().length > 0) {
                router.push(`/students/records/search?q=${encodeURIComponent(val)}`);
              }
            }}
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
              {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          
          <div className="filter-group">
            <select 
              value={sectionFilter} 
              onChange={(e) => setSectionFilter(e.target.value)}
              className="filter-select"
            >
              <option value="">All Sections</option>
              {availableSections.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      {filteredGroups.length === 0 ? (
        <div className="empty-state">
          <p>No active students found in any class.</p>
          <button className="btn-primary" onClick={() => router.push('/students/register')}>Register Student</button>
        </div>
      ) : (
        <div className="classes-grid">
          {filteredGroups.map((group) => (
            <div 
              key={`${group.className}-${group.section}`} 
              className="class-card"
              onClick={() => router.push(`/students/records/view/${encodeURIComponent(group.className)}/${encodeURIComponent(group.section)}`)}
            >
              <div className="card-header">
                <div className="icon-wrapper">
                  <GraduationCap size={24} />
                </div>
                <h3>{group.className}</h3>
              </div>
              <div className="card-body">
                <div className="info-row">
                  <span className="label">Section:</span>
                  <span className="value section-badge">{group.section}</span>
                </div>
                <div className="info-row mt-2">
                  <span className="label">Total Students:</span>
                  <span className="value count">
                    <Users size={16} /> {group.studentCount}
                  </span>
                </div>
              </div>
              <div className="card-footer">
                <span>View Records &rarr;</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StudentClasses;
