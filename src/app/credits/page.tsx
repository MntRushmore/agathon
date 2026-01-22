'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/components/auth/auth-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  bonus?: number;
  popular?: boolean;
};

const creditPacks: CreditPack[] = [
  { id: 'pack-50', credits: 50, price: 5 },
  { id: 'pack-150', credits: 150, price: 12, bonus: 25, popular: true },
  { id: 'pack-500', credits: 500, price: 35, bonus: 100 },
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

  const purchaseCredits = (pack: CreditPack) => {
    if (!user) {
      router.push('/?auth=required');
      return;
    }

    // TODO: Integrate with Polar checkout for credit packs
    // For now, show a message
    alert(`Credit pack purchase coming soon! ${pack.credits} credits for $${pack.price}`);
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
    <div className="min-h-screen bg-gradient-to-b from-[oklch(0.97_0.01_210)] via-background to-background">
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
              Credits power premium AI features with image understanding
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
                <span className="text-sm">Running low! Purchase more credits to continue using premium AI.</span>
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
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="font-medium text-green-800">With Credits</p>
                <ul className="text-sm text-green-700 mt-1 space-y-1">
                  <li>• AI can see your whiteboard</li>
                  <li>• Handwriting recognition (OCR)</li>
                  <li>• Visual feedback on your work</li>
                  <li>• Canvas analysis for voice</li>
                </ul>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="font-medium text-gray-800">Without Credits</p>
                <ul className="text-sm text-gray-600 mt-1 space-y-1">
                  <li>• Text-only AI chat (still free!)</li>
                  <li>• Describe problems in text</li>
                  <li>• Basic math solving</li>
                  <li>• No image features</li>
                </ul>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Most features use 1 credit per use. Solution generation uses 2 credits.
            </p>
          </CardContent>
        </Card>

        {/* Purchase Credits */}
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Purchase Credits
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {creditPacks.map((pack) => (
              <Card
                key={pack.id}
                className={`relative ${pack.popular ? 'border-primary shadow-lg' : ''}`}
              >
                {pack.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary">Most Popular</Badge>
                  </div>
                )}
                <CardHeader className="pb-2">
                  <CardTitle className="text-2xl">{pack.credits} Credits</CardTitle>
                  {pack.bonus && (
                    <CardDescription className="text-green-600 font-medium">
                      +{pack.bonus} bonus credits!
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">${pack.price}</p>
                  <p className="text-sm text-muted-foreground">
                    ${(pack.price / (pack.credits + (pack.bonus || 0))).toFixed(2)} per credit
                  </p>
                  <Button
                    className="w-full mt-4"
                    variant={pack.popular ? 'default' : 'outline'}
                    onClick={() => purchaseCredits(pack)}
                  >
                    Purchase
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

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
        <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-600" />
                  Want more credits each month?
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Pro subscribers get 500 credits/month plus priority AI and faster responses
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
