'use client';

import { useEffect, useState } from 'react';
import { logger } from '@/lib/logger';
import { ArrowCounterClockwise, House, Lightning } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const quips = [
  "Mistakes are proof that you're trying. — Ancient proverb (and us, right now)",
  "The only real mistake is the one from which we learn nothing. — Henry Ford",
  "To err is human. To reload, divine.",
  "Even the best scrolls get torn sometimes.",
  "A bug in the agora! The philosophers are investigating.",
  "Plato's cave had fewer issues than this.",
  "Knowledge is knowing this broke. Wisdom is clicking Try Again.",
  "The oracle didn't see this one coming.",
];

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [quip] = useState(() => quips[Math.floor(Math.random() * quips.length)]);
  const [crackle, setCrackle] = useState(false);

  useEffect(() => {
    try { logger.error({ error }, 'Application error'); } catch { /* ignore */ }
  }, [error]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        {/* Lightning icon with crackle animation */}
        <div className="mb-6 flex justify-center">
          <div
            className={`h-20 w-20 rounded-full bg-[oklch(0.96_0.003_260)] dark:bg-[oklch(0.20_0.005_260)] border-2 border-dashed border-[oklch(0.88_0.003_260)] dark:border-[oklch(0.30_0.005_260)] flex items-center justify-center transition-all duration-200 ${crackle ? 'scale-95' : ''}`}
          >
            <Lightning
              className={`h-9 w-9 text-[oklch(0.52_0.11_225)]/70 transition-transform duration-150 ${crackle ? 'scale-125 rotate-12' : ''}`}
              weight="duotone"
            />
          </div>
        </div>

        {/* Title */}
        <p className="text-[11px] font-medium text-muted-foreground/50 uppercase tracking-[0.2em] mb-2">
          Something went wrong
        </p>
        <h1
          className="text-5xl font-bold text-foreground/10 mb-4 select-none"
          style={{ fontFamily: 'var(--font-serif, Georgia), Georgia, serif', letterSpacing: '-0.04em' }}
        >
          Oops
        </h1>

        {/* Quip */}
        <p
          className="text-[14px] text-muted-foreground leading-relaxed mb-8 min-h-[3em]"
          style={{ fontStyle: 'italic' }}
        >
          &ldquo;{quip}&rdquo;
        </p>

        {/* Actions */}
        <div className="flex items-center justify-center gap-2">
          <Button
            size="sm"
            className="h-9 px-5 text-[13px] gap-2"
            onClick={() => {
              setCrackle(true);
              setTimeout(() => {
                setCrackle(false);
                reset();
              }, 200);
            }}
          >
            <ArrowCounterClockwise className="h-4 w-4" weight="duotone" />
            Try again
          </Button>

          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-9 px-5 text-[13px] gap-2 text-muted-foreground"
          >
            <Link href="/">
              <House className="h-4 w-4" weight="duotone" />
              Go home
            </Link>
          </Button>
        </div>

        {/* Error ID */}
        {error.digest && (
          <p className="mt-10 text-[11px] text-muted-foreground/30 font-mono">
            ref: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
