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
                return NextResponse.redirect(new URL('/dashboard', request.url))
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

            // Try Strategy A: Match by email in 'profiles'
            const { data: legacyProfile } = await supabase
                .from('profiles')
                .select('id, member_id, memberId')
                .or(`member_id.ilike.${userEmailNormalized},memberId.ilike.${userEmailNormalized}`)
                .maybeSingle();

            let targetId = legacyProfile?.id;

            // Strategy B: Match by email in 'tasks' table ("MemberID" column)
            if (!targetId) {
                const { data: taskMatch } = await supabase
                    .from('tasks')
                    .select('"MemberID"')
                    .ilike('MemberID', userEmailNormalized)
                    .limit(1)
                    .maybeSingle();

                if (taskMatch) {
                    console.log(`[AUTH_MIDDLEWARE] Match found in 'tasks' table for ${userEmailNormalized}. Creating skeleton profile...`);

                    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
                        const { createClient: createAdminClient } = await import('@supabase/supabase-js');
                        const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY);

                        // Create skeleton profile
                        const { data: newProfile, error: createError } = await admin
                            .from('profiles')
                            .insert({
                                id: user.id,
                                member_id: userEmailNormalized,
                                name: userEmailNormalized.split('@')[0],
                                hierarchy: 'Slave'
                            })
                            .select()
                            .single();

                        if (!createError && newProfile) {
                            console.log(`[AUTH_MIDDLEWARE] Skeleton profile created: ${newProfile.id}`);
                            profile = newProfile;
                        } else if (createError) {
                            console.error(`[AUTH_MIDDLEWARE] Failed to create skeleton:`, createError);
                        }
                    }
                }
            }

            if (targetId && !profile) {
                console.log(`[AUTH_MIDDLEWARE] Recovery Success! Found legacy profile ${targetId}.`);

                // Link it using Admin Client
                if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
                    const { createClient: createAdminClient } = await import('@supabase/supabase-js');
                    const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY);
                    await admin.from('profiles').update({ id: user.id }).eq('id', targetId);
                    console.log(`[AUTH_MIDDLEWARE] Profile linked via Admin bypass.`);
                    profile = { id: user.id } as any;
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
            console.log(`[AUTH_MIDDLEWARE] Profile exists. Redirecting away from /tribute to dashboard`);
            return NextResponse.redirect(new URL('/dashboard', request.url))
        }
    }

    return supabaseResponse
}
