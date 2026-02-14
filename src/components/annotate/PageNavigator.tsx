'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageNavigatorProps {
  currentPage: number; // 0-indexed
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function PageNavigator({ currentPage, totalPages, onPageChange }: PageNavigatorProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[var(--z-toolbar)]">
      <div className="flex items-center gap-1 bg-white/95 backdrop-blur-xl shadow-[0_2px_20px_rgba(0,0,0,0.08)] border border-gray-200/50 rounded-full px-2 py-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 0}
          className={cn(
            'w-8 h-8 flex items-center justify-center rounded-full transition-all duration-150',
            'active:scale-[0.92] touch-manipulation no-enlarge',
            currentPage === 0
              ? 'text-gray-300 cursor-not-allowed'
              : 'text-gray-500 hover:bg-gray-100'
          )}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <span className="text-sm font-medium text-gray-600 px-2 min-w-[60px] text-center tabular-nums select-none">
          {currentPage + 1} / {totalPages}
        </span>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages - 1}
          className={cn(
            'w-8 h-8 flex items-center justify-center rounded-full transition-all duration-150',
            'active:scale-[0.92] touch-manipulation no-enlarge',
            currentPage === totalPages - 1
              ? 'text-gray-300 cursor-not-allowed'
              : 'text-gray-500 hover:bg-gray-100'
          )}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
