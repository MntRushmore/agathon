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

    const { code, forceRedeem } = await req.json();

    // If forceRedeem is set, the user already validated an invite at signup but
    // redemption didn't complete. Just mark them as redeemed.
    if (forceRedeem) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ invite_redeemed: true })
        .eq('id', user.id);

      if (updateError) {
        console.error('Force redeem error:', updateError);
        return NextResponse.json(
          { success: false, error: 'Failed to update profile' },
          { status: 500 }
        );
      }
      return NextResponse.json({ success: true });
    }

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
        { status: 400 }
      );
    }

    if (!result.success) {
      // The code exists but may have expired or hit its usage limit between
      // validation (at signup) and redemption (now). If the code is real
      // (admin-issued), the user legitimately signed up — mark them redeemed.
      const cleanedCode = code.replace(/[-\s]/g, '').toUpperCase();
      const { data: codeRow } = await supabase
        .from('invite_codes')
        .select('id')
        .eq('code', cleanedCode)
        .single();

      if (codeRow) {
        // Real code — forgive expiration/usage limits
        await supabase
          .from('profiles')
          .update({ invite_redeemed: true })
          .eq('id', user.id);
        return NextResponse.json({ success: true });
      }

      return NextResponse.json(
        { success: false, error: result.error_message || 'Failed to redeem invite code' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Redeem invite error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
