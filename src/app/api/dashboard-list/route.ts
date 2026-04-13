import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * Lightweight endpoint for the dashboard sidebar list.
 * Returns ONLY what's needed to render the subject list:
 * name, memberId, avatar, hierarchy, lastSeen, silence, paywall status.
 * Tasks, chat history, full profile — none of that. Loads on click.
 */
export async function GET() {
    try {
        const { data: profiles, error } = await supabaseAdmin
            .from('profiles')
            .select('member_id, name, avatar_url, hierarchy, last_active, silence, parameters')
            .order('name');

        if (error) throw error;

        const users = (profiles || []).map((p: any) => {
            const params = p.parameters || {};
            const rawPic = p.avatar_url || params.avatar_url || params.photoUrl || '';
            const avatar = (rawPic && rawPic.length > 5 && rawPic !== 'undefined' && rawPic !== 'null') ? rawPic : '/queen-karin.png';
            return {
                memberId: p.member_id || '',
                name: p.name || (p.member_id || '').split('@')[0] || 'Unknown',
                avatar,
                hierarchy: p.hierarchy || 'Hall Boy',
                lastSeen: p.last_active || null,
                silence: p.silence === true,
                paywall: !!(params.paywall?.active),
            };
        });

        return NextResponse.json({ success: true, users });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
