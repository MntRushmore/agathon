'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/auth-provider';
import { toast } from 'sonner';

export default function TeacherLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/?auth=required');
      } else if (profile?.role !== 'teacher') {
        toast.error('Access denied. Only teachers can access the teacher dashboard.');
        router.push('/');
      }
    }
  }, [user, profile, loading, router]);

  // Show loading state while checking auth
  if (loading || !user || profile?.role !== 'teacher') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  );
}
