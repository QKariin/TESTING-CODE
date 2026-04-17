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

// GET - return all subscribers with online flag (online first)
// Uses profiles.last_active for online detection - same logic as dashboard sidebar
export async function GET() {
    const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { data: profiles, error } = await supabaseAdmin
        .from('profiles')
        .select('*');

    if (error) return NextResponse.json({ error: error.message, all: [] });

    const all = (profiles || [])
        .filter((p: any) => (p.name || '').trim() !== '')
        .map((p: any) => ({
            name: p.name,
            email: p.member_id || null,
            avatar: p.avatar_url || p.profile_picture_url || null,
            online: !!(p.last_active && p.last_active >= cutoff),
            last_active: p.last_active || null,
        }));

    all.sort((a: { online: boolean }, b: { online: boolean }) => (b.online ? 1 : 0) - (a.online ? 1 : 0));

    return NextResponse.json({ online: all.filter((u: { online: boolean }) => u.online), all });
}

// POST - heartbeat: update profiles.last_active (same field dashboard uses for online detection)
export async function POST(req: Request) {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });

    const now = new Date().toISOString();

    const { error, count } = await supabaseAdmin
        .from('profiles')
        .update({ last_active: now })
        .ilike('member_id', email)
        .select('member_id', { count: 'exact', head: true });

    if (error) {
        console.error('[presence/POST] update last_active failed:', error.message, 'email:', email);
        return NextResponse.json({ success: false, error: error.message });
    }

    console.log('[presence/POST] updated last_active for', email, '| matched rows:', count);
    return NextResponse.json({ success: true, updated: count });
}
