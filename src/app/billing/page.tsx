"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/components/auth/auth-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  CreditCard,
  Gauge,
  Shield,
  Sparkles,
  Zap,
} from 'lucide-react';

type UsageSummary = {
  totalInteractions: number;
  tokensUsed: number;
  totalCost: number;
  modeBreakdown: Record<string, number>;
  recent: {
    mode: string | null;
    createdAt: string | null;
    summary: string | null;
    tokens: number;
  }[];
  windowStart: string;
  lastUsedAt: string | null;
};

type Plan = {
  id: string;
  name: string;
  price: string;
  interval: string;
  description: string;
  badge?: string;
  highlight?: boolean;
  monthlyInteractions?: number;
  productId?: string;
  features: string[];
};

const plans: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    interval: 'forever',
    description: 'Get started with AI-powered learning at no cost.',
    monthlyInteractions: 50,
    productId: process.env.NEXT_PUBLIC_POLAR_PRODUCT_FREE_ID,
    features: [
      '50 AI assists each month',
      'Personal boards + exports',
      'Email support',
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '$12',
    interval: 'month',
    description: 'Unlock unlimited AI assistance and premium features.',
    badge: 'Most popular',
    highlight: true,
    monthlyInteractions: 500,
    productId: process.env.NEXT_PUBLIC_POLAR_PRODUCT_PREMIUM_ID,
    features: [
      '500 AI assists per month',
      'Priority AI queue + faster OCR',
      'Usage analytics export',
      'Live chat support',
    ],
  },
];

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function BillingPage() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(true);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  const activePlan = useMemo(() => {
    const planTier = profile?.plan_tier || 'free';
    return plans.find((plan) => plan.id === planTier) || plans[0];
  }, [profile]);

  useEffect(() => {
    if (!user) {
      setLoadingUsage(false);
      setUsage(null);
      return;
    }

    const loadUsage = async () => {
      setLoadingUsage(true);
      setUsageError(null);
      try {
        const res = await fetch('/api/usage/summary', { cache: 'no-store' });
        if (res.status === 401) {
          setUsage(null);
          return;
        }
        const data = await res.json();
        if (data.error) {
          setUsageError('Unable to load usage right now.');
        } else {
          setUsage(data);
        }
      } catch (err) {
        console.error('Failed to load usage', err);
        setUsageError('Unable to load usage right now.');
      } finally {
        setLoadingUsage(false);
      }
    };

    loadUsage();
  }, [user]);

  const startCheckout = (plan: Plan) => {
    if (!user) {
      router.push('/?auth=required');
      return;
    }

    if (!plan.productId) {
      setUsageError('Add a Polar product ID in your env to start checkout.');
      return;
    }

    const params = new URLSearchParams();
    params.set('products', plan.productId);
    params.set('customerExternalId', user.id);
    if (user.email) params.set('customerEmail', user.email);
    if (profile?.full_name) params.set('customerName', profile.full_name);

    setCheckoutLoading(plan.id);
    window.location.href = `/api/polar/checkout?${params.toString()}`;
  };

  const usageProgress = useMemo(() => {
    if (!usage || !activePlan.monthlyInteractions) return 0;
    const pct = Math.round(
      (usage.totalInteractions / activePlan.monthlyInteractions) * 100,
    );
    return Math.min(100, pct);
  }, [usage, activePlan.monthlyInteractions]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[oklch(0.97_0.01_210)] via-background to-background">
      <div className="max-w-6xl mx-auto px-6 py-12 space-y-8">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="rounded-full"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              Plans & Usage
            </div>
            <h1 className="text-3xl font-semibold mt-3">Stay on top of your AI usage</h1>
            <p className="text-muted-foreground mt-1">
              Upgrade with Polar checkout and keep an eye on how many assists you&apos;ve used this month.
            </p>
          </div>
        </div>

        {usageError && (
          <Card className="border-destructive/30">
            <CardContent className="py-3 text-sm text-destructive">
              {usageError}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={`relative overflow-hidden ${plan.highlight ? 'border-primary/40 shadow-lg shadow-primary/10' : ''}`}
            >
              {plan.badge && (
                <div className="absolute right-3 top-3">
                  <Badge className="bg-primary text-primary-foreground shadow-sm">
                    {plan.badge}
                  </Badge>
                </div>
              )}
              <CardHeader className="space-y-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  {activePlan.id === plan.id && (
                    <Badge variant="outline" className="gap-1 text-xs">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Current plan
                    </Badge>
                  )}
                </div>
                <CardDescription>{plan.description}</CardDescription>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-semibold">{plan.price}</span>
                  <span className="text-muted-foreground text-sm">/ {plan.interval}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-center gap-2 text-sm text-foreground">
                      <Shield className="h-4 w-4 text-primary" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
                <Button
                  className="w-full"
                  disabled={checkoutLoading === plan.id || !plan.productId}
                  onClick={() => startCheckout(plan)}
                  variant={plan.highlight ? 'default' : 'outline'}
                >
                  {checkoutLoading === plan.id
                    ? 'Redirecting...'
                    : plan.productId
                      ? 'Start checkout'
                      : 'Add product ID'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Monthly usage
                </CardTitle>
                <CardDescription>
                  From {usage?.windowStart ? new Date(usage.windowStart).toLocaleDateString() : 'the last 30 days'}
                </CardDescription>
              </div>
              {activePlan.monthlyInteractions && (
                <Badge variant="outline" className="gap-1">
                  <Gauge className="h-4 w-4" />
                  {usage ? `${usage.totalInteractions}/${activePlan.monthlyInteractions} assists` : 'Usage loading'}
                </Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              {loadingUsage ? (
                <div className="h-24 bg-muted rounded-lg animate-pulse" />
              ) : !usage ? (
                <p className="text-sm text-muted-foreground">
                  Sign in to see your usage.
                </p>
              ) : (
                <>
                  {activePlan.monthlyInteractions && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Assists used</span>
                        <span className="font-medium">
                          {usage.totalInteractions} / {activePlan.monthlyInteractions}
                        </span>
                      </div>
                      <Progress value={usageProgress} />
                      <p className="text-xs text-muted-foreground">
                        {usageProgress >= 95
                          ? 'Almost at your monthly cap. Consider upgrading to keep AI responses quick.'
                          : 'Usage resets every 30 days.'}
                      </p>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="rounded-lg border border-border p-4">
                      <p className="text-xs text-muted-foreground">Total assists</p>
                      <p className="text-2xl font-semibold mt-1">{usage.totalInteractions}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Last used {usage.lastUsedAt ? formatDistanceToNow(new Date(usage.lastUsedAt), { addSuffix: true }) : 'N/A'}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border p-4">
                      <p className="text-xs text-muted-foreground">Tokens processed</p>
                      <p className="text-2xl font-semibold mt-1">
                        {usage.tokensUsed.toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Input + output</p>
                    </div>
                    <div className="rounded-lg border border-border p-4">
                      <p className="text-xs text-muted-foreground">Estimated cost</p>
                      <p className="text-2xl font-semibold mt-1">
                        {currency.format(usage.totalCost)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Based on tracked sessions</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-3">Recent activity</p>
                    {usage.recent.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No AI usage yet this month.</p>
                    ) : (
                      <div className="space-y-2">
                        {usage.recent.map((row, idx) => (
                          <div
                            key={`${row.createdAt}-${idx}`}
                            className="flex items-center justify-between rounded-lg border border-border p-3"
                          >
                            <div className="flex items-center gap-3">
                              <span className="h-9 w-9 inline-flex items-center justify-center rounded-full bg-primary/10 text-primary">
                                <Zap className="h-4 w-4" />
                              </span>
                              <div>
                                <p className="font-medium text-sm capitalize">
                                  {row.mode || 'Unknown mode'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {row.createdAt
                                    ? formatDistanceToNow(new Date(row.createdAt), { addSuffix: true })
                                    : 'Time unavailable'}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium">{row.tokens.toLocaleString()} tokens</p>
                              <p className="text-xs text-muted-foreground max-w-xs truncate">
                                {row.summary || 'No summary captured'}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-b from-primary/10 via-background to-background border-primary/30">
            <CardHeader className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                How Polar checkout works
              </CardTitle>
              <CardDescription>
                We use Polar to power plan upgrades securely. Use the checkout link above to confirm your plan.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-foreground">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Fast checkout</p>
                  <p className="text-muted-foreground">
                    We prefill your email so your receipt and portal match your account.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Secure billing</p>
                  <p className="text-muted-foreground">
                    Payments run through Polar&apos;s PCI-compliant checkout with optional sandbox testing.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Zap className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Usage stays tracked</p>
                  <p className="text-muted-foreground">
                    Every assist is logged to your account so limits remain accurate after upgrading.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
