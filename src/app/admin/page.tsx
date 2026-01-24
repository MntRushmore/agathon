'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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
    // Check if user is admin
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
      // Fetch all stats in parallel with error handling
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

      // Check for any failures
      const failedQueries = results.filter((r) => r.status === 'rejected');
      if (failedQueries.length > 0) {
        console.error('Some queries failed:', failedQueries);
        setError('Some data could not be loaded. Please check database permissions.');
      }

      // Extract successful results
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

      // Calculate total AI cost from actual database values
      const totalAICost = (aiCostData || []).reduce((sum, record) => sum + (Number(record.total_cost) || 0), 0);

      // Calculate AI usage by mode
      const aiByMode = (aiUsageByMode || []).reduce((acc, u) => {
        acc[u.mode] = (acc[u.mode] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Growth metrics
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
      setError(error?.message || 'Failed to load dashboard data. Please check database permissions and run the fix script.');
    } finally {
      setLoading(false);
    }
  };

  // Show loading state while checking auth
  if (!profile || loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded w-1/4 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Don't render if not admin
  if (profile.role !== 'admin') {
    return null;
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Platform Overview</h1>
        <p className="text-muted-foreground mt-1">
          Monitor and manage your educational ecosystem in real-time.
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="bg-destructive/5 border-destructive/20 text-destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>System Alert</AlertTitle>
          <AlertDescription>
            {error}
            <br />
            <br />
            <span className="font-semibold">Action Required:</span> Run the <code className="bg-destructive/10 px-1 rounded mx-1">FIX_ADMIN_PERMISSIONS.sql</code> script in your Supabase SQL editor to resolve database recursion and access issues.
          </AlertDescription>
        </Alert>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-none shadow-sm bg-blue-50/50 dark:bg-blue-950/10">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Total Users</p>
                <p className="text-3xl font-bold mt-1">{stats?.totalUsers}</p>
              </div>
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div className="mt-4 flex gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-400" />{stats?.totalStudents} Students</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-400" />{stats?.totalTeachers} Teachers</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-emerald-50/50 dark:bg-emerald-950/10">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Active Classes</p>
                <p className="text-3xl font-bold mt-1">{stats?.totalClasses}</p>
              </div>
              <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
                <BookOpen className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              {stats?.totalAssignments} assignments across all classes
            </p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-purple-50/50 dark:bg-purple-950/10">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600 dark:text-purple-400">AI Interactions</p>
                <p className="text-3xl font-bold mt-1">{stats?.totalAIUsage}</p>
              </div>
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                <Sparkles className="h-6 w-6 text-purple-600" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Estimated infrastructure cost: <span className="font-semibold text-foreground">${(stats?.totalAICost || 0).toFixed(2)}</span>
            </p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-orange-50/50 dark:bg-orange-950/10">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-600 dark:text-orange-400">Growth</p>
                <p className="text-3xl font-bold mt-1">+{stats?.newUsersWeek}</p>
              </div>
              <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
                <TrendingUp className="h-6 w-6 text-orange-600" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              {stats?.newUsersMonth} new users this month
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* AI Usage Breakdown */}
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              Intelligence Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 pt-4">
              {Object.entries(stats?.aiByMode || {}).length === 0 ? (
                <div className="text-center py-12 bg-muted/30 rounded-xl">
                  <Sparkles className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-muted-foreground text-sm">No AI data available yet</p>
                </div>
              ) : (
                Object.entries(stats?.aiByMode || {}).map(([mode, count]) => (
                  <div key={mode} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="capitalize font-medium">{mode}</span>
                      <span className="text-muted-foreground">{count} usage events</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-purple-500 rounded-full" 
                        style={{ width: `${Math.min(100, (count / (stats?.totalAIUsage || 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Platform Content */}
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Layout className="h-5 w-5 text-blue-500" />
              Content Pulse
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6 pt-4">
              <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/30">
                <div className="p-2 bg-background rounded-lg shadow-sm">
                  <Layout className="h-5 w-5 text-blue-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Total Whiteboards</p>
                  <p className="text-2xl font-bold">{stats?.totalBoards}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/30">
                <div className="p-2 bg-background rounded-lg shadow-sm">
                  <FileText className="h-5 w-5 text-emerald-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Student Submissions</p>
                  <p className="text-2xl font-bold">{stats?.totalSubmissions}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/30">
                <div className="p-2 bg-background rounded-lg shadow-sm">
                  <BookOpen className="h-5 w-5 text-orange-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Active Assignments</p>
                  <p className="text-2xl font-bold">{stats?.totalAssignments}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
