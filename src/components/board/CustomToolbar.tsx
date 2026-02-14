'use client';

import { useEditor, useValue, DefaultColorStyle, DefaultSizeStyle, createShapeId } from 'tldraw';
import { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import {
  Undo2,
  Redo2,
  ChevronDown,
  ChevronRight,
  Pi,
} from 'lucide-react';
import { MathKeyboard } from './MathKeyboard';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { useDocumentPanelOpen } from '@/lib/contexts/document-panel-context';

interface ToolButtonProps {
  icon: React.ReactNode;
  shortcut?: string;
  isActive: boolean;
  onClick: () => void;
  label: string;
  hasDropdown?: boolean;
  className?: string;
  vertical?: boolean;
}

function ToolButton({ icon, shortcut, isActive, onClick, label, hasDropdown, className, vertical }: ToolButtonProps) {
  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          onPointerDown={handlePointerDown}
          onTouchStart={(e) => e.stopPropagation()}
          className={cn(
            'no-enlarge relative flex items-center justify-center',
            'rounded-md transition-all duration-150',
            'hover:bg-gray-50 active:scale-[0.92]',
            'touch-manipulation select-none',
            vertical ? 'w-10 h-10' : 'h-9 w-9',
            isActive && 'bg-[#007ba5]/10 text-[#007ba5]',
            !isActive && 'text-gray-500',
            className
          )}
          aria-label={label}
        >
          <div className="flex items-center justify-center">
            {icon}
          </div>
          {hasDropdown && (
            vertical ? (
              <ChevronRight className="absolute right-0.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 text-gray-400" />
            ) : (
              <ChevronDown className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2.5 h-2.5 text-gray-400" />
            )
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side={vertical ? 'right' : 'bottom'} sideOffset={8}>
        <span>{label}</span>
        {shortcut && <kbd className="ml-1.5 text-[10px] opacity-60 bg-gray-100 px-1 py-0.5 rounded">{shortcut}</kbd>}
      </TooltipContent>
    </Tooltip>
  );
}

// Pen size presets
const PEN_SIZES = [
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
function SelectIcon({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 4L10 20L12 14L18 12L4 4Z" strokeLinejoin="round" />
    </svg>
  );
}

function HandIcon({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 11V6a2 2 0 0 0-4 0v1M14 10V5a2 2 0 0 0-4 0v5M10 10V6a2 2 0 0 0-4 0v8a8 8 0 0 0 16 0v-4a2 2 0 0 0-4 0" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DrawIcon({ size = 17, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M3 21L5 14L16 3L21 8L10 19L3 21Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 6L18 10" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function RectangleIcon({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="6" width="16" height="12" rx="2" />
    </svg>
  );
}

function ArrowIcon({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 19L19 5M19 5H9M19 5V15" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function NoteIcon({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="4" y="4" width="16" height="16" rx="2" fill="#fcd34d" />
      <path d="M8 9H16M8 12H14M8 15H12" stroke="#92400e" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function TextIcon({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 7V5H20V7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 5V19" strokeLinecap="round" />
      <path d="M8 19H16" strokeLinecap="round" />
    </svg>
  );
}

function ImageIcon({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="M4 16L8 12L12 14L16 10L20 14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EraserIcon({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 20H9L4 15L14 5L20 11L13 18H20V20Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LassoIcon({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 15C4.5 15 3 13 3 10.5C3 7 6 4 10.5 4C15 4 18 6.5 18 9.5C18 12 16.5 14 14 15" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 15C14 15 15 17 15 19C15 20.5 14 21 13 21C12 21 11 20 11 19C11 17.5 12 15 14 15Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 15L7 12" strokeLinecap="round" strokeDasharray="2 2" />
    </svg>
  );
}

function Separator({ vertical }: { vertical: boolean }) {
  return vertical
    ? <div className="h-px w-7 bg-gray-200/80 mx-auto my-0.5" />
    : <div className="w-px h-6 bg-gray-200 mx-1" />;
}

/** The tool buttons rendered as an inline flex row (no wrapper container) */
function ToolButtonsInline({
  editor,
  currentToolId,
  currentColor,
  currentSize,
  currentColorHex,
  canUndo,
  canRedo,
  penSettingsOpen,
  setPenSettingsOpen,
  mathKeyboardOpen,
  setMathKeyboardOpen,
  setColor,
  setSize,
  handleInsertMath,
}: {
  editor: ReturnType<typeof useEditor>;
  currentToolId: string;
  currentColor: string;
  currentSize: string;
  currentColorHex: string;
  canUndo: boolean;
  canRedo: boolean;
  penSettingsOpen: boolean;
  setPenSettingsOpen: (open: boolean) => void;
  mathKeyboardOpen: boolean;
  setMathKeyboardOpen: (open: boolean) => void;
  setColor: (color: string) => void;
  setSize: (size: string) => void;
  handleInsertMath: (latex: string) => void;
}) {
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
    <>
      {/* Selection tools */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
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

      <Separator vertical={false} />

      {/* Drawing tools */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
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
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full border border-white shadow-sm"
                    style={{ backgroundColor: currentColorHex }}
                  />
                </div>
              </PopoverTrigger>
              <PopoverContent
                side="bottom"
                sideOffset={12}
                className="w-56 p-3.5 bg-white rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.12)] border border-gray-200/50"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <div className="space-y-3.5">
                  {/* Pen Size */}
                  <div>
                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 block">
                      Size
                    </label>
                    <div className="flex items-center gap-1.5">
                      {PEN_SIZES.map((size) => (
                        <button
                          key={size.label}
                          onClick={() => setSize(size.label.toLowerCase())}
                          className={cn(
                            'no-enlarge flex-1 h-9 rounded-md flex items-center justify-center transition-all duration-150',
                            'hover:bg-gray-50',
                            currentSize === size.label.toLowerCase()
                              ? 'bg-[#007ba5]/10 ring-1.5 ring-[#007ba5]/50'
                              : 'bg-gray-50/50'
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

                  <div className="h-px bg-gray-100" />

                  {/* Colors */}
                  <div>
                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 block">
                      Color
                    </label>
                    <div className="grid grid-cols-8 gap-1.5">
                      {COLORS.map((color) => (
                        <button
                          key={color.value}
                          onClick={() => setColor(color.value)}
                          className={cn(
                            'no-enlarge w-6 h-6 rounded-full transition-all duration-150',
                            'hover:scale-110 active:scale-95',
                            currentColor === color.value && 'ring-2 ring-[#007ba5] ring-offset-2'
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

      <Separator vertical={false} />

      {/* Math Keyboard Button */}
      <ToolButton
        icon={<Pi className="w-[17px] h-[17px]" />}
        shortcut="M"
        isActive={mathKeyboardOpen}
        onClick={() => setMathKeyboardOpen(!mathKeyboardOpen)}
        label="Math Symbols"
      />

      <Separator vertical={false} />

      {/* Undo/Redo */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => editor.undo()}
              onPointerDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              disabled={!canUndo}
              className={cn(
                'no-enlarge w-9 h-9 flex items-center justify-center rounded-md transition-all duration-150',
                'active:scale-[0.92] touch-manipulation',
                canUndo
                  ? 'text-gray-500 hover:bg-gray-50'
                  : 'text-gray-300 cursor-not-allowed'
              )}
              aria-label="Undo"
            >
              <Undo2 className="w-[17px] h-[17px]" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={8}>
            Undo <kbd className="ml-1.5 text-[10px] opacity-60 bg-gray-100 px-1 py-0.5 rounded">Ctrl+Z</kbd>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => editor.redo()}
              onPointerDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              disabled={!canRedo}
              className={cn(
                'no-enlarge w-9 h-9 flex items-center justify-center rounded-md transition-all duration-150',
                'active:scale-[0.92] touch-manipulation',
                canRedo
                  ? 'text-gray-500 hover:bg-gray-50'
                  : 'text-gray-300 cursor-not-allowed'
              )}
              aria-label="Redo"
            >
              <Redo2 className="w-[17px] h-[17px]" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={8}>
            Redo <kbd className="ml-1.5 text-[10px] opacity-60 bg-gray-100 px-1 py-0.5 rounded">Ctrl+Shift+Z</kbd>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Math Keyboard - positioned below the top bar */}
      {mathKeyboardOpen && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[var(--z-keyboard)]">
          <MathKeyboard
            isOpen={mathKeyboardOpen}
            onClose={() => setMathKeyboardOpen(false)}
            onInsert={handleInsertMath}
          />
        </div>
      )}
    </>
  );
}

export function CustomToolbar() {
  const editor = useEditor();
  const [penSettingsOpen, setPenSettingsOpen] = useState(false);
  const [mathKeyboardOpen, setMathKeyboardOpen] = useState(false);
  const vertical = useDocumentPanelOpen();

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

  const handleInsertMath = useCallback((latex: string) => {
    const viewportBounds = editor.getViewportScreenBounds();
    const center = editor.screenToPage({
      x: viewportBounds.x + viewportBounds.width / 2,
      y: viewportBounds.y + viewportBounds.height / 2,
    });

    const shapeId = createShapeId();
    editor.createShape({
      id: shapeId,
      type: 'latex',
      x: center.x - 100,
      y: center.y - 30,
      isLocked: false,
      props: {
        latex: latex,
        w: 200,
        h: 60,
        color: '#1a1a1a',
        fontSize: 24,
      },
    });

    editor.select(shapeId);
    editor.setCurrentTool('select');
  }, [editor]);

  const currentColorHex = COLORS.find(c => c.value === currentColor)?.hex ?? '#1a1a1a';

  const sharedProps = {
    editor,
    currentToolId,
    currentColor,
    currentSize,
    currentColorHex,
    canUndo,
    canRedo,
    penSettingsOpen,
    setPenSettingsOpen,
    mathKeyboardOpen,
    setMathKeyboardOpen,
    setColor,
    setSize,
    handleInsertMath,
  };

  // Find the TopBar's portal target for inline mode
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!vertical) {
      // Find the portal target in the TopBar (may not be mounted yet)
      const find = () => document.querySelector('[data-topbar-tools]') as HTMLElement | null;
      const target = find();
      if (target) {
        setPortalTarget(target);
      } else {
        // Retry after a short delay if TopBar hasn't mounted yet
        const timer = setTimeout(() => setPortalTarget(find()), 100);
        return () => clearTimeout(timer);
      }
    } else {
      setPortalTarget(null);
    }
  }, [vertical]);

  // When NOT in vertical mode, portal the tools into the TopBar
  if (!vertical) {
    if (!portalTarget) return null;
    return createPortal(
      <div
        className="flex items-center gap-0.5 pointer-events-auto"
        onPointerDown={handleContainerPointerDown}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <ToolButtonsInline {...sharedProps} />
      </div>,
      portalTarget
    );
  }

  // Vertical mode (document panel open): floating toolbar on left side
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
      className="fixed z-[var(--z-toolbar)] pointer-events-auto left-3 top-1/2 -translate-y-1/2"
      onPointerDown={handleContainerPointerDown}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <div className="bg-white shadow-[0_2px_16px_rgba(0,0,0,0.08)] border border-gray-200/60 overflow-auto scrollbar-hide flex flex-col items-center gap-0.5 rounded-xl px-1.5 py-2 max-h-[calc(100vh-4rem)]">
        {/* Selection tools */}
        <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
          {tools.map((tool) => (
            <ToolButton
              key={tool.id}
              icon={tool.icon}
              shortcut={tool.shortcut}
              isActive={currentToolId === tool.id}
              onClick={() => editor.setCurrentTool(tool.id)}
              label={tool.label}
              vertical
            />
          ))}
        </div>

        <Separator vertical />

        {/* Drawing tools */}
        <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
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
                      vertical
                    />
                    {/* Color indicator dot */}
                    <div
                      className="absolute bottom-1 right-1 w-2 h-2 rounded-full border border-white shadow-sm"
                      style={{ backgroundColor: currentColorHex }}
                    />
                  </div>
                </PopoverTrigger>
                <PopoverContent
                  side="right"
                  sideOffset={12}
                  className="w-56 p-3.5 bg-white rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.12)] border border-gray-200/50"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <div className="space-y-3.5">
                    <div>
                      <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 block">
                        Size
                      </label>
                      <div className="flex items-center gap-1.5">
                        {PEN_SIZES.map((size) => (
                          <button
                            key={size.label}
                            onClick={() => setSize(size.label.toLowerCase())}
                            className={cn(
                              'no-enlarge flex-1 h-9 rounded-md flex items-center justify-center transition-all duration-150',
                              'hover:bg-gray-50',
                              currentSize === size.label.toLowerCase()
                                ? 'bg-[#007ba5]/10 ring-1.5 ring-[#007ba5]/50'
                                : 'bg-gray-50/50'
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
                    <div className="h-px bg-gray-100" />
                    <div>
                      <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 block">
                        Color
                      </label>
                      <div className="grid grid-cols-8 gap-1.5">
                        {COLORS.map((color) => (
                          <button
                            key={color.value}
                            onClick={() => setColor(color.value)}
                            className={cn(
                              'no-enlarge w-6 h-6 rounded-full transition-all duration-150',
                              'hover:scale-110 active:scale-95',
                              currentColor === color.value && 'ring-2 ring-[#007ba5] ring-offset-2'
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
                vertical
              />
            )
          ))}
        </div>

        <Separator vertical />

        {/* Math Keyboard Button */}
        <ToolButton
          icon={<Pi className="w-[17px] h-[17px]" />}
          shortcut="M"
          isActive={mathKeyboardOpen}
          onClick={() => setMathKeyboardOpen(!mathKeyboardOpen)}
          label="Math Symbols"
          vertical
        />

        <Separator vertical />

        {/* Undo/Redo */}
        <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => editor.undo()}
                onPointerDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                disabled={!canUndo}
                className={cn(
                  'no-enlarge w-10 h-10 flex items-center justify-center rounded-md transition-all duration-150',
                  'active:scale-[0.92] touch-manipulation',
                  canUndo
                    ? 'text-gray-500 hover:bg-gray-50'
                    : 'text-gray-300 cursor-not-allowed'
                )}
                aria-label="Undo"
              >
                <Undo2 className="w-[17px] h-[17px]" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>Undo</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => editor.redo()}
                onPointerDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                disabled={!canRedo}
                className={cn(
                  'no-enlarge w-10 h-10 flex items-center justify-center rounded-md transition-all duration-150',
                  'active:scale-[0.92] touch-manipulation',
                  canRedo
                    ? 'text-gray-500 hover:bg-gray-50'
                    : 'text-gray-300 cursor-not-allowed'
                )}
                aria-label="Redo"
              >
                <Redo2 className="w-[17px] h-[17px]" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>Redo</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Math Keyboard - vertical mode */}
      {mathKeyboardOpen && (
        <MathKeyboard
          isOpen={mathKeyboardOpen}
          onClose={() => setMathKeyboardOpen(false)}
          onInsert={handleInsertMath}
        />
      )}
    </div>
  );
}
