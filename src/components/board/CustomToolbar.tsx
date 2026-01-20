'use client';

import { useEditor, useValue } from 'tldraw';
import { cn } from '@/lib/utils';
import {
  MousePointer2,
  Hand,
  Pencil,
  Square,
  ArrowUpRight,
  StickyNote,
  Type,
  Frame,
  Image,
  Workflow,
  Eraser,
  Undo2,
  Redo2,
} from 'lucide-react';

interface ToolButtonProps {
  tool: string;
  icon: React.ReactNode;
  shortcut?: string;
  isActive: boolean;
  onClick: () => void;
  label: string;
}

function ToolButton({ tool, icon, shortcut, isActive, onClick, label }: ToolButtonProps) {
  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
  };

  return (
    <button
      onClick={onClick}
      onPointerDown={handlePointerDown}
      onTouchStart={(e) => e.stopPropagation()}
      className={cn(
        'relative flex flex-col items-center justify-center',
        'w-12 h-14 rounded-lg transition-all duration-150',
        'hover:bg-gray-100 touch-manipulation',
        isActive && 'bg-blue-50'
      )}
      title={`${label}${shortcut ? ` (${shortcut})` : ''}`}
    >
      {/* Keyboard shortcut */}
      {shortcut && (
        <span className="text-[10px] text-gray-400 font-medium mb-0.5">
          {shortcut}
        </span>
      )}
      {/* Icon */}
      <div className={cn(
        'flex items-center justify-center',
        isActive ? 'text-blue-600' : 'text-gray-700'
      )}>
        {icon}
      </div>
    </button>
  );
}

// Custom styled icons to match the design
function SelectIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 4L10 20L12 14L18 12L4 4Z" />
    </svg>
  );
}

function HandIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M18 11V6a2 2 0 0 0-4 0v1M14 10V5a2 2 0 0 0-4 0v5M10 10V6a2 2 0 0 0-4 0v8a8 8 0 0 0 16 0v-4a2 2 0 0 0-4 0" />
    </svg>
  );
}

function DrawIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 20L6 18" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function RectangleIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="#22c55e">
      <rect x="4" y="6" width="16" height="12" rx="2" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M5 19L19 5M19 5H9M19 5V15" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function NoteIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="4" width="16" height="16" rx="2" fill="#fcd34d" />
      <path d="M14 4V10H20" fill="#f59e0b" />
      <path d="M8 9H12M8 12H14M8 15H11" stroke="#92400e" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function TextIcon2() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="6" y="6" width="12" height="12" rx="2" fill="#e5e7eb" />
      <text x="12" y="15" fontSize="10" fontWeight="bold" fill="#374151" textAnchor="middle">T</text>
    </svg>
  );
}

function FrameIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="8" width="16" height="12" rx="2" fill="#f3f4f6" stroke="#d1d5db" strokeWidth="1.5" />
      <circle cx="8" cy="14" r="2" fill="#fcd34d" />
      <path d="M4 18L10 14L14 16L20 12" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="6" width="16" height="12" rx="2" fill="#dbeafe" />
      <circle cx="9" cy="10" r="2" fill="#fcd34d" />
      <path d="M4 15L8 12L12 14L16 10L20 14V16C20 17.1 19.1 18 18 18H6C4.9 18 4 17.1 4 16V15Z" fill="#818cf8" />
    </svg>
  );
}

function DiagramIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="4" width="6" height="6" rx="1" fill="#fecaca" stroke="#f87171" strokeWidth="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" fill="#bbf7d0" stroke="#4ade80" strokeWidth="1" />
      <rect x="9" y="14" width="6" height="6" rx="1" fill="#fef08a" stroke="#facc15" strokeWidth="1" />
      <path d="M10 7H14M7 10V14M17 10V14" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function EraserIcon2() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M20 20H9L4 15L14 5L20 11L13 18H20V20Z" />
      <path d="M14 5L20 11" />
    </svg>
  );
}

export function CustomToolbar() {
  const editor = useEditor();

  const currentToolId = useValue('current tool', () => editor.getCurrentToolId(), [editor]);
  const canUndo = useValue('can undo', () => editor.getCanUndo(), [editor]);
  const canRedo = useValue('can redo', () => editor.getCanRedo(), [editor]);

  const tools = [
    { id: 'select', icon: <SelectIcon />, shortcut: 'V', label: 'Select' },
    { id: 'hand', icon: <HandIcon />, shortcut: 'H', label: 'Hand' },
    { id: 'draw', icon: <DrawIcon />, shortcut: 'D', label: 'Draw' },
    { id: 'geo', icon: <RectangleIcon />, shortcut: 'R', label: 'Rectangle' },
    { id: 'arrow', icon: <ArrowIcon />, shortcut: 'A', label: 'Arrow' },
    { id: 'note', icon: <NoteIcon />, shortcut: 'N', label: 'Sticky Note' },
    { id: 'text', icon: <TextIcon2 />, shortcut: 'T', label: 'Text' },
    { id: 'frame', icon: <FrameIcon />, shortcut: 'F', label: 'Frame' },
    { id: 'asset', icon: <ImageIcon />, shortcut: undefined, label: 'Image' },
    { id: 'eraser', icon: <EraserIcon2 />, shortcut: 'E', label: 'Eraser' },
  ];

  const handleContainerPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[500] pointer-events-auto"
      onPointerDown={handleContainerPointerDown}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1 bg-white rounded-2xl shadow-lg border border-gray-200 px-2 py-1">
        {/* Main tools */}
        <div className="flex items-center">
          {tools.map((tool, index) => (
            <div key={tool.id} className="flex items-center">
              <ToolButton
                tool={tool.id}
                icon={tool.icon}
                shortcut={tool.shortcut}
                isActive={currentToolId === tool.id || (tool.id === 'geo' && currentToolId === 'rectangle')}
                onClick={() => editor.setCurrentTool(tool.id === 'geo' ? 'rectangle' : tool.id)}
                label={tool.label}
              />
              {/* Separator after hand tool and before undo/redo */}
              {(index === 1 || index === tools.length - 1) && (
                <div className="w-px h-8 bg-gray-200 mx-1" />
              )}
            </div>
          ))}
        </div>

        {/* Undo/Redo */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => editor.undo()}
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            disabled={!canUndo}
            className={cn(
              'w-10 h-10 flex items-center justify-center rounded-lg transition-all touch-manipulation',
              canUndo
                ? 'text-gray-600 hover:bg-gray-100'
                : 'text-gray-300 cursor-not-allowed'
            )}
            title="Undo"
          >
            <Undo2 className="w-5 h-5" />
          </button>
          <button
            onClick={() => editor.redo()}
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            disabled={!canRedo}
            className={cn(
              'w-10 h-10 flex items-center justify-center rounded-lg transition-all touch-manipulation',
              canRedo
                ? 'text-gray-600 hover:bg-gray-100'
                : 'text-gray-300 cursor-not-allowed'
            )}
            title="Redo"
          >
            <Redo2 className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
