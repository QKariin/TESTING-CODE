import { NextRequest, NextResponse } from 'next/server';
import { getPayPalToken } from '@/lib/paypal';
import { supabaseAdmin } from '@/lib/supabase';
import { discordNewMember } from '@/lib/discord';

export const dynamic = 'force-dynamic';

const TIERS: Record<string, { days: number }> = {
    weekly: { days: 7 }, monthly: { days: 30 }, quarterly: { days: 90 },
};

const SUCCESS_URLS: Record<string, string> = {
    tribute: '/onboarding', keyholder: '/profile', coins: '/profile', paywall: '/profile',
};

const CANCEL_URLS: Record<string, string> = {
    tribute: '/tribute', keyholder: '/keyholder', coins: '/profile', paywall: '/profile',
};

export async function GET(req: NextRequest) {
    const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://throne.qkarin.com').replace(/\/$/, '');
    const { searchParams } = req.nextUrl;

    const token = searchParams.get('token'); // PayPal order ID
    const type = searchParams.get('type') || '';
    const memberId = searchParams.get('memberId') || '';
    const userId = searchParams.get('userId') || '';
    const tierId = searchParams.get('tierId') || 'weekly';
    const coins = parseInt(searchParams.get('coins') || '0', 10);

    if (!token || !type || !memberId) {
        return NextResponse.redirect(`${baseUrl}/profile?paypal=error`);
    }

    try {
        const accessToken = await getPayPalToken();

        const captureRes = await fetch(`https://api-m.paypal.com/v2/checkout/orders/${token}/capture`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'PayPal-Request-Id': `capture-${token}`,
            },
        });
        const capture = await captureRes.json();

        if (capture.status !== 'COMPLETED') {
            console.error('[paypal/capture] Not completed:', JSON.stringify(capture));
            return NextResponse.redirect(`${baseUrl}${CANCEL_URLS[type] || '/profile'}?paypal=failed`);
        }

        if (type === 'tribute') {
            await fulfillTribute(token, userId, memberId);
        } else if (type === 'keyholder') {
            await fulfillKeyholder(token, userId, memberId, tierId);
        } else if (type === 'coins') {
            await fulfillCoins(token, memberId, coins);
        } else if (type === 'paywall') {
            await fulfillPaywall(token, memberId);
        }

        return NextResponse.redirect(`${baseUrl}${SUCCESS_URLS[type] || '/profile'}?paypal=success`);
    } catch (err: any) {
        console.error('[paypal/capture] error:', err);
        return NextResponse.redirect(`${baseUrl}/profile?paypal=error`);
    }
}

async function getDisplayName(userId: string, memberId: string): Promise<string> {
    if (!userId) return memberId.split('@')[0] || 'Subject';
    try {
        const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (!user) return memberId.split('@')[0] || 'Subject';
        const raw = user.user_metadata?.full_name || user.user_metadata?.user_name || (user.email ? user.email.split('@')[0] : 'Subject');
        return raw.split(' ')[0];
    } catch {
        return memberId.split('@')[0] || 'Subject';
    }
}

async function fulfillTribute(orderId: string, userId: string, memberId: string) {
    const displayName = await getDisplayName(userId, memberId);
    const uid = userId || memberId;

    const { data: existing } = await supabaseAdmin
        .from('profiles').select('ID').eq('ID', uid).maybeSingle();

    if (!existing) {
        await supabaseAdmin.from('profiles').insert({
            ID: uid,
            member_id: memberId,
            name: displayName,
            hierarchy: 'Hall Boy',
            score: 0,
            wallet: 5000,
            parameters: { devotion: 100 },
        });
        await supabaseAdmin.from('tasks').insert({
            ID: uid,
            member_id: memberId,
            Name: displayName,
            Status: 'idle',
            Taskdom_History: '[]',
            taskdom_active_task: null,
            taskdom_pending_state: null,
        });
    }
}

