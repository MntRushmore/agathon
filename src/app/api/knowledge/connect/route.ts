import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { initiateConnection, PROVIDERS, KnowledgeProvider } from '@/lib/composio';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { provider, redirect } = await req.json() as { provider: KnowledgeProvider; redirect?: string };

    if (!provider || !PROVIDERS[provider]) {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    let callbackUrl = `${siteUrl}/api/knowledge/callback?provider=${provider}`;
    if (redirect) {
      callbackUrl += `&redirect=${encodeURIComponent(redirect)}`;
    }

    const connectionRequest = await initiateConnection(user.id, provider, callbackUrl);

    // Store the pending connection in our DB
    await supabase
      .from('connected_accounts')
      .upsert({
        user_id: user.id,
        provider,
        composio_account_id: connectionRequest.id,
        status: 'initiated',
        display_name: PROVIDERS[provider].label,
      }, { onConflict: 'user_id,provider' });

    return NextResponse.json({ redirectUrl: connectionRequest.redirectUrl });
  } catch (error) {
    console.error('Knowledge connect error:', error);
    return NextResponse.json({ error: 'Failed to initiate connection' }, { status: 500 });
  }
}
