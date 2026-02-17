'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Trophy, Medal, ArrowLeft, Copy, Check } from 'lucide-react';
import { Logo } from '@/components/ui/logo';

interface LeaderboardEntry {
  rank: number;
  name: string;
  referralCode: string;
  referralCount: number;
}

export default function ReferralLeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const searchParams = useSearchParams();
  const highlightCode = searchParams.get('ref');

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        const res = await fetch('/api/referral/leaderboard');
        if (!res.ok) throw new Error('Failed to load');
        const data = await res.json();
        setLeaderboard(data.leaderboard || []);
      } catch {
        setError('Failed to load leaderboard');
      } finally {
        setLoading(false);
      }
    }
    fetchLeaderboard();
  }, []);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-5 h-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />;
    if (rank === 3) return <Medal className="w-5 h-5 text-amber-600" />;
    return <span className="w-5 h-5 flex items-center justify-center text-sm font-semibold text-muted-foreground tabular-nums">{rank}</span>;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <nav className="border-b border-border px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2">
            <Logo size="sm" showText />
          </Link>
          <Link href="/?waitlist=true">
            <Button variant="outline" size="sm">
              Join Waitlist
            </Button>
          </Link>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>

        {/* Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Referral Leaderboard</h1>
          <p className="text-muted-foreground">
            Top referrers earn cash rewards. Share your link and climb the ranks.
          </p>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-5 w-5 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-20 text-muted-foreground">{error}</div>
        ) : leaderboard.length === 0 ? (
          <div className="text-center py-20">
            <Trophy className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-lg font-medium text-foreground mb-1">No referrals yet</p>
            <p className="text-sm text-muted-foreground mb-6">
              Be the first to share your referral link and claim the top spot!
            </p>
            <Link href="/?waitlist=true">
              <Button>Join Waitlist & Get Your Link</Button>
            </Link>
          </div>
        ) : (
          <div className="bg-card border border-border overflow-hidden rounded-lg">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-5 py-3 text-left text-xs uppercase tracking-wider font-semibold text-muted-foreground w-16">Rank</th>
                  <th className="px-5 py-3 text-left text-xs uppercase tracking-wider font-semibold text-muted-foreground">Name</th>
                  <th className="px-5 py-3 text-right text-xs uppercase tracking-wider font-semibold text-muted-foreground">Referrals</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry) => {
                  const isHighlighted = highlightCode && entry.referralCode === highlightCode.replace(/[-\s]/g, '').toUpperCase();
                  return (
                    <tr
                      key={entry.referralCode}
                      className={`border-b border-border last:border-0 transition-colors ${
                        isHighlighted
                          ? 'bg-primary/5 border-l-2 border-l-primary'
                          : 'hover:bg-muted/30'
                      }`}
                    >
                      <td className="px-5 py-3.5">
                        {getRankIcon(entry.rank)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-sm font-medium text-foreground">
                          {entry.name}
                        </span>
                        {isHighlighted && (
                          <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">You</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="text-sm font-semibold tabular-nums">{entry.referralCount}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
