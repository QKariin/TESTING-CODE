import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import crypto from 'crypto';

const CRYPTAPI_BASE = 'https://api.cryptapi.io';

const ALLOWED_TICKERS: Record<string, string> = {
    'trc20/usdt': 'USDT (TRC20)',
    'btc': 'BTC',
    'eth': 'ETH',
    'ltc': 'LTC',
};

const WALLET_ENV_MAP: Record<string, string> = {
    'trc20/usdt': 'CRYPTO_WALLET_ADDRESS',
    'btc': 'CRYPTO_WALLET_BTC',
    'eth': 'CRYPTO_WALLET_ETH',
    'ltc': 'CRYPTO_WALLET_LTC',
};

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { ticker: requestedTicker, memberId } = await req.json();
        const ticker = requestedTicker && ALLOWED_TICKERS[requestedTicker] ? requestedTicker : 'trc20/usdt';
        const currencyLabel = ALLOWED_TICKERS[ticker];

        const email = (memberId || user.email || '').toLowerCase();

        // Get paywall amount from profile
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('parameters')
            .ilike('member_id', email)
            .maybeSingle();

        const paywallAmount = profile?.parameters?.paywall?.amount;
        if (!paywallAmount) {
            return NextResponse.json({ error: 'No active paywall' }, { status: 400 });
        }

        const amountEur = Number(paywallAmount);

        const walletEnvKey = WALLET_ENV_MAP[ticker] || 'CRYPTO_WALLET_ADDRESS';
        const walletAddress = process.env[walletEnvKey] || process.env.CRYPTO_WALLET_ADDRESS;
        if (!walletAddress) {
            return NextResponse.json({ error: 'Crypto payments not configured' }, { status: 500 });
        }

        const identifier = user.email
            || (user.user_metadata?.provider_id ? `twitter_${user.user_metadata.provider_id}` : user.id);

        const orderId = crypto.randomUUID();

        // Convert EUR to crypto
        const convertRes = await fetch(
            `${CRYPTAPI_BASE}/${ticker}/convert/?value=${amountEur}&from=eur`
        );
        const convertData = await convertRes.json();
        if (convertData.status !== 'success') {
            return NextResponse.json({ error: 'Failed to get crypto rate' }, { status: 500 });
        }
        const amountCrypto = convertData.value_coin;

        // Build callback URL
        const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://throne.qkarin.com';
        const callbackParams = new URLSearchParams({
            order_id: orderId,
            coins: '0',
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
            `${CRYPTAPI_BASE}/${ticker}/create/?${createParams.toString()}`
        );
        const createData = await createRes.json();
        if (createData.status !== 'success') {
            return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 });
        }

        const addressIn = createData.address_in;

        // Store order with paywall type
        await supabaseAdmin.from('crypto_orders').insert({
            id: orderId,
            user_id: user.id,
            user_email: identifier,
            coins: 0,
            amount_cents: Math.round(amountEur * 100),
            currency: 'EUR',
            status: 'pending',
            dv_wallet_id: addressIn,
            pay_url: `paywall:${email}`,
        });

        return NextResponse.json({
            success: true,
            paymentId: orderId,
            address: addressIn,
            amount: amountCrypto,
            amount_eur: amountEur,
            currency: currencyLabel,
        });
    } catch (error: any) {
        console.error('[PAYWALL CRYPTO] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
