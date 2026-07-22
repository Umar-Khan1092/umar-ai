import React from 'react';
import { AttendanceLayout } from '@/components/layout/AttendanceLayout';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AttendanceLayout>
      {children}
    </AttendanceLayout>
  );
}
