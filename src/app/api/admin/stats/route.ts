import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch all stats in parallel
    const [
      { count: totalUsers },
      { count: totalStudents },
      { count: totalTeachers },
      { count: totalAdmins },
      { count: totalClasses },
      { count: totalAssignments },
      { count: totalBoards },
      { count: totalSubmissions },
      { count: totalAIUsage },
      { data: aiUsageByMode },
    ] = await Promise.all([
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

    // Calculate AI usage by mode
    const modeBreakdown = (aiUsageByMode || []).reduce(
      (acc: Record<string, number>, u: { mode: string }) => {
        acc[u.mode] = (acc[u.mode] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    // Growth metrics
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [{ count: newUsersWeek }, { count: newUsersMonth }] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', monthAgo),
    ]);

    return NextResponse.json({
      users: {
        total: totalUsers || 0,
        students: totalStudents || 0,
        teachers: totalTeachers || 0,
        admins: totalAdmins || 0,
      },
      content: {
        classes: totalClasses || 0,
        assignments: totalAssignments || 0,
        boards: totalBoards || 0,
        submissions: totalSubmissions || 0,
      },
      ai: {
        totalInteractions: totalAIUsage || 0,
        byMode: modeBreakdown,
        estimatedCost: (totalAIUsage || 0) * 0.002,
      },
      growth: {
        newUsersWeek: newUsersWeek || 0,
        newUsersMonth: newUsersMonth || 0,
      },
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
