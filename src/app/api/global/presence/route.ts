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
// Tries member_id match first, then falls back to auth user UUID lookup.
// This handles users whose auth email differs from their profile member_id.
export async function POST(req: Request) {
    const { getCaller, isOwnerOrCEO } = await import('@/lib/api-auth');
    const caller = await getCaller();
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { email, userId } = await req.json();
    if (!email && !userId) return NextResponse.json({ error: 'Email or userId required' }, { status: 400 });

    const identity = userId || email;
    if (!isOwnerOrCEO(caller, identity)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const now = new Date().toISOString();

    // Try 1: direct member_id match
    if (email) {
        const { data, error } = await supabaseAdmin
            .from('profiles')
            .update({ last_active: now })
            .ilike('member_id', email)
            .select('member_id');

        if (!error && data && data.length > 0) {
            return NextResponse.json({ success: true });
        }
    }

    // Try 2: UUID match (profiles.ID = auth user UUID)
    if (userId) {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
        if (isUuid) {
            const { data, error } = await supabaseAdmin
                .from('profiles')
                .update({ last_active: now })
                .eq('ID', userId)
                .select('member_id');

            if (!error && data && data.length > 0) {
                return NextResponse.json({ success: true });
            }
        }
    }

    // Try 3: name-based fallback for queen (auth email domain mismatch)
    if (email) {
        const QUEEN_DOMAINS = ['qkarin.com'];
        const domain = email.split('@')[1]?.toLowerCase();
        if (domain && QUEEN_DOMAINS.includes(domain)) {
            const { data, error } = await supabaseAdmin
                .from('profiles')
                .update({ last_active: now })
                .ilike('name', '%queen%')
                .select('member_id');

            if (!error && data && data.length > 0) {
                return NextResponse.json({ success: true });
            }
        }
    }

    return NextResponse.json({ success: false, error: 'No matching profile found' });
}
