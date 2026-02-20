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

    // 1. If hitting /auth routes, let it pass (it will handle its own redirect)
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

        console.log(`[AUTH_DEBUG] User ID: ${user.id}, Email: ${user.email}`);

        let { data: profile, error: profileErr } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single()

        if (profileErr) console.log(`[AUTH_DEBUG] Profile lookup by ID failed: ${profileErr.message}`);

        // Lazy Matching: If not found by ID, try finding by email (Legacy Wix users)
        if (!profile && user.email) {
            console.log(`[AUTH_DEBUG] No profile for ID. Checking by email: ${user.email}`);
            const { data: profileByEmail, error: emailErr } = await supabase
                .from('profiles')
                .select('*')
                .eq('member_id', user.email)
                .single()

            if (emailErr) console.log(`[AUTH_DEBUG] Profile lookup by email failed: ${emailErr.message}`);

            if (profileByEmail) {
                console.log(`[AUTH_DEBUG] Found legacy profile for ${user.email}. ID in DB is ${profileByEmail.id}. Linking...`);
                // Update the profile to link this user's permanent ID
                const { data: updatedProfile, error: linkError } = await supabase
                    .from('profiles')
                    .update({ id: user.id })
                    .eq('member_id', user.email)
                    .select()
                    .single()

                if (!linkError) {
                    console.log(`[AUTH_DEBUG] Successfully linked ID for ${user.email}`);
                    profile = updatedProfile;
                } else {
                    console.error(`[AUTH_DEBUG] FAILED to link ID for ${user.email}: ${linkError.message}`);
                }
            } else {
                console.log(`[AUTH_DEBUG] NO profile found for email: ${user.email}`);
            }
        }

        const isApiPage = pathname.startsWith('/api')

        // Redirect to /tribute if no profile exists (unless already on /tribute or calling an API)
        if (!profile && !isTributePage && !isApiPage) {
            console.log(`[AUTH_LOG] No profile for ${user.email}, redirecting to /tribute`);
            const url = request.nextUrl.clone()
            url.pathname = '/tribute'
            return NextResponse.redirect(url)
        }

        // Redirect AWAY from /tribute if they have already paid (profile exists)
        if (profile && isTributePage) {
            return NextResponse.redirect(new URL('/dashboard', request.url))
        }
    }

    return supabaseResponse
}
