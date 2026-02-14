'use client';

import { useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function AdminPlanToggle() {
  const { isAdmin, profile, refreshProfile } = useAuth();
  const [updating, setUpdating] = useState(false);

  if (!isAdmin) return null;

  const isPremium = profile?.plan_tier === 'premium' || profile?.plan_tier === 'enterprise';

  const toggle = async () => {
    if (!profile?.id || updating) return;
    setUpdating(true);
    const nextTier = isPremium ? 'free' : 'premium';
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('profiles')
        .update({
          plan_tier: nextTier,
          plan_status: nextTier === 'premium' ? 'active' : null,
          plan_expires_at: nextTier === 'premium'
            ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
            : null,
        })
        .eq('id', profile.id);
      if (error) throw error;
      await refreshProfile();
      toast.success(nextTier === 'premium' ? 'Switched to Enterprise' : 'Switched to Free');
    } catch {
      toast.error('Failed to update plan');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={updating}
      className={cn(
        'no-enlarge px-2.5 py-1 rounded text-[11px] font-medium',
        'border transition-colors disabled:opacity-50',
        isPremium
          ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
          : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
      )}
      title="Admin: click to toggle plan"
    >
      {updating ? '...' : isPremium ? 'Enterprise' : 'Free'}
    </button>
  );
}
