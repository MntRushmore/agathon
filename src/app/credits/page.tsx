'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/components/auth/auth-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  Coins,
  ShoppingCart,
  History,
  Sparkles,
  AlertCircle,
  Loader2,
  TrendingUp,
  TrendingDown,
  Zap,
} from 'lucide-react';
import type { CreditTransaction } from '@/types/database';

type CreditPack = {
  id: string;
  credits: number;
  price: number;
  productId?: string;
};

const creditPacks: CreditPack[] = [
  {
    id: 'pack-50',
    credits: 50,
    price: 5,
    productId: process.env.NEXT_PUBLIC_POLAR_CREDITS_50_ID?.trim(),
  },
];

export default function CreditsPage() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [creditBalance, setCreditBalance] = useState(0);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      router.push('/?auth=required');
      return;
    }

    async function loadCredits() {
      try {
        const res = await fetch('/api/credits/balance');
        if (res.ok) {
          const data = await res.json();
          setCreditBalance(data.balance);
          setTransactions(data.recentTransactions || []);
        }
      } catch (error) {
        console.error('Failed to load credits:', error);
      } finally {
        setLoading(false);
      }
    }

    loadCredits();
  }, [user, router]);

  useEffect(() => {
    if (profile?.credits !== undefined) {
      setCreditBalance(profile.credits);
    }
  }, [profile]);

  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  const purchaseCredits = (pack: CreditPack) => {
    if (!user) {
      router.push('/?auth=required');
      return;
    }

    if (!pack.productId) {
      alert('Credit pack not configured. Please contact support.');
      return;
    }

    const params = new URLSearchParams();
    params.set('products', pack.productId);
    params.set('customerExternalId', user.id);
    if (user.email) params.set('customerEmail', user.email);
    if (profile?.full_name) params.set('customerName', profile.full_name);
    // Include metadata to identify this as a credit purchase
    params.set('metadata', JSON.stringify({ type: 'credit_pack', credits: pack.credits }));

    setCheckoutLoading(pack.id);
    window.location.href = `/api/polar/checkout?${params.toString()}`;
  };

  const getTransactionIcon = (type: string, amount: number) => {
    if (amount > 0) {
      return <TrendingUp className="h-4 w-4 text-green-600" />;
    }
    return <TrendingDown className="h-4 w-4 text-red-600" />;
  };

  const getTransactionLabel = (type: string) => {
    const labels: Record<string, string> = {
      purchase: 'Credit Purchase',
      subscription_grant: 'Subscription Credits',
      usage: 'AI Usage',
      refund: 'Refund',
      admin_adjustment: 'Admin Adjustment',
      bonus: 'Bonus Credits',
      signup_bonus: 'Welcome Bonus',
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[oklch(0.97_0.003_260)] via-background to-background">
      <div className="max-w-4xl mx-auto px-6 py-12 space-y-8">
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
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted text-xs font-medium">
              <Coins className="h-3.5 w-3.5" />
              AI Credits
            </div>
            <h1 className="text-3xl font-semibold mt-2">Your Credits</h1>
            <p className="text-muted-foreground">
              Credits power enterprise features like handwritten canvas feedback
            </p>
          </div>
        </div>

        {/* Balance Card */}
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Current Balance</p>
                <p className="text-5xl font-bold">{creditBalance}</p>
                <p className="text-sm text-muted-foreground mt-1">credits available</p>
              </div>
              <div className="h-20 w-20 rounded-full bg-primary/20 flex items-center justify-center">
                <Coins className="h-10 w-10 text-primary" />
              </div>
            </div>
            {creditBalance < 10 && (
              <div className="mt-4 flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">Running low! Purchase more credits to continue using enterprise AI features.</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* What Credits Do */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              How Credits Work
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 bg-[oklch(0.95_0.02_225)] rounded-lg border border-[oklch(0.85_0.04_225)]">
                <p className="font-medium text-[oklch(0.30_0.06_225)]">With Credits (Enterprise)</p>
                <ul className="text-sm text-[oklch(0.38_0.05_225)] mt-1 space-y-1">
                  <li>• Handwritten visual feedback on canvas</li>
                  <li>• AI-drawn annotations on your work</li>
                </ul>
              </div>
              <div className="p-3 bg-[oklch(0.96_0.003_260)] rounded-lg border border-[oklch(0.92_0.003_260)]">
                <p className="font-medium text-[oklch(0.25_0.005_260)]">Free for Everyone</p>
                <ul className="text-sm text-[oklch(0.40_0.005_260)] mt-1 space-y-1">
                  <li>• Full AI tutor with vision (sees your canvas)</li>
                  <li>• Socratic tutoring mode</li>
                  <li>• Math solving and step-by-step analysis</li>
                  <li>• 500 AI assists per month</li>
                </ul>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Handwritten visual feedback uses 2 credits per use. All other AI features are free.
            </p>
          </CardContent>
        </Card>

        {/* Purchase Credits */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Purchase Credits
            </CardTitle>
            <CardDescription>Top up your AI credit balance</CardDescription>
          </CardHeader>
          <CardContent>
            {creditPacks.map((pack) => (
              <div
                key={pack.id}
                className="flex items-center justify-between p-4 bg-muted rounded-lg"
              >
                <div>
                  <p className="text-2xl font-bold">{pack.credits} Credits</p>
                  <p className="text-sm text-muted-foreground">
                    ${pack.price} &middot; ${(pack.price / pack.credits).toFixed(2)} per credit
                  </p>
                </div>
                <Button
                  onClick={() => purchaseCredits(pack)}
                  disabled={checkoutLoading === pack.id || !pack.productId}
                >
                  {checkoutLoading === pack.id ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Redirecting...
                    </>
                  ) : pack.productId ? (
                    'Purchase'
                  ) : (
                    'Coming Soon'
                  )}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Transaction History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Recent Activity
            </CardTitle>
            <CardDescription>
              Your credit transaction history
            </CardDescription>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No transactions yet. Start using AI features to see your history here.
              </p>
            ) : (
              <div className="space-y-3">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between py-3 border-b last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                        {getTransactionIcon(tx.transaction_type, tx.amount)}
                      </div>
                      <div>
                        <p className="font-medium">{getTransactionLabel(tx.transaction_type)}</p>
                        <p className="text-sm text-muted-foreground">
                          {tx.description || tx.ai_route || 'No description'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(tx.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <div className={`text-right ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      <p className="font-semibold">
                        {tx.amount > 0 ? '+' : ''}{tx.amount}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Balance: {tx.balance_after}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Subscription CTA */}
        <Card className="bg-gradient-to-r from-[oklch(0.96_0.02_225)] to-[oklch(0.97_0.003_260)] border-[oklch(0.85_0.04_225)]">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-[oklch(0.52_0.11_225)]" />
                  Want more credits each month?
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Enterprise subscribers get 500 credits/month for handwritten canvas feedback
                </p>
              </div>
              <Button onClick={() => router.push('/billing')}>
                View Plans
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
