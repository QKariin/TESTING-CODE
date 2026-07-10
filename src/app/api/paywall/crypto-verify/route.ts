import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const { paymentId, memberId } = await req.json();
        if (!paymentId) return NextResponse.json({ error: 'Missing paymentId' }, { status: 400 });

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Check order status
        const { data: order } = await supabaseAdmin
            .from('crypto_orders')
            .select('*')
            .eq('id', paymentId)
            .maybeSingle();

        if (!order) return NextResponse.json({ paid: false });
        if (order.status !== 'completed') return NextResponse.json({ paid: false });

        // Payment confirmed — unlock paywall
        const email = (memberId || order.user_email || '').toLowerCase();

        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('ID, parameters')
            .ilike('member_id', email)
            .maybeSingle();

        if (profile) {
            const params = profile.parameters || {};
            const purchaseHistory: any[] = params.purchaseHistory || [];
            purchaseHistory.unshift({
                type: 'PAYWALL_TRIBUTE_CRYPTO',
                memberId: email,
                amount: order.amount_cents / 100,
                timestamp: new Date().toISOString(),
                orderId: paymentId,
            });
            if (purchaseHistory.length > 100) purchaseHistory.splice(100);
            params.purchaseHistory = purchaseHistory;
            delete params.paywall;
            await supabaseAdmin.from('profiles').update({ paywall: false, parameters: params }).eq('ID', profile.ID);
        }

        return NextResponse.json({ paid: true });
    } catch (err: any) {
        console.error('[PAYWALL CRYPTO-VERIFY] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
