'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface SignUpFormProps {
  onSuccess?: () => void;
}

export function SignUpForm({ onSuccess }: SignUpFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  const [loading, setLoading] = useState(false);

  // Invite code state
  const [inviteCode, setInviteCode] = useState('');
  const [codeStatus, setCodeStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle');
  const [codeError, setCodeError] = useState('');

  const router = useRouter();
  const supabase = createClient();

  const validateCode = useCallback(async (code: string) => {
    const cleaned = code.replace(/[-\s]/g, '').toUpperCase();
    if (cleaned.length < 8) {
      setCodeStatus('idle');
      setCodeError('');
      return;
    }

    setCodeStatus('validating');
    setCodeError('');

    try {
      const res = await fetch('/api/auth/validate-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: cleaned }),
      });

      const data = await res.json();
      if (data.valid) {
        setCodeStatus('valid');
        setCodeError('');
      } else {
        setCodeStatus('invalid');
        setCodeError(data.error || 'Invalid code');
      }
    } catch {
      setCodeStatus('invalid');
      setCodeError('Failed to validate code');
    }
  }, []);

  const handleCodeChange = (value: string) => {
    // Auto-format with dash
    const cleaned = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    let formatted = cleaned;
    if (cleaned.length > 4) {
      formatted = `${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}`;
    }
    setInviteCode(formatted);
    setCodeStatus('idle');
    setCodeError('');

    // Auto-validate when 8 chars entered
    if (cleaned.length === 8) {
      validateCode(cleaned);
    }
  };

  const redeemCode = async () => {
    const cleaned = inviteCode.replace(/[-\s]/g, '').toUpperCase();
    try {
      const res = await fetch('/api/auth/redeem-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: cleaned }),
      });
      const data = await res.json();
      if (!data.success) {
        console.error('Failed to redeem invite code:', data.error);
      }
    } catch (error) {
      console.error('Failed to redeem invite code:', error);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (codeStatus !== 'valid') {
      toast.error('Please enter a valid invite code');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;

      // Redeem the invite code after successful signup
      if (data.user && data.session) {
        await redeemCode();
        toast.success('Account created successfully!');
        onSuccess?.();
        router.push('/');
      } else {
        toast.success('Account created! Please check your email to verify your account.');
        onSuccess?.();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to sign up';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    if (codeStatus !== 'valid') {
      toast.error('Please enter a valid invite code first');
      return;
    }

    setLoading(true);

    // Store code in localStorage for the OAuth callback to redeem
    const cleaned = inviteCode.replace(/[-\s]/g, '').toUpperCase();
    localStorage.setItem('agathon_pending_invite_code', cleaned);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/auth/complete-signup`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) throw error;
    } catch (error) {
      localStorage.removeItem('agathon_pending_invite_code');
      const message = error instanceof Error ? error.message : 'Failed to sign up with Google';
      toast.error(message);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 pt-4">
      <form onSubmit={handleEmailSignUp} className="space-y-4">
        {/* Invite Code Field */}
        <div className="space-y-2">
          <Label htmlFor="inviteCode">Invite Code</Label>
          <div className="relative">
            <Input
              id="inviteCode"
              type="text"
              placeholder="XXXX-XXXX"
              value={inviteCode}
              onChange={(e) => handleCodeChange(e.target.value)}
              maxLength={9}
              required
              disabled={loading}
              className={`font-mono text-base tracking-wider pr-10 ${
                codeStatus === 'valid'
                  ? 'border-green-500 focus-visible:ring-green-500'
                  : codeStatus === 'invalid'
                    ? 'border-red-500 focus-visible:ring-red-500'
                    : ''
              }`}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {codeStatus === 'validating' && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
              {codeStatus === 'valid' && (
                <CheckCircle className="h-4 w-4 text-green-500" />
              )}
              {codeStatus === 'invalid' && (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
            </div>
          </div>
          {codeError && (
            <p className="text-xs text-red-500">{codeError}</p>
          )}
          {codeStatus === 'valid' && (
            <p className="text-xs text-green-600">Code verified!</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="fullName">Full Name</Label>
          <Input
            id="fullName"
            type="text"
            placeholder="John Doe"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            disabled={loading || codeStatus !== 'valid'}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="signup-email">Email</Label>
          <Input
            id="signup-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading || codeStatus !== 'valid'}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="signup-password">Password</Label>
          <Input
            id="signup-password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading || codeStatus !== 'valid'}
            minLength={6}
          />
          <p className="text-xs text-muted-foreground">Must be at least 6 characters</p>
        </div>
        <div className="space-y-2">
          <Label>I am a:</Label>
          <div className="flex gap-4">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="role"
                value="student"
                checked={role === 'student'}
                onChange={(e) => setRole(e.target.value as 'student' | 'teacher')}
                disabled={loading || codeStatus !== 'valid'}
                className="h-4 w-4"
              />
              <span className="text-sm">Student</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="role"
                value="teacher"
                checked={role === 'teacher'}
                onChange={(e) => setRole(e.target.value as 'student' | 'teacher')}
                disabled={loading || codeStatus !== 'valid'}
                className="h-4 w-4"
              />
              <span className="text-sm">Teacher</span>
            </label>
          </div>
        </div>
        <Button
          type="submit"
          className="w-full"
          disabled={loading || codeStatus !== 'valid'}
        >
          {loading ? 'Creating account...' : 'Sign Up'}
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleGoogleSignUp}
        disabled={loading || codeStatus !== 'valid'}
      >
        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        Continue with Google
      </Button>
    </div>
  );
}
