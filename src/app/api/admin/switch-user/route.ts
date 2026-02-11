import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server';

/**
 * Extracts the user ID from a Supabase JWT access token.
 * Decodes the payload without cryptographic verification (we verify the
 * user's admin role via the service role client instead).
 */
function extractUserIdFromJwt(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload.sub || null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { targetUserId, adminAccessToken } = await req.json() as {
      targetUserId: string;
      adminAccessToken?: string;
    };

    if (!targetUserId) {
      return NextResponse.json({ error: 'targetUserId is required' }, { status: 400 });
    }

    const adminClient = createServiceRoleClient();

    // Determine if the caller is an admin. Two paths:
    // 1. Caller's profile has role 'admin' (first switch)
    // 2. Caller is switched but provides their saved admin access token (subsequent switches)
    let adminUserId = user.id;
    let isAuthorized = false;

    const { data: callerProfile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (callerProfile?.role === 'admin') {
      isAuthorized = true;
    } else if (adminAccessToken) {
      // Extract admin user ID from the saved JWT and verify their role
      const savedAdminId = extractUserIdFromJwt(adminAccessToken);
      if (savedAdminId) {
        const { data: adminProfile } = await adminClient
          .from('profiles')
          .select('role')
          .eq('id', savedAdminId)
          .single();

        if (adminProfile?.role === 'admin') {
          isAuthorized = true;
          adminUserId = savedAdminId;
        }
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    if (targetUserId === user.id) {
      return NextResponse.json({ error: 'Cannot switch to yourself' }, { status: 400 });
    }

    // Get the target user's email
    const { data: targetUser, error: targetError } = await adminClient.auth.admin.getUserById(targetUserId);

    if (targetError || !targetUser?.user?.email) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 });
    }

    // Generate a magic link for the target user
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: targetUser.user.email,
    });

    if (linkError || !linkData?.properties?.hashed_token) {
      console.error('Error generating link:', linkError);
      return NextResponse.json({ error: 'Failed to generate sign-in token' }, { status: 500 });
    }

    // Log to audit (use service role since we might be signed in as non-admin)
    await adminClient.from('admin_audit_logs').insert({
      admin_id: adminUserId,
      action_type: 'user_impersonate',
      target_type: 'user',
      target_id: targetUserId,
      target_details: { email: targetUser.user.email },
    });

    return NextResponse.json({
      token_hash: linkData.properties.hashed_token,
      email: targetUser.user.email,
    });
  } catch (error) {
    console.error('Switch user error:', error);
    return NextResponse.json({ error: 'Failed to switch user' }, { status: 500 });
  }
}
