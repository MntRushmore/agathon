"use client";

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Coins, Home, Sparkles } from 'lucide-react';

export default function CreditsSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { refreshCredits, credits } = useAuth();
  const [refreshing, setRefreshing] = useState(true);
  const initialCredits = useRef(credits);

  const checkoutId = searchParams.get('checkout_id') || searchParams.get('id');

  useEffect(() => {
    // Poll for credit update — webhook may take a moment to process
    let cancelled = false;
    const maxAttempts = 5;
    let attempt = 0;

    const poll = async () => {
      setRefreshing(true);
      while (!cancelled && attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        if (cancelled) break;
        await refreshCredits();
        attempt++;
      }
      if (!cancelled) setRefreshing(false);
    };
    poll();

    return () => { cancelled = true; };
  }, [refreshCredits]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[oklch(0.97_0.01_210)] via-background to-background flex items-center justify-center px-4 py-16">
      <Card className="w-full max-w-2xl">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="h-7 w-7 text-green-600" />
          </div>
          <CardTitle className="text-2xl">Credits purchased!</CardTitle>
          <CardDescription>
            Your credits have been added to your account. Start using AI-powered features right away.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Balance */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-center">
            <p className="text-sm text-muted-foreground">Current Balance</p>
            <p className="text-4xl font-bold text-primary mt-1">
              {refreshing ? '...' : credits}
            </p>
            <p className="text-sm text-muted-foreground mt-1">credits available</p>
          </div>

          {checkoutId && (
            <div className="rounded-lg border border-border p-3 bg-muted/50">
              <p className="font-medium text-foreground text-sm">Order reference</p>
              <p className="text-xs text-muted-foreground mt-1">{checkoutId}</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button className="gap-2" onClick={() => router.push('/credits')}>
              <Coins className="h-4 w-4" />
              View credits
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => router.push('/')}>
              <Home className="h-4 w-4" />
              Back to boards
            </Button>
          </div>

          <div className="rounded-lg border border-dashed border-border p-3 flex items-start gap-3">
            <Sparkles className="h-4 w-4 mt-0.5 text-primary" />
            <p className="text-sm text-muted-foreground">
              Credits are used for AI features like image understanding, handwriting recognition,
              and visual feedback. Most features use 1 credit per use.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
