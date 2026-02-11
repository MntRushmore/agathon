'use client';

import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { MathfieldElement } from 'mathlive';
import { cn } from '@/lib/utils';

export type BlockType = 'paragraph' | 'math' | 'heading';

export interface Block {
  id: string;
  type: BlockType;
  content: string;
  level?: 1 | 2 | 3;
}

interface CorcaBlockProps {
  block: Block;
  lineNumber: number;
  isFocused: boolean;
  onContentChange: (content: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  onEnter: (shiftKey?: boolean) => void;
  onBackspaceEmpty: () => void;
  onConvertToMath: () => void;
  onConvertToHeading: (level: 1 | 2 | 3) => void;
  autoFocus?: boolean;
}

// Autocomplete suggestions with keyboard shortcuts
const MATH_SUGGESTIONS = [
  { trigger: 'sum', latex: '\\sum_{i=1}^{n}', display: 'Σ', label: 'Summation', category: 'Calculus', shortcut: 'Enter' },
  { trigger: 'int', latex: '\\int_{a}^{b}', display: '∫', label: 'Integral', category: 'Calculus', shortcut: '⌘1' },
  { trigger: 'frac', latex: '\\frac{#0}{#1}', display: 'a/b', label: 'Fraction', category: 'Algebra', shortcut: '⌘2' },
  { trigger: 'sqrt', latex: '\\sqrt{#0}', display: '√', label: 'Square Root', category: 'Algebra', shortcut: '⌘3' },
  { trigger: 'lim', latex: '\\lim_{x \\to #0}', display: 'lim', label: 'Limit', category: 'Calculus', shortcut: '⌘4' },
  { trigger: 'log', latex: '\\log_{#0}(#1)', display: 'log', label: 'Logarithm', category: 'Algebra', shortcut: '' },
  { trigger: 'li', latex: '\\int', display: 'li', label: 'Logarithmic Integral', category: 'Number Theory', shortcut: '⌘3' },
  { trigger: 'gamma', latex: '\\gamma', display: 'γ', label: 'Lorentz Factor', category: 'Physics', shortcut: 'lrtz·⌘2' },
  { trigger: 'land', latex: '\\land', display: '∧', label: 'Logical And', category: 'Logic', shortcut: 'land·⌘4' },
  { trigger: 'lor', latex: '\\lor', display: '¬', label: 'Logical Not', category: 'Logic', shortcut: 'lor·⌘5' },
  { trigger: 'alpha', latex: '\\alpha', display: 'α', label: 'Alpha', category: 'Greek', shortcut: '' },
  { trigger: 'beta', latex: '\\beta', display: 'β', label: 'Beta', category: 'Greek', shortcut: '' },
  { trigger: 'theta', latex: '\\theta', display: 'θ', label: 'Theta', category: 'Greek', shortcut: '' },
  { trigger: 'pi', latex: '\\pi', display: 'π', label: 'Pi', category: 'Greek', shortcut: '' },
  { trigger: 'partial', latex: '\\partial', display: '∂', label: 'Partial Derivative', category: 'Calculus', shortcut: '' },
  { trigger: 'nabla', latex: '\\nabla', display: '∇', label: 'Nabla/Del', category: 'Calculus', shortcut: '' },
  { trigger: 'infty', latex: '\\infty', display: '∞', label: 'Infinity', category: 'Symbols', shortcut: '' },
  { trigger: 'pm', latex: '\\pm', display: '±', label: 'Plus-Minus', category: 'Algebra', shortcut: '' },
  { trigger: 'cdot', latex: '\\cdot', display: '·', label: 'Center Dot', category: 'Algebra', shortcut: '' },
  { trigger: 'times', latex: '\\times', display: '×', label: 'Times', category: 'Algebra', shortcut: '' },
  { trigger: 'leq', latex: '\\leq', display: '≤', label: 'Less or Equal', category: 'Relations', shortcut: '' },
  { trigger: 'geq', latex: '\\geq', display: '≥', label: 'Greater or Equal', category: 'Relations', shortcut: '' },
  { trigger: 'neq', latex: '\\neq', display: '≠', label: 'Not Equal', category: 'Relations', shortcut: '' },
  { trigger: 'approx', latex: '\\approx', display: '≈', label: 'Approximately', category: 'Relations', shortcut: '' },
  { trigger: 'matrix', latex: '\\begin{pmatrix} #0 & #1 \\\\ #2 & #3 \\end{pmatrix}', display: '[ ]', label: 'Matrix', category: 'Linear Algebra', shortcut: '' },
];

export interface CorcaBlockRef {
  focus: () => void;
  insertLatex: (latex: string) => void;
}

export const CorcaBlock = forwardRef<CorcaBlockRef, CorcaBlockProps>(({
  block,
  lineNumber,
  isFocused,
  onContentChange,
  onFocus,
  onBlur,
  onEnter,
  onBackspaceEmpty,
  onConvertToMath,
  onConvertToHeading,
  autoFocus = false,
}, ref) => {
  const mathfieldRef = useRef<MathfieldElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [suggestions, setSuggestions] = useState<typeof MATH_SUGGESTIONS>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    focus: () => {
      if (block.type === 'math') {
        mathfieldRef.current?.focus();
      } else {
        textareaRef.current?.focus();
      }
    },
    insertLatex: (latex: string) => {
      if (block.type === 'math' && mathfieldRef.current) {
        mathfieldRef.current.executeCommand(['insert', latex]);
      }
    },
  }));

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
        const value = target.value;
        onContentChange(value);

        // Check for autocomplete
        const words = value.split(/[\s\\{}^_(),=+\-*/]/);
        const lastWord = words[words.length - 1] || '';

        if (lastWord.length >= 1) {
          const matches = MATH_SUGGESTIONS.filter(s =>
            s.trigger.toLowerCase().startsWith(lastWord.toLowerCase()) ||
            s.label.toLowerCase().includes(lastWord.toLowerCase())
          ).slice(0, 6);

          if (matches.length > 0) {
            setSuggestions(matches);
            setShowSuggestions(true);
            setSelectedSuggestion(0);
            setSearchTerm(lastWord);
          } else {
            setShowSuggestions(false);
          }
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
          onEnter(keyEvt.shiftKey);
        } else if (keyEvt.key === 'Backspace' && mf.value === '') {
          evt.preventDefault();
          onBackspaceEmpty();
        }
      };

      mf.addEventListener('input', handleInput);
      mf.addEventListener('keydown', handleKeydown as EventListener);
      mf.addEventListener('focus', onFocus);
      mf.addEventListener('blur', () => {
        setTimeout(() => setShowSuggestions(false), 200);
        onBlur();
      });

      setInitialized(true);

      if (autoFocus) {
        setTimeout(() => mf.focus(), 50);
      }
    };

    initMathfield();
  }, [block.type, initialized, autoFocus]);

  // Sync content when it changes externally
  useEffect(() => {
    if (block.type === 'math' && mathfieldRef.current && initialized) {
      if (mathfieldRef.current.value !== block.content) {
        mathfieldRef.current.value = block.content;
      }
    }
  }, [block.content, block.type, initialized]);

  // Insert suggestion
  const insertSuggestion = useCallback((suggestion: typeof MATH_SUGGESTIONS[0]) => {
    const mf = mathfieldRef.current;
    if (!mf) return;

    // Remove the search term and insert latex
    const value = mf.value;
    const newValue = value.slice(0, value.length - searchTerm.length) + suggestion.latex;
    mf.value = newValue;
    onContentChange(newValue);
    setShowSuggestions(false);
    mf.focus();
  }, [searchTerm, onContentChange]);

  // Handle text/heading keyboard
  const handleTextKeydown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Convert to math with $$
    if (e.key === '$' && block.content === '') {
      e.preventDefault();
      onConvertToMath();
      return;
    }

    // Convert to heading with # at start
    if (e.key === ' ' && block.content.match(/^#{1,3}$/)) {
      e.preventDefault();
      const level = block.content.length as 1 | 2 | 3;
      onConvertToHeading(level);
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onEnter(e.shiftKey);
    } else if (e.key === 'Backspace' && block.content === '') {
      e.preventDefault();
      onBackspaceEmpty();
    }
  };

  // Auto-resize textarea
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [block.content]);

  // MATH BLOCK
  if (block.type === 'math') {
    return (
      <div className={cn(
        'group relative flex items-start gap-3 py-3 transition-colors',
        isFocused ? 'bg-[#e0f2f7]/50 dark:bg-[#007ba5]/10' : ''
      )}>
        {/* Line number */}
        <span className="w-8 text-right text-sm text-gray-300 dark:text-gray-700 select-none pt-3 font-mono">
          {lineNumber}.
        </span>

        {/* Math block - centered display style */}
        <div className="flex-1 flex justify-center">
          <div className={cn(
            'relative inline-block px-6 py-4 rounded-lg transition-all',
            'bg-gradient-to-r from-[#e0f2f7]/80 to-[#eef5fa]/80 dark:from-[#007ba5]/10 dark:to-[#007ba5]/5',
            'border border-[#007ba5]/20 dark:border-[#007ba5]/30',
            isFocused && 'ring-2 ring-[#007ba5]/50 dark:ring-[#007ba5]/30'
          )}>
            {React.createElement('math-field', {
              ref: mathfieldRef,
              className: cn(
                'w-full min-w-[200px] text-xl bg-transparent border-none outline-none',
                'focus:outline-none'
              ),
              style: {
                minHeight: '32px',
                fontSize: '1.375rem',
                '--caret-color': '#007ba5',
              },
            })}

            {/* Autocomplete popup - Corca style */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute left-0 top-full mt-2 w-80 bg-white dark:bg-gray-900 rounded-xl shadow-2xl border dark:border-gray-700 overflow-hidden z-50">
                {/* Search term display */}
                <div className="px-4 py-2 bg-[#e0f2f7] dark:bg-[#007ba5]/10 border-b dark:border-gray-700">
                  <span className="font-mono text-sm">{searchTerm}</span>
                </div>

                {/* Suggestions list */}
                <div className="max-h-64 overflow-y-auto">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={suggestion.trigger}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                        index === selectedSuggestion
                          ? 'bg-[#e0f2f7] dark:bg-[#007ba5]/20'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                      )}
                      onClick={() => insertSuggestion(suggestion)}
                      onMouseEnter={() => setSelectedSuggestion(index)}
                    >
                      {/* Symbol */}
                      <span className="w-10 h-10 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg text-xl font-serif">
                        {suggestion.display}
                      </span>

                      {/* Label and category */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{suggestion.label}</span>
                          <span className="text-xs text-gray-400">·</span>
                          <span className="text-xs text-gray-500">{suggestion.category}</span>
                        </div>
                      </div>

                      {/* Shortcut */}
                      {suggestion.shortcut && (
                        <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded font-mono">
                          {suggestion.shortcut}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Hint */}
                <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border-t dark:border-gray-700">
                  <span className="text-xs text-gray-500">
                    Press <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-700 rounded text-[10px] border mx-1">Enter</kbd>
                    to insert from the suggest popup.
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // HEADING BLOCK
  if (block.type === 'heading') {
    const sizes = {
      1: 'text-3xl font-bold',
      2: 'text-2xl font-semibold',
      3: 'text-xl font-medium',
    };
    const level = block.level || 1;

    return (
      <div className={cn(
        'group flex items-start gap-3 py-2 transition-colors',
        isFocused ? 'bg-gray-50/50 dark:bg-gray-900/30' : ''
      )}>
        <span className="w-8 text-right text-sm text-gray-300 dark:text-gray-700 select-none pt-1 font-mono">
          {lineNumber}.
        </span>
        <textarea
          ref={textareaRef}
          value={block.content}
          onChange={(e) => {
            onContentChange(e.target.value);
            adjustTextareaHeight();
          }}
          onKeyDown={handleTextKeydown}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder={`Heading ${level}...`}
          className={cn(
            'flex-1 bg-transparent border-none outline-none resize-none leading-tight',
            sizes[level],
            'placeholder:text-gray-300 dark:placeholder:text-gray-700'
          )}
          rows={1}
          autoFocus={autoFocus}
        />
      </div>
    );
  }

  // PARAGRAPH BLOCK (default)
  return (
    <div className={cn(
      'group flex items-start gap-3 py-1.5 transition-colors',
      isFocused ? 'bg-gray-50/50 dark:bg-gray-900/30' : ''
    )}>
      <span className="w-8 text-right text-sm text-gray-300 dark:text-gray-700 select-none pt-0.5 font-mono">
        {lineNumber}.
      </span>
      <textarea
        ref={textareaRef}
        value={block.content}
        onChange={(e) => {
          onContentChange(e.target.value);
          adjustTextareaHeight();
        }}
        onKeyDown={handleTextKeydown}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder="Type text, press $ for math equation, or # for heading..."
        className={cn(
          'flex-1 bg-transparent border-none outline-none resize-none',
          'text-base leading-relaxed text-gray-800 dark:text-gray-200',
          'placeholder:text-gray-300 dark:placeholder:text-gray-600'
        )}
        rows={1}
        autoFocus={autoFocus}
      />
    </div>
  );
});

CorcaBlock.displayName = 'CorcaBlock';
