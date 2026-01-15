'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sparkles, MessageCircle, Lightbulb, CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export type AIHelpMode = 'feedback' | 'suggest' | 'answer';

interface AIHelpButtonProps {
  onRequestHelp: (mode: AIHelpMode) => Promise<boolean>;
  allowedModes?: AIHelpMode[];
  disabled?: boolean;
  hintLimit?: number;
  currentHintCount?: number;
  className?: string;
}

const modeConfig = {
  feedback: {
    label: 'Get Feedback',
    description: 'Light hints pointing out where to look',
    icon: MessageCircle,
    color: 'text-blue-600',
  },
  suggest: {
    label: 'Get Suggestion',
    description: 'Guided hints for the next step',
    icon: Lightbulb,
    color: 'text-amber-600',
  },
  answer: {
    label: 'Solve It',
    description: 'Full worked solution',
    icon: CheckCircle,
    color: 'text-green-600',
  },
};

export function AIHelpButton({
  onRequestHelp,
  allowedModes = ['feedback', 'suggest', 'answer'],
  disabled = false,
  hintLimit,
  currentHintCount = 0,
  className,
}: AIHelpButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMode, setLoadingMode] = useState<AIHelpMode | null>(null);

  const handleModeSelect = useCallback(async (mode: AIHelpMode) => {
    if (hintLimit !== undefined && currentHintCount >= hintLimit) {
      toast.error(`You've reached the hint limit (${hintLimit}) for this assignment`);
      return;
    }

    setIsLoading(true);
    setLoadingMode(mode);

    try {
      const success = await onRequestHelp(mode);
      if (success) {
        toast.success(`${modeConfig[mode].label} added to canvas`);
      }
    } catch (error) {
      console.error('AI help error:', error);
      toast.error('Failed to get AI help');
    } finally {
      setIsLoading(false);
      setLoadingMode(null);
    }
  }, [onRequestHelp, hintLimit, currentHintCount]);

  const hasHintLimit = hintLimit !== undefined && hintLimit > 0;
  const hintsRemaining = hasHintLimit ? Math.max(0, hintLimit - currentHintCount) : null;
  const isLimitReached = hasHintLimit && hintsRemaining === 0;

  if (allowedModes.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="default"
          size="lg"
          className={`gap-2 shadow-lg ${className}`}
          disabled={disabled || isLoading || isLimitReached}
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Sparkles className="h-5 w-5" />
          )}
          <span className="font-medium">
            {isLoading ? 'Getting Help...' : 'AI Help'}
          </span>
          {hintsRemaining !== null && (
            <span className="ml-1 text-xs opacity-75">
              ({hintsRemaining} left)
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Choose Help Level</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {allowedModes.includes('feedback') && (
          <DropdownMenuItem
            onClick={() => handleModeSelect('feedback')}
            disabled={loadingMode !== null}
            className="flex items-start gap-3 py-3 cursor-pointer"
          >
            <MessageCircle className={`h-5 w-5 mt-0.5 ${modeConfig.feedback.color}`} />
            <div className="flex-1">
              <div className="font-medium">{modeConfig.feedback.label}</div>
              <div className="text-xs text-muted-foreground">
                {modeConfig.feedback.description}
              </div>
            </div>
            {loadingMode === 'feedback' && <Loader2 className="h-4 w-4 animate-spin" />}
          </DropdownMenuItem>
        )}
        {allowedModes.includes('suggest') && (
          <DropdownMenuItem
            onClick={() => handleModeSelect('suggest')}
            disabled={loadingMode !== null}
            className="flex items-start gap-3 py-3 cursor-pointer"
          >
            <Lightbulb className={`h-5 w-5 mt-0.5 ${modeConfig.suggest.color}`} />
            <div className="flex-1">
              <div className="font-medium">{modeConfig.suggest.label}</div>
              <div className="text-xs text-muted-foreground">
                {modeConfig.suggest.description}
              </div>
            </div>
            {loadingMode === 'suggest' && <Loader2 className="h-4 w-4 animate-spin" />}
          </DropdownMenuItem>
        )}
        {allowedModes.includes('answer') && (
          <DropdownMenuItem
            onClick={() => handleModeSelect('answer')}
            disabled={loadingMode !== null}
            className="flex items-start gap-3 py-3 cursor-pointer"
          >
            <CheckCircle className={`h-5 w-5 mt-0.5 ${modeConfig.answer.color}`} />
            <div className="flex-1">
              <div className="font-medium">{modeConfig.answer.label}</div>
              <div className="text-xs text-muted-foreground">
                {modeConfig.answer.description}
              </div>
            </div>
            {loadingMode === 'answer' && <Loader2 className="h-4 w-4 animate-spin" />}
          </DropdownMenuItem>
        )}
        {hasHintLimit && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              {hintsRemaining} of {hintLimit} hints remaining
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
