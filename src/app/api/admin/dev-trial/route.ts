import { NextRequest, NextResponse } from 'next/server';
import { adminLogger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// POST /api/admin/dev-trial
// Creates a single-use, 24-hour trial invite code for developer candidate evaluation.
// The code is flagged as is_trial=true so that on redemption the user's profile
// gets trial_expires_at stamped. Middleware then lazily revokes access on expiry.
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

    const { label, hours = 24 } = await req.json().catch(() => ({}));

    if (typeof hours !== 'number' || hours < 1 || hours > 168) {
      return NextResponse.json(
        { error: 'hours must be between 1 and 168 (one week max)' },
        { status: 400 }
      );
    }

    // Generate a unique code
    const { data: codeResult, error: codeError } = await supabase.rpc('generate_invite_code');
    if (codeError || !codeResult) {
      return NextResponse.json({ error: 'Failed to generate code' }, { status: 500 });
    }

    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

    const { data: inviteCode, error: insertError } = await supabase
      .from('invite_codes')
      .insert({
        code: codeResult,
        label: label || `Dev trial (${hours}h)`,
        created_by: user.id,
        max_uses: 1,
        expires_at: expiresAt,
        is_trial: true,
      })
      .select()
      .single();

    if (insertError) {
      adminLogger.error({ err: insertError }, 'Insert dev trial code error');
      return NextResponse.json({ error: 'Failed to create trial code' }, { status: 500 });
    }

    await supabase.from('admin_audit_logs').insert({
      admin_id: user.id,
      action_type: 'dev_trial_create',
      target_type: 'invite_code',
      target_id: inviteCode.id,
      target_details: { code: inviteCode.code, label: inviteCode.label, hours },
    });

    adminLogger.info({ code: inviteCode.code, hours, admin: user.id }, 'Dev trial code created');

    return NextResponse.json({
      code: inviteCode.code,
      expires_at: expiresAt,
      hours,
      label: inviteCode.label,
    });
  } catch (error) {
    adminLogger.error({ err: error }, 'Admin dev-trial POST error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/admin/dev-trial
// Lists all active trial codes and currently active trial users.
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

    // Fetch all trial codes with their usage info
    const { data: codes, error: codesError } = await supabase
      .from('invite_codes')
      .select('id, code, label, current_uses, max_uses, expires_at, is_active, created_at')
      .eq('is_trial', true)
      .order('created_at', { ascending: false })
      .limit(100);

    if (codesError) {
      return NextResponse.json({ error: 'Failed to fetch trial codes' }, { status: 500 });
    }

    // Fetch users currently on an active trial
    const { data: activeTrialUsers, error: usersError } = await supabase
      .from('profiles')
      .select('id, full_name, role, trial_expires_at')
      .not('trial_expires_at', 'is', null)
      .gt('trial_expires_at', new Date().toISOString())
      .order('trial_expires_at', { ascending: true });

    if (usersError) {
      return NextResponse.json({ error: 'Failed to fetch trial users' }, { status: 500 });
    }

    return NextResponse.json({ codes, active_trial_users: activeTrialUsers });
  } catch (error) {
    adminLogger.error({ err: error }, 'Admin dev-trial GET error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
