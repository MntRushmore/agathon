"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  ArrowLeft,
  Check,
  Sparkles,
  Zap,
  Crown,
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
    productId: process.env.NEXT_PUBLIC_POLAR_PRODUCT_FREE_ID,
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
    productId: process.env.NEXT_PUBLIC_POLAR_PRODUCT_PREMIUM_ID,
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
        console.error('Failed to load usage', err);
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

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      {/* Header */}
      <div className="border-b border-[#E8E4DC] bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-sm text-[#666] hover:text-[#333] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Title */}
        <div className="mb-12">
          <h1 className="text-2xl font-semibold text-[#1a1a1a] mb-2">
            Plans & Billing
          </h1>
          <p className="text-[#666]">
            Manage your subscription and track your usage
          </p>
        </div>

        {/* Current Usage Card */}
        {user && (
          <div className="mb-12 p-6 rounded-2xl bg-white border border-[#E8E4DC]">
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-[#1a1a1a]">
                    {activePlan.name} Plan
                  </span>
                  {activePlan.id === 'premium' && (
                    <Crown className="h-4 w-4 text-amber-500" />
                  )}
                </div>
                <p className="text-sm text-[#666]">
                  {loadingUsage ? (
                    'Loading usage...'
                  ) : usage ? (
                    `${remainingAssists} assists remaining this month`
                  ) : (
                    'Sign in to see your usage'
                  )}
                </p>
              </div>
              {usage && activePlan.monthlyInteractions && (
                <div className="text-right">
                  <span className="text-2xl font-semibold text-[#1a1a1a]">
                    {usage.totalInteractions}
                  </span>
                  <span className="text-sm text-[#666]">
                    {' '}/ {activePlan.monthlyInteractions}
                  </span>
                </div>
              )}
            </div>

            {!loadingUsage && usage && activePlan.monthlyInteractions && (
              <div className="space-y-2">
                <Progress
                  value={usageProgress}
                  className="h-2 bg-[#F0EDE6]"
                />
                <p className="text-xs text-[#888]">
                  Resets in {usage.windowStart ? formatDistanceToNow(new Date(new Date(usage.windowStart).getTime() + 30 * 24 * 60 * 60 * 1000)) : '30 days'}
                </p>
              </div>
            )}

            {loadingUsage && (
              <div className="h-2 bg-[#F0EDE6] rounded-full animate-pulse" />
            )}
          </div>
        )}

        {/* Plans */}
        <div className="mb-8">
          <h2 className="text-lg font-medium text-[#1a1a1a] mb-6">
            Choose your plan
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {plans.map((plan) => {
              const isCurrentPlan = activePlan.id === plan.id;

              return (
                <div
                  key={plan.id}
                  className={`
                    relative p-6 rounded-2xl border-2 transition-all
                    ${plan.popular
                      ? 'border-[#1a1a1a] bg-white'
                      : 'border-[#E8E4DC] bg-white hover:border-[#D0CCC4]'
                    }
                  `}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-6">
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#1a1a1a] text-white text-xs font-medium">
                        <Sparkles className="h-3 w-3" />
                        Popular
                      </span>
                    </div>
                  )}

                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-[#1a1a1a]">
                      {plan.name}
                    </h3>
                    <p className="text-sm text-[#666] mt-1">
                      {plan.description}
                    </p>
                  </div>

                  <div className="mb-6">
                    <span className="text-3xl font-semibold text-[#1a1a1a]">
                      {plan.price}
                    </span>
                    <span className="text-[#666] text-sm">
                      /{plan.interval}
                    </span>
                  </div>

                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <Check className="h-4 w-4 text-[#22c55e] mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-[#444]">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={() => startCheckout(plan)}
                    disabled={checkoutLoading === plan.id || !plan.productId || isCurrentPlan}
                    className={`
                      w-full h-11 rounded-xl font-medium transition-all
                      ${plan.popular
                        ? 'bg-[#1a1a1a] hover:bg-[#333] text-white'
                        : 'bg-[#F5F3EE] hover:bg-[#EBE8E0] text-[#1a1a1a] border border-[#E8E4DC]'
                      }
                      ${isCurrentPlan ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                  >
                    {checkoutLoading === plan.id ? (
                      'Redirecting...'
                    ) : isCurrentPlan ? (
                      'Current plan'
                    ) : plan.productId ? (
                      plan.popular ? 'Upgrade now' : 'Get started'
                    ) : (
                      'Coming soon'
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Activity */}
        {user && usage && usage.recent.length > 0 && (
          <div className="mt-12">
            <h2 className="text-lg font-medium text-[#1a1a1a] mb-4">
              Recent activity
            </h2>
            <div className="bg-white rounded-2xl border border-[#E8E4DC] divide-y divide-[#E8E4DC]">
              {usage.recent.slice(0, 5).map((row, idx) => (
                <div
                  key={`${row.createdAt}-${idx}`}
                  className="flex items-center justify-between px-5 py-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-[#F0EDE6] flex items-center justify-center">
                      <Zap className="h-4 w-4 text-[#666]" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#1a1a1a] capitalize">
                        {row.mode || 'AI Assist'}
                      </p>
                      <p className="text-xs text-[#888]">
                        {row.createdAt
                          ? formatDistanceToNow(new Date(row.createdAt), { addSuffix: true })
                          : 'Recently'}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm text-[#666]">
                    {row.tokens.toLocaleString()} tokens
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer note */}
        <p className="text-center text-xs text-[#888] mt-12">
          Payments are securely processed by Polar. Cancel anytime.
        </p>
      </div>
    </div>
  );
}
