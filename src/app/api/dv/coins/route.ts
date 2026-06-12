import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import crypto from 'crypto';

const COIN_PACKAGES: Record<number, { amountCents: number; label: string }> = {
    2000:   { amountCents:   2000, label: '2,000 Royal Silver'              },
    1000:   { amountCents:   1000, label: '1,000 Royal Silver'              },
    5500:   { amountCents:   5000, label: '5,500 Royal Silver'              },
    12000:  { amountCents:  10000, label: '12,000 Royal Silver'             },
    30000:  { amountCents:  25000, label: '30,000 Royal Silver'             },
    70000:  { amountCents:  50000, label: '70,000 Royal Silver'             },
    150000: { amountCents: 100000, label: '150,000 Royal Silver'            },
};

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { coins } = await req.json();
        const pkg = COIN_PACKAGES[coins];
        if (!pkg) return NextResponse.json({ error: 'Invalid coin package' }, { status: 400 });

        const dvHost = process.env.DV_NET_HOST;
        const dvApiKey = process.env.DV_NET_API_KEY;
        if (!dvHost || !dvApiKey) {
            return NextResponse.json({ error: 'Crypto payments not configured' }, { status: 500 });
        }

        const identifier = user.email
            || (user.user_metadata?.provider_id ? `twitter_${user.user_metadata.provider_id}` : user.id);

        const orderId = crypto.randomUUID();
        const amountEur = (pkg.amountCents / 100).toFixed(2);

        // Create DV.net payment wallet
        const dvRes = await fetch(`${dvHost}/api/v1/external/wallet`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Api-Key': dvApiKey,
            },
            body: JSON.stringify({
                store_external_id: orderId,
                amount: amountEur,
                currency: 'EUR',
                email: identifier,
                ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1',
            }),
        });

        if (!dvRes.ok) {
            const errText = await dvRes.text();
            console.error('[DV.NET] Create wallet error:', dvRes.status, errText);
            return NextResponse.json({ error: 'Failed to create crypto payment' }, { status: 500 });
        }

        const dvData = await dvRes.json();
        const payUrl = dvData.data?.pay_url || dvData.pay_url;

        if (!payUrl) {
            console.error('[DV.NET] No pay_url in response:', JSON.stringify(dvData));
            return NextResponse.json({ error: 'No payment URL returned' }, { status: 500 });
        }

        // Store order in crypto_orders table
        const { error: insertErr } = await supabaseAdmin.from('crypto_orders').insert({
            id: orderId,
            user_id: user.id,
            user_email: identifier,
            coins: coins,
            amount_cents: pkg.amountCents,
            currency: 'EUR',
            status: 'pending',
            dv_wallet_id: dvData.data?.id || dvData.id || null,
            pay_url: payUrl,
        });

        if (insertErr) {
            console.error('[DV.NET] Order insert error:', insertErr);
            return NextResponse.json({ error: 'Failed to save order' }, { status: 500 });
        }

        return NextResponse.json({ url: payUrl, orderId });
    } catch (error: any) {
        console.error('[DV.NET] Checkout error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
