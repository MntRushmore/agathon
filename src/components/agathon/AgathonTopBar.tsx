'use client';

/**
 * AgathonTopBar — AFFiNE-style top bar.
 * - Back button
 * - Doc title (editable inline)
 * - Doc / Edgeless mode toggle (like AFFiNE's page/edgeless tabs)
 * - Collaborators presence
 * - Share button
 */

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { CanvasMode } from './AffineCanvas';

interface AgathonTopBarProps {
  title: string;
  mode: CanvasMode;
  onModeChange: (mode: CanvasMode) => void;
  onBack: () => void;
  onTitleChange?: (title: string) => void;
  activeUsers?: { id: string; name: string; color: string }[];
  isSaving?: boolean;
  subject?: string;
}

export default function AgathonTopBar({
  title,
  mode,
  onModeChange,
  onBack,
  onTitleChange,
  activeUsers = [],
  isSaving = false,
  subject,
}: AgathonTopBarProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraftTitle(title);
  }, [title]);

  useEffect(() => {
    if (isEditingTitle) titleRef.current?.select();
  }, [isEditingTitle]);

  const commitTitle = () => {
    setIsEditingTitle(false);
    if (draftTitle.trim() && draftTitle.trim() !== title) {
      onTitleChange?.(draftTitle.trim());
    } else {
      setDraftTitle(title);
    }
  };

  return (
    <div className="absolute top-0 left-0 right-0 h-11 z-40 flex items-center px-3 gap-2
      bg-white/95 backdrop-blur-sm border-b border-[#e8e8e8]/80
      shadow-[0_1px_4px_rgba(0,0,0,0.04)]">

      {/* Back */}
      <button
        onClick={onBack}
        title="Back to boards"
        className="flex items-center justify-center w-7 h-7 rounded-lg text-[#8a8a8a] hover:bg-[#f5f5f5] hover:text-[#3d3d3d] transition-colors flex-shrink-0"
      >
        <BackIcon />
      </button>

      {/* Logo + title */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div className="w-5 h-5 rounded-md bg-[#1e6ee8] flex items-center justify-center flex-shrink-0">
          <span className="text-white text-[9px] font-bold leading-none">A</span>
        </div>

        {isEditingTitle ? (
          <input
            ref={titleRef}
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitTitle();
              if (e.key === 'Escape') {
                setDraftTitle(title);
                setIsEditingTitle(false);
              }
            }}
            className="text-sm font-medium text-[#1a1a1a] bg-transparent border-b border-[#1e6ee8] outline-none min-w-0 w-48 max-w-xs"
          />
        ) : (
          <button
            onClick={() => setIsEditingTitle(true)}
            className="text-sm font-medium text-[#1a1a1a] hover:text-[#1e6ee8] truncate max-w-xs transition-colors text-left"
            title="Click to rename"
          >
            {title}
          </button>
        )}

        {subject && (
          <span className="text-xs text-[#aaa] truncate hidden sm:block">· {subject}</span>
        )}
      </div>

      {/* Mode toggle — AFFiNE style pill */}
      <div className="flex items-center bg-[#f5f5f5] rounded-lg p-0.5 flex-shrink-0">
        <button
          onClick={() => onModeChange('page')}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150',
            mode === 'page'
              ? 'bg-white text-[#1a1a1a] shadow-sm'
              : 'text-[#888] hover:text-[#555]'
          )}
        >
          <DocIcon size={13} />
          Doc
        </button>
        <button
          onClick={() => onModeChange('edgeless')}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150',
            mode === 'edgeless'
              ? 'bg-white text-[#1a1a1a] shadow-sm'
              : 'text-[#888] hover:text-[#555]'
          )}
        >
          <CanvasIcon size={13} />
          Canvas
        </button>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Save indicator */}
        {isSaving && (
          <span className="text-[10px] text-[#aaa] hidden sm:block">Saving…</span>
        )}

        {/* Active users */}
        {activeUsers.length > 0 && (
          <div className="flex -space-x-1">
            {activeUsers.slice(0, 3).map((u) => (
              <div
                key={u.id}
                title={u.name}
                className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                style={{ backgroundColor: u.color }}
              >
                {u.name[0]?.toUpperCase()}
              </div>
            ))}
            {activeUsers.length > 3 && (
              <div className="w-6 h-6 rounded-full border-2 border-white bg-[#f0f0f0] flex items-center justify-center text-[9px] text-[#666] font-medium">
                +{activeUsers.length - 3}
              </div>
            )}
          </div>
        )}

        {/* Share */}
        <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#1e6ee8] text-white hover:bg-[#1a5fcf] transition-colors active:scale-95">
          <ShareIcon size={13} />
          Share
        </button>
      </div>
    </div>
  );
}

function BackIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function DocIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function CanvasIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function ShareIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}
