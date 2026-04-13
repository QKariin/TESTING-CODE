import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl

    // 🔓 BYPASS AUTH FOR DEBUG ENDPOINTS
    if (
        pathname === '/api/debug-chat' ||
        pathname === '/api/chat/history' ||
        pathname.startsWith('/auth')
    ) {
        return NextResponse.next()
    }

    // Default: no redirect if not explicitly required by other middleware
    return NextResponse.next()
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
