'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { House, ArrowLeft, Compass } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';

const quips = [
  "Even Socrates got lost sometimes.",
  "This path leads nowhere — but at least you know that now.",
  "The unexamined URL is not worth visiting.",
  "Aristotle never found this page either.",
  "You've wandered off the agora, friend.",
  "404 drachmas says this page doesn't exist.",
  "Not all who wander are lost. But you are.",
  "This scroll has been misplaced by the librarians.",
];

export default function NotFound() {
  const [quip, setQuip] = useState('');
  const [wobble, setWobble] = useState(false);

  useEffect(() => {
    setQuip(quips[Math.floor(Math.random() * quips.length)]);
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        {/* Animated compass */}
        <div className="mb-6 flex justify-center">
          <button
            onClick={() => {
              setWobble(true);
              setQuip(quips[Math.floor(Math.random() * quips.length)]);
              setTimeout(() => setWobble(false), 600);
            }}
            className="group relative cursor-pointer"
            aria-label="Spin for a new message"
          >
            <div className="h-20 w-20 rounded-full bg-muted/60 border-2 border-dashed border-border flex items-center justify-center transition-colors group-hover:border-primary/30 group-hover:bg-muted">
              <Compass
                className={`h-9 w-9 text-muted-foreground/70 group-hover:text-primary/60 transition-all duration-500 ${wobble ? 'animate-[spin_0.6s_ease-in-out]' : ''}`}
                weight="duotone"
              />
            </div>
          </button>
        </div>

        {/* 404 number */}
        <p className="text-[11px] font-medium text-muted-foreground/50 uppercase tracking-[0.2em] mb-2">
          Page not found
        </p>
        <h1
          className="text-6xl font-bold text-foreground/10 mb-4 select-none"
          style={{ fontFamily: 'var(--font-serif, Georgia), Georgia, serif', letterSpacing: '-0.04em' }}
        >
          404
        </h1>

        {/* Quip */}
        <p
          className="text-[14px] text-muted-foreground leading-relaxed mb-1 min-h-[3em] transition-opacity duration-300"
          style={{ fontStyle: 'italic' }}
        >
          &ldquo;{quip}&rdquo;
        </p>
        <p className="text-[11px] text-muted-foreground/40 mb-8">
          Click the compass for more wisdom
        </p>

        {/* Actions */}
        <div className="flex items-center justify-center gap-2">
          <Button asChild size="sm" className="h-9 px-5 text-[13px] gap-2">
            <Link href="/">
              <House className="h-4 w-4" weight="duotone" />
              Go home
            </Link>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.history.back()}
            className="h-9 px-5 text-[13px] gap-2 text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4" weight="duotone" />
            Go back
          </Button>
        </div>
      </div>
    </div>
  );
}
