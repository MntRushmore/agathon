import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { KnowledgeProvider } from '@/lib/composio';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    const provider = req.nextUrl.searchParams.get('provider') as KnowledgeProvider;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    if (!user) {
      return NextResponse.redirect(`${siteUrl}/login`);
    }

    if (!provider) {
      return NextResponse.redirect(`${siteUrl}/knowledge?error=missing_provider`);
    }

    // Update connection status to active
    await supabase
      .from('connected_accounts')
      .update({
        status: 'active',
        connected_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('provider', provider);

    // Redirect to the specified page or default to knowledge page
    const redirect = req.nextUrl.searchParams.get('redirect');
    const redirectPath = redirect || '/knowledge';
    const separator = redirectPath.includes('?') ? '&' : '?';
    return NextResponse.redirect(`${siteUrl}${redirectPath}${separator}connected=${provider}`);
  } catch (error) {
    console.error('Knowledge callback error:', error);
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const redirect = req.nextUrl.searchParams.get('redirect');
    const redirectPath = redirect || '/knowledge';
    const separator = redirectPath.includes('?') ? '&' : '?';
    return NextResponse.redirect(`${siteUrl}${redirectPath}${separator}error=callback_failed`);
  }
}
