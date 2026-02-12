import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { KnowledgeProvider, getConnectionStatus } from '@/lib/composio';

export async function GET(req: NextRequest) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const redirect = req.nextUrl.searchParams.get('redirect');
  const redirectPath = redirect || '/knowledge';
  const separator = redirectPath.includes('?') ? '&' : '?';

  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    const provider = req.nextUrl.searchParams.get('provider') as KnowledgeProvider;

    if (!user) {
      return NextResponse.redirect(`${siteUrl}/login`);
    }

    if (!provider) {
      return NextResponse.redirect(`${siteUrl}/knowledge?error=missing_provider`);
    }

    // Verify the connection actually succeeded on the Composio side
    const connection = await getConnectionStatus(user.id, provider);
    if (!connection) {
      // OAuth was cancelled or failed — mark as failed and redirect with error
      await supabase
        .from('connected_accounts')
        .update({ status: 'failed' })
        .eq('user_id', user.id)
        .eq('provider', provider);

      return NextResponse.redirect(`${siteUrl}${redirectPath}${separator}error=connection_failed`);
    }

    // Connection verified — mark as active
    await supabase
      .from('connected_accounts')
      .update({
        status: 'active',
        connected_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('provider', provider);

    return NextResponse.redirect(`${siteUrl}${redirectPath}${separator}connected=${provider}`);
  } catch (error) {
    console.error('Knowledge callback error:', error);
    return NextResponse.redirect(`${siteUrl}${redirectPath}${separator}error=callback_failed`);
  }
}
