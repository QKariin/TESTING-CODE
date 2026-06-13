import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import crypto from 'crypto';

const COIN_PACKAGES: Record<number, { amountCents: number; label: string }> = {
    2000:   { amountCents:   2000, label: '2,000 Royal Silver'   },
    1000:   { amountCents:   1000, label: '1,000 Royal Silver'   },
    5500:   { amountCents:   5000, label: '5,500 Royal Silver'   },
    12000:  { amountCents:  10000, label: '12,000 Royal Silver'  },
    30000:  { amountCents:  25000, label: '30,000 Royal Silver'  },
    70000:  { amountCents:  50000, label: '70,000 Royal Silver'  },
    150000: { amountCents: 100000, label: '150,000 Royal Silver' },
};

const CRYPTAPI_BASE = 'https://api.cryptapi.io';
const TICKER = 'trc20/usdt';

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { coins } = await req.json();
        const pkg = COIN_PACKAGES[coins];
        if (!pkg) return NextResponse.json({ error: 'Invalid coin package' }, { status: 400 });

        const walletAddress = process.env.CRYPTO_WALLET_ADDRESS;
        if (!walletAddress) {
            return NextResponse.json({ error: 'Crypto payments not configured' }, { status: 500 });
        }

        const identifier = user.email
            || (user.user_metadata?.provider_id ? `twitter_${user.user_metadata.provider_id}` : user.id);

        const orderId = crypto.randomUUID();
        const amountEur = pkg.amountCents / 100;

        // Convert EUR to USDT amount
        const convertRes = await fetch(
            `${CRYPTAPI_BASE}/${TICKER}/convert/?value=${amountEur}&from=eur`
        );
        const convertData = await convertRes.json();
        if (convertData.status !== 'success') {
            console.error('[CRYPTAPI] Convert error:', convertData);
            return NextResponse.json({ error: 'Failed to get crypto rate' }, { status: 500 });
        }
        const amountCrypto = convertData.value_coin;

        // Build callback URL with order metadata
        const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://throne.qkarin.com';
        const callbackParams = new URLSearchParams({
            order_id: orderId,
            coins: String(coins),
            user_id: user.id,
            user_email: identifier,
        });
        const callbackUrl = `${origin}/api/crypto/webhook?${callbackParams.toString()}`;

        // Create payment address via CryptAPI
        const createParams = new URLSearchParams({
            callback: callbackUrl,
            address: walletAddress,
            pending: '1',
            post: '1',
            convert: '1',
        });
        const createRes = await fetch(
            `${CRYPTAPI_BASE}/${TICKER}/create/?${createParams.toString()}`
        );
        const createData = await createRes.json();
        if (createData.status !== 'success') {
            console.error('[CRYPTAPI] Create error:', createData);
            return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 });
        }

        const addressIn = createData.address_in;

        // Generate QR code URL
        const qrParams = new URLSearchParams({
            address: addressIn,
            value: String(amountCrypto),
            size: '300',
        });
        const qrUrl = `${CRYPTAPI_BASE}/${TICKER}/qrcode/?${qrParams.toString()}`;

        // Store order
        await supabaseAdmin.from('crypto_orders').insert({
            id: orderId,
            user_id: user.id,
            user_email: identifier,
            coins: coins,
            amount_cents: pkg.amountCents,
            currency: 'EUR',
            status: 'pending',
            dv_wallet_id: addressIn,
            pay_url: qrUrl,
        });

        return NextResponse.json({
            success: true,
            order_id: orderId,
            address: addressIn,
            amount: amountCrypto,
            amount_eur: amountEur,
            currency: 'USDT (TRC20)',
            qr_url: qrUrl,
        });
    } catch (error: any) {
        console.error('[CRYPTAPI] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
