import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ─── Performance: reduce dev compile & hot-reload time ────────────────────
  experimental: {
    // Turbopack is already the default in Next 15 dev mode.
    // Optimise package imports so lucide-react, date-fns, etc. are tree-shaken
    // at the module level instead of importing the entire barrel.
    optimizePackageImports: [
      'lucide-react',
      '@supabase/supabase-js',
      'recharts',
    ],
  },

  // ─── Compiler: strip console.log in production ───────────────────────────
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production'
      ? { exclude: ['error', 'warn'] }
      : false,
  },

  // ─── Images: allow Supabase storage origin ───────────────────────────────
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },



  async redirects() {
    return [
      // Preserve existing ERP URLs while the app moves to file-based routes.
      { source: '/', destination: '/dashboard', permanent: false },

      // Student management
      { source: '/students/register', destination: '/students/new', permanent: false },
      { source: '/students/edit/:id', destination: '/students/:id/edit', permanent: false },
      { source: '/students/records', destination: '/classes', permanent: false },
      { source: '/students/records/search', destination: '/students', permanent: false },
      { source: '/students/records/view/:className/:sectionName', destination: '/students', permanent: false },
      { source: '/students/fees', destination: '/fees', permanent: false },
      { source: '/students/fees/view/:className/:sectionName', destination: '/fees', permanent: false },
      { source: '/students/results', destination: '/results', permanent: false },
      { source: '/students/profile/:id', destination: '/students/:id', permanent: false },

      // Staff management
      { source: '/staff/register', destination: '/staff/new', permanent: false },
      { source: '/staff/records', destination: '/staff', permanent: false },
      { source: '/staff/profile/:id', destination: '/staff/:id', permanent: false },
      { source: '/staff/edit/:id', destination: '/staff/:id/edit', permanent: false },
      { source: '/staff/lectures', destination: '/teacher/lectures', permanent: false },
      { source: '/staff/generate', destination: '/staff/payroll', permanent: false },

      // Academics
      { source: '/academics', destination: '/exams/schedule', permanent: false },
      { source: '/academics/categories', destination: '/exams/categories', permanent: false },
      { source: '/academics/templates', destination: '/results/templates', permanent: false },
      { source: '/academics/grades', destination: '/exams/grades', permanent: false },
      { source: '/academics/exams', destination: '/exams/schedule', permanent: false },
      { source: '/academics/results', destination: '/results', permanent: false },
      { source: '/academics/result-generation', destination: '/results/generate', permanent: false },
      { source: '/academics/report-cards', destination: '/results/report-card', permanent: false },
      { source: '/academics/analytics', destination: '/analytics', permanent: false },

      // Attendance and role portals
      { source: '/attendance', destination: '/attendance/approval', permanent: false },
      { source: '/teacher', destination: '/teacher/profile', permanent: false },
      { source: '/guardian/home', destination: '/guardian/guardianhome', permanent: false },
      { source: '/guardian/academics', destination: '/guardian/guardianacademics', permanent: false },
      { source: '/guardian/fees', destination: '/guardian/guardianfees', permanent: false },
      { source: '/guardian/notifications', destination: '/guardian/guardiannotifications', permanent: false },
      { source: '/guardian/profile', destination: '/guardian/guardianprofile', permanent: false },
    ];
  },
};

export default nextConfig;
