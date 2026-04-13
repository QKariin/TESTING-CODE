import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@/utils/supabase/server';
import { mapUserProfile } from '@/lib/mapUserProfile';

const ADMIN_EMAILS = ['ceo@qkarin.com'];

async function getCallerEmail(): Promise<string | null> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        return user?.email?.toLowerCase() || null;
    } catch {
        return null;
    }
}

function stripSensitive(response: any, isAdmin: boolean): any {
    if (!response || typeof response !== 'object') return response;

    // Keep member_id intact — it is needed by the frontend chat system.
    // initProfileState reads data.member_id to set the memberId used by
    // loadChatHistory/subscribeToChat. Stripping it makes chat never load.
    const rest = { ...response };

    if (isAdmin) return rest;

    // Non-admin (user viewing own profile): strip tracking data (IP/location)
    const params = rest.parameters ? { ...rest.parameters } : {};
    delete params.tracking_data;
    return { ...rest, parameters: params };
}

async function buildFullProfile(email: string) {
    const [{ data: profileData, error: profileError }, { data: taskData }, { data: contribData }] = await Promise.all([
        supabaseAdmin.from('profiles').select('id, member_id, name, "Name", wallet, score, hierarchy, routine, parameters, avatar_url, silence, paywall, last_active, created_at').ilike('member_id', email).maybeSingle(),
        supabaseAdmin.from('tasks').select('member_id, "Name", "Status", "Taskdom_History", "Tribute History", taskQueue, taskdom_active_task, taskdom_pending_state, "Taskdom_CompletedTasks", "kneelCount", "today kneeling", lastWorship, "Score", score, kneel_history').ilike('member_id', email).maybeSingle(),
        supabaseAdmin.from('crowdfund_contributions').select('amount_given').eq('member_id', email),
    ]);

    if (profileError) throw profileError;

    const crowdfundTotal = (contribData || []).reduce((sum: number, r: any) => sum + (r.amount_given || 0), 0);
    return mapUserProfile(profileData || {}, taskData || {}, crowdfundTotal);
}

export async function GET(request: NextRequest) {
    const callerEmail = await getCallerEmail();
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
            const data = await buildFullProfile(email);
            return NextResponse.json(stripSensitive(data, isAdmin));
        }

        const { data, error } = await supabaseAdmin.from('profiles').select('id, member_id, name, "Name", wallet, score, hierarchy, routine, parameters, avatar_url, silence, paywall, last_active, created_at').ilike('member_id', email).maybeSingle();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json(stripSensitive(data, isAdmin));
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const callerEmail = await getCallerEmail();
    if (!callerEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { email: rawEmail, full, ...updates } = body;
    const email = rawEmail?.toLowerCase();

    if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });

    const isAdmin = ADMIN_EMAILS.includes(callerEmail);
    const isSelf = callerEmail === email;

    if (!isAdmin && !isSelf) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Update mode
    if (Object.keys(updates).length > 0) {
        if (!isAdmin && !isSelf) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const { data, error } = await supabaseAdmin
            .from('profiles')
            .update(updates)
            .ilike('member_id', email)
            .select()
            .single();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true, profile: data });
    }

    // Lookup mode
    try {
        if (full === true) {
            const data = await buildFullProfile(email);
            return NextResponse.json(stripSensitive(data, isAdmin));
        }

        const { data, error } = await supabaseAdmin.from('profiles').select('id, member_id, name, "Name", wallet, score, hierarchy, routine, parameters, avatar_url, silence, paywall, last_active, created_at').ilike('member_id', email).maybeSingle();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json(stripSensitive(data, isAdmin));
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
