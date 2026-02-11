'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/auth-provider';
import { toast } from 'sonner';
import { Loader2, CheckCircle } from 'lucide-react';

export default function CompleteSignupPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<'redeeming' | 'success' | 'error'>('redeeming');

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    const redeemCode = async () => {
      const code = localStorage.getItem('agathon_pending_invite_code');

      if (!code) {
        // No pending code — user signed up previously but redemption didn't complete.
        // Mark them as redeemed since their invite was validated at signup time.
        try {
          await fetch('/api/auth/redeem-invite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ forceRedeem: true }),
          });
        } catch (e) {
          console.error('Force redeem failed:', e);
        }
        router.push('/');
        return;
      }

      try {
        const res = await fetch('/api/auth/redeem-invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });

        const data = await res.json();

        localStorage.removeItem('agathon_pending_invite_code');

        if (data.success) {
          setStatus('success');
          toast.success('Account created successfully!');
          setTimeout(() => router.push('/'), 1500);
        } else {
          console.error('Failed to redeem invite code:', data.error);
          setStatus('error');
          // Still redirect — the user is signed up, code just failed to redeem
          toast.error('Invite code could not be redeemed, but your account was created.');
          setTimeout(() => router.push('/'), 2000);
        }
      } catch (error) {
        console.error('Failed to redeem invite code:', error);
        localStorage.removeItem('agathon_pending_invite_code');
        setStatus('error');
        toast.error('Something went wrong, but your account was created.');
        setTimeout(() => router.push('/'), 2000);
      }
    };

    redeemCode();
  }, [user, authLoading, router]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        {status === 'redeeming' && (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-foreground mx-auto" />
            <p className="mt-4 text-muted-foreground">Setting up your account...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle className="h-8 w-8 text-green-600 mx-auto" />
            <p className="mt-4 text-foreground font-medium">You&apos;re all set!</p>
            <p className="mt-1 text-muted-foreground text-sm">Redirecting...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <p className="text-muted-foreground">Redirecting...</p>
          </>
        )}
      </div>
    </div>
  );
}
