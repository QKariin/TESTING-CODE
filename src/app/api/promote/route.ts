import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { HIERARCHY_RULES, getHierarchyReport } from '@/lib/hierarchyRules';
import { getCaller, isCEO } from '@/lib/api-auth';
import { discordPromotion } from '@/lib/discord';
import { mapUserProfile } from '@/lib/mapUserProfile';

export const dynamic = "force-dynamic";

const clean = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

export async function POST(req: Request) {
    const caller = await getCaller();
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await req.json();
        const memberId = body.memberId || body.memberEmail;
        if (!memberId) return NextResponse.json({ error: 'Missing memberId' }, { status: 400 });

        // 1. Fetch Profile (by UUID or email)
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memberId);
        const { data: profile } = isUuid
            ? await supabaseAdmin.from('profiles').select('*').eq('ID', memberId).maybeSingle()
            : await supabaseAdmin.from('profiles').select('*').ilike('member_id', memberId).maybeSingle();

        if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

        // Non-CEO callers can only promote themselves
        const callerEmail = caller.email?.toLowerCase();
        const profileEmail = (profile.member_id || '').toLowerCase();
        if (!isCEO(callerEmail) && callerEmail !== profileEmail) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // 2. Fetch tasks data for hierarchy check
        const { data: taskRow } = await supabaseAdmin
            .from('tasks')
            .select('*')
            .eq('ID', profile.ID)
            .maybeSingle();

        const mapped = mapUserProfile(profile, taskRow);
        const report = getHierarchyReport(mapped);

        // Non-CEO callers must actually qualify
        if (!isCEO(callerEmail) && !report.canPromote) {
            return NextResponse.json({ success: true, promoted: false, reason: 'Requirements not met' });
        }

        const exactEmail = profile.member_id;

        // 2. Find current rank index - fallback to Hall Boy (last) if unrecognized
        const currentHierarchy = profile.hierarchy || "Hall Boy";
        let currentIndex = HIERARCHY_RULES.findIndex(r => clean(r.name) === clean(currentHierarchy));
        if (currentIndex === -1) currentIndex = HIERARCHY_RULES.length - 1; // unrecognized = treat as lowest

        // 3. Already at max?
        if (currentIndex === 0) {
            return NextResponse.json({ success: true, promoted: false, currentRank: HIERARCHY_RULES[0].name });
        }

        // 4. Next rank is one step up (lower index = higher rank)
        const currentRank = HIERARCHY_RULES[currentIndex].name;
        const nextRank = HIERARCHY_RULES[currentIndex - 1].name;

        // 5. Update DB
        const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update({ hierarchy: nextRank })
            .eq('ID', memberId);

        if (updateError) {
            console.error('[promote] Update error:', updateError);
            return NextResponse.json({ error: 'Failed to update database' }, { status: 500 });
        }

        // 6. Send promotion card to private + global chat
        const rawPic = profile.avatar_url || profile.profile_picture_url || "";
        const memberName = profile.name || 'SLAVE';
        const memberPhoto = (rawPic && rawPic.length > 5) ? rawPic : null;
        const cardMsg = `PROMOTION_CARD::${JSON.stringify({
            name: memberName, photo: memberPhoto,
            oldRank: currentRank, newRank: nextRank
        })}`;
        // Insert as 'queen' sender so it shows in the chat box (not the system log)
        try {
            await supabaseAdmin.from('chats').insert({
                member_id: exactEmail || memberId,
                sender_email: 'queen',
                content: cardMsg,
                type: 'text',
                metadata: { isQueen: true, mediaUrl: null }
            });
        } catch (_) {}
        try {
            await supabaseAdmin.from('global_messages').insert({
                sender_email: 'system', sender_name: 'SYSTEM', sender_avatar: null, message: cardMsg,
            });
        } catch (_) {}

        // Discord notification
        discordPromotion(memberName, currentRank, nextRank).catch(() => {});

        return NextResponse.json({ success: true, promoted: true, newRank: nextRank });

    } catch (err: any) {
        console.error('[promote] Unexpected error:', err);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
