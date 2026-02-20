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

    // 1. If no user, and not on login page -> redirect to login
    if (
        !user &&
        !request.nextUrl.pathname.startsWith('/login') &&
        !request.nextUrl.pathname.startsWith('/auth')
    ) {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return NextResponse.redirect(url)
    }

    // 2. If user exists, check for Profile status (Paywall)
    if (user) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('hierarchy')
            .eq('id', user.id)
            .single()

        const isTributePage = request.nextUrl.pathname.startsWith('/tribute')
        const isApiPage = request.nextUrl.pathname.startsWith('/api')
        const isCEO = user.email === 'ceo@qkarin.com'

        // Redirect to /tribute if they haven't paid (unless CEO, or already on /tribute, or calling an API)
        if (!isCEO && (!profile || profile.hierarchy === 'PENDING_TRIBUTE') && !isTributePage && !isApiPage) {
            const url = request.nextUrl.clone()
            url.pathname = '/tribute'
            return NextResponse.redirect(url)
        }

        // Redirect AWAY from /tribute if they have already paid
        if (profile && profile.hierarchy !== 'PENDING_TRIBUTE' && isTributePage) {
            const url = request.nextUrl.clone()
            url.pathname = '/dashboard'
            return NextResponse.redirect(url)
        }
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
