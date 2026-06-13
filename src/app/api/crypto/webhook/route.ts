import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// CryptAPI whitelisted IPs
const ALLOWED_IPS = ['51.77.105.132', '135.125.112.47'];

export async function POST(req: Request) {
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get('order_id');
    const coins = parseInt(searchParams.get('coins') || '0', 10);
    const userId = searchParams.get('user_id') || '';
    const userEmail = searchParams.get('user_email') || '';

    let body: any;
    try {
        body = await req.json();
    } catch {
        try {
            const text = await req.text();
            body = Object.fromEntries(new URLSearchParams(text));
        } catch {
            body = {};
        }
    }

    const uuid = body.uuid || '';
    const txidIn = body.txid_in || '';
    const valueCoin = parseFloat(body.value_coin || '0');
    const confirmations = parseInt(body.confirmations || '0', 10);
    const isPending = body.pending === '1' || body.pending === 1;

    console.log(`[CRYPTAPI WEBHOOK] order=${orderId} uuid=${uuid} value=${valueCoin} confirmations=${confirmations} pending=${isPending}`);

    if (!orderId || !coins) {
        console.error('[CRYPTAPI WEBHOOK] Missing order_id or coins');
        return new NextResponse('*ok*', { status: 200 });
    }

    // Skip pending (unconfirmed) transactions
    if (isPending) {
        console.log('[CRYPTAPI WEBHOOK] Pending transaction, waiting for confirmation');
        return new NextResponse('*ok*', { status: 200 });
    }

    try {
        // Look up order
        const { data: order } = await supabaseAdmin
            .from('crypto_orders')
            .select('*')
            .eq('id', orderId)
            .maybeSingle();

        if (!order) {
            console.error('[CRYPTAPI WEBHOOK] Order not found:', orderId);
            return new NextResponse('*ok*', { status: 200 });
        }

        // Idempotency: skip if already completed
        if (order.status === 'completed') {
            console.log('[CRYPTAPI WEBHOOK] Order already completed:', orderId);
            return new NextResponse('*ok*', { status: 200 });
        }

        // Also check uuid for duplicate transactions
        if (uuid && order.tx_hash === uuid) {
            console.log('[CRYPTAPI WEBHOOK] Duplicate uuid:', uuid);
            return new NextResponse('*ok*', { status: 200 });
        }

        // Mark order as completed
        await supabaseAdmin.from('crypto_orders').update({
            status: 'completed',
            tx_hash: uuid || txidIn,
            completed_at: new Date().toISOString(),
        }).eq('id', orderId);

        // Credit coins to user
        let profile: any = null;
        const email = userEmail || order.user_email;
        const uid = userId || order.user_id;

        if (email) {
            const { data } = await supabaseAdmin
                .from('profiles')
                .select('*')
                .ilike('member_id', email)
                .maybeSingle();
            profile = data;
        }
        if (!profile && uid) {
            const { data } = await supabaseAdmin
                .from('profiles')
                .select('*')
                .eq('ID', uid)
                .maybeSingle();
            profile = data;
        }

        if (profile) {
            const newBalance = (profile.wallet || 0) + coins;
            const profileParams = profile.parameters || {};

            // Track processed crypto orders
            const processed: string[] = profileParams.processedCryptoOrders || [];
            if (!processed.includes(orderId)) {
                processed.push(orderId);
            }
            profileParams.processedCryptoOrders = processed;

            // Purchase notification
            const purchaseEntry = {
                coins,
                name: profile.name || email || uid || 'Unknown',
                memberId: profile.member_id || email || '',
                timestamp: new Date().toISOString(),
                orderId,
                method: 'crypto',
            };
            profileParams.latestPurchaseNotification = purchaseEntry;

            // Append to purchase history
            const history: any[] = profileParams.purchaseHistory || [];
            if (!history.some((e: any) => e.orderId === orderId)) {
                history.unshift(purchaseEntry);
                if (history.length > 100) history.splice(100);
            }
            profileParams.purchaseHistory = history;

            await supabaseAdmin
                .from('profiles')
                .update({ wallet: newBalance, parameters: profileParams })
                .eq('ID', profile.ID);

            console.log(`[CRYPTAPI WEBHOOK] Wallet updated: ${newBalance} (+${coins}) for ${email}`);
        } else {
            console.error(`[CRYPTAPI WEBHOOK] User not found: ${email || uid}`);
        }
    } catch (err: any) {
        console.error('[CRYPTAPI WEBHOOK] Error:', err);
    }

    // Must return *ok* to prevent CryptAPI retries
    return new NextResponse('*ok*', { status: 200 });
}

// CryptAPI can also send GET requests
export async function GET(req: Request) {
    return POST(req);
}
