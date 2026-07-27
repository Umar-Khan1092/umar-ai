import { TeacherLayout } from '@/components/layout/TeacherLayout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';

export default function TeacherRouteLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={['Teacher']}>
      <TeacherLayout>{children}</TeacherLayout>
    </ProtectedRoute>
  );
}