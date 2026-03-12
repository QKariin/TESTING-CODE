// src/app/api/auth/link-profile/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        // For Twitter users without email, use twitter_{provider_id} as identifier
        const userEmail = user.email?.trim().toLowerCase()
            || (user.user_metadata?.provider_id ? `twitter_${user.user_metadata.provider_id}` : null);

        if (!userEmail) {
            return NextResponse.json({ success: false, error: 'User has no identifier' }, { status: 400 });
        }

        // Check for Service Role
        const hasServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
        console.log(`\n[MANUAL_LINK_CRITICAL_DEBUG]`);
        console.log(`- Email: ${userEmail}`);
        console.log(`- ID: ${user.id}`);
        console.log(`- Service Role Present: ${hasServiceRole}`);

        // Create Admin Client
        const { createClient: createAdminClient } = await import('@supabase/supabase-js');
        const supabaseAdmin = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY || ''
        );

        // Count total profiles
        const { count, error: countError } = await supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true });
        console.log(`- Total Profiles in DB: ${count || 0}`);
        if (countError) console.error(`- DB Access Error:`, countError);

        // Check if profile already exists for CURRENT ID
        const { data: existing } = await supabaseAdmin
            .from('profiles')
            .select('id, rank')
            .eq('id', user.id)
            .single();

        if (existing) {
            console.log(`- Profile already linked: ${existing.id} (${existing.rank})`);
            return NextResponse.json({ success: true, linked: true, message: 'Already linked' });
        }

        // Strategy A: Match by member_id
        console.log(`- Strategy A: Searching member_id for ${userEmail}`);
        let { data: legacy, error: aError } = await supabaseAdmin
            .from('profiles')
            .select('id, member_id')
            .ilike('member_id', userEmail)
            .single();

        if (legacy) {
            console.log(`- Strategy A MATCH: ${legacy.id}`);
        } else if (aError && aError.code !== 'PGRST116') {
            console.error(`- Strategy A ERROR:`, aError);
        }

        // Strategy B: Match by memberId
        if (!legacy) {
            console.log(`- Strategy B: Searching memberId (camel) for ${userEmail}`);
            const { data: legacyCamel, error: bError } = await supabaseAdmin
                .from('profiles')
                .select('id, member_id')
                .ilike('memberId', userEmail)
                .single();

            if (legacyCamel) {
                console.log(`- Strategy B MATCH: ${legacyCamel.id}`);
                legacy = legacyCamel;
            } else if (bError && bError.code !== 'PGRST116') {
                console.error(`- Strategy B ERROR:`, bError);
            }
        }

        if (legacy) {
            console.log(`- FINAL MATCH FOUND: ${legacy.id}. Updating profile ID to ${user.id}`);
            const { error: uError } = await supabaseAdmin.from('profiles').update({ id: user.id }).eq('id', legacy.id);
            if (uError) {
                console.error(`- UPDATE ERROR:`, uError);
                return NextResponse.json({ success: false, error: 'Failed to update profile ID' }, { status: 500 });
            }
            return NextResponse.json({ success: true, linked: true });
        }

        // Strategy C: Auth Lookup
        console.log(`- Strategy C: Checking auth.users for ${userEmail}`);
        const { data: { users: allUsers }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        if (listError) {
            console.error(`- Strategy C LIST_ERROR:`, listError);
        } else {
            const legacyUser = allUsers.find(u => u.email?.trim().toLowerCase() === userEmail && u.id !== user.id);
            if (legacyUser) {
                console.log(`- Strategy C MATCH in auth.users: Legacy ID is ${legacyUser.id}. Checking for profile...`);
                const { data: prof, error: cError } = await supabaseAdmin
                    .from('profiles')
                    .select('id, member_id')
                    .eq('id', legacyUser.id)
                    .single();

                if (prof) {
                    console.log(`- Strategy C FINAL MATCH in profiles: ${prof.id}. Linking to ${user.id}`);
                    await supabaseAdmin.from('profiles').update({ id: user.id }).eq('id', prof.id);
                    return NextResponse.json({ success: true, linked: true });
                } else if (cError && cError.code !== 'PGRST116') {
                    console.error(`- Strategy C PROFILE_ERROR:`, cError);
                } else {
                    console.log(`- Strategy C: Found legacy auth user but NO profile for that ID.`);
                }
            } else {
                console.log(`- Strategy C: No other user found with email ${userEmail} in auth.users`);
            }
        }
        // Strategy D: Match by member_id in 'tasks' table
        if (!legacy) {
            console.log(`- Strategy D: Searching 'tasks' table for "member_id": ${userEmail}`);
            const { data: taskMatch, error: dError } = await supabaseAdmin
                .from('tasks')
                .select('member_id')
                .ilike('member_id', userEmail)
                .limit(1)
                .maybeSingle();

            if (taskMatch) {
                console.log(`- Strategy D MATCH in tasks table! Creating skeleton profile for ${userEmail}`);
                const { data: newProfile, error: createError } = await supabaseAdmin
                    .from('profiles')
                    .insert({
                        id: user.id,
                        member_id: userEmail,
                        name: userEmail.split('@')[0],
                        hierarchy: 'Hall Boy',
                        wallet: 5000,
                        avatar_url: 'https://static.wixstatic.com/media/ce3e5b_78da97e06a3848df84d0b00c9e6dcfdd~mv2.png',
                    })
                    .select()
                    .single();

                if (createError) {
                    console.error(`- Strategy D CREATE_ERROR:`, createError);
                } else {
                    console.log(`- Strategy D: Profile created and linked: ${newProfile.id}`);
                    return NextResponse.json({ success: true, linked: true });
                }
            } else if (dError) {
                console.error(`- Strategy D ERROR:`, dError);
            }
        }

        return NextResponse.json({ success: true, linked: false, message: 'No profile found to link' });
    } catch (error: any) {
        console.error('[MANUAL_LINK_ERROR]', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
