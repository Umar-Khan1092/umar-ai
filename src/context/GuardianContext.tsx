'use client';

import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/lib/supabase';

interface Student {
  id: string;
  name: string;
  academic_class: string;
  section: string;
  roll_number: string;
  profile_image_url?: string;
  status: string;
  [key: string]: any;
}

interface GuardianContextType {
  students: Student[];
  activeStudent: Student | null;
  setActiveStudentId: (id: string) => void;
  isLoading: boolean;
  refreshStudents: () => void;
}

const GuardianContext = createContext<GuardianContextType | undefined>(undefined);

export const GuardianProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStudents = async () => {
    if (user?.role === 'Guardian') {
      setIsLoading(true);
      try {
        const res = await supabase
          .from('students')
          .select('*')
          .eq('guardian_id', user.id);
        
        if (res.error) throw res.error;
        const myStudents = res.data || [];
        setStudents(myStudents);
        
        if (myStudents.length > 0 && !activeStudentId) {
          setActiveStudentId(myStudents[0].id);
        } else if (myStudents.length > 0 && activeStudentId) {
          if (!myStudents.find((s: Student) => s.id === activeStudentId)) {
            setActiveStudentId(myStudents[0].id);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();

    let subscription: any = null;
    if (user?.role === 'Guardian') {
      subscription = supabase
        .channel('public:students_ctx')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'students', filter: `guardian_id=eq.${user.id}` }, () => {
          fetchStudents();
        })
        .subscribe();
    }

    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, [user]);

  const activeStudent = students.find(s => s.id === activeStudentId) || null;

  return (
    <GuardianContext.Provider value={{
      students,
      activeStudent,
      setActiveStudentId,
      isLoading,
      refreshStudents: fetchStudents
    }}>
      {children}
    </GuardianContext.Provider>
  );
};

export const useGuardian = () => {
  const context = useContext(GuardianContext);
  if (context === undefined) {
    throw new Error('useGuardian must be used within a GuardianProvider');
  }
  return context;
};
