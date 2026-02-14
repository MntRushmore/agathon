'use client';

import { useEffect, useRef, useCallback } from 'react';

interface TextOverlayProps {
  position: { x: number; y: number };
  fontSize: number;
  color: string;
  zoom: number;
  onSubmit: (text: string) => void;
  onCancel: () => void;
}

export function TextOverlay({ position, fontSize, color, zoom, onSubmit, onCancel }: TextOverlayProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Focus after a brief delay to ensure rendering
    const timer = setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  const handleBlur = useCallback(() => {
    const text = textareaRef.current?.value.trim();
    if (text) {
      onSubmit(text);
    } else {
      onCancel();
    }
  }, [onSubmit, onCancel]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleBlur();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
    // Stop propagation so keyboard shortcuts don't fire
    e.stopPropagation();
  }, [handleBlur, onCancel]);

  return (
    <textarea
      ref={textareaRef}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className="absolute bg-transparent border-none outline-none resize-none overflow-hidden p-0 m-0"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        fontSize: `${fontSize}px`,
        color,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        lineHeight: 1.4,
        minWidth: '100px',
        minHeight: `${fontSize * 1.4}px`,
        caretColor: color,
        // Visible text cursor area
        boxShadow: `0 2px 0 0 ${color}40`,
        zIndex: 10,
      }}
      placeholder="Type here..."
    />
  );
}
