'use client';

import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/ui/logo';
import { ArrowRight, Play, Sparkle, Brain, Users, Notebook, Trophy } from '@phosphor-icons/react';

interface WelcomeModalProps {
  open: boolean;
  onComplete: () => void;
  userName?: string;
  /** The invite code used to sign up — enables custom welcome for specific codes */
  inviteCode?: string;
}

const STEPS = ['welcome', 'story', 'video', 'coming-soon'] as const;
type Step = (typeof STEPS)[number];

/** Map of invite codes to custom welcome configurations */
const CUSTOM_WELCOMES: Record<string, {
  welcomeTitle: string;
  welcomeSubtitle: string;
  founderMessage: string[];
  founderSignoff: string;
}> = {
  ISTEASCD: {
    welcomeTitle: 'Welcome, Judges!',
    welcomeSubtitle: 'Thank you for taking the time to check out Agathon. We\'re honored to have you here.',
    founderMessage: [
      'Hey! 👋',
      'We\'re Rushil & Luca — two students who got tired of staring at problem sets alone at 2am with no help in sight. So we built Agathon.',
      'What you\'re about to see is our AI-powered whiteboard: draw a problem, lasso it, and get instant step-by-step tutoring. It\'s the tutor we wish we\'d had.',
      'This is still early — we\'re in alpha — but we\'d love for you to try it hands-on. Create a board, scribble a math problem, and circle it. The AI does the rest.',
    ],
    founderSignoff: '— Rushil & Luca, Co-Founders',
  },
};

