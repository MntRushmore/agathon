'use client';

import { useEffect, useRef } from 'react';
import { MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { animate, stagger } from 'animejs';

interface LassoActionPromptProps {
  position: { x: number; y: number };
  onAction: (action: /* 'feedback' | */ 'suggest' | 'answer' | 'chat') => void;
  onDismiss: () => void;
  isClosing?: boolean;
}

export function LassoActionPrompt({ position, onAction, onDismiss, isClosing }: LassoActionPromptProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Dismiss on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onDismiss();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    // Delay listener to avoid the pointer-up from the lasso immediately dismissing
    const timer = setTimeout(() => {
      document.addEventListener('pointerdown', handleClick);
      document.addEventListener('keydown', handleKey);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onDismiss]);

  // Stagger buttons in with anime.js
  useEffect(() => {
    if (!ref.current || isClosing) return;
    const buttons = ref.current.querySelectorAll('[data-lasso-btn]');
    if (buttons.length === 0) return;
    animate(buttons, {
      opacity: [0, 1],
      scale: [0.8, 1],
      delay: stagger(50, { start: 100 }),
      duration: 300,
      ease: 'outBack(1.5)',
    });
  }, [isClosing]);

  return (
    <div
      ref={ref}
      className={cn(
        "fixed z-[var(--z-overlay)]",
        isClosing
          ? "animate-out fade-out zoom-out-95 duration-150"
          : "animate-in fade-in zoom-in-95 duration-150"
      )}
      style={{ left: position.x, top: position.y, transform: 'translate(-50%, 8px)' }}
    >
      <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg shadow-md px-1 py-1">
        {/* Feedback button disabled — kept for potential re-enable
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              data-lasso-btn
              onClick={() => onAction('feedback')}
              className="px-2.5 py-1.5 min-h-[44px] sm:min-h-0 text-xs font-medium text-gray-700 rounded hover:bg-gray-100 transition-colors whitespace-nowrap opacity-0"
            >
              Feedback
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={8}>Get feedback without answers</TooltipContent>
        </Tooltip>
        */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              data-lasso-btn
              onClick={() => onAction('suggest')}
              className="px-2.5 py-1.5 min-h-[44px] sm:min-h-0 text-xs font-medium text-gray-700 rounded hover:bg-gray-100 transition-colors whitespace-nowrap opacity-0"
            >
              Suggest
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={8}>Get hints to guide your thinking</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              data-lasso-btn
              onClick={() => onAction('answer')}
              className="px-2.5 py-1.5 min-h-[44px] sm:min-h-0 text-xs font-medium text-gray-700 rounded hover:bg-gray-100 transition-colors whitespace-nowrap opacity-0"
            >
              Solve
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={8}>Get the full worked-out solution</TooltipContent>
        </Tooltip>
        <div className="w-px h-4 bg-gray-200" />
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              data-lasso-btn
              onClick={() => onAction('chat')}
              className="flex items-center gap-1 px-2.5 py-1.5 min-h-[44px] sm:min-h-0 text-xs font-medium text-[#007ba5] rounded hover:bg-sky-50 transition-colors whitespace-nowrap opacity-0"
            >
              <MessageCircle className="w-3 h-3" />
              Ask AI
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={8}>Open a conversation about this</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
