'use client';

/**
 * InlineAIAffordance — small floating bubble that appears above selected text.
 * Modeled after AFFiNE's inline AI button that shows on block selection.
 */

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface InlineAIAffordanceProps {
  text: string;
  x: number;
  y: number;
  onAsk: (text: string) => void;
  onDismiss: () => void;
}

export default function InlineAIAffordance({ text, x, y, onAsk, onDismiss }: InlineAIAffordanceProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Dismiss on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onDismiss();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onDismiss]);

  return (
    <AnimatePresence>
      <motion.div
        ref={ref}
        initial={{ opacity: 0, scale: 0.9, y: 4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 4 }}
        transition={{ duration: 0.15 }}
        style={{
          position: 'fixed',
          left: x,
          top: y,
          transform: 'translate(-50%, -100%)',
          zIndex: 9999,
        }}
        className="flex items-center gap-1 px-2 py-1.5 rounded-xl
          bg-[#1a1a1a] text-white
          shadow-[0_4px_16px_rgba(0,0,0,0.2)]
          select-none"
      >
        <button
          onClick={() => onAsk(text)}
          className="flex items-center gap-1.5 text-xs font-medium hover:text-[#93c5fd] transition-colors whitespace-nowrap"
        >
          <svg width={12} height={12} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l2.4 7.2H22l-6.2 4.5 2.4 7.2L12 17l-6.2 3.9 2.4-7.2L2 9.2h7.6L12 2z" />
          </svg>
          Ask Agathon
        </button>
        <div className="w-px h-3 bg-white/20 mx-0.5" />
        <button
          onClick={onDismiss}
          className="text-white/40 hover:text-white/80 transition-colors"
        >
          <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
