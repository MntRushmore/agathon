'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight, ChevronDown, Play, Menu, X } from 'lucide-react';
import { WaitlistDialog } from './WaitlistDialog';
import { HowItWorksSection } from './sections/HowItWorksSection';
import { FeaturesSection } from './sections/FeaturesSection';
import { UseCasesSection } from './sections/UseCasesSection';
import { SocraticModeSection } from './sections/SocraticModeSection';
import { PrinciplesSection } from './sections/PrinciplesSection';
import { TestimonialsSection } from './sections/TestimonialsSection';
import { CTASection } from './sections/CTASection';
import { FooterSection } from './sections/FooterSection';

const navItems = [
  { label: 'Home', href: '#hero' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Use cases', href: '#use-cases' },
  { label: 'Socratic Mode', href: '#socratic' },
  { label: 'Principles', href: '#principles' },
];

export function AgoraLandingPage() {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [waitlistRole, setWaitlistRole] = useState<'student' | 'teacher' | 'parent'>('student');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const openWaitlist = (role: 'student' | 'teacher' | 'parent' = 'student') => {
    setWaitlistRole(role);
    setWaitlistOpen(true);
  };

  const handleScroll = useCallback(() => {
    const scrollY = window.scrollY;
    const windowHeight = window.innerHeight;
    const progress = Math.min(Math.max(scrollY / (windowHeight * 0.7), 0), 1);
    setScrollProgress(progress);
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const scrollToSection = (href: string) => {
    setMobileMenuOpen(false);
    if (href === '#hero') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const element = document.querySelector(href);
    element?.scrollIntoView({ behavior: 'smooth' });
  };

  // Smooth easing function
  const ease = (t: number) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const p = ease(scrollProgress);

  // Scale: starts at 1, ends at ~0.4
  const scale = 1 - (p * 0.6);

  // Colors transition at 40% progress
  const isDark = scrollProgress < 0.4;

  return (
    <div className="min-h-screen">
      {/* Hero Section with scroll animation */}
      <div className="h-[200vh] relative">
        <div className="fixed inset-0 overflow-hidden" style={{ zIndex: scrollProgress >= 1 ? -1 : 10 }}>
          {/* Light background */}
          <div
            className="absolute inset-0 bg-[#f5f3f0]"
            style={{ opacity: p }}
          />

          {/* Navigation */}
          <nav className="absolute top-0 left-0 right-0 z-50 px-6 lg:px-16 py-5">
            <div className="max-w-[1400px] mx-auto flex items-center justify-between">
              <button onClick={() => scrollToSection('#hero')}>
                <img
                  src="/logo/agathonwide.png"
                  alt="agathon"
                  className="h-7"
                  style={{
                    filter: isDark ? 'none' : 'invert(1)',
                    transition: 'filter 0.3s ease',
                  }}
                />
              </button>

              {/* Desktop Nav */}
              <div className="hidden md:flex items-center gap-8">
                {navItems.map((item, index) => (
                  <button
                    key={item.label}
                    onClick={() => scrollToSection(item.href)}
                    className="text-[13px] font-medium flex items-center gap-1"
                    style={{
                      color: isDark ? 'rgba(255,255,255,0.85)' : '#4a4a4a',
                      transition: 'color 0.3s ease',
                    }}
                  >
                    {item.label}
                    {index === 1 && <ChevronDown className="w-3.5 h-3.5 opacity-60" />}
                  </button>
                ))}
              </div>

              {/* Mobile Menu Button */}
              <button
                className="md:hidden p-2"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                style={{ color: isDark ? '#fff' : '#1a1a1a' }}
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>

              {/* Desktop CTA */}
              <Button
                className="hidden md:flex rounded-full px-5 h-9 text-[13px] font-medium"
                style={{
                  backgroundColor: isDark ? 'transparent' : '#1a1a1a',
                  color: '#ffffff',
                  border: isDark ? '1px solid rgba(255,255,255,0.25)' : '1px solid transparent',
                  transition: 'all 0.3s ease',
                }}
                onClick={() => openWaitlist()}
              >
                Join Waitlist
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </div>

            {/* Mobile Menu */}
            {mobileMenuOpen && (
              <div
                className="md:hidden absolute top-full left-0 right-0 p-6 mt-2 mx-4 rounded-2xl shadow-xl"
                style={{
                  backgroundColor: isDark ? 'rgba(0,0,0,0.9)' : '#ffffff',
                }}
              >
                <div className="space-y-4">
                  {navItems.map((item) => (
                    <button
                      key={item.label}
                      onClick={() => scrollToSection(item.href)}
                      className="block w-full text-left text-[15px] font-medium py-2"
                      style={{ color: isDark ? '#fff' : '#1a1a1a' }}
                    >
                      {item.label}
                    </button>
                  ))}
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

          {/* Image Container */}
          <div id="hero" className="absolute inset-0 flex items-center justify-center">
            <div
              className="relative w-full h-full"
              style={{
                transform: `scale(${scale})`,
                transformOrigin: 'center center',
              }}
            >
              {/* Frame layers */}
              <div
                className="absolute inset-0 m-auto"
                style={{
                  width: 'calc(100% + 32px)',
                  height: 'calc(100% + 32px)',
                  left: '-16px',
                  top: '-16px',
                  background: 'linear-gradient(145deg, #c4a574 0%, #8b7355 15%, #6b5344 50%, #8b7355 85%, #c4a574 100%)',
                  borderRadius: `${p * 12}px`,
                  boxShadow: `0 ${10 + p * 20}px ${40 + p * 40}px rgba(0,0,0,${0.1 + p * 0.25})`,
                  opacity: p,
                  transition: 'opacity 0.15s ease',
                }}
              />
              <div
                className="absolute inset-0 m-auto"
                style={{
                  width: 'calc(100% + 16px)',
                  height: 'calc(100% + 16px)',
                  left: '-8px',
                  top: '-8px',
                  background: 'linear-gradient(145deg, #d4b896 0%, #a08060 50%, #d4b896 100%)',
                  borderRadius: `${p * 8}px`,
                  opacity: p,
                  transition: 'opacity 0.15s ease',
                }}
              />

              {/* Image */}
              <div
                className="relative w-full h-full overflow-hidden"
                style={{
                  borderRadius: `${p * 6}px`,
                }}
              >
                <img
                  src="/landing/garden.jpg"
                  alt="Classical garden scene"
                  className="w-full h-full object-cover"
                />
                {/* Dark overlay */}
                <div
                  className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/30"
                  style={{
                    opacity: 1 - p,
                    transition: 'opacity 0.15s ease',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Hero Content */}
          <div className="absolute inset-0 flex items-end pb-16 lg:pb-20 px-6 lg:px-16 pointer-events-none">
            <div className="max-w-[1400px] mx-auto w-full pointer-events-auto">
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 lg:gap-16">
                {/* Left side */}
                <div className="space-y-5">
                  <div
                    className="flex items-center gap-5 text-[13px] font-medium"
                    style={{
                      color: isDark ? 'rgba(255,255,255,0.7)' : '#9ca3af',
                      transition: 'color 0.3s ease',
                    }}
                  >
                    <span>Private by default</span>
                    <span>No feeds</span>
                    <span>No noise</span>
                  </div>
                  <h1
                    className="text-[clamp(2.5rem,6vw,4.5rem)] font-light leading-[1.05] tracking-[-0.02em]"
                    style={{
                      color: isDark ? '#ffffff' : '#1a1a1a',
                      transition: 'color 0.3s ease',
                    }}
                  >
                    A place to think,
                    <br />
                    not just write.
                  </h1>
                </div>

                {/* Right side */}
                <div className="lg:max-w-[380px] space-y-5">
                  <div className="space-y-2">
                    <p
                      className="text-[15px]"
                      style={{
                        color: isDark ? 'rgba(255,255,255,0.95)' : '#1a1a1a',
                        transition: 'color 0.3s ease',
                      }}
                    >
                      <span className="font-semibold">agathon</span> is an AI Socratic whiteboard.
                    </p>
                    <p
                      className="text-[14px] leading-relaxed"
                      style={{
                        color: isDark ? 'rgba(255,255,255,0.6)' : '#6b7280',
                        transition: 'color 0.3s ease',
                      }}
                    >
                      Draw your problems, and let AI guide you through them
                      with thoughtful questions—helping you discover
                      answers yourself.
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <Button
                      className="rounded-full px-6 h-11 text-[14px] font-medium"
                      style={{
                        backgroundColor: isDark ? '#ffffff' : '#1a1a1a',
                        color: isDark ? '#1a1a1a' : '#ffffff',
                        boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.3)' : 'none',
                        transition: 'all 0.3s ease',
                      }}
                      onClick={() => openWaitlist()}
                    >
                      Get Early Access
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                    <button
                      className="flex items-center gap-2 text-[13px] font-medium"
                      style={{
                        color: isDark ? 'rgba(255,255,255,0.7)' : '#6b7280',
                        transition: 'color 0.3s ease',
                      }}
                      onClick={() => scrollToSection('#how-it-works')}
                    >
                      <div
                        className="w-8 h-8 rounded-full border flex items-center justify-center"
                        style={{
                          borderColor: isDark ? 'rgba(255,255,255,0.3)' : '#d1d5db',
                          color: isDark ? 'rgba(255,255,255,0.7)' : '#4b5563',
                          transition: 'all 0.3s ease',
                        }}
                      >
                        <Play className="w-3 h-3 ml-0.5" fill="currentColor" />
                      </div>
                      See how it works
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Sections */}
      <div className="relative bg-[#f5f3f0]" style={{ zIndex: 20 }}>
        <HowItWorksSection />
        <FeaturesSection />
        <UseCasesSection onJoinWaitlist={(role) => openWaitlist(role as 'student' | 'teacher' | 'parent')} />
        <SocraticModeSection />
        <PrinciplesSection />
        <TestimonialsSection />
        <CTASection />
        <FooterSection />
      </div>

      {/* Waitlist Dialog */}
      <WaitlistDialog open={waitlistOpen} onOpenChange={setWaitlistOpen} defaultRole={waitlistRole} />
    </div>
  );
}
