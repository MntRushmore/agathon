'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/auth-provider';
import { toast } from 'sonner';
import { Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function CompleteSignupPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<'loading' | 'need_code' | 'redeeming' | 'success' | 'error'>('loading');
  const [inviteCode, setInviteCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    // If user already has invite_redeemed = true, they don't need to be here
    if (profile?.invite_redeemed) {
      router.push('/');
      return;
    }

    const pendingCode = localStorage.getItem('agathon_pending_invite_code');

    if (!pendingCode) {
      // No pending code — user needs to enter one manually
      setStatus('need_code');
      return;
    }

    // Auto-redeem the pending code from signup flow
    redeemCode(pendingCode);
  }, [user, profile, authLoading, router]);

  const redeemCode = async (code: string) => {
    setStatus('redeeming');
    setErrorMessage('');

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
        setTimeout(() => window.location.href = '/', 1500);
      } else {
        setStatus('need_code');
        setErrorMessage(data.error || 'Invalid invite code. Please try again.');
      }
    } catch (error) {
      console.error('Failed to redeem invite code:', error);
      localStorage.removeItem('agathon_pending_invite_code');
      setStatus('need_code');
      setErrorMessage('Something went wrong. Please enter your invite code.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = inviteCode.trim().replace(/[-\s]/g, '').toUpperCase();
    if (!cleaned) return;

    setSubmitting(true);
    setErrorMessage('');

    try {
      // Validate first
      const validateRes = await fetch('/api/auth/validate-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: cleaned }),
      });

      const validateData = await validateRes.json();

      if (!validateData.valid) {
        setErrorMessage(validateData.error || 'Invalid invite code.');
        setSubmitting(false);
        return;
      }

      // Redeem the code
      await redeemCode(cleaned);
    } catch (error) {
      console.error('Failed to validate invite code:', error);
      setErrorMessage('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-full max-w-sm mx-auto p-6">
        {(status === 'loading' || status === 'redeeming') && (
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-foreground mx-auto" />
            <p className="mt-4 text-muted-foreground">Setting up your account...</p>
          </div>
        )}
        {status === 'success' && (
          <div className="text-center">
            <CheckCircle className="h-8 w-8 text-green-600 mx-auto" />
            <p className="mt-4 text-foreground font-medium">You&apos;re all set!</p>
            <p className="mt-1 text-muted-foreground text-sm">Redirecting...</p>
          </div>
        )}
        {status === 'need_code' && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-foreground">Enter Invite Code</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                An invite code is required to complete your signup.
              </p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-code">Invite Code</Label>
                <Input
                  id="invite-code"
                  type="text"
                  placeholder="ABCD1234"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  required
                  disabled={submitting}
                  autoFocus
                />
              </div>
              {errorMessage && (
                <p className="text-sm text-red-500">{errorMessage}</p>
              )}
              <Button type="submit" className="w-full" disabled={submitting || !inviteCode.trim()}>
                {submitting ? 'Verifying...' : 'Continue'}
              </Button>
            </form>
          </div>
        )}
        {status === 'error' && (
          <div className="text-center">
            <p className="text-muted-foreground">Something went wrong.</p>
            <Button variant="outline" className="mt-4" onClick={() => setStatus('need_code')}>
              Try Again
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
