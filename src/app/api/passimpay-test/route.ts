import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';

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

export async function GET(req: Request) {
    const apiKey = (process.env.PASSIMPAY_API_KEY || '').trim();
    const platformId = (process.env.PASSIMPAY_PLATFORM_ID || '').trim();

    if (!apiKey || !platformId) {
        return NextResponse.json({ error: 'Missing env vars' });
    }

    const orderId = `test${Date.now()}`;

    // Step 1: Create order
    const orderRes = await ppRequest('/createorder', {
        platform_id: platformId,
        order_id: orderId,
        amount: '10.00',
    }, apiKey);
    const orderData = await orderRes.json();

    if (orderData.result !== 1) {
        return NextResponse.json({ step: 'createorder', error: orderData });
    }

    // Step 2: Get wallet for USDT TRC20 (payment_id=70)
    const walletRes = await ppRequest('/getpaymentwallet', {
        payment_id: '70',
        platform_id: platformId,
        order_id: orderId,
    }, apiKey);
    const walletData = await walletRes.json();

    return NextResponse.json({
        step1_createorder: orderData,
        step2_getpaymentwallet: walletData,
        order_id: orderId,
    });
}
