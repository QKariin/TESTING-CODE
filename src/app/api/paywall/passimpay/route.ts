import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { findProfile } from '@/lib/lookup';

export const dynamic = 'force-dynamic';

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
        const { memberId, amount, currencyId } = await req.json();
        if (!memberId || !amount || !currencyId) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

        const apiKey = (process.env.PASSIMPAY_API_KEY || '').trim();
        const platformId = (process.env.PASSIMPAY_PLATFORM_ID || '').trim();
        if (!apiKey || !platformId) return NextResponse.json({ error: 'Missing env vars' }, { status: 500 });

        const orderId = `pw${Date.now()}${memberId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)}`.slice(0, 64);

        // Step 1: Get live EUR→USD + EUR→crypto rates from CoinGecko
        // PassimPay platform is USD-based, so we must convert EUR→USD before creating order
        const cgMap: Record<string, string> = {
            '10': 'bitcoin', '20': 'ethereum', '60': 'litecoin',
            '70': 'tether', '71': 'tether', '72': 'tether',
        };
        const cgId = cgMap[String(currencyId)] || 'bitcoin';
        let cryptoAmount: string | null = null;
        let amountUsd = Number(amount); // fallback: treat EUR ≈ USD if CoinGecko fails
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
        console.log('[passimpay] createorder:', orderData);
        if (orderData.result !== 1) return NextResponse.json({ error: orderData.message || 'Create order failed' }, { status: 500 });

        // Step 3: Get wallet address for chosen currency
        const walletRes = await ppRequest('/getpaymentwallet', {
            payment_id: String(currencyId),
            platform_id: platformId,
            order_id: orderId,
        }, apiKey);
        const walletData = await walletRes.json();
        console.log('[passimpay] getwallet:', walletData);
        if (!walletData.address) return NextResponse.json({ error: walletData.message || 'No wallet address returned' }, { status: 500 });

        // Store orderId so webhook can find this member
        const profile = await findProfile(memberId, 'ID, parameters');
        if (profile) {
            await supabaseAdmin.from('profiles').update({
                parameters: { ...(profile.parameters || {}), pendingCryptoPay: { orderId, created: new Date().toISOString() } },
            }).eq('ID', profile.ID);
        }

        try { await supabaseAdmin.from('payment_logs').insert({ member_id: memberId || null, order_id: orderId, tier_id: null, amount: Number(amount), currency_id: String(currencyId), payment_type: 'paywall' }); } catch {}
        return NextResponse.json({ success: true, address: walletData.address, orderId, cryptoAmount, amountEur: Number(amount) });
    } catch (err: any) {
        console.error('[passimpay] error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
