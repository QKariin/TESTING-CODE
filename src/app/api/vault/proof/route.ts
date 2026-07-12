import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { DbService } from '@/lib/supabase-service';

export const dynamic = 'force-dynamic';

// POST /api/vault/proof — submit video proof for self-lock
export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { sessionId, videoUrl, thumbUrl, memberId: clientMemberId } = await req.json();
        if (!sessionId || !videoUrl) return NextResponse.json({ error: 'Missing sessionId or videoUrl' }, { status: 400 });

        const email = (clientMemberId || user.email || (user.user_metadata?.provider_id
            ? `twitter_${user.user_metadata.provider_id}` : user.id)).toLowerCase();

        const { data: profile } = await supabaseAdmin
            .from('profiles').select('ID, member_id, name').ilike('member_id', email).maybeSingle();
        if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
        const memberId = (profile.member_id || email).toLowerCase();

        // Verify session exists and is awaiting_video
        const { data: session } = await supabaseAdmin
            .from('vault_sessions')
            .select('*')
            .eq('id', sessionId)
            .ilike('member_id', memberId)
            .eq('status', 'awaiting_video')
            .maybeSingle();

        if (!session) return NextResponse.json({ error: 'No awaiting session found' }, { status: 404 });

        const now = new Date().toISOString();
        const expiresAt = new Date(Date.now() + session.lock_days * 86400000).toISOString();

        // Activate the lock — started_at = now (video submission time)
        const { error } = await supabaseAdmin
            .from('vault_sessions')
            .update({
                status: 'active',
                started_at: now,
                expires_at: expiresAt,
                video_proof_url: videoUrl,
                video_thumb_url: thumbUrl || null,
                video_submitted_at: now,
            })
            .eq('id', sessionId);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        // Set active_overlay = 'vault' on profile
        try {
            const { data: fullProfile } = await supabaseAdmin.from('profiles').select('parameters').eq('ID', profile.ID).maybeSingle();
            if (fullProfile) {
                const params = fullProfile.parameters || {};
                params.active_overlay = 'vault';
                params.vault_request = { ...params.vault_request, status: 'active', activatedAt: now };
                await supabaseAdmin.from('profiles').update({ parameters: params }).eq('ID', profile.ID);
            }
        } catch (_) {}

        // Create day 1 orders
        try {
            const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://throne.qkarin.com';
            await fetch(`${baseUrl}/api/vault/session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'init-day', memberId, sessionId }),
            });
        } catch (_) {}

        // System message
        try {
            await DbService.sendMessage(memberId,
                `LOCK ACTIVATED — Day 1 of ${session.lock_days}. Video proof submitted. Your sentence has begun.`,
                'system');
        } catch (_) {}

        // Notify Queen to review video
        try {
            const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://throne.qkarin.com';
            await fetch(`${baseUrl}/api/push`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    externalId: 'ceo@qkarin.com',
                    title: '🔏 Video Proof',
                    message: `${profile.name || memberId} submitted lock proof — ${session.lock_days} days. Review video.`,
                }),
            });
        } catch (_) {}

        return NextResponse.json({ success: true, status: 'active', startedAt: now, expiresAt });
    } catch (err: any) {
        console.error('[VAULT PROOF] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
