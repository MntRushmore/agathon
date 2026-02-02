'use client';

import React from 'react';
import { AuthProvider } from './auth/auth-provider';
import { Toaster } from './ui/sonner';
import { ErrorBoundary } from './ErrorBoundary';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <AuthProvider>
        {children}
        <Toaster />
      </AuthProvider>
    </ErrorBoundary>
  );
}
