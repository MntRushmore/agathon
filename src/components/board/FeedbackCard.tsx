'use client';

import { useState } from 'react';
import { X, CheckCircle, XCircle, Lightbulb, ArrowRight, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LatexRenderer } from '@/components/chat/LatexRenderer';

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
}

export function FeedbackCard({
  summary,
  annotations,
  isCorrect,
  solution,
  onClose,
  position,
  onDragEnd,
}: FeedbackCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [currentPos, setCurrentPos] = useState(position);
  const [showSolution, setShowSolution] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - currentPos.x,
      y: e.clientY - currentPos.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;
    setCurrentPos({ x: newX, y: newY });
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      onDragEnd?.(currentPos.x, currentPos.y);
    }
  };

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
      className={cn(
        "fixed z-[1100] w-[320px] max-w-[90vw] bg-white rounded-xl shadow-lg border border-gray-200",
        "select-none",
        isDragging && "cursor-grabbing shadow-xl"
      )}
      style={{
        left: currentPos.x,
        top: currentPos.y,
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
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
          <p className="text-sm text-gray-600 pb-2 border-b border-gray-50">
            <LatexRenderer content={summary} />
          </p>
        )}

        {/* Annotations */}
        {annotations.map((annotation, index) => (
          <div
            key={index}
            className={cn(
              "p-2.5 rounded-lg border",
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
              <div className="p-3 bg-violet-50 rounded-lg border border-violet-100">
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
