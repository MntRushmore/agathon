import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';

  // Handle demo.agathon.app subdomain - serve demo page directly, no auth needed
  if (hostname.startsWith('demo.')) {
    if (request.nextUrl.pathname === '/') {
      const url = request.nextUrl.clone();
      url.pathname = '/demo';
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  // Handle pitch.agathon.app subdomain - serve pitch deck page
  if (hostname.startsWith('pitch.')) {
    if (request.nextUrl.pathname === '/') {
      const url = request.nextUrl.clone();
      url.pathname = '/pitch';
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
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
  const publicPaths = ['/', '/login', '/signup', '/auth/', '/api/auth/', '/api/polar/', '/api/waitlist', '/terms', '/privacy', '/demo', '/pitch'];
  const isPublicPath = publicPaths.some(path => request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith(path));

  // For authenticated users on protected routes, check invite_redeemed
  // Note: If a user has a profile, they must have signed up with a valid
  // invite code (signup requires a validated code). If invite_redeemed is
  // false, it means the redemption step failed but they're still a valid user.
  // We auto-fix this by marking them as redeemed.
  if (user && !isPublicPath) {
    const { data: inviteCheck } = await supabase
      .from('profiles')
      .select('invite_redeemed, role')
      .eq('id', user.id)
      .single();

    if (inviteCheck && inviteCheck.invite_redeemed === false) {
      // User has a profile but invite_redeemed is false. Since creating an
      // account requires entering a valid invite code, this user is legitimate.
      // Auto-fix by marking them as redeemed.
      await supabase
        .from('profiles')
        .update({ invite_redeemed: true })
        .eq('id', user.id);
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

  return supabaseResponse;
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
