import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { findProfile } from '@/lib/lookup';

export const dynamic = 'force-dynamic';

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

function verifySignature(rawBody: string, signature: string): boolean {
    const secret = process.env.YOUPAY_WEBHOOK_SECRET;
    if (!secret) return false;
    // Try common HMAC patterns
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    return signature === expected || signature === `sha256=${expected}`;
}

export async function POST(req: Request) {
    try {
        const rawBody = await req.text();

        // Try common signature header names
        const signature = req.headers.get('x-signature')
            || req.headers.get('x-webhook-signature')
            || req.headers.get('x-youpay-signature')
            || req.headers.get('x-hub-signature-256')
            || '';

        // Log full payload + headers for debugging (remove after first successful webhook)
        const allHeaders: Record<string, string> = {};
        req.headers.forEach((v, k) => { allHeaders[k] = v; });
        console.log('[youpay webhook] headers:', JSON.stringify(allHeaders));
        console.log('[youpay webhook] body:', rawBody);

        // Verify signature if secret is configured
        const secret = process.env.YOUPAY_WEBHOOK_SECRET;
        if (secret && signature) {
            if (!verifySignature(rawBody, signature)) {
                console.warn('[youpay webhook] invalid signature');
                return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
            }
        }

        const payload = JSON.parse(rawBody);

        // Extract data — adapt field names based on actual payload
        const eventType = payload.event_type || payload.event || payload.type || payload.status || 'unknown';
        const orderId = payload.order_id || payload.id || payload.order?.id || '';
        const status = payload.status || payload.order?.status || payload.delivery_status || eventType;

        // Only process fulfilled/completed orders
        const isFulfilled = ['fulfilled', 'completed', 'paid', 'successful'].includes(String(status).toLowerCase());
        if (!isFulfilled) {
            console.log('[youpay webhook] non-fulfilled status:', status, 'orderId:', orderId);
            return NextResponse.json({ ok: true, skipped: status });
        }

        // Try to extract amount
        const rawAmount = payload.amount || payload.total || payload.order?.amount || payload.order?.total || payload.price || 0;
        const currency = payload.currency || payload.order?.currency || 'EUR';
        const amount = typeof rawAmount === 'number' ? rawAmount : parseFloat(String(rawAmount)) || 0;
        // If amount is in cents, convert
        const amountEur = amount > 1000 ? amount / 100 : amount;

        // Try to extract buyer/email from message, notes, or buyer fields
        const message = payload.message || payload.note || payload.notes || payload.order?.message || payload.order?.note || '';
        const buyerEmail = payload.buyer_email || payload.email || payload.customer_email
            || payload.order?.buyer_email || payload.order?.email || '';
        const buyerName = payload.buyer_name || payload.gifter_name || payload.gifter_username
            || payload.order?.buyer_name || payload.customer_name || '';

        // Try email from explicit field first, then from message text
        let email = buyerEmail ? buyerEmail.toLowerCase().trim() : '';
        if (!email && message) {
            const match = String(message).match(EMAIL_REGEX);
            if (match) email = match[0].toLowerCase();
        }

        const itemName = payload.item_name || payload.product_name || payload.order?.item_name
            || payload.title || payload.order?.title || '';

        console.log('[youpay webhook] FULFILLED — orderId:', orderId, 'amount:', amountEur, currency, 'email:', email, 'buyer:', buyerName, 'item:', itemName);

        // Log to payment_logs
        try {
            await supabaseAdmin.from('payment_logs').insert({
                member_id: email || buyerName || null,
                order_id: `youpay_${orderId || Date.now()}`,
                amount: amountEur,
                currency_id: 'youpay',
                payment_type: 'youpay',
                status: 'paid',
                paid_at: new Date().toISOString(),
            });
        } catch (logErr: any) {
            console.error('[youpay webhook] payment_logs insert error:', logErr.message);
        }

        // Try to find and update profile if email found
        let profile: any = null;
        if (email) {
            profile = await findProfile(email, 'ID, member_id, name, wallet, parameters');
        }

        if (profile) {
            const params = profile.parameters || {};
            const history: any[] = params.purchaseHistory || [];

            // Idempotency
            if (history.some((h: any) => h.sessionId === `youpay_${orderId}`)) {
                console.log('[youpay webhook] already processed:', orderId);
                return NextResponse.json({ ok: true });
            }

            history.unshift({
                type: 'YOUPAY',
                amount: amountEur,
                currency,
                timestamp: new Date().toISOString(),
                memberId: profile.member_id,
                name: profile.name || profile.member_id,
                sessionId: `youpay_${orderId}`,
                buyerName: buyerName || 'Anonymous',
                itemName,
            });
            if (history.length > 100) history.splice(100);

            await supabaseAdmin.from('profiles').update({
                parameters: { ...params, purchaseHistory: history },
            }).eq('ID', profile.ID);

            console.log('[youpay webhook] logged to profile:', profile.member_id);
        }

        // Send push notification to CEO
        try {
            const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://throne.qkarin.com';
            await fetch(`${baseUrl}/api/push`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    externalId: 'ceo@qkarin.com',
                    title: 'YouPay Payment Received',
                    message: `${buyerName || email || 'Someone'} paid €${amountEur.toFixed(2)} via YouPay${itemName ? ` — ${itemName}` : ''}`,
                }),
            });
        } catch {}

        return NextResponse.json({ ok: true });
    } catch (err: any) {
        console.error('[youpay webhook] error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
