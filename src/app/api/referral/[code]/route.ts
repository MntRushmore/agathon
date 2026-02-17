import { createServiceRoleClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const cleanedCode = code.replace(/[-\s]/g, '').toUpperCase();

    if (!cleanedCode || cleanedCode.length < 8) {
      return NextResponse.json(
        { error: 'Invalid referral code' },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    // Get stats for this specific code
    const { data, error } = await supabase.rpc('get_referral_stats', {
      p_code: cleanedCode,
    });

    if (error) {
      console.error('Referral stats error:', error);
      return NextResponse.json(
        { error: 'Failed to load referral stats' },
        { status: 500 }
      );
    }

    const entry = data?.[0];

    if (!entry) {
      // Code exists but has 0 referrals — fetch basic info directly
      const { data: waitlistEntry } = await supabase
        .from('waitlist')
        .select('id, name, referral_code, referral_count')
        .eq('referral_code', cleanedCode)
        .single();

      if (!waitlistEntry) {
        return NextResponse.json(
          { error: 'Referral code not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        referralCode: waitlistEntry.referral_code,
        referralCount: waitlistEntry.referral_count,
        rank: null,
        name: waitlistEntry.name || 'Anonymous',
      });
    }

    return NextResponse.json({
      referralCode: entry.referral_code,
      referralCount: entry.referral_count,
      rank: entry.rank,
      name: entry.name || 'Anonymous',
    });
  } catch (error) {
    console.error('Referral stats API error:', error);
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    );
  }
}
