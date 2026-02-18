'use client';

import React, { useRef, useState, useCallback, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import { cn } from '@/lib/utils';
import { detectMathSegments } from '@/lib/math-detection';
import { toLatex } from '@/lib/plain-to-latex';
import 'katex/dist/katex.min.css';
import DOMPurify from 'dompurify';

export interface RichBlock {
  id: string;
  type: 'rich' | 'heading';
  content: string;
  level?: 1 | 2 | 3;
}

interface RichTextBlockProps {
  block: RichBlock;
  lineNumber: number;
  isFocused: boolean;
  onContentChange: (content: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  onEnter: () => void;
  onBackspaceEmpty: () => void;
  onConvertToHeading?: (level: 1 | 2 | 3) => void;
  autoFocus?: boolean;
}

export interface RichTextBlockRef {
  focus: () => void;
  insertText: (text: string) => void;
}

// Autocomplete suggestions - Corca style
const SUGGESTIONS = [
  { trigger: '=', symbol: '=', label: 'Equal', category: 'Algebra', shortcut: 'Enter' },
  { trigger: 'neq', symbol: '≠', latex: '\\neq', label: 'Not Equal', category: 'Algebra', shortcut: '⌘2' },
  { trigger: 'apx', symbol: '≈', latex: '\\approx', label: 'Almost Equal To', category: 'Algebra', shortcut: '⌘3' },
  { trigger: 'leq', symbol: '≤', latex: '\\leq', label: 'Less or Equal', category: 'Algebra', shortcut: '⌘4' },
  { trigger: 'geq', symbol: '≥', latex: '\\geq', label: 'Greater or Equal', category: 'Algebra', shortcut: '⌘5' },
  { trigger: 'sqrt', symbol: '√', latex: '\\sqrt{}', label: 'Square Root', category: 'Functions', shortcut: '⌘6' },
  { trigger: 'frac', symbol: '/', latex: '\\frac{}{}', label: 'Fraction', category: 'Algebra', shortcut: '⌘7' },
  { trigger: 'pi', symbol: 'π', latex: '\\pi', label: 'Pi', category: 'Constants', shortcut: '⌘8' },
  { trigger: 'sum', symbol: 'Σ', latex: '\\sum', label: 'Summation', category: 'Calculus', shortcut: '⌘9' },
  { trigger: 'int', symbol: '∫', latex: '\\int', label: 'Integral', category: 'Calculus' },
  { trigger: 'inf', symbol: '∞', latex: '\\infty', label: 'Infinity', category: 'Constants' },
  { trigger: 'alpha', symbol: 'α', latex: '\\alpha', label: 'Alpha', category: 'Greek' },
  { trigger: 'beta', symbol: 'β', latex: '\\beta', label: 'Beta', category: 'Greek' },
  { trigger: 'theta', symbol: 'θ', latex: '\\theta', label: 'Theta', category: 'Greek' },
  { trigger: 'delta', symbol: 'δ', latex: '\\delta', label: 'Delta', category: 'Greek' },
  { trigger: 'pm', symbol: '±', latex: '\\pm', label: 'Plus Minus', category: 'Operators' },
  { trigger: '^2', symbol: '²', latex: '^{2}', label: 'Squared', category: 'Powers' },
  { trigger: '^3', symbol: '³', latex: '^{3}', label: 'Cubed', category: 'Powers' },
];

// Render math with KaTeX (fast, cached)
const katexCache = new Map<string, string>();

function renderKatex(content: string): string | null {
  if (!content.trim()) return null;

  const cacheKey = content;
  if (katexCache.has(cacheKey)) {
    return katexCache.get(cacheKey)!;
  }

  try {
    const katex = require('katex');
    const latex = toLatex(content);
    const html = katex.renderToString(latex, {
      throwOnError: false,
      displayMode: false,
      strict: false,
    });
    const safe = DOMPurify.sanitize(html);
    katexCache.set(cacheKey, safe);
    return safe;
  } catch {
    return null;
  }
}

/**
 * Rich text block - Corca-style with live inline math rendering
 */
export const RichTextBlock = forwardRef<RichTextBlockRef, RichTextBlockProps>(({
  block,
  lineNumber,
  isFocused,
  onContentChange,
  onFocus,
  onBlur,
  onEnter,
  onBackspaceEmpty,
  onConvertToHeading,
  autoFocus = false,
}, ref) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteIndex, setAutocompleteIndex] = useState(0);
  const [lastWord, setLastWord] = useState('');

  // Detect math segments
  const segments = useMemo(() => detectMathSegments(block.content), [block.content]);

  // Filter autocomplete suggestions
  const filteredSuggestions = useMemo(() => {
    if (!lastWord || lastWord.length < 1) return [];
    const lower = lastWord.toLowerCase();
    return SUGGESTIONS.filter(s =>
      s.trigger.toLowerCase().startsWith(lower) ||
      s.label.toLowerCase().includes(lower)
    ).slice(0, 10);
  }, [lastWord]);

  // Expose methods
  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    insertText: (text: string) => {
      if (inputRef.current) {
        const input = inputRef.current;
        const start = input.selectionStart || 0;
        const end = input.selectionEnd || 0;
        const newContent = block.content.slice(0, start) + text + block.content.slice(end);
        onContentChange(newContent);
        setTimeout(() => {
          input.selectionStart = input.selectionEnd = start + text.length;
        }, 0);
      } else {
        onContentChange(block.content + text);
      }
    },
  }));

  // Handle input change
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    onContentChange(value);

    // Extract last word for autocomplete
    const cursorPos = e.target.selectionStart || value.length;
    const textBeforeCursor = value.slice(0, cursorPos);
    const words = textBeforeCursor.split(/[\s+\-*/=()]/);
    const word = words[words.length - 1] || '';
    setLastWord(word);
    setShowAutocomplete(word.length >= 1);
    setAutocompleteIndex(0);
  }, [onContentChange]);

  // Handle keyboard
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    // Autocomplete navigation
    if (showAutocomplete && filteredSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setAutocompleteIndex(i => Math.min(i + 1, filteredSuggestions.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setAutocompleteIndex(i => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertSuggestion(filteredSuggestions[autocompleteIndex]);
        return;
      }
      if (e.key === 'Escape') {
        setShowAutocomplete(false);
        return;
      }
    }

    // Heading conversion
    if (e.key === ' ' && block.content.match(/^#{1,3}$/) && onConvertToHeading) {
      e.preventDefault();
      onConvertToHeading(block.content.length as 1 | 2 | 3);
      return;
    }

    // New line
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onEnter();
      return;
    }

    // Delete empty line
    if (e.key === 'Backspace' && block.content === '') {
      e.preventDefault();
      onBackspaceEmpty();
    }
  }, [showAutocomplete, filteredSuggestions, autocompleteIndex, block.content, onConvertToHeading, onEnter, onBackspaceEmpty]);

  // Insert suggestion
  const insertSuggestion = useCallback((suggestion: typeof SUGGESTIONS[0]) => {
    const input = inputRef.current;
    if (!input) return;

    const cursorPos = input.selectionStart || block.content.length;
    const textBeforeCursor = block.content.slice(0, cursorPos);

    // Find where the trigger word starts
    const words = textBeforeCursor.split(/[\s+\-*/=()]/);
    const triggerWord = words[words.length - 1] || '';
    const startPos = cursorPos - triggerWord.length;

    // Insert the latex or symbol
    const insertText = suggestion.latex || suggestion.symbol;
    const newContent = block.content.slice(0, startPos) + insertText + block.content.slice(cursorPos);

    onContentChange(newContent);
    setShowAutocomplete(false);
    setLastWord('');

    // Position cursor
    setTimeout(() => {
      const newPos = startPos + insertText.length;
      input.selectionStart = input.selectionEnd = newPos;
      input.focus();
    }, 0);
  }, [block.content, onContentChange]);

  // Auto-focus
  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
    }
  }, [autoFocus]);

  // Close autocomplete on blur
  const handleBlur = useCallback(() => {
    setTimeout(() => setShowAutocomplete(false), 150);
    onBlur();
  }, [onBlur]);

  // HEADING BLOCK
  if (block.type === 'heading') {
    const sizes = { 1: 'text-3xl font-bold', 2: 'text-2xl font-semibold', 3: 'text-xl font-medium' };
    return (
      <div className={cn('group flex items-start gap-3 py-2', isFocused && 'bg-gray-50/50 dark:bg-gray-900/30')}>
        <span className="w-8 text-right text-sm text-gray-300 dark:text-gray-700 select-none pt-1 font-mono">
          {lineNumber}.
        </span>
        <input
          ref={inputRef}
          type="text"
          value={block.content}
          onChange={(e) => onContentChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={onFocus}
          onBlur={handleBlur}
          placeholder={`Heading ${block.level || 1}...`}
          className={cn('flex-1 bg-transparent border-none outline-none', sizes[block.level || 1], 'placeholder:text-gray-300')}
          autoFocus={autoFocus}
        />
      </div>
    );
  }

  // RICH BLOCK - Live rendered math
  return (
    <div className={cn('group flex items-start gap-3 py-1.5 relative', isFocused && 'bg-gray-50/50 dark:bg-gray-900/30')}>
      {/* Line number */}
      <span className="w-8 text-right text-sm text-gray-300 dark:text-gray-700 select-none pt-0.5 font-mono">
        {lineNumber}.
      </span>

      {/* Content */}
      <div className="flex-1 min-h-[28px] relative">
        {/* Live rendered content with inline math */}
        <div className="flex items-center flex-wrap gap-0 min-h-[28px]">
          {segments.map((segment, i) => {
            if (segment.type === 'math') {
              const html = renderKatex(segment.content);
              if (html) {
                return (
                  <span
                    key={i}
                    className="inline-flex items-center mx-0.5 px-1 rounded bg-blue-50 dark:bg-blue-950/30"
                    dangerouslySetInnerHTML={{ __html: html }}
                  />
                );
              }
            }
            return <span key={i} className="whitespace-pre-wrap">{segment.content}</span>;
          })}

          {/* Invisible input overlaid for typing */}
          <input
            ref={inputRef}
            type="text"
            value={block.content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={onFocus}
            onBlur={handleBlur}
            className="absolute inset-0 w-full h-full opacity-0 cursor-text"
            placeholder="Type text or math..."
            autoFocus={autoFocus}
          />

          {/* Show placeholder when empty */}
          {!block.content && (
            <span className="text-gray-300 dark:text-gray-600 pointer-events-none">
              Type text or math like 3x+2=5...
            </span>
          )}
        </div>

        {/* Autocomplete popup - Corca style */}
        {showAutocomplete && filteredSuggestions.length > 0 && (
          <div className="absolute left-0 top-full mt-1 z-50 bg-gray-900 rounded-xl shadow-2xl border border-gray-700 py-2 min-w-[300px] max-w-[400px]">
            {filteredSuggestions.map((suggestion, i) => (
              <div
                key={suggestion.trigger}
                onClick={() => insertSuggestion(suggestion)}
                className={cn(
                  'flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors',
                  i === autocompleteIndex ? 'bg-gray-800' : 'hover:bg-gray-800/50'
                )}
              >
                <span className="text-2xl text-blue-400 w-8 text-center">{suggestion.symbol}</span>
                <span className="text-white font-medium">{suggestion.label}</span>
                <span className="text-gray-500 text-sm ml-1">· {suggestion.category}</span>
                {suggestion.shortcut && (
                  <span className="ml-auto text-gray-500 text-xs">{suggestion.shortcut}</span>
                )}
              </div>
            ))}
            <div className="px-4 py-1.5 text-xs text-gray-500 border-t border-gray-700 mt-1">
              Press <kbd className="px-1 py-0.5 bg-gray-800 rounded mx-1">Enter</kbd> to insert
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

RichTextBlock.displayName = 'RichTextBlock';
