import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const { orderId } = await req.json();
        if (!orderId) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

        const apiKey = (process.env.PASSIMPAY_API_KEY || '').trim();
        const platformId = (process.env.PASSIMPAY_PLATFORM_ID || '').trim();
        if (!apiKey || !platformId) return NextResponse.json({ error: 'Missing env vars' }, { status: 500 });

        // Check PassimPay order status (v2 API)
        const body = { platformId: Number(platformId), orderId };
        const jsonBody = JSON.stringify(body).replace(/\//g, '\\/');
        const signatureContract = `${platformId};${jsonBody};${apiKey}`;
        const signature = createHmac('sha256', apiKey).update(signatureContract).digest('hex');
        const res = await fetch('https://api.passimpay.io/v2/orderstatus', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-signature': signature },
            body: jsonBody,
        });
        const data = await res.json();
        const paid = data.result === 1 && data.status === 'paid';
        if (!paid) return NextResponse.json({ paid: false });

        // Payment confirmed on PassimPay side.
        // Do NOT activate keyholder here — the webhook handles that.
        // Just check if the webhook already processed it via payment_logs.
        const { data: logRow } = await supabaseAdmin
            .from('payment_logs')
            .select('status')
            .eq('order_id', orderId)
            .maybeSingle();

        return NextResponse.json({ paid: true, activated: logRow?.status === 'paid' });
    } catch (err: any) {
        console.error('[keyholder/passimpay-status] error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
