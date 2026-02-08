'use client';

import React, { useEffect } from 'react';
import { AuthProvider } from './auth/auth-provider';
import { Toaster } from './ui/sonner';
import { ErrorBoundary } from './ErrorBoundary';

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

export function AppProviders({ children }: { children: React.ReactNode }) {
  useAnimationPreference();

  return (
    <ErrorBoundary>
      <AuthProvider>
        {children}
        <Toaster />
      </AuthProvider>
    </ErrorBoundary>
  );
}
