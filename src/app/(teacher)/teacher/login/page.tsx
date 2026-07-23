'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Lock, User } from 'lucide-react';

import { supabase } from '@/lib/supabase';

export const TeacherLogin: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Sign in with Supabase Auth using email + password
      const { data, error } = await supabase.auth.signInWithPassword({
        email: username,
        password: password
      });

      if (error) throw new Error(error.message);

      const role = data.user?.user_metadata?.role || 'Teacher';
      if (role !== 'Teacher') {
        await supabase.auth.signOut();
        throw new Error('Access Denied. Only Teachers can log in here.');
      }

      router.push('/teacher/profile');
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card card">
        <div className="login-header">
          <div className="login-logo" style={{ backgroundColor: '#10B981' }}></div>
          <h2>Teacher Portal</h2>
          <p>Login to access your classes</p>
        </div>
        
        {error && <div className="toast error" style={{ position: 'relative', top: 0, left: 0, right: 0, marginBottom: '20px', padding: '12px' }}>{error}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-group">
            <label className="input-label">Username</label>
            <div className="input-icon-wrapper">
              <User size={18} className="input-icon" />
              <input 
                type="text" 
                className="input-field with-icon" 
                value={username} 
                onChange={e => setUsername(e.target.value)} 
                required 
                placeholder="Enter your teacher username"
              />
            </div>
          </div>
          
          <div className="input-group">
            <label className="input-label">Password</label>
            <div className="input-icon-wrapper">
              <Lock size={18} className="input-icon" />
              <input 
                type="password" 
                className="input-field with-icon" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required 
                placeholder="Enter your password"
              />
            </div>
          </div>
          
          <button type="submit" className="btn-primary login-btn" style={{ backgroundColor: '#10B981' }} disabled={isLoading}>
            {isLoading ? 'Authenticating...' : 'Teacher Login'}
          </button>
        </form>
        
        <div className="login-footer">
          <p>Admin? <a href="/login">Go to Admin Portal</a></p>
        </div>
      </div>
    </div>
  );
};

export default TeacherLogin;
