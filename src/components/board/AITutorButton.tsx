'use client';

import { MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AITutorButtonProps {
  onClick: () => void;
  isOpen: boolean;
  messageCount?: number;
  className?: string;
}

export function AITutorButton({ onClick, isOpen, messageCount = 0, className }: AITutorButtonProps) {
  if (isOpen) return null;

  return (
    <button
      onClick={onClick}
      className={cn(
        'no-enlarge h-9 rounded-xl px-3',
        'inline-flex items-center gap-1.5',
        'bg-white text-gray-600 border border-gray-200/80',
        'shadow-[0_1px_4px_rgba(0,0,0,0.06)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)]',
        'hover:border-gray-300/60',
        'transition-all duration-150 active:scale-[0.97]',
        className
      )}
      aria-label="Open AI Tutor"
      data-tutorial="chat-button"
    >
      <MessageCircle className="h-4 w-4 text-[#007ba5]" />
      <span className="text-sm font-medium hidden sm:inline">AI Tutor</span>
      {messageCount > 0 && (
        <span className="ml-0.5 h-4 min-w-[16px] rounded-full bg-[#007ba5] text-white text-[10px] font-medium flex items-center justify-center px-1">
          {messageCount > 9 ? '9+' : messageCount}
        </span>
      )}
    </button>
  );
}
