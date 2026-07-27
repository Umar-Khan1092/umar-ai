import { GuardianMobileLayout } from '@/components/layout/GuardianMobileLayout';
import { GuardianProvider } from '@/context/GuardianContext';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';

export default function GuardianLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={['Guardian']}>
      <GuardianProvider>
        <GuardianMobileLayout>{children}</GuardianMobileLayout>
      </GuardianProvider>
    </ProtectedRoute>
  );
}