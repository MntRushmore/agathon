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
        'fixed bottom-6 right-4 z-[1050] h-9 rounded-full px-3.5',
        'inline-flex items-center gap-1.5',
        'bg-white text-gray-700 border border-gray-200',
        'shadow-sm hover:shadow hover:border-gray-300',
        'transition-colors duration-150',
        'ios-safe-right ios-safe-bottom',
        className
      )}
      aria-label="Open AI Tutor"
      data-tutorial="chat-button"
    >
      <MessageCircle className="h-4 w-4 text-violet-500" />
      <span className="text-sm font-medium">AI Tutor</span>
      {messageCount > 0 && (
        <span className="ml-0.5 h-4 min-w-[16px] rounded-full bg-violet-500 text-white text-[10px] font-medium flex items-center justify-center px-1">
          {messageCount > 9 ? '9+' : messageCount}
        </span>
      )}
    </button>
  );
}
