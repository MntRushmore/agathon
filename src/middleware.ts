import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

function applySecurityHeaders(response: NextResponse): NextResponse {
  // Content Security Policy
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      // Avoid allowing inline scripts and eval to reduce XSS risk. If your app
      // requires inline scripts, prefer using nonces or hashes for those scripts.
      "script-src 'self' https://vercel.live https://*.vercel.app",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://fonts.gstatic.com https://cdn.tldraw.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.openai.com https://vercel.live https://*.vercel.app https://cdn.tldraw.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join('; ')
  );

  // Clickjacking protection
  response.headers.set('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // Referrer policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions policy
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()'
  );

  // Strict Transport Security
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=63072000; includeSubDomains; preload'
  );

  return response;
}

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';

  // Handle demo.agathon.app subdomain - serve demo page directly, no auth needed
  if (hostname.startsWith('demo.')) {
    if (request.nextUrl.pathname === '/') {
      const url = request.nextUrl.clone();
      url.pathname = '/demo';
      return applySecurityHeaders(NextResponse.rewrite(url));
    }
    return applySecurityHeaders(NextResponse.next());
  }

  // Handle pitch.agathon.app subdomain - serve pitch deck page
  if (hostname.startsWith('pitch.')) {
    if (request.nextUrl.pathname === '/') {
      const url = request.nextUrl.clone();
      url.pathname = '/pitch';
      return applySecurityHeaders(NextResponse.rewrite(url));
    }
    return applySecurityHeaders(NextResponse.next());
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session if expired - required for Server Components
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Public paths that don't require invite verification
  const publicPaths = ['/', '/login', '/signup', '/auth/', '/api/auth/', '/api/polar/', '/api/waitlist', '/api/referral/', '/referral/', '/terms', '/privacy', '/demo', '/pitch'];
  const isPublicPath = publicPaths.some(path => request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith(path));

  // Enforce invite code redemption for authenticated users on protected routes
  if (user && !isPublicPath) {
    const { data: inviteProfile } = await supabase
      .from('profiles')
      .select('invite_redeemed')
      .eq('id', user.id)
      .single();

    if (inviteProfile && inviteProfile.invite_redeemed === false) {
      const redirectUrl = new URL('/auth/complete-signup', request.url);
      return NextResponse.redirect(redirectUrl);
    }
  }

  // Protect board routes - require authentication
  if (request.nextUrl.pathname.startsWith('/board/') && !user) {
    const redirectUrl = new URL('/', request.url);
    redirectUrl.searchParams.set('auth', 'required');
    return NextResponse.redirect(redirectUrl);
  }

  // Protect teacher routes - require authentication and teacher role
  if (request.nextUrl.pathname.startsWith('/teacher/')) {
    if (!user) {
      const redirectUrl = new URL('/', request.url);
      redirectUrl.searchParams.set('auth', 'required');
      return NextResponse.redirect(redirectUrl);
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'teacher') {
      const redirectUrl = new URL('/', request.url);
      redirectUrl.searchParams.set('error', 'teacher_only');
      return NextResponse.redirect(redirectUrl);
    }
  }

  // Protect admin routes - require authentication and admin role
  if (request.nextUrl.pathname.startsWith('/admin')) {
    if (!user) {
      const redirectUrl = new URL('/', request.url);
      redirectUrl.searchParams.set('auth', 'required');
      return NextResponse.redirect(redirectUrl);
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      const redirectUrl = new URL('/', request.url);
      redirectUrl.searchParams.set('error', 'admin_only');
      return NextResponse.redirect(redirectUrl);
    }
  }

  return applySecurityHeaders(supabaseResponse);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     */
    '/((?!_next/static|_next/image|favicon.ico|public|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
