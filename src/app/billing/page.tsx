"use client";

export const metadata = {
  title: 'Billing | Agathon',
  description: 'Agathon is an AI Socratic Whiteboard - Learn By Doing',
};

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
// Card components no longer needed — using plain divs for a lighter, less "AI template" feel
import { Progress } from '@/components/ui/progress';
import {
  ArrowLeft,
  Check,
  Lightning,
  CircleNotch,
  Coins,
  CaretRight,
} from '@phosphor-icons/react';

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
    description: 'Everything you need to learn',
    monthlyInteractions: 500,
    productId: process.env.NEXT_PUBLIC_POLAR_PRODUCT_FREE_ID?.trim(),
    features: [
      '500 AI assists per month',
      'Full vision AI (sees your canvas)',
      'Socratic tutoring mode',
      'Unlimited boards',
      'Export your work',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: '$12',
    interval: 'month',
    description: 'For schools and organizations',
    monthlyInteractions: 500,
    productId: process.env.NEXT_PUBLIC_POLAR_PRODUCT_PREMIUM_ID?.trim(),
    features: [
      'Everything in Free',
      'Handwritten visual feedback on canvas',
      'Priority support',
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
    // Backwards compat: existing 'premium' subscribers map to 'enterprise'
    const mappedTier = planTier === 'premium' ? 'enterprise' : planTier;
    return plans.find((plan) => plan.id === mappedTier) || plans[0];
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
        <CircleNotch className="h-8 w-8 animate-spin text-muted-foreground" weight="duotone" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-6 pt-8 pb-16">
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-8">
          <button
            onClick={() => router.back()}
            className="p-1.5 -ml-1.5 rounded-md hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-muted-foreground" weight="duotone" />
          </button>
          <h1 className="text-lg font-semibold text-foreground">
            Billing
          </h1>
        </div>

        {/* Usage */}
        <section className="mb-8">
          <div className="flex items-baseline justify-between mb-3">
            <div>
              <span className="text-sm font-medium text-foreground">{activePlan.name} plan</span>
              <span className="text-sm text-muted-foreground ml-1.5">
                {loadingUsage
                  ? ''
                  : usage
                    ? `\u00b7 ${remainingAssists} assists left`
                    : ''}
              </span>
            </div>
            {usage && activePlan.monthlyInteractions && (
              <span className="text-sm tabular-nums text-muted-foreground">
                {usage.totalInteractions}<span className="text-muted-foreground/50"> / {activePlan.monthlyInteractions}</span>
              </span>
            )}
          </div>
          {!loadingUsage && usage && activePlan.monthlyInteractions ? (
            <div>
              <Progress value={usageProgress} className="h-1.5" />
              <p className="text-xs text-muted-foreground/60 mt-1.5">
                Resets {usage.windowStart ? formatDistanceToNow(new Date(new Date(usage.windowStart).getTime() + 30 * 24 * 60 * 60 * 1000), { addSuffix: true }) : 'in 30 days'}
              </p>
            </div>
          ) : loadingUsage ? (
            <div className="h-1.5 bg-muted rounded-full animate-pulse" />
          ) : null}
        </section>

        {/* Plans */}
        <section className="mb-8">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">Plans</h2>
          <div className="border border-border rounded-lg bg-card divide-y divide-border">
            {plans.map((plan) => {
              const isCurrentPlan = activePlan.id === plan.id;
              return (
                <div key={plan.id} className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">{plan.name}</span>
                        {isCurrentPlan && (
                          <span className="text-[10px] font-medium text-muted-foreground/70 bg-muted px-1.5 py-0.5 rounded">Current</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{plan.description}</p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                      <span className="text-lg font-semibold text-foreground">{plan.price}</span>
                      <span className="text-xs text-muted-foreground">/{plan.interval}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3">
                    {plan.features.map((feature) => (
                      <span key={feature} className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Check className="h-3 w-3 text-muted-foreground/60 flex-shrink-0" weight="duotone" />
                        {feature}
                      </span>
                    ))}
                  </div>
                  {!isCurrentPlan && (
                    <Button
                      onClick={() => startCheckout(plan)}
                      disabled={checkoutLoading === plan.id || !plan.productId}
                      variant={plan.id === 'enterprise' ? 'default' : 'outline'}
                      size="sm"
                      className="h-8 text-xs"
                    >
                      {checkoutLoading === plan.id ? (
                        <CircleNotch className="h-3.5 w-3.5 animate-spin" weight="duotone" />
                      ) : plan.productId ? (
                        plan.id === 'enterprise' ? 'Upgrade to Enterprise' : 'Switch to Free'
                      ) : (
                        'Coming soon'
                      )}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Credits */}
        <section className="mb-8">
          <button
            onClick={() => router.push('/credits')}
            className="w-full flex items-center gap-3 p-3.5 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors text-left group"
          >
            <Coins className="h-4 w-4 text-muted-foreground flex-shrink-0" weight="duotone" />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-foreground block">Buy credit packs</span>
              <span className="text-xs text-muted-foreground">For handwritten canvas feedback and other enterprise features</span>
            </div>
            <CaretRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors flex-shrink-0" weight="duotone" />
          </button>
        </section>

        {/* Recent Activity */}
        {usage && usage.recent.length > 0 && (
          <section>
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">Recent activity</h2>
            <div className="border border-border rounded-lg bg-card divide-y divide-border">
              {usage.recent.slice(0, 5).map((row, idx) => (
                <div
                  key={`${row.createdAt}-${idx}`}
                  className="flex items-center justify-between px-3.5 py-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    <Lightning className="h-3.5 w-3.5 text-muted-foreground/50" weight="duotone" />
                    <span className="text-sm text-foreground capitalize">
                      {row.mode || 'AI Assist'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground/70">
                    <span className="tabular-nums">{row.tokens.toLocaleString()} tokens</span>
                    <span className="tabular-nums">
                      {row.createdAt
                        ? formatDistanceToNow(new Date(row.createdAt), { addSuffix: true })
                        : 'Recently'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground/50 mt-8">
          Payments processed by Polar. Cancel anytime.
        </p>
      </div>
    </div>
  );
}
