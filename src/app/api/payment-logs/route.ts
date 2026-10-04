import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCaller, isCEO } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
    const caller = await getCaller();
    if (!caller || !isCEO(caller.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    try {
        const { data, error } = await supabaseAdmin
            .from('payment_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(200);
        if (error) throw error;

        const logs = data || [];

        // Enrich with profile names for members who have an account
        const emails = [...new Set(logs.map((l: any) => l.member_id).filter(Boolean))] as string[];
        let nameMap: Record<string, string> = {};
        if (emails.length > 0) {
            const { data: profiles } = await supabaseAdmin
                .from('profiles')
                .select('member_id, name')
                .in('member_id', emails);
            if (profiles) {
                for (const p of profiles) {
                    if (p.member_id && p.name) nameMap[p.member_id.toLowerCase()] = p.name;
                }
            }
        }

        const enriched = logs.map((l: any) => ({
            ...l,
            member_name: nameMap[(l.member_id || '').toLowerCase()] || null,
        }));

        return NextResponse.json({ logs: enriched });
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
