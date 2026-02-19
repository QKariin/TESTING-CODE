import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Next.js 16 requires a named export "proxy" or a default export
export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    console.log(`[AUTH_LOG] Request path: ${pathname}`);

    // The "force-lock" has been removed to allow system access.
    // Real session validation should be added here using Supabase cookies.

    return NextResponse.next();
}

export const config = {
    matcher: [
        '/dashboard/:path*',
        '/profile/:path*',
        '/initiate/:path*'
    ],
};
