'use client';

/**
 * EditorToolbar — AFFiNE-style floating bottom-center toolbar for edgeless mode.
 *
 * Layout mirrors AFFiNE:
 *   [ Select | Hand ] | [ Draw | Shape | Text | Sticky | Frame | Connector ] | [ Eraser ] | [ AI ]
 *
 * In page (doc) mode the toolbar collapses to just the AI button.
 */

import { cn } from '@/lib/utils';
import type { CanvasMode } from './AffineCanvas';

interface Tool {
  id: string;
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
}

interface ToolGroup {
  tools: Tool[];
}

interface EditorToolbarProps {
  mode: CanvasMode;
  activeTool: string;
  onToolSelect: (toolId: string) => void;
  onAIClick: () => void;
  isAIPanelOpen: boolean;
}

// SVG icon helpers — inline so no icon lib peer dep issues
function Icon({ d, size = 20 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const TOOLS: ToolGroup[] = [
  {
    tools: [
      {
        id: 'default',
        label: 'Select',
        shortcut: 'V',
        icon: (
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4l7 18 3-7 7-3z" />
          </svg>
        ),
      },
      {
        id: 'pan',
        label: 'Hand / Pan',
        shortcut: 'H',
        icon: (
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2" />
            <path d="M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v2" />
            <path d="M10 10.5V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8" />
            <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
          </svg>
        ),
      },
    ],
  },
  {
    tools: [
      {
        id: 'brush',
        label: 'Pen',
        shortcut: 'P',
        icon: <Icon d="M12 19l7-7 3 3-7 7-3-3z M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z M2 2l7.586 7.586" />,
      },
      {
        id: 'shape',
        label: 'Shape',
        shortcut: 'S',
        icon: <Icon d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />,
      },
      {
        id: 'affine:text',
        label: 'Text',
        shortcut: 'T',
        icon: (
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4 7 4 4 20 4 20 7" />
            <line x1="9" y1="20" x2="15" y2="20" />
            <line x1="12" y1="4" x2="12" y2="20" />
          </svg>
        ),
      },
      {
        id: 'affine:note',
        label: 'Sticky Note',
        shortcut: 'N',
        icon: (
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M15.5 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3z" />
            <polyline points="15 3 15 9 21 9" />
          </svg>
        ),
      },
      {
        id: 'frame',
        label: 'Frame',
        shortcut: 'F',
        icon: (
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
          </svg>
        ),
      },
      {
        id: 'connector',
        label: 'Connector',
        shortcut: 'C',
        icon: (
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        ),
      },
    ],
  },
  {
    tools: [
      {
        id: 'eraser',
        label: 'Eraser',
        shortcut: 'E',
        icon: (
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 20H7L3 16l10-10 7 7-2 2" />
            <path d="M6.0001 15.001l3 3" />
          </svg>
        ),
      },
    ],
  },
];

function ToolButton({
  tool,
  isActive,
  onClick,
}: {
  tool: Tool;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      title={tool.shortcut ? `${tool.label} (${tool.shortcut})` : tool.label}
      onClick={onClick}
      className={cn(
        'relative flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-150',
        'text-[#3d3d3d] hover:bg-[#f5f5f5] active:scale-95',
        isActive && 'bg-[#e8f2ff] text-[#1e6ee8]'
      )}
    >
      {tool.icon}
      {isActive && (
        <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#1e6ee8]" />
      )}
    </button>
  );
}

export default function EditorToolbar({
  mode,
  activeTool,
  onToolSelect,
  onAIClick,
  isAIPanelOpen,
}: EditorToolbarProps) {
  if (mode === 'page') {
    // Minimal toolbar for doc mode — just AI button
    return (
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40">
        <button
          onClick={onAIClick}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.12)] border border-white/60',
            'text-sm font-medium transition-all duration-200 active:scale-95',
            isAIPanelOpen
              ? 'bg-[#1e6ee8] text-white'
              : 'bg-white text-[#3d3d3d] hover:bg-[#f5f5f5]'
          )}
        >
          <SparkleIcon />
          Ask AI
        </button>
      </div>
    );
  }

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 select-none">
      <div
        className="flex items-center gap-1 px-2 py-1.5 rounded-2xl
          bg-white/95 backdrop-blur-sm
          shadow-[0_4px_24px_rgba(0,0,0,0.12),0_1px_4px_rgba(0,0,0,0.06)]
          border border-[#e8e8e8]/80"
      >
        {TOOLS.map((group, gi) => (
          <div key={gi} className="flex items-center gap-0.5">
            {group.tools.map((tool) => (
              <ToolButton
                key={tool.id}
                tool={tool}
                isActive={activeTool === tool.id}
                onClick={() => onToolSelect(tool.id)}
              />
            ))}
            {gi < TOOLS.length - 1 && (
              <div className="w-px h-5 bg-[#e4e4e4] mx-1 rounded-full" />
            )}
          </div>
        ))}

        {/* Divider before AI */}
        <div className="w-px h-5 bg-[#e4e4e4] mx-1 rounded-full" />

        {/* AI Button */}
        <button
          title="Ask Socratic AI"
          onClick={onAIClick}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 active:scale-95',
            isAIPanelOpen
              ? 'bg-[#1e6ee8] text-white shadow-[0_2px_8px_rgba(30,110,232,0.3)]'
              : 'text-[#1e6ee8] hover:bg-[#e8f2ff]'
          )}
        >
          <SparkleIcon size={16} />
          <span className="text-xs font-semibold">Ask AI</span>
        </button>
      </div>
    </div>
  );
}

function SparkleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l2.4 7.2H22l-6.2 4.5 2.4 7.2L12 17l-6.2 3.9 2.4-7.2L2 9.2h7.6L12 2z" />
    </svg>
  );
}
