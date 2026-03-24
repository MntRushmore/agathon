'use client';

import { useState } from 'react';
import { X } from '@phosphor-icons/react';

const BANNER_DISMISSED_KEY = 'agathon_design_banner_dismissed';

export function DesignUpgradeBanner() {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem(BANNER_DISMISSED_KEY) === 'true';
  });

  if (dismissed) return null;

  return (
    <div
      className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm border-b border-border"
      style={{ backgroundColor: '#F5F8F7', fontFamily: 'Manrope, sans-serif', color: '#06313A' }}
    >
      <p>
        <span className="font-medium">Design upgrade in progress</span>
        <span style={{ color: 'rgba(6, 49, 58, 0.6)' }}> — This page will be getting a fresh look in a few days. Stay tuned!</span>
      </p>
      <button
        onClick={() => {
          setDismissed(true);
          localStorage.setItem(BANNER_DISMISSED_KEY, 'true');
        }}
        className="p-1 rounded-md hover:bg-muted transition-colors flex-shrink-0"
      >
        <X size={14} style={{ color: 'rgba(6, 49, 58, 0.4)' }} />
      </button>
    </div>
  );
}
