import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

function verifySignature(body: string, signature: string, secretKey: string): boolean {
    const computed = crypto.createHmac('sha256', secretKey).update(body).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
}

export async function POST(req: Request) {
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const body = await req.text();
    const signature = req.headers.get('X-Signature') || req.headers.get('x-signature') || '';

    // Verify webhook signature if secret key is configured
    const secretKey = process.env.DV_NET_SECRET_KEY;
    if (secretKey && signature) {
        try {
            if (!verifySignature(body, signature, secretKey)) {
                console.error('[DV WEBHOOK] Invalid signature');
                return NextResponse.json({ success: false }, { status: 401 });
            }
        } catch (e) {
            console.error('[DV WEBHOOK] Signature verification error:', e);
        }
    }

    let payload: any;
    try {
        payload = JSON.parse(body);
    } catch {
        return NextResponse.json({ success: false }, { status: 400 });
    }

    console.log('[DV WEBHOOK] Received:', JSON.stringify(payload).slice(0, 500));

    const status = payload.status;
    const storeExternalId = payload.store_external_id || payload.id;
    const txHash = payload.transactions?.tx_hash || payload.tx_hash || null;
    const bcUniqKey = payload.transactions?.bc_uniq_key || payload.bc_uniq_key || null;

    if (status !== 'completed' && status !== 'paid') {
        // Not a completed payment — acknowledge but don't process
        return NextResponse.json({ success: true });
    }

    if (!storeExternalId) {
        console.error('[DV WEBHOOK] No store_external_id in payload');
        return NextResponse.json({ success: true });
    }

    try {
        // Look up the order
        const { data: order, error: orderErr } = await supabaseAdmin
            .from('crypto_orders')
            .select('*')
            .eq('id', storeExternalId)
            .maybeSingle();

        if (orderErr || !order) {
            console.error('[DV WEBHOOK] Order not found:', storeExternalId, orderErr);
            return NextResponse.json({ success: true });
        }

        // Idempotency: skip if already completed
        if (order.status === 'completed') {
            console.log('[DV WEBHOOK] Order already completed:', storeExternalId);
            return NextResponse.json({ success: true });
        }

        // Mark order as completed
        await supabaseAdmin.from('crypto_orders').update({
            status: 'completed',
            tx_hash: txHash,
            completed_at: new Date().toISOString(),
        }).eq('id', storeExternalId);

        // Credit coins to user
        const coins = order.coins;
        const userEmail = order.user_email;
        const userId = order.user_id;

        let profile: any = null;
        if (userEmail) {
            const { data } = await supabaseAdmin
                .from('profiles')
                .select('*')
                .ilike('member_id', userEmail)
                .maybeSingle();
            profile = data;
        }
        if (!profile && userId) {
            const { data } = await supabaseAdmin
                .from('profiles')
                .select('*')
                .eq('ID', userId)
                .maybeSingle();
            profile = data;
        }

        if (profile) {
            const newBalance = (profile.wallet || 0) + coins;
            const profileParams = profile.parameters || {};

            // Track processed crypto payments
            const processedCrypto: string[] = profileParams.processedCryptoOrders || [];
            if (!processedCrypto.includes(storeExternalId)) {
                processedCrypto.push(storeExternalId);
            }
            profileParams.processedCryptoOrders = processedCrypto;

            // Purchase notification
            const purchaseEntry = {
                coins,
                name: profile.name || userEmail || userId || 'Unknown',
                memberId: profile.member_id || userEmail || '',
                timestamp: new Date().toISOString(),
                orderId: storeExternalId,
                method: 'crypto',
            };
            profileParams.latestPurchaseNotification = purchaseEntry;

            // Append to purchase history
            const purchaseHistory: any[] = profileParams.purchaseHistory || [];
            if (!purchaseHistory.some((e: any) => e.orderId === storeExternalId)) {
                purchaseHistory.unshift(purchaseEntry);
                if (purchaseHistory.length > 100) purchaseHistory.splice(100);
            }
            profileParams.purchaseHistory = purchaseHistory;

            await supabaseAdmin
                .from('profiles')
                .update({ wallet: newBalance, parameters: profileParams })
                .eq('ID', profile.ID);

            console.log(`[DV WEBHOOK] Wallet updated: ${newBalance} (+${coins}) for ${userEmail}`);
        } else {
            console.error(`[DV WEBHOOK] User not found for coin deposit: ${userEmail || userId}`);
        }
    } catch (err: any) {
        console.error('[DV WEBHOOK] Processing error:', err);
        return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: true });
}
