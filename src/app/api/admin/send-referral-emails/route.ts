import { createServiceRoleClient } from '@/lib/supabase/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getResend } from '@/lib/resend';
import { NextResponse } from 'next/server';
import ReferralAnnouncement from '@/emails/ReferralAnnouncement';

function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

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

    const serviceClient = createServiceRoleClient();

    // Try to fetch with referral_email_sent column, fall back without it
    let entries: { id: string; email: string; name: string | null; referral_code: string; referral_email_sent?: boolean }[] | null = null;
    let hasTrackingColumn = true;

    const { data, error } = await serviceClient
      .from('waitlist')
      .select('id, email, name, referral_code, referral_email_sent')
      .order('created_at', { ascending: true });

    if (error && error.message?.includes('referral_email_sent')) {
      // Column doesn't exist yet — fetch without it
      hasTrackingColumn = false;
      const { data: fallbackData, error: fallbackError } = await serviceClient
        .from('waitlist')
        .select('id, email, name, referral_code')
        .order('created_at', { ascending: true });

      if (fallbackError) {
        console.error('Failed to fetch waitlist:', fallbackError);
        return NextResponse.json({ error: 'Failed to fetch waitlist' }, { status: 500 });
      }
      entries = fallbackData;
    } else if (error) {
      console.error('Failed to fetch waitlist:', error);
      return NextResponse.json({ error: 'Failed to fetch waitlist' }, { status: 500 });
    } else {
      entries = data;
    }

    if (error) {
      console.error('Failed to fetch waitlist:', error);
      return NextResponse.json({ error: 'Failed to fetch waitlist' }, { status: 500 });
    }

    if (!entries || entries.length === 0) {
      return NextResponse.json({ message: 'No waitlist entries found', sent: 0 });
    }

    // Filter to only unsent entries
    const unsent = entries.filter((e) => !e.referral_email_sent);

    if (unsent.length === 0) {
      return NextResponse.json({ message: 'All emails already sent!', sent: 0, skipped: entries.length });
    }

    // Backfill referral codes for any entries missing them
    for (const entry of unsent) {
      if (!entry.referral_code) {
        const code = generateReferralCode();
        await serviceClient
          .from('waitlist')
          .update({ referral_code: code })
          .eq('id', entry.id);
        entry.referral_code = code;
      }
    }

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    // Send emails one at a time with 3s delay to avoid rate limits
    for (let i = 0; i < unsent.length; i++) {
      const entry = unsent[i];

      try {
        const resend = await getResend();
        const { error: emailError } = await resend.emails.send({
          from: 'Agathon <send@mail.agathon.app>',
          replyTo: 'rushil@agathon.app',
          to: entry.email,
          subject: "Progress update + your personal referral link",
          react: ReferralAnnouncement({
            name: entry.name || undefined,
            referralCode: entry.referral_code,
          }),
        });

        if (emailError) {
          errors.push(`${entry.email}: ${emailError.message}`);
          failed++;
        } else {
          // Mark as sent so we don't send again
          if (hasTrackingColumn) {
            await serviceClient
              .from('waitlist')
              .update({ referral_email_sent: true } as Record<string, unknown>)
              .eq('id', entry.id);
          }
          sent++;
        }
      } catch (err) {
        errors.push(`${entry.email}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        failed++;
      }

      // 3 second delay between each email
      if (i < unsent.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }

    return NextResponse.json({
      message: `Sent ${sent} emails, ${failed} failed, ${entries.length - unsent.length} skipped (already sent)`,
      sent,
      failed,
      skipped: entries.length - unsent.length,
      total: entries.length,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    });
  } catch (error) {
    console.error('Send referral emails error:', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