export function WelcomeModal({ open, onComplete, userName, inviteCode }: WelcomeModalProps) {
  const [step, setStep] = useState<Step>('welcome');
  const currentIndex = STEPS.indexOf(step);

  // Look up custom welcome config by normalized code
  const normalizedCode = inviteCode?.replace(/[-\s]/g, '').toUpperCase() ?? '';
  const customWelcome = CUSTOM_WELCOMES[normalizedCode];

  const next = () => {
    if (currentIndex < STEPS.length - 1) {
      setStep(STEPS[currentIndex + 1]);
    } else {
      onComplete();
    }
  };

  const back = () => {
    if (currentIndex > 0) {
      setStep(STEPS[currentIndex - 1]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-xl max-h-[90vh] overflow-y-auto p-0 gap-0 bg-card border border-border rounded-xl"
      >
        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 pt-5">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === currentIndex
                  ? 'w-6 bg-foreground'
                  : i < currentIndex
                    ? 'w-1.5 bg-muted-foreground'
                    : 'w-1.5 bg-muted'
              }`}
            />
          ))}
        </div>

        <div className="p-6 pt-4">
          {step === 'welcome' && (
            <WelcomeStep
              userName={userName}
              onNext={next}
              custom={customWelcome}
            />
          )}
          {step === 'story' && (
            <StoryStep onNext={next} onBack={back} />
          )}
          {step === 'video' && (
            <VideoStep onNext={next} onBack={back} />
          )}
          {step === 'coming-soon' && (
            <ComingSoonStep onComplete={onComplete} onBack={back} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function WelcomeStep({ userName, onNext, custom }: {
  userName?: string;
  onNext: () => void;
  custom?: typeof CUSTOM_WELCOMES[string];
}) {
  return (
    <div className="text-center space-y-5">
      <Logo size="lg" className="mx-auto" />

      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          {custom?.welcomeTitle ?? `Welcome${userName ? `, ${userName.split(' ')[0]}` : ''}!`}
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed max-w-sm mx-auto">
          {custom?.welcomeSubtitle ?? 'We\'re so glad you\'re here. Before you dive in, we wanted to share a quick message with you.'}
        </p>
      </div>

      {/* Message from founders */}
      <div className="bg-muted rounded-xl p-5 text-left space-y-3 border border-border">
        {custom ? (
          <>
            {custom.founderMessage.map((paragraph, i) => (
              <p key={i} className="text-sm leading-relaxed text-foreground">
                {paragraph}
              </p>
            ))}
            <div className="pt-1">
              <div className="text-sm font-medium text-foreground">
                {custom.founderSignoff}
              </div>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm leading-relaxed text-foreground">
              Hey there 👋
            </p>
            <p className="text-sm leading-relaxed text-foreground">
              We&apos;re Rushil &amp; Luca, the co-founders of Agathon. We built this because
              we believe every student deserves a personal tutor that&apos;s always
              available, infinitely patient, and actually helpful.
            </p>
            <p className="text-sm leading-relaxed text-foreground">
              You&apos;re one of our earliest users, and that means the world to us.
              We&apos;d love to hear what you think — the good, the bad, all of it.
            </p>
            <div className="pt-1">
              <div className="text-sm font-medium text-foreground">
                — Rushil &amp; Luca
              </div>
            </div>
          </>
        )}
      </div>

      <Button onClick={onNext} className="w-full h-11 gap-2">
        Continue
        <ArrowRight size={16} weight="bold" />
      </Button>
    </div>
  );
}

function StoryStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  return (
    <div className="space-y-5">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">The Story Behind Agathon</h2>
        <p className="text-muted-foreground text-sm">Why we&apos;re building this</p>
      </div>

      <div className="space-y-4 text-sm leading-relaxed text-foreground">
        <p>
          It started with a simple frustration: studying alone sucks. You&apos;re staring at
          a problem set at 2am, your professor&apos;s office hours ended 8 hours ago, and
          the textbook might as well be written in hieroglyphics.
        </p>
        <p>
          We&apos;ve been there. As students ourselves, we knew there had to be a better way.
          So we built Agathon — an AI-powered whiteboard where you can draw out problems,
          get step-by-step guidance, and actually <span className="font-medium">learn by doing</span>,
          not just get answers.
        </p>
        <p>
          The name comes from the ancient Greek word <span className="italic">agathon</span> (ἀγαθόν) — meaning
          &quot;the good.&quot; We want learning to feel good again.
        </p>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1 h-11">
          Back
        </Button>
        <Button onClick={onNext} className="flex-1 h-11 gap-2">
          Continue
          <ArrowRight size={16} weight="bold" />
        </Button>
      </div>
    </div>
  );
}

function VideoStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  return (
    <div className="space-y-5">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 bg-muted rounded-full px-3 py-1 text-xs font-medium text-muted-foreground border border-border">
          <Play size={12} weight="fill" />
          Quick Demo
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">See Agathon in Action</h2>
        <p className="text-muted-foreground text-sm">
          Watch how the AI whiteboard works — it&apos;s pretty magical.
        </p>
      </div>

      <div className="rounded-xl overflow-hidden border border-border bg-muted">
        <video
          className="w-full"
          controls
          autoPlay
          playsInline
          preload="metadata"
        >
          <source src="/videos/demo.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1 h-11">
          Back
        </Button>
        <Button onClick={onNext} className="flex-1 h-11 gap-2">
          Continue
          <ArrowRight size={16} weight="bold" />
        </Button>
      </div>
    </div>
  );
}

function ComingSoonStep({ onComplete, onBack }: { onComplete: () => void; onBack: () => void }) {
  const features = [
    {
      icon: Brain,
      title: 'Smarter AI Tutor',
      description: 'Even deeper understanding of your work with multi-step problem solving.',
      color: 'green' as const,
    },
    {
      icon: Notebook,
      title: 'Study Guides & Notes',
      description: 'Auto-generated study materials from your whiteboard sessions.',
      color: 'blue' as const,
    },
    {
      icon: Users,
      title: 'Collaborative Boards',
      description: 'Work through problems with classmates in real-time.',
      color: 'purple' as const,
    },
    {
      icon: Sparkle,
      title: 'More Subjects',
      description: 'Expanding beyond math to physics, chemistry, and more.',
      color: 'amber' as const,
    },
  ];

  const iconColors = {
    green: 'icon-container icon-container-green',
    blue: 'icon-container',
    purple: 'icon-container',
    amber: 'icon-container',
  };

  return (
    <div className="space-y-5">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">What&apos;s Coming Soon</h2>
        <p className="text-muted-foreground text-sm">
          We&apos;re just getting started. Here&apos;s what&apos;s on the horizon.
        </p>
      </div>

      <div className="grid gap-3">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="flex items-start gap-3 p-3 rounded-xl bg-card border border-border hover:bg-muted transition-colors"
          >
            <div className={`mt-0.5 ${iconColors[feature.color]} icon-container-sm`}>
              <feature.icon size={16} weight="duotone" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{feature.title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1 h-11">
          Back
        </Button>
        <Button onClick={onComplete} className="flex-1 h-11 gap-2">
          Let&apos;s Go!
          <Sparkle size={16} weight="fill" />
        </Button>
      </div>
    </div>
  );
}
