import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// Allowed internal redirect paths after OAuth callback
const ALLOWED_REDIRECTS = ['/', '/auth/complete-signup', '/teacher', '/admin', '/board', '/journal', '/math', '/profile', '/settings', '/credits', '/billing', '/student/join'];

function getSafeRedirect(next: string): string {
  // Only allow relative paths that start with /
  if (!next.startsWith('/') || next.startsWith('//')) {
    return '/';
  }
  // Check if the path matches an allowed prefix
  const isAllowed = ALLOWED_REDIRECTS.some(prefix => next === prefix || next.startsWith(prefix + '/'));
  return isAllowed ? next : '/';
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const origin = requestUrl.origin;
  const next = getSafeRedirect(requestUrl.searchParams.get('next') ?? '/');

  if (code) {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('Error exchanging code for session:', error);
      return NextResponse.redirect(`${origin}/login?error=auth_failed`);
    }
  }

  // URL to redirect to after sign in process completes
  return NextResponse.redirect(`${origin}${next}`);
}
