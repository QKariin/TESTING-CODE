import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const { orderId } = await req.json();
        if (!orderId) return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const apiKey = (process.env.PASSIMPAY_API_KEY || '').trim();
        const platformId = (process.env.PASSIMPAY_PLATFORM_ID || '').trim();
        if (!apiKey || !platformId) return NextResponse.json({ error: 'Missing env vars' }, { status: 500 });

        // Check PassimPay order status
        const params = { platform_id: platformId, order_id: orderId };
        const qs = new URLSearchParams(params).toString();
        const hash = createHmac('sha256', apiKey).update(qs).digest('hex');
        const res = await fetch('https://api.passimpay.io/orderstatus', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ ...params, hash }).toString(),
        });
        const data = await res.json();
        const paid = data.result === 1 && data.status === 'paid';
        if (!paid) return NextResponse.json({ paid: false });

        // Payment confirmed — create profile if it doesn't exist yet
        const identifier = user.email ||
            (user.user_metadata?.provider_id ? `twitter_${user.user_metadata.provider_id}` : user.id);

        const rawName = user.user_metadata?.full_name ||
            user.user_metadata?.user_name ||
            (user.email ? user.email.split('@')[0] : 'Subject');
        const displayName = rawName.split(' ')[0];

        const { data: existing } = await supabaseAdmin
            .from('profiles').select('ID').eq('ID', user.id).maybeSingle();

        if (!existing) {
            await supabaseAdmin.from('profiles').insert({
                ID: user.id,
                member_id: identifier,
                name: displayName,
                hierarchy: 'Hall Boy',
                score: 0,
                wallet: 5000,
                parameters: { devotion: 100 },
            });
            await supabaseAdmin.from('tasks').insert({
                ID: user.id,
                member_id: identifier,
                Name: displayName,
                Status: 'idle',
                Taskdom_History: '[]',
                taskdom_active_task: null,
                taskdom_pending_state: null,
            });
        }

        return NextResponse.json({ paid: true, profileCreated: !existing });
    } catch (err: any) {
        console.error('[tribute/passimpay-status] error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
