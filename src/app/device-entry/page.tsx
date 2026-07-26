'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Share, PlusSquare, ArrowRight, Smartphone } from 'lucide-react';

export default function DeviceEntry() {
  const router = useRouter();
  const [deviceType, setDeviceType] = useState<'ios' | 'android' | 'desktop'>('desktop');

  useEffect(() => {
    // 1. Check if we are actually inside the Capacitor Native App (e.g. after logout)
    import('@capacitor/core').then(({ Capacitor }) => {
      if (Capacitor.isNativePlatform()) {
        document.cookie = "is_standalone_pwa=true; path=/; max-age=" + 60*60*24*365;
        router.push('/login');
      }
    }).catch(() => {});

    // 2. Check if running in standalone PWA (iOS Home Screen)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    
    if (isStandalone) {
      // If we are in the installed PWA, set the verification cookie and go to login
      document.cookie = "is_standalone_pwa=true; path=/; max-age=" + 60*60*24*365;
      router.push('/login');
      return;
    }

    // 2. Otherwise determine device type for installation instructions
    const ua = navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua)) {
      setDeviceType('ios');
    } else if (/Android/.test(ua)) {
      setDeviceType('android');
    } else {
      router.push('/login');
    }
  }, [router]);

  const handleDownloadApk = () => {
    window.location.href = '/app-release.apk';
  };

  return (
    <div className="login-container" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
      <div className="login-card" style={{ width: '100%', maxWidth: '450px', margin: '20px', padding: '40px 30px' }}>
        <div className="login-header" style={{ textAlign: 'center', marginBottom: '30px' }}>
          <img src="/logo.webp" alt="School ERP Logo" className="mobile-login-logo" style={{ width: '80px', height: '80px', margin: '0 auto 15px' }} />
          <h2>App Installation Required</h2>
          <p style={{ color: 'var(--text-secondary)' }}>You must install the app to access the portal on mobile.</p>
        </div>

        {deviceType === 'android' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ padding: '20px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
              <Smartphone size={40} style={{ margin: '0 auto 15px', color: 'var(--primary)' }} />
              <h3 style={{ marginBottom: '10px' }}>Android App Required</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>You must install our native Android app to receive mandatory school push notifications.</p>
            </div>
            <button onClick={() => {
              // Set a cookie so they aren't forced back here immediately after downloading
              document.cookie = "is_standalone_pwa=true; path=/; max-age=" + 60*60*24*365;
              handleDownloadApk();
            }} className="btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '15px' }}>
              <Download size={20} />
              Download Android APK
            </button>
            <button onClick={() => {
              document.cookie = "is_standalone_pwa=true; path=/; max-age=" + 60*60*24*365;
              router.push('/login');
            }} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer', marginTop: '10px' }}>
              Already installed? Continue to Login →
            </button>
          </div>
        )}

        {deviceType === 'ios' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ padding: '20px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)' }}>
              <h3 style={{ marginBottom: '15px', textAlign: 'center' }}>Install iOS App</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '15px', textAlign: 'center' }}>You must install our Progressive Web App to access the portal and receive push notifications.</p>
              
              <ol style={{ paddingLeft: '20px', fontSize: '14px', color: 'var(--text-primary)' }}>
                <li style={{ marginBottom: '10px' }}>Tap the <Share size={16} style={{ display: 'inline', verticalAlign: 'middle' }}/> <strong>Share</strong> button at the bottom of Safari.</li>
                <li style={{ marginBottom: '10px' }}>Scroll down and tap <PlusSquare size={16} style={{ display: 'inline', verticalAlign: 'middle' }}/> <strong>Add to Home Screen</strong>.</li>
                <li>Open the app from your home screen to login.</li>
              </ol>
            </div>
          </div>
        )}

        {deviceType === 'desktop' && (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <p style={{ color: 'var(--text-secondary)' }}>Redirecting to login...</p>
          </div>
        )}
      </div>
    </div>
  );
}
