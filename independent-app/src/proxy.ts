import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // DEBUG LOG
    console.log(`[MIDDLEWARE] Checking path: ${pathname}`);

    // PROTECT DASHBOARD AND PROFILE
    const isProtectedRoute = pathname.startsWith('/dashboard') || pathname.startsWith('/profile');

    if (isProtectedRoute) {
        console.log(`[MIDDLEWARE] Protected route detected: ${pathname}`);

        // CHECK FOR SESSION
        const session = request.cookies.get('sb-access-token');

        if (!session) {
            console.log(`[MIDDLEWARE] No session found. Redirecting to /login`);
            return NextResponse.redirect(new URL('/login', request.url));
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        '/dashboard',
        '/dashboard/:path*',
        '/profile',
        '/profile/:path*',
        '/login',
        '/initiate'
    ],
};
