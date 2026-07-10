import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { DbService } from '@/lib/supabase-service';

export const dynamic = 'force-dynamic';

const LOCK_TIERS: Record<string, { days: number; coins: number; label: string; eurPrice: number }> = {
    '7':  { days: 7,  coins: 5500,  label: '7 Days',  eurPrice: 55  },
    '30': { days: 30, coins: 15000, label: '30 Days', eurPrice: 150 },
    '90': { days: 90, coins: 30000, label: '90 Days', eurPrice: 300 },
};

// POST /api/vault/apply
// Actions: apply (with coins), apply-instant (lock now + video), apply-keyholder (already paid EUR)
export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { action, duration, message: userMessage, requestedStart } = await req.json();
        const email = (user.email || user.user_metadata?.provider_id
            ? `twitter_${user.user_metadata.provider_id}` : user.id).toLowerCase();

        // Get profile
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('ID, wallet, parameters, name, member_id')
            .or(`ID.eq.${user.id},member_id.ilike.${email}`)
            .maybeSingle();

        if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

        const memberId = (profile.member_id || email).toLowerCase();

        // Check for existing active or pending session
        const { data: existing } = await supabaseAdmin
            .from('vault_sessions')
            .select('id, status')
            .eq('member_id', memberId)
            .in('status', ['active', 'pending', 'scheduled'])
            .maybeSingle();

        if (existing) {
            return NextResponse.json({
                error: existing.status === 'active' ? 'Already locked' : 'Lock request already pending',
                existingStatus: existing.status,
            }, { status: 409 });
        }

        const tier = LOCK_TIERS[String(duration)];
        if (!tier) return NextResponse.json({ error: 'Invalid duration' }, { status: 400 });

        // ── KEYHOLDER FLOW (already paid EUR) ──
        if (action === 'apply-keyholder') {
            const params = profile.parameters || {};
            // Verify they have a valid chastity purchase
            if (!params.chastity_tier) {
                return NextResponse.json({ error: 'No keyholder purchase found' }, { status: 400 });
            }

            const chastityDays = params.chastity_days || tier.days;

            // Create session as pending (wait for Queen) or active (instant)
            const { data: session, error } = await supabaseAdmin
                .from('vault_sessions')
                .insert({
                    member_id: memberId,
                    tier: params.chastity_tier,
                    lock_days: chastityDays,
                    status: 'pending',
                })
                .select()
                .single();

            if (error) return NextResponse.json({ error: error.message }, { status: 500 });

            // Clear the chastity purchase marker
            delete params.chastity_tier;
            delete params.chastity_days;
            delete params.chastity_started;
            delete params.chastity_expires;
            params.vault_request = { sessionId: session.id, status: 'pending', requestedAt: new Date().toISOString() };
            await supabaseAdmin.from('profiles').update({ parameters: params }).eq('ID', profile.ID);

            // Notify Queen
            _notifyQueen(profile.name || memberId, chastityDays, 'keyholder').catch(() => {});

            return NextResponse.json({ success: true, status: 'pending', sessionId: session.id });
        }

        // ── COIN PAYMENT FLOW ──
        const wallet = Number(profile.wallet || 0);
        if (wallet < tier.coins) {
            return NextResponse.json({
                error: 'Insufficient coins',
                needed: tier.coins,
                wallet,
            }, { status: 400 });
        }

        // Determine status based on action
        const isInstant = action === 'apply-instant';
        const status = isInstant ? 'active' : 'pending';
        const expiresAt = isInstant
            ? new Date(Date.now() + tier.days * 86400000).toISOString()
            : null;

        // Create vault session
        const insertPayload: any = {
            member_id: memberId,
            tier: `${tier.days}d-coins`,
            lock_days: tier.days,
            status,
            coins_paid: tier.coins,
        };
        if (expiresAt) insertPayload.expires_at = expiresAt;
        if (isInstant) insertPayload.started_at = new Date().toISOString();
        if (userMessage) insertPayload.request_message = userMessage;
        if (requestedStart && !isInstant) insertPayload.scheduled_start = requestedStart;

        const { data: session, error } = await supabaseAdmin
            .from('vault_sessions')
            .insert(insertPayload)
            .select()
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        // Deduct coins
        const newWallet = wallet - tier.coins;
        const params = profile.parameters || {};
        params.vault_request = {
            sessionId: session.id,
            status,
            requestedAt: new Date().toISOString(),
            lockDays: tier.days,
            coinsPaid: tier.coins,
            ...(requestedStart && !isInstant ? { requestedStart } : {}),
        };

        // Add to purchase history
        const purchaseHistory: any[] = params.purchaseHistory || [];
        purchaseHistory.unshift({
            type: isInstant ? 'VAULT_LOCK_INSTANT' : 'VAULT_LOCK_REQUEST',
            amount: tier.coins,
            days: tier.days,
            timestamp: new Date().toISOString(),
            sessionId: session.id,
        });
        if (purchaseHistory.length > 100) purchaseHistory.splice(100);
        params.purchaseHistory = purchaseHistory;

        await supabaseAdmin.from('profiles').update({ wallet: newWallet, parameters: params }).eq('ID', profile.ID);

        // If instant lock, create day 1 orders
        if (isInstant) {
            try {
                const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://throne.qkarin.com';
                await fetch(`${baseUrl}/api/vault/session`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'init-day', memberId, sessionId: session.id }),
                });
            } catch (_) {}
        }

        // System message
        try {
            await DbService.sendMessage(memberId,
                isInstant
                    ? `VAULT LOCK ACTIVATED — ${tier.days} day sentence. ${tier.coins.toLocaleString()} coins charged. Send your verification video.`
                    : `VAULT LOCK REQUESTED — ${tier.days} days. ${tier.coins.toLocaleString()} coins held. Waiting for Queen Karin's approval.`,
                'system');
        } catch (_) {}

        // Notify Queen
        _notifyQueen(profile.name || memberId, tier.days, isInstant ? 'instant' : 'request').catch(() => {});

        return NextResponse.json({
            success: true,
            status,
            sessionId: session.id,
            newWallet,
            lockDays: tier.days,
        });
    } catch (err: any) {
        console.error('[VAULT APPLY] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// GET /api/vault/apply — check current vault request status
export async function GET(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const email = (user.email || user.user_metadata?.provider_id
            ? `twitter_${user.user_metadata.provider_id}` : user.id).toLowerCase();

        // Look up profile to get member_id
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('member_id')
            .or(`ID.eq.${user.id},member_id.ilike.${email}`)
            .maybeSingle();

        const memberId = (profile?.member_id || email).toLowerCase();

        const { data: session } = await supabaseAdmin
            .from('vault_sessions')
            .select('*')
            .ilike('member_id', memberId)
            .in('status', ['active', 'pending', 'scheduled'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (!session) return NextResponse.json({ active: false });

        return NextResponse.json({
            active: true,
            status: session.status,
            sessionId: session.id,
            lockDays: session.lock_days,
            tier: session.tier,
            scheduledStart: session.scheduled_start || null,
            coinsPaid: session.coins_paid || 0,
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

async function _notifyQueen(name: string, days: number, type: string) {
    const titles: Record<string, string> = {
        request: 'Lock Request',
        instant: 'INSTANT LOCK',
        keyholder: 'Keyholder Lock',
    };
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://throne.qkarin.com';
    await fetch(`${baseUrl}/api/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            externalId: 'ceo@qkarin.com',
            title: titles[type] || 'Vault',
            message: `${name} wants ${days} days. ${type === 'instant' ? 'Self-locked — needs video.' : 'Awaiting your approval.'}`,
        }),
    });
}
