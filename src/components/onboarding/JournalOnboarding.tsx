'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, PenNib, MathOperations, ChartLine, Sparkle } from '@phosphor-icons/react';

const JOURNAL_ONBOARDING_KEY = 'agathon_journal_onboarding_dismissed';

const TIPS = [
  {
    icon: PenNib,
    title: 'Inline Whiteboards',
    description: 'Add a drawing canvas right inside your notes — perfect for quick diagrams.',
    gradient: 'linear-gradient(180deg, #4F88F1 0%, #90B6FC 100%)',
  },
  {
    icon: MathOperations,
    title: 'LaTeX Math',
    description: 'Type equations with full LaTeX support — renders beautifully inline.',
    gradient: 'linear-gradient(180deg, #3AD53F 0%, #87FB8B 100%)',
  },
  {
    icon: ChartLine,
    title: 'Graphs & Charts',
    description: 'Embed Desmos graphs and data charts directly in your journal.',
    gradient: 'linear-gradient(180deg, #EB8633 0%, #FFCFA8 100%)',
  },
  {
    icon: Sparkle,
    title: 'AI Study Tools',
    description: 'Generate flashcards, summaries, and study guides from your notes.',
    gradient: 'linear-gradient(180deg, #7929F9 0%, #B588FE 100%)',
  },
];

export function JournalOnboarding() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const wasDismissed = localStorage.getItem(JOURNAL_ONBOARDING_KEY);
    setDismissed(wasDismissed === 'true');
  }, []);

  const dismiss = () => {
    setDismissed(true);
    localStorage.setItem(JOURNAL_ONBOARDING_KEY, 'true');
  };

  if (dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2 }}
        className="bg-card border border-border rounded-xl p-4 mb-6"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-foreground">
            Your journal is more powerful than you think
          </h3>
          <button
            onClick={dismiss}
            className="p-1 rounded-md hover:bg-muted transition-colors"
          >
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {TIPS.map((tip, index) => (
            <motion.div
              key={tip.title}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: index * 0.06 }}
              className="bg-muted border border-border rounded-lg p-3 space-y-2"
            >
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
                style={{ background: tip.gradient }}
              >
                <tip.icon className="h-3.5 w-3.5 text-white" weight="duotone" />
              </div>
              <div>
                <p className="text-xs font-medium text-foreground">{tip.title}</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                  {tip.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
