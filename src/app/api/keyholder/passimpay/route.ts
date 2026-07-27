import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const TIERS: Record<string, { amountEur: number; days: number }> = {
    weekly:    { amountEur: 55,  days: 7  },
    monthly:   { amountEur: 150, days: 30 },
    quarterly: { amountEur: 300, days: 90 },
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

        const { tierId, currencyId } = await req.json();
        const tier = TIERS[tierId];
        if (!tier) return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
        if (!currencyId) return NextResponse.json({ error: 'Missing currencyId' }, { status: 400 });

        const apiKey = (process.env.PASSIMPAY_API_KEY || '').trim();
        const platformId = (process.env.PASSIMPAY_PLATFORM_ID || '').trim();
        if (!apiKey || !platformId) return NextResponse.json({ error: 'Missing env vars' }, { status: 500 });

        const { amountEur, days } = tier;
        const identifier = user.email ||
            (user.user_metadata?.provider_id ? `twitter_${user.user_metadata.provider_id}` : user.id);
        const orderId = `kh${Date.now()}${identifier.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)}`.slice(0, 64);

        // Step 1: Get live EUR→USD + EUR→crypto rates (PassimPay is USD-based)
        const cgId = CRYPTO_ID_MAP[String(currencyId)] || 'bitcoin';
        let cryptoAmount: string | null = null;
        let amountUsd = Number(amountEur);
        try {
            const rateRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=eur,usd`, { cache: 'no-store' });
            const rateData = await rateRes.json();
            const eurPrice = rateData[cgId]?.eur;
            const usdPrice = rateData[cgId]?.usd;
            if (eurPrice && usdPrice) {
                amountUsd = Number(amountEur) * (usdPrice / eurPrice);
                const raw = amountEur / eurPrice;
                cryptoAmount = cgId === 'tether' ? raw.toFixed(2) : raw.toFixed(8);
            } else if (eurPrice) {
                const raw = amountEur / eurPrice;
                cryptoAmount = cgId === 'tether' ? raw.toFixed(2) : raw.toFixed(8);
            }
        } catch {}

        // Step 2: Create order (amount in USD — PassimPay platform currency)
        const orderRes = await ppRequest('/createorder', {
            platform_id: platformId,
            order_id: orderId,
            amount: amountUsd.toFixed(2),
        }, apiKey);
        const orderData = await orderRes.json();
        if (orderData.result !== 1) return NextResponse.json({ error: orderData.message || 'Create order failed' }, { status: 500 });

        // Step 3: Get wallet address
        const walletRes = await ppRequest('/getpaymentwallet', {
            payment_id: String(currencyId),
            platform_id: platformId,
            order_id: orderId,
        }, apiKey);
        const walletData = await walletRes.json();
        if (!walletData.address) return NextResponse.json({ error: walletData.message || 'No wallet returned' }, { status: 500 });

        // Store pending order metadata in profile if exists
        try {
            const { data: profile } = await supabaseAdmin
                .from('profiles').select('parameters').ilike('member_id', identifier).single();
            if (profile) {
                await supabaseAdmin.from('profiles').update({
                    parameters: { ...(profile.parameters || {}), pendingKeyholderPay: { orderId, tierId, days, created: new Date().toISOString() } },
                }).ilike('member_id', identifier);
            }
        } catch {}

        try { await supabaseAdmin.from('payment_logs').insert({ member_id: identifier || null, order_id: orderId, tier_id: tierId || null, amount: amountEur, currency_id: String(currencyId), payment_type: 'keyholder' }); } catch {}
        return NextResponse.json({ success: true, address: walletData.address, orderId, cryptoAmount, amountEur, tierId, days });
    } catch (err: any) {
        console.error('[keyholder/passimpay] error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
