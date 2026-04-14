import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * Lightweight endpoint for the dashboard sidebar list.
 * Returns what's needed to render the subject list:
 * name, memberId, avatar, hierarchy, lastSeen, silence, paywall, activeTask indicator.
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
                .select('member_id, taskdom_active_task'),
        ]);

        if (error) throw error;

        // Build a quick lookup: email → active task object
        const taskMap: Record<string, any> = {};
        for (const t of taskRows || []) {
            const key = (t.member_id || '').toLowerCase();
            if (!key) continue;
            let active = t.taskdom_active_task;
            if (typeof active === 'string') {
                try { active = JSON.parse(active); } catch { active = null; }
            }
            taskMap[key] = active || null;
        }

        const now = Date.now();
        const users = (profiles || []).map((p: any) => {
            const params = p.parameters || {};
            const rawPic = p.avatar_url || params.avatar_url || params.photoUrl || '';
            const avatar = (rawPic && rawPic.length > 5 && rawPic !== 'undefined' && rawPic !== 'null') ? rawPic : '/queen-karin.png';

            const activeTask = taskMap[(p.member_id || '').toLowerCase()] || null;
            const endTime = activeTask?.endTime || 0;
            const hasActiveTask = !!(activeTask && (!endTime || endTime > now));

            return {
                memberId: p.member_id || '',
                name: p.name || (p.member_id || '').split('@')[0] || 'Unknown',
                avatar,
                hierarchy: p.hierarchy || 'Hall Boy',
                lastSeen: p.last_active || null,
                silence: p.silence === true,
                paywall: !!(params.paywall?.active),
                activeTask: hasActiveTask ? activeTask : null,
                endTime: hasActiveTask ? endTime : 0,
            };
        });

        return NextResponse.json({ success: true, users });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
