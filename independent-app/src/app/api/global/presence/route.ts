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

// GET — return all subscribers with online flag (online first)
// Uses profiles.last_active for online detection — same logic as dashboard sidebar
export async function GET() {
    const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { data: profiles, error } = await supabaseAdmin
        .from('profiles')
        .select('member_id, name, title, avatar_url, profile_picture_url, last_active');

    if (error) return NextResponse.json({ error: error.message, all: [] });

    const all = (profiles || [])
        .filter((p: any) => (p.name || p.title || '').trim() !== '')
        .map((p: any) => ({
            name: p.name || p.title,
            avatar: p.avatar_url || p.profile_picture_url || null,
            online: !!(p.last_active && p.last_active >= cutoff),
        }));

    all.sort((a: { online: boolean }, b: { online: boolean }) => (b.online ? 1 : 0) - (a.online ? 1 : 0));

    return NextResponse.json({ online: all.filter((u: { online: boolean }) => u.online), all });
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
