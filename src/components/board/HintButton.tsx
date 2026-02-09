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
        "flex items-center gap-1.5 px-4 py-3 sm:px-3 sm:py-2 min-h-[44px] sm:min-h-0",
        "bg-white hover:bg-amber-50 active:bg-amber-100",
        "border border-gray-200 hover:border-amber-300",
        "rounded-lg text-sm text-gray-700 font-medium",
        "shadow-sm transition-all duration-150",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        isLoading && "bg-amber-50 border-amber-300 text-amber-700",
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
