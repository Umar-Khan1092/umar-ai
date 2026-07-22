import { GuardianMobileLayout } from '@/components/layout/GuardianMobileLayout';
import { GuardianProvider } from '@/context/GuardianContext';

export default function GuardianLayout({ children }: { children: React.ReactNode }) {
  return (
    <GuardianProvider>
      <GuardianMobileLayout>{children}</GuardianMobileLayout>
    </GuardianProvider>
  );
}