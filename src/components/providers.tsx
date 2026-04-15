'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { AuthProvider } from './auth/auth-provider';
import { Toaster } from 'sileo';
import { ErrorBoundary } from './ErrorBoundary';
import { CommandPalette } from './CommandPalette';
import { ImpersonationBar } from './admin/ImpersonationBar';
import { SettingsDialog } from './ui/settings-dialog';

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

function useGlobalShortcuts(onOpenSettings: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // ⌘, → open settings
      if (e.key === ',' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenSettings();
      }
    };
    // Custom event from anywhere in the app (e.g. command palette)
    const onEvent = () => onOpenSettings();
    window.addEventListener('keydown', onKey);
    window.addEventListener('agathon-open-settings', onEvent);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('agathon-open-settings', onEvent);
    };
  }, [onOpenSettings]);
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  useAnimationPreference();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  useGlobalShortcuts(openSettings);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <ImpersonationBar />
        {children}
        <Toaster options={{ fill: '#1a1a1a', duration: 2000 }} />
        <CommandPalette />
        <SettingsDialog open={settingsOpen} onClose={closeSettings} />
      </AuthProvider>
    </ErrorBoundary>
  );
}
