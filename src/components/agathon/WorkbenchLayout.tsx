'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import type { AffineCanvasHandle, SavedDocState } from './AffineCanvas';
import SocraticPanel from './SocraticPanel';
import InlineAIAffordance from './InlineAIAffordance';
import { ShareDialog } from '@/components/ui/share-dialog';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BSDoc = any;

const AffineCanvas = dynamic(() => import('./AffineCanvas'), { ssr: false });

interface WorkbenchLayoutProps {
  boardId: string;
  savedState?: SavedDocState | null;
  title: string;
  subject?: string;
  linkedJournalId?: string;
  onBack: () => void;
  onTitleChange?: (title: string) => void;
  onDocReady?: (doc: BSDoc) => void;
  isSaving?: boolean;
  activeUsers?: { id: string; name: string; color: string }[];
}

export default function WorkbenchLayout({
  boardId,
  savedState,
  title,
  subject,
  linkedJournalId,
  onBack,
  onTitleChange,
  onDocReady,
  isSaving,
}: WorkbenchLayoutProps) {
  const router = useRouter();
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
  const [selectedText, setSelectedText] = useState<string | undefined>();
  const [inlineAI, setInlineAI] = useState<{ text: string; x: number; y: number } | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isPresenting, setIsPresenting] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [showZoomMenu, setShowZoomMenu] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<AffineCanvasHandle>(null);

  useEffect(() => { setDraftTitle(title); }, [title]);
  useEffect(() => { if (isEditingTitle) titleInputRef.current?.select(); }, [isEditingTitle]);

  const commitTitle = useCallback(() => {
    setIsEditingTitle(false);
    const trimmed = draftTitle.trim();
    if (trimmed && trimmed !== title) onTitleChange?.(trimmed);
    else setDraftTitle(title);
  }, [draftTitle, title, onTitleChange]);

  const getCanvasContext = useCallback((): string => {
    return canvasRef.current?.getTextContent() ?? '';
  }, []);

  const getCanvasScreenshot = useCallback((): string | null => {
    return canvasRef.current?.getScreenshot() ?? null;
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

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && isPresenting) setIsPresenting(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isPresenting]);

  const PANEL_WIDTH = 360;

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#141414] select-none">

      {/* ── TOP BAR (AFFiNE-style) ── */}
      <div
        className="absolute top-0 left-0 z-40 h-11 flex items-center px-2 gap-1"
        style={{
          right: isAIPanelOpen ? PANEL_WIDTH : 0,
          transition: 'right 300ms cubic-bezier(0.4,0,0.2,1)',
          background: '#1a1a1a',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {/* Back / sidebar toggle */}
        <TopBarBtn onClick={onBack} title="Back to boards">
          <BackIcon />
        </TopBarBtn>

        {/* Favicon + editable title */}
        <div className="flex items-center gap-1.5 min-w-0 flex-shrink mr-1">
          <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(30,110,232,0.15)' }}>
            <AffineStarIcon size={12} color="#1e6ee8" />
          </div>
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitTitle();
                if (e.key === 'Escape') { setDraftTitle(title); setIsEditingTitle(false); }
              }}
              className="text-[13px] font-medium bg-transparent outline-none border-b border-[#1e6ee8] text-white w-40"
              style={{ color: 'rgba(255,255,255,0.85)' }}
            />
          ) : (
            <button
              onClick={() => setIsEditingTitle(true)}
              className="text-[13px] font-medium truncate max-w-[160px] transition-colors text-left"
              style={{ color: 'rgba(255,255,255,0.85)' }}
              title="Click to rename"
            >
              {title}
            </button>
          )}
        </div>

        {/* Favorites / Info / More — small icon buttons */}
        <TopBarBtn title="Favourite">
          <StarIcon />
        </TopBarBtn>
        <TopBarBtn title="Info">
          <InfoCircleIcon />
        </TopBarBtn>
        <TopBarBtn title="More options">
          <DotsIcon />
        </TopBarBtn>

        {/* Spacer */}
        <div className="flex-1 min-w-0" />

        {/* Centre: Journal ↔ Whiteboard mode switcher */}
        <div
          className="flex items-center rounded-lg p-0.5 flex-shrink-0 gap-0.5"
          style={{ background: 'rgba(255,255,255,0.06)' }}
        >
          <button
            onClick={() => router.push(linkedJournalId ? `/journal/${linkedJournalId}` : '/journal')}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all duration-150',
              'text-[rgba(255,255,255,0.4)] hover:text-[rgba(255,255,255,0.7)] hover:bg-[rgba(255,255,255,0.06)]'
            )}
          >
            <JournalIcon size={12} />
            Journal
          </button>
          <button
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all duration-150',
              'bg-white text-[#1a1a1a] shadow-sm'
            )}
          >
            <CanvasIcon size={12} />
            Whiteboard
          </button>
        </div>

        <div className="flex-1 min-w-0" />

        {/* Right side actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Saving indicator */}
          {isSaving && (
            <span className="text-[10px] mr-1" style={{ color: 'rgba(255,255,255,0.3)' }}>Saving…</span>
          )}

          {/* Present button */}
          <button
            onClick={() => setIsPresenting(true)}
            title="Present (fullscreen)"
            className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-medium transition-all duration-150"
            style={{
              color: 'rgba(255,255,255,0.6)',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.04)',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
          >
            <PresentIcon size={12} />
            Present
          </button>

          {/* Share button */}
          <button
            onClick={() => setIsShareOpen(true)}
            className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-[11px] font-semibold transition-all duration-150"
            style={{ background: '#1e6ee8', color: '#fff' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#1a5fcf')}
            onMouseLeave={e => (e.currentTarget.style.background = '#1e6ee8')}
          >
            <ShareIcon size={12} />
            Share
          </button>

          {/* Divider */}
          <div className="w-px h-4 mx-1" style={{ background: 'rgba(255,255,255,0.1)' }} />

          {/* AI Panel toggle */}
          <button
            onClick={() => setIsAIPanelOpen((v) => !v)}
            title="Agathon AI"
            className={cn(
              'flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-150',
              isAIPanelOpen
                ? 'text-[#1e6ee8] bg-[rgba(30,110,232,0.15)]'
                : 'text-[rgba(255,255,255,0.5)] hover:bg-[rgba(255,255,255,0.06)]'
            )}
          >
            <AffineStarIcon size={15} color={isAIPanelOpen ? '#1e6ee8' : 'rgba(255,255,255,0.5)'} />
          </button>

          {/* Sidebar collapse */}
          <TopBarBtn title="Toggle sidebar">
            <SidebarIcon />
          </TopBarBtn>
        </div>
      </div>

      {/* ── CANVAS ── */}
      <div
        className="absolute inset-0"
        style={{
          top: 44,
          right: isAIPanelOpen ? PANEL_WIDTH : 0,
          transition: 'right 300ms cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <AffineCanvas
          ref={canvasRef}
          boardId={boardId}
          savedState={savedState}
          onDocReady={onDocReady}
          onSelectionChange={handleSelectionChange}
          className="w-full h-full"
        />
      </div>

      {/* ── BOTTOM-LEFT ZOOM CONTROLS (AFFiNE-style) ── */}
      <div
        className="absolute bottom-5 left-4 z-40 flex items-center gap-1"
        style={{
          right: isAIPanelOpen ? PANEL_WIDTH + 16 : 'auto',
          transition: 'right 300ms cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <div
          className="flex items-center rounded-lg overflow-hidden"
          style={{
            background: '#1a1a1a',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          }}
        >
          {/* Fit to screen */}
          <ZoomBtn onClick={() => setZoom(100)} title="Fit to screen">
            <FitIcon />
          </ZoomBtn>
          <div className="w-px h-4" style={{ background: 'rgba(255,255,255,0.1)' }} />
          {/* Zoom out */}
          <ZoomBtn onClick={() => setZoom((z) => Math.max(10, z - 10))} title="Zoom out">
            <MinusIcon />
          </ZoomBtn>
          {/* Zoom level — click to open picker */}
          <div className="relative">
            <button
              onClick={() => setShowZoomMenu((v) => !v)}
              className="flex items-center justify-center px-2 h-7 text-[11px] font-medium transition-colors"
              style={{ color: 'rgba(255,255,255,0.7)', minWidth: 44 }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {zoom}%
            </button>
            <AnimatePresence>
              {showZoomMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute bottom-full left-0 mb-1 rounded-xl overflow-hidden z-50"
                  style={{
                    background: '#2a2a2a',
                    border: '1px solid rgba(255,255,255,0.12)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                    minWidth: 100,
                  }}
                >
                  {[25, 50, 75, 100, 125, 150, 200].map((z) => (
                    <button
                      key={z}
                      onClick={() => { setZoom(z); setShowZoomMenu(false); }}
                      className="w-full text-left px-3 py-2 text-[12px] transition-colors"
                      style={{
                        color: zoom === z ? '#1e6ee8' : 'rgba(255,255,255,0.7)',
                        background: zoom === z ? 'rgba(30,110,232,0.1)' : 'transparent',
                      }}
                      onMouseEnter={e => { if (zoom !== z) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                      onMouseLeave={e => { if (zoom !== z) e.currentTarget.style.background = 'transparent'; }}
                    >
                      {z}%
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {/* Zoom in */}
          <ZoomBtn onClick={() => setZoom((z) => Math.min(400, z + 10))} title="Zoom in">
            <PlusIcon />
          </ZoomBtn>
        </div>
      </div>

      {/* ── AI PANEL ── */}
      <SocraticPanel
        isOpen={isAIPanelOpen}
        onClose={() => setIsAIPanelOpen(false)}
        getCanvasContext={getCanvasContext}
        getCanvasScreenshot={getCanvasScreenshot}
        subject={subject}
        selectedText={selectedText}
        onClearSelection={() => setSelectedText(undefined)}
      />

      {/* Inline AI affordance */}
      {inlineAI && !isAIPanelOpen && (
        <InlineAIAffordance
          text={inlineAI.text}
          x={inlineAI.x}
          y={inlineAI.y}
          onAsk={handleInlineAskAI}
          onDismiss={() => setInlineAI(null)}
        />
      )}

      {/* ── PRESENTATION MODE ── */}
      <AnimatePresence>
        {isPresenting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center"
          >
            {/* Canvas fills the screen */}
            <div className="absolute inset-0">
              <AffineCanvas
                boardId={boardId}
                savedState={savedState}
                className="w-full h-full"
              />
            </div>
            {/* Exit button */}
            <button
              onClick={() => setIsPresenting(false)}
              className="absolute top-4 right-4 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium"
              style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.15)' }}
            >
              <EscIcon /> Exit (Esc)
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SHARE DIALOG ── */}
      <ShareDialog open={isShareOpen} onClose={() => setIsShareOpen(false)} />
    </div>
  );
}

// ── Reusable button components ──

function TopBarBtn({ children, onClick, title }: { children: React.ReactNode; onClick?: () => void; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors duration-150 flex-shrink-0"
      style={{ color: 'rgba(255,255,255,0.45)', background: 'transparent' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {children}
    </button>
  );
}

function ZoomBtn({ children, onClick, title }: { children: React.ReactNode; onClick?: () => void; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex items-center justify-center w-7 h-7 transition-colors duration-150"
      style={{ color: 'rgba(255,255,255,0.5)' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {children}
    </button>
  );
}

// ── Icons ──

function AffineStarIcon({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M11.28 5.49c-.04-.36-.34-.63-.71-.63s-.67.27-.71.63c-.27 2.35-.97 4-2.1 5.12C6.63 11.75 4.98 12.45 2.63 12.72c-.36.04-.63.35-.63.71s.27.67.63.71c2.31.26 4 .96 5.15 2.1 1.15 1.13 1.87 2.78 2.07 5.11.03.37.34.65.71.65s.67-.27.71-.65c.2-2.29.91-3.97 2.07-5.13 1.16-1.16 2.84-1.87 5.13-2.07.37-.03.65-.34.65-.71s-.27-.67-.65-.71c-2.33-.21-3.98-.93-5.11-2.06C12.22 9.49 11.52 7.81 11.28 5.49z" fill={color}/>
      <path d="M19.5 2.5c-.02-.21-.2-.37-.42-.37s-.4.16-.42.37c-.16 1.38-.57 2.35-1.24 3.02-.67.67-1.64 1.08-3.02 1.24-.21.02-.37.2-.37.42s.16.4.37.42c1.36.16 2.35.57 3.02 1.24.67.67 1.08 1.64 1.24 3.02.02.21.2.37.42.37s.4-.16.42-.37c.16-1.36.57-2.35 1.24-3.02.67-.67 1.64-1.08 3.02-1.24.21-.02.37-.2.37-.42s-.16-.4-.37-.42c-1.37-.16-2.35-.57-3.02-1.24-.67-.67-1.08-1.64-1.24-3.02z" fill={color}/>
    </svg>
  );
}

function BackIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function InfoCircleIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx={12} cy={12} r={10} />
      <line x1={12} y1={16} x2={12} y2={12} />
      <line x1={12} y1={8} x2={12} y2={8} />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx={5} cy={12} r={1} fill="currentColor" />
      <circle cx={12} cy={12} r={1} fill="currentColor" />
      <circle cx={19} cy={12} r={1} fill="currentColor" />
    </svg>
  );
}

function JournalIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

function CanvasIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x={3} y={3} width={18} height={18} rx={2} />
      <path d="m9 9 2 2 4-4" />
    </svg>
  );
}

function PresentIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x={2} y={3} width={20} height={14} rx={2} />
      <line x1={8} y1={21} x2={16} y2={21} />
      <line x1={12} y1={17} x2={12} y2={21} />
    </svg>
  );
}

function ShareIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1={12} y1={2} x2={12} y2={15} />
    </svg>
  );
}

function SidebarIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x={3} y={3} width={18} height={18} rx={2} />
      <line x1={9} y1={3} x2={9} y2={21} />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
      <line x1={5} y1={12} x2={19} y2={12} />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
      <line x1={12} y1={5} x2={12} y2={19} />
      <line x1={5} y1={12} x2={19} y2={12} />
    </svg>
  );
}

function FitIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function EscIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1={18} y1={6} x2={6} y2={18} />
      <line x1={6} y1={6} x2={18} y2={18} />
    </svg>
  );
}
