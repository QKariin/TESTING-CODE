import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Next.js 16 requires a named export "proxy" or a default export
export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // This log should definitely show up in your terminal once fixed
    console.log(`[PROXY_LOG] Path detected: ${pathname}`);

    // Temporary force-lock for testing
    if (pathname.startsWith('/dashboard') || pathname.startsWith('/profile')) {
        console.log(`[PROXY_LOG] Gate is CLOSED. Redirecting to LOGIN.`);
        return NextResponse.redirect(new URL('/login', request.url));
    }

    return NextResponse.next();
}

// Export as default as well for maximum fallback compatibility
export default proxy;

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
