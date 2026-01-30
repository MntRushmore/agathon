'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth/auth-provider';
import { SignUpForm } from '@/components/auth/sign-up-form';
import Image from 'next/image';

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
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-[#1a1a1a] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex">
      {/* Left side - Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Logo */}
          <Link href="/" className="inline-flex items-center gap-2 mb-12">
            <Image
              src="/logo/agathon.png"
              alt="Agathon"
              width={32}
              height={32}
              className="rounded-lg"
            />
            <span className="font-semibold text-[#1a1a1a]">Agathon</span>
          </Link>

          {/* Title */}
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-[#1a1a1a] mb-2">
              Create your account
            </h1>
            <p className="text-[#666]">
              Enter your invite code to get started
            </p>
          </div>

          {/* Sign Up Form */}
          <SignUpForm onSuccess={() => router.push('/')} />

          {/* Login link */}
          <p className="text-center text-sm text-[#666] mt-6">
            Already have an account?{' '}
            <Link href="/login" className="text-[#1a1a1a] font-medium hover:underline">
              Sign in
            </Link>
          </p>

          {/* Footer links */}
          <div className="mt-12 pt-6 border-t border-[#E8E4DC]">
            <p className="text-xs text-[#999] text-center">
              By continuing, you agree to our{' '}
              <Link href="/terms" className="text-[#666] hover:underline">
                Terms
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="text-[#666] hover:underline">
                Privacy Policy
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Right side - Branding (hidden on mobile) */}
      <div className="hidden lg:flex flex-1 bg-[#1a1a1a] items-center justify-center p-12">
        <div className="max-w-md text-center">
          <Image
            src="/logo/agathon.png"
            alt="Agathon"
            width={80}
            height={80}
            className="mx-auto mb-8 rounded-2xl"
          />
          <h2 className="text-3xl font-semibold text-white mb-4">
            Learn smarter, not harder
          </h2>
          <p className="text-[#999] text-lg">
            Agathon helps you understand concepts deeply with AI-powered hints
            and guidance—never just giving you the answer.
          </p>
        </div>
      </div>
    </div>
  );
}
