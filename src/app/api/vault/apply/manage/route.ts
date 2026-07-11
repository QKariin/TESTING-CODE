import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCaller, isCEO } from '@/lib/api-auth';
import { DbService } from '@/lib/supabase-service';

export const dynamic = 'force-dynamic';

// POST /api/vault/apply/manage
// Admin actions: accept, deny, schedule
export async function POST(req: Request) {
    const caller = await getCaller();
    if (!caller || !isCEO(caller.email)) {
        return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    try {
        const { action, sessionId, scheduledStart, reason } = await req.json();
        if (!sessionId) return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });

        const { data: session } = await supabaseAdmin
            .from('vault_sessions')
            .select('*')
            .eq('id', sessionId)
            .maybeSingle();

        if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

        const memberId = session.member_id;

        // ── ACCEPT (activate now) ──
        if (action === 'accept') {
            const expiresAt = new Date(Date.now() + session.lock_days * 86400000).toISOString();

            await supabaseAdmin.from('vault_sessions').update({
                status: 'active',
                started_at: new Date().toISOString(),
                expires_at: expiresAt,
            }).eq('id', sessionId);

            // Update profile
            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('ID, parameters')
                .ilike('member_id', memberId)
                .maybeSingle();

            if (profile) {
                const params = profile.parameters || {};
                params.vault_request = { ...params.vault_request, status: 'active', activatedAt: new Date().toISOString() };
                params.active_overlay = 'vault';
                await supabaseAdmin.from('profiles').update({ parameters: params }).eq('ID', profile.ID);
            }

            // Create day 1 vault orders
            try {
                const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://throne.qkarin.com';
                await fetch(`${baseUrl}/api/vault/session`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'create', memberId, tier: session.tier, lockDays: session.lock_days }),
                });
            } catch (_) {}

            // Notify user
            try {
                await DbService.sendMessage(memberId,
                    `YOUR LOCK HAS BEEN ACTIVATED. ${session.lock_days} days. There is no way out.`,
                    'system');
                await _pushToUser(memberId, 'Your lock has begun. Obey.');
            } catch (_) {}

            return NextResponse.json({ success: true, status: 'active' });
        }

        // ── SCHEDULE ──
        if (action === 'schedule') {
            if (!scheduledStart) return NextResponse.json({ error: 'Missing scheduledStart' }, { status: 400 });

            await supabaseAdmin.from('vault_sessions').update({
                status: 'scheduled',
                scheduled_start: scheduledStart,
            }).eq('id', sessionId);

            // Update profile
            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('ID, parameters')
                .ilike('member_id', memberId)
                .maybeSingle();

            if (profile) {
                const params = profile.parameters || {};
                params.vault_request = { ...params.vault_request, status: 'scheduled', scheduledStart };
                await supabaseAdmin.from('profiles').update({ parameters: params }).eq('ID', profile.ID);
            }

            const startDate = new Date(scheduledStart);
            const timeStr = startDate.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' });

            try {
                await DbService.sendMessage(memberId,
                    `LOCK SCHEDULED — ${session.lock_days} days starting ${timeStr}. Prepare yourself.`,
                    'system');
                await _pushToUser(memberId, `Lock approved. Begins ${timeStr}. Prepare yourself.`);
            } catch (_) {}

            return NextResponse.json({ success: true, status: 'scheduled', scheduledStart });
        }

        // ── DENY ──
        if (action === 'deny') {
            await supabaseAdmin.from('vault_sessions').update({ status: 'denied' }).eq('id', sessionId);

            // Refund coins if paid with coins
            if (session.coins_paid > 0) {
                const { data: profile } = await supabaseAdmin
                    .from('profiles')
                    .select('ID, wallet, parameters')
                    .ilike('member_id', memberId)
                    .maybeSingle();

                if (profile) {
                    const newWallet = Number(profile.wallet || 0) + session.coins_paid;
                    const params = profile.parameters || {};
                    delete params.vault_request;
                    await supabaseAdmin.from('profiles').update({ wallet: newWallet, parameters: params }).eq('ID', profile.ID);
                }
            }

            try {
                await DbService.sendMessage(memberId,
                    `LOCK REQUEST DENIED. ${session.coins_paid > 0 ? session.coins_paid.toLocaleString() + ' coins refunded.' : ''} Not today.`,
                    'system');
                await _pushToUser(memberId, 'Your lock request was denied.');
            } catch (_) {}

            return NextResponse.json({ success: true, status: 'denied' });
        }

        // ── RELEASE (immediate early release) ──
        if (action === 'release') {
            await supabaseAdmin.from('vault_sessions').update({
                status: 'released_early',
                released_at: new Date().toISOString(),
                release_reason: reason || null,
            }).eq('id', sessionId);

            // Clear vault_request from profile
            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('ID, parameters')
                .ilike('member_id', memberId)
                .maybeSingle();

            if (profile) {
                const params = profile.parameters || {};
                delete params.vault_request;
                delete params.active_overlay;
                await supabaseAdmin.from('profiles').update({ parameters: params }).eq('ID', profile.ID);
            }

            // DISABLED FOR TESTING
            // try {
            //     const reasonMsg = reason ? `\n\n"${reason}"` : '';
            //     await DbService.sendMessage(memberId,
            //         `LOCK RELEASED EARLY by Queen Karin. ${session.lock_days} day sentence ended.${reasonMsg}`,
            //         'system');
            //     await _pushToUser(memberId, 'Your lock has been released by the Queen.');
            // } catch (_) {}

            return NextResponse.json({ success: true, status: 'released_early' });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (err: any) {
        console.error('[VAULT MANAGE] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

async function _pushToUser(memberId: string, message: string) {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://throne.qkarin.com';
    await fetch(`${baseUrl}/api/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            externalId: memberId,
            title: '🔏 Keyholder',
            message,
        }),
    });
}
