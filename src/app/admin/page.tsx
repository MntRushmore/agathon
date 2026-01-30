'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  BookOpen,
  Sparkles,
  TrendingUp,
  FileText,
  Layout,
  AlertCircle,
  Download,
  RefreshCw,
  Coins,
  Crown,
  Plus,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

interface Stats {
  totalUsers: number;
  totalStudents: number;
  totalTeachers: number;
  totalAdmins: number;
  totalClasses: number;
  totalAssignments: number;
  totalBoards: number;
  totalSubmissions: number;
  totalAIUsage: number;
  totalAICost: number;
  aiByMode: Record<string, number>;
  newUsersWeek: number;
  newUsersMonth: number;
}

interface AuditLogEntry {
  id: string;
  admin_id: string;
  action_type: string;
  target_type: string;
  target_id: string;
  target_details: Record<string, any> | null;
  created_at: string;
  admin?: { full_name: string | null; email: string } | null;
}

export default function AdminDashboardPage() {
  const supabase = createClient();
  const { profile, refreshProfile } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentActivity, setRecentActivity] = useState<AuditLogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingAccount, setUpdatingAccount] = useState(false);

  const loadDashboard = useCallback(async () => {
    setError(null);
    try {
      // Use the stats API endpoint and fetch audit logs in parallel
      const [statsRes, logsRes] = await Promise.all([
        fetch('/api/admin/stats'),
        fetch('/api/admin/audit-logs?limit=8'),
      ]);

      if (!statsRes.ok) throw new Error('Failed to load stats');

      const statsData = await statsRes.json();

      setStats({
        totalUsers: statsData.users.total,
        totalStudents: statsData.users.students,
        totalTeachers: statsData.users.teachers,
        totalAdmins: statsData.users.admins,
        totalClasses: statsData.content.classes,
        totalAssignments: statsData.content.assignments,
        totalBoards: statsData.content.boards,
        totalSubmissions: statsData.content.submissions,
        totalAIUsage: statsData.ai.totalInteractions,
        totalAICost: statsData.ai.estimatedCost,
        aiByMode: statsData.ai.byMode,
        newUsersWeek: statsData.growth.newUsersWeek,
        newUsersMonth: statsData.growth.newUsersMonth,
      });

      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setRecentActivity(logsData.logs || []);
      }
    } catch (err) {
      console.error('Error loading admin dashboard:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (profile && profile.role !== 'admin') {
      router.push('/');
      return;
    }
    if (profile?.role === 'admin') {
      loadDashboard();
    }
  }, [profile, router, loadDashboard]);

  if (!profile || loading) {
    return (
      <div className="space-y-6">
        <div className="h-6 bg-muted w-48 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (profile.role !== 'admin') return null;

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboard();
    setRefreshing(false);
    toast.success('Dashboard refreshed');
  };

  const exportToCSV = () => {
    if (!stats) return;
    const csvContent = `Metric,Value
Total Users,${stats.totalUsers}
Students,${stats.totalStudents}
Teachers,${stats.totalTeachers}
Admins,${stats.totalAdmins}
Classes,${stats.totalClasses}
Assignments,${stats.totalAssignments}
Whiteboards,${stats.totalBoards}
Submissions,${stats.totalSubmissions}
AI Requests,${stats.totalAIUsage}
AI Cost,$${stats.totalAICost.toFixed(2)}
New Users (Week),${stats.newUsersWeek}
New Users (Month),${stats.newUsersMonth}`;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agathon-stats-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const addCredits = async (amount: number) => {
    if (!profile?.id) return;
    setUpdatingAccount(true);
    try {
      const currentCredits = profile.credits || 0;
      const { error } = await supabase
        .from('profiles')
        .update({ credits: currentCredits + amount, credits_updated_at: new Date().toISOString() })
        .eq('id', profile.id);
      if (error) throw error;
      await refreshProfile();
      toast.success(`Added ${amount} credits`);
    } catch {
      toast.error('Failed to add credits');
    } finally {
      setUpdatingAccount(false);
    }
  };

  const setPlanTier = async (tier: 'free' | 'premium') => {
    if (!profile?.id) return;
    setUpdatingAccount(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          plan_tier: tier,
          plan_status: tier === 'premium' ? 'active' : null,
          plan_expires_at: tier === 'premium'
            ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
            : null,
        })
        .eq('id', profile.id);
      if (error) throw error;
      await refreshProfile();
      toast.success(tier === 'premium' ? 'Upgraded to Premium' : 'Switched to Free');
    } catch {
      toast.error('Failed to update plan');
    } finally {
      setUpdatingAccount(false);
    }
  };

  const isPremium = profile?.plan_tier === 'premium' && profile?.plan_status === 'active';

  const formatActionType = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const getActionColor = (type: string): string => {
    if (type.includes('delete')) return 'text-red-600 dark:text-red-400';
    if (type.includes('create') || type.includes('activate')) return 'text-green-600 dark:text-green-400';
    if (type.includes('change') || type.includes('modify')) return 'text-blue-600 dark:text-blue-400';
    if (type.includes('impersonate')) return 'text-amber-600 dark:text-amber-400';
    return 'text-muted-foreground';
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Overview</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Platform statistics and recent activity</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="rounded-none h-8 text-xs">
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportToCSV} className="rounded-none h-8 text-xs">
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export
          </Button>
        </div>
      </div>

      {/* Admin Account Tools */}
      <div className="bg-card border border-border p-4">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Account Tools
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-muted text-sm">
            <Coins className="w-3.5 h-3.5 text-amber-500" />
            <span className="font-medium">{profile?.credits || 0} credits</span>
          </div>
          <div className={`flex items-center gap-1.5 px-2.5 py-1.5 text-sm ${isPremium ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-muted'}`}>
            <Crown className={`w-3.5 h-3.5 ${isPremium ? 'text-amber-600' : 'text-muted-foreground'}`} />
            <span className="font-medium">{isPremium ? 'Premium' : 'Free'}</span>
          </div>
          <div className="h-5 w-px bg-border mx-1" />
          <Button variant="outline" size="sm" onClick={() => addCredits(100)} disabled={updatingAccount} className="rounded-none h-7 text-xs">
            <Plus className="w-3 h-3 mr-1" />+100
          </Button>
          <Button variant="outline" size="sm" onClick={() => addCredits(1000)} disabled={updatingAccount} className="rounded-none h-7 text-xs">
            <Plus className="w-3 h-3 mr-1" />+1000
          </Button>
          <div className="h-5 w-px bg-border mx-1" />
          {isPremium ? (
            <Button variant="outline" size="sm" onClick={() => setPlanTier('free')} disabled={updatingAccount} className="rounded-none h-7 text-xs">
              Switch to Free
            </Button>
          ) : (
            <Button size="sm" onClick={() => setPlanTier('premium')} disabled={updatingAccount} className="rounded-none h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white border-0">
              <Crown className="w-3 h-3 mr-1" />
              Make Premium
            </Button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-destructive/5 border border-destructive/20 p-4 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-destructive">Error</p>
            <p className="text-sm text-muted-foreground mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border border border-border">
        {[
          { label: 'Total Users', value: stats?.totalUsers, sub: `${stats?.totalStudents} students, ${stats?.totalTeachers} teachers`, icon: Users },
          { label: 'Classes', value: stats?.totalClasses, sub: `${stats?.totalAssignments} assignments`, icon: BookOpen },
          { label: 'AI Requests', value: stats?.totalAIUsage, sub: `$${(stats?.totalAICost || 0).toFixed(2)} est. cost`, icon: Sparkles },
          { label: 'New This Week', value: `+${stats?.newUsersWeek}`, sub: `${stats?.newUsersMonth} this month`, icon: TrendingUp },
        ].map((metric) => (
          <div key={metric.label} className="bg-card p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{metric.label}</p>
                <p className="text-2xl font-semibold mt-1.5 tabular-nums">{metric.value ?? '—'}</p>
              </div>
              <metric.icon className="h-4 w-4 text-muted-foreground/50" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">{metric.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AI Usage Breakdown */}
        <div className="bg-card border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">AI Usage by Mode</h2>
            <Link href="/admin/analytics" className="text-xs text-primary hover:underline flex items-center gap-1">
              Details <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {Object.entries(stats?.aiByMode || {}).length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No AI usage data yet</p>
            ) : (
              Object.entries(stats?.aiByMode || {})
                .sort(([, a], [, b]) => b - a)
                .map(([mode, count]) => (
                  <div key={mode} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="capitalize font-medium">{mode}</span>
                      <span className="text-muted-foreground tabular-nums">{count}</span>
                    </div>
                    <div className="h-1 bg-muted overflow-hidden">
                      <div
                        className="h-full bg-foreground/70"
                        style={{ width: `${Math.min(100, (count / (stats?.totalAIUsage || 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>

        {/* Content Overview */}
        <div className="bg-card border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Content</h2>
            <Link href="/admin/content" className="text-xs text-primary hover:underline flex items-center gap-1">
              Manage <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-border">
            {[
              { label: 'Whiteboards', value: stats?.totalBoards, icon: Layout },
              { label: 'Submissions', value: stats?.totalSubmissions, icon: FileText },
              { label: 'Assignments', value: stats?.totalAssignments, icon: BookOpen },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <item.icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{item.label}</span>
                </div>
                <span className="text-sm font-medium tabular-nums">{item.value ?? '—'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity (Real data from audit logs) */}
      <div className="bg-card border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recent Activity</h2>
          <Link href="/admin/logs" className="text-xs text-primary hover:underline flex items-center gap-1">
            All Logs <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {recentActivity.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No recorded activity yet</p>
        ) : (
          <div className="divide-y divide-border">
            {recentActivity.map((log) => (
              <div key={log.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <Clock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${getActionColor(log.action_type)}`}>
                      {formatActionType(log.action_type)}
                    </span>
                    <Badge variant="outline" className="text-[10px] rounded-none h-5 px-1.5">
                      {log.target_type}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {log.admin?.full_name || log.admin?.email || 'System'} &middot;{' '}
                    {log.target_details?.email || log.target_details?.name || log.target_details?.code || log.target_id.slice(0, 8)}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Navigation */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border border border-border">
        {[
          { href: '/admin/users', label: 'User Management', desc: 'Manage users and roles', icon: Users },
          { href: '/admin/content', label: 'Content', desc: 'Review and moderate', icon: FileText },
          { href: '/admin/analytics', label: 'Analytics', desc: 'Trends and engagement', icon: TrendingUp },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="bg-card p-5 hover:bg-accent transition-colors group"
          >
            <div className="flex items-center gap-3">
              <item.icon className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
