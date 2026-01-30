import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const now = new Date();
    const ranges = {
      '7d': new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      '30d': new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      '90d': new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    };

    // Fetch growth data and engagement in parallel
    const [
      usersWeekResult,
      usersMonthResult,
      users90dResult,
      totalUsersResult,
      aiWeekResult,
      aiMonthResult,
      boardsWeekResult,
      boardsMonthResult,
      submissionsWeekResult,
      submissionsMonthResult,
      recentUsersResult,
      aiByModeResult,
      creditTxResult,
    ] = await Promise.all([
      supabase.from('profiles').select('created_at').gte('created_at', ranges['7d']),
      supabase.from('profiles').select('created_at').gte('created_at', ranges['30d']),
      supabase.from('profiles').select('created_at').gte('created_at', ranges['90d']),
      supabase.from('profiles').select('role'),
      supabase.from('ai_usage').select('*', { count: 'exact', head: true }).gte('created_at', ranges['7d']),
      supabase.from('ai_usage').select('*', { count: 'exact', head: true }).gte('created_at', ranges['30d']),
      supabase.from('whiteboards').select('*', { count: 'exact', head: true }).gte('created_at', ranges['7d']),
      supabase.from('whiteboards').select('*', { count: 'exact', head: true }).gte('created_at', ranges['30d']),
      supabase.from('submissions').select('*', { count: 'exact', head: true }).gte('created_at', ranges['7d']),
      supabase.from('submissions').select('*', { count: 'exact', head: true }).gte('created_at', ranges['30d']),
      supabase.from('profiles').select('created_at, role').order('created_at', { ascending: false }).limit(200),
      supabase.from('ai_usage').select('mode').gte('created_at', ranges['30d']),
      supabase.from('credit_transactions').select('transaction_type, amount').gte('created_at', ranges['30d']),
    ]);

    // Build daily signup counts for the last 30 days
    const dailySignups: Record<string, number> = {};
    const monthUsers = usersMonthResult.data || [];
    for (const u of monthUsers) {
      const day = u.created_at.split('T')[0];
      dailySignups[day] = (dailySignups[day] || 0) + 1;
    }

    // Role breakdown
    const allUsers = totalUsersResult.data || [];
    const roleBreakdown = allUsers.reduce((acc: Record<string, number>, u: { role: string }) => {
      acc[u.role] = (acc[u.role] || 0) + 1;
      return acc;
    }, {});

    // AI mode breakdown (last 30d)
    const aiModes = (aiByModeResult.data || []).reduce((acc: Record<string, number>, u: { mode: string }) => {
      acc[u.mode] = (acc[u.mode] || 0) + 1;
      return acc;
    }, {});

    // Credit transaction breakdown
    const creditBreakdown = (creditTxResult.data || []).reduce(
      (acc: Record<string, { count: number; total: number }>, tx: { transaction_type: string; amount: number }) => {
        if (!acc[tx.transaction_type]) {
          acc[tx.transaction_type] = { count: 0, total: 0 };
        }
        acc[tx.transaction_type].count += 1;
        acc[tx.transaction_type].total += tx.amount;
        return acc;
      },
      {}
    );

    return NextResponse.json({
      growth: {
        dailySignups,
        usersThisWeek: usersWeekResult.data?.length || 0,
        usersThisMonth: monthUsers.length,
        usersLast90d: users90dResult.data?.length || 0,
        totalUsers: allUsers.length,
        roleBreakdown,
      },
      engagement: {
        aiRequestsWeek: aiWeekResult.count || 0,
        aiRequestsMonth: aiMonthResult.count || 0,
        boardsWeek: boardsWeekResult.count || 0,
        boardsMonth: boardsMonthResult.count || 0,
        submissionsWeek: submissionsWeekResult.count || 0,
        submissionsMonth: submissionsMonthResult.count || 0,
        aiByMode: aiModes,
      },
      credits: creditBreakdown,
    });
  } catch (error) {
    console.error('Admin analytics error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
