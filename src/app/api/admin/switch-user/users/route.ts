import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server';

/**
 * Lists all user profiles for the profile switcher.
 * Uses the service role client to bypass RLS (since the caller may
 * be signed in as a non-admin during a profile switch).
 * Requires at minimum an authenticated session.
 */
export async function GET() {
  try {
    // Require at least an authenticated user
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const adminClient = createServiceRoleClient();

    const { data, error } = await adminClient
      .from('profiles')
      .select('id, email, full_name, role')
      .order('role', { ascending: true })
      .order('full_name', { ascending: true })
      .limit(50);

    if (error) throw error;

    return NextResponse.json({ users: data || [] });
  } catch (error) {
    console.error('Error fetching users for switch:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}
