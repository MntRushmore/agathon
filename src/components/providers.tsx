'use client';

import { AuthProvider } from './auth/auth-provider';
import { Toaster } from './ui/sonner';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {children}
      <Toaster />
    </AuthProvider>
  );
}
