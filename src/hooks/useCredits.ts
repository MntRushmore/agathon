import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/auth/auth-provider';

interface CreditState {
  balance: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  hasCredits: boolean;
  isLow: boolean;
}

export function useCredits(): CreditState {
  const { profile } = useAuth();
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/credits/balance');
      if (!res.ok) {
        throw new Error('Failed to fetch credits');
      }
      const data = await res.json();
      setBalance(data.balance);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch credits');
      // Fall back to profile value if available
      if (profile?.credits !== undefined) {
        setBalance(profile.credits);
      }
    } finally {
      setLoading(false);
    }
  }, [profile]);

  // Initialize from profile
  useEffect(() => {
    if (profile?.credits !== undefined) {
      setBalance(profile.credits);
      setLoading(false);
    }
  }, [profile]);

  // Fetch fresh data on mount
  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    balance,
    loading,
    error,
    refresh,
    hasCredits: balance > 0,
    isLow: balance < 10,
  };
}
