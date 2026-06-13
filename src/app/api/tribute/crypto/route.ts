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

        const { ticker: requestedTicker } = await req.json();
        const ticker = requestedTicker && ALLOWED_TICKERS[requestedTicker] ? requestedTicker : 'trc20/usdt';
        const currencyLabel = ALLOWED_TICKERS[ticker];

        const walletEnvKey = WALLET_ENV_MAP[ticker] || 'CRYPTO_WALLET_ADDRESS';
        const walletAddress = process.env[walletEnvKey] || process.env.CRYPTO_WALLET_ADDRESS;
        if (!walletAddress) {
            return NextResponse.json({ error: 'Crypto payments not configured' }, { status: 500 });
        }

        const identifier = user.email
            || (user.user_metadata?.provider_id ? `twitter_${user.user_metadata.provider_id}` : user.id);

        const rawName = user.user_metadata?.full_name
            || user.user_metadata?.user_name
            || (user.email ? user.email.split('@')[0] : 'Subject');
        const displayName = rawName.split(' ')[0];

        const orderId = crypto.randomUUID();
        const amountEur = 55; // €55 entrance tribute

        // Convert EUR to crypto
        const convertRes = await fetch(
            `${CRYPTAPI_BASE}/${ticker}/convert/?value=${amountEur}&from=eur`
        );
        const convertData = await convertRes.json();
        if (convertData.status !== 'success') {
            console.error('[TRIBUTE CRYPTO] Convert error:', convertData);
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
            console.error('[TRIBUTE CRYPTO] Create error:', createData);
            return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 });
        }

        const addressIn = createData.address_in;

        // Store order with type entrance_tribute
        await supabaseAdmin.from('crypto_orders').insert({
            id: orderId,
            user_id: user.id,
            user_email: identifier,
            coins: 0,
            amount_cents: 5500,
            currency: 'EUR',
            status: 'pending',
            dv_wallet_id: addressIn,
            pay_url: `entrance_tribute:${displayName}`,
        });

        return NextResponse.json({
            success: true,
            order_id: orderId,
            address: addressIn,
            amount: amountCrypto,
            amount_eur: amountEur,
            currency: currencyLabel,
        });
    } catch (error: any) {
        console.error('[TRIBUTE CRYPTO] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
