'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowRight, Menu, X } from 'lucide-react';
import { WaitlistDialog } from './WaitlistDialog';

export function AgoraLandingPage() {
  const searchParams = useSearchParams();
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [waitlistRole, setWaitlistRole] = useState<'student' | 'teacher' | 'parent'>('student');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Open waitlist dialog if ?waitlist=true is in URL
  useEffect(() => {
    if (searchParams.get('waitlist') === 'true') {
      setWaitlistOpen(true);
    }
  }, [searchParams]);

  const openWaitlist = (role: 'student' | 'teacher' | 'parent' = 'student') => {
    setWaitlistRole(role);
    setWaitlistOpen(true);
  };

  return (
    <div className="h-screen overflow-hidden">
      {/* Hero Section - Full screen, no scroll */}
      <div className="fixed inset-0 overflow-hidden">
        {/* Navigation */}
        <nav className="absolute top-0 left-0 right-0 z-50 px-6 lg:px-16 py-5">
          <div className="max-w-[1400px] mx-auto flex items-center justify-between">
            <div>
              <img
                src="/logo/logowhite.png"
                alt="agathon"
                className="h-10"
              />
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2 text-white"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>

            {/* Desktop CTA */}
            <div className="hidden md:flex items-center gap-3">
              <Button
                className="rounded-full px-5 h-9 text-[13px] font-medium bg-transparent text-white border border-white/25 hover:bg-white/10"
                onClick={() => openWaitlist()}
              >
                Join Waitlist
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
              <Button
                className="rounded-full px-5 h-9 text-[13px] font-medium bg-white/10 text-white hover:bg-white/20"
                onClick={() => window.location.href = '/login'}
              >
                Login
              </Button>
            </div>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden absolute top-full left-0 right-0 p-6 mt-2 mx-4 rounded-2xl shadow-xl bg-black/90">
              <div className="space-y-4">
                <Button
                  className="w-full mt-4"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    openWaitlist();
                  }}
                >
                  Join Waitlist
                </Button>
              </div>
            </div>
          )}
        </nav>

        {/* Image Container - Full screen */}
        <div id="hero" className="absolute inset-0">
          <div className="relative w-full h-full">
            {/* Image */}
            <div className="relative w-full h-full overflow-hidden">
              <img
                src="/landing/AgathonBackground.jpeg"
                alt="Agathon background"
                className="w-full h-full object-cover"
              />
              {/* Dark overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/30" />
            </div>
          </div>
        </div>

        {/* Hero Content */}
        <div className="absolute inset-0 flex items-end pb-16 lg:pb-20 px-6 lg:px-16 pointer-events-none">
          <div className="max-w-[1400px] mx-auto w-full pointer-events-auto">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 lg:gap-16">
              {/* Left side */}
              <div className="space-y-5">
                <div className="flex items-center gap-5 text-[13px] font-medium text-white/70">
                  <span>Draw freely</span>
                  <span>Think visually</span>
                  <span>Learn deeply</span>
                </div>
                <h1 className="text-[clamp(2.5rem,6vw,4.5rem)] font-light leading-[1.05] tracking-[-0.02em] text-white">
                  A place to think,
                  <br />
                  not just write.
                </h1>
              </div>

              {/* Right side */}
              <div className="lg:max-w-[380px] space-y-5">
                <div className="space-y-2">
                  <p className="text-[15px] text-white/95">
                    <span className="font-semibold">agathon</span> is an AI Socratic whiteboard.
                  </p>
                  <p className="text-[14px] leading-relaxed text-white/60">
                    Draw your problems, and let AI guide you through them
                    with thoughtful questions—helping you discover
                    answers yourself.
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <Button
                    className="rounded-full px-6 h-11 text-[14px] font-medium bg-white text-black hover:bg-white/90"
                    style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}
                    onClick={() => openWaitlist()}
                  >
                    Get Early Access
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Waitlist Dialog */}
      <WaitlistDialog open={waitlistOpen} onOpenChange={setWaitlistOpen} defaultRole={waitlistRole} />
    </div>
  );
}
