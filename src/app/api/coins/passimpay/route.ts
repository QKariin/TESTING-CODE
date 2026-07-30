import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { findProfile } from '@/lib/lookup';

export const dynamic = 'force-dynamic';

const COIN_PACKAGES: Record<number, number> = {
    2000: 20, 5500: 50, 12000: 100, 30000: 250, 70000: 500, 150000: 1000,
};

const CRYPTO_ID_MAP: Record<string, string> = {
    '70': 'tether', '10': 'bitcoin', '20': 'ethereum', '60': 'litecoin',
};

function ppRequest(endpoint: string, params: Record<string, string>, apiKey: string) {
    const qs = new URLSearchParams(params).toString();
    const hash = createHmac('sha256', apiKey).update(qs).digest('hex');
    return fetch(`https://api.passimpay.io${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ ...params, hash }).toString(),
    });
}

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { coins, currencyId } = await req.json();
        const amountEur = COIN_PACKAGES[coins];
        if (!amountEur) return NextResponse.json({ error: 'Invalid coin package' }, { status: 400 });
        if (!currencyId) return NextResponse.json({ error: 'Missing currencyId' }, { status: 400 });

        const apiKey = (process.env.PASSIMPAY_API_KEY || '').trim();
        const platformId = (process.env.PASSIMPAY_PLATFORM_ID || '').trim();
        if (!apiKey || !platformId) return NextResponse.json({ error: 'Missing env vars' }, { status: 500 });

        const identifier = user.email?.trim().toLowerCase() ||
            `${user.app_metadata?.provider || 'oauth'}_${user.user_metadata?.provider_id || user.id}`;
        const orderId = `coins${Date.now()}${identifier.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)}`.slice(0, 64);

        // Step 1: Create order
        const orderRes = await ppRequest('/createorder', {
            platform_id: platformId,
            order_id: orderId,
            amount: Number(amountEur).toFixed(2),
        }, apiKey);
        const orderData = await orderRes.json();
        if (orderData.result !== 1) return NextResponse.json({ error: orderData.message || 'Create order failed' }, { status: 500 });

        // Step 2: Get wallet address
        const walletRes = await ppRequest('/getpaymentwallet', {
            payment_id: String(currencyId),
            platform_id: platformId,
            order_id: orderId,
        }, apiKey);
        const walletData = await walletRes.json();
        if (!walletData.address) return NextResponse.json({ error: walletData.message || 'No wallet returned' }, { status: 500 });

        // Step 3: Get EUR→crypto rate
        const cgId = CRYPTO_ID_MAP[String(currencyId)] || 'bitcoin';
        let cryptoAmount: string | null = null;
        try {
            const rateRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=eur`, { cache: 'no-store' });
            const rateData = await rateRes.json();
            const eurPrice = rateData[cgId]?.eur;
            if (eurPrice) {
                const raw = amountEur / eurPrice;
                cryptoAmount = cgId === 'tether' ? raw.toFixed(2) : raw.toFixed(8);
            }
        } catch {}

        // Store pending order in profile so webhook can match it
        try {
            const profile = await findProfile(identifier, 'ID, parameters');
            if (profile) {
                await supabaseAdmin.from('profiles').update({
                    parameters: { ...(profile.parameters || {}), pendingCoinsPay: { orderId, coins, created: new Date().toISOString() } },
                }).eq('ID', profile.ID);
            }
        } catch {}

        try { await supabaseAdmin.from('payment_logs').insert({ member_id: identifier || null, order_id: orderId, tier_id: null, amount: Number(amountEur), currency_id: String(currencyId), payment_type: 'coins', user_id: user.id }); } catch {}

        return NextResponse.json({ success: true, address: walletData.address, orderId, cryptoAmount, amountEur, coins });
    } catch (err: any) {
        console.error('[coins/passimpay] error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
