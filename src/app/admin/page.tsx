'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/auth/auth-provider';
import {
  Users,
  BookOpen,
  Sparkles,
  TrendingUp,
  FileText,
  Layout,
  AlertCircle,
} from 'lucide-react';

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
  const { profile } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    } catch (error: any) {
      console.error('Error loading admin dashboard:', error);
      setError(error?.message || 'Failed to load dashboard data.');
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Overview</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Platform statistics and insights
        </p>
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
    </div>
  );
}
