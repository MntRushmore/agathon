import { createServiceRoleClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = createServiceRoleClient();

    const { data, error } = await supabase.rpc('get_referral_leaderboard', {
      p_limit: 50,
    });

    if (error) {
      console.error('Leaderboard fetch error:', error);
      return NextResponse.json(
        { error: 'Failed to load leaderboard' },
        { status: 500 }
      );
    }

    // Anonymize names: show first name + last initial only
    const leaderboard = (data || []).map((entry: { id: string; name: string | null; referral_code: string; referral_count: number; rank: number }) => {
      let displayName = 'Anonymous';
      if (entry.name) {
        const parts = entry.name.trim().split(/\s+/);
        displayName = parts.length > 1
          ? `${parts[0]} ${parts[parts.length - 1][0]}.`
          : parts[0];
      }
      return {
        rank: entry.rank,
        name: displayName,
        referralCode: entry.referral_code,
        referralCount: entry.referral_count,
      };
    });

    return NextResponse.json({ leaderboard });
  } catch (error) {
    console.error('Leaderboard API error:', error);
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    );
  }
}
