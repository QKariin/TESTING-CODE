import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

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
        const { memberId, currencyId, amount: reqAmount, tierId } = await req.json();
        if (!currencyId) return NextResponse.json({ error: 'Missing currencyId' }, { status: 400 });

        const apiKey = (process.env.PASSIMPAY_API_KEY || '').trim();
        const platformId = (process.env.PASSIMPAY_PLATFORM_ID || '').trim();
        if (!apiKey || !platformId) return NextResponse.json({ error: 'Missing env vars' }, { status: 500 });

        const VALID_AMOUNTS: Record<string, number> = { weekly: 55, monthly: 99, yearly: 299 };
        const amount = tierId && VALID_AMOUNTS[tierId] ? VALID_AMOUNTS[tierId] : (reqAmount && [55, 99, 299].includes(Number(reqAmount)) ? Number(reqAmount) : 55);
        const orderId = `trib${Date.now()}${(memberId || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)}`.slice(0, 64);

        // Step 1: Get live EUR→USD + EUR→crypto rates (PassimPay is USD-based)
        const cgId = CRYPTO_ID_MAP[String(currencyId)] || 'bitcoin';
        let cryptoAmount: string | null = null;
        let amountUsd = Number(amount);
        try {
            const rateRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=eur,usd`, { cache: 'no-store' });
            const rateData = await rateRes.json();
            const eurPrice = rateData[cgId]?.eur;
            const usdPrice = rateData[cgId]?.usd;
            if (eurPrice && usdPrice) {
                amountUsd = Number(amount) * (usdPrice / eurPrice);
                const raw = Number(amount) / eurPrice;
                cryptoAmount = cgId === 'tether' ? raw.toFixed(2) : raw.toFixed(8);
            } else if (eurPrice) {
                const raw = Number(amount) / eurPrice;
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

        // Store pending order in profile if exists (for webhook matching)
        if (memberId) {
            try {
                const { data: profile } = await supabaseAdmin
                    .from('profiles').select('parameters').ilike('member_id', memberId).single();
                if (profile) {
                    await supabaseAdmin.from('profiles').update({
                        parameters: { ...(profile.parameters || {}), pendingTributePay: { orderId, tierId: tierId || 'weekly', amount, created: new Date().toISOString() } },
                    }).ilike('member_id', memberId);
                }
            } catch {}
        }

        try { await supabaseAdmin.from('payment_logs').insert({ member_id: memberId || null, order_id: orderId, tier_id: tierId || null, amount, currency_id: String(currencyId), payment_type: 'tribute' }); } catch {}
        return NextResponse.json({ success: true, address: walletData.address, orderId, cryptoAmount, amountEur: amount });
    } catch (err: any) {
        console.error('[tribute/passimpay] error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
