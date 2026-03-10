'use client';

import { HelpCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HintButtonProps {
  onClick: () => void;
  isLoading?: boolean;
  className?: string;
}

export function HintButton({ onClick, isLoading, className }: HintButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className={cn(
        "no-enlarge flex items-center gap-1.5 px-3 py-2 min-h-[44px] sm:min-h-0",
        "bg-white hover:bg-gray-50",
        "border border-gray-200/80",
        "rounded-xl text-sm text-gray-600 font-medium",
        "shadow-[0_1px_4px_rgba(0,0,0,0.06)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)]",
        "transition-all duration-150 active:scale-[0.97]",
        "disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100",
        isLoading && "bg-amber-50 border-amber-200/60 text-amber-700",
        className
      )}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
      ) : (
        <HelpCircle className="w-4 h-4" />
      )}
      <span className="hidden sm:inline">
        {isLoading ? 'Thinking...' : 'Need a hint?'}
      </span>
    </button>
  );
}
