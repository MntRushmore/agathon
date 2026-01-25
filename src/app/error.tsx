'use client';

import { useEffect } from 'react';
import { RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <div className="mb-8">
          <div className="h-16 w-16 mx-auto rounded-full bg-red-50 flex items-center justify-center">
            <span className="text-2xl">!</span>
          </div>
        </div>

        <h1 className="text-2xl font-semibold text-[#1a1a1a] mb-3">
          Something went wrong
        </h1>

        <p className="text-[#666] mb-8">
          We encountered an unexpected error. Our team has been notified.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            onClick={reset}
            className="bg-[#1a1a1a] hover:bg-[#333] text-white rounded-xl h-11 px-6"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Try again
          </Button>

          <Button
            asChild
            variant="ghost"
            className="text-[#666] hover:text-[#1a1a1a] rounded-xl h-11 px-6"
          >
            <Link href="/">
              <Home className="h-4 w-4 mr-2" />
              Go home
            </Link>
          </Button>
        </div>

        {error.digest && (
          <p className="mt-8 text-xs text-[#999]">
            Error ID: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
