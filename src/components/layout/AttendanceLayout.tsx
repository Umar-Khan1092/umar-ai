'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CheckSquare, FileText, UserCheck } from 'lucide-react';


const attendanceNavItems = [
  { name: 'Attendance Approval', icon: CheckSquare, path: '/attendance/approval', color: '#2563EB' },
  { name: 'Staff Attendance',    icon: UserCheck,   path: '/attendance/staff',    color: '#059669' },
  { name: 'Reports',             icon: FileText,    path: '/attendance/history',  color: '#7C3AED' },
];

export const AttendanceLayout = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname() ?? '';
  return (
    <div className="student-layout">
      <div style={{ marginBottom: '8px', padding: '4px 0' }}>
        <nav className="nav-tabs-mobile" style={{ display: 'flex', alignItems: 'center', gap: '2px', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {attendanceNavItems.map(item => {
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
