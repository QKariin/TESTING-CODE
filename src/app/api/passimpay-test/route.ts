import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';

export const dynamic = 'force-dynamic';

function ppRequestV2(endpoint: string, body: Record<string, any>, apiKey: string, platformId: string) {
    const jsonBody = JSON.stringify(body).replace(/\//g, '\\/');
    const signatureContract = `${platformId};${jsonBody};${apiKey}`;
    const signature = createHmac('sha256', apiKey).update(signatureContract).digest('hex');
    return fetch(`https://api.passimpay.io${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-signature': signature },
        body: jsonBody,
    });
}

export async function GET(req: Request) {
    const apiKey = (process.env.PASSIMPAY_API_KEY || '').trim();
    const platformId = (process.env.PASSIMPAY_PLATFORM_ID || '').trim();

    if (!apiKey || !platformId) {
        return NextResponse.json({ error: 'Missing env vars' });
    }

    const orderId = `test${Date.now()}`;

    // Step 1: Create order via v2 API
    const orderRes = await ppRequestV2('/v2/createorder', {
        platformId: Number(platformId),
        orderId,
        amount: '10.00',
    }, apiKey, platformId);
    const orderData = await orderRes.json();

    if (orderData.result !== 1) {
        return NextResponse.json({ step: 'v2/createorder', error: orderData });
    }

    // Step 2: Get wallet address for USDT TRC20 (paymentId=70) via v2 API
    const walletRes = await ppRequestV2('/v2/address', {
        platformId: Number(platformId),
        paymentId: 70,
        orderId,
    }, apiKey, platformId);
    const walletData = await walletRes.json();

    return NextResponse.json({
        step1_createorder: orderData,
        step2_address: walletData,
        order_id: orderId,
    });
}
