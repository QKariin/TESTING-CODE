import { NextResponse } from 'next/server';
import { createVerify } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { findProfile } from '@/lib/lookup';

export const dynamic = 'force-dynamic';

const THRONE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAPXbUfxh7XL4SYUVcfhmYMIbxvtR9E9LDd8gPJ1PwSD8=
-----END PUBLIC KEY-----`;

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

function verifySignature(rawBody: string, timestamp: string, signatureHex: string): boolean {
    try {
        if (!timestamp || isNaN(Number(timestamp))) return false;
        if (!signatureHex || Buffer.from(signatureHex, 'hex').length !== 64) return false;
        const message = `${timestamp}.${rawBody}`;
        const verify = createVerify('Ed25519');
        verify.update(message);
        return verify.verify(THRONE_PUBLIC_KEY, Buffer.from(signatureHex, 'hex'));
    } catch {
        return false;
    }
}

export async function POST(req: Request) {
    try {
        const rawBody = await req.text();
        const timestamp = req.headers.get('x-signature-timestamp') || '';
        const signatureHex = req.headers.get('x-signature-ed25519') || '';

        // Reject stale requests (>10 min)
        const ts = Number(timestamp);
        if (!ts || Math.abs(Date.now() / 1000 - ts) > 600) {
            console.warn('[throne webhook] stale or missing timestamp:', timestamp);
            return NextResponse.json({ error: 'Invalid timestamp' }, { status: 401 });
        }

        if (!verifySignature(rawBody, timestamp, signatureHex)) {
            console.warn('[throne webhook] invalid signature');
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }

        const payload = JSON.parse(rawBody);
        const { event_id, event_type, data } = payload;

        console.log('[throne webhook]', event_type, event_id);

        // Only handle gift/contribution events that can identify a buyer
        if (!['gift_purchased', 'contribution_purchased'].includes(event_type)) {
            return NextResponse.json({ ok: true });
        }

        const message: string = data?.message || '';
        const emailMatch = message.match(EMAIL_REGEX);
        if (!emailMatch) {
            console.warn('[throne webhook] no email in message for event:', event_id);
            return NextResponse.json({ ok: true });
        }

        const email = emailMatch[0].toLowerCase();

        // Fetch profile
        const profile = await findProfile(email, 'member_id, name, parameters');

        if (!profile) {
            console.warn('[throne webhook] no profile found for email:', email);
            return NextResponse.json({ ok: true });
        }

        const params = profile.parameters || {};

        // Idempotency: skip if already processed this event
        const history: any[] = params.purchaseHistory || [];
        if (history.some((h: any) => h.sessionId === event_id)) {
            console.log('[throne webhook] already processed event:', event_id);
            return NextResponse.json({ ok: true });
        }

        // Only unlock if paywall is actually active
        if (!params.paywall?.active) {
            console.log('[throne webhook] paywall not active for:', email);
            return NextResponse.json({ ok: true });
        }

        // Amount from payload (smallest unit × 100 → e.g. 6600 = €66.00)
        const rawAmount = data?.price ?? data?.amount ?? 0;
        const currency: string = data?.currency || 'EUR';
        const amountInUnits = Number(rawAmount);
        // Convert to EUR cents for logging (rough: assume EUR or USD ≈ EUR)
        const amountEur = amountInUnits / 100;

        await supabaseAdmin
            .from('profiles')
            .update({
                parameters: {
                    ...params,
                    paywall: { ...(params.paywall || {}), active: false },
                    purchaseHistory: [
                        ...history,
                        {
                            type: 'PAYWALL_TRIBUTE_THRONE',
                            amount: amountEur,
                            currency,
                            timestamp: new Date().toISOString(),
                            memberId: profile.member_id,
                            name: profile.name || profile.member_id,
                            sessionId: event_id,
                            throneEvent: event_type,
                            gifterUsername: data?.gifter_username || 'Anonymous',
                        },
                    ],
                },
            })
            .ilike('member_id', email); // email always lowercase string from regex match

        console.log('[throne webhook] paywall cleared for:', email, 'amount:', amountEur, currency);
        return NextResponse.json({ ok: true });

    } catch (err: any) {
        console.error('[throne webhook] error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
