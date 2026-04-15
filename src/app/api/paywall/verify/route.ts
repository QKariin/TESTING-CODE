import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createClient as createAdmin } from '@supabase/supabase-js';

async function unlockPaywall(memberId: string, logEntry: object) {
    const admin = createAdmin(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data: profile } = await admin
        .from('profiles')
        .select('ID, name, parameters')
        .ilike('member_id', memberId)
        .maybeSingle();

    if (profile) {
        const params = profile.parameters || {};
        const purchaseHistory: any[] = params.purchaseHistory || [];
        purchaseHistory.unshift(logEntry);
        if (purchaseHistory.length > 100) purchaseHistory.splice(100);
        params.purchaseHistory = purchaseHistory;
        delete params.paywall;
        await admin.from('profiles').update({ paywall: false, parameters: params }).eq('ID', profile.ID);
    }
}

// POST - called client-side after Payment Element confirms (PaymentIntent flow)
export async function POST(req: Request) {
    try {
        const { intentId, memberId } = await req.json();
        if (!intentId || !memberId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

        const intent = await stripe.paymentIntents.retrieve(intentId);
        if (intent.status !== 'succeeded') {
            return NextResponse.json({ error: 'Payment not completed' }, { status: 402 });
        }

        await unlockPaywall(memberId, {
            type: 'PAYWALL_TRIBUTE',
            memberId,
            amount: intent.amount / 100,
            reason: intent.metadata?.reason || '',
            timestamp: new Date().toISOString(),
            intentId,
        });

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('session_id');
    const memberId  = searchParams.get('member_id');
    const origin = req.headers.get('origin') || 'https://throne.qkarin.com';

    if (!sessionId || !memberId) {
        return NextResponse.redirect(`${origin}/profile`);
    }

    try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (session.payment_status !== 'paid') {
            return NextResponse.redirect(`${origin}/profile?paywall=unpaid`);
        }

        await unlockPaywall(memberId, {
            type: 'PAYWALL_TRIBUTE',
            memberId,
            amount: session.amount_total ? session.amount_total / 100 : 0,
            reason: session.metadata?.reason || '',
            timestamp: new Date().toISOString(),
            sessionId,
        });

        return NextResponse.redirect(`${origin}/profile`);
    } catch {
        return NextResponse.redirect(`${origin}/profile`);
    }
}
