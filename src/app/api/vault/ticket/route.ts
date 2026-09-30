import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

function getAdmin() {
    return createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

export const dynamic = 'force-dynamic';

// POST /api/vault/ticket
// { action: 'give' | 'revoke', memberId: string }
export async function POST(req: NextRequest) {
    const body = await req.json();
    const { action, memberId } = body;

    if (!memberId || !['give', 'revoke'].includes(action)) {
        return NextResponse.json({ error: 'Invalid params' }, { status: 400 });
    }

    const admin = getAdmin();

    // Try email match first, then UUID fallback
    let profile: any = null;
    const r1 = await admin.from('profiles').select('ID, parameters').ilike('member_id', memberId).maybeSingle();
    profile = r1.data;
    if (!profile) {
        const r2 = await admin.from('profiles').select('ID, parameters').eq('ID', memberId).maybeSingle();
        profile = r2.data;
    }

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    const params = profile.parameters || {};
    if (action === 'give') {
        params.locktober_ticket = true;
        params.locktober_ticket_granted_at = new Date().toISOString();
    } else {
        delete params.locktober_ticket;
        delete params.locktober_ticket_granted_at;
    }

    await admin.from('profiles').update({ parameters: params }).eq('ID', profile.ID);

    return NextResponse.json({ success: true, hasTicket: action === 'give' });
}

// GET /api/vault/ticket?memberId=xxx — check if member has a ticket
export async function GET(req: NextRequest) {
    const memberId = req.nextUrl.searchParams.get('memberId');
    if (!memberId) return NextResponse.json({ error: 'Missing memberId' }, { status: 400 });

    const admin = getAdmin();
    let profileData: any = null;
    const r1 = await admin.from('profiles').select('parameters').ilike('member_id', memberId).maybeSingle();
    profileData = r1.data;
    if (!profileData) {
        const r2 = await admin.from('profiles').select('parameters').eq('ID', memberId).maybeSingle();
        profileData = r2.data;
    }

    return NextResponse.json({ hasTicket: !!(profileData?.parameters?.locktober_ticket) });
}
