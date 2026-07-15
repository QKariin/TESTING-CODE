import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { DbService } from '@/lib/supabase-service';
import { generateDefaultProgram } from '@/lib/vault-program-defaults';

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

        // Create day 1 orders from member's program (or generate fresh if missing)
        try {
            let { data: prog } = await supabaseAdmin
                .from('vault_member_program').select('id, program').eq('session_id', sessionId).maybeSingle();

            // If no program exists yet (payment step failed), generate now
            if (!prog) {
                console.log(`[vault proof] No program found for session ${sessionId}, generating fresh...`);
                const freshProgram = generateDefaultProgram();
                // Try reading template first
                try {
                    const { data: template } = await supabaseAdmin
                        .from('vault_program_template').select('*').order('day_number');
                    if (template && template.length > 0) {
                        for (const row of template) {
                            freshProgram[String(row.day_number)] = typeof row.tasks === 'string' ? JSON.parse(row.tasks) : row.tasks;
                        }
                    }
                } catch {}
                await supabaseAdmin.from('vault_member_program').insert({
                    session_id: sessionId, member_id: memberId,
                    program: JSON.stringify(freshProgram),
                });
                prog = { id: null, program: freshProgram } as any;
            }

            const program = typeof prog.program === 'string' ? JSON.parse(prog.program) : prog.program;

            // Check if stale (old format without configs)
            const day1 = program['1'];
            if (day1 && !day1.some((t: any) => t.config)) {
                console.log(`[vault proof] Program is stale for session ${sessionId}, regenerating...`);
                const freshProgram = generateDefaultProgram();
                try {
                    const { data: template } = await supabaseAdmin
                        .from('vault_program_template').select('*').order('day_number');
                    if (template && template.length > 0) {
                        for (const row of template) {
                            freshProgram[String(row.day_number)] = typeof row.tasks === 'string' ? JSON.parse(row.tasks) : row.tasks;
                        }
                    }
                } catch {}
                if (prog.id) {
                    await supabaseAdmin.from('vault_member_program').update({ program: JSON.stringify(freshProgram) }).eq('id', prog.id);
                }
                Object.assign(program, freshProgram);
            }

            const day1Tasks = program['1'] || [];
            const orders = day1Tasks.map((t: any) => {
                const order: any = { type: t.type, target: t.target || 1, done: 0 };
                if (t.label) order.label = t.label;
                if (t.config) order.config = t.config;
                return order;
            });
            const today = new Date().toISOString().split('T')[0];
            await supabaseAdmin.from('vault_daily').insert({
                session_id: sessionId, day_number: 1, date: today,
                orders: JSON.stringify(orders), orders_total: orders.length,
                orders_completed: 0, perfect: false,
            });
        } catch (e: any) {
            console.error('[vault proof] Day 1 orders creation failed:', e?.message);
        }

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
