"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  ArrowLeft,
  Check,
  Sparkles,
  Zap,
  Crown,
  Loader2,
  Coins,
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
  popular?: boolean;
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
    description: 'Perfect for getting started',
    monthlyInteractions: 50,
    productId: process.env.NEXT_PUBLIC_POLAR_PRODUCT_FREE_ID?.trim(),
    features: [
      '50 AI assists per month',
      'Unlimited boards',
      'Export your work',
      'Email support',
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '$12',
    interval: 'month',
    description: 'For serious learners',
    popular: true,
    monthlyInteractions: 500,
    productId: process.env.NEXT_PUBLIC_POLAR_PRODUCT_PREMIUM_ID?.trim(),
    features: [
      '500 AI assists per month',
      'Priority processing',
      'Advanced analytics',
      'Live chat support',
    ],
  },
];

export default function BillingPage() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(true);
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
      try {
        const res = await fetch('/api/usage/summary', { cache: 'no-store' });
        if (res.status === 401) {
          setUsage(null);
          return;
        }
        const data = await res.json();
        if (!data.error) {
          setUsage(data);
        }
      } catch (err) {
        logger.error({ err }, 'Failed to load usage');
        try { toast.error('Failed to load usage. Please try again.'); } catch (e) {}
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

    if (!plan.productId) return;

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

  const remainingAssists = useMemo(() => {
    if (!usage || !activePlan.monthlyInteractions) return null;
    return Math.max(0, activePlan.monthlyInteractions - usage.totalInteractions);
  }, [usage, activePlan.monthlyInteractions]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[oklch(0.97_0.01_210)] via-background to-background">
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">
        {/* Header */}
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
            <h1 className="text-3xl font-semibold">Plans & Billing</h1>
            <p className="text-muted-foreground">
              Manage your subscription and track your usage
            </p>
          </div>
        </div>

        {/* Current Usage Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {activePlan.name} Plan
                  {activePlan.id === 'premium' && (
                    <Crown className="h-4 w-4 text-amber-500" />
                  )}
                </CardTitle>
                <CardDescription>
                  {loadingUsage ? (
                    'Loading usage...'
                  ) : usage ? (
                    `${remainingAssists} assists remaining this month`
                  ) : (
                    'Sign in to see your usage'
                  )}
                </CardDescription>
              </div>
              {usage && activePlan.monthlyInteractions && (
                <div className="text-right">
                  <span className="text-3xl font-bold">
                    {usage.totalInteractions}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {' '}/ {activePlan.monthlyInteractions}
                  </span>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!loadingUsage && usage && activePlan.monthlyInteractions && (
              <div className="space-y-2">
                <Progress value={usageProgress} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  Resets in {usage.windowStart ? formatDistanceToNow(new Date(new Date(usage.windowStart).getTime() + 30 * 24 * 60 * 60 * 1000)) : '30 days'}
                </p>
              </div>
            )}
            {loadingUsage && (
              <div className="h-2 bg-muted rounded-full animate-pulse" />
            )}
          </CardContent>
        </Card>

        {/* Plans */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Choose your plan</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {plans.map((plan) => {
              const isCurrentPlan = activePlan.id === plan.id;

              return (
                <Card
                  key={plan.id}
                  className={`relative ${plan.popular ? 'border-primary shadow-md' : ''}`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-6">
                      <Badge className="gap-1">
                        <Sparkles className="h-3 w-3" />
                        Popular
                      </Badge>
                    </div>
                  )}

                  <CardHeader>
                    <CardTitle>{plan.name}</CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    <div>
                      <span className="text-3xl font-bold">{plan.price}</span>
                      <span className="text-muted-foreground text-sm">
                        /{plan.interval}
                      </span>
                    </div>

                    <ul className="space-y-2.5">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2.5">
                          <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      onClick={() => startCheckout(plan)}
                      disabled={checkoutLoading === plan.id || !plan.productId || isCurrentPlan}
                      variant={plan.popular ? 'default' : 'outline'}
                      className="w-full"
                    >
                      {checkoutLoading === plan.id ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Redirecting...
                        </>
                      ) : isCurrentPlan ? (
                        'Current plan'
                      ) : plan.productId ? (
                        plan.popular ? 'Upgrade now' : 'Get started'
                      ) : (
                        'Coming soon'
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Credits CTA */}
        <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold flex items-center gap-2">
                  <Coins className="h-5 w-5 text-purple-600" />
                  Need more AI credits?
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Purchase credit packs for premium AI features like image understanding
                </p>
              </div>
              <Button variant="outline" onClick={() => router.push('/credits')}>
                Buy Credits
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        {usage && usage.recent.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Recent Activity
              </CardTitle>
              <CardDescription>Your latest AI interactions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {usage.recent.slice(0, 5).map((row, idx) => (
                  <div
                    key={`${row.createdAt}-${idx}`}
                    className="flex items-center justify-between py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                        <Zap className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium capitalize">
                          {row.mode || 'AI Assist'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {row.createdAt
                            ? formatDistanceToNow(new Date(row.createdAt), { addSuffix: true })
                            : 'Recently'}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {row.tokens.toLocaleString()} tokens
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          Payments are securely processed by Polar. Cancel anytime.
        </p>
      </div>
    </div>
  );
}
