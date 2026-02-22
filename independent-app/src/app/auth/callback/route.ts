import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
        return NextResponse.redirect(`${origin}/login?error=no_code`);
    }

    // 1. Exchange Code for Session (Log them in as a Supabase Auth User)
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.exchangeCodeForSession(code);

    if (authError || !authData.user) {
        return NextResponse.redirect(`${origin}/login?error=auth_failed`);
    }

    const user = authData.user;
    const userEmail = user.email?.trim().toLowerCase();

    // ----------------------------------------------------------------
    // PATH 1: THE CEO (VIP Access)
    // ----------------------------------------------------------------
    if (userEmail === 'ceo@qkarin.com') {
        return NextResponse.redirect(`${origin}/dashboard`);
    }

    // ----------------------------------------------------------------
    // DATABASE CHECK (Do they have a profile?)
    // ----------------------------------------------------------------
    // We use the Admin client to check the database without RLS restrictions
    const supabaseAdmin = createSupabaseAdmin(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    let profileExists = false;

    // A. Check if they already have a profile linked to this User ID
    const { data: currentProfile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();

    if (currentProfile) {
        profileExists = true;
    } 
    
    // B. If no profile, try to find "Legacy" accounts by Email (The Bytascale Logic)
    else if (userEmail) {
        // Search in old columns
        const { data: legacyProfile } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .or(`member_id.ilike.${userEmail},memberId.ilike.${userEmail}`) // Checks both columns
            .single();

        if (legacyProfile) {
            console.log(`[CALLBACK] Found legacy profile ${legacyProfile.id}. Linking to new ID...`);
            // LINKING: Update the old profile to point to the new Google User ID
            await supabaseAdmin
                .from('profiles')
                .update({ id: user.id })
                .eq('id', legacyProfile.id);
            
            profileExists = true;
        }
    }

    // ----------------------------------------------------------------
    // DECISION TIME
    // ----------------------------------------------------------------

    if (profileExists) {
        // PATH 2: EXISTING MEMBER -> Go to Profile
        return NextResponse.redirect(`${origin}/profile`);
    } else {
        // PATH 3: NEW USER (No Profile) -> Go Pay (Tribute)
        console.log(`[CALLBACK] User ${userEmail} has no profile. Redirecting to Tribute.`);
        return NextResponse.redirect(`${origin}/tribute`);
    }
}
