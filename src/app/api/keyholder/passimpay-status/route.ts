import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { discordNewMember } from '@/lib/discord';

export const dynamic = 'force-dynamic';

const TIERS: Record<string, { days: number }> = {
    weekly: { days: 7 }, monthly: { days: 30 }, quarterly: { days: 90 },
};

export async function POST(req: Request) {
    try {
        const { orderId, tierId } = await req.json();
        if (!orderId || !tierId) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

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

        // Payment confirmed — activate subscription
        const tier = TIERS[tierId] || { days: 7 };
        const identifier = user.email ||
            (user.user_metadata?.provider_id ? `twitter_${user.user_metadata.provider_id}` : user.id);
        const rawName = user.user_metadata?.full_name ||
            user.user_metadata?.user_name ||
            (user.email ? user.email.split('@')[0] : 'Subject');
        const displayName = rawName.split(' ')[0];
        const expiresAt = new Date(Date.now() + tier.days * 86400000).toISOString();

        const { data: existing } = await supabaseAdmin
            .from('profiles')
            .select('ID, parameters')
            .or(`ID.eq.${user.id}${identifier ? `,member_id.ilike.${identifier}` : ''}`)
            .maybeSingle();

        if (existing) {
            const p = existing.parameters || {};
            p.source = 'chastity';
            p.chastity_tier = tierId;
            p.chastity_days = tier.days;
            p.chastity_started = new Date().toISOString();
            p.chastity_expires = expiresAt;
            p.pp_keyholder_order = orderId;
            await supabaseAdmin.from('profiles').update({ parameters: p }).eq('ID', existing.ID);
        } else {
            await supabaseAdmin.from('profiles').insert({
                ID: user.id,
                member_id: identifier,
                name: displayName,
                hierarchy: 'Chastity Sub',
                score: 0,
                wallet: 0,
                parameters: {
                    source: 'chastity',
                    chastity_tier: tierId,
                    chastity_days: tier.days,
                    chastity_started: new Date().toISOString(),
                    chastity_expires: expiresAt,
                    pp_keyholder_order: orderId,
                },
            });
            await supabaseAdmin.from('tasks').insert({
                ID: user.id, member_id: identifier, Name: displayName,
                Status: 'idle', Taskdom_History: '[]',
            });
        }

        discordNewMember(`${displayName} (Keyholder ${tierId} via PassimPay crypto)`).catch(() => {});

        try {
            const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://throne.qkarin.com';
            await fetch(`${baseUrl}/api/push`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    externalId: 'ceo@qkarin.com',
                    title: 'New Keyholder Sub (Crypto)',
                    message: `${displayName} surrendered their key — ${tierId} paid with PassimPay`,
                }),
            });
        } catch {}

        return NextResponse.json({ paid: true, activated: true });
    } catch (err: any) {
        console.error('[keyholder/passimpay-status] error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
