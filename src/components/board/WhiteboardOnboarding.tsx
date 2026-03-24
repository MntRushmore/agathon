'use client';

import { useEffect, useState, useCallback, useRef, type CSSProperties } from 'react';
import { useEditor } from 'tldraw';
import { cn } from '@/lib/utils';
import { animate, stagger } from 'animejs';

interface WhiteboardOnboardingProps {
  onDismiss: () => void;
}

interface HintAnchor {
  left: number;
  top?: number;
  right?: number;
  bottom?: number;
}

// Clean arrow pointing up (towards top bar)
function ArrowUp({ className }: { className?: string }) {
  return (
    <svg
      width="40"
      height="56"
      viewBox="0 0 40 56"
      fill="none"
      className={className}
    >
      <path
        d="M20 52 C 18 42, 19 30, 20 18 C 21 12, 21 8, 20 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M14 12 L 20 2 L 26 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

// Clean arrow pointing down
function ArrowDown({ className }: { className?: string }) {
  return (
    <svg
      width="40"
      height="56"
      viewBox="0 0 40 56"
      fill="none"
      className={className}
    >
      <path
        d="M20 4 C 18 14, 19 26, 20 38 C 21 44, 21 48, 20 52"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M14 44 L 20 54 L 26 44"
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
  const overlayRef = useRef<HTMLDivElement>(null);
  const [anchors, setAnchors] = useState<{
    tool: HintAnchor;
    lasso: HintAnchor;
    back: HintAnchor;
    ai: HintAnchor;
  }>({
    tool: { left: 960, top: 64 },
    lasso: { left: 880, top: 64 },
    back: { left: 24, top: 64 },
    ai: { right: 24, bottom: 96 },
  });

  const measureAnchors = useCallback(() => {
    const toolbar = document.querySelector('[data-topbar-tools]') as HTMLElement | null;
    const penButton = document.querySelector('[aria-label="Pen"]') as HTMLElement | null;
    const lassoButton = document.querySelector('[aria-label="Lasso Solve"]') as HTMLElement | null;
    const backButton = document.querySelector('[aria-label="Go back"]') as HTMLElement | null;
    const aiButton = document.querySelector('[aria-label="Open AI Tutor"]') as HTMLElement | null;

    const toolbarRect = toolbar?.getBoundingClientRect();
    const penRect = penButton?.getBoundingClientRect();
    const lassoRect = lassoButton?.getBoundingClientRect();
    const backRect = backButton?.getBoundingClientRect();
    const aiRect = aiButton?.getBoundingClientRect();

    const topOffset = (rect?: DOMRect) => (rect ? rect.bottom + 12 : 64);

    setAnchors({
      tool: {
        left: penRect?.left != null
          ? penRect.left + penRect.width / 2
          : toolbarRect?.left != null
            ? toolbarRect.left + toolbarRect.width * 0.62
            : window.innerWidth / 2,
        top: topOffset(penRect ?? toolbarRect),
      },
      lasso: {
        left: lassoRect?.left != null
          ? lassoRect.left + lassoRect.width / 2
          : toolbarRect?.left != null
            ? toolbarRect.left + toolbarRect.width * 0.18
            : window.innerWidth / 2 - 80,
        top: topOffset(lassoRect ?? toolbarRect),
      },
      back: {
        left: backRect?.left ?? 24,
        top: topOffset(backRect),
      },
      ai: aiRect
        ? {
            left: aiRect.left + aiRect.width / 2,
            bottom: Math.max(window.innerHeight - aiRect.top + 8, 72),
          }
        : {
            right: 24,
            bottom: 96,
          },
    });
  }, []);

  // Check on mount if canvas already has shapes
  useEffect(() => {
    if (!editor) return;

    const timer = setTimeout(() => {
      const shapes = editor.getCurrentPageShapes();
      if (shapes.length === 0) {
        setIsVisible(true);
      } else {
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

  // Stagger hints in with anime.js
  useEffect(() => {
    if (!isVisible || !overlayRef.current) return;
    const hints = overlayRef.current.querySelectorAll('[data-hint]');
    if (hints.length === 0) return;
    animate(hints, {
      opacity: [0, 1],
      translateY: [12, 0],
      delay: stagger(100, { start: 200 }),
      duration: 600,
      ease: 'outQuint',
    });
  }, [isVisible]);

  useEffect(() => {
    if (!shouldRender) return;

    let frameId = window.requestAnimationFrame(measureAnchors);
    const intervalId = window.setInterval(measureAnchors, 250);

    const handleViewportChange = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(measureAnchors);
    };

    window.addEventListener('resize', handleViewportChange);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearInterval(intervalId);
      window.removeEventListener('resize', handleViewportChange);
    };
  }, [measureAnchors, shouldRender]);

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    setTimeout(() => {
      onDismiss();
      setShouldRender(false);
    }, 300);
  }, [onDismiss]);

  if (!shouldRender) return null;

  const toolHintStyle: CSSProperties = {
    left: anchors.tool.left,
    top: anchors.tool.top,
    transform: 'translateX(-50%)',
  };

  const lassoHintStyle: CSSProperties = {
    left: anchors.lasso.left,
    top: anchors.lasso.top,
    transform: 'translateX(-50%)',
  };

  const backHintStyle: CSSProperties = {
    left: anchors.back.left,
    top: anchors.back.top,
  };

  const aiHintStyle: CSSProperties = anchors.ai.left != null
    ? {
        left: anchors.ai.left,
        bottom: anchors.ai.bottom,
        transform: 'translateX(-50%)',
      }
    : {
        right: anchors.ai.right,
        bottom: anchors.ai.bottom,
      };

  return (
    <div
      ref={overlayRef}
      className={cn(
        'fixed inset-0 z-[400] transition-opacity duration-300',
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      )}
      onClick={handleDismiss}
    >
      {/* Center welcome message */}
      <div data-hint className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none opacity-0">
        <h1 className="text-4xl font-semibold text-gray-800 mb-3 tracking-tight">
          Your whiteboard
        </h1>
        <p className="text-gray-400 text-base mb-8">
          Auto-saves as you go. Start drawing to begin.
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 text-gray-500 text-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-pulse" />
          Click anywhere to dismiss
        </div>
      </div>

      {/* Toolbar hint - pointing UP to the top bar tools */}
      <div data-hint className="absolute flex flex-col items-center pointer-events-none opacity-0" style={toolHintStyle}>
        <ArrowUp className="text-gray-300" />
        <p className="text-gray-400 text-sm text-center mt-1">
          Pick a tool &amp;<br />start drawing
        </p>
      </div>

      {/* Lasso Solve hint - pointing UP to the lasso tool in toolbar */}
      <div data-hint className="absolute flex flex-col items-center pointer-events-none opacity-0" style={lassoHintStyle}>
        <ArrowUp className="text-gray-300" />
        <p className="text-gray-400 text-sm text-center mt-1">
          <span className="text-gray-500 font-medium">Lasso Solve</span><br />
          Circle a problem<br />for AI help
        </p>
      </div>

      {/* Back button hint - top left */}
      <div data-hint className="absolute flex flex-col items-start pointer-events-none opacity-0" style={backHintStyle}>
        <ArrowUp className="text-gray-300" />
        <p className="text-gray-400 text-sm mt-1">
          Back to<br />dashboard
        </p>
      </div>

      {/* AI Chat hint - bottom right pointing to chat button */}
      <div data-hint className="absolute flex flex-col items-center pointer-events-none opacity-0" style={aiHintStyle}>
        <p className="text-gray-400 text-sm text-center mb-1">
          Ask AI<br />for help
        </p>
        <ArrowDown className="text-gray-300" />
      </div>
    </div>
  );
}
