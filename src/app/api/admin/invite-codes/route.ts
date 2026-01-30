import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: codes, error } = await supabase
      .from('invite_codes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch codes' }, { status: 500 });
    }

    return NextResponse.json({ codes });
  } catch (error) {
    console.error('Admin invite codes GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { label, max_uses = 1, expires_at } = await req.json();

    // Generate unique code
    const { data: codeResult, error: codeError } = await supabase.rpc('generate_invite_code');

    if (codeError || !codeResult) {
      return NextResponse.json({ error: 'Failed to generate code' }, { status: 500 });
    }

    const { data: inviteCode, error: insertError } = await supabase
      .from('invite_codes')
      .insert({
        code: codeResult,
        label: label || null,
        created_by: user.id,
        max_uses,
        expires_at: expires_at || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert invite code error:', insertError);
      return NextResponse.json({ error: 'Failed to create invite code' }, { status: 500 });
    }

    // Audit log
    await supabase.from('admin_audit_logs').insert({
      admin_id: user.id,
      action_type: 'invite_code_create',
      target_type: 'invite_code',
      target_id: inviteCode.id,
      target_details: { code: inviteCode.code, label, max_uses },
    });

    return NextResponse.json({ code: inviteCode });
  } catch (error) {
    console.error('Admin invite codes POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id, is_active } = await req.json();

    if (!id || typeof is_active !== 'boolean') {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const { error } = await supabase
      .from('invite_codes')
      .update({ is_active })
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: 'Failed to update code' }, { status: 500 });
    }

    // Audit log
    await supabase.from('admin_audit_logs').insert({
      admin_id: user.id,
      action_type: is_active ? 'invite_code_activate' : 'invite_code_deactivate',
      target_type: 'invite_code',
      target_id: id,
      target_details: { is_active },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin invite codes PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
