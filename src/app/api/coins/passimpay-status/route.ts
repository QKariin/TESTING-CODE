import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const { orderId, memberId, coins } = await req.json();
        if (!orderId || !memberId || !coins) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

        const apiKey = (process.env.PASSIMPAY_API_KEY || '').trim();
        const platformId = (process.env.PASSIMPAY_PLATFORM_ID || '').trim();
        if (!apiKey || !platformId) return NextResponse.json({ error: 'Missing env vars' }, { status: 500 });

        // Check PassimPay order status
        const params = { platform_id: platformId, order_id: orderId };
        const qs = new URLSearchParams(params).toString();
        const hash = createHmac('sha256', apiKey).update(qs).digest('hex');
        const res = await fetch('https://api.passimpay.io/orderstatus', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ ...params, hash }).toString(),
        });
        const data = await res.json();
        const paid = data.result === 1 && data.status === 'paid';
        if (!paid) return NextResponse.json({ paid: false });

        // Payment confirmed — credit coins
        const { data: profile } = await supabaseAdmin
            .from('profiles').select('ID, wallet, parameters').ilike('member_id', memberId).maybeSingle();
        if (!profile) return NextResponse.json({ paid: true, error: 'Profile not found' });

        const profileParams = profile.parameters || {};

        // Idempotency: skip if this order was already processed
        const processed: string[] = profileParams.processedCryptoOrders || [];
        if (processed.includes(orderId)) {
            return NextResponse.json({ paid: true, newWallet: profile.wallet, alreadyProcessed: true });
        }
        processed.push(orderId);
        profileParams.processedCryptoOrders = processed;

        const newWallet = (profile.wallet || 0) + coins;
        const purchaseEntry = {
            coins, memberId, orderId, method: 'passimpay',
            timestamp: new Date().toISOString(),
        };
        const history: any[] = profileParams.purchaseHistory || [];
        history.unshift(purchaseEntry);
        if (history.length > 100) history.splice(100);
        profileParams.purchaseHistory = history;
        profileParams.pendingCoinsPay = null;
        profileParams.latestPurchaseNotification = purchaseEntry;

        await supabaseAdmin.from('profiles').update({
            wallet: newWallet, parameters: profileParams,
        }).eq('ID', profile.ID);

        return NextResponse.json({ paid: true, newWallet });
    } catch (err: any) {
        console.error('[coins/passimpay-status] error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
