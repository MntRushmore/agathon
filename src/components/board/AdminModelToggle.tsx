'use client';

import { useAuth } from '@/components/auth/auth-provider';
import { cn } from '@/lib/utils';

export type ImageModel = 'pro' | 'flash';

interface AdminModelToggleProps {
  model: ImageModel;
  onModelChange: (model: ImageModel) => void;
}

export function AdminModelToggle({ model, onModelChange }: AdminModelToggleProps) {
  const { isAdmin } = useAuth();

  if (!isAdmin) return null;

  const isFlash = model === 'flash';

  return (
    <button
      onClick={() => onModelChange(isFlash ? 'pro' : 'flash')}
      className={cn(
        'no-enlarge px-2.5 py-1 rounded text-[11px] font-medium',
        'border transition-colors',
        isFlash
          ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
          : 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100'
      )}
      title="Admin: click to switch image generation model"
    >
      {isFlash ? 'Flash' : 'Pro'}
    </button>
  );
}
