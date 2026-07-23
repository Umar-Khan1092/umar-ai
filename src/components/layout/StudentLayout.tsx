'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { List, ArrowUpCircle, UserX, FileText } from 'lucide-react';


const studentNavItems = [
  { name: 'Records',     icon: List,          path: '/students',          exact: true,  color: '#2563EB' },
  { name: 'Promote',    icon: ArrowUpCircle, path: '/students/promote',  exact: false, color: '#7C3AED' },
  { name: 'Ex-Students',icon: UserX,         path: '/students/struck-off',exact: false,color: '#DC2626' },
  { name: 'Reports',    icon: FileText,      path: '/students/reports',  exact: false, color: '#059669' },
];

const KNOWN_SUB_PAGES = ['/students/promote', '/students/struck-off', '/students/reports', '/students/new'];

export const StudentLayout = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname() ?? '';
  const router = useRouter();

  // Only hide nav on individual student profile pages (e.g. /students/uuid)
  const isProfilePage =
    /^\/students\/[^/]+$/.test(pathname) &&
    !KNOWN_SUB_PAGES.some(p => pathname.startsWith(p));
  const isClassViewPage = pathname.includes('/view/');
  const isFeePage = pathname.includes('/students/fees');
  const hideNav = isProfilePage || isClassViewPage || isFeePage;

  return (
    <div className="student-layout">
      {!hideNav && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', padding: '4px 0' }}>
          <nav style={{ display: 'flex', alignItems: 'center', gap: '2px', flex: 1, overflowX: 'auto', scrollbarWidth: 'none' }}>
            {studentNavItems.map(item => {
              const Icon = item.icon;
              const isActive = item.exact ? pathname === item.path : pathname.startsWith(item.path);
              return (
                <Link
                  key={item.name}
                  href={item.path}
                  className={`profile-tab-horizontal ${isActive ? 'active' : ''}`}
                >
                  <Icon size={15} style={{ color: isActive ? item.color : undefined, flexShrink: 0 }} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
          <button
            className="btn-primary"
            style={{ flexShrink: 0, marginLeft: '12px', height: '38px', padding: '0 16px', fontSize: '13.5px' }}
            onClick={() => router.push('/students/new')}
          >
            Register New
          </button>
        </div>
      )}

      <div className="student-content">
        {children}
      </div>
    </div>
  );
};
