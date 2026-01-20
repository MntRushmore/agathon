import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const windowStart = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();

  const { data, error } = await supabase
    .from('ai_usage')
    .select('mode, input_tokens, output_tokens, total_cost, created_at, response_summary')
    .eq('student_id', user.id)
    .gte('created_at', windowStart)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to load usage summary', error);
    return NextResponse.json({ error: 'Failed to load usage' }, { status: 500 });
  }

  const usage = data || [];

  const totals = usage.reduce(
    (acc, row) => {
      const mode = row.mode || 'unknown';
      acc.modeBreakdown[mode] = (acc.modeBreakdown[mode] || 0) + 1;
      acc.totalInteractions += 1;
      acc.tokensUsed += (row.input_tokens || 0) + (row.output_tokens || 0);
      acc.totalCost += Number(row.total_cost) || 0;
      return acc;
    },
    {
      totalInteractions: 0,
      tokensUsed: 0,
      totalCost: 0,
      modeBreakdown: {} as Record<string, number>,
    },
  );

  const recent = usage.slice(0, 6).map((row) => ({
    mode: row.mode,
    createdAt: row.created_at,
    summary: row.response_summary,
    tokens: (row.input_tokens || 0) + (row.output_tokens || 0),
  }));

  return NextResponse.json({
    ...totals,
    recent,
    windowStart,
    lastUsedAt: usage[0]?.created_at ?? null,
  });
}
