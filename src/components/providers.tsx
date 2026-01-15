'use client';

import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './auth/auth-provider';
import { Toaster } from './ui/sonner';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        {children}
        <Toaster />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
