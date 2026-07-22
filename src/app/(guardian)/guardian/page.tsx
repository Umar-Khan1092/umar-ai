'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { User, LogOut, ChevronRight } from 'lucide-react';
import '@/app/teacherportal/TeacherPortal.css'; // Reuse some card styles
import { supabase } from '@/lib/supabase';

export const GuardianDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [students, setStudents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [instituteName, setInstituteName] = useState('');
  const [instituteLogo, setInstituteLogo] = useState('');

  useEffect(() => {
    if (user?.role === 'Guardian') {
      const fetchStudents = async () => {
        const { data, error } = await supabase.from('students').select('*').eq('guardian_id', user.id);
        if (!error && data) {
          setStudents(data);
        }
        setIsLoading(false);
      };

      fetchStudents();

      // Subscribe to real-time changes
      const subscription = supabase
        .channel('public:students')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'students', filter: `guardian_id=eq.${user.id}` }, () => {
          fetchStudents();
        })
        .subscribe();

      Promise.resolve(supabase.from('settings').select('*').eq('key', 'app_settings').single())
        .then(res => {
          const data = res.data?.value || {};
          if (data.institute_name) setInstituteName(data.institute_name);
          if (data.institute_logo) setInstituteLogo(data.institute_logo);
        })
        .catch((err: any) => console.error(err));

      return () => {
        supabase.removeChannel(subscription);
      };
    }
  }, [user]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg-tertiary)' }}>
      {/* Header */}
      <div style={{ backgroundColor: 'white', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src={instituteLogo || "/logo.webp"} alt="Logo" style={{ height: '32px', borderRadius: '4px', objectFit: 'contain' }} />
          <h1 style={{ fontSize: '1.2rem', margin: 0, color: 'var(--color-primary)' }}>{instituteName || 'Guardian Portal'}</h1>
        </div>
        <button 
          onClick={() => { logout(); router.push('/login'); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-muted)' }}
        >
          <LogOut size={18} />
          <span>Sign Out</span>
        </button>
      </div>

      <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '24px', color: 'var(--color-text-main)' }}>Welcome, {user?.name || 'Guardian'}!</h2>
        <p style={{ marginBottom: '24px', color: 'var(--color-text-muted)' }}>Select a student below to view their profile, academic records, and attendance.</p>
        
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>Loading students...</div>
        ) : students.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {students.map(student => (
              <div 
                key={student.id} 
                onClick={() => router.push(`/guardian/student/${student.id}`)}
                className="card"
                style={{ 
                  padding: '20px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  borderLeft: '4px solid var(--color-primary)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div className="avatar" style={{ width: '48px', height: '48px', backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
                    {student.profile_image_url ? (
                      <img src={student.profile_image_url} alt={student.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <User size={24} />
                    )}
                  </div>
                  <div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem' }}>{student.name}</h3>
                    <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                      Class: {student.academic_class} ({student.section}) | Roll No: {student.roll_number || '-'}
                    </p>
                  </div>
                </div>
                <div style={{ color: 'var(--color-primary)' }}>
                  <ChevronRight size={24} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            No students found linked to your account.
          </div>
        )}
      </div>
    </div>
  );
};

export default GuardianDashboard;
