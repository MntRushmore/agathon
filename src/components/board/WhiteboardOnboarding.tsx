'use client';

import { useEffect, useState, useCallback } from 'react';
import { useEditor } from 'tldraw';
import { cn } from '@/lib/utils';

interface WhiteboardOnboardingProps {
  onDismiss: () => void;
}

// Hand-drawn style curved arrow pointing up
function CurvedArrowUp({ className }: { className?: string }) {
  return (
    <svg
      width="60"
      height="80"
      viewBox="0 0 60 80"
      fill="none"
      className={className}
    >
      <path
        d="M30 75 Q 25 60, 28 45 Q 30 30, 32 15"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M25 20 L 32 8 L 40 18"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

// Hand-drawn style curved arrow pointing down-right
function CurvedArrowDown({ className }: { className?: string }) {
  return (
    <svg
      width="80"
      height="100"
      viewBox="0 0 80 100"
      fill="none"
      className={className}
    >
      <path
        d="M40 5 Q 35 25, 38 45 Q 42 70, 45 90"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M38 82 L 45 95 L 53 84"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

// Hand-drawn style curved arrow pointing left
function CurvedArrowLeft({ className }: { className?: string }) {
  return (
    <svg
      width="80"
      height="60"
      viewBox="0 0 80 60"
      fill="none"
      className={className}
    >
      <path
        d="M75 30 Q 55 28, 40 30 Q 25 32, 10 35"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M18 28 L 5 35 L 16 44"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function WhiteboardOnboarding({ onDismiss }: WhiteboardOnboardingProps) {
  const editor = useEditor();
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(true);

  // Check on mount if canvas already has shapes
  useEffect(() => {
    if (!editor) return;

    // Small delay to let initial data load
    const timer = setTimeout(() => {
      const shapes = editor.getCurrentPageShapes();
      if (shapes.length === 0) {
        // Empty canvas, show onboarding
        setIsVisible(true);
      } else {
        // Canvas has content, skip onboarding
        onDismiss();
        setShouldRender(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [editor, onDismiss]);

  // Listen for shape creation to dismiss
  useEffect(() => {
    if (!editor || !isVisible) return;

    const handleChange = () => {
      const shapes = editor.getCurrentPageShapes();
      if (shapes.length > 0) {
        // User started drawing, dismiss
        setIsVisible(false);
        setTimeout(() => {
          onDismiss();
          setShouldRender(false);
        }, 400);
      }
    };

    const unsubscribe = editor.store.listen(handleChange, { scope: 'document' });
    return () => unsubscribe();
  }, [editor, isVisible, onDismiss]);

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    setTimeout(() => {
      onDismiss();
      setShouldRender(false);
    }, 300);
  }, [onDismiss]);

  if (!shouldRender) return null;

  return (
    <div
      className={cn(
        'fixed inset-0 z-[400] transition-opacity duration-400',
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      )}
      onClick={handleDismiss}
    >
      {/* Toolbar hint - pointing up to toolbar */}
      <div className="absolute top-24 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none">
        <CurvedArrowUp className="text-gray-400/60 mb-2" />
        <p className="text-gray-400 text-base italic text-center whitespace-nowrap">
          Pick a tool &<br />Start drawing!
        </p>
      </div>

      {/* Back button hint - top left */}
      <div className="absolute top-20 left-24 flex items-center gap-1 pointer-events-none">
        <CurvedArrowLeft className="text-gray-400/60" />
        <p className="text-gray-400 text-sm italic whitespace-nowrap">
          Back to dashboard
        </p>
      </div>

      {/* AI Chat hint - bottom right pointing to chat button */}
      <div className="absolute bottom-36 right-8 flex flex-col items-center pointer-events-none">
        <p className="text-gray-400 text-sm italic text-center mb-2">
          Ask AI<br />for help
        </p>
        <CurvedArrowDown className="text-gray-400/60" />
      </div>

      {/* Center welcome message */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
        <h1 className="text-4xl font-semibold text-gray-700 mb-3 tracking-tight">
          Welcome to your whiteboard
        </h1>
        <p className="text-gray-400 text-lg mb-8">
          Your work auto-saves as you go
        </p>
        <p className="text-gray-400/70 text-sm italic">
          Click anywhere or start drawing to begin
        </p>
      </div>
    </div>
  );
}
