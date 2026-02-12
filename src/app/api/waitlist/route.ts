import { createServerSupabaseClient } from '@/lib/supabase/server';
import { resend } from '@/lib/resend';
import { NextRequest, NextResponse } from 'next/server';
import WaitlistWelcome from '@/emails/WaitlistWelcome';
import WaitlistTeacher from '@/emails/WaitlistTeacher';
import WaitlistParent from '@/emails/WaitlistParent';

function getEmailForRole(role: string, name?: string) {
  switch (role) {
    case 'teacher':
      return {
        subject: "You're on the list — built for educators like you",
        react: WaitlistTeacher({ name }),
      };
    case 'parent':
      return {
        subject: "You're on the list — we're building something your child will love",
        react: WaitlistParent({ name }),
      };
    default:
      return {
        subject: "You're on the list — welcome to Agathon",
        react: WaitlistWelcome({ name }),
      };
  }
}

export async function POST(request: NextRequest) {
  try {
    const { email, name, role } = await request.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Valid email is required' },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabaseClient();

    // Check if email already exists
    const { data: existing } = await supabase
      .from('waitlist')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existing) {
      return NextResponse.json(
        { message: "You're already on the waitlist!", alreadyExists: true },
        { status: 200 }
      );
    }

    // Insert new waitlist entry
    const { error } = await supabase.from('waitlist').insert({
      email: email.toLowerCase(),
      name: name || null,
      role: role || 'student',
    });

    if (error) {
      console.error('Waitlist insert error:', error);
      return NextResponse.json(
        { error: 'Failed to join waitlist' },
        { status: 500 }
      );
    }

    // Send role-specific welcome email
    const userRole = role || 'student';
    const { subject, react } = getEmailForRole(userRole, name || undefined);

    const { error: emailError } = await resend.emails.send({
      from: 'Agathon <send@mail.agathon.app>',
      replyTo: 'rushil@agathon.app',
      to: email.toLowerCase(),
      subject,
      react,
    });

    if (emailError) {
      console.error('Email send error:', emailError);
      // Don't fail the request if email fails — the user is still on the waitlist
    }

    return NextResponse.json(
      { message: "You're on the list! We'll be in touch soon.", success: true },
      { status: 200 }
    );
  } catch (error) {
    console.error('Waitlist API error:', error);
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    );
  }
}
