import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';

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
        const amountStr = Number(amount).toFixed(2);

        // Step 1: Create order
        const orderRes = await ppRequest('/createorder', {
            platform_id: platformId,
            order_id: orderId,
            amount: amountStr,
        }, apiKey);
        const orderData = await orderRes.json();
        console.log('[passimpay] createorder:', orderData);
        if (orderData.result !== 1) return NextResponse.json({ error: orderData.message || 'Create order failed' }, { status: 500 });

        // Step 2: Get wallet address for chosen currency
        // Note: payment_id must come before platform_id in params (PHP SDK order)
        const walletRes = await ppRequest('/getpaymentwallet', {
            payment_id: String(currencyId),
            platform_id: platformId,
            order_id: orderId,
        }, apiKey);
        const walletData = await walletRes.json();
        console.log('[passimpay] getwallet:', walletData);
        if (!walletData.address) return NextResponse.json({ error: walletData.message || 'No wallet address returned' }, { status: 500 });

        // Step 3: Get live EUR→crypto rate from CoinGecko
        const cgMap: Record<string, string> = {
            '10': 'bitcoin', '20': 'ethereum', '60': 'litecoin',
            '70': 'tether', '71': 'tether', '72': 'tether',
        };
        const cgId = cgMap[String(currencyId)] || 'bitcoin';
        let cryptoAmount: string | null = null;
        try {
            const rateRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=eur`, { cache: 'no-store' });
            const rateData = await rateRes.json();
            const eurPrice = rateData[cgId]?.eur;
            if (eurPrice) {
                const raw = Number(amount) / eurPrice;
                // USDT is stable, show 2dp; others show 8dp
                cryptoAmount = cgId === 'tether' ? raw.toFixed(2) : raw.toFixed(8);
            }
        } catch {}

        // Store orderId so webhook can find this member
        const { data: profile } = await supabaseAdmin.from('profiles').select('parameters').ilike('member_id', memberId).single();
        if (profile) {
            await supabaseAdmin.from('profiles').update({
                parameters: { ...(profile.parameters || {}), pendingCryptoPay: { orderId, created: new Date().toISOString() } },
            }).ilike('member_id', memberId);
        }

        return NextResponse.json({ success: true, address: walletData.address, orderId, cryptoAmount, amountEur: Number(amount) });
    } catch (err: any) {
        console.error('[passimpay] error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
