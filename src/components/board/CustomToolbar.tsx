'use client';

import { useEditor, useValue, DefaultColorStyle, DefaultSizeStyle } from 'tldraw';
import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  Undo2,
  Redo2,
  ChevronDown,
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';

interface ToolButtonProps {
  icon: React.ReactNode;
  shortcut?: string;
  isActive: boolean;
  onClick: () => void;
  label: string;
  hasDropdown?: boolean;
  className?: string;
}

function ToolButton({ icon, shortcut, isActive, onClick, label, hasDropdown, className }: ToolButtonProps) {
  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
  };

  return (
    <button
      onClick={onClick}
      onPointerDown={handlePointerDown}
      onTouchStart={(e) => e.stopPropagation()}
      className={cn(
        'relative flex items-center justify-center gap-1',
        'h-11 px-3 rounded-xl transition-all duration-200',
        'hover:bg-gray-100/80 active:scale-95',
        'touch-manipulation select-none',
        isActive && 'bg-blue-50 shadow-inner',
        className
      )}
      title={`${label}${shortcut ? ` (${shortcut})` : ''}`}
    >
      <div className={cn(
        'flex items-center justify-center transition-colors',
        isActive ? 'text-blue-600' : 'text-gray-600'
      )}>
        {icon}
      </div>
      {hasDropdown && (
        <ChevronDown className={cn(
          'w-3 h-3 transition-colors',
          isActive ? 'text-blue-500' : 'text-gray-400'
        )} />
      )}
    </button>
  );
}

// Pen size presets
const PEN_SIZES = [
  { label: 'XS', value: 1, preview: 4 },
  { label: 'S', value: 2, preview: 6 },
  { label: 'M', value: 4, preview: 10 },
  { label: 'L', value: 8, preview: 16 },
  { label: 'XL', value: 16, preview: 24 },
];

// Color presets
const COLORS = [
  { name: 'Black', value: 'black', hex: '#1a1a1a' },
  { name: 'Gray', value: 'grey', hex: '#6b7280' },
  { name: 'Red', value: 'red', hex: '#ef4444' },
  { name: 'Orange', value: 'orange', hex: '#f97316' },
  { name: 'Yellow', value: 'yellow', hex: '#eab308' },
  { name: 'Green', value: 'green', hex: '#22c55e' },
  { name: 'Blue', value: 'blue', hex: '#3b82f6' },
  { name: 'Purple', value: 'violet', hex: '#8b5cf6' },
];

// Custom styled icons
function SelectIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 4L10 20L12 14L18 12L4 4Z" strokeLinejoin="round" />
    </svg>
  );
}

function HandIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 11V6a2 2 0 0 0-4 0v1M14 10V5a2 2 0 0 0-4 0v5M10 10V6a2 2 0 0 0-4 0v8a8 8 0 0 0 16 0v-4a2 2 0 0 0-4 0" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DrawIcon({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M3 21L5 14L16 3L21 8L10 19L3 21Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 6L18 10" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function RectangleIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="6" width="16" height="12" rx="2" />
    </svg>
  );
}

function ArrowIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 19L19 5M19 5H9M19 5V15" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function NoteIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="4" y="4" width="16" height="16" rx="2" fill="#fcd34d" />
      <path d="M8 9H16M8 12H14M8 15H12" stroke="#92400e" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function TextIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 7V5H20V7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 5V19" strokeLinecap="round" />
      <path d="M8 19H16" strokeLinecap="round" />
    </svg>
  );
}

function ImageIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="M4 16L8 12L12 14L16 10L20 14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EraserIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 20H9L4 15L14 5L20 11L13 18H20V20Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LassoIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 15C4.5 15 3 13 3 10.5C3 7 6 4 10.5 4C15 4 18 6.5 18 9.5C18 12 16.5 14 14 15" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 15C14 15 15 17 15 19C15 20.5 14 21 13 21C12 21 11 20 11 19C11 17.5 12 15 14 15Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 15L7 12" strokeLinecap="round" strokeDasharray="2 2" />
    </svg>
  );
}

