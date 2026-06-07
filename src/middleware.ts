import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';

const PUBLIC_PATHS = [
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/api/auth/signup',
  '/api/auth/signin',
  '/api/auth/signout',
  '/api/auth/verify-email',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/snippet/tests',
  '/api/snippet/events',
  '/api/collect',
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public assets, Next.js internals, and public API paths
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/snippet.js') ||
    PUBLIC_PATHS.some((p) => pathname.startsWith(p))
  ) {
    return NextResponse.next();
  }

  // Protect dashboard and API routes
  const isProtected =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/tests') ||
    pathname.startsWith('/builder') ||
    pathname.startsWith('/insights') ||
    pathname.startsWith('/integrations') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/api/');

  if (!isProtected) return NextResponse.next();

  const session = await getSessionFromRequest(req);
  if (!session) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect logged-in users away from auth pages
  if (pathname === '/login' || pathname === '/signup') {
    const dashboardUrl = req.nextUrl.clone();
    dashboardUrl.pathname = '/dashboard';
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|snippet.js).*)'],
};
