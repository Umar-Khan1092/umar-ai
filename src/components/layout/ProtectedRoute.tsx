'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export const ProtectedRoute: React.FC<{ children: React.ReactNode, allowedRoles?: string[] }> = ({ children, allowedRoles }) => {
  const { isAuthenticated, user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!isAuthenticated) {
      router.replace('/login');
    } else if (allowedRoles && user && !allowedRoles.includes(user.role)) {
      if (user.role === 'Admin') {
        router.replace('/dashboard');
      } else if (user.role === 'Teacher') {
        router.replace('/teacher/profile');
      } else if (user.role === 'Guardian') {
        router.replace('/guardian');
      } else {
        router.replace('/login');
      }
    }
  }, [isAuthenticated, user, loading, allowedRoles, router]);

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#F8FAFC' }}>Loading...</div>;
  }

  if (!isAuthenticated) return null;
  if (allowedRoles && user && !allowedRoles.includes(user.role)) return null;

  return <>{children}</>;
};