export function CustomToolbar() {
  const editor = useEditor();
  const [penSettingsOpen, setPenSettingsOpen] = useState(false);

  const currentToolId = useValue('current tool', () => editor.getCurrentToolId(), [editor]);
  const canUndo = useValue('can undo', () => editor.getCanUndo(), [editor]);
  const canRedo = useValue('can redo', () => editor.getCanRedo(), [editor]);

  // Get current style values
  const currentColor = useValue('current color', () => {
    const style = editor.getSharedStyles();
    const colorStyle = style.get(DefaultColorStyle);
    if (!colorStyle || colorStyle.type === 'mixed') return 'black';
    return colorStyle.value ?? 'black';
  }, [editor]);

  const currentSize = useValue('current size', () => {
    const style = editor.getSharedStyles();
    const sizeStyle = style.get(DefaultSizeStyle);
    if (!sizeStyle || sizeStyle.type === 'mixed') return 'm';
    return sizeStyle.value ?? 'm';
  }, [editor]);

  const setColor = useCallback((color: string) => {
    editor.setStyleForNextShapes(DefaultColorStyle, color as any);
    editor.setStyleForSelectedShapes(DefaultColorStyle, color as any);
  }, [editor]);

  const setSize = useCallback((size: string) => {
    editor.setStyleForNextShapes(DefaultSizeStyle, size as any);
    editor.setStyleForSelectedShapes(DefaultSizeStyle, size as any);
  }, [editor]);

  const handleContainerPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
  };

  const currentColorHex = COLORS.find(c => c.value === currentColor)?.hex ?? '#1a1a1a';

  const tools = [
    { id: 'select', icon: <SelectIcon />, shortcut: 'V', label: 'Select' },
    { id: 'hand', icon: <HandIcon />, shortcut: 'H', label: 'Pan' },
    { id: 'lasso-solve', icon: <LassoIcon />, shortcut: 'L', label: 'Lasso Solve' },
  ];

  const drawingTools = [
    { id: 'draw', icon: <DrawIcon color={currentColorHex} />, shortcut: 'D', label: 'Pen', hasDropdown: true },
    { id: 'geo', icon: <RectangleIcon />, shortcut: 'R', label: 'Shape' },
    { id: 'arrow', icon: <ArrowIcon />, shortcut: 'A', label: 'Arrow' },
    { id: 'note', icon: <NoteIcon />, shortcut: 'N', label: 'Note' },
    { id: 'text', icon: <TextIcon />, shortcut: 'T', label: 'Text' },
    { id: 'asset', icon: <ImageIcon />, label: 'Image' },
    { id: 'eraser', icon: <EraserIcon />, shortcut: 'E', label: 'Eraser' },
  ];

  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[500] pointer-events-auto"
      onPointerDown={handleContainerPointerDown}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1.5 bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-gray-200/60 px-2 py-1.5">
        {/* Selection tools */}
        <div className="flex items-center gap-0.5">
          {tools.map((tool) => (
            <ToolButton
              key={tool.id}
              icon={tool.icon}
              shortcut={tool.shortcut}
              isActive={currentToolId === tool.id}
              onClick={() => editor.setCurrentTool(tool.id)}
              label={tool.label}
            />
          ))}
        </div>

        {/* Separator */}
        <div className="w-px h-8 bg-gray-200 mx-1" />

        {/* Drawing tools */}
        <div className="flex items-center gap-0.5">
          {drawingTools.map((tool) => (
            tool.id === 'draw' ? (
              <Popover key={tool.id} open={penSettingsOpen} onOpenChange={setPenSettingsOpen}>
                <PopoverTrigger asChild>
                  <div className="relative">
                    <ToolButton
                      icon={tool.icon}
                      shortcut={tool.shortcut}
                      isActive={currentToolId === tool.id}
                      onClick={() => {
                        editor.setCurrentTool(tool.id);
                        if (currentToolId === tool.id) {
                          setPenSettingsOpen(!penSettingsOpen);
                        }
                      }}
                      label={tool.label}
                      hasDropdown
                    />
                    {/* Color indicator dot */}
                    <div
                      className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full border border-white shadow-sm"
                      style={{ backgroundColor: currentColorHex }}
                    />
                  </div>
                </PopoverTrigger>
                <PopoverContent
                  side="top"
                  sideOffset={12}
                  className="w-64 p-4 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/60"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <div className="space-y-4">
                    {/* Pen Size */}
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3 block">
                        Stroke Size
                      </label>
                      <div className="flex items-center gap-2">
                        {PEN_SIZES.map((size) => (
                          <button
                            key={size.label}
                            onClick={() => setSize(size.label.toLowerCase())}
                            className={cn(
                              'flex-1 h-12 rounded-xl flex items-center justify-center transition-all duration-200',
                              'hover:bg-gray-100',
                              currentSize === size.label.toLowerCase()
                                ? 'bg-blue-50 ring-2 ring-blue-500 ring-offset-1'
                                : 'bg-gray-50'
                            )}
                          >
                            <div
                              className="rounded-full"
                              style={{
                                width: size.preview,
                                height: size.preview,
                                backgroundColor: currentColorHex
                              }}
                            />
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Separator */}
                    <div className="h-px bg-gray-100" />

                    {/* Colors */}
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3 block">
                        Color
                      </label>
                      <div className="grid grid-cols-8 gap-1.5">
                        {COLORS.map((color) => (
                          <button
                            key={color.value}
                            onClick={() => setColor(color.value)}
                            className={cn(
                              'w-7 h-7 rounded-full transition-all duration-200',
                              'hover:scale-110 active:scale-95',
                              'ring-offset-2',
                              currentColor === color.value && 'ring-2 ring-blue-500'
                            )}
                            style={{ backgroundColor: color.hex }}
                            title={color.name}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            ) : (
              <ToolButton
                key={tool.id}
                icon={tool.icon}
                shortcut={tool.shortcut}
                isActive={currentToolId === tool.id || (tool.id === 'geo' && currentToolId === 'rectangle')}
                onClick={() => editor.setCurrentTool(tool.id === 'geo' ? 'rectangle' : tool.id)}
                label={tool.label}
              />
            )
          ))}
        </div>

        {/* Separator */}
        <div className="w-px h-8 bg-gray-200 mx-1" />

        {/* Undo/Redo */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => editor.undo()}
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            disabled={!canUndo}
            className={cn(
              'h-11 w-11 flex items-center justify-center rounded-xl transition-all duration-200',
              'active:scale-95 touch-manipulation',
              canUndo
                ? 'text-gray-600 hover:bg-gray-100/80'
                : 'text-gray-300 cursor-not-allowed'
            )}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-5 h-5" />
          </button>
          <button
            onClick={() => editor.redo()}
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            disabled={!canRedo}
            className={cn(
              'h-11 w-11 flex items-center justify-center rounded-xl transition-all duration-200',
              'active:scale-95 touch-manipulation',
              canRedo
                ? 'text-gray-600 hover:bg-gray-100/80'
                : 'text-gray-300 cursor-not-allowed'
            )}
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
