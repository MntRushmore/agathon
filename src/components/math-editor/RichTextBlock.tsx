'use client';

import React, { useRef, useState, useCallback, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import { cn } from '@/lib/utils';
import { detectMathSegments, Segment } from '@/lib/math-detection';
import { MathSegment } from './MathSegment';
import { InlineMathEditor } from './InlineMathEditor';

export interface RichBlock {
  id: string;
  type: 'rich' | 'heading';
  content: string; // Raw text content
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

/**
 * Rich text block that automatically detects and renders math inline
 * Users can type naturally - math is detected and rendered automatically
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
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isEditing, setIsEditing] = useState(true); // Start in editing mode
  const [editingMathIndex, setEditingMathIndex] = useState<number | null>(null);
  const [cursorPosition, setCursorPosition] = useState(0);

  // Detect math segments from content
  const segments = useMemo(() => {
    return detectMathSegments(block.content);
  }, [block.content]);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    focus: () => {
      setIsEditing(true);
      setTimeout(() => textareaRef.current?.focus(), 50);
    },
    insertText: (text: string) => {
      if (textareaRef.current) {
        const textarea = textareaRef.current;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newContent = block.content.slice(0, start) + text + block.content.slice(end);
        onContentChange(newContent);
        // Set cursor position after inserted text
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + text.length;
        }, 0);
      } else {
        onContentChange(block.content + text);
      }
    },
  }));

  // Handle keyboard events
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Convert to heading with # at start
    if (e.key === ' ' && block.content.match(/^#{1,3}$/) && onConvertToHeading) {
      e.preventDefault();
      const level = block.content.length as 1 | 2 | 3;
      onConvertToHeading(level);
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onEnter();
    } else if (e.key === 'Backspace' && block.content === '') {
      e.preventDefault();
      onBackspaceEmpty();
    }

    // Track cursor position
    setTimeout(() => {
      if (textareaRef.current) {
        setCursorPosition(textareaRef.current.selectionStart);
      }
    }, 0);
  };

  // Handle text change
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onContentChange(e.target.value);
  };

  // Handle clicking on the rendered view to edit
  const handleContainerClick = (e: React.MouseEvent) => {
    // Don't switch to editing if clicking on a math segment
    if ((e.target as HTMLElement).closest('.math-segment')) {
      return;
    }
    setIsEditing(true);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  // Handle blur from textarea
  const handleTextareaBlur = (e: React.FocusEvent) => {
    // Only leave edit mode if not clicking within the container
    // Use a small delay to check if focus moved within the block
    setTimeout(() => {
      if (!containerRef.current?.contains(document.activeElement)) {
        setIsEditing(false);
        onBlur();
      }
    }, 100);
  };

  // Handle clicking on a math segment to edit it
  const handleMathClick = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingMathIndex(index);
    setIsEditing(false);
  };

  // Handle saving math edit
  const handleMathSave = (index: number, newLatex: string) => {
    // Replace the math segment content
    let charIndex = 0;
    let segmentIndex = 0;
    let startPos = 0;
    let endPos = 0;

    for (const segment of segments) {
      if (segmentIndex === index) {
        startPos = charIndex;
        endPos = charIndex + segment.content.length;
        break;
      }
      charIndex += segment.content.length;
      segmentIndex++;
    }

    const newContent = block.content.slice(0, startPos) + newLatex + block.content.slice(endPos);
    onContentChange(newContent);
    setEditingMathIndex(null);
  };

  // Handle canceling math edit
  const handleMathCancel = () => {
    setEditingMathIndex(null);
  };

  // Handle deleting math segment
  const handleMathDelete = (index: number) => {
    let charIndex = 0;
    let segmentIndex = 0;
    let startPos = 0;
    let endPos = 0;

    for (const segment of segments) {
      if (segmentIndex === index) {
        startPos = charIndex;
        endPos = charIndex + segment.content.length;
        break;
      }
      charIndex += segment.content.length;
      segmentIndex++;
    }

    const newContent = block.content.slice(0, startPos) + block.content.slice(endPos);
    onContentChange(newContent);
    setEditingMathIndex(null);
  };

  // Auto-resize textarea
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.max(textarea.scrollHeight, 28)}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [block.content]);

  // Auto-focus on mount if needed
  useEffect(() => {
    if (autoFocus) {
      setIsEditing(true);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [autoFocus]);

  // Get the math segment being edited
  const editingSegment = editingMathIndex !== null ? segments[editingMathIndex] : null;

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
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={onFocus}
          onBlur={handleTextareaBlur}
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

  // RICH TEXT BLOCK (with inline math)
  return (
    <div
      ref={containerRef}
      className={cn(
        'group flex items-start gap-3 py-1.5 transition-colors relative',
        isFocused ? 'bg-gray-50/50 dark:bg-gray-900/30' : ''
      )}
    >
      {/* Line number */}
      <span className="w-8 text-right text-sm text-gray-300 dark:text-gray-700 select-none pt-0.5 font-mono">
        {lineNumber}.
      </span>

      {/* Content area */}
      <div className="flex-1 min-h-[28px] relative">
        {/* Edit mode: show textarea */}
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={block.content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={onFocus}
            onBlur={handleTextareaBlur}
            placeholder="Type text or math like 3x+2=5..."
            className={cn(
              'w-full bg-transparent border-none outline-none resize-none',
              'text-base leading-relaxed text-gray-800 dark:text-gray-200',
              'placeholder:text-gray-300 dark:placeholder:text-gray-600'
            )}
            rows={1}
            autoFocus={autoFocus}
          />
        ) : (
          /* Display mode: render segments with math */
          <div
            onClick={handleContainerClick}
            className={cn(
              'w-full min-h-[28px] cursor-text',
              'text-base leading-relaxed text-gray-800 dark:text-gray-200'
            )}
          >
            {segments.length === 0 || (segments.length === 1 && !segments[0].content) ? (
              <span className="text-gray-300 dark:text-gray-600">
                Type text or math like 3x+2=5...
              </span>
            ) : (
              segments.map((segment, index) => {
                if (segment.type === 'math') {
                  return (
                    <span key={index} className="math-segment">
                      <MathSegment
                        content={segment.content}
                        onClick={(e) => handleMathClick(index, e)}
                        isEditing={editingMathIndex === index}
                      />
                    </span>
                  );
                }
                return (
                  <span key={index} className="whitespace-pre-wrap">
                    {segment.content}
                  </span>
                );
              })
            )}
          </div>
        )}

        {/* Math editor popup */}
        {editingMathIndex !== null && editingSegment && (
          <InlineMathEditor
            initialValue={editingSegment.content}
            onSave={(latex) => handleMathSave(editingMathIndex, latex)}
            onCancel={handleMathCancel}
            onDelete={() => handleMathDelete(editingMathIndex)}
            position={{ top: 0, left: 40 }}
          />
        )}
      </div>
    </div>
  );
});

RichTextBlock.displayName = 'RichTextBlock';
