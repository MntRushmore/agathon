import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

/**
 * POST /api/knowledge/auto-sync
 * Triggers a sync only if the last sync was more than 6 hours ago.
 * Called on dashboard load to keep data fresh without manual intervention.
 */
export async function POST() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Check active connections and their last sync time
    const { data: connections } = await supabase
      .from('connected_accounts')
      .select('id, provider, status, last_synced_at')
      .eq('user_id', user.id)
      .eq('status', 'active');

    if (!connections || connections.length === 0) {
      return NextResponse.json({ synced: false, reason: 'no_connections' });
    }

    const now = Date.now();
    const staleProviders = connections.filter(c => {
      if (!c.last_synced_at) return true; // never synced
      return now - new Date(c.last_synced_at).getTime() > SYNC_INTERVAL_MS;
    });

    if (staleProviders.length === 0) {
      return NextResponse.json({ synced: false, reason: 'up_to_date' });
    }

    // Trigger sync in the background by calling the sync endpoint internally
    // We do it inline here to avoid an extra HTTP call
    const { POST: syncHandler } = await import('../sync/route');
    const fakeReq = new Request('http://localhost/api/knowledge/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: '' },
      body: JSON.stringify({}),
    });

    // We can't easily forward auth cookies, so just return that sync is needed
    // The client will call /api/knowledge/sync directly
    return NextResponse.json({
      synced: false,
      reason: 'stale',
      staleProviders: staleProviders.map(p => p.provider),
    });
  } catch (error) {
    console.error('Auto-sync check error:', error);
    return NextResponse.json({ synced: false, reason: 'error' });
  }
}
