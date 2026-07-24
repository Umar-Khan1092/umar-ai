'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Share, PlusSquare, ArrowRight, Smartphone } from 'lucide-react';

export default function DeviceEntry() {
  const router = useRouter();
  const [deviceType, setDeviceType] = useState<'ios' | 'android' | 'desktop'>('desktop');

  useEffect(() => {
    const ua = navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua)) {
      setDeviceType('ios');
    } else if (/Android/.test(ua)) {
      setDeviceType('android');
    }
  }, []);

  const handleContinueInBrowser = () => {
    // Set cookie to bypass middleware for 30 days
    document.cookie = "bypass_device_entry=true; path=/; max-age=" + 60*60*24*30;
    router.push('/login');
  };

  const handleDownloadApk = () => {
    // Assuming the APK is hosted in the public directory or an external link
    window.location.href = '/app-release.apk';
  };

  return (
    <div className="login-container" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
      <div className="login-card" style={{ width: '100%', maxWidth: '450px', margin: '20px', padding: '40px 30px' }}>
        <div className="login-header" style={{ textAlign: 'center', marginBottom: '30px' }}>
          <img src="/logo.webp" alt="School ERP Logo" className="mobile-login-logo" style={{ width: '80px', height: '80px', margin: '0 auto 15px' }} />
          <h2>Welcome to School ERP</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Get the best experience by installing our app.</p>
        </div>

        {deviceType === 'android' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ padding: '20px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
              <Smartphone size={40} style={{ margin: '0 auto 15px', color: 'var(--primary)' }} />
              <h3 style={{ marginBottom: '10px' }}>Android App Available</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Install the native Android app for instant notifications and faster access.</p>
            </div>
            <button onClick={handleDownloadApk} className="btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '15px' }}>
              <Download size={20} />
              Download Android APK
            </button>
          </div>
        )}

        {deviceType === 'ios' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ padding: '20px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)' }}>
              <h3 style={{ marginBottom: '15px', textAlign: 'center' }}>Install iOS App</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '15px', textAlign: 'center' }}>Install our Progressive Web App to receive push notifications.</p>
              
              <ol style={{ paddingLeft: '20px', fontSize: '14px', color: 'var(--text-primary)' }}>
                <li style={{ marginBottom: '10px' }}>Tap the <Share size={16} style={{ display: 'inline', verticalAlign: 'middle' }}/> <strong>Share</strong> button at the bottom of Safari.</li>
                <li style={{ marginBottom: '10px' }}>Scroll down and tap <PlusSquare size={16} style={{ display: 'inline', verticalAlign: 'middle' }}/> <strong>Add to Home Screen</strong>.</li>
                <li>Open the app from your home screen.</li>
              </ol>
            </div>
          </div>
        )}

        {deviceType === 'desktop' && (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <p style={{ color: 'var(--text-secondary)' }}>Redirecting to login...</p>
          </div>
        )}

        <div style={{ marginTop: '30px', textAlign: 'center' }}>
          <button 
            onClick={handleContinueInBrowser}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: 'var(--text-secondary)', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              width: '100%',
              fontSize: '15px'
            }}
          >
            Continue in Browser <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
