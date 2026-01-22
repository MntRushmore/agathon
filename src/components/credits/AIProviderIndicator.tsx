'use client';

import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AIProviderIndicatorProps {
  provider: 'vertex' | 'hackclub';
  className?: string;
}

export function AIProviderIndicator({ provider, className }: AIProviderIndicatorProps) {
  const isPremium = provider === 'vertex';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant={isPremium ? 'default' : 'secondary'}
            className={cn('gap-1 text-xs', className)}
          >
            {isPremium ? (
              <>
                <Eye className="h-3 w-3" />
                Vision AI
              </>
            ) : (
              <>
                <EyeOff className="h-3 w-3" />
                Text AI
              </>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          {isPremium ? (
            <p>Premium AI with image understanding (uses credits)</p>
          ) : (
            <p>Free text-only AI (no image support)</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
