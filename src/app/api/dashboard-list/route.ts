import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * Lightweight endpoint for the dashboard sidebar list.
 * Returns what's needed to render the subject list:
 * name, memberId, avatar, hierarchy, lastSeen, silence, paywall, activeTask indicator.
 * Also returns pendingReviews[] for the mobile command center.
 */
export async function GET() {
    try {
        const [{ data: profiles, error }, { data: taskRows }] = await Promise.all([
            supabaseAdmin
                .from('profiles')
                .select('member_id, name, avatar_url, hierarchy, last_active, silence, parameters')
                .order('name'),
            supabaseAdmin
                .from('tasks')
                .select('member_id, taskdom_active_task, "Taskdom_History"'),
        ]);

        if (error) throw error;

        // Build a quick lookup: email → task row
        const taskMap: Record<string, any> = {};
        for (const t of taskRows || []) {
            const key = (t.member_id || '').toLowerCase();
            if (!key) continue;
            taskMap[key] = t;
        }

        // Profile lookup by email for review enrichment
        const profileMap: Record<string, any> = {};
        for (const p of profiles || []) {
            const key = (p.member_id || '').toLowerCase();
            if (key) profileMap[key] = p;
        }

        const now = Date.now();

        // Build global pending review queue across all users
        const pendingReviews: any[] = [];
        for (const t of taskRows || []) {
            let history: any[] = [];
            try { history = typeof t['Taskdom_History'] === 'string' ? JSON.parse(t['Taskdom_History']) : (t['Taskdom_History'] || []); } catch { }
            const email = (t.member_id || '').toLowerCase();
            const profile = profileMap[email];
            for (const entry of history.filter((e: any) => e.status === 'pending')) {
                const rawPic = profile?.avatar_url || profile?.parameters?.avatar_url || '';
                const avatar = (rawPic && rawPic.length > 5) ? rawPic : '/collar-placeholder.png';
                pendingReviews.push({
                    ...entry,
                    member_id: email,
                    memberName: profile?.name || email.split('@')[0],
                    avatarUrl: avatar,
                });
            }
        }

        const users = (profiles || []).map((p: any) => {
            const params = p.parameters || {};
            const rawPic = p.avatar_url || params.avatar_url || params.photoUrl || '';
            const avatar = (rawPic && rawPic.length > 5 && rawPic !== 'undefined' && rawPic !== 'null') ? rawPic : '/collar-placeholder.png';

            const taskRow = taskMap[(p.member_id || '').toLowerCase()] || null;
            let active = taskRow?.taskdom_active_task || null;
            if (typeof active === 'string') { try { active = JSON.parse(active); } catch { active = null; } }
            const endTime = active?.endTime || 0;
            const hasActiveTask = !!(active && (!endTime || endTime > now));

            // Per-user pending reviews (for UserProfile review tab)
            let userReviewQueue: any[] = [];
            if (taskRow) {
                let hist: any[] = [];
                try { hist = typeof taskRow['Taskdom_History'] === 'string' ? JSON.parse(taskRow['Taskdom_History']) : (taskRow['Taskdom_History'] || []); } catch { }
                userReviewQueue = hist.filter((e: any) => e.status === 'pending').map((e: any) => ({
                    ...e,
                    member_id: (p.member_id || '').toLowerCase(),
                    memberName: p.name,
                    avatarUrl: avatar,
                }));
            }

            return {
                memberId: p.member_id || '',
                name: p.name || (p.member_id || '').split('@')[0] || 'Unknown',
                avatar,
                hierarchy: p.hierarchy || 'Hall Boy',
                lastSeen: p.last_active || null,
                silence: p.silence === true,
                paywall: !!(params.paywall?.active),
                activeTask: hasActiveTask ? active : null,
                endTime: hasActiveTask ? endTime : 0,
                reviewQueue: userReviewQueue,
            };
        });

        return NextResponse.json({ success: true, users, pendingReviews });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
