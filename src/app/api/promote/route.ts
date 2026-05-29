import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { HIERARCHY_RULES } from '@/lib/hierarchyRules';
import { getCaller, isCEO } from '@/lib/api-auth';
import { discordPromotion } from '@/lib/discord';

export const dynamic = "force-dynamic";

const clean = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

// POST — CEO only (manual force-promote from dashboard)
export async function POST(req: Request) {
    const caller = await getCaller();
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isCEO(caller.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    try {
        const body = await req.json();
        const memberId = body.memberId || body.memberEmail;
        if (!memberId) return NextResponse.json({ error: 'Missing memberId' }, { status: 400 });

        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memberId);
        const { data: profile } = isUuid
            ? await supabaseAdmin.from('profiles').select('*').eq('ID', memberId).maybeSingle()
            : await supabaseAdmin.from('profiles').select('*').ilike('member_id', memberId).maybeSingle();

        if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

        const currentHierarchy = profile.hierarchy || "Hall Boy";
        let currentIndex = HIERARCHY_RULES.findIndex(r => clean(r.name) === clean(currentHierarchy));
        if (currentIndex === -1) currentIndex = HIERARCHY_RULES.length - 1;
        if (currentIndex === 0) return NextResponse.json({ success: true, promoted: false, currentRank: HIERARCHY_RULES[0].name });

        const currentRank = HIERARCHY_RULES[currentIndex].name;
        const nextRank = HIERARCHY_RULES[currentIndex - 1].name;

        await supabaseAdmin.from('profiles').update({ hierarchy: nextRank }).eq('ID', profile.ID);

        const rawPic = profile.avatar_url || profile.profile_picture_url || "";
        const memberName = profile.name || 'SLAVE';
        const memberPhoto = (rawPic && rawPic.length > 5) ? rawPic : null;
        const cardMsg = `PROMOTION_CARD::${JSON.stringify({ name: memberName, photo: memberPhoto, oldRank: currentRank, newRank: nextRank })}`;

        try { await supabaseAdmin.from('chats').insert({ member_id: profile.member_id, sender_email: 'queen', content: cardMsg, type: 'text', metadata: { isQueen: true, mediaUrl: null } }); } catch (_) {}
        try { await supabaseAdmin.from('global_messages').insert({ sender_email: 'system', sender_name: 'SYSTEM', sender_avatar: null, message: cardMsg }); } catch (_) {}
        discordPromotion(memberName, currentRank, nextRank).catch(() => {});

        return NextResponse.json({ success: true, promoted: true, newRank: nextRank });
    } catch (err: any) {
        console.error('[promote] Unexpected error:', err);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
