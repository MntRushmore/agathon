"use client";

import React from 'react';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';

type Props = { children: React.ReactNode };

type State = { hasError: boolean };

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    logger.error({ error, info }, 'Unhandled React error');
    try {
      toast.error('Something went wrong. Reload to continue.');
    } catch (e) {
      // ignore toast failures
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="max-w-lg text-center">
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-sm text-muted-foreground mb-4">An unexpected error occurred. You can try reloading the page.</p>
            <div className="flex justify-center gap-2">
              <button
                className="px-4 py-2 bg-[#1a1a1a] text-white rounded-md"
                onClick={() => window.location.reload()}
              >
                Reload
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
