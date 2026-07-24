import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./app.css";

// All module CSS imports consolidated here for stable, predictable loading order.
// This prevents random CSS disappearance caused by per-component lazy CSS loading.
import "./(admin)/attendance/Attendance.css";
import "./(admin)/classes/StudentClasses.css";
import "./(admin)/dashboard/Dashboard.css";
import "./(admin)/fees/FeeManagement.css";
import "./(admin)/settings/Settings.css";
import "./(admin)/staff/StaffRecords.css";
import "./(admin)/students/StudentRecords.css";
import "./(admin)/students/[id]/StudentProfile.css";
import "./(guardian)/guardian/guardianportal/GuardianPortal.css";
import "./(teacher)/teacher/login/Login.css";
import "./login/Login.css";
import "./registration/Registration.css";
import "./teacherportal/TeacherPortal.css";
import "../components/layout/Sidebar.css";
import "../components/layout/StaffLayout.css";
import "../components/layout/StudentLayout.css";
import "../components/layout/TeacherLayout.css";
import "../components/layout/Topbar.css";
import "../components/ui/BulkUploadModal.css";
import "../components/ui/Input.css";
import "../components/ui/SearchableSelect.css";

import { AuthProvider } from "@/context/AuthContext";
import { PushNotificationManager } from "@/components/PushNotificationManager";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ERRP - Education Resource Planning",
  description: "School Management System",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "EduERP",
  },
  icons: {
    apple: "/logo.webp",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AuthProvider>
          {children}
          <PushNotificationManager />
        </AuthProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(
                    function(registration) {
                      console.log('ServiceWorker registration successful with scope: ', registration.scope);
                    },
                    function(err) {
                      console.log('ServiceWorker registration failed: ', err);
                    }
                  );
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
