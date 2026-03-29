'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import type { AffineCanvasHandle } from './AffineCanvas';
import SocraticPanel from './SocraticPanel';
import InlineAIAffordance from './InlineAIAffordance';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BSDoc = any;

const AffineCanvas = dynamic(() => import('./AffineCanvas'), { ssr: false });

interface WorkbenchLayoutProps {
  boardId: string;
  savedYjsState?: string;
  title: string;
  subject?: string;
  onBack: () => void;
  onTitleChange?: (title: string) => void;
  onDocReady?: (doc: BSDoc) => void;
  isSaving?: boolean;
  activeUsers?: { id: string; name: string; color: string }[];
}

export default function WorkbenchLayout({
  boardId,
  savedYjsState,
  title,
  subject,
  onBack,
  onDocReady,
  isSaving,
}: WorkbenchLayoutProps) {
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
  const [selectedText, setSelectedText] = useState<string | undefined>();
  const [inlineAI, setInlineAI] = useState<{ text: string; x: number; y: number } | null>(null);
  const [isDark, setIsDark] = useState(false);
  const canvasRef = useRef<AffineCanvasHandle>(null);

  // Sync BlockSuite theme by setting data-theme on <html>
  useEffect(() => {
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
    return () => {
      // restore on unmount
      delete document.documentElement.dataset.theme;
    };
  }, [isDark]);

  const getCanvasContext = useCallback((): string => {
    return canvasRef.current?.getTextContent() ?? '';
  }, []);

  const handleSelectionChange = useCallback((text: string) => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      setInlineAI({ text, x: rect.left + rect.width / 2, y: rect.top - 8 });
    }
    setSelectedText(text);
  }, []);

  const handleInlineAskAI = useCallback((text: string) => {
    setSelectedText(text);
    setIsAIPanelOpen(true);
    setInlineAI(null);
  }, []);

  return (
    <div className={cn('relative w-full h-screen overflow-hidden', isDark ? 'dark' : '')}>
      {/* Thin top bar — back button, title, dark mode toggle */}
      <div
        className={cn(
          'absolute top-0 left-0 right-0 z-40 h-11',
          'flex items-center px-3 gap-2',
          'border-b',
          isDark
            ? 'bg-[#1a1a1a] border-white/10 text-white'
            : 'bg-white/80 backdrop-blur-sm border-black/8 text-[#1a1a1a]',
        )}
        style={{ right: isAIPanelOpen ? 360 : 0, transition: 'right 300ms ease-out' }}
      >
        {/* Back button */}
        <button
          onClick={onBack}
          className={cn(
            'flex items-center gap-1.5 px-2 py-1 rounded-lg text-sm font-medium',
            'transition-colors duration-150',
            isDark
              ? 'text-white/70 hover:text-white hover:bg-white/10'
              : 'text-[#555] hover:text-[#1a1a1a] hover:bg-black/6',
          )}
        >
          <BackIcon />
          Back
        </button>

        {/* Divider */}
        <div className={cn('w-px h-4 mx-1', isDark ? 'bg-white/15' : 'bg-black/12')} />

        {/* Board title */}
        <span className="flex-1 text-sm font-medium truncate opacity-75">{title}</span>

        {/* Saving indicator */}
        {isSaving && (
          <span className={cn('text-xs', isDark ? 'text-white/40' : 'text-[#aaa]')}>
            Saving…
          </span>
        )}

        {/* Dark mode toggle */}
        <button
          onClick={() => setIsDark((d) => !d)}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          className={cn(
            'flex items-center justify-center w-8 h-8 rounded-lg',
            'transition-colors duration-150',
            isDark
              ? 'text-white/70 hover:text-white hover:bg-white/10'
              : 'text-[#555] hover:text-[#1a1a1a] hover:bg-black/6',
          )}
        >
          {isDark ? <SunIcon /> : <MoonIcon />}
        </button>
      </div>

      {/* BlockSuite canvas — sits below the top bar */}
      <div
        className="absolute bottom-0 left-0 transition-all duration-300 ease-out"
        style={{ top: 44, right: isAIPanelOpen ? 360 : 0 }}
      >
        <AffineCanvas
          ref={canvasRef}
          boardId={boardId}
          savedYjsState={savedYjsState}
          onDocReady={onDocReady}
          onSelectionChange={handleSelectionChange}
          className="w-full h-full"
        />
      </div>

      <SocraticPanel
        isOpen={isAIPanelOpen}
        onClose={() => setIsAIPanelOpen(false)}
        getCanvasContext={getCanvasContext}
        subject={subject}
        selectedText={selectedText}
        onClearSelection={() => setSelectedText(undefined)}
      />

      {inlineAI && !isAIPanelOpen && (
        <InlineAIAffordance
          text={inlineAI.text}
          x={inlineAI.x}
          y={inlineAI.y}
          onAsk={handleInlineAskAI}
          onDismiss={() => setInlineAI(null)}
        />
      )}

      {/* Ask Agathon FAB — bottom right, clear of BlockSuite's toolbar */}
      <AnimatePresence>
        {!isAIPanelOpen && (
          <motion.button
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.15 }}
            onClick={() => setIsAIPanelOpen(true)}
            className={cn(
              'absolute bottom-6 right-6 z-50',
              'flex items-center gap-2 px-4 py-2.5 rounded-2xl',
              'bg-[#1e6ee8] text-white text-sm font-semibold',
              'shadow-[0_4px_20px_rgba(30,110,232,0.4)]',
              'hover:bg-[#1a5fcf] active:scale-95 transition-all duration-150',
            )}
          >
            <SparkleIcon />
            Ask Agathon
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

function BackIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx={12} cy={12} r={5} />
      <line x1={12} y1={1} x2={12} y2={3} />
      <line x1={12} y1={21} x2={12} y2={23} />
      <line x1={4.22} y1={4.22} x2={5.64} y2={5.64} />
      <line x1={18.36} y1={18.36} x2={19.78} y2={19.78} />
      <line x1={1} y1={12} x2={3} y2={12} />
      <line x1={21} y1={12} x2={23} y2={12} />
      <line x1={4.22} y1={19.78} x2={5.64} y2={18.36} />
      <line x1={18.36} y1={5.64} x2={19.78} y2={4.22} />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74L12 2z" />
    </svg>
  );
}
