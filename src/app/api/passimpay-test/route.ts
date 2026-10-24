import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const apiKey = (process.env.PASSIMPAY_API_KEY || '').trim();
    const platformId = (process.env.PASSIMPAY_PLATFORM_ID || '').trim();

    if (!apiKey || !platformId) {
        return NextResponse.json({ error: 'Missing PASSIMPAY_API_KEY or PASSIMPAY_PLATFORM_ID' });
    }

    const orderId = `test${Date.now()}`;
    const params: Record<string, string> = {
        platform_id: platformId,
        order_id: orderId,
        amount: '10.00',
    };

    const qs = new URLSearchParams(params).toString();
    const hash = createHmac('sha256', apiKey).update(qs).digest('hex');
    const body = new URLSearchParams({ ...params, hash }).toString();

    const res = await fetch('https://api.passimpay.io/createorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    });

    const data = await res.json();

    return NextResponse.json({
        passimpay_response: data,
        sent_params: params,
        sent_hash: hash,
        platform_id: platformId,
        api_key_length: apiKey.length,
        api_key_start: apiKey.slice(0, 4) + '...',
    });
}
