import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { discordNewMember } from '@/lib/discord';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const SHOP_ID = Number(process.env.VEROTEL_SHOP_ID || '136941');
const SIGNATURE_KEY = process.env.VEROTEL_SIGNATURE_KEY || '';
const ORIGIN = process.env.NEXT_PUBLIC_SITE_URL || 'https://throne.qkarin.com';

function verifyJWT(token: string): any | null {
    try {
        const [header, body, sig] = token.split('.');
        const expected = crypto.createHmac('sha256', SIGNATURE_KEY).update(`${header}.${body}`).digest('base64url');
        if (expected !== sig) return null;
        return JSON.parse(Buffer.from(body, 'base64url').toString());
    } catch { return null; }
}

// Verotel sends GET postback to this URL
export async function GET(req: NextRequest) {
    try {
        const params = req.nextUrl.searchParams;
        const jwt = params.get('JWT') || params.get('jwt');
        const ref = params.get('ref') || params.get('transactionRef');
        const status = params.get('status') || params.get('transactionStatus');
        const transactionId = params.get('transactionId') || params.get('saleId');

        // Verify JWT signature if provided
        let payload: any = {};
        if (jwt) {
            payload = verifyJWT(jwt);
            if (!payload) {
                console.error('[VEROTEL WEBHOOK] Invalid JWT signature');
                return new NextResponse('Invalid signature', { status: 400 });
            }
        }

        const orderId = ref || payload.ref;
        const txStatus = status || payload.status || 'success';

        console.log(`[VEROTEL WEBHOOK] ref=${orderId} status=${txStatus} transactionId=${transactionId}`);

        if (txStatus !== 'success' && txStatus !== 'settled') {
            return new NextResponse('OK', { status: 200 });
        }

        if (!orderId) {
            console.error('[VEROTEL WEBHOOK] No ref/orderId');
            return new NextResponse('Missing ref', { status: 400 });
        }

        // Look up pending order
        const { data: order } = await supabaseAdmin
            .from('crypto_orders')
            .select('*')
            .eq('id', orderId)
            .maybeSingle();

        if (!order) {
            console.error(`[VEROTEL WEBHOOK] Order not found: ${orderId}`);
            return new NextResponse('Order not found', { status: 404 });
        }

        if (order.status === 'completed') {
            console.log(`[VEROTEL WEBHOOK] Already processed: ${orderId}`);
            return new NextResponse('OK', { status: 200 });
        }

        // Mark order complete
        await supabaseAdmin.from('crypto_orders').update({
            status: 'completed',
            dv_wallet_id: transactionId || null,
        }).eq('id', orderId);

        const userId = order.user_id;
        const userEmail = order.user_email;
        const payUrl: string = order.pay_url || '';
        const type = payUrl.split(':')[1] || 'entrance_tribute';
        const displayName = payUrl.split(':')[2] || userEmail.split('@')[0];

        // ── ENTRANCE TRIBUTE ──
        if (type === 'entrance_tribute') {
            // Check if profile already exists (idempotent)
            const { data: existing } = await supabaseAdmin
                .from('profiles')
                .select('ID')
                .or(`ID.eq.${userId},member_id.ilike.${userEmail}`)
                .maybeSingle();

            if (!existing) {
                await supabaseAdmin.from('profiles').insert({
                    ID: userId,
                    member_id: userEmail,
                    name: displayName,
                    hierarchy: 'Hall Boy',
                    score: 0,
                    wallet: 4999,
                    parameters: { devotion: 100, promo72h: true, welcome_pending: true },
                });

                await supabaseAdmin.from('tasks').insert({
                    ID: userId,
                    member_id: userEmail,
                    Name: displayName,
                    Status: 'idle',
                    Taskdom_History: '[]',
                    taskdom_active_task: null,
                    taskdom_pending_state: null,
                });

                console.log(`[VEROTEL WEBHOOK] Profile created for ${userEmail}`);
                discordNewMember(displayName).catch(() => {});

                try {
                    await fetch(`${ORIGIN}/api/push`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'x-push-secret': process.env.PUSH_INTERNAL_SECRET || '' },
                        body: JSON.stringify({
                            externalId: 'ceo@qkarin.com',
                            title: 'New Tribute Received',
                            message: `${displayName} just entered the court as Hall Boy — 4,999 coins deposited.`,
                        }),
                    });
                } catch (_) {}
            }
        }

        return new NextResponse('OK', { status: 200 });
    } catch (err: any) {
        console.error('[VEROTEL WEBHOOK] Error:', err);
        return new NextResponse('Error', { status: 500 });
    }
}

// Verotel may also POST
export async function POST(req: NextRequest) {
    return GET(req);
}
