'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TutorialTooltipProps {
  show: boolean;
  title: string;
  description: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  targetRef?: React.RefObject<HTMLElement>;
  onNext?: () => void;
  onSkip?: () => void;
  nextLabel?: string;
  step?: number;
  totalSteps?: number;
  highlightTarget?: boolean;
}

export function TutorialTooltip({
  show,
  title,
  description,
  position = 'bottom',
  targetRef,
  onNext,
  onSkip,
  nextLabel = 'Next',
  step,
  totalSteps,
  highlightTarget = true,
}: TutorialTooltipProps) {
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [arrowPosition, setArrowPosition] = useState<'top' | 'bottom' | 'left' | 'right'>('top');

  useEffect(() => {
    if (!show || !targetRef?.current) return;

    const updatePosition = () => {
      const target = targetRef.current;
      if (!target) return;

      const rect = target.getBoundingClientRect();
      const tooltipWidth = 320;
      const tooltipHeight = 200;
      const padding = 16;

      let top = 0;
      let left = 0;
      let arrow: typeof arrowPosition = 'top';

      switch (position) {
        case 'bottom':
          top = rect.bottom + padding;
          left = rect.left + rect.width / 2 - tooltipWidth / 2;
          arrow = 'top';
          break;
        case 'top':
          top = rect.top - tooltipHeight - padding;
          left = rect.left + rect.width / 2 - tooltipWidth / 2;
          arrow = 'bottom';
          break;
        case 'left':
          top = rect.top + rect.height / 2 - tooltipHeight / 2;
          left = rect.left - tooltipWidth - padding;
          arrow = 'right';
          break;
        case 'right':
          top = rect.top + rect.height / 2 - tooltipHeight / 2;
          left = rect.right + padding;
          arrow = 'left';
          break;
      }

      // Keep tooltip within viewport
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      if (left < padding) left = padding;
      if (left + tooltipWidth > viewportWidth - padding) {
        left = viewportWidth - tooltipWidth - padding;
      }
      if (top < padding) top = padding;
      if (top + tooltipHeight > viewportHeight - padding) {
        top = viewportHeight - tooltipHeight - padding;
      }

      setTooltipPosition({ top, left });
      setArrowPosition(arrow);
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
    };
  }, [show, targetRef, position]);

  if (!show) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-[9998] pointer-events-none animate-in fade-in duration-200" />

      {/* Spotlight highlight for target */}
      {highlightTarget && targetRef?.current && (
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{
            top: targetRef.current.getBoundingClientRect().top - 4,
            left: targetRef.current.getBoundingClientRect().left - 4,
            width: targetRef.current.getBoundingClientRect().width + 8,
            height: targetRef.current.getBoundingClientRect().height + 8,
            boxShadow: '0 0 0 4px rgba(59, 130, 246, 0.5), 0 0 0 9999px rgba(0, 0, 0, 0.5)',
            borderRadius: '8px',
            transition: 'all 0.3s ease',
          }}
        />
      )}

      {/* Tooltip */}
      <div
        className="fixed z-[10000] bg-background border shadow-2xl rounded-lg p-6 max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-300"
        style={{
          top: tooltipPosition.top,
          left: tooltipPosition.left,
        }}
      >
        {/* Arrow */}
        <div
          className={`absolute w-4 h-4 bg-background border rotate-45 ${
            arrowPosition === 'top'
              ? '-top-2 left-1/2 -translate-x-1/2 border-b-0 border-r-0'
              : arrowPosition === 'bottom'
              ? '-bottom-2 left-1/2 -translate-x-1/2 border-t-0 border-l-0'
              : arrowPosition === 'left'
              ? 'top-1/2 -left-2 -translate-y-1/2 border-t-0 border-r-0'
              : 'top-1/2 -right-2 -translate-y-1/2 border-b-0 border-l-0'
          }`}
        />

        {/* Close button */}
        {onSkip && (
          <button
            onClick={onSkip}
            className="absolute top-2 right-2 p-1 hover:bg-muted rounded-full transition-colors"
            aria-label="Skip tutorial"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {/* Content */}
        <div className="space-y-4">
          {step && totalSteps && (
            <div className="text-xs text-muted-foreground font-medium">
              Step {step} of {totalSteps}
            </div>
          )}

          <div>
            <h3 className="font-semibold text-lg mb-2">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>

          <div className="flex gap-2 justify-end">
            {onSkip && (
              <Button onClick={onSkip} variant="ghost" size="sm">
                Skip Tutorial
              </Button>
            )}
            {onNext && (
              <Button onClick={onNext} size="sm">
                {nextLabel}
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
