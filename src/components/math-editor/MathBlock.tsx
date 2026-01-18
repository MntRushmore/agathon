'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { MathfieldElement } from 'mathlive';
import { cn } from '@/lib/utils';

export type BlockType = 'text' | 'math' | 'heading';

export interface Block {
  id: string;
  type: BlockType;
  content: string;
  level?: 1 | 2 | 3; // For headings
}

interface MathBlockProps {
  block: Block;
  lineNumber: number;
  isFocused: boolean;
  onContentChange: (content: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  onEnter: () => void;
  onBackspaceEmpty: () => void;
  onTypeChange: (type: BlockType) => void;
  autoFocus?: boolean;
}

// Math symbol suggestions
const MATH_SUGGESTIONS = [
  { trigger: 'sum', latex: '\\sum_{i=1}^{n}', display: 'Σ', label: 'Summation', category: 'Calculus' },
  { trigger: 'int', latex: '\\int_{a}^{b}', display: '∫', label: 'Integral', category: 'Calculus' },
  { trigger: 'frac', latex: '\\frac{}{}', display: 'a/b', label: 'Fraction', category: 'Algebra' },
  { trigger: 'sqrt', latex: '\\sqrt{}', display: '√', label: 'Square Root', category: 'Algebra' },
  { trigger: 'lim', latex: '\\lim_{x \\to }', display: 'lim', label: 'Limit', category: 'Calculus' },
  { trigger: 'inf', latex: '\\infty', display: '∞', label: 'Infinity', category: 'Symbols' },
  { trigger: 'alpha', latex: '\\alpha', display: 'α', label: 'Alpha', category: 'Greek' },
  { trigger: 'beta', latex: '\\beta', display: 'β', label: 'Beta', category: 'Greek' },
  { trigger: 'theta', latex: '\\theta', display: 'θ', label: 'Theta', category: 'Greek' },
  { trigger: 'pi', latex: '\\pi', display: 'π', label: 'Pi', category: 'Greek' },
  { trigger: 'lambda', latex: '\\lambda', display: 'λ', label: 'Lambda', category: 'Greek' },
  { trigger: 'omega', latex: '\\omega', display: 'ω', label: 'Omega', category: 'Greek' },
  { trigger: 'partial', latex: '\\partial', display: '∂', label: 'Partial', category: 'Calculus' },
  { trigger: 'nabla', latex: '\\nabla', display: '∇', label: 'Nabla', category: 'Calculus' },
  { trigger: 'pm', latex: '\\pm', display: '±', label: 'Plus-Minus', category: 'Algebra' },
  { trigger: 'neq', latex: '\\neq', display: '≠', label: 'Not Equal', category: 'Relations' },
  { trigger: 'leq', latex: '\\leq', display: '≤', label: 'Less or Equal', category: 'Relations' },
  { trigger: 'geq', latex: '\\geq', display: '≥', label: 'Greater or Equal', category: 'Relations' },
  { trigger: 'approx', latex: '\\approx', display: '≈', label: 'Approximately', category: 'Relations' },
  { trigger: 'cdot', latex: '\\cdot', display: '·', label: 'Dot Product', category: 'Algebra' },
  { trigger: 'times', latex: '\\times', display: '×', label: 'Times', category: 'Algebra' },
  { trigger: 'div', latex: '\\div', display: '÷', label: 'Division', category: 'Algebra' },
  { trigger: 'log', latex: '\\log', display: 'log', label: 'Logarithm', category: 'Algebra' },
  { trigger: 'ln', latex: '\\ln', display: 'ln', label: 'Natural Log', category: 'Algebra' },
  { trigger: 'sin', latex: '\\sin', display: 'sin', label: 'Sine', category: 'Trig' },
  { trigger: 'cos', latex: '\\cos', display: 'cos', label: 'Cosine', category: 'Trig' },
  { trigger: 'tan', latex: '\\tan', display: 'tan', label: 'Tangent', category: 'Trig' },
  { trigger: 'matrix', latex: '\\begin{pmatrix}  \\\\  \\end{pmatrix}', display: '[ ]', label: 'Matrix', category: 'Linear Algebra' },
];

export function MathBlock({
  block,
  lineNumber,
  isFocused,
  onContentChange,
  onFocus,
  onBlur,
  onEnter,
  onBackspaceEmpty,
  onTypeChange,
  autoFocus = false,
}: MathBlockProps) {
  const mathfieldRef = useRef<MathfieldElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [suggestions, setSuggestions] = useState<typeof MATH_SUGGESTIONS>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);

