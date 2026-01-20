"use client";

import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, ExternalLink, Gauge, Home } from 'lucide-react';

export default function BillingSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const checkoutId = searchParams.get('checkout_id') || searchParams.get('id');
  const products = searchParams.get('products');

  return (
    <div className="min-h-screen bg-gradient-to-b from-[oklch(0.97_0.01_210)] via-background to-background flex items-center justify-center px-4 py-16">
      <Card className="w-full max-w-2xl">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <CheckCircle2 className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-2xl">Checkout complete</CardTitle>
          <CardDescription>
            Thanks for upgrading. We&apos;re syncing your plan now—usage tracking stays continuous.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          {checkoutId && (
            <div className="rounded-lg border border-border p-3 bg-muted/50">
              <p className="font-medium text-foreground">Checkout reference</p>
              <p className="text-xs mt-1">{checkoutId}</p>
            </div>
          )}
          {products && (
            <p className="text-xs">
              Product: <span className="text-foreground">{products}</span>
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button className="gap-2" onClick={() => router.push('/billing')}>
              <Gauge className="h-4 w-4" />
              View usage
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => router.push('/')}>
              <Home className="h-4 w-4" />
              Back to boards
            </Button>
          </div>
          <div className="rounded-lg border border-dashed border-border p-3 flex items-start gap-3">
            <ExternalLink className="h-4 w-4 mt-0.5 text-primary" />
            <p>
              Need to adjust your plan? Re-run checkout from the billing page or contact support with your
              checkout reference.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
