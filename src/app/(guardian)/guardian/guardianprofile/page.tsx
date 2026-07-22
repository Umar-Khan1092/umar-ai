'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { User, LogOut, Phone, Shield, HelpCircle } from 'lucide-react';

export const GuardianProfile: React.FC = () => {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <h1 style={{ fontSize: '24px', color: '#1E293B', margin: '0 0 24px 0' }}>Profile</h1>

      {/* Parent Info Card */}
      <div className="guardian-action-card" style={{ padding: '24px', alignItems: 'center', textAlign: 'center' }}>
        <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
          <User size={40} />
        </div>
        <h2 style={{ margin: '0 0 4px 0', fontSize: '20px', color: '#1E293B' }}>{user?.name || 'Guardian'}</h2>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#64748B' }}>
          <Phone size={14} />
          <span style={{ fontSize: '14px' }}>{user?.email || '+92 300 0000000'}</span>
        </div>
      </div>

      {/* Settings Menu */}
      <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <button className="guardian-action-card" style={{ flexDirection: 'row', alignItems: 'center', padding: '16px', background: 'white' }}>
          <Shield size={20} color="#64748B" />
          <span style={{ flex: 1, textAlign: 'left', fontSize: '16px', color: '#1E293B', marginLeft: '12px' }}>Account Security</span>
        </button>

        <button className="guardian-action-card" style={{ flexDirection: 'row', alignItems: 'center', padding: '16px', background: 'white' }}>
          <HelpCircle size={20} color="#64748B" />
          <span style={{ flex: 1, textAlign: 'left', fontSize: '16px', color: '#1E293B', marginLeft: '12px' }}>Help & Support</span>
        </button>

        <button 
          className="guardian-action-card" 
          onClick={handleLogout}
          style={{ flexDirection: 'row', alignItems: 'center', padding: '16px', background: '#FEF2F2', border: '1px solid #FECACA' }}
        >
          <LogOut size={20} color="#DC2626" />
          <span style={{ flex: 1, textAlign: 'left', fontSize: '16px', color: '#DC2626', marginLeft: '12px', fontWeight: 600 }}>Sign Out</span>
        </button>
      </div>

    </div>
  );
};

export default GuardianProfile;
