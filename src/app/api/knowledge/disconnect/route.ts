import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { KnowledgeProvider, PROVIDERS, deleteComposioConnection } from '@/lib/composio';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { provider } = await req.json() as { provider: KnowledgeProvider };

    if (!provider || !PROVIDERS[provider]) {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
    }

    // Remove Composio connection first
    await deleteComposioConnection(user.id, provider);

    // Remove connected account from our DB
    await supabase
      .from('connected_accounts')
      .delete()
      .eq('user_id', user.id)
      .eq('provider', provider);

    // Remove synced content from this provider
    await supabase
      .from('knowledge_base')
      .delete()
      .eq('user_id', user.id)
      .eq('source', provider);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Knowledge disconnect error:', error);
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
  }
}