  // Initialize MathLive for math blocks
  useEffect(() => {
    if (block.type !== 'math') return;

    const initMathfield = async () => {
      await import('mathlive');
      const mf = mathfieldRef.current;
      if (!mf || initialized) return;

      mf.value = block.content;
      (mf as any).mathVirtualKeyboardPolicy = 'auto';

      const handleInput = (evt: Event) => {
        const target = evt.target as MathfieldElement;
        onContentChange(target.value);

        // Check for autocomplete triggers
        const value = target.value;
        const lastWord = value.split(/[\s\\{}^_]/).pop() || '';
        if (lastWord.length >= 2) {
          const matches = MATH_SUGGESTIONS.filter(s =>
            s.trigger.toLowerCase().startsWith(lastWord.toLowerCase())
          );
          setSuggestions(matches);
          setShowSuggestions(matches.length > 0);
          setSelectedSuggestion(0);
        } else {
          setShowSuggestions(false);
        }
      };

      const handleKeydown = (evt: Event) => {
        const keyEvt = evt as KeyboardEvent;

        if (showSuggestions) {
          if (keyEvt.key === 'ArrowDown') {
            evt.preventDefault();
            setSelectedSuggestion(prev => Math.min(prev + 1, suggestions.length - 1));
            return;
          }
          if (keyEvt.key === 'ArrowUp') {
            evt.preventDefault();
            setSelectedSuggestion(prev => Math.max(prev - 1, 0));
            return;
          }
          if (keyEvt.key === 'Enter' || keyEvt.key === 'Tab') {
            evt.preventDefault();
            insertSuggestion(suggestions[selectedSuggestion]);
            return;
          }
          if (keyEvt.key === 'Escape') {
            setShowSuggestions(false);
            return;
          }
        }

        if (keyEvt.key === 'Enter' && !keyEvt.shiftKey && !showSuggestions) {
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
      mf.addEventListener('blur', () => {
        setTimeout(() => setShowSuggestions(false), 150);
        onBlur();
      });

      setInitialized(true);

      if (autoFocus) {
        setTimeout(() => mf.focus(), 50);
      }
    };

    initMathfield();
  }, [block.type, initialized, autoFocus]);

  // Insert suggestion
  const insertSuggestion = useCallback((suggestion: typeof MATH_SUGGESTIONS[0]) => {
    const mf = mathfieldRef.current;
    if (!mf) return;

    // Remove the trigger text and insert latex
    const value = mf.value;
    const lastWord = value.split(/[\s\\{}^_]/).pop() || '';
    const newValue = value.slice(0, value.length - lastWord.length) + suggestion.latex;
    mf.value = newValue;
    onContentChange(newValue);
    setShowSuggestions(false);
    mf.focus();
  }, [onContentChange]);

  // Handle text/heading input
  const handleTextKeydown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onEnter();
    } else if (e.key === 'Backspace' && block.content === '') {
      e.preventDefault();
      onBackspaceEmpty();
    }
    // Convert to math block with $
    if (e.key === '$' && block.type === 'text') {
      e.preventDefault();
      onTypeChange('math');
    }
    // Convert to heading with #
    if (e.key === ' ' && block.content.startsWith('#')) {
      e.preventDefault();
      const hashes = block.content.match(/^#+/)?.[0].length || 1;
      const level = Math.min(hashes, 3) as 1 | 2 | 3;
      onContentChange(block.content.replace(/^#+\s*/, ''));
      onTypeChange('heading');
    }
  };

  // Render based on block type
  if (block.type === 'math') {
    return (
      <div className={cn(
        'group relative flex items-start gap-4 py-2 px-4 rounded-lg transition-colors',
        isFocused ? 'bg-blue-50 dark:bg-blue-950/30' : 'hover:bg-gray-50 dark:hover:bg-gray-900/30'
      )}>
        {/* Line number */}
        <span className="w-8 text-right text-sm text-gray-400 dark:text-gray-600 select-none pt-2">
          {lineNumber}.
        </span>

        {/* Math field */}
        <div className="flex-1 relative">
          <div className="bg-blue-50/50 dark:bg-blue-950/20 rounded-lg px-4 py-3 border border-blue-200/50 dark:border-blue-800/30">
            {React.createElement('math-field', {
              ref: mathfieldRef,
              className: 'w-full text-xl bg-transparent border-none outline-none math-field-custom',
              style: {
                minHeight: '32px',
                fontSize: '1.25rem',
              },
            })}
          </div>

          {/* Autocomplete suggestions */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 mt-2 w-72 bg-white dark:bg-gray-900 rounded-lg shadow-xl border dark:border-gray-700 overflow-hidden z-50">
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion.trigger}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-2 text-left transition-colors',
                    index === selectedSuggestion
                      ? 'bg-blue-50 dark:bg-blue-950/50'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                  )}
                  onClick={() => insertSuggestion(suggestion)}
                >
                  <span className="w-8 h-8 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded text-lg font-mono">
                    {suggestion.display}
                  </span>
                  <div className="flex-1">
                    <div className="font-medium text-sm">{suggestion.label}</div>
                    <div className="text-xs text-gray-500">{suggestion.category}</div>
                  </div>
                  {index === selectedSuggestion && (
                    <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                      Enter
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (block.type === 'heading') {
    const HeadingTag = `h${block.level || 1}` as 'h1' | 'h2' | 'h3';
    const headingSizes = {
      h1: 'text-3xl font-bold',
      h2: 'text-2xl font-semibold',
      h3: 'text-xl font-medium',
    };

    return (
      <div className={cn(
        'group flex items-start gap-4 py-2 px-4 rounded-lg transition-colors',
        isFocused ? 'bg-gray-50 dark:bg-gray-900/50' : ''
      )}>
        <span className="w-8 text-right text-sm text-gray-400 dark:text-gray-600 select-none pt-2">
          {lineNumber}.
        </span>
        <textarea
          ref={textareaRef}
          value={block.content}
          onChange={(e) => onContentChange(e.target.value)}
          onKeyDown={handleTextKeydown}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder="Heading..."
          className={cn(
            'flex-1 bg-transparent border-none outline-none resize-none',
            headingSizes[HeadingTag],
            'placeholder:text-gray-300 dark:placeholder:text-gray-700'
          )}
          rows={1}
          autoFocus={autoFocus}
        />
      </div>
    );
  }

  // Text block (default)
  return (
    <div className={cn(
      'group flex items-start gap-4 py-2 px-4 rounded-lg transition-colors',
      isFocused ? 'bg-gray-50 dark:bg-gray-900/50' : ''
    )}>
      <span className="w-8 text-right text-sm text-gray-400 dark:text-gray-600 select-none pt-1">
        {lineNumber}.
      </span>
      <textarea
        ref={textareaRef}
        value={block.content}
        onChange={(e) => onContentChange(e.target.value)}
        onKeyDown={handleTextKeydown}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder="Type text, $ for math, or # for heading..."
        className={cn(
          'flex-1 bg-transparent border-none outline-none resize-none text-base leading-relaxed',
          'placeholder:text-gray-300 dark:placeholder:text-gray-700'
        )}
        rows={1}
        autoFocus={autoFocus}
      />
    </div>
  );
}
