import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const status: Record<string, unknown> = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'dev',
  };

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from('profiles').select('id').limit(1);
    status.database = error ? 'error' : 'connected';
  } catch {
    status.database = 'error';
    status.status = 'degraded';
  }

  const httpStatus = status.status === 'ok' ? 200 : 503;
  return NextResponse.json(status, { status: httpStatus });
}
