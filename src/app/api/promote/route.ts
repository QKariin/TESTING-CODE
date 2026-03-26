import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { DbService } from '@/lib/supabase-service';

export const dynamic = "force-dynamic";

const RANK_ORDER = ["Queen's Champion", "Secretary", "Chamberlain", "Butler", "Silverman", "Footman", "Hall Boy"];
const cr = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

export async function POST(req: Request) {
    try {
        const { memberEmail } = await req.json();
        if (!memberEmail) return NextResponse.json({ error: 'Missing memberEmail' }, { status: 400 });

        const { data: profile } = await supabaseAdmin
            .from('profiles').select('*').ilike('member_id', memberEmail).maybeSingle();
        if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

        const currentHierarchy = profile.hierarchy || "Hall Boy";
        const currentIdx = RANK_ORDER.findIndex(r => cr(r) === cr(currentHierarchy));
        const nextIdx = currentIdx <= 0 ? -1 : currentIdx - 1;

        if (nextIdx < 0) {
            return NextResponse.json({ success: true, promoted: false, currentRank: currentHierarchy });
        }

        const nextRank = RANK_ORDER[nextIdx];

        const { error: updateError } = await supabaseAdmin
            .from('profiles').update({ hierarchy: nextRank }).ilike('member_id', memberEmail);
        if (updateError) return NextResponse.json({ error: 'Failed to update' }, { status: 500 });

        const rawPic = profile.avatar_url || profile.profile_picture_url || "";
        const memberPhoto = (rawPic && rawPic.length > 5) ? rawPic : null;
        const memberName = profile.name || memberEmail.split('@')[0] || 'SLAVE';
        const cardMsg = `PROMOTION_CARD::${JSON.stringify({ name: memberName, photo: memberPhoto, oldRank: currentHierarchy, newRank: nextRank })}`;

        try { await DbService.sendMessage(profile.member_id, cardMsg, 'system'); } catch (_) { }
        try {
            await supabaseAdmin.from('global_messages').insert({
                sender_email: 'system', sender_name: 'SYSTEM', sender_avatar: null, message: cardMsg,
            });
        } catch (_) { }

        return NextResponse.json({ success: true, promoted: true, newRank: nextRank });

    } catch (err: any) {
        console.error('[promote] error:', err);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
