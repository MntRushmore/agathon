'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
  ToggleLeft,
  ToggleRight,
  Activity,
  Clock,
  Zap,
  Coins,
  Crown,
  Plus,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';

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

export default function AdminDashboardPage() {
  const supabase = createClient();
  const { profile, refreshProfile } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingAccount, setUpdatingAccount] = useState(false);

  // Feature flags (mock - would come from database)
  const [featureFlags, setFeatureFlags] = useState({
    aiEnabled: true,
    collaborationEnabled: true,
    newOnboarding: false,
    betaFeatures: false,
  });

  useEffect(() => {
    if (profile && profile.role !== 'admin') {
      router.push('/');
      return;
    }

    if (profile?.role === 'admin') {
      loadDashboard();
    }
  }, [profile, router]);

  const loadDashboard = async () => {
    setError(null);
    try {
      const results = await Promise.allSettled([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'teacher'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'admin'),
        supabase.from('classes').select('*', { count: 'exact', head: true }),
        supabase.from('assignments').select('*', { count: 'exact', head: true }),
        supabase.from('whiteboards').select('*', { count: 'exact', head: true }),
        supabase.from('submissions').select('*', { count: 'exact', head: true }),
        supabase.from('ai_usage').select('*', { count: 'exact', head: true }),
        supabase.from('ai_usage').select('mode'),
        supabase.from('ai_usage').select('total_cost'),
      ]);

      const failedQueries = results.filter((r) => r.status === 'rejected');
      if (failedQueries.length > 0) {
        console.error('Some queries failed:', failedQueries);
        setError('Some data could not be loaded. Check database permissions.');
      }

      const [
        totalUsersResult,
        totalStudentsResult,
        totalTeachersResult,
        totalAdminsResult,
        totalClassesResult,
        totalAssignmentsResult,
        totalBoardsResult,
        totalSubmissionsResult,
        totalAIUsageResult,
        aiUsageByModeResult,
        aiCostResult,
      ] = results;

      const totalUsers = totalUsersResult.status === 'fulfilled' ? totalUsersResult.value.count : 0;
      const totalStudents = totalStudentsResult.status === 'fulfilled' ? totalStudentsResult.value.count : 0;
      const totalTeachers = totalTeachersResult.status === 'fulfilled' ? totalTeachersResult.value.count : 0;
      const totalAdmins = totalAdminsResult.status === 'fulfilled' ? totalAdminsResult.value.count : 0;
      const totalClasses = totalClassesResult.status === 'fulfilled' ? totalClassesResult.value.count : 0;
      const totalAssignments = totalAssignmentsResult.status === 'fulfilled' ? totalAssignmentsResult.value.count : 0;
      const totalBoards = totalBoardsResult.status === 'fulfilled' ? totalBoardsResult.value.count : 0;
      const totalSubmissions = totalSubmissionsResult.status === 'fulfilled' ? totalSubmissionsResult.value.count : 0;
      const totalAIUsage = totalAIUsageResult.status === 'fulfilled' ? totalAIUsageResult.value.count : 0;
      const aiUsageByMode = aiUsageByModeResult.status === 'fulfilled' ? aiUsageByModeResult.value.data : [];
      const aiCostData = aiCostResult.status === 'fulfilled' ? aiCostResult.value.data : [];

      const totalAICost = (aiCostData || []).reduce((sum, record) => sum + (Number(record.total_cost) || 0), 0);

      const aiByMode = (aiUsageByMode || []).reduce((acc, u) => {
        acc[u.mode] = (acc[u.mode] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const growthResults = await Promise.allSettled([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', monthAgo),
      ]);

      const newUsersWeek = growthResults[0].status === 'fulfilled' ? growthResults[0].value.count : 0;
      const newUsersMonth = growthResults[1].status === 'fulfilled' ? growthResults[1].value.count : 0;

      setStats({
        totalUsers: totalUsers ?? 0,
        totalStudents: totalStudents ?? 0,
        totalTeachers: totalTeachers ?? 0,
        totalAdmins: totalAdmins ?? 0,
        totalClasses: totalClasses ?? 0,
        totalAssignments: totalAssignments ?? 0,
        totalBoards: totalBoards ?? 0,
        totalSubmissions: totalSubmissions ?? 0,
        totalAIUsage: totalAIUsage ?? 0,
        totalAICost,
        aiByMode,
        newUsersWeek: newUsersWeek ?? 0,
        newUsersMonth: newUsersMonth ?? 0,
      });
    } catch (error) {
      console.error('Error loading admin dashboard:', error);
      setError(error instanceof Error ? error.message : 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  if (!profile || loading) {
    return (
      <div className="space-y-6">
        <div className="h-7 bg-muted rounded w-1/4 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (profile.role !== 'admin') {
    return null;
  }

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboard();
    setRefreshing(false);
  };

  const toggleFeatureFlag = (flag: keyof typeof featureFlags) => {
    setFeatureFlags(prev => ({ ...prev, [flag]: !prev[flag] }));
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
  };

  // Add credits to own account
  const addCredits = async (amount: number) => {
    if (!profile?.id) return;
    setUpdatingAccount(true);
    try {
      const currentCredits = profile.credits || 0;
      const { error } = await supabase
        .from('profiles')
        .update({
          credits: currentCredits + amount,
          credits_updated_at: new Date().toISOString()
        })
        .eq('id', profile.id);

      if (error) throw error;
      await refreshProfile();
      toast.success(`Added ${amount} credits to your account`);
    } catch (err) {
      console.error('Error adding credits:', err);
      toast.error('Failed to add credits');
    } finally {
      setUpdatingAccount(false);
    }
  };

  // Set plan tier
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
            ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1 year
            : null
        })
        .eq('id', profile.id);

      if (error) throw error;
      await refreshProfile();
      toast.success(tier === 'premium' ? 'Upgraded to Premium!' : 'Switched to Free plan');
    } catch (err) {
      console.error('Error updating plan:', err);
      toast.error('Failed to update plan');
    } finally {
      setUpdatingAccount(false);
    }
  };

  const isPremium = profile?.plan_tier === 'premium' && profile?.plan_status === 'active';

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Overview</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Platform statistics and insights
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} strokeWidth={2} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="w-4 h-4 mr-2" strokeWidth={2} />
            Export CSV
          </Button>
        </div>
      </div>

      {/* My Account Quick Actions */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
          <Crown className="h-4 w-4 text-amber-500" strokeWidth={2} />
          My Account (Admin Tools)
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          {/* Current Status */}
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg">
            <Coins className="w-4 h-4 text-amber-500" strokeWidth={2} />
            <span className="text-sm font-medium">{profile?.credits || 0} credits</span>
          </div>
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isPremium ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-muted/50'}`}>
            <Crown className={`w-4 h-4 ${isPremium ? 'text-amber-600' : 'text-muted-foreground'}`} strokeWidth={2} />
            <span className={`text-sm font-medium ${isPremium ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'}`}>
              {isPremium ? 'Premium' : 'Free'}
            </span>
          </div>

          <div className="h-6 w-px bg-border mx-1" />

          {/* Add Credits */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => addCredits(100)}
            disabled={updatingAccount}
          >
            <Plus className="w-4 h-4 mr-1.5" strokeWidth={2} />
            +100 Credits
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => addCredits(1000)}
            disabled={updatingAccount}
          >
            <Plus className="w-4 h-4 mr-1.5" strokeWidth={2} />
            +1000 Credits
          </Button>

          <div className="h-6 w-px bg-border mx-1" />

          {/* Toggle Plan */}
          {isPremium ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPlanTier('free')}
              disabled={updatingAccount}
            >
              Switch to Free
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => setPlanTier('premium')}
              disabled={updatingAccount}
              className="bg-amber-600 hover:bg-amber-700 text-white border-0"
            >
              <Crown className="w-4 h-4 mr-1.5" strokeWidth={2} />
              Make Premium
            </Button>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-destructive">Database Error</p>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Users</p>
              <p className="text-2xl font-semibold mt-1">{stats?.totalUsers}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
          <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
            <span>{stats?.totalStudents} students</span>
            <span>{stats?.totalTeachers} teachers</span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Classes</p>
              <p className="text-2xl font-semibold mt-1">{stats?.totalClasses}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            {stats?.totalAssignments} assignments
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">AI Requests</p>
              <p className="text-2xl font-semibold mt-1">{stats?.totalAIUsage}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            ${(stats?.totalAICost || 0).toFixed(2)} total cost
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">New This Week</p>
              <p className="text-2xl font-semibold mt-1">+{stats?.newUsersWeek}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            {stats?.newUsersMonth} this month
          </p>
        </div>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AI Usage Breakdown */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            AI Usage by Mode
          </h2>
          <div className="space-y-3">
            {Object.entries(stats?.aiByMode || {}).length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">No AI usage data yet</p>
              </div>
            ) : (
              Object.entries(stats?.aiByMode || {}).map(([mode, count]) => (
                <div key={mode} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="capitalize text-foreground">{mode}</span>
                    <span className="text-muted-foreground">{count}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${Math.min(100, (count / (stats?.totalAIUsage || 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Content Stats */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
            <Layout className="h-4 w-4 text-muted-foreground" />
            Content Overview
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-3 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                  <Layout className="h-4 w-4 text-muted-foreground" />
                </div>
                <span className="text-sm text-foreground">Whiteboards</span>
              </div>
              <span className="text-sm font-medium">{stats?.totalBoards}</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </div>
                <span className="text-sm text-foreground">Submissions</span>
              </div>
              <span className="text-sm font-medium">{stats?.totalSubmissions}</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                </div>
                <span className="text-sm text-foreground">Assignments</span>
              </div>
              <span className="text-sm font-medium">{stats?.totalAssignments}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Flags */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
          <Zap className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
          Feature Flags
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(featureFlags).map(([key, enabled]) => (
            <div key={key} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-foreground capitalize">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </p>
                <p className="text-xs text-muted-foreground">
                  {enabled ? 'Enabled' : 'Disabled'}
                </p>
              </div>
              <button
                onClick={() => toggleFeatureFlag(key as keyof typeof featureFlags)}
                className="text-primary hover:opacity-80 transition-opacity"
              >
                {enabled ? (
                  <ToggleRight className="w-8 h-8" strokeWidth={1.5} />
                ) : (
                  <ToggleLeft className="w-8 h-8 text-muted-foreground" strokeWidth={1.5} />
                )}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => router.push('/admin/users')}
          className="p-5 bg-card border border-border rounded-xl hover:border-primary/30 transition-colors text-left group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
              <Users className="h-5 w-5 text-muted-foreground group-hover:text-primary" strokeWidth={2} />
            </div>
            <div>
              <p className="font-semibold text-foreground">User Management</p>
              <p className="text-xs text-muted-foreground">View and manage users</p>
            </div>
          </div>
        </button>
        <button
          onClick={() => router.push('/admin/content')}
          className="p-5 bg-card border border-border rounded-xl hover:border-primary/30 transition-colors text-left group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
              <FileText className="h-5 w-5 text-muted-foreground group-hover:text-primary" strokeWidth={2} />
            </div>
            <div>
              <p className="font-semibold text-foreground">Content Moderation</p>
              <p className="text-xs text-muted-foreground">Review flagged content</p>
            </div>
          </div>
        </button>
        <button
          onClick={() => window.open('https://supabase.com/dashboard', '_blank')}
          className="p-5 bg-card border border-border rounded-xl hover:border-primary/30 transition-colors text-left group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
              <Activity className="h-5 w-5 text-muted-foreground group-hover:text-primary" strokeWidth={2} />
            </div>
            <div>
              <p className="font-semibold text-foreground">Database Console</p>
              <p className="text-xs text-muted-foreground">Open Supabase dashboard</p>
            </div>
          </div>
        </button>
      </div>

      {/* Activity Feed - Placeholder */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
          Recent Activity
        </h2>
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Users className="w-4 h-4 text-green-600 dark:text-green-400" strokeWidth={2} />
            </div>
            <div className="flex-1">
              <p className="text-sm text-foreground">New user signup</p>
              <p className="text-xs text-muted-foreground">2 minutes ago</p>
            </div>
            <Badge variant="secondary" className="text-xs">User</Badge>
          </div>
          <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" strokeWidth={2} />
            </div>
            <div className="flex-1">
              <p className="text-sm text-foreground">AI usage spike detected</p>
              <p className="text-xs text-muted-foreground">15 minutes ago</p>
            </div>
            <Badge variant="secondary" className="text-xs">AI</Badge>
          </div>
          <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-purple-600 dark:text-purple-400" strokeWidth={2} />
            </div>
            <div className="flex-1">
              <p className="text-sm text-foreground">New class created</p>
              <p className="text-xs text-muted-foreground">1 hour ago</p>
            </div>
            <Badge variant="secondary" className="text-xs">Class</Badge>
          </div>
        </div>
      </div>
    </div>
  );
}
