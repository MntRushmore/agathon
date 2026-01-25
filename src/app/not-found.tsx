'use client';

import Link from 'next/link';
import { Home, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <div className="mb-8">
          <span className="text-8xl font-bold text-[#E8E4DC]">404</span>
        </div>

        <h1 className="text-2xl font-semibold text-[#1a1a1a] mb-3">
          Page not found
        </h1>

        <p className="text-[#666] mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            asChild
            className="bg-[#1a1a1a] hover:bg-[#333] text-white rounded-xl h-11 px-6"
          >
            <Link href="/">
              <Home className="h-4 w-4 mr-2" />
              Go home
            </Link>
          </Button>

          <Button
            variant="ghost"
            onClick={() => window.history.back()}
            className="text-[#666] hover:text-[#1a1a1a] rounded-xl h-11 px-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go back
          </Button>
        </div>
      </div>
    </div>
  );
}
