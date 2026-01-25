'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Loader2, GripVertical, ChevronDown, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LatexRenderer } from '@/components/chat/LatexRenderer';

interface Step {
  number: number;
  explanation: string;
  latex?: string;
}

interface SocraticQuestion {
  question: string;
  hint: string;
  followUp: string;
}

interface GoDeepData {
  steps: Step[];
  socraticQuestions: SocraticQuestion[];
  conceptsInvolved: string[];
}

interface GoDeepPanelProps {
  isOpen: boolean;
  onClose: () => void;
  problemImage: string | null;
  originalAnswer?: string;
  onWidthChange?: (width: number) => void;
}

export function GoDeepPanel({ isOpen, onClose, problemImage, originalAnswer, onWidthChange }: GoDeepPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<GoDeepData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [panelWidth, setPanelWidth] = useState(380);
  const [isDragging, setIsDragging] = useState(false);
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set());
  const [revealedHints, setRevealedHints] = useState<Set<number>>(new Set());
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  // Fetch deeper explanation when panel opens with a new problem
  useEffect(() => {
    if (isOpen && problemImage && !data) {
      fetchDeepExplanation();
    }
  }, [isOpen, problemImage]);

  // Reset data when panel closes
  useEffect(() => {
    if (!isOpen) {
      const timer = setTimeout(() => {
        setData(null);
        setError(null);
        setExpandedQuestions(new Set());
        setRevealedHints(new Set());
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle drag resize
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = dragStartX.current - e.clientX;
      const newWidth = Math.min(Math.max(dragStartWidth.current + delta, 300), 600);
      setPanelWidth(newWidth);
      onWidthChange?.(newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, onWidthChange]);

  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartX.current = e.clientX;
    dragStartWidth.current = panelWidth;
  };

  const toggleQuestion = (index: number) => {
    setExpandedQuestions(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const revealHint = (index: number) => {
    setRevealedHints(prev => new Set(prev).add(index));
  };

  const fetchDeepExplanation = async () => {
    if (!problemImage) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/go-deeper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: problemImage,
          originalAnswer: originalAnswer || '',
          mode: 'both',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to get explanation');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Go Deeper error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load explanation. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      style={{ width: panelWidth }}
      className={cn(
        "fixed top-0 right-0 h-full bg-white border-l border-gray-200 z-[1050]",
        "flex flex-col",
        isDragging && "select-none"
      )}
    >
      {/* Drag Handle */}
      <div
        onMouseDown={handleDragStart}
        className={cn(
          "absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize",
          "hover:bg-violet-400 transition-colors",
          isDragging && "bg-violet-500"
        )}
      >
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-8 flex items-center justify-center -translate-x-1/2 bg-white border border-gray-200 rounded-l shadow-sm opacity-0 hover:opacity-100 transition-opacity">
          <GripVertical className="w-2.5 h-2.5 text-gray-400" />
        </div>
      </div>

      {/* Header - minimal */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-sm font-medium text-gray-600">Understanding the problem</span>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 transition-colors"
        >
          <X className="w-3.5 h-3.5 text-gray-400" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-6">
          {/* Loading State */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin mb-2" />
              <p className="text-sm">Thinking...</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm">
              <p>{error}</p>
              <button
                onClick={fetchDeepExplanation}
                className="mt-2 text-xs underline hover:no-underline"
              >
                Try again
              </button>
            </div>
          )}

          {/* Step by Step - cleaner cards */}
          {data && data.steps.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-gray-400 font-medium">How to solve it</p>
              <div className="space-y-2">
                {data.steps.map((step, idx) => (
                  <div
                    key={step.number}
                    className={cn(
                      "p-3 rounded-lg transition-all",
                      idx === 0 ? "bg-violet-50" : "bg-gray-50"
                    )}
                  >
                    <div className="flex gap-2.5">
                      <span className={cn(
                        "text-xs font-medium mt-0.5",
                        idx === 0 ? "text-violet-500" : "text-gray-400"
                      )}>
                        {step.number}.
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 leading-relaxed">{step.explanation}</p>
                        {step.latex && (
                          <div className="mt-2 text-base text-gray-800">
                            <LatexRenderer content={step.latex} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Socratic Questions - Interactive */}
          {data && data.socraticQuestions.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-gray-400 font-medium">Think deeper</p>
              <div className="space-y-2">
                {data.socraticQuestions.map((q, index) => {
                  const isExpanded = expandedQuestions.has(index);
                  const hintRevealed = revealedHints.has(index);
                  // Handle both old format (string) and new format (object)
                  const question = typeof q === 'string' ? q : q.question;
                  const hint = typeof q === 'string' ? null : q.hint;
                  const followUp = typeof q === 'string' ? null : q.followUp;

                  return (
                    <div
                      key={index}
                      className="rounded-lg border border-gray-100 overflow-hidden"
                    >
                      <button
                        onClick={() => toggleQuestion(index)}
                        className="w-full p-3 flex items-start gap-2 text-left hover:bg-gray-50 transition-colors"
                      >
                        <MessageCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-gray-700 flex-1">{question}</span>
                        <ChevronDown className={cn(
                          "w-4 h-4 text-gray-400 transition-transform flex-shrink-0",
                          isExpanded && "rotate-180"
                        )} />
                      </button>

                      {isExpanded && (hint || followUp) && (
                        <div className="px-3 pb-3 pt-0 border-t border-gray-50">
                          {hint && !hintRevealed && (
                            <button
                              onClick={() => revealHint(index)}
                              className="mt-2 text-xs text-amber-600 hover:text-amber-700 font-medium"
                            >
                              Need a hint?
                            </button>
                          )}

                          {hint && hintRevealed && (
                            <div className="mt-2 p-2 bg-amber-50 rounded text-xs text-amber-800">
                              {hint}
                            </div>
                          )}

                          {followUp && (
                            <p className="mt-2 text-xs text-gray-500 italic">
                              {followUp}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Concepts - subtle tags */}
          {data && data.conceptsInvolved.length > 0 && (
            <div className="pt-2 border-t border-gray-100">
              <div className="flex flex-wrap gap-1.5">
                {data.conceptsInvolved.map((concept, index) => (
                  <span
                    key={index}
                    className="px-2 py-0.5 text-xs text-gray-500 bg-gray-50 rounded"
                  >
                    {concept}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !error && !data && (
            <div className="flex flex-col items-center justify-center py-16 text-center text-gray-300">
              <p className="text-sm">
                Select a problem to explore
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
