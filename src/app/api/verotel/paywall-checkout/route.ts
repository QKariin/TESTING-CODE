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

        const { memberId } = await req.json();
        if (!memberId) return NextResponse.json({ error: 'Missing memberId' }, { status: 400 });

        // Read paywall amount from profile
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('parameters')
            .ilike('member_id', memberId)
            .maybeSingle();

        const amount = Number(profile?.parameters?.paywall?.amount) || 55;
        const reason = profile?.parameters?.paywall?.reason || 'Access Tribute';

        const orderId = crypto.randomUUID();

        await supabaseAdmin.from('crypto_orders').insert({
            id: orderId,
            user_id: user.id,
            user_email: memberId,
            coins: 0,
            amount_cents: Math.round(amount * 100),
            currency: 'EUR',
            status: 'pending',
            pay_url: `verotel:paywall_tribute:${memberId}`,
        });

        const jwt = makeJWT({
            shopId: SHOP_ID,
            price: amount.toFixed(2),
            currency: 'EUR',
            description: reason,
            type: 'purchase',
            returnUrl: `${ORIGIN}/profile`,
            cancelUrl: `${ORIGIN}/profile`,
            postbackUrl: `${ORIGIN}/api/verotel/webhook`,
            ref: orderId,
            email: user.email || undefined,
        });

        return NextResponse.json({ url: `${VEROTEL_URL}?JWT=${jwt}` });
    } catch (error: any) {
        console.error('[VEROTEL PAYWALL] Checkout error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
