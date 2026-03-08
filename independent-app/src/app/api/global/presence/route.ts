import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Derive a stable positive integer from an email string (fits in bigint)
function emailToId(email: string): number {
    let h = 5381;
    for (let i = 0; i < email.length; i++) {
        h = Math.imul(h, 31) + email.charCodeAt(i) | 0;
    }
    return Math.abs(h) || 1;
}

// GET — return users online in the last 2 minutes
export async function GET() {
    const cutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { data, error } = await supabaseAdmin
        .from('online_users')
        .select('name, avatar, last_seen')
        .gte('last_seen', cutoff);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const online = (data || []).map((u: any) => ({
        name: u.name || 'SUBJECT',
        avatar: u.avatar || null,
    }));

    return NextResponse.json({ online });
}

// POST — heartbeat: upsert into online_users
export async function POST(req: Request) {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });

    // Get profile info for name + avatar
    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('name, avatar_url, profile_picture_url')
        .ilike('member_id', email)
        .maybeSingle();

    const name = profile?.name || email.split('@')[0] || 'SUBJECT';
    const avatar = profile?.avatar_url || profile?.profile_picture_url || null;
    const now = new Date().toISOString();
    const memberId = emailToId(email.toLowerCase());

    const { error } = await supabaseAdmin
        .from('online_users')
        .upsert(
            { member_id: memberId, name, avatar, last_seen: now },
            { onConflict: 'member_id' }
        );

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
