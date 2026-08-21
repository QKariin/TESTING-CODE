import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { findProfile } from '@/lib/lookup';
import { discordNewMember } from '@/lib/discord';

export const dynamic = 'force-dynamic';

// Coin packages (mirror of coins/passimpay route)
const COIN_PACKAGES: Record<number, number> = {
    2000: 20, 5500: 50, 12000: 100, 30000: 250, 70000: 500, 150000: 1000,
};


export async function POST(req: Request) {
    try {
        const bodyText = await req.text();
        const signature = req.headers.get('x-signature') || '';
        const apiKey = process.env.PASSIMPAY_API_KEY!;

        // Verify webhook signature
        const platformId = process.env.PASSIMPAY_PLATFORM_ID!;
        const payload = JSON.parse(bodyText);
        const sortedBodyStr = JSON.stringify(Object.fromEntries(Object.keys(payload).sort().map((k: string) => [k, payload[k]])));
        const expected = createHmac('sha256', apiKey).update(`${platformId};${sortedBodyStr};${apiKey}`).digest('hex');
        if (signature && signature !== expected) {
            console.warn('[passimpay webhook] invalid sig, got:', signature, 'expected:', expected);
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }

        console.log('[passimpay webhook]', JSON.stringify(payload));

        const orderId = payload.order_id || payload.orderId;
        if (!orderId) {
            console.log('[passimpay webhook] no orderId found in payload, skipping');
            return NextResponse.json({ ok: true });
        }

        // ── Step 1: Try to find profile by any pending payment field ──
        const { data: allProfiles } = await supabaseAdmin
            .from('profiles')
            .select('ID, member_id, name, wallet, parameters')
            .or('parameters->pendingCryptoPay.is.not.null,parameters->pendingCoinsPay.is.not.null,parameters->pendingTributePay.is.not.null,parameters->pendingKeyholderPay.is.not.null');

        let profile = (allProfiles || []).find((p: any) => {
            const params = p.parameters || {};
            return params.pendingCryptoPay?.orderId === orderId
                || params.pendingCoinsPay?.orderId === orderId
                || params.pendingTributePay?.orderId === orderId
                || params.pendingKeyholderPay?.orderId === orderId;
        });

        // Determine payment type from profile pending fields
        let paymentType: string | null = null;
        let pendingMeta: any = null;
        if (profile) {
            const params = profile.parameters || {};
            if (params.pendingCryptoPay?.orderId === orderId) { paymentType = 'paywall'; pendingMeta = params.pendingCryptoPay; }
            else if (params.pendingCoinsPay?.orderId === orderId) { paymentType = 'coins'; pendingMeta = params.pendingCoinsPay; }
            else if (params.pendingTributePay?.orderId === orderId) { paymentType = 'tribute'; pendingMeta = params.pendingTributePay; }
            else if (params.pendingKeyholderPay?.orderId === orderId) { paymentType = 'keyholder'; pendingMeta = params.pendingKeyholderPay; }
        }

        // ── Step 2: Fallback to payment_logs if no profile match ──
        if (!profile) {
            console.log('[passimpay webhook] no profile match for orderId, checking payment_logs:', orderId);
            const { data: logRow } = await supabaseAdmin
                .from('payment_logs')
                .select('*')
                .eq('order_id', orderId)
                .maybeSingle();

            if (logRow) {
                paymentType = logRow.payment_type;
                // For coins: reverse-lookup coin count from EUR amount
                let coins = 0;
                if (logRow.payment_type === 'coins' && logRow.amount) {
                    const entry = Object.entries(COIN_PACKAGES).find(([, eur]) => eur === Number(logRow.amount));
                    if (entry) coins = Number(entry[0]);
                }
                pendingMeta = { orderId, tierId: logRow.tier_id, amount: logRow.amount, coins };
                console.log('[passimpay webhook] found in payment_logs:', logRow.member_id, paymentType, coins ? `coins:${coins}` : '');

                // Try to find the profile by member_id from payment_logs
                if (logRow.member_id) {
                    profile = await findProfile(logRow.member_id, 'ID, member_id, name, wallet, parameters');
                }

                // If STILL no profile (truly new user), try to find auth user and create profile
                if (!profile && logRow.member_id) {
                    console.log('[passimpay webhook] no profile for member_id, attempting to create:', logRow.member_id);
                    try {
                        // Look up auth user — by user_id if stored, otherwise by email
                        let authUser: any = null;
                        if (logRow.user_id) {
                            const { data } = await supabaseAdmin.auth.admin.getUserById(logRow.user_id);
                            authUser = data?.user;
                        }
                        if (!authUser) {
                            const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
                            authUser = users.find((u: any) =>
                                (u.email || '').toLowerCase() === logRow.member_id.toLowerCase()
                            );
                        }

                        if (authUser) {
                            const rawName = authUser.user_metadata?.full_name ||
                                authUser.user_metadata?.user_name ||
                                (authUser.email ? authUser.email.split('@')[0] : 'Subject');
                            const displayName = rawName.split(' ')[0];

                            // Create profile (entrance coins added later in tribute case)
                            await supabaseAdmin.from('profiles').insert({
                                ID: authUser.id,
                                member_id: logRow.member_id,
                                name: displayName,
                                hierarchy: 'Hall Boy',
                                score: 0,
                                wallet: 0,
                                parameters: {},
                            });
                            await supabaseAdmin.from('tasks').insert({
                                ID: authUser.id,
                                member_id: logRow.member_id,
                                Name: displayName,
                                Status: 'idle',
                                Taskdom_History: '[]',
                                taskdom_active_task: null,
                                taskdom_pending_state: null,
                            });

                            profile = {
                                ID: authUser.id,
                                member_id: logRow.member_id,
                                name: displayName,
                                wallet: 0,
                                parameters: {},
                            };
                            console.log('[passimpay webhook] created new profile for:', logRow.member_id);
                        } else {
                            // Try with user_id if stored in payment_logs
                            console.warn('[passimpay webhook] no auth user found for:', logRow.member_id);
                        }
                    } catch (createErr: any) {
                        console.error('[passimpay webhook] profile creation error:', createErr.message);
                    }
                }
            }
        }

        if (!profile) {
            console.warn('[passimpay webhook] no profile found for orderId:', orderId, '— payment may need manual processing');
            return NextResponse.json({ ok: true, warning: 'no_profile_found' });
        }

        const memberId = profile.member_id;
        const params = profile.parameters || {};

        // ── Step 3: Process based on payment type ──
        let pushTitle = '';
        let pushMessage = '';
        switch (paymentType) {
            case 'paywall': {
                const updatedParams = { ...params };
                delete updatedParams.paywall;
                updatedParams.pendingCryptoPay = null;
                updatedParams.purchaseHistory = [
                    ...(params.purchaseHistory || []),
                    {
                        type: 'PAYWALL_TRIBUTE_CRYPTO',
                        amount: params.paywall?.amount || pendingMeta?.amount || 0,
                        timestamp: new Date().toISOString(),
                        memberId,
                        name: profile.name || memberId,
                        sessionId: orderId,
                    },
                ];
                await supabaseAdmin.from('profiles').update({
                    paywall: false,
                    parameters: updatedParams,
                }).eq('ID', profile.ID);
                console.log('[passimpay webhook] paywall cleared for:', memberId);
                pushTitle = 'Paywall Payment (Crypto)';
                pushMessage = `${profile.name || memberId} paid paywall — ${params.paywall?.amount || pendingMeta?.amount || '?'}`;
                break;
            }

            case 'coins': {
                const coins = pendingMeta?.coins || 0;
                if (coins <= 0) {
                    console.warn('[passimpay webhook] coins payment but coins=0, skipping credit for:', memberId);
                    break;
                }

                // Idempotency check
                const processed: string[] = params.processedCryptoOrders || [];
                if (processed.includes(orderId)) {
                    console.log('[passimpay webhook] coins already processed for orderId:', orderId);
                    break;
                }
                processed.push(orderId);

                const newWallet = (profile.wallet || 0) + coins;
                const purchaseEntry = {
                    coins, memberId, orderId, method: 'passimpay',
                    timestamp: new Date().toISOString(),
                };
                const history: any[] = params.purchaseHistory || [];
                history.unshift(purchaseEntry);
                if (history.length > 100) history.splice(100);

                await supabaseAdmin.from('profiles').update({
                    wallet: newWallet,
                    parameters: {
                        ...params,
                        processedCryptoOrders: processed,
                        purchaseHistory: history,
                        pendingCoinsPay: null,
                        latestPurchaseNotification: purchaseEntry,
                    },
                }).eq('ID', profile.ID);
                console.log('[passimpay webhook] credited', coins, 'coins to:', memberId, 'new wallet:', newWallet);
                pushTitle = 'Coin Purchase (Crypto)';
                pushMessage = `${profile.name || memberId} bought ${coins} coins via PassimPay`;
                break;
            }

            case 'keyholder': {
                const tierId = pendingMeta?.tierId || 'weekly';

                await supabaseAdmin.from('profiles').update({
                    parameters: {
                        ...params,
                        keyholder_tier: tierId,
                        keyholder_order: orderId,
                        pendingKeyholderPay: null,
                    },
                }).eq('ID', profile.ID);
                console.log('[passimpay webhook] keyholder paid for:', memberId, 'tier:', tierId);
                pushTitle = 'New Keyholder Sub (Crypto)';
                pushMessage = `${profile.name || memberId} surrendered their key — ${tierId} paid with PassimPay`;
                break;
            }

            case 'tribute': {
                const amount = pendingMeta?.amount || 0;
                const tierId = pendingMeta?.tierId || 'weekly';
                const displayName = profile.name || memberId.split('@')[0];

                // Give entrance coins (same as Verotel entrance tribute)
                const entranceCoins = 4999;
                const newWallet = (profile.wallet || 0) + entranceCoins;

                await supabaseAdmin.from('profiles').update({
                    wallet: newWallet,
                    parameters: {
                        ...params,
                        devotion: params.devotion || 100,
                        promo72h: true,
                        welcome_pending: true,
                        pendingTributePay: null,
                        purchaseHistory: [
                            ...(params.purchaseHistory || []),
                            {
                                type: 'TRIBUTE_CRYPTO',
                                amount,
                                tierId,
                                coins: entranceCoins,
                                timestamp: new Date().toISOString(),
                                memberId,
                                name: displayName,
                                sessionId: orderId,
                            },
                        ],
                    },
                }).eq('ID', profile.ID);

                console.log('[passimpay webhook] tribute completed for:', memberId, 'amount:', amount, 'coins:', entranceCoins);
                discordNewMember(displayName).catch(() => {});
                pushTitle = 'New Tribute Received';
                pushMessage = `${displayName} just entered the court as Hall Boy — ${entranceCoins} coins deposited.`;
                break;
            }

            default: {
                // Unknown payment type — still clear any pending fields
                console.warn('[passimpay webhook] unknown payment type:', paymentType, 'for orderId:', orderId);
                await supabaseAdmin.from('profiles').update({
                    parameters: {
                        ...params,
                        pendingCryptoPay: null,
                        pendingCoinsPay: null,
                        pendingTributePay: null,
                        pendingKeyholderPay: null,
                        purchaseHistory: [
                            ...(params.purchaseHistory || []),
                            {
                                type: 'UNKNOWN_CRYPTO',
                                timestamp: new Date().toISOString(),
                                memberId,
                                sessionId: orderId,
                            },
                        ],
                    },
                }).eq('ID', profile.ID);
            }
        }

        // ── Step 4: Send push notification ──
        if (pushTitle) {
            try {
                const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://throne.qkarin.com';
                await fetch(`${baseUrl}/api/push`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        externalId: 'ceo@qkarin.com',
                        title: pushTitle,
                        message: pushMessage,
                    }),
                });
            } catch {}
        }

        // Update payment_logs status if the table has that column
        try {
            await supabaseAdmin
                .from('payment_logs')
                .update({ status: 'paid', paid_at: new Date().toISOString() })
                .eq('order_id', orderId);
        } catch {}

        return NextResponse.json({ ok: true });
    } catch (err: any) {
        console.error('[passimpay webhook] error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
