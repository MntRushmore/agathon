'use client';

import { useState, useRef, useEffect } from 'react';
import { Sparkles, Video, Layers, ClipboardList } from 'lucide-react';
import { QuickActionPill } from './QuickActionPill';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface JournalEditorProps {
  content: string;
  onContentChange: (content: string) => void;
  showQuickActions?: boolean;
}

export function JournalEditor({
  content,
  onContentChange,
  showQuickActions = true,
}: JournalEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [content]);

  const handleQuickAction = (action: string) => {
    toast.info(`${action} is coming soon!`);
  };

  const quickActions = [
    {
      icon: <Sparkles className="h-4 w-4" />,
      label: 'Ask Feynman to teach you',
      variant: 'green' as const,
      action: 'Feynman Method',
    },
    {
      icon: <Video className="h-4 w-4" />,
      label: 'Generate a video',
      variant: 'pink' as const,
      action: 'Video Generation',
    },
    {
      icon: <Layers className="h-4 w-4" />,
      label: 'Study with flashcards',
      variant: 'blue' as const,
      action: 'Flashcards',
    },
    {
      icon: <ClipboardList className="h-4 w-4" />,
      label: 'Create practice problems',
      variant: 'orange' as const,
      action: 'Practice Problems',
    },
  ];

  const isEmpty = !content || content.trim() === '';

  return (
    <div className="flex flex-col h-full">
      {/* Editor area */}
      <div className="flex-1 relative">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder='Start writing or type "/" to see commands...'
          className={cn(
            'w-full h-full min-h-[200px] p-0 resize-none',
            'text-base leading-relaxed',
            'bg-transparent border-none outline-none',
            'text-gray-900 placeholder:text-gray-400',
            'focus:ring-0 focus:outline-none'
          )}
          style={{
            fontSize: '16px',
            lineHeight: '1.6',
          }}
        />
      </div>

      {/* Quick actions - show when editor is empty or focused */}
      {showQuickActions && isEmpty && (
        <div className="mt-8 pt-6 border-t border-gray-100">
          <p className="text-sm font-medium text-gray-500 mb-4">Start with</p>
          <div className="flex flex-wrap gap-3">
            {quickActions.map((action) => (
              <QuickActionPill
                key={action.action}
                icon={action.icon}
                label={action.label}
                variant={action.variant}
                onClick={() => handleQuickAction(action.action)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
