import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    
    // DEBUG: Print code status to Vercel Logs
    console.log('[CALLBACK START] Code present:', !!code);

    if (!code) {
        return NextResponse.redirect(`${origin}/login?error=no_code_provided`);
    }

    // 1. Exchange Code for Session
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.exchangeCodeForSession(code);

    // 👇 DEBUGGING: IF THIS FAILS, WE NEED TO KNOW WHY
    if (authError || !authData.user) {
        console.error('[CALLBACK ERROR]', authError);
        // Pass the ACTUAL error message to the URL
        return NextResponse.redirect(`${origin}/login?error=auth_failed&details=${encodeURIComponent(authError?.message || 'No user data')}`);
    }

    const user = authData.user;
    const userEmail = user.email?.trim().toLowerCase();

    // ----------------------------------------------------------------
    // PATH 1: THE CEO
    // ----------------------------------------------------------------
    if (userEmail === 'ceo@qkarin.com') {
        return NextResponse.redirect(`${origin}/dashboard`);
    }

    // ----------------------------------------------------------------
    // DATABASE CHECK
    // ----------------------------------------------------------------
    const supabaseAdmin = createSupabaseAdmin(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    let profileExists = false;

    // A. Check existing profile
    const { data: currentProfile } = await supabaseAdmin
        .from('profiles').select('id').eq('id', user.id).single();

    if (currentProfile) profileExists = true;
    
    // B. Legacy Linking
    else if (userEmail) {
        const { data: legacyProfile } = await supabaseAdmin
            .from('profiles').select('id')
            .or(`member_id.ilike.${userEmail},memberId.ilike.${userEmail}`)
            .single();

        if (legacyProfile) {
            await supabaseAdmin.from('profiles').update({ id: user.id }).eq('id', legacyProfile.id);
            profileExists = true;
        }
    }

    if (profileExists) {
        return NextResponse.redirect(`${origin}/profile`);
    } else {
        return NextResponse.redirect(`${origin}/tribute`);
    }
}
