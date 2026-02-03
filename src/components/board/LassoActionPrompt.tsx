'use client';

import { useEffect, useRef } from 'react';
import { MessageCircle } from 'lucide-react';

interface LassoActionPromptProps {
  position: { x: number; y: number };
  onAction: (action: 'feedback' | 'suggest' | 'answer' | 'chat') => void;
  onDismiss: () => void;
}

export function LassoActionPrompt({ position, onAction, onDismiss }: LassoActionPromptProps) {
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

  return (
    <div
      ref={ref}
      className="fixed z-[1100] animate-in fade-in zoom-in-95 duration-150"
      style={{ left: position.x, top: position.y, transform: 'translate(-50%, 8px)' }}
    >
      <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg shadow-md px-1 py-1">
        <button
          onClick={() => onAction('feedback')}
          className="px-2.5 py-1.5 text-xs font-medium text-gray-700 rounded hover:bg-gray-100 transition-colors whitespace-nowrap"
        >
          Feedback
        </button>
        <button
          onClick={() => onAction('suggest')}
          className="px-2.5 py-1.5 text-xs font-medium text-gray-700 rounded hover:bg-gray-100 transition-colors whitespace-nowrap"
        >
          Suggest
        </button>
        <button
          onClick={() => onAction('answer')}
          className="px-2.5 py-1.5 text-xs font-medium text-gray-700 rounded hover:bg-gray-100 transition-colors whitespace-nowrap"
        >
          Solve
        </button>
        <div className="w-px h-4 bg-gray-200" />
        <button
          onClick={() => onAction('chat')}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-violet-600 rounded hover:bg-violet-50 transition-colors whitespace-nowrap"
        >
          <MessageCircle className="w-3 h-3" />
          Ask AI
        </button>
      </div>
    </div>
  );
}
