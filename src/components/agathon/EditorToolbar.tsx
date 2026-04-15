'use client';

/**
 * EditorToolbar — pixel-accurate AFFiNE edgeless toolbar.
 *
 * Layout (matches AFFiNE source):
 *   [ quick-tools: Select|Hand | Frame | Connector | Note ] [ ••• overflow ]
 *   [ full-divider ]
 *   [ senior-tools: Pen+Eraser | Shape | Text | Sticky | Mind Map | Template ]
 *   [ AI button ]
 *
 * - 64px tall, floating, bottom-centered pill with squircle shadow
 * - Quick tools: 36×36px icon buttons, 10px gap
 * - Senior tools: 96px wide each, full 64px height, animated icons
 * - Active quick tool: primary-color icon + dot indicator
 * - Active senior tool: blue fill background
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { CanvasMode } from './AffineCanvas';

export type QuickTool = 'default' | 'pan' | 'frame' | 'connector' | 'note' | 'link';
export type SeniorTool = 'pen' | 'eraser' | 'shape' | 'text' | 'sticky' | 'mindmap' | 'template';
export type ActiveTool = QuickTool | SeniorTool;

interface EditorToolbarProps {
  mode: CanvasMode;
  activeTool: ActiveTool;
  onToolSelect: (tool: ActiveTool) => void;
  onAIClick: () => void;
  isAIPanelOpen: boolean;
}

// ─── Quick tools ─────────────────────────────────────────────────────────────

function SelectHandButton({
  activeTool,
  onSelect,
}: {
  activeTool: ActiveTool;
  onSelect: (t: QuickTool) => void;
}) {
  const isSelect = activeTool === 'default';
  const isPan = activeTool === 'pan';
  const isActive = isSelect || isPan;

  return (
    <div className="flex items-center gap-0.5">
      <QuickToolBtn
        title="Select (V)"
        isActive={isSelect}
        onClick={() => onSelect('default')}
      >
        <SelectIcon />
      </QuickToolBtn>
      <QuickToolBtn
        title="Hand / Pan (H)"
        isActive={isPan}
        onClick={() => onSelect('pan')}
      >
        <HandIcon />
      </QuickToolBtn>
    </div>
  );
}

function QuickToolBtn({
  children,
  title,
  isActive,
  onClick,
  hasArrow,
}: {
  children: React.ReactNode;
  title: string;
  isActive: boolean;
  onClick: () => void;
  hasArrow?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={cn(
        'relative flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-150 flex-shrink-0',
        isActive
          ? 'text-[#1e6ee8]'
          : 'text-[#525252] hover:bg-[#f0f0f0] hover:text-[#1a1a1a]'
      )}
    >
      {children}
      {hasArrow && (
        <span className="absolute bottom-0.5 right-0.5 text-[#aaa]">
          <ArrowUpTinyIcon />
        </span>
      )}
    </button>
  );
}

// ─── Senior tools ─────────────────────────────────────────────────────────────

function SeniorToolBtn({
  children,
  title,
  isActive,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={cn(
        'group relative flex flex-col items-center justify-end w-24 h-full pb-2 transition-all duration-150 rounded-xl overflow-hidden',
        isActive ? 'bg-[#e8f2ff]' : 'hover:bg-[#f5f5f5]'
      )}
    >
      {children}
    </button>
  );
}

// ─── Main toolbar ─────────────────────────────────────────────────────────────

export default function EditorToolbar({
  mode,
  activeTool,
  onToolSelect,
  onAIClick,
  isAIPanelOpen,
}: EditorToolbarProps) {
  // Doc mode: just show the AI button
  if (mode === 'page') {
    return (
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-40">
        <button
          onClick={onAIClick}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 rounded-2xl',
            'shadow-[0_4px_20px_rgba(0,0,0,0.13)] border border-white/70',
            'text-sm font-medium transition-all duration-200 active:scale-95',
            isAIPanelOpen
              ? 'bg-[#1e6ee8] text-white'
              : 'bg-white text-[#3d3d3d] hover:bg-[#f5f5f5]'
          )}
        >
          <SparkleIcon size={15} />
          Ask AI
        </button>
      </div>
    );
  }

  const isQuick = (t: QuickTool) => activeTool === t;
  const isSenior = (t: SeniorTool) => activeTool === t;
  const isPen = isSenior('pen');
  const isEraser = isSenior('eraser');

  return (
    <div
      className="absolute bottom-0 left-1/2 -translate-x-1/2 z-40 pb-4 select-none pointer-events-none"
      style={{ width: 'calc(100% - 128px)', maxWidth: 760, minWidth: 264 }}
    >
      <div
        className="pointer-events-auto mx-auto w-fit flex items-center h-16 px-3 gap-0
          rounded-2xl
          bg-white/97 backdrop-blur-sm
          border border-[#e4e4e4]
          shadow-[0_8px_32px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)]"
      >
        {/* ── Quick tools ─────────────────────────────── */}
        <div className="flex items-center gap-2.5 px-1">
          {/* Select + Hand */}
          <SelectHandButton activeTool={activeTool} onSelect={onToolSelect} />

          <div className="w-px h-5 bg-[#e4e4e4] rounded-full" />

          {/* Frame */}
          <QuickToolBtn title="Frame (F)" isActive={isQuick('frame')} onClick={() => onToolSelect('frame')} hasArrow>
            <FrameIcon />
          </QuickToolBtn>

          {/* Connector */}
          <QuickToolBtn title="Connector (C)" isActive={isQuick('connector')} onClick={() => onToolSelect('connector')} hasArrow>
            <ConnectorIcon />
          </QuickToolBtn>

          {/* Note */}
          <QuickToolBtn title="Note (N)" isActive={isQuick('note')} onClick={() => onToolSelect('note')}>
            <NoteIcon />
          </QuickToolBtn>
        </div>

        {/* ── Full divider ─────────────────────────────── */}
        <div className="w-px h-8 bg-[#e4e4e4] mx-2 flex-shrink-0" />

        {/* ── Senior tools ─────────────────────────────── */}
        <div className="flex items-stretch h-16 gap-0.5">
          {/* Pen + Eraser share one 96px slot */}
          <div className="relative flex items-end justify-center w-24 h-full pb-2 gap-1">
            {/* Pen */}
            <button
              title="Pen"
              onClick={() => onToolSelect('pen')}
              className={cn(
                'relative flex flex-col items-center justify-end w-10 h-full pb-0 rounded-xl transition-all duration-150 overflow-hidden',
                isPen ? 'bg-[#e8f2ff]' : 'hover:bg-[#f5f5f5]'
              )}
            >
              <span className={cn(
                'transition-all duration-200 group-hover:-translate-y-1',
                isPen ? '-translate-y-1' : ''
              )}>
                <PenIcon active={isPen} />
              </span>
              <span className="text-[9px] text-[#8a8a8a] mt-0.5 leading-none">Pen</span>
            </button>

            {/* Eraser */}
            <button
              title="Eraser (E)"
              onClick={() => onToolSelect('eraser')}
              className={cn(
                'relative flex flex-col items-center justify-end w-10 h-full pb-0 rounded-xl transition-all duration-150 overflow-hidden',
                isEraser ? 'bg-[#e8f2ff]' : 'hover:bg-[#f5f5f5]'
              )}
            >
              <span className={cn(
                'transition-all duration-200',
                isEraser ? '-translate-y-1' : ''
              )}>
                <EraserIcon active={isEraser} />
              </span>
              <span className="text-[9px] text-[#8a8a8a] mt-0.5 leading-none">Eraser</span>
            </button>
          </div>

          {/* Shape */}
          <SeniorToolBtn title="Shape (S)" isActive={isSenior('shape')} onClick={() => onToolSelect('shape')}>
            <ShapeSeniorIcon active={isSenior('shape')} />
            <span className="text-[9px] text-[#8a8a8a] mt-0.5 leading-none">Shape</span>
          </SeniorToolBtn>

          {/* Text */}
          <SeniorToolBtn title="Text (T)" isActive={isSenior('text')} onClick={() => onToolSelect('text')}>
            <TextSeniorIcon active={isSenior('text')} />
            <span className="text-[9px] text-[#8a8a8a] mt-0.5 leading-none">Text</span>
          </SeniorToolBtn>

          {/* Sticky Note */}
          <SeniorToolBtn title="Sticky Note" isActive={isSenior('sticky')} onClick={() => onToolSelect('sticky')}>
            <StickySeniorIcon active={isSenior('sticky')} />
            <span className="text-[9px] text-[#8a8a8a] mt-0.5 leading-none">Sticky</span>
          </SeniorToolBtn>

          {/* Mind Map */}
          <SeniorToolBtn title="Mind Map (M)" isActive={isSenior('mindmap')} onClick={() => onToolSelect('mindmap')}>
            <MindMapIcon active={isSenior('mindmap')} />
            <span className="text-[9px] text-[#8a8a8a] mt-0.5 leading-none">Mind Map</span>
          </SeniorToolBtn>
        </div>

        {/* ── Full divider ─────────────────────────────── */}
        <div className="w-px h-8 bg-[#e4e4e4] mx-2 flex-shrink-0" />

        {/* ── AI Button ─────────────────────────────────── */}
        <button
          title="Ask Agathon Socratic AI"
          onClick={onAIClick}
          className={cn(
            'flex flex-col items-center justify-end w-16 h-full pb-2 rounded-xl transition-all duration-150 overflow-hidden',
            isAIPanelOpen
              ? 'bg-[#1e6ee8] text-white'
              : 'text-[#1e6ee8] hover:bg-[#eef4ff]'
          )}
        >
          <SparkleIcon size={22} />
          <span className={cn(
            'text-[9px] mt-0.5 leading-none font-semibold',
            isAIPanelOpen ? 'text-white' : 'text-[#1e6ee8]'
          )}>
            Ask AI
          </span>
        </button>
      </div>
    </div>
  );
}

