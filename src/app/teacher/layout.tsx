'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/auth-provider';
import { toast } from 'sonner';

export default function TeacherLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    // Wait for auth loading to complete AND profile to be fetched (if user exists)
    if (!loading) {
      // If no user, redirect to auth
      if (!user) {
        router.push('/?auth=required');
        setAuthChecked(true);
        return;
      }

      // If user exists but profile not loaded yet, wait
      if (user && !profile) {
        // Profile is still loading, don't make any decisions yet
        return;
      }

      // Now we have both user and profile loaded
      if (profile?.role !== 'teacher') {
        toast.error('Access denied. Only teachers can access the teacher dashboard.');
        router.push('/?error=teacher_only');
      }

      setAuthChecked(true);
    }
  }, [user, profile, loading, router]);

  // Show loading state while checking auth
  // Only show loading if: still loading OR user exists but profile not loaded yet OR auth not checked
  const isLoading = loading || (user && !profile) || !authChecked;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="h-5 w-5 border-2 border-foreground/20 border-t-foreground animate-spin mx-auto" />
          <p className="mt-4 text-sm text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    );
  }

  // Don't render children if not a teacher (will redirect)
  if (!user || profile?.role !== 'teacher') {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  );
}
