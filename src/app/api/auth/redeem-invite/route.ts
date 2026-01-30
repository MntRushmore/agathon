import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { code } = await req.json();

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Invite code is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.rpc('redeem_invite_code', {
      p_code: code,
      p_user_id: user.id,
    });

    if (error) {
      console.error('Invite code redeem error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to redeem code' },
        { status: 500 }
      );
    }

    const result = data?.[0];
    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Invalid invite code' },
        { status: 200 }
      );
    }

    return NextResponse.json({
      success: result.success,
      error: result.error_message || undefined,
    });
  } catch (error) {
    console.error('Redeem invite error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
