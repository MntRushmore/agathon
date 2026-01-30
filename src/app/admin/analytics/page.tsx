'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import {
  Activity, Users, Sparkles, Layout, FileText, BookOpen,
  TrendingUp, RefreshCw, ArrowUp, ArrowDown, Minus,
} from 'lucide-react';
import { toast } from 'sonner';

interface AnalyticsData {
  growth: {
    dailySignups: Record<string, number>;
    usersThisWeek: number;
    usersThisMonth: number;
    usersLast90d: number;
    totalUsers: number;
    roleBreakdown: Record<string, number>;
  };
  engagement: {
    aiRequestsWeek: number;
    aiRequestsMonth: number;
    boardsWeek: number;
    boardsMonth: number;
    submissionsWeek: number;
    submissionsMonth: number;
    aiByMode: Record<string, number>;
  };
  credits: Record<string, { count: number; total: number }>;
}

export default function AdminAnalyticsPage() {
  const { profile } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadAnalytics = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/analytics');
      if (!res.ok) throw new Error('Failed to load analytics');
      const json = await res.json();
      setData(json);
    } catch {
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (profile?.role === 'admin') loadAnalytics();
  }, [profile, loadAnalytics]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAnalytics();
    setRefreshing(false);
    toast.success('Analytics refreshed');
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-6 bg-muted w-48 animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-32 bg-muted animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (!data) return null;

  // Build last 14 days for the mini chart
  const today = new Date();
  const last14Days: { date: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    last14Days.push({ date: key, count: data.growth.dailySignups[key] || 0 });
  }
  const maxSignup = Math.max(1, ...last14Days.map((d) => d.count));

  const totalAiMonth = Object.values(data.engagement.aiByMode).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Analytics</h1>
          <p className="text-muted-foreground text-sm mt-0.5">User growth, engagement, and platform trends</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="rounded-none h-8 text-xs">
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Growth Overview */}
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">User Growth</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border border border-border">
          {[
            { label: 'Total Users', value: data.growth.totalUsers, icon: Users },
            { label: 'This Week', value: data.growth.usersThisWeek, icon: TrendingUp },
            { label: 'This Month', value: data.growth.usersThisMonth, icon: TrendingUp },
            { label: 'Last 90 Days', value: data.growth.usersLast90d, icon: TrendingUp },
          ].map((m) => (
            <div key={m.label} className="bg-card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{m.label}</p>
                  <p className="text-2xl font-semibold mt-1.5 tabular-nums">{m.value}</p>
                </div>
                <m.icon className="h-4 w-4 text-muted-foreground/50" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Signup Chart (text-based bar chart) */}
      <div className="bg-card border border-border p-5">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Daily Signups (14 days)</h2>
        <div className="flex items-end gap-1 h-24">
          {last14Days.map((day) => (
            <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] text-muted-foreground tabular-nums">{day.count || ''}</span>
              <div
                className="w-full bg-foreground/80 min-h-[2px]"
                style={{ height: `${(day.count / maxSignup) * 72}px` }}
              />
              <span className="text-[9px] text-muted-foreground tabular-nums">
                {day.date.slice(8)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Role Breakdown */}
      <div className="bg-card border border-border p-5">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Users by Role</h2>
        <div className="space-y-3">
          {Object.entries(data.growth.roleBreakdown)
            .sort(([, a], [, b]) => b - a)
            .map(([role, count]) => {
              const pct = ((count / data.growth.totalUsers) * 100).toFixed(1);
              return (
                <div key={role} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="capitalize font-medium">{role}</span>
                    <span className="text-muted-foreground tabular-nums">{count} ({pct}%)</span>
                  </div>
                  <div className="h-1 bg-muted overflow-hidden">
                    <div className="h-full bg-foreground/70" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Engagement Metrics */}
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Engagement (Last 30 Days)</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border border border-border">
          {[
            { label: 'AI Requests', weekVal: data.engagement.aiRequestsWeek, monthVal: data.engagement.aiRequestsMonth, icon: Sparkles },
            { label: 'Boards Created', weekVal: data.engagement.boardsWeek, monthVal: data.engagement.boardsMonth, icon: Layout },
            { label: 'Submissions', weekVal: data.engagement.submissionsWeek, monthVal: data.engagement.submissionsMonth, icon: FileText },
          ].map((m) => (
            <div key={m.label} className="bg-card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{m.label}</p>
                  <p className="text-2xl font-semibold mt-1.5 tabular-nums">{m.monthVal}</p>
                </div>
                <m.icon className="h-4 w-4 text-muted-foreground/50" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">{m.weekVal} this week</p>
            </div>
          ))}
        </div>
      </div>

      {/* AI Mode Breakdown */}
      <div className="bg-card border border-border p-5">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">AI Usage by Mode (30 days)</h2>
        {totalAiMonth === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No AI usage in this period</p>
        ) : (
          <div className="space-y-3">
            {Object.entries(data.engagement.aiByMode)
              .sort(([, a], [, b]) => b - a)
              .map(([mode, count]) => {
                const pct = ((count / totalAiMonth) * 100).toFixed(1);
                return (
                  <div key={mode} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="capitalize font-medium">{mode}</span>
                      <span className="text-muted-foreground tabular-nums">{count} ({pct}%)</span>
                    </div>
                    <div className="h-1 bg-muted overflow-hidden">
                      <div className="h-full bg-foreground/70" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Credit Transactions */}
      <div className="bg-card border border-border p-5">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Credit Activity (30 days)</h2>
        {Object.keys(data.credits).length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No credit transactions in this period</p>
        ) : (
          <div className="divide-y divide-border">
            {Object.entries(data.credits)
              .sort(([, a], [, b]) => b.count - a.count)
              .map(([type, { count, total }]) => (
                <div key={type} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 flex items-center justify-center ${total > 0 ? 'text-green-600' : total < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                      {total > 0 ? <ArrowUp className="h-3.5 w-3.5" /> : total < 0 ? <ArrowDown className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                    </div>
                    <span className="text-sm capitalize">{type.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium tabular-nums">{count} transactions</p>
                    <p className={`text-xs tabular-nums ${total > 0 ? 'text-green-600' : total < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                      {total > 0 ? '+' : ''}{total} credits
                    </p>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
