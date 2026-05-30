import { supabaseAdmin } from '@/lib/supabase';
import { HIERARCHY_RULES, getHierarchyReport } from '@/lib/hierarchyRules';
import { mapUserProfile } from '@/lib/mapUserProfile';
import { discordPromotion } from '@/lib/discord';

const clean = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Check if a user qualifies for promotion and promote them if so.
 * Call this after any stat change (routine approved, task approved, kneel, etc.)
 * Fire-and-forget — errors are caught internally.
 */
export async function checkAndPromote(profileIdOrEmail: string): Promise<{ promoted: boolean; newRank?: string } | null> {
    try {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(profileIdOrEmail);
        const { data: profile } = isUuid
            ? await supabaseAdmin.from('profiles').select('*').eq('ID', profileIdOrEmail).maybeSingle()
            : await supabaseAdmin.from('profiles').select('*').ilike('member_id', profileIdOrEmail).maybeSingle();

        if (!profile) return null;

        const { data: taskRow } = await supabaseAdmin
            .from('tasks')
            .select('*')
            .eq('ID', profile.ID)
            .maybeSingle();

        const mapped = mapUserProfile(profile, taskRow);
        const report = getHierarchyReport(mapped);

        if (!report.canPromote || report.isMax) return { promoted: false };

        const currentHierarchy = profile.hierarchy || "Hall Boy";
        let currentIndex = HIERARCHY_RULES.findIndex(r => clean(r.name) === clean(currentHierarchy));
        if (currentIndex === -1) currentIndex = HIERARCHY_RULES.length - 1;
        if (currentIndex === 0) return { promoted: false };

        const currentRank = HIERARCHY_RULES[currentIndex].name;
        const nextRank = HIERARCHY_RULES[currentIndex - 1].name;

        // Clear cert_approved_for so they need a new cert for the next rank
        const params = profile.parameters || {};
        delete params.cert_approved_for;

        const { error } = await supabaseAdmin
            .from('profiles')
            .update({ hierarchy: nextRank, parameters: params })
            .eq('ID', profile.ID);

        if (error) { console.error('[promote] DB error:', error); return null; }

        // Notification card
        const rawPic = profile.avatar_url || profile.profile_picture_url || "";
        const memberName = profile.name || 'SLAVE';
        const memberPhoto = (rawPic && rawPic.length > 5) ? rawPic : null;
        const cardMsg = `PROMOTION_CARD::${JSON.stringify({ name: memberName, photo: memberPhoto, oldRank: currentRank, newRank: nextRank })}`;

        // Private chat
        try { await supabaseAdmin.from('chats').insert({ member_id: profile.member_id, sender_email: 'queen', content: cardMsg, type: 'text', metadata: { isQueen: true, mediaUrl: null } }); } catch (_) {}
        // Global chat
        try { await supabaseAdmin.from('global_messages').insert({ sender_email: 'system', sender_name: 'SYSTEM', sender_avatar: null, message: cardMsg }); } catch (_) {}

        // Push notification
        const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '761d91da-b098-44a7-8d98-75c1cce54dd0';
        const apiKey = process.env.ONESIGNAL_REST_API_KEY;
        if (apiKey) {
            fetch('https://api.onesignal.com/notifications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${apiKey}` },
                body: JSON.stringify({
                    app_id: appId, target_channel: 'push',
                    include_aliases: { external_id: [(profile.member_id || '').toLowerCase()] },
                    headings: { en: 'Queen Karin' },
                    contents: { en: `You have been promoted to ${nextRank.toUpperCase()}.` },
                    url: 'https://throne.qkarin.com/profile',
                }),
            }).catch(() => {});
        }

        // Discord
        discordPromotion(memberName, currentRank, nextRank).catch(() => {});

        console.log(`[promote] ${memberName} (${profile.member_id}): ${currentRank} → ${nextRank}`);
        return { promoted: true, newRank: nextRank };
    } catch (e) {
        console.error('[promote] Error:', e);
        return null;
    }
}
