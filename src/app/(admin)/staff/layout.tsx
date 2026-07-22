import { StaffLayout } from '@/components/layout/StaffLayout';
import React from 'react';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <StaffLayout>{children}</StaffLayout>;
}
