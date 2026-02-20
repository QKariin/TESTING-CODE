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
        const rawEmail = user.email || '';
        const userEmailNormalized = rawEmail.trim().toLowerCase();

        if (!userEmailNormalized) {
            console.log(`[AUTH_MIDDLEWARE] User ${user.id} has no email. Skipping recovery.`);
        }

        // Robust CEO check
        const isCEO = userEmailNormalized === 'ceo@qkarin.com' || userEmailNormalized === 'queen@qkarin.com' || user.id === 'master-ceo-bypass';

        const isTributePage = pathname.startsWith('/tribute')
        const isApiPage = pathname.startsWith('/api')
        const isAuthPage = pathname.startsWith('/auth')

        console.log(`\n[AUTH_MIDDLEWARE_CRITICAL_DEBUG] Path: ${pathname}, User: ${userEmailNormalized}, isCEO: ${isCEO}`);

        // CEO Bypass
        if (isCEO) {
            console.log(`[AUTH_MIDDLEWARE] CEO/Queen bypass triggered for ${userEmailNormalized}`);
            if (isTributePage) {
                return NextResponse.redirect(new URL('/profile', request.url))
            }
            return supabaseResponse
        }

        // Check for profile
        let { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id, rank')
            .eq('id', user.id)
            .single()

        // --- BOUNCER UPGRADE: Aggressive Profile Recovery ---
        if (!profile && userEmailNormalized) {
            console.log(`[AUTH_MIDDLEWARE] No profile for ${userEmailNormalized}. Attempting recovery...`);

            // 1. Check if ANY profile exists with this email (Strategy A)
            const { data: legacyProfile } = await supabase
                .from('profiles')
                .select('id, member_id')
                .or(`member_id.eq.${userEmailNormalized},member_id.ilike.${userEmailNormalized},memberId.eq.${userEmailNormalized},memberId.ilike.${userEmailNormalized}`)
                .maybeSingle();

            let targetId = legacyProfile?.id;

            // 2. Check 'tasks' table if still not found (Strategy B)
            if (!targetId) {
                console.log(`[AUTH_MIDDLEWARE] Strategy B: Searching 'tasks' for \"MemberID\": ${userEmailNormalized}`);
                const { data: taskMatch } = await supabase
                    .from('tasks')
                    .select('MemberID')
                    .ilike('MemberID', userEmailNormalized)
                    .limit(1)
                    .maybeSingle();

                if (taskMatch) {
                    console.log(`[AUTH_MIDDLEWARE] Match found in 'tasks' table. Creating skeleton...`);
                    // ... create skeleton
                    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
                        const { createClient: createAdminClient } = await import('@supabase/supabase-js');
                        const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY);
                        const { data: newProfile } = await admin.from('profiles').insert({
                            id: user.id,
                            member_id: userEmailNormalized,
                            name: userEmailNormalized.split('@')[0],
                            hierarchy: 'Slave'
                        }).select().single();
                        if (newProfile) profile = newProfile;
                    }
                }
            } else if (targetId && !profile) {
                // Link existing legacy profile
                console.log(`[AUTH_MIDDLEWARE] Strategy A Match! Linking existing profile ${targetId} to user ${user.id}`);
                if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
                    const { createClient: createAdminClient } = await import('@supabase/supabase-js');
                    const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY);
                    await admin.from('profiles').update({ id: user.id }).eq('id', targetId);
                    profile = { id: user.id, rank: 'Legacy' } as any;
                }
            }
        }

        console.log(`[AUTH_MIDDLEWARE] Profile found:`, !!profile, profile?.rank);

        // Redirect to /tribute if no profile exists (unless already on /tribute or calling an API/Auth)
        if (!profile && !isTributePage && !isApiPage && !isAuthPage) {
            console.log(`[AUTH_MIDDLEWARE] No profile found for ${userEmailNormalized}. Redirecting to /tribute`);
            const url = request.nextUrl.clone()
            url.pathname = '/tribute'
            return NextResponse.redirect(url)
        }

        // Redirect AWAY from /tribute if they have already paid (profile exists)
        if (profile && isTributePage) {
            console.log(`[AUTH_MIDDLEWARE] Profile exists. Redirecting away from /tribute to profile`);
            return NextResponse.redirect(new URL('/profile', request.url))
        }
    }

    return supabaseResponse
}
