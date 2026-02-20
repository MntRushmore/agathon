'use client';

import React, { useEffect } from 'react';
import { AuthProvider } from './auth/auth-provider';
import { Toaster } from 'sileo';
import { ErrorBoundary } from './ErrorBoundary';
import { CommandPalette } from './CommandPalette';
import { ImpersonationBar } from './admin/ImpersonationBar';

function useAnimationPreference() {
  useEffect(() => {
    const sync = () => {
      const off = localStorage.getItem('agathon_pref_animations') === 'off';
      document.body.classList.toggle('reduce-motion', off);
    };
    sync();
    window.addEventListener('storage', sync);
    // Also listen for same-tab changes via a custom event
    window.addEventListener('agathon-pref-change', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('agathon-pref-change', sync);
    };
  }, []);
}

function useThemePreference() {
  React.useEffect(() => {
    const el = document.documentElement

    const apply = () => {
      const pref = localStorage.getItem('agathon_theme') || 'system'
      if (pref === 'dark') {
        el.classList.add('dark')
      } else if (pref === 'light') {
        el.classList.remove('dark')
      } else {
        const mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)')
        if (mq && mq.matches) el.classList.add('dark')
        else el.classList.remove('dark')
      }
    }

    apply()

    const mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => apply()
    mq?.addEventListener?.('change', onChange)
    window.addEventListener('storage', onChange)
    window.addEventListener('agathon-pref-change', onChange)

    return () => {
      mq?.removeEventListener?.('change', onChange)
      window.removeEventListener('storage', onChange)
      window.removeEventListener('agathon-pref-change', onChange)
    }
  }, [])
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  useAnimationPreference();
  useThemePreference();

  return (
    <ErrorBoundary>
      <AuthProvider>
        <ImpersonationBar />
        {children}
        <Toaster options={{ fill: '#1a1a1a', duration: 2000 }} />
        <CommandPalette />
      </AuthProvider>
    </ErrorBoundary>
  );
}
