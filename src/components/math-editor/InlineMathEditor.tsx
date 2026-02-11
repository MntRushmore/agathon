'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { MathfieldElement } from 'mathlive';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Check, X } from 'lucide-react';
import { toLatex } from '@/lib/plain-to-latex';

interface InlineMathEditorProps {
  initialValue: string;
  onSave: (latex: string) => void;
  onCancel: () => void;
  onDelete?: () => void;
  position?: { top: number; left: number };
  className?: string;
}

/**
 * Popup editor for inline math expressions
 * Uses MathLive for WYSIWYG editing
 */
export function InlineMathEditor({
  initialValue,
  onSave,
  onCancel,
  onDelete,
  position,
  className,
}: InlineMathEditorProps) {
  const mathfieldRef = useRef<MathfieldElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [initialized, setInitialized] = useState(false);
  const [value, setValue] = useState(initialValue);

  // Initialize MathLive
  useEffect(() => {
    const initMathfield = async () => {
      await import('mathlive');
      const mf = mathfieldRef.current;
      if (!mf || initialized) return;

      // Convert plain text to LaTeX if needed
      const latex = toLatex(initialValue);
      mf.value = latex;
      (mf as any).mathVirtualKeyboardPolicy = 'auto';

      const handleInput = (evt: Event) => {
        const target = evt.target as MathfieldElement;
        setValue(target.value);
      };

      const handleKeydown = (evt: Event) => {
        const keyEvt = evt as KeyboardEvent;

        if (keyEvt.key === 'Enter' && !keyEvt.shiftKey) {
          evt.preventDefault();
          handleSave();
        } else if (keyEvt.key === 'Escape') {
          evt.preventDefault();
          onCancel();
        }
      };

      mf.addEventListener('input', handleInput);
      mf.addEventListener('keydown', handleKeydown as EventListener);

      setInitialized(true);

      // Focus the mathfield
      setTimeout(() => mf.focus(), 50);
    };

    initMathfield();
  }, [initialized, initialValue]);

  // Handle save
  const handleSave = useCallback(() => {
    const mf = mathfieldRef.current;
    if (mf) {
      onSave(mf.value);
    }
  }, [onSave]);

  // Handle click outside to save
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        handleSave();
      }
    };

    // Delay adding listener to avoid immediate trigger
    const timeout = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeout);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [handleSave]);

  // Dynamic positioning styles
  const positionStyles = position
    ? { top: position.top, left: position.left }
    : {};

  return (
    <div
      ref={containerRef}
      className={cn(
        'absolute z-50',
        'bg-white dark:bg-gray-900',
        'rounded-xl shadow-2xl',
        'border border-gray-200 dark:border-gray-700',
        'p-3',
        'min-w-[280px] max-w-[400px]',
        className
      )}
      style={positionStyles}
    >
      {/* Math editor */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 mb-3">
        {React.createElement('math-field', {
          ref: mathfieldRef,
          className: cn(
            'w-full text-xl bg-transparent border-none outline-none',
            'focus:outline-none'
          ),
          style: {
            minHeight: '40px',
            fontSize: '1.25rem',
            '--caret-color': '#007ba5',
          },
        })}
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              Delete
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="gap-1"
          >
            <X className="h-4 w-4" />
            Cancel
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleSave}
            className="gap-1 bg-[#007ba5] hover:bg-[#006080]"
          >
            <Check className="h-4 w-4" />
            Done
          </Button>
        </div>
      </div>

      {/* Keyboard hint */}
      <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>Press <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded mx-1">Enter</kbd> to save</span>
          <span><kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded mx-1">Esc</kbd> to cancel</span>
        </div>
      </div>
    </div>
  );
}
