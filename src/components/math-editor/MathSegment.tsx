'use client';

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { toLatex } from '@/lib/plain-to-latex';
import 'katex/dist/katex.min.css';
import DOMPurify from 'dompurify';

interface MathSegmentProps {
  content: string;
  onClick?: (e: React.MouseEvent) => void;
  isEditing?: boolean;
  className?: string;
}

/**
 * Renders a math expression using KaTeX
 * Converts plain text to LaTeX if needed
 */
export function MathSegment({
  content,
  onClick,
  isEditing = false,
  className,
}: MathSegmentProps) {
  // Convert to LaTeX and render
  const { html, error } = useMemo(() => {
    try {
      // Dynamically import KaTeX to avoid SSR issues
      const katex = require('katex');
      const latex = toLatex(content);

      const rendered = katex.renderToString(latex, {
        throwOnError: false,
        displayMode: false,
        strict: false,
        macros: {
          '\\N': '\\mathbb{N}',
          '\\Z': '\\mathbb{Z}',
          '\\R': '\\mathbb{R}',
          '\\Q': '\\mathbb{Q}',
          '\\C': '\\mathbb{C}',
        },
      });

      const safe = DOMPurify.sanitize(rendered);

      return { html: safe, error: null };
    } catch (err) {
      console.error('KaTeX render error:', err);
      return { html: null, error: err };
    }
  }, [content]);

  if (error || !html) {
    // Fallback: show plain text with math styling
    return (
      <span
        onClick={onClick}
        className={cn(
          'inline-flex items-center px-1 py-0.5 rounded',
          'font-mono text-blue-600 dark:text-blue-400',
          'bg-blue-50 dark:bg-blue-950/30',
          onClick && 'cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/50',
          isEditing && 'ring-2 ring-blue-400',
          className
        )}
      >
        {content}
      </span>
    );
  }

  return (
    <span
      onClick={onClick}
      className={cn(
        'inline-flex items-center align-middle',
        'mx-0.5 px-1 py-0.5 rounded',
        'bg-blue-50/50 dark:bg-blue-950/20',
        onClick && 'cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors',
        isEditing && 'ring-2 ring-blue-400 bg-blue-100 dark:bg-blue-900/50',
        className
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/**
 * Simple inline math renderer (no click handling)
 */
export function InlineMath({ content, className }: { content: string; className?: string }) {
  const html = useMemo(() => {
    try {
      const katex = require('katex');
      const latex = toLatex(content);
      const rendered = katex.renderToString(latex, {
        throwOnError: false,
        displayMode: false,
      });
      return DOMPurify.sanitize(rendered);
    } catch {
      return null;
    }
  }, [content]);

  if (!html) {
    return <span className={cn('font-mono', className)}>{content}</span>;
  }

  return (
    <span
      className={cn('inline-flex items-center align-middle', className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
