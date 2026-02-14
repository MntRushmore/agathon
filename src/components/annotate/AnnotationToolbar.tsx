'use client';

import { useState } from 'react';
import { Undo2, Redo2, ZoomIn, ZoomOut, ArrowLeft, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { ToolType, ShapeType } from '@/lib/annotate/types';

interface AnnotationToolbarProps {
  activeTool: ToolType;
  penColor: string;
  penSize: number;
  highlighterColor: string;
  highlighterSize: number;
  shapeType: ShapeType;
  shapeColor: string;
  shapeSize: number;
  canUndo: boolean;
  canRedo: boolean;
  zoom: number;
  onToolChange: (tool: ToolType) => void;
  onPenColorChange: (color: string) => void;
  onPenSizeChange: (size: number) => void;
  onHighlighterColorChange: (color: string) => void;
  onHighlighterSizeChange: (size: number) => void;
  onShapeTypeChange: (shapeType: ShapeType) => void;
  onShapeColorChange: (color: string) => void;
  onShapeSizeChange: (size: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onZoomChange: (zoom: number) => void;
  onBack: () => void;
  onSave: () => void;
  saving?: boolean;
}

const PEN_SIZES = [
  { label: 'S', value: 2, preview: 6 },
  { label: 'M', value: 4, preview: 10 },
  { label: 'L', value: 8, preview: 16 },
  { label: 'XL', value: 16, preview: 24 },
];

const COLORS = [
  { name: 'Black', hex: '#1a1a1a' },
  { name: 'Gray', hex: '#6b7280' },
  { name: 'Red', hex: '#ef4444' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Yellow', hex: '#eab308' },
  { name: 'Green', hex: '#22c55e' },
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Purple', hex: '#8b5cf6' },
];

// --- Icons ---

function SelectIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 4L10 20L13 13L20 10L4 4Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DrawIcon({ size = 18, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M3 21L5 14L16 3L21 8L10 19L3 21Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 6L18 10" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function HighlighterIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 2L22 6L12 16H8V12L18 2Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 20H20" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

function TextIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 7V5H20V7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 5V19" strokeLinecap="round" />
      <path d="M8 19H16" strokeLinecap="round" />
    </svg>
  );
}

function EraserIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 20H9L4 15L14 5L20 11L13 18H20V20Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ShapeIcon({ shapeType, size = 18 }: { shapeType: ShapeType; size?: number }) {
  switch (shapeType) {
    case 'rectangle':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="5" width="18" height="14" rx="1" strokeLinecap="round" />
        </svg>
      );
    case 'circle':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
    case 'line':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="4" y1="20" x2="20" y2="4" strokeLinecap="round" />
        </svg>
      );
    case 'arrow':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="4" y1="20" x2="20" y2="4" strokeLinecap="round" />
          <polyline points="10,4 20,4 20,14" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}

// --- Buttons ---

interface ToolButtonProps {
  icon: React.ReactNode;
  shortcut?: string;
  isActive: boolean;
  onClick: () => void;
  label: string;
  hasDropdown?: boolean;
  disabled?: boolean;
}

function ToolButton({ icon, shortcut, isActive, onClick, label, hasDropdown, disabled }: ToolButtonProps) {
  return (
    <button
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      disabled={disabled}
      className={cn(
        'relative flex items-center justify-center no-enlarge',
        'rounded-lg transition-all duration-150',
        'hover:bg-gray-100 active:scale-[0.92]',
        'touch-manipulation select-none',
        'h-10 w-10',
        isActive && 'bg-blue-50/80 text-blue-600 shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)]',
        !isActive && !disabled && 'text-gray-500',
        disabled && 'text-gray-300 cursor-not-allowed',
      )}
      title={`${label}${shortcut ? ` (${shortcut})` : ''}`}
    >
      <div className="flex items-center justify-center">
        {icon}
      </div>
      {hasDropdown && (
        <svg className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M6 9L12 15L18 9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

function Separator() {
  return <div className="w-px h-7 bg-gray-200/80 mx-0.5" />;
}

// --- Popovers ---

function PenSettingsPopover({
  currentColor,
  currentSize,
  onColorChange,
  onSizeChange,
}: {
  currentColor: string;
  currentSize: number;
  onColorChange: (color: string) => void;
  onSizeChange: (size: number) => void;
}) {
  return (
    <div className="space-y-3.5">
      <div>
        <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 block">
          Size
        </label>
        <div className="flex items-center gap-1.5">
          {PEN_SIZES.map((s) => (
            <button
              key={s.label}
              onClick={() => onSizeChange(s.value)}
              className={cn(
                'flex-1 h-10 rounded-lg flex items-center justify-center transition-all duration-150 no-enlarge',
                'hover:bg-gray-50',
                currentSize === s.value
                  ? 'bg-blue-50/80 ring-1.5 ring-blue-500/50'
                  : 'bg-gray-50/50'
              )}
            >
              <div
                className="rounded-full"
                style={{
                  width: s.preview,
                  height: s.preview,
                  backgroundColor: currentColor,
                }}
              />
            </button>
          ))}
        </div>
      </div>

      <div className="h-px bg-gray-100" />

      <div>
        <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 block">
          Color
        </label>
        <div className="grid grid-cols-8 gap-1.5">
          {COLORS.map((color) => (
            <button
              key={color.hex}
              onClick={() => onColorChange(color.hex)}
              className={cn(
                'w-6 h-6 rounded-full transition-all duration-150 no-enlarge',
                'hover:scale-110 active:scale-95',
                currentColor === color.hex && 'ring-2 ring-blue-500 ring-offset-2'
              )}
              style={{ backgroundColor: color.hex }}
              title={color.name}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ShapeSettingsPopover({
  currentShapeType,
  currentColor,
  currentSize,
  onShapeTypeChange,
  onColorChange,
  onSizeChange,
}: {
  currentShapeType: ShapeType;
  currentColor: string;
  currentSize: number;
  onShapeTypeChange: (shapeType: ShapeType) => void;
  onColorChange: (color: string) => void;
  onSizeChange: (size: number) => void;
}) {
  const shapes: { type: ShapeType; label: string }[] = [
    { type: 'line', label: 'Line' },
    { type: 'rectangle', label: 'Rectangle' },
    { type: 'circle', label: 'Circle' },
    { type: 'arrow', label: 'Arrow' },
  ];

  return (
    <div className="space-y-3.5">
      {/* Shape type */}
      <div>
        <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 block">
          Shape
        </label>
        <div className="flex items-center gap-1.5">
          {shapes.map((s) => (
            <button
              key={s.type}
              onClick={() => onShapeTypeChange(s.type)}
              className={cn(
                'flex-1 h-10 rounded-lg flex items-center justify-center transition-all duration-150 no-enlarge',
                'hover:bg-gray-50',
                currentShapeType === s.type
                  ? 'bg-blue-50/80 ring-1.5 ring-blue-500/50 text-blue-600'
                  : 'bg-gray-50/50 text-gray-500'
              )}
              title={s.label}
            >
              <ShapeIcon shapeType={s.type} size={16} />
            </button>
          ))}
        </div>
      </div>

      <div className="h-px bg-gray-100" />

      {/* Size */}
      <div>
        <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 block">
          Stroke Width
        </label>
        <div className="flex items-center gap-1.5">
          {PEN_SIZES.map((s) => (
            <button
              key={s.label}
              onClick={() => onSizeChange(s.value)}
              className={cn(
                'flex-1 h-10 rounded-lg flex items-center justify-center transition-all duration-150 no-enlarge',
                'hover:bg-gray-50',
                currentSize === s.value
                  ? 'bg-blue-50/80 ring-1.5 ring-blue-500/50'
                  : 'bg-gray-50/50'
              )}
            >
              <div
                className="rounded-full"
                style={{
                  width: s.preview,
                  height: s.preview,
                  backgroundColor: currentColor,
                }}
              />
            </button>
          ))}
        </div>
      </div>

      <div className="h-px bg-gray-100" />

      {/* Color */}
      <div>
        <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 block">
          Color
        </label>
        <div className="grid grid-cols-8 gap-1.5">
          {COLORS.map((color) => (
            <button
              key={color.hex}
              onClick={() => onColorChange(color.hex)}
              className={cn(
                'w-6 h-6 rounded-full transition-all duration-150 no-enlarge',
                'hover:scale-110 active:scale-95',
                currentColor === color.hex && 'ring-2 ring-blue-500 ring-offset-2'
              )}
              style={{ backgroundColor: color.hex }}
              title={color.name}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Main Toolbar ---

export function AnnotationToolbar({
  activeTool,
  penColor,
  penSize,
  highlighterColor,
  highlighterSize,
  shapeType,
  shapeColor,
  shapeSize,
  canUndo,
  canRedo,
  zoom,
  onToolChange,
  onPenColorChange,
  onPenSizeChange,
  onHighlighterColorChange,
  onHighlighterSizeChange,
  onShapeTypeChange,
  onShapeColorChange,
  onShapeSizeChange,
  onUndo,
  onRedo,
  onZoomChange,
  onBack,
  onSave,
  saving,
}: AnnotationToolbarProps) {
  const [penSettingsOpen, setPenSettingsOpen] = useState(false);
  const [highlighterSettingsOpen, setHighlighterSettingsOpen] = useState(false);
  const [shapeSettingsOpen, setShapeSettingsOpen] = useState(false);

  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[var(--z-toolbar)] pointer-events-auto max-w-[calc(100vw-2rem)]"
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-0.5 bg-white/95 backdrop-blur-xl shadow-[0_2px_20px_rgba(0,0,0,0.08)] border border-gray-200/50 rounded-2xl px-2 py-1.5">
        {/* Back button */}
        <ToolButton
          icon={<ArrowLeft className="w-[18px] h-[18px]" />}
          isActive={false}
          onClick={onBack}
          label="Back"
        />

        <Separator />

        {/* Drawing tools */}
        <div className="flex items-center gap-0.5">
          {/* Select tool */}
          <ToolButton
            icon={<SelectIcon />}
            shortcut="V"
            isActive={activeTool === 'select'}
            onClick={() => onToolChange('select')}
            label="Select"
          />

          {/* Pen with settings popover */}
          <Popover open={penSettingsOpen} onOpenChange={setPenSettingsOpen}>
            <PopoverTrigger asChild>
              <div className="relative">
                <ToolButton
                  icon={<DrawIcon color={activeTool === 'pen' ? penColor : 'currentColor'} />}
                  shortcut="P"
                  isActive={activeTool === 'pen'}
                  onClick={() => {
                    onToolChange('pen');
                    if (activeTool === 'pen') setPenSettingsOpen(!penSettingsOpen);
                  }}
                  label="Pen"
                  hasDropdown
                />
                <div
                  className="absolute w-2 h-2 rounded-full border border-white shadow-sm bottom-1 left-1/2 -translate-x-1/2"
                  style={{ backgroundColor: penColor }}
                />
              </div>
            </PopoverTrigger>
            <PopoverContent
              side="bottom"
              sideOffset={12}
              className="w-56 p-3.5 bg-white/95 backdrop-blur-xl rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.12)] border border-gray-200/50"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <PenSettingsPopover
                currentColor={penColor}
                currentSize={penSize}
                onColorChange={onPenColorChange}
                onSizeChange={onPenSizeChange}
              />
            </PopoverContent>
          </Popover>

          {/* Highlighter with settings popover */}
          <Popover open={highlighterSettingsOpen} onOpenChange={setHighlighterSettingsOpen}>
            <PopoverTrigger asChild>
              <div className="relative">
                <ToolButton
                  icon={<HighlighterIcon />}
                  shortcut="H"
                  isActive={activeTool === 'highlighter'}
                  onClick={() => {
                    onToolChange('highlighter');
                    if (activeTool === 'highlighter') setHighlighterSettingsOpen(!highlighterSettingsOpen);
                  }}
                  label="Highlighter"
                  hasDropdown
                />
                <div
                  className="absolute w-2 h-2 rounded-full border border-white shadow-sm bottom-1 left-1/2 -translate-x-1/2"
                  style={{ backgroundColor: highlighterColor, opacity: 0.6 }}
                />
              </div>
            </PopoverTrigger>
            <PopoverContent
              side="bottom"
              sideOffset={12}
              className="w-56 p-3.5 bg-white/95 backdrop-blur-xl rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.12)] border border-gray-200/50"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <PenSettingsPopover
                currentColor={highlighterColor}
                currentSize={highlighterSize}
                onColorChange={onHighlighterColorChange}
                onSizeChange={onHighlighterSizeChange}
              />
            </PopoverContent>
          </Popover>

          <ToolButton
            icon={<TextIcon />}
            shortcut="T"
            isActive={activeTool === 'text'}
            onClick={() => onToolChange('text')}
            label="Text"
          />

          {/* Shape tool with settings popover */}
          <Popover open={shapeSettingsOpen} onOpenChange={setShapeSettingsOpen}>
            <PopoverTrigger asChild>
              <div className="relative">
                <ToolButton
                  icon={<ShapeIcon shapeType={shapeType} />}
                  shortcut="S"
                  isActive={activeTool === 'shape'}
                  onClick={() => {
                    onToolChange('shape');
                    if (activeTool === 'shape') setShapeSettingsOpen(!shapeSettingsOpen);
                  }}
                  label="Shape"
                  hasDropdown
                />
                <div
                  className="absolute w-2 h-2 rounded-full border border-white shadow-sm bottom-1 left-1/2 -translate-x-1/2"
                  style={{ backgroundColor: shapeColor }}
                />
              </div>
            </PopoverTrigger>
            <PopoverContent
              side="bottom"
              sideOffset={12}
              className="w-64 p-3.5 bg-white/95 backdrop-blur-xl rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.12)] border border-gray-200/50"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <ShapeSettingsPopover
                currentShapeType={shapeType}
                currentColor={shapeColor}
                currentSize={shapeSize}
                onShapeTypeChange={onShapeTypeChange}
                onColorChange={onShapeColorChange}
                onSizeChange={onShapeSizeChange}
              />
            </PopoverContent>
          </Popover>

          <ToolButton
            icon={<EraserIcon />}
            shortcut="E"
            isActive={activeTool === 'eraser'}
            onClick={() => onToolChange('eraser')}
            label="Eraser"
          />
        </div>

        <Separator />

        {/* Undo/Redo */}
        <div className="flex items-center gap-0.5">
          <ToolButton
            icon={<Undo2 className="w-[18px] h-[18px]" />}
            shortcut="Ctrl+Z"
            isActive={false}
            onClick={onUndo}
            label="Undo"
            disabled={!canUndo}
          />
          <ToolButton
            icon={<Redo2 className="w-[18px] h-[18px]" />}
            shortcut="Ctrl+Shift+Z"
            isActive={false}
            onClick={onRedo}
            label="Redo"
            disabled={!canRedo}
          />
        </div>

        <Separator />

        {/* Zoom controls */}
        <div className="flex items-center gap-0.5">
          <ToolButton
            icon={<ZoomOut className="w-[18px] h-[18px]" />}
            isActive={false}
            onClick={() => onZoomChange(Math.max(0.5, zoom - 0.25))}
            label="Zoom Out"
            disabled={zoom <= 0.5}
          />
          <span className="text-xs font-medium text-gray-500 w-10 text-center tabular-nums select-none">
            {Math.round(zoom * 100)}%
          </span>
          <ToolButton
            icon={<ZoomIn className="w-[18px] h-[18px]" />}
            isActive={false}
            onClick={() => onZoomChange(Math.min(3, zoom + 0.25))}
            label="Zoom In"
            disabled={zoom >= 3}
          />
        </div>

        <Separator />

        {/* Save/Download */}
        <ToolButton
          icon={saving
            ? <div className="w-[18px] h-[18px] border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            : <Download className="w-[18px] h-[18px]" />
          }
          isActive={false}
          onClick={onSave}
          label="Save PDF"
          disabled={saving}
        />
      </div>
    </div>
  );
}
