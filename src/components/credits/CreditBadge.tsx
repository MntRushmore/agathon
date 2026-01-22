'use client';

import { useEffect, useState } from 'react';
import { Coins, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/auth/auth-provider';

interface CreditBadgeProps {
  className?: string;
  showWarning?: boolean;
}

export function CreditBadge({ className, showWarning = true }: CreditBadgeProps) {
  const { profile } = useAuth();
  const [credits, setCredits] = useState<number | null>(null);

  useEffect(() => {
    if (profile?.credits !== undefined) {
      setCredits(profile.credits);
    }
  }, [profile]);

  // Also fetch from API to get latest value
  useEffect(() => {
    fetch('/api/credits/balance')
      .then(res => res.json())
      .then(data => {
        if (data.balance !== undefined) {
          setCredits(data.balance);
        }
      })
      .catch(() => {
        // Use profile value as fallback
      });
  }, []);

  if (credits === null) return null;

  const isLow = credits < 10;

  return (
    <Badge
      variant={isLow ? 'destructive' : 'secondary'}
      className={cn('gap-1 cursor-pointer', className)}
    >
      {isLow && showWarning ? (
        <AlertTriangle className="h-3 w-3" />
      ) : (
        <Coins className="h-3 w-3" />
      )}
      {credits} credits
    </Badge>
  );
}
