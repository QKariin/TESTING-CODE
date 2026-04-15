import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@/utils/supabase/server';
import { mapUserProfile } from '@/lib/mapUserProfile';

const ADMIN_EMAILS = ['ceo@qkarin.com'];

async function getCaller(): Promise<{ email: string | null; uuid: string | null }> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        return { email: user?.email?.toLowerCase() || null, uuid: user?.id || null };
    } catch {
        return { email: null, uuid: null };
    }
}

// Keep backward compat
async function getCallerEmail(): Promise<string | null> {
    return (await getCaller()).email;
}

function stripSensitive(response: any, isAdmin: boolean): any {
    if (!response || typeof response !== 'object') return response;

    // Keep member_id intact - it is needed by the frontend chat system.
    // initProfileState reads data.member_id to set the memberId used by
    // loadChatHistory/subscribeToChat. Stripping it makes chat never load.
    const rest = { ...response };

    if (isAdmin) return rest;

    // Non-admin (user viewing own profile): strip tracking data (IP/location)
    const params = rest.parameters ? { ...rest.parameters } : {};
    delete params.tracking_data;
    return { ...rest, parameters: params };
}

async function buildFullProfile(emailOrUuid: string, authUuidHint?: string | null) {
    // Step 1: fetch profile - by UUID (profiles.id) if UUID, else by email (profiles.member_id)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(emailOrUuid);
    const { data: profileData, error: profileError } = isUuid
        ? await supabaseAdmin.from('profiles').select('*').eq('id', emailOrUuid).maybeSingle()
        : await supabaseAdmin.from('profiles').select('*').ilike('member_id', emailOrUuid).maybeSingle();

    if (profileError) {
        console.error('[slave-profile] buildFullProfile profileError:', profileError.message, profileError.code);
        throw profileError;
    }

    // Step 2: fetch tasks — collect ALL matching rows and pick the richest one.
    // Users may have both an email-keyed row (historical data) and a UUID-keyed row (newer/empty).
    const profilesId = profileData?.id;
    const profileEmail = profileData?.member_id;

    const taskCandidates: any[] = [];
    const uuidsToTry = [...new Set([profilesId, authUuidHint].filter(Boolean))] as string[];
    for (const tryId of uuidsToTry) {
        const { data } = await supabaseAdmin.from('tasks').select('*').eq('member_id', tryId).maybeSingle();
        if (data) taskCandidates.push(data);
    }
    if (profileEmail) {
        const { data } = await supabaseAdmin.from('tasks').select('*').ilike('member_id', profileEmail).maybeSingle();
        if (data && !taskCandidates.some((c: any) => c.member_id === data.member_id)) taskCandidates.push(data);
    }
    // Pick the row with the most data (highest kneelCount + CompletedTasks)
    const taskData = taskCandidates.length === 0 ? null :
        taskCandidates.length === 1 ? taskCandidates[0] :
        taskCandidates.reduce((best: any, x: any) => {
            const xScore = Number(x.kneelCount || 0) + Number(x['Taskdom_CompletedTasks'] || 0);
            const bScore = Number(best?.kneelCount || 0) + Number(best?.['Taskdom_CompletedTasks'] || 0);
            return xScore > bScore ? x : best;
        }, taskCandidates[0]);

    const [{ data: contribData }] = await Promise.all([
        profilesId
            ? supabaseAdmin.from('crowdfund_contributions').select('amount_given').eq('member_id', profilesId)
            : supabaseAdmin.from('crowdfund_contributions').select('amount_given').ilike('member_id', emailOrUuid),
    ]);


    const crowdfundTotal = ((contribData as any[] | null) || []).reduce((sum: number, r: any) => sum + (r.amount_given || 0), 0);
    return mapUserProfile(profileData || {}, taskData || {}, crowdfundTotal);

}

export async function GET(request: NextRequest) {
    const { email: callerEmail, uuid: callerUuid } = await getCaller();
    if (!callerEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email')?.toLowerCase();
    const full = searchParams.get('full') === 'true';

    if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });

    const isAdmin = ADMIN_EMAILS.includes(callerEmail);
    const isSelf = callerEmail === email;

    if (!isAdmin && !isSelf) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        if (full) {
            const data = await buildFullProfile(email, callerUuid);
            return NextResponse.json(stripSensitive(data, isAdmin));
        }

        const { data, error } = await supabaseAdmin.from('profiles').select('*').ilike('member_id', email).maybeSingle();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json(stripSensitive(data, isAdmin));
    } catch (err: any) {
        console.error('[slave-profile] GET catch:', err?.message, err?.code);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const { email: callerEmail, uuid: callerUuid } = await getCaller();
    if (!callerEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { email: rawEmail, full, ...updates } = body;
    const email = rawEmail?.toLowerCase();

    if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });

    const isAdmin = ADMIN_EMAILS.includes(callerEmail);
    // isSelf: match by email OR by UUID (when claimKneelReward passes the user's auth UUID)
    const isSelf = callerEmail === email || (!!callerUuid && callerUuid === email);

    if (!isAdmin && !isSelf) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const isUuidEmail = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(email);

    // Update mode
    if (Object.keys(updates).length > 0) {
        const { data, error } = await supabaseAdmin
            .from('profiles')
            .update(updates)
            .eq(isUuidEmail ? 'id' : 'member_id', email)
            .select()
            .single();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true, profile: data });
    }

    // Lookup mode
    try {
        if (full === true) {
            const data = await buildFullProfile(email, callerUuid);
            return NextResponse.json(stripSensitive(data, isAdmin));
        }

        const { data, error } = isUuidEmail
            ? await supabaseAdmin.from('profiles').select('*').eq('id', email).maybeSingle()
            : await supabaseAdmin.from('profiles').select('*').ilike('member_id', email).maybeSingle();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json(stripSensitive(data, isAdmin));
    } catch (err: any) {
        console.error('[slave-profile] POST catch:', err?.message, err?.code);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
