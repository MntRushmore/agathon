'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/auth/auth-provider';
import { PDFAnnotator } from '@/components/annotate/PDFAnnotator';

export default function AnnotatePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileId = searchParams.get('file');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/?auth=required');
    }
  }, [user, loading, router]);

  if (loading || !user) return null;

  return <PDFAnnotator userId={user.id} fileId={fileId} />;
}
