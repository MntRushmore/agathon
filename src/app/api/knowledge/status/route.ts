import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get connected accounts (include expired so UI can show re-auth prompt)
    const { data: connections } = await supabase
      .from('connected_accounts')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['active', 'expired']);

    // Get knowledge base stats
    const { data: docs } = await supabase
      .from('knowledge_base')
      .select('id, source, title, content, metadata, synced_at')
      .eq('user_id', user.id)
      .order('synced_at', { ascending: false });

    return NextResponse.json({
      connections: connections || [],
      documents: docs || [],
      totalDocuments: docs?.length || 0,
    });
  } catch (error) {
    console.error('Knowledge status error:', error);
    return NextResponse.json({ error: 'Failed to get status' }, { status: 500 });
  }
}
