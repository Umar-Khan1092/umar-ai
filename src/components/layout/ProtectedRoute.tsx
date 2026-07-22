'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export const ProtectedRoute: React.FC<{ children: React.ReactNode, allowedRoles?: string[] }> = ({ children, allowedRoles }) => {
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();
  let destination: string | null = null;

  if (!isAuthenticated) {
    destination = '/login';
  }

  if (!destination && allowedRoles && user && !allowedRoles.includes(user.role)) {
    if (user.role === 'Admin') {
      destination = '/dashboard';
    } else if (user.role === 'Teacher') {
      destination = '/teacher/profile';
    } else if (user.role === 'Guardian') {
      destination = '/guardian';
    } else {
      destination = '/login';
    }
  }

  useEffect(() => {
    if (destination) router.replace(destination);
  }, [destination, router]);

  if (destination) return null;

  return <>{children}</>;
};
