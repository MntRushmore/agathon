'use client';

import { Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GoDeepButtonProps {
  onClick: () => void;
  className?: string;
  isOpen?: boolean;
}

export function GoDeepButton({ onClick, className, isOpen }: GoDeepButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-2",
        "bg-white hover:bg-gray-50 active:bg-gray-100",
        "border border-gray-200 hover:border-gray-300",
        "rounded-lg text-sm text-gray-700 font-medium",
        "shadow-sm transition-all duration-150",
        isOpen && "bg-violet-50 border-violet-300 text-violet-700",
        className
      )}
    >
      <Lightbulb className={cn("w-4 h-4", isOpen && "text-violet-600")} />
      <span className="hidden sm:inline">Go Deeper</span>
    </button>
  );
}
