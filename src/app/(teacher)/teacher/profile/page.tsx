'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { 
  Calendar, CheckSquare, User, 
  CreditCard, Mail, Phone, MapPin, Briefcase, 
  GraduationCap, DollarSign, Shield, Key, ChevronLeft,
  Clock, Bell, ChevronRight
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';

export const TeacherProfile: React.FC = () => {
  const { user } = useAuth();
  const [staff, setStaff] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<'dashboard' | 'profile'>('dashboard');
  const router = useRouter();

  useEffect(() => {
    if (user?.id) {
      if (user.role === 'Admin' && user.id === 'admin-0') {
        setStaff({
          name: 'Administrator',
          cnic: '00000-0000000-0',
          contact: 'System Default',
          address: 'Admin Portal',
          role: 'Admin',
          department: 'Administration',
          date_of_joining: '2020-01-01',
          qualifications: 'System Administrator'
        });
        setIsLoading(false);
        return;
      }

      (async () => {
        try {
          const res = await supabase.from('staff').select('*').eq('username', user.email).limit(1).maybeSingle();
          if (res.error) throw res.error;
          setStaff(res.data);
        } catch (err: any) {
          setError(err.message);
        } finally {
          setIsLoading(false);
        }
      })();
    }
  }, [user]);

  if (isLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#F8FAFC' }}>Loading...</div>;
  }

  if (error || !staff) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#DC2626', backgroundColor: '#F8FAFC' }}>{error || 'Profile not found'}</div>;
  }

  if (view === 'dashboard') {
    return (
      <div className="teacher-page" style={{ paddingBottom: '24px' }}>
        {/* Welcome Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'var(--tp-primary-light, #DBEAFE)', color: 'var(--tp-primary, #2563EB)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', fontWeight: 700 }}>
            {staff.name.charAt(0)}
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#1E293B' }}>Hi, {staff.name.split(' ')[0]} 👋</h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#64748B' }}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div 
            onClick={() => router.push('/teacher/timetable')}
            style={{ backgroundColor: '#FFFFFF', borderRadius: 'var(--tp-radius-md, 16px)', padding: '16px', boxShadow: 'var(--tp-shadow-soft, 0 4px 12px rgba(0,0,0,0.05))', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '12px' }}
          >
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: '#F1F5F9', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={20} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748B', fontWeight: 500 }}>Today's Classes</p>
              <h3 style={{ margin: '4px 0 0 0', fontSize: '20px', color: '#1E293B' }}>View Schedule</h3>
            </div>
          </div>
          
          <div 
            onClick={() => router.push('/teacher/attendance')}
            style={{ backgroundColor: '#FFFFFF', borderRadius: 'var(--tp-radius-md, 16px)', padding: '16px', boxShadow: 'var(--tp-shadow-soft, 0 4px 12px rgba(0,0,0,0.05))', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '12px' }}
          >
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: 'var(--tp-warning-light, #FEF3C7)', color: 'var(--tp-warning, #D97706)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckSquare size={20} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748B', fontWeight: 500 }}>Pending Actions</p>
              <h3 style={{ margin: '4px 0 0 0', fontSize: '20px', color: '#1E293B' }}>Mark Attendance</h3>
            </div>
          </div>
        </div>

        {/* Recent Activity / Profile Link */}
        <div style={{ marginTop: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1E293B', marginBottom: '16px' }}>Account & Settings</h3>
          
          <div 
            onClick={() => setView('profile')}
            style={{ backgroundColor: '#FFFFFF', borderRadius: 'var(--tp-radius-md, 16px)', padding: '16px', boxShadow: 'var(--tp-shadow-soft, 0 4px 12px rgba(0,0,0,0.05))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: '12px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--tp-primary-light, #DBEAFE)', color: 'var(--tp-primary, #2563EB)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User size={20} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#1E293B' }}>My Profile</h4>
                <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748B' }}>Personal & Professional details</p>
              </div>
            </div>
            <ChevronRight size={20} color="#94A3B8" />
          </div>

          <div 
            onClick={() => router.push('/teacher/notifications')}
            style={{ backgroundColor: '#FFFFFF', borderRadius: 'var(--tp-radius-md, 16px)', padding: '16px', boxShadow: 'var(--tp-shadow-soft, 0 4px 12px rgba(0,0,0,0.05))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#F1F5F9', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bell size={20} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#1E293B' }}>Notifications</h4>
                <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748B' }}>View recent alerts</p>
              </div>
            </div>
            <ChevronRight size={20} color="#94A3B8" />
          </div>
        </div>
      </div>
    );
  }

  // PROFILE VIEW
  return (
    <div className="teacher-page" style={{ backgroundColor: '#FFFFFF', minHeight: '100%', paddingBottom: '24px' }}>
      <button 
        onClick={() => setView('dashboard')}
        style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', padding: 0, marginBottom: '16px', fontWeight: 500 }}
      >
        <ChevronLeft size={20} /> Back to Dashboard
      </button>

      {/* Personal Details */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ paddingBottom: '24px', borderBottom: '1px solid #E2E8F0' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 600, color: 'var(--tp-primary, #2563EB)' }}>Personal Details</h3>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ color: '#64748B', marginTop: '2px' }}><User size={18} /></div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>Full Name</p>
              <p style={{ margin: '2px 0 0 0', fontSize: '15px', fontWeight: 500, color: '#1E293B' }}>{staff.name}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ color: '#64748B', marginTop: '2px' }}><CreditCard size={18} /></div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>CNIC</p>
              <p style={{ margin: '2px 0 0 0', fontSize: '15px', fontWeight: 500, color: '#1E293B' }}>{staff.cnic || 'N/A'}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ color: '#64748B', marginTop: '2px' }}><Mail size={18} /></div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>Email</p>
              <p style={{ margin: '2px 0 0 0', fontSize: '15px', fontWeight: 500, color: '#1E293B' }}>{staff.email || staff.username || 'N/A'}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ color: '#64748B', marginTop: '2px' }}><Phone size={18} /></div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>Phone Number</p>
              <p style={{ margin: '2px 0 0 0', fontSize: '15px', fontWeight: 500, color: '#1E293B' }}>{staff.phone || 'N/A'}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ color: '#64748B', marginTop: '2px' }}><MapPin size={18} /></div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>Address</p>
              <p style={{ margin: '2px 0 0 0', fontSize: '15px', fontWeight: 500, color: '#1E293B' }}>{staff.address || 'N/A'}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Professional Details */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{ padding: '24px 0', borderBottom: '1px solid #E2E8F0' }}
      >
        <h3 style={{ margin: '0 0 20px 0', fontSize: '17px', fontWeight: 600, color: 'var(--tp-primary, #2563EB)' }}>Professional Details</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ color: '#64748B', marginTop: '2px' }}><Calendar size={18} /></div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>Joining Date</p>
              <p style={{ margin: '2px 0 0 0', fontSize: '15px', fontWeight: 500, color: '#1E293B' }}>{(staff.join_date || staff.joining_date) ? new Date(staff.join_date || staff.joining_date).toLocaleDateString('en-PK', { day: '2-digit', month: 'long', year: 'numeric' }) : 'N/A'}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ color: '#64748B', marginTop: '2px' }}><GraduationCap size={18} /></div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>Qualification</p>
              <p style={{ margin: '2px 0 0 0', fontSize: '15px', fontWeight: 500, color: '#1E293B' }}>{staff.qualification || 'N/A'}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ color: '#64748B', marginTop: '2px' }}><Briefcase size={18} /></div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>Experience</p>
              <p style={{ margin: '2px 0 0 0', fontSize: '15px', fontWeight: 500, color: '#1E293B' }}>{staff.experience ? `${staff.experience} Years` : 'N/A'}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ color: '#64748B', marginTop: '2px' }}><DollarSign size={18} /></div>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>Salary ({staff.salary_type || 'N/A'})</p>
                <p style={{ margin: '2px 0 0 0', fontSize: '15px', fontWeight: 500, color: '#1E293B' }}>PKR {staff.salary || '0'}</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Role and Access */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        style={{ paddingTop: '24px' }}
      >
        <h3 style={{ margin: '0 0 20px 0', fontSize: '17px', fontWeight: 600, color: 'var(--tp-primary, #2563EB)' }}>Role & Security</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ color: '#64748B', marginTop: '2px' }}><Shield size={18} /></div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>Username</p>
              <p style={{ margin: '2px 0 0 0', fontSize: '15px', fontWeight: 500, color: '#1E293B' }}>{user?.email || 'N/A'}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ color: '#64748B', marginTop: '2px' }}><Key size={18} /></div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>Password</p>
              <p style={{ margin: '2px 0 0 0', fontSize: '15px', fontWeight: 500, color: '#1E293B' }}>{staff.password || '••••••••'}</p>
            </div>
          </div>
        </div>
      </motion.div>

    </div>
  );
};

export default TeacherProfile;
