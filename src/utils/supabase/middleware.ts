import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() { return request.cookies.getAll() },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({ request })
                    cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
                },
            },
        }
    )

    const { data: { user } } = await supabase.auth.getUser()
    const pathname = request.nextUrl.pathname;

    if (pathname.startsWith('/auth') || pathname === '/api/debug-chat' || pathname === '/api/chat/history' || pathname === '/api/push') return supabaseResponse

    if (!user && !pathname.startsWith('/login')) {
        return NextResponse.redirect(new URL('/login', request.url))
    }

    if (user) {
        const userEmailNormalized = (user.email || '').trim().toLowerCase();
        const isTributePage = pathname.startsWith('/tribute')
        const isApiPage = pathname.startsWith('/api')
        const isAuthPage = pathname.startsWith('/auth')

        // 🛡️ ADMIN CLIENT FOR BOUNCER (Edge-Compatible)
        const adminSupabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            {
                cookies: {
                    getAll() { return request.cookies.getAll() },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    },
                },
            }
        )

        // 1. Check for Profile
        let { data: profile } = await adminSupabase.from('profiles').select('ID').eq('ID', user.id).maybeSingle();

        // 2. HYBRID CHECK: If no profile, check legacy table immediately
        let isLegacyMember = false;
        if (!profile && userEmailNormalized) {
            const { data: legacyMatch } = await adminSupabase
                .from('tasks')
                .select('member_id')
                .ilike('member_id', userEmailNormalized)
                .limit(1)
                .maybeSingle();

            if (legacyMatch) {
                isLegacyMember = true;
                console.log(`[BOUNCER] Legacy Member detected: ${userEmailNormalized}. Granting Hybrid Access.`);

                // --- Background Linking Effort ---
                const { data: legacyProfile } = await adminSupabase
                    .from('profiles')
                    .select('ID')
                    .or(`member_id.ilike.${userEmailNormalized},memberId.ilike.${userEmailNormalized}`)
                    .maybeSingle();

                if (legacyProfile) {
                    await adminSupabase.from('profiles').update({ ID: user.id }).eq('ID', legacyProfile.ID);
                } else {
                    await adminSupabase.from('profiles').insert({
                        id: user.id,
                        member_id: userEmailNormalized,
                        name: userEmailNormalized.split('@')[0],
                        hierarchy: 'Slave'
                    });
                }
            }
        }

        const isCEO = userEmailNormalized === 'ceo@qkarin.com' || userEmailNormalized === 'queen@qkarin.com';
        const hasAccess = !!profile || isLegacyMember || isCEO;
        const isDashboardPage = pathname === '/dashboard' || pathname.startsWith('/dashboard/');

        // Check if user is an active chatter (allowed into dashboard)
        let isChatter = false;
        if (!isCEO && isDashboardPage) {
            const { data: chatterRow } = await adminSupabase
                .from('chatters')
                .select('id')
                .eq('email', userEmailNormalized)
                .eq('is_active', true)
                .maybeSingle();
            isChatter = !!chatterRow;
        }

        console.log(`[BOUNCER] Access Decision: Profile=${!!profile}, Legacy=${isLegacyMember}, Chatter=${isChatter}, Result=${hasAccess ? 'ALLOWED' : 'DENIED'} | User: ${userEmailNormalized}`);

        if (hasAccess || isChatter) {
            // 1. If non-CEO and non-chatter tries to access Dashboard -> go to Profile
            if (isDashboardPage && !isCEO && !isChatter) {
                console.log(`[BOUNCER] Non-CEO ${userEmailNormalized} attempted Dashboard. Redirecting to /profile.`);
                return NextResponse.redirect(new URL('/profile', request.url));
            }

            // 2. If CEO lands on Profile or Tribute -> go to Dashboard (optional, but keep it clean)
            if (isCEO && (isTributePage || pathname === '/')) {
                return NextResponse.redirect(new URL('/dashboard', request.url));
            }

            // 3. If User on Tribute or Root -> go to Profile
            if (isTributePage || pathname === '/') {
                return NextResponse.redirect(new URL('/profile', request.url));
            }

            return supabaseResponse;
        }

        if (!isTributePage && !isApiPage && !isAuthPage) {
            return NextResponse.redirect(new URL('/tribute', request.url))
        }
    }

    return supabaseResponse
}
