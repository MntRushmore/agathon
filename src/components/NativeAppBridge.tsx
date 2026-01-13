'use client';

import { useEffect } from 'react';
import { setupNativeAppBridge, isNativeApp } from '@/lib/platform';

/**
 * Component that sets up the bridge between web app and native wrapper
 * Must be a client component to access window object
 */
export function NativeAppBridge() {
  useEffect(() => {
    // Setup native app bridge
    setupNativeAppBridge();

    // Log native app status
    if (isNativeApp()) {
      console.log('Running in native app wrapper');
    }
  }, []);

  // This component doesn't render anything
  return null;
}
