'use client';

import { useState, useCallback, useRef } from 'react';
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
  subject,
  onDocReady,
}: WorkbenchLayoutProps) {
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
  const [selectedText, setSelectedText] = useState<string | undefined>();
  const [inlineAI, setInlineAI] = useState<{ text: string; x: number; y: number } | null>(null);
  const canvasRef = useRef<AffineCanvasHandle>(null);

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
    <div className="relative w-full h-screen overflow-hidden">
      {/* BlockSuite fills everything — it renders its own top bar + toolbar */}
      <div
        className="absolute inset-0 transition-all duration-300 ease-out"
        style={{ right: isAIPanelOpen ? 360 : 0 }}
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

function SparkleIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74L12 2z" />
    </svg>
  );
}
