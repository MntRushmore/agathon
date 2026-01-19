'use client';

import { useEffect, useState, useCallback } from 'react';
import { useEditor } from 'tldraw';
import { cn } from '@/lib/utils';

interface WhiteboardOnboardingProps {
  onDismiss: () => void;
}

// Hand-drawn style curved arrow pointing down
function CurvedArrowDown({ className }: { className?: string }) {
  return (
    <svg
      width="50"
      height="70"
      viewBox="0 0 50 70"
      fill="none"
      className={className}
    >
      <path
        d="M25 5 Q 22 20, 24 35 Q 26 50, 27 60"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M20 54 L 27 66 L 34 55"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

// Hand-drawn style curved arrow pointing to top-left (for back button)
function CurvedArrowTopLeft({ className }: { className?: string }) {
  return (
    <svg
      width="70"
      height="50"
      viewBox="0 0 70 50"
      fill="none"
      className={className}
    >
      <path
        d="M65 40 Q 50 35, 35 28 Q 20 20, 12 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M8 20 L 10 8 L 20 12"
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
      {/* Toolbar hint - pointing down to bottom toolbar */}
      <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none">
        <p className="text-gray-400 text-sm italic text-center whitespace-nowrap mb-1">
          Pick a tool &<br />Start drawing!
        </p>
        <CurvedArrowDown className="text-gray-400/70" />
      </div>

      {/* Back button hint - top left, closer to the actual button */}
      <div className="absolute top-8 left-16 flex items-end gap-1 pointer-events-none">
        <CurvedArrowTopLeft className="text-gray-400/70" />
        <p className="text-gray-400 text-sm italic whitespace-nowrap mb-1">
          Back to<br />dashboard
        </p>
      </div>

      {/* AI Chat hint - bottom right pointing to chat button */}
      <div className="absolute bottom-24 right-6 flex flex-col items-center pointer-events-none">
        <p className="text-gray-400 text-sm italic text-center mb-1">
          Ask AI<br />for help
        </p>
        <CurvedArrowDown className="text-gray-400/70" />
      </div>

      {/* Center welcome message */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
        <h1 className="text-4xl font-semibold text-gray-700 mb-3 tracking-tight">
          Welcome to your whiteboard
        </h1>
        <p className="text-gray-400 text-lg mb-6">
          Your work auto-saves as you go
        </p>
        <p className="text-gray-400/60 text-sm italic">
          Click anywhere or start drawing to begin
        </p>
      </div>
    </div>
  );
}
