import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const ALLOWED_REDIRECTS = [
  '/',
  '/auth/complete-signup',
  '/teacher',
  '/admin',
  '/board',
  '/journal',
  '/math',
  '/profile',
  '/settings',
  '/credits',
  '/billing',
  '/student',
];

function getSafeRedirect(next: string): string {
  if (!next.startsWith('/') || next.startsWith('//')) {
    return '/';
  }

  const isAllowed = ALLOWED_REDIRECTS.some(
    (prefix) => next === prefix || next.startsWith(`${prefix}/`)
  );

  return isAllowed ? next : '/';
}

export async function handleAuthCallback(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = getSafeRedirect(requestUrl.searchParams.get('next') ?? '/');
  const successUrl = new URL(next, `${requestUrl.origin}/`);
  const errorUrl = new URL('/login?error=auth_failed', `${requestUrl.origin}/`);

  if (!code) {
    return NextResponse.redirect(successUrl);
  }

  const cookieStore = await cookies();
  const redirectResponse = NextResponse.redirect(successUrl);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
            redirectResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('Error exchanging code for session:', error);
    return NextResponse.redirect(errorUrl);
  }

  return redirectResponse;
}
