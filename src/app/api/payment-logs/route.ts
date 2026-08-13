import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const { data, error } = await supabaseAdmin
            .from('payment_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(200);
        if (error) throw error;
        return NextResponse.json({ logs: data || [] });
    } catch (err: any) {
        return NextResponse.json({ logs: [], error: err.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { member_id, amount, payment_type, currency_id, tier_id, order_id } = body;
        if (!member_id && !payment_type) return NextResponse.json({ error: 'Missing params' }, { status: 400 });
        await supabaseAdmin.from('payment_logs').insert({
            member_id: member_id || null,
            order_id: order_id || `throne_${Date.now()}`,
            amount: Number(amount) || 0,
            payment_type: payment_type || 'throne',
            currency_id: currency_id || 'throne',
            tier_id: tier_id || null,
        });
        return NextResponse.json({ ok: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
