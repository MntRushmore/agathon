import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { valid: false, error: 'Invite code is required' },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc('validate_invite_code', {
      p_code: code,
    });

    if (error) {
      console.error('Invite code validation error:', error);
      return NextResponse.json(
        { valid: false, error: 'Failed to validate code' },
        { status: 500 }
      );
    }

    const result = data?.[0];
    if (!result) {
      return NextResponse.json(
        { valid: false, error: 'Invalid invite code' },
        { status: 400 }
      );
    }

    if (!result.valid) {
      return NextResponse.json(
        { valid: false, error: result.error_message || 'Invalid invite code' },
        { status: 400 }
      );
    }

    return NextResponse.json({ valid: true });
  } catch (error) {
    console.error('Validate invite error:', error);
    return NextResponse.json(
      { valid: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
