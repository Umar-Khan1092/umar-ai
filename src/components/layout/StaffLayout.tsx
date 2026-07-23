'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { List, ClipboardCheck, CreditCard } from 'lucide-react';


const staffNavItems = [
  { name: 'Records',           icon: List,          path: '/staff',           color: '#2563EB' },
  { name: 'Generate Payroll',  icon: ClipboardCheck,path: '/staff/payroll',   color: '#059669' },
  { name: 'Disburse Salaries', icon: CreditCard,    path: '/staff/salaries',  color: '#F59E0B' },
  { name: 'Reports',           icon: ClipboardCheck,path: '/staff/reports',   color: '#7C3AED' },
];

export const StaffLayout = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname() ?? '';
  const router = useRouter();

  const isProfilePage = /^\/staff\/[^/]+$/.test(pathname) && pathname !== '/staff/payroll' && pathname !== '/staff/salaries' && pathname !== '/staff/reports' && pathname !== '/staff/new';

  return (
    <div className="staff-layout">
      {!isProfilePage && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', padding: '4px 0' }}>
          <nav style={{ display: 'flex', alignItems: 'center', gap: '2px', flex: 1, overflowX: 'auto', scrollbarWidth: 'none' }}>
            {staffNavItems.map(item => {
              const Icon = item.icon;
              const isActive = item.path === '/staff' ? pathname === '/staff' : pathname.startsWith(item.path);
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
            onClick={() => router.push('/staff/new')}
          >
            Register New
          </button>
        </div>
      )}

      <div className="staff-content">
        {children}
      </div>
    </div>
  );
};
