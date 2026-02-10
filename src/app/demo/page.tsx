'use client';

import { useEffect, useRef } from 'react';
import { Logo } from '@/components/ui/logo';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function DemoPage() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => {
        // Autoplay might be blocked, that's okay
      });
    }
  }, []);

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center">
      {/* Header */}
      <div className="absolute top-6 left-6 z-10">
        <Logo size="md" showText className="text-white" />
      </div>

      {/* Video Container */}
      <div className="w-full max-w-6xl px-4">
        <video
          ref={videoRef}
          className="w-full rounded-2xl shadow-2xl"
          controls
          autoPlay
          playsInline
          loop
        >
          <source src="/videos/demo.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      </div>

      {/* Caption */}
      <div className="mt-8 text-center">
        <h1 className="text-2xl font-semibold text-white mb-2">
          AI-Powered Whiteboard Demo
        </h1>
        <p className="text-white/50">
          Draw problems, get instant feedback, and learn by doing.
        </p>
      </div>

      {/* CTA */}
      <Button asChild className="mt-8 rounded-full px-6 h-11 bg-white text-black hover:bg-white/90">
        <Link href="/">
          Try Agathon Free
        </Link>
      </Button>
    </div>
  );
}
