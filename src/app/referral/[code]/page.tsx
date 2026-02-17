'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Trophy, Copy, Check, ArrowLeft, Share2 } from 'lucide-react';
import { Logo } from '@/components/ui/logo';

interface ReferralStats {
  referralCode: string;
  referralCount: number;
  rank: number | null;
  name: string;
}

export default function ReferralStatsPage() {
  const params = useParams();
  const code = params.code as string;
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const referralLink = typeof window !== 'undefined'
    ? `${window.location.origin}?ref=${code}`
    : '';

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch(`/api/referral/${code}`);
        if (res.status === 404) {
          setError('Referral code not found');
          return;
        }
        if (!res.ok) throw new Error('Failed to load');
        const data = await res.json();
        setStats(data);
      } catch {
        setError('Failed to load referral stats');
      } finally {
        setLoading(false);
      }
    }
    if (code) fetchStats();
  }, [code]);

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join Agathon',
          text: 'Check out Agathon - AI-powered learning that helps you understand concepts deeply!',
          url: referralLink,
        });
      } catch {
        // User cancelled or share failed
      }
    } else {
      copyLink();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <nav className="border-b border-border px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2">
            <Logo size="sm" showText />
          </Link>
          <Link href="/referral/leaderboard">
            <Button variant="outline" size="sm">
              <Trophy className="w-3.5 h-3.5 mr-1.5" />
              Leaderboard
            </Button>
          </Link>
        </div>
      </nav>

      <div className="max-w-lg mx-auto px-6 py-12">
        {/* Back link */}
        <Link
          href="/referral/leaderboard"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to leaderboard
        </Link>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-5 w-5 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground">{error}</p>
            <Link href="/?waitlist=true" className="mt-4 inline-block">
              <Button variant="outline">Join Waitlist</Button>
            </Link>
          </div>
        ) : stats ? (
          <div className="space-y-6">
            {/* Stats Card */}
            <div className="bg-card border border-border rounded-lg p-6">
              <h1 className="text-2xl font-bold text-foreground mb-1">Your Referrals</h1>
              <p className="text-sm text-muted-foreground mb-6">
                Share your link to climb the leaderboard and earn cash rewards.
              </p>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-muted/50 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold tabular-nums">{stats.referralCount}</p>
                  <p className="text-xs text-muted-foreground mt-1">Total Referrals</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold tabular-nums">
                    {stats.rank ? `#${stats.rank}` : '--'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Leaderboard Rank</p>
                </div>
              </div>

              {/* Referral Link */}
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">Your referral link</p>
                <div className="flex gap-2">
                  <div className="flex-1 text-xs px-3 py-2.5 rounded bg-muted text-muted-foreground border border-border font-mono truncate">
                    {referralLink}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={copyLink}
                    className="flex-shrink-0 h-9 px-3"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                </div>
                <Button onClick={shareLink} className="w-full" size="sm">
                  <Share2 className="w-3.5 h-3.5 mr-2" />
                  Share Link
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
