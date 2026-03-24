'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from '@phosphor-icons/react';

interface FeatureNudgeProps {
  /** Unique key for localStorage persistence */
  nudgeId: string;
  /** Title text */
  title: string;
  /** Description text */
  description: string;
  /** Icon component from Phosphor */
  icon: React.ElementType;
  /** Position on screen */
  position?: 'bottom-left' | 'bottom-center' | 'top-center';
  /** Delay before showing (ms) */
  delay?: number;
  /** Auto-dismiss after (ms), 0 = manual only */
  autoDismissAfter?: number;
}

export function FeatureNudge({
  nudgeId,
  title,
  description,
  icon: Icon,
  position = 'bottom-left',
  delay = 3000,
  autoDismissAfter = 0,
}: FeatureNudgeProps) {
  const [visible, setVisible] = useState(false);
  const storageKey = `agathon_nudge_${nudgeId}`;

  useEffect(() => {
    const wasSeen = localStorage.getItem(storageKey);
    if (wasSeen === 'true') return;

    const showTimer = setTimeout(() => {
      setVisible(true);
    }, delay);

    return () => clearTimeout(showTimer);
  }, [storageKey, delay]);

  useEffect(() => {
    if (!visible || autoDismissAfter <= 0) return;
    const timer = setTimeout(dismiss, autoDismissAfter);
    return () => clearTimeout(timer);
  }, [visible, autoDismissAfter]);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(storageKey, 'true');
  };

  const positionClasses = {
    'bottom-left': 'fixed bottom-20 left-4 z-[300]',
    'bottom-center': 'fixed bottom-20 left-1/2 -translate-x-1/2 z-[300]',
    'top-center': 'fixed top-20 left-1/2 -translate-x-1/2 z-[300]',
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.96 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className={positionClasses[position]}
        >
          <div className="bg-card border border-border rounded-xl shadow-lg p-3.5 pr-10 max-w-xs flex items-start gap-3">
            <div className="icon-container icon-container-sm flex-shrink-0 mt-0.5">
              <Icon size={16} weight="duotone" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                {description}
              </p>
            </div>
            <button
              onClick={dismiss}
              className="absolute top-2.5 right-2.5 p-1 rounded-md hover:bg-muted transition-colors"
            >
              <X size={12} className="text-muted-foreground" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