// ─── Icons (inline SVG, no external dep) ─────────────────────────────────────

function SelectIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="m4 4 7.07 17 2.51-7.39L21 11.07z" />
    </svg>
  );
}

function HandIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 11V6a2 2 0 0 0-4 0v1M14 6V5a2 2 0 0 0-4 0v3M10 8V4a2 2 0 0 0-4 0v8l-2-2.7A2 2 0 1 0 2 12l2 4a8 8 0 0 0 8 4h2a8 8 0 0 0 8-8V9a2 2 0 0 0-4 0v2" />
    </svg>
  );
}

function FrameIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="3" />
      <path d="M7 2v20M17 2v20M2 7h20M2 17h20" />
    </svg>
  );
}

function ConnectorIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
      <path d="M7 12h10" />
    </svg>
  );
}

function NoteIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function ArrowUpTinyIcon() {
  return (
    <svg width={8} height={8} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
      <path d="m18 15-6-6-6 6" />
    </svg>
  );
}

function PenIcon({ active }: { active: boolean }) {
  return (
    <svg width={24} height={28} viewBox="0 0 24 28" fill="none" stroke={active ? '#1e6ee8' : '#525252'} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 24-4-4L16 8l4 4L12 24z" />
      <path d="M8 20l-4 4M16 8l-2-2a2 2 0 0 1 2.83-2.83L19 5.17" />
    </svg>
  );
}

