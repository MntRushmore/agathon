'use client';

import React, { useRef, useEffect, useState } from 'react';
import { MathfieldElement } from 'mathlive';
import { Button } from '@/components/ui/button';
import { Trash2, LineChart, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MathEquationRowProps {
  id: string;
  latex: string;
  solution: string | null;
  isSolving?: boolean;
  isFocused?: boolean;
  onLatexChange: (latex: string) => void;
  onBlur: () => void;
  onFocus: () => void;
  onGraph: () => void;
  onDelete: () => void;
  onEnter: () => void;
  onBackspaceEmpty: () => void;
  autoFocus?: boolean;
}

export function MathEquationRow({
  id,
  latex,
  solution,
  isSolving = false,
  isFocused = false,
  onLatexChange,
  onBlur,
  onFocus,
  onGraph,
  onDelete,
  onEnter,
  onBackspaceEmpty,
  autoFocus = false,
}: MathEquationRowProps) {
  const mathfieldRef = useRef<MathfieldElement | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Check if equation is graphable (contains x or y variables)
  const isGraphable = /[xy]/.test(latex) && latex.trim().length > 0;

  useEffect(() => {
    const initMathfield = async () => {
      await import('mathlive');
      const mf = mathfieldRef.current;
      if (!mf || initialized) return;

      // Set initial value
      mf.value = latex;

      // Configure for iPad virtual keyboard
      (mf as any).mathVirtualKeyboardPolicy = 'auto';

      // Handle input changes
      const handleInput = (evt: Event) => {
        const target = evt.target as MathfieldElement;
        onLatexChange(target.value);
      };

      // Handle keyboard events
      const handleKeydown = (evt: Event) => {
        const keyEvt = evt as KeyboardEvent;
        if (keyEvt.key === 'Enter' && !keyEvt.shiftKey) {
          evt.preventDefault();
          onEnter();
        } else if (keyEvt.key === 'Backspace' && mf.value === '') {
          evt.preventDefault();
          onBackspaceEmpty();
        }
      };

      mf.addEventListener('input', handleInput);
      mf.addEventListener('keydown', handleKeydown as EventListener);
      mf.addEventListener('focus', onFocus);
      mf.addEventListener('blur', onBlur);

      setInitialized(true);

      // Auto-focus if requested
      if (autoFocus) {
        setTimeout(() => mf.focus(), 50);
      }

      return () => {
        mf.removeEventListener('input', handleInput);
        mf.removeEventListener('keydown', handleKeydown);
        mf.removeEventListener('focus', onFocus);
        mf.removeEventListener('blur', onBlur);
      };
    };

    initMathfield();
  }, [initialized, autoFocus]);

  // Sync latex value when it changes externally
  useEffect(() => {
    if (mathfieldRef.current && initialized && mathfieldRef.current.value !== latex) {
      mathfieldRef.current.value = latex;
    }
  }, [latex, initialized]);

  return (
    <div
      className={cn(
        'group relative flex items-center gap-3 p-3 rounded-lg border transition-all',
        isFocused ? 'border-blue-400 bg-blue-50/50 shadow-sm' : 'border-gray-200 hover:border-gray-300',
        'hover:bg-gray-50/50'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* MathLive Input */}
      <div className="flex-1 min-w-0">
        {React.createElement('math-field', {
          ref: mathfieldRef,
          id: `mathfield-${id}`,
          className: cn(
            'w-full text-xl bg-transparent border-none outline-none',
            'focus:outline-none focus:ring-0'
          ),
          style: {
            minHeight: '40px',
            fontSize: '1.25rem',
            '--caret-color': '#3b82f6',
          },
        })}
      </div>

      {/* Solution Display */}
      {(solution || isSolving) && (
        <div className="flex items-center gap-2 text-cyan-600 font-medium text-lg shrink-0">
          {isSolving ? (
            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          ) : (
            <span className="whitespace-nowrap">{solution}</span>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div
        className={cn(
          'flex items-center gap-1 shrink-0 transition-opacity',
          isHovered || isFocused ? 'opacity-100' : 'opacity-0'
        )}
      >
        {/* Graph Button */}
        {isGraphable && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-blue-500 hover:text-blue-600 hover:bg-blue-50"
            onClick={(e) => {
              e.stopPropagation();
              onGraph();
            }}
            title="Graph this equation"
          >
            <LineChart className="h-4 w-4" />
          </Button>
        )}

        {/* Delete Button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-gray-400 hover:text-red-500 hover:bg-red-50"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="Delete equation"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// Export a ref-forwarding version for focus management
export const MathEquationRowRef = React.forwardRef<
  { focus: () => void },
  MathEquationRowProps
>((props, ref) => {
  const internalRef = useRef<MathfieldElement | null>(null);

  React.useImperativeHandle(ref, () => ({
    focus: () => {
      internalRef.current?.focus();
    },
  }));

  return <MathEquationRow {...props} />;
});

MathEquationRowRef.displayName = 'MathEquationRowRef';
