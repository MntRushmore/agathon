'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { X, CheckCircle, XCircle, Lightbulb, ArrowRight, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LatexRenderer } from '@/components/chat/LatexRenderer';
import { animate, stagger } from 'animejs';

interface FeedbackAnnotation {
  type: 'correction' | 'hint' | 'encouragement' | 'step' | 'answer';
  content: string;
}

interface FeedbackCardProps {
  summary: string;
  annotations: FeedbackAnnotation[];
  isCorrect?: boolean | null;
  solution?: string;
  onClose: () => void;
  position: { x: number; y: number };
  onDragEnd?: (x: number, y: number) => void;
  isClosing?: boolean;
}

export function FeedbackCard({
  summary,
  annotations,
  isCorrect,
  solution,
  onClose,
  position,
  onDragEnd,
  isClosing,
}: FeedbackCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const annotationsRef = useRef<HTMLDivElement>(null);
  const solutionRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });
  const pos = useRef(position);
  const [isDragging, setIsDragging] = useState(false);
  const [showSolution, setShowSolution] = useState(false);

  // Apply initial position
  useEffect(() => {
    if (cardRef.current) {
      cardRef.current.style.transform = `translate(${position.x}px, ${position.y}px)`;
    }
    pos.current = position;
  }, [position]);

  // Stagger annotations in with anime.js
  useEffect(() => {
    if (!annotationsRef.current || isClosing) return;
    const items = annotationsRef.current.querySelectorAll('[data-annotation]');
    if (items.length === 0) return;
    animate(items, {
      opacity: [0, 1],
      translateY: [12, 0],
      delay: stagger(80, { start: 150 }),
      duration: 350,
      ease: 'outQuint',
    });
  }, [annotations.length, isClosing]);

  // Smooth solution reveal with anime.js
  useEffect(() => {
    if (!showSolution || !solutionRef.current) return;
    const el = solutionRef.current;
    el.style.overflow = 'hidden';
    animate(el, {
      maxHeight: [0, el.scrollHeight + 20],
      opacity: [0, 1],
      duration: 400,
      ease: 'outQuint',
      onComplete: () => { el.style.overflow = ''; el.style.maxHeight = ''; },
    });
  }, [showSolution]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    dragging.current = true;
    setIsDragging(true);
    offset.current = {
      x: e.clientX - pos.current.x,
      y: e.clientY - pos.current.y,
    };
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging.current || !cardRef.current) return;
      const newX = e.clientX - offset.current.x;
      const newY = e.clientY - offset.current.y;
      pos.current = { x: newX, y: newY };
      cardRef.current.style.transform = `translate(${newX}px, ${newY}px)`;
    };

    const handleMouseUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      setIsDragging(false);
      onDragEnd?.(pos.current.x, pos.current.y);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [onDragEnd]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'correction':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'hint':
        return <Lightbulb className="w-4 h-4 text-amber-500" />;
      case 'encouragement':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'step':
        return <ArrowRight className="w-4 h-4 text-blue-500" />;
      case 'answer':
        return <CheckCircle className="w-4 h-4 text-violet-500" />;
      default:
        return <Lightbulb className="w-4 h-4 text-gray-500" />;
    }
  };

  const getTypeBg = (type: string) => {
    switch (type) {
      case 'correction':
        return 'bg-red-50 border-red-100';
      case 'hint':
        return 'bg-amber-50 border-amber-100';
      case 'encouragement':
        return 'bg-green-50 border-green-100';
      case 'step':
        return 'bg-blue-50 border-blue-100';
      case 'answer':
        return 'bg-violet-50 border-violet-100';
      default:
        return 'bg-gray-50 border-gray-100';
    }
  };

  return (
    <div
      ref={cardRef}
      className={cn(
        "fixed top-0 left-0 z-[var(--z-overlay)] w-[320px] max-w-[90vw] bg-white rounded-xl shadow-lg border border-gray-200",
        "select-none will-change-transform",
        isClosing
          ? "animate-out fade-out zoom-out-95 duration-200"
          : "animate-in zoom-in-95 fade-in duration-200",
        isDragging && "cursor-grabbing shadow-xl"
      )}
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 cursor-grab">
        <div className="flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-gray-300" />
          {isCorrect === true && (
            <div className="flex items-center gap-1.5 text-green-600">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm font-medium">Correct!</span>
            </div>
          )}
          {isCorrect === false && (
            <div className="flex items-center gap-1.5 text-red-600">
              <XCircle className="w-4 h-4" />
              <span className="text-sm font-medium">Not quite</span>
            </div>
          )}
          {(isCorrect === null || isCorrect === undefined) && (
            <span className="text-sm font-medium text-gray-600">Feedback</span>
          )}
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 transition-colors"
        >
          <X className="w-3.5 h-3.5 text-gray-400" />
        </button>
      </div>

      {/* Content */}
      <div className="p-3 space-y-2 max-h-[400px] overflow-y-auto">
        {/* Summary */}
        {summary && summary !== 'AI Feedback' && (
          <div className="text-sm text-gray-600 pb-2 border-b border-gray-50">
            <LatexRenderer content={summary} />
          </div>
        )}

        {/* Annotations */}
        <div ref={annotationsRef}>
        {annotations.map((annotation, index) => (
          <div
            key={index}
            data-annotation
            className={cn(
              "p-2.5 rounded-lg border mb-2 opacity-0",
              getTypeBg(annotation.type)
            )}
          >
            <div className="flex items-start gap-2">
              <div className="mt-0.5 flex-shrink-0">
                {getTypeIcon(annotation.type)}
              </div>
              <div className="flex-1 text-sm text-gray-700 leading-relaxed overflow-x-auto">
                <LatexRenderer content={annotation.content} />
              </div>
            </div>
          </div>
        ))}
        </div>

        {/* Solution (expandable) */}
        {solution && (
          <div className="pt-2 border-t border-gray-100">
            {!showSolution ? (
              <button
                onClick={() => setShowSolution(true)}
                className="text-sm text-violet-600 hover:text-violet-700 font-medium"
              >
                Show full solution
              </button>
            ) : (
              <div ref={solutionRef} className="p-3 bg-violet-50 rounded-lg border border-violet-100 opacity-0">
                <p className="text-xs text-violet-600 font-medium mb-2">Solution</p>
                <div className="text-sm text-gray-700 overflow-x-auto">
                  <LatexRenderer content={solution} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
