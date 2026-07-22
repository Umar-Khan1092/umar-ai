'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

import { supabase } from '@/lib/supabase';
import { Lock, Mail, Eye, EyeOff } from 'lucide-react';
import './Login.css';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const loginEmail = email.includes('@') ? email : `${email.replace(/\D/g, '')}@school.local`;
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });

      if (authError) throw authError;

      // The AuthContext onAuthStateChange will automatically pick up the session
      // and redirect based on role (or we can force a redirect here)
      const role = data.user?.user_metadata?.role || 'Admin';
      
      if (role === 'Admin') {
        router.push('/');
      } else if (role === 'Guardian') {
        router.push('/guardian');
      } else {
        router.push('/teacher/profile');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sign in. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-left">
        <div className="login-branding">
          <img src="/logo.webp" alt="School ERP Logo" className="login-brand-logo" />
          <h1>Welcome to School ERP</h1>
          <p>The enterprise-grade education management platform designed to simplify administration and empower educators.</p>
        </div>
        {/* Accent shapes for the branding panel */}
        <div className="login-shape shape-1"></div>
        <div className="login-shape shape-2"></div>
      </div>

      <div className="login-right">
        <div className="login-card">
          <div className="login-header">
            <img src="/logo.webp" alt="School ERP Logo" className="mobile-login-logo" />
            <h2>Sign in to your account</h2>
            <p>Welcome back! Please enter your details.</p>
          </div>
          
          {error && <div className="toast error" style={{ position: 'relative', top: 0, left: 0, right: 0, marginBottom: '24px', padding: '12px', borderRadius: 'var(--radius-md)' }}>{error}</div>}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="input-group">
              <label className="input-label">Email</label>
              <div className="input-icon-wrapper">
                <Mail size={18} className="input-icon" />
                <input 
                  type="email" 
                  className="input-field with-icon" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  required 
                  placeholder="Enter your email"
                />
              </div>
            </div>
            
            <div className="input-group">
              <label className="input-label">Password</label>
              <div className="input-icon-wrapper">
                <Lock size={18} className="input-icon" />
                <input 
                  type={showPassword ? 'text' : 'password'}
                  className="input-field with-icon with-right-icon" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  required 
                  placeholder="Enter your password"
                />
                <button 
                  type="button" 
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            
            <button type="submit" className="btn-primary login-btn" disabled={isLoading}>
              {isLoading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
          
          <div className="login-footer">
            <p>Admin Access: Create your first user in the Supabase Dashboard Authentication tab.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
