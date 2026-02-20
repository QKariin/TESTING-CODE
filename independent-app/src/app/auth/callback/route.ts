import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
    console.log('[AUTH_CALLBACK_DEBUG] Full URL:', request.url);
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const next = searchParams.get('next') ?? '/dashboard'

    if (!code) {
        return NextResponse.redirect(`${origin}/login?error=no_code`)
    }

    const supabase = await createClient()
    const { data: authData, error: authError } = await supabase.auth.exchangeCodeForSession(code)

    if (authError || !authData.user) {
        const errorMsg = authError?.message || 'Authentication failed';
        console.error('[AUTH_CALLBACK_ERROR]', errorMsg);
        return NextResponse.redirect(`${origin}/login?error=auth_failed&msg=${encodeURIComponent(errorMsg)}`)
    }

    const user = authData.user;
    const userEmail = user.email?.toLowerCase();

    // Create Admin Client for Lazy Matching (Bypasses RLS)
    const { createClient: createAdminClient } = await import('@supabase/supabase-js');
    const supabaseAdmin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Check if profile exists for CURRENT user ID
    let { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();

    // 2. If no profile, try to find and link legacy profile
    if (!profile && userEmail) {
        console.log(`[CALLBACK_DEBUG] No profile for current ID. Searching for legacy account: ${userEmail}`);

        // Strategy A: Match by email in 'member_id' column
        const { data: profileByUnderscore } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .ilike('member_id', userEmail)
            .single();

        if (profileByUnderscore) {
            console.log(`[CALLBACK_DEBUG] Found match via member_id. Linking...`);
            await supabaseAdmin.from('profiles').update({ id: user.id }).eq('id', profileByUnderscore.id);
            profile = { id: user.id };
        }

        // Strategy B: Match by email in 'memberId' column (camelCase)
        if (!profile) {
            const { data: profileByCamel } = await supabaseAdmin
                .from('profiles')
                .select('id')
                .ilike('memberId', userEmail)
                .single();

            if (profileByCamel) {
                console.log(`[CALLBACK_DEBUG] Found match via memberId. Linking...`);
                await supabaseAdmin.from('profiles').update({ id: user.id }).eq('id', profileByCamel.id);
                profile = { id: user.id };
            }
        }

        // Strategy C: Match via auth.users table (The "which database" hint)
        // Find ANY user in auth.users with this email that isn't the current one
        if (!profile) {
            console.log(`[CALLBACK_DEBUG] Checking auth.users for legacy email matching...`);
            const { data: { users: allUsers }, error: listError } = await supabaseAdmin.auth.admin.listUsers();

            if (!listError) {
                const legacyAuthUser = allUsers.find(u =>
                    u.email?.toLowerCase() === userEmail &&
                    u.id !== user.id
                );

                if (legacyAuthUser) {
                    console.log(`[CALLBACK_DEBUG] Found legacy auth account ${legacyAuthUser.id}. Checking for its profile...`);
                    const { data: legacyProfile } = await supabaseAdmin
                        .from('profiles')
                        .select('id')
                        .eq('id', legacyAuthUser.id)
                        .single();

                    if (legacyProfile) {
                        console.log(`[CALLBACK_DEBUG] Found profile for legacy ID. Linking to new ID...`);
                        await supabaseAdmin.from('profiles').update({ id: user.id }).eq('id', legacyProfile.id);
                        profile = { id: user.id };
                    }
                }
            }
        }
    }

    return NextResponse.redirect(new URL(next, origin))
}
