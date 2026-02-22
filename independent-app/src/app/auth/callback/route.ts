import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    // Default to /dashboard, but we will override this based on logic below
    let next = searchParams.get('next') ?? '/dashboard'

    if (!code) {
        return NextResponse.redirect(`${origin}/login?error=no_code`)
    }

    // 1. Exchange the code for a session
    const supabase = await createClient()
    const { data: authData, error: authError } = await supabase.auth.exchangeCodeForSession(code)

    if (authError || !authData.user) {
        console.error('[AUTH_CALLBACK_ERROR]', authError?.message);
        return NextResponse.redirect(`${origin}/login?error=auth_failed`)
    }

    const user = authData.user;
    const userEmail = user.email?.trim().toLowerCase();

    // ----------------------------------------------------------------
    // LEGACY LINKING LOGIC (Kept exactly as you had it, just cleaner)
    // ----------------------------------------------------------------
    
    // Create Admin Client to bypass RLS for profile searching
    const { createClient: createAdminClient } = await import('@supabase/supabase-js');
    const supabaseAdmin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    // A. Check if they already have a profile
    let { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();

    // B. If no profile, try to find and link legacy accounts
    if (!profile && userEmail) {
        console.log(`[CALLBACK] Searching for legacy account: ${userEmail}`);

        // Try 'member_id'
        const { data: legacyA } = await supabaseAdmin
            .from('profiles').select('id').ilike('member_id', userEmail).single();
        
        // Try 'memberId' (camelCase)
        const { data: legacyB } = await supabaseAdmin
            .from('profiles').select('id').ilike('memberId', userEmail).single();

        const match = legacyA || legacyB;

        if (match) {
            console.log(`[CALLBACK] Found legacy profile ${match.id}. Linking to new User ID...`);
            // Update the old profile to point to the new Google User ID
            await supabaseAdmin.from('profiles').update({ id: user.id }).eq('id', match.id);
            profile = { id: user.id };
        }
    }

    // ----------------------------------------------------------------
    // TRAFFIC CONTROL (The Fix)
    // ----------------------------------------------------------------

    // 1. If it is the CEO, always go to Dashboard
    if (userEmail === 'ceo@qkarin.com') {
        return NextResponse.redirect(`${origin}/dashboard`);
    }

    // 2. If they HAVE a profile (found or linked above), go to their Profile/Dashboard
    if (profile) {
        // You can change this to /dashboard if you prefer
        return NextResponse.redirect(`${origin}/profile`);
    }

    // 3. If they DO NOT have a profile -> Send to Tribute (Stripe)
    // This stops the loop. They are logged in, but they need to pay/register.
    console.log(`[CALLBACK] New user detected. Redirecting to Tribute.`);
    return NextResponse.redirect(`${origin}/tribute`);
}
