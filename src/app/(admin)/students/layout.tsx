import { StudentLayout } from '@/components/layout/StudentLayout';
import React from 'react';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <StudentLayout>{children}</StudentLayout>;
}