async function fulfillKeyholder(orderId: string, userId: string, memberId: string, tierId: string) {
    const tier = TIERS[tierId] || { days: 7 };
    const expiresAt = new Date(Date.now() + tier.days * 86400000).toISOString();
    const displayName = await getDisplayName(userId, memberId);
    const uid = userId || memberId;

    const { data: existing } = await supabaseAdmin
        .from('profiles')
        .select('ID, parameters')
        .or(`ID.eq.${uid}${memberId ? `,member_id.ilike.${memberId}` : ''}`)
        .maybeSingle();

    if (existing) {
        const p = existing.parameters || {};
        p.source = 'chastity';
        p.chastity_tier = tierId;
        p.chastity_days = tier.days;
        p.chastity_started = new Date().toISOString();
        p.chastity_expires = expiresAt;
        p.paypal_keyholder_order = orderId;
        await supabaseAdmin.from('profiles').update({ parameters: p }).eq('ID', existing.ID);
    } else {
        await supabaseAdmin.from('profiles').insert({
            ID: uid,
            member_id: memberId,
            name: displayName,
            hierarchy: 'Chastity Sub',
            score: 0,
            wallet: 0,
            parameters: {
                source: 'chastity',
                chastity_tier: tierId,
                chastity_days: tier.days,
                chastity_started: new Date().toISOString(),
                chastity_expires: expiresAt,
                paypal_keyholder_order: orderId,
            },
        });
        await supabaseAdmin.from('tasks').insert({
            ID: uid, member_id: memberId, Name: displayName,
            Status: 'idle', Taskdom_History: '[]',
        });
    }

    discordNewMember(`${displayName} (Keyholder ${tierId} via PayPal)`).catch(() => {});

    try {
        const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://throne.qkarin.com').replace(/\/$/, '');
        await fetch(`${baseUrl}/api/push`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                externalId: 'ceo@qkarin.com',
                title: 'New Keyholder Sub (PayPal)',
                message: `${displayName} surrendered their key — ${tierId} paid via PayPal`,
            }),
        });
    } catch {}
}

async function fulfillCoins(orderId: string, memberId: string, coins: number) {
    if (!coins) return;
    const { data: profile } = await supabaseAdmin
        .from('profiles').select('ID, wallet, parameters').ilike('member_id', memberId).maybeSingle();
    if (!profile) return;

    const profileParams = profile.parameters || {};

    // Idempotency: skip if already processed
    const processed: string[] = profileParams.processedPaypalOrders || [];
    if (processed.includes(orderId)) return;
    processed.push(orderId);
    profileParams.processedPaypalOrders = processed;

    const newWallet = (profile.wallet || 0) + coins;
    const purchaseEntry = { coins, memberId, orderId, method: 'paypal', timestamp: new Date().toISOString() };
    const history: any[] = profileParams.purchaseHistory || [];
    history.unshift(purchaseEntry);
    if (history.length > 100) history.splice(100);
    profileParams.purchaseHistory = history;
    profileParams.latestPurchaseNotification = purchaseEntry;

    await supabaseAdmin.from('profiles').update({
        wallet: newWallet, parameters: profileParams,
    }).eq('ID', profile.ID);
}

async function fulfillPaywall(orderId: string, memberId: string) {
    const { data: profile } = await supabaseAdmin
        .from('profiles').select('ID, name, parameters').ilike('member_id', memberId).maybeSingle();
    if (!profile) return;

    const params = profile.parameters || {};
    await supabaseAdmin.from('profiles').update({
        paywall: false,
        parameters: {
            ...params,
            paywall: { ...(params.paywall || {}), active: false },
            purchaseHistory: [
                ...(params.purchaseHistory || []),
                {
                    type: 'PAYWALL_TRIBUTE_PAYPAL',
                    amount: params.paywall?.amount || 0,
                    timestamp: new Date().toISOString(),
                    memberId,
                    name: profile.name || memberId,
                    sessionId: orderId,
                },
            ],
        },
    }).eq('ID', profile.ID);
}
