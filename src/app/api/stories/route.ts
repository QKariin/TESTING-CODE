import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCaller } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

// GET /api/stories?date=YYYY-MM-DD
// - Only returns stories visible to the calling member:
//   * Not expired (within 24h of created_at) OR date = today
//   * tagged_members is empty (public) OR member is in tagged_members (personalized)
export async function GET(req: Request) {
    const url = new URL(req.url);
    const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0];

    const caller = await getCaller();
    const memberEmail = (caller?.email || '').toLowerCase();

    const now = new Date().toISOString();

    // Get all active non-vault stories that haven't expired yet.
    // Use expires_at as the only time gate — not date — so stories uploaded
    // near midnight stay visible for their full 24h window.
    const { data: allStories } = await supabaseAdmin
        .from('stories')
        .select('id, media_url, media_type, order_index, caption, tagged_members, expires_at, created_at, source, tier')
        .eq('archived', false)
        .neq('source', 'vault')
        .gt('expires_at', now)
        .order('order_index', { ascending: true });

    // Check if this member has tributed:
    // - score > 0 (merit from kneeling/tasks signals active engagement)
    // - parameters.wishlist_spent > 0 (direct tribute payments)
    // - active regular keyholder lock (paid for lock = tribute)
    let hasTributed = false;
    if (memberEmail) {
        const [{ data: memberProfile }, { data: activeSession }] = await Promise.all([
            supabaseAdmin.from('profiles').select('score, parameters').ilike('member_id', memberEmail).maybeSingle(),
            supabaseAdmin.from('vault_sessions').select('id').eq('member_id', memberEmail).eq('status', 'active').neq('tier', 'locktober').maybeSingle(),
        ]);
        hasTributed = (memberProfile?.score || 0) > 0
            || (memberProfile?.parameters?.wishlist_spent || 0) > 0
            || !!activeSession;
    }

    // Filter to stories this member can see:
    // - vault stories (source='vault') are NEVER shown to members
    // - tagged_members is empty/null = public, everyone can see it
    // - tagged_members contains this member = personalized for them
    // - paid stories (tier='paid') only visible to members who have tributed
    const visibleStories = (allStories || []).filter((s: any) => {
        if (s.source === 'vault') return false;
        if (s.tier === 'paid' && !hasTributed) return false;
        const tagged: string[] = Array.isArray(s.tagged_members) ? s.tagged_members : [];
        return tagged.length === 0 || (memberEmail && tagged.includes(memberEmail));
    });

    const count = visibleStories.length;

    // Gate items (coffee/flowers)
    const { data: gateItems } = await supabaseAdmin
        .from('Wishlist')
        .select('ID, Title, Price, Image')
        .eq('stories_gate', true);

    // All authenticated members have access — the app itself is tribute-gated.
    // story_access table is kept for Wishlist gate items (optional premium flow).
    const hasAccess = !!memberEmail;

    // Strip internal fields before returning
    const safeStories = visibleStories.map(({ expires_at, created_at, ...s }: any) => s);

    return NextResponse.json({
        available: count > 0,
        count,
        hasAccess,
        stories: hasAccess ? safeStories : [],
        gateItems: (gateItems || []).filter((i: any) => !i.purchased),
    });
}

// POST /api/stories/archive — archive expired stories (called by cron or manually)
export async function POST(req: Request) {
    const caller = await getCaller();
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const now = new Date().toISOString();
    const { error, count } = await supabaseAdmin
        .from('stories')
        .update({ archived: true })
        .eq('archived', false)
        .lt('expires_at', now);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, archived: count });
}
