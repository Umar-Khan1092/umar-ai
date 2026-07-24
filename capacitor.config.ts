import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.schoolerp.app',
  appName: 'School ERP',
  webDir: 'out',
  appendUserAgent: 'CapacitorApp',
  server: {
    url: 'https://umar-ai-consultant.vercel.app/',
    cleartext: true
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    }
  }
};

export default config;
