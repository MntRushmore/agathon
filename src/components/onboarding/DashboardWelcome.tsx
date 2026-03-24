'use client';

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { PencilLine, BookOpenText, Play, X, ArrowRight, Sparkle, Lightning } from '@phosphor-icons/react';

interface DashboardWelcomeProps {
  onCreateBoard: () => void;
  onCreateJournal: () => void;
  onWatchDemo: () => void;
}

const WELCOME_DISMISSED_KEY = 'agathon_dashboard_welcome_dismissed';

export function DashboardWelcome({ onCreateBoard, onCreateJournal, onWatchDemo }: DashboardWelcomeProps) {
  const [dismissed, setDismissed] = useState(true); // start hidden to avoid flash

  useEffect(() => {
    const wasDismissed = localStorage.getItem(WELCOME_DISMISSED_KEY);
    setDismissed(wasDismissed === 'true');
  }, []);

  const dismiss = () => {
    setDismissed(true);
    localStorage.setItem(WELCOME_DISMISSED_KEY, 'true');
  };

  if (dismissed) return null;

  const cards = [
    {
      id: 'board',
      icon: PencilLine,
      title: 'Try the AI Whiteboard',
      description: 'Draw a math problem and lasso it — the AI will help you solve it step by step.',
      cta: 'Create a Board',
      gradient: 'linear-gradient(180deg, #4F88F1 0%, #90B6FC 100%)',
      onClick: () => { onCreateBoard(); dismiss(); },
    },
    {
      id: 'journal',
      icon: BookOpenText,
      title: 'Start a Study Journal',
      description: 'Write notes with inline whiteboards, LaTeX math, graphs, and AI study tools.',
      cta: 'Create a Journal',
      gradient: 'linear-gradient(180deg, #3AD53F 0%, #87FB8B 100%)',
      onClick: () => { onCreateJournal(); dismiss(); },
    },
    {
      id: 'demo',
      icon: Play,
      title: 'Watch the Demo',
      description: 'See what Agathon can do in 60 seconds — draw, lasso, and get instant AI tutoring.',
      cta: 'Watch Demo',
      gradient: 'linear-gradient(180deg, #EB8633 0%, #FFCFA8 100%)',
      onClick: onWatchDemo,
    },
  ];

  return (
    <div className="mb-6">
      {/* Header with dismiss */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div
            className="w-[24px] h-[24px] rounded-[5px] flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(180deg, #7929F9 0%, #B588FE 100%)' }}
          >
            <Sparkle className="h-3.5 w-3.5 text-white" weight="fill" />
          </div>
          <span className="text-[15px] font-medium" style={{ fontFamily: 'Manrope, sans-serif', color: '#06313A' }}>
            Get started
          </span>
        </div>
        <button
          onClick={dismiss}
          className="p-1.5 rounded-lg transition-colors hover:bg-muted"
        >
          <X size={16} weight="bold" style={{ color: 'rgba(6, 49, 58, 0.4)' }} />
        </button>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-3 gap-[15px]">
        {cards.map((card, index) => (
          <motion.button
            key={card.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.08 }}
            onClick={card.onClick}
            className="text-left rounded-[15px] p-[5px] transition-all duration-150 hover:scale-[1.01]"
            style={{ backgroundColor: '#F5F8F7' }}
          >
            <div
              className="rounded-[10px] flex flex-col gap-[12px] h-full"
              style={{ backgroundColor: '#FFFFFF', boxShadow: '0px 1px 4px 0px rgba(165, 165, 165, 0.25)', padding: '16px 14px' }}
            >
              <div
                className="w-[29px] h-[30px] rounded-[5px] flex items-center justify-center flex-shrink-0"
                style={{ background: card.gradient }}
              >
                <card.icon className="h-4 w-4 text-white" weight="duotone" />
              </div>
              <div>
                <h3 className="text-[16px] font-medium leading-tight" style={{ fontFamily: 'Manrope, sans-serif', color: '#06313A' }}>
                  {card.title}
                </h3>
                <p className="text-[13px] leading-snug mt-1.5" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400, color: 'rgba(6, 49, 58, 0.6)' }}>
                  {card.description}
                </p>
              </div>
              <div className="flex items-center gap-1 mt-auto">
                <span className="text-[13px] font-medium" style={{ fontFamily: 'Manrope, sans-serif', color: '#4F88F1' }}>
                  {card.cta}
                </span>
                <ArrowRight size={12} weight="bold" style={{ color: '#4F88F1' }} />
              </div>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