function EraserIcon({ active }: { active: boolean }) {
  return (
    <svg width={24} height={28} viewBox="0 0 24 28" fill="none" stroke={active ? '#1e6ee8' : '#525252'} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 24H7L3 20l13-13 7 7-3 3" />
      <path d="M6.5 18.5l3 3" />
    </svg>
  );
}

function ShapeSeniorIcon({ active }: { active: boolean }) {
  const c = active ? '#1e6ee8' : '#525252';
  return (
    <svg width={32} height={32} viewBox="0 0 32 32" fill="none">
      {/* rect behind */}
      <rect x="14" y="14" width="13" height="13" rx="2" stroke={c} strokeWidth={1.6} fill={active ? '#dbeafe' : '#f5f5f5'} />
      {/* circle middle */}
      <circle cx="13" cy="13" r="6" stroke={c} strokeWidth={1.6} fill={active ? '#bfdbfe' : '#e8e8e8'} />
      {/* triangle front */}
      <path d="M4 22l8-14 8 14H4z" stroke={c} strokeWidth={1.6} fill={active ? '#93c5fd' : '#d0d0d0'} strokeLinejoin="round" />
    </svg>
  );
}

function TextSeniorIcon({ active }: { active: boolean }) {
  const c = active ? '#1e6ee8' : '#525252';
  return (
    <svg width={28} height={28} viewBox="0 0 28 28" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="5 7 5 4 23 4 23 7" />
      <line x1="12" y1="4" x2="12" y2="24" />
      <line x1="10" y1="24" x2="14" y2="24" />
    </svg>
  );
}

function StickySeniorIcon({ active }: { active: boolean }) {
  const c = active ? '#1e6ee8' : '#525252';
  const bg = active ? '#fef9c3' : '#fffde7';
  return (
    <svg width={28} height={28} viewBox="0 0 28 28" fill="none">
      <rect x="4" y="4" width="20" height="20" rx="3" fill={bg} stroke={c} strokeWidth={1.6} />
      <path d="M18 4v6l6-6" fill={bg} stroke={c} strokeWidth={1.6} strokeLinejoin="round" />
      <line x1="8" y1="12" x2="16" y2="12" stroke={c} strokeWidth={1.4} strokeLinecap="round" />
      <line x1="8" y1="16" x2="14" y2="16" stroke={c} strokeWidth={1.4} strokeLinecap="round" />
    </svg>
  );
}

function MindMapIcon({ active }: { active: boolean }) {
  const c = active ? '#1e6ee8' : '#525252';
  return (
    <svg width={32} height={28} viewBox="0 0 32 28" fill="none" stroke={c} strokeWidth={1.6} strokeLinecap="round">
      <rect x="11" y="11" width="10" height="7" rx="2" fill={active ? '#dbeafe' : '#f0f0f0'} />
      {/* left branch */}
      <rect x="1" y="5" width="7" height="5" rx="1.5" fill={active ? '#bfdbfe' : '#e4e4e4'} />
      <line x1="8" y1="7.5" x2="11" y2="13" />
      {/* left branch 2 */}
      <rect x="1" y="18" width="7" height="5" rx="1.5" fill={active ? '#bfdbfe' : '#e4e4e4'} />
      <line x1="8" y1="20.5" x2="11" y2="16" />
      {/* right branch */}
      <rect x="24" y="11" width="7" height="5" rx="1.5" fill={active ? '#93c5fd' : '#d8d8d8'} />
      <line x1="21" y1="14" x2="24" y2="13.5" />
    </svg>
  );
}

function SparkleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74L12 2z" />
      <path d="M5 16l.73 2.27L8 19l-2.27.73L5 22l-.73-2.27L2 19l2.27-.73L5 16zM19 3l.5 1.5L21 5l-1.5.5L19 7l-.5-1.5L17 5l1.5-.5L19 3z" />
    </svg>
  );
}
