'use client';

/**
 * WorkbenchLayout — AFFiNE-style workbench.
 * Canvas fills the left area; SocraticPanel slides in from the right.
 * Uses the same layout pattern as AFFiNE's workbench with ViewScope separation.
 */

import { useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import type { AffineCanvasHandle, CanvasMode } from './AffineCanvas';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BSDoc = any;
import AgathonTopBar from './AgathonTopBar';
import EditorToolbar from './EditorToolbar';
import SocraticPanel from './SocraticPanel';
import InlineAIAffordance from './InlineAIAffordance';

// Dynamic import — BlockSuite is DOM-only
const AffineCanvas = dynamic(() => import('./AffineCanvas'), { ssr: false });

interface WorkbenchLayoutProps {
  doc: BSDoc;
  title: string;
  subject?: string;
  onBack: () => void;
  onTitleChange?: (title: string) => void;
  isSaving?: boolean;
  activeUsers?: { id: string; name: string; color: string }[];
}

export default function WorkbenchLayout({
  doc,
  title,
  subject,
  onBack,
  onTitleChange,
  isSaving,
  activeUsers,
}: WorkbenchLayoutProps) {
  const [mode, setMode] = useState<CanvasMode>('edgeless');
  const [activeTool, setActiveTool] = useState('default');
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
  const [selectedText, setSelectedText] = useState<string | undefined>();
  const [inlineAI, setInlineAI] = useState<{ text: string; x: number; y: number } | null>(null);

  const canvasRef = useRef<AffineCanvasHandle>(null);

  const getCanvasContext = useCallback((): string => {
    return canvasRef.current?.getTextContent() ?? '';
  }, []);

  const handleSelectionChange = useCallback((text: string) => {
    // Show inline affordance near cursor
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
    <div className="relative w-full h-screen bg-[#fafafa] overflow-hidden flex flex-col">
      {/* Top bar */}
      <AgathonTopBar
        title={title}
        mode={mode}
        onModeChange={setMode}
        onBack={onBack}
        onTitleChange={onTitleChange}
        isSaving={isSaving}
        activeUsers={activeUsers}
        subject={subject}
      />

      {/* Canvas area + slide-in panel */}
      <div className="relative flex-1 mt-11 overflow-hidden">
        {/* BlockSuite canvas — shrinks when panel is open */}
        <div
          className="absolute inset-0 transition-all duration-300"
          style={{ right: isAIPanelOpen ? 320 : 0 }}
        >
          <AffineCanvas
            ref={canvasRef}
            doc={doc}
            mode={mode}
            onSelectionChange={handleSelectionChange}
            className="w-full h-full"
          />
        </div>

        {/* Socratic AI panel */}
        <SocraticPanel
          isOpen={isAIPanelOpen}
          onClose={() => setIsAIPanelOpen(false)}
          getCanvasContext={getCanvasContext}
          subject={subject}
          selectedText={selectedText}
          onClearSelection={() => setSelectedText(undefined)}
        />

        {/* Inline AI affordance (bubble above selection) */}
        {inlineAI && !isAIPanelOpen && (
          <InlineAIAffordance
            text={inlineAI.text}
            x={inlineAI.x}
            y={inlineAI.y}
            onAsk={handleInlineAskAI}
            onDismiss={() => setInlineAI(null)}
          />
        )}

        {/* AFFiNE-style floating bottom toolbar */}
        <EditorToolbar
          mode={mode}
          activeTool={activeTool}
          onToolSelect={setActiveTool}
          onAIClick={() => setIsAIPanelOpen((v) => !v)}
          isAIPanelOpen={isAIPanelOpen}
        />
      </div>
    </div>
  );
}
