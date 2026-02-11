'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth/auth-provider';
import { SignUpForm } from '@/components/auth/sign-up-form';
import { CircleNotch } from '@phosphor-icons/react';
import { motion } from 'motion/react';
import { Logo } from '@/components/ui/logo';

export default function SignupPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <CircleNotch className="h-6 w-6 animate-spin text-muted-foreground" weight="duotone" />
      </div>
    );
  }

  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left side - Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="w-full max-w-sm"
        >
          {/* Logo */}
          <Link href="/" className="inline-flex items-center gap-2 mb-12">
            <Logo size="sm" showText />
          </Link>

          {/* Title */}
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-foreground mb-2">
              Create your account
            </h1>
            <p className="text-muted-foreground">
              Enter your invite code to get started
            </p>
          </div>

          {/* Sign Up Form */}
          <SignUpForm onSuccess={() => router.push('/')} />

          {/* Login link */}
          <p className="text-center text-sm text-muted-foreground mt-6">
            Already have an account?{' '}
            <Link href="/login" className="text-foreground font-medium hover:underline">
              Sign in
            </Link>
          </p>

          {/* Footer links */}
          <div className="mt-12 pt-6 border-t border-border">
            <p className="text-xs text-muted-foreground/70 text-center">
              By continuing, you agree to our{' '}
              <Link href="/terms" className="text-muted-foreground hover:underline">
                Terms
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="text-muted-foreground hover:underline">
                Privacy Policy
              </Link>
            </p>
          </div>
        </motion.div>
      </div>

      {/* Right side - Branding (hidden on mobile) */}
      <div className="hidden lg:flex flex-1 bg-foreground items-center justify-center p-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.15, ease: 'easeOut' }}
          className="max-w-md text-center"
        >
          <Logo size="xl" className="mx-auto mb-8" />
          <h2 className="text-3xl font-semibold text-background mb-4">
            Learn smarter, not harder
          </h2>
          <p className="text-background/60 text-lg">
            Agathon helps you understand concepts deeply with AI-powered hints
            and guidance—never just giving you the answer.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
