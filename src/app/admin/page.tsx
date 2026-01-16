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

  const estimatedCost = (stats?.totalAIUsage || 0) * 0.002;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Platform Overview</h1>
        <p className="text-muted-foreground">
          Monitor and manage your educational platform
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Data</AlertTitle>
          <AlertDescription>
            {error}
            <br />
            <br />
            Run the <code className="bg-destructive/10 px-1 rounded">FIX_INFINITE_RECURSION.sql</code> script in your Supabase SQL editor to fix database permission issues.
          </AlertDescription>
        </Alert>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Users</p>
                <p className="text-3xl font-bold">{stats?.totalUsers}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {stats?.totalStudents} students, {stats?.totalTeachers} teachers, {stats?.totalAdmins} admins
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Classes</p>
                <p className="text-3xl font-bold">{stats?.totalClasses}</p>
              </div>
              <BookOpen className="h-8 w-8 text-green-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {stats?.totalAssignments} assignments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">AI Interactions</p>
                <p className="text-3xl font-bold">{stats?.totalAIUsage}</p>
              </div>
              <Sparkles className="h-8 w-8 text-purple-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Est. cost: ${estimatedCost.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Growth (7 days)</p>
                <p className="text-3xl font-bold">+{stats?.newUsersWeek}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-emerald-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {stats?.newUsersMonth} this month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Additional Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AI Usage Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              AI Usage by Mode
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(stats?.aiByMode || {}).length === 0 ? (
                <p className="text-muted-foreground text-sm">No AI usage recorded yet</p>
              ) : (
                Object.entries(stats?.aiByMode || {}).map(([mode, count]) => (
                  <div key={mode} className="flex items-center justify-between">
                    <span className="capitalize">{mode}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Content Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layout className="h-5 w-5" />
              Content Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Layout className="h-4 w-4 text-muted-foreground" />
                  Total Boards
                </span>
                <span className="font-medium">{stats?.totalBoards}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  Total Submissions
                </span>
                <span className="font-medium">{stats?.totalSubmissions}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                  Total Assignments
                </span>
                <span className="font-medium">{stats?.totalAssignments}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
