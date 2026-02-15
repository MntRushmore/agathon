'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { ArrowRight, Menu, X } from 'lucide-react';
import { WaitlistDialog } from './WaitlistDialog';
import { animate, stagger } from 'animejs';

export function AgoraLandingPage() {
  const searchParams = useSearchParams();
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [waitlistRole, setWaitlistRole] = useState<'student' | 'teacher' | 'parent'>('student');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const heroContentRef = useRef<HTMLDivElement>(null);

  // Hero entrance animations
  useEffect(() => {
    if (!heroContentRef.current) return;

    // Tagline words stagger
    const taglineWords = heroContentRef.current.querySelectorAll('[data-tagline-word]');
    if (taglineWords.length > 0) {
      animate(taglineWords, {
        opacity: [0, 1],
        translateY: [30, 0],
        delay: stagger(100, { start: 200 }),
        duration: 600,
        ease: 'outQuint',
      });
    }

    // Heading slide-up
    const heading = heroContentRef.current.querySelector('[data-hero-heading]');
    if (heading) {
      animate(heading, {
        opacity: [0, 1],
        translateY: [30, 0],
        delay: 600,
        duration: 700,
        ease: 'outQuint',
      });
    }

    // Right side content (subtitle + CTA)
    const rightElements = heroContentRef.current.querySelectorAll('[data-hero-right]');
    if (rightElements.length > 0) {
      animate(rightElements, {
        opacity: [0, 1],
        translateY: [20, 0],
        delay: stagger(150, { start: 800 }),
        duration: 600,
        ease: 'outQuint',
      });
    }

    // CTA button scale-in
    const cta = heroContentRef.current.querySelector('[data-hero-cta]');
    if (cta) {
      animate(cta, {
        opacity: [0, 1],
        scale: [0.95, 1],
        delay: 1100,
        duration: 500,
        ease: 'outQuint',
      });
    }
  }, []);

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
    <div className="h-screen overflow-hidden serif-headings">
      {/* Hero Section - Full screen, no scroll */}
      <div className="fixed inset-0 overflow-hidden">
        {/* Navigation */}
        <nav aria-label="Main navigation" className="absolute top-0 left-0 right-0 z-50 px-6 lg:px-16 py-5">
          <div className="max-w-[1400px] mx-auto flex items-center justify-between">
            <div>
              <Image
                src="/logo/logowhite.png"
                alt="Agathon — AI Socratic whiteboard for learning"
                width={160}
                height={40}
                className="h-10 w-auto"
                priority
              />
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2 text-white"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" aria-hidden="true" /> : <Menu className="w-6 h-6" aria-hidden="true" />}
            </button>

            {/* Desktop CTA */}
            <div className="hidden md:flex items-center gap-3">
              <Button
                className="rounded-full px-5 h-9 text-[13px] font-medium bg-transparent text-white border border-white/40 hover:bg-white/10"
                onClick={() => openWaitlist()}
              >
                Join Waitlist
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" aria-hidden="true" />
              </Button>
              <Button
                className="rounded-full px-5 h-9 text-[13px] font-medium bg-white/15 text-white hover:bg-white/25"
                onClick={() => window.location.href = '/login'}
              >
                Login
              </Button>
            </div>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden absolute top-full left-0 right-0 p-6 mt-2 mx-4 rounded-2xl shadow-xl bg-black/90" role="menu">
              <div className="space-y-4">
                <Button
                  className="w-full mt-4"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    openWaitlist();
                  }}
                  role="menuitem"
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
              <Image
                src="/landing/AgathonBackground.jpeg"
                alt="Students collaborating on a whiteboard — the Agathon learning experience"
                fill
                className="object-cover"
                priority
                sizes="100vw"
                quality={75}
              />
              {/* Dark overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/30" />
            </div>
          </div>
        </div>

        {/* Hero Content */}
        <div ref={heroContentRef} className="absolute inset-0 flex items-end pb-16 lg:pb-20 px-6 lg:px-16 pointer-events-none">
          <div className="max-w-[1400px] mx-auto w-full pointer-events-auto">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 lg:gap-16">
              {/* Left side */}
              <div className="space-y-5">
                <div className="flex items-center gap-5 text-[13px] font-medium text-white/80">
                  <span data-tagline-word className="opacity-0">Draw freely</span>
                  <span data-tagline-word className="opacity-0">Think visually</span>
                  <span data-tagline-word className="opacity-0">Learn deeply</span>
                </div>
                <h1 data-hero-heading className="text-[clamp(2.5rem,6vw,4.5rem)] font-light leading-[1.05] tracking-[-0.02em] text-white opacity-0">
                  Transform Your Learning
                  <br />
                  Experience Today
                </h1>
              </div>

              {/* Right side */}
              <div className="lg:max-w-[380px] space-y-5">
                <div data-hero-right className="space-y-2 opacity-0">
                  <p className="text-[15px] text-white">
                    <span className="font-semibold">Agathon</span> is an AI Socratic whiteboard.
                  </p>
                  <p className="text-[14px] leading-relaxed text-white/75">
                    Receive personalized hints and solve problems effectively.
                    Draw naturally, and let AI guide you through thoughtful
                    questions — helping you discover answers yourself.
                  </p>
                </div>
                <div data-hero-cta className="flex items-center gap-4 opacity-0">
                  <Button
                    className="rounded-full px-6 h-11 text-[14px] font-medium bg-white text-black hover:bg-white/90 shadow-lg hover:scale-[1.02] transition-transform"
                    style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}
                    onClick={() => openWaitlist()}
                  >
                    Join Waitlist Now!
                    <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
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
