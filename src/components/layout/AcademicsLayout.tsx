'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, FileCheck, Tags, Award, LayoutTemplate, PieChart, PenTool, FileText } from 'lucide-react';
import './StudentLayout.css';

const academicsNavItems = [
  { name: 'Assessment Types', icon: Tags,           path: '/academics/categories',        color: '#F59E0B' },
  { name: 'Result Templates', icon: LayoutTemplate, path: '/academics/templates',          color: '#7C3AED' },
  { name: 'Grade Scales',     icon: Award,          path: '/academics/grades',             color: '#059669' },
  { name: 'Exam Modality',    icon: BookOpen,       path: '/academics/exams',              color: '#2563EB' },
  { name: 'Results Approval', icon: FileCheck,      path: '/academics/results',            color: '#16A34A' },
  { name: 'Result Generation',icon: FileText,       path: '/academics/result-generation',  color: '#0891B2' },
  { name: 'Report Card Design',icon: PenTool,       path: '/academics/report-cards',       color: '#DC2626' },
  { name: 'Analytics',        icon: PieChart,       path: '/academics/analytics',          color: '#9333EA' },
];

export const AcademicsLayout = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname() ?? '';
  return (
    <div className="student-layout">
      <div style={{ marginBottom: '8px', padding: '4px 0' }}>
        <nav style={{ display: 'flex', alignItems: 'center', gap: '2px', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {academicsNavItems.map(item => {
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.path}
                className={`profile-tab-horizontal ${pathname.startsWith(item.path) ? 'active' : ''}`}
              >
                <Icon size={15} style={{ color: pathname.startsWith(item.path) ? item.color : undefined, flexShrink: 0 }} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="student-content">
        {children}
      </div>
    </div>
  );
};
