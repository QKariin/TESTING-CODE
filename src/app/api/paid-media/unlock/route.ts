import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const ADMIN_EMAIL = 'ceo@qkarin.com';
const ONESIGNAL_APP_ID = '761d91da-b098-44a7-8d98-75c1cce54dd0';
const ONESIGNAL_KEY = process.env.ONESIGNAL_REST_API_KEY || '';

function sendPush(targetEmail: string, title: string, body: string, url: string) {
    if (!ONESIGNAL_KEY || !targetEmail) return;
    fetch('https://api.onesignal.com/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${ONESIGNAL_KEY}` },
        body: JSON.stringify({
            app_id: ONESIGNAL_APP_ID,
            target_channel: 'push',
            include_aliases: { external_id: [targetEmail] },
            headings: { en: title },
            contents: { en: body },
            url,
        }),
    }).catch(() => {});
}

export async function POST(req: Request) {
    try {
        const { paidMediaId, email } = await req.json();

        if (!paidMediaId || !email) {
            return NextResponse.json({ error: 'Missing paidMediaId or email' }, { status: 400 });
        }

        // 1. Fetch the paid media record
        const { data: pm, error: pmErr } = await supabaseAdmin
            .from('paid_media')
            .select('*')
            .eq('id', paidMediaId)
            .single();

        if (pmErr || !pm) {
            return NextResponse.json({ error: 'Paid media not found' }, { status: 404 });
        }

        // 2. Already unlocked? Return success (idempotent)
        if (pm.is_unlocked) {
            return NextResponse.json({ success: true, alreadyUnlocked: true, mediaUrl: pm.media_url });
        }

        // 3. Fetch member's profile
        const { data: profile, error: profErr } = await supabaseAdmin
            .from('profiles')
            .select('ID, wallet, name, member_id')
            .ilike('member_id', email)
            .single();

        if (profErr || !profile) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
        }

        // 4. Check wallet balance
        const currentWallet = Number(profile.wallet || 0);
        if (currentWallet < pm.price) {
            return NextResponse.json({
                error: 'INSUFFICIENT_FUNDS',
                required: pm.price,
                current: currentWallet,
            }, { status: 402 });
        }

        // 5. Deduct wallet
        const newWallet = currentWallet - pm.price;
        const { error: walletErr } = await supabaseAdmin
            .from('profiles')
            .update({ wallet: newWallet })
            .eq('ID', profile.ID);

        if (walletErr) {
            return NextResponse.json({ error: 'Failed to deduct wallet' }, { status: 500 });
        }

        // 6. Mark as unlocked
        const { error: unlockErr } = await supabaseAdmin
            .from('paid_media')
            .update({ is_unlocked: true, unlocked_at: new Date().toISOString() })
            .eq('id', paidMediaId);

        if (unlockErr) {
            // Rollback wallet
            await supabaseAdmin
                .from('profiles')
                .update({ wallet: currentWallet })
                .eq('ID', profile.ID);
            return NextResponse.json({ error: 'Failed to unlock media' }, { status: 500 });
        }

        // 7. Insert system message about purchase (ignore errors)
        try {
            await supabaseAdmin.from('chats').insert({
                member_id: pm.member_id,
                sender_email: 'system',
                content: `${profile.name || 'Subject'} unlocked paid media — ${pm.price} Capital`,
                type: 'system',
                metadata: { isSystem: true },
            });
        } catch (_) {}

        // 8. Push notification to dashboard
        sendPush(
            ADMIN_EMAIL,
            'Media Unlocked',
            `${profile.name || email.split('@')[0]} unlocked media — +${pm.price} Capital`,
            'https://throne.qkarin.com/dashboard'
        );

        return NextResponse.json({
            success: true,
            newWallet,
            mediaUrl: pm.media_url,
            mediaType: pm.media_type,
        });
    } catch (err: any) {
        console.error('[paid-media/unlock] error:', err);
        return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
    }
}
