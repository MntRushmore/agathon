import { createServiceRoleClient } from '@/lib/supabase/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { resend } from '@/lib/resend';
import { NextResponse } from 'next/server';
import ReferralAnnouncement from '@/emails/ReferralAnnouncement';

export async function POST() {
  try {
    // Verify admin
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
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    // Fetch all waitlist entries with referral codes
    const serviceClient = createServiceRoleClient();
    const { data: entries, error } = await serviceClient
      .from('waitlist')
      .select('id, email, name, referral_code')
      .not('referral_code', 'is', null)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to fetch waitlist:', error);
      return NextResponse.json({ error: 'Failed to fetch waitlist' }, { status: 500 });
    }

    if (!entries || entries.length === 0) {
      return NextResponse.json({ message: 'No waitlist entries found', sent: 0 });
    }

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    // Send emails in batches of 10 to avoid rate limits
    for (let i = 0; i < entries.length; i += 10) {
      const batch = entries.slice(i, i + 10);

      const results = await Promise.allSettled(
        batch.map(async (entry) => {
          const { error: emailError } = await resend.emails.send({
            from: 'Agathon <send@mail.agathon.app>',
            replyTo: 'rushil@agathon.app',
            to: entry.email,
            subject: "You now have a referral link — share it, earn cash",
            react: ReferralAnnouncement({
              name: entry.name || undefined,
              referralCode: entry.referral_code,
            }),
          });

          if (emailError) {
            throw new Error(`${entry.email}: ${emailError.message}`);
          }
        })
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          sent++;
        } else {
          failed++;
          errors.push(result.reason?.message || 'Unknown error');
        }
      }

      // Small delay between batches
      if (i + 10 < entries.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return NextResponse.json({
      message: `Sent ${sent} emails, ${failed} failed`,
      sent,
      failed,
      total: entries.length,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    });
  } catch (error) {
    console.error('Send referral emails error:', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
