import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

const log = logger.child({ module: 'documents' });

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(100);

  if (error) {
    log.error({ err: error }, 'Failed to fetch documents');
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { title, content } = await request.json();

  const { data, error } = await supabase
    .from('documents')
    .insert([{ title, content, user_id: user.id }])
    .select()
    .single();

  if (error) {
    log.error({ err: error }, 'Failed to create document');
    return NextResponse.json({ error: 'Failed to create document' }, { status: 500 });
  }

  return NextResponse.json(data);
}
