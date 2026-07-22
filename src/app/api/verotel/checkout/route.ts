import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const SHOP_ID = Number(process.env.VEROTEL_SHOP_ID || '136941');
const SIGNATURE_KEY = process.env.VEROTEL_SIGNATURE_KEY || '';
const VEROTEL_URL = 'https://secure.verotel.com/startorder';
const ORIGIN = process.env.NEXT_PUBLIC_SITE_URL || 'https://throne.qkarin.com';

function makeJWT(payload: object): string {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.createHmac('sha256', SIGNATURE_KEY).update(`${header}.${body}`).digest('base64url');
    return `${header}.${body}.${sig}`;
}

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { type } = await req.json();
        const identifier = user.email || `twitter_${user.user_metadata?.provider_id || user.id}`;
        const rawName = user.user_metadata?.full_name || user.user_metadata?.user_name || identifier.split('@')[0];
        const displayName = rawName.split(' ')[0];

        const orderId = crypto.randomUUID();

        // Store pending order so webhook can look it up
        await supabaseAdmin.from('crypto_orders').insert({
            id: orderId,
            user_id: user.id,
            user_email: identifier,
            coins: 0,
            amount_cents: 5500,
            currency: 'EUR',
            status: 'pending',
            pay_url: `verotel:${type}:${displayName}`,
        });

        const jwt = makeJWT({
            shopId: SHOP_ID,
            price: '55.00',
            currency: 'EUR',
            description: 'Access Fee — Full Platform Access',
            type: 'purchase',
            returnUrl: `${ORIGIN}/tribute/success?ref=${orderId}`,
            cancelUrl: `${ORIGIN}/tribute?status=cancelled`,
            postbackUrl: `${ORIGIN}/api/verotel/webhook`,
            ref: orderId,
            email: user.email || undefined,
        });

        return NextResponse.json({ url: `${VEROTEL_URL}?JWT=${jwt}` });
    } catch (error: any) {
        console.error('[VEROTEL] Checkout error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
