import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // IMPORTANT: Avoid writing any logic between createServerClient and
    // supabase.auth.getUser(). A simple mistake can make it very hard to debug
    // issues with sessions being lost.

    const {
        data: { user },
    } = await supabase.auth.getUser()

    const pathname = request.nextUrl.pathname;

    // 1. If hitting /auth/callback, let it pass (it will handle its own redirect)
    if (pathname.startsWith('/auth')) {
        return supabaseResponse
    }

    // 2. If no user, and not on login page -> redirect to login
    if (
        !user &&
        !pathname.startsWith('/login')
    ) {
        console.log(`[AUTH_LOG] No user for ${pathname}, redirecting to /login`);
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return NextResponse.redirect(url)
    }

    // 3. If user exists, check for Profile status (Paywall)
    if (user) {
        const isCEO = user.email === 'ceo@qkarin.com'
        const isTributePage = pathname.startsWith('/tribute')

        // CEO Bypass
        if (isCEO) {
            if (isTributePage) {
                return NextResponse.redirect(new URL('/dashboard', request.url))
            }
            return supabaseResponse
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('hierarchy')
            .eq('id', user.id)
            .single()

        const isApiPage = pathname.startsWith('/api')

        // Redirect to /tribute if they haven't paid (unless already on /tribute or calling an API)
        if ((!profile || profile.hierarchy === 'PENDING_TRIBUTE') && !isTributePage && !isApiPage) {
            console.log(`[AUTH_LOG] User ${user.email} needs tribute, redirecting to /tribute`);
            const url = request.nextUrl.clone()
            url.pathname = '/tribute'
            return NextResponse.redirect(url)
        }

        // Redirect AWAY from /tribute if they have already paid
        if (profile && profile.hierarchy !== 'PENDING_TRIBUTE' && isTributePage) {
            return NextResponse.redirect(new URL('/dashboard', request.url))
        }
    }

    return supabaseResponse
}

// IMPORTANT: You *must* return the supabaseResponse object as is. If you're creating a
// new response object with NextResponse.next() make sure to:
// 1. Pass the request in it, like so:
//    const myNewResponse = NextResponse.next({ request })
// 2. Copy over the cookies, like so:
//    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
// 3. Change the myNewResponse object to fit your needs, but avoid modifying
//    the cookies!
// Keep in mind that this should only be used in specific situations, like for examples:
// - Setting HTTP-only cookies
// - Redirecting the user to a new page but still keeping the session active

return supabaseResponse
}
