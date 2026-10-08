import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCaller } from '@/lib/api-auth';
import { DbService } from '@/lib/supabase-service';
import { findProfile } from '@/lib/lookup';
import { tgSend, escapeHtml } from '@/lib/telegram';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    const caller = await getCaller();
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { storyId } = await req.json();
    if (!storyId) return NextResponse.json({ error: 'Missing storyId' }, { status: 400 });

    const memberEmail = caller.email?.toLowerCase();
    if (!memberEmail) return NextResponse.json({ error: 'No email' }, { status: 401 });

    // Load story
    const { data: story } = await supabaseAdmin
        .from('stories')
        .select('id, tribute_price, covered_members, caption')
        .eq('id', storyId)
        .maybeSingle();

    if (!story) return NextResponse.json({ error: 'Story not found' }, { status: 404 });
    if (!story.tribute_price) return NextResponse.json({ error: 'No tribute on this story' }, { status: 400 });

    const covered: string[] = Array.isArray(story.covered_members) ? story.covered_members : [];
    if (covered.includes(memberEmail)) return NextResponse.json({ error: 'Already covered' }, { status: 409 });

    const cost = story.tribute_price;

    // Load member profile
    const profile = await findProfile(memberEmail, 'wallet, score, parameters, member_id, ID, name, avatar_url');
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    if ((profile.wallet || 0) < cost) {
        return NextResponse.json({ error: 'INSUFFICIENT_FUNDS', wallet: profile.wallet }, { status: 400 });
    }

    const newWallet = (profile.wallet || 0) - cost;
    const meritGain = Math.floor(cost / 2);
    const params = profile.parameters || {};
    const title = story.caption ? `Story cover — "${story.caption}"` : 'Story cover';

    const newParams = {
        ...params,
        wishlist_spent: (Number(params.wishlist_spent) || 0) + cost,
        last_tribute: { at: new Date().toISOString(), title, amount: cost },
        tributeHistory: [
            { amount: -cost, message: `SACRIFICE: ${title}`, date: new Date().toISOString(), type: 'expense' },
            ...(Array.isArray(params.tributeHistory) ? params.tributeHistory : []),
        ].slice(0, 50),
    };

    // Deduct coins + update params
    await supabaseAdmin.from('profiles').update({ wallet: newWallet, parameters: newParams }).eq('ID', profile.ID);

    // Award merit
    await DbService.awardPoints(profile.ID, meritGain);

    // Update tasks Tribute History
    const { data: taskRow } = await supabaseAdmin.from('tasks').select('"Tribute History"').eq('member_id', profile.ID).maybeSingle();
    const existingTH: any[] = (() => { try { const v = taskRow?.['Tribute History']; return Array.isArray(v) ? v : (typeof v === 'string' ? JSON.parse(v) : []); } catch { return []; } })();
    supabaseAdmin.from('tasks').update({ 'Tribute History': [{ amount: -cost, title, date: new Date().toISOString() }, ...existingTH].slice(0, 100) }).eq('member_id', profile.ID).then(() => {});

    // Mark member as having covered this story
    await supabaseAdmin.from('stories').update({ covered_members: [...covered, memberEmail] }).eq('id', storyId);

    const realEmail = profile.member_id;
    const senderName = profile.name || realEmail.split('@')[0];

    // System message in private chat
    await supabaseAdmin.from('chats').insert({
        member_id: realEmail,
        sender_email: 'system',
        content: `${title} (-${cost.toLocaleString()} coins)`,
        type: 'system',
        metadata: { isQueen: false },
    }).then(() => {});

    // Wishlist-type card in private chat
    await supabaseAdmin.from('chats').insert({
        member_id: realEmail,
        sender_email: realEmail,
        content: `Covered story for ${cost.toLocaleString()} coins`,
        type: 'wishlist',
        metadata: { title, price: cost, image: null },
    }).then(() => {});

    // Global chat card
    await supabaseAdmin.from('global_messages').insert({
        sender_email: realEmail,
        sender_name: senderName,
        sender_avatar: profile.avatar_url || null,
        message: `UPDATE_TRIBUTE_CARD::${JSON.stringify({ title, price: cost, image: null, senderName, senderAvatar: profile.avatar_url || null })}`,
    }).then(() => {});

    // Telegram notification to Queen
    tgSend(`💰 <b>${escapeHtml(senderName)}</b> covered a story\n${cost.toLocaleString()} coins`).catch(() => {});

    // Push notification to Queen
    const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '761d91da-b098-44a7-8d98-75c1cce54dd0';
    const ONESIGNAL_KEY = process.env.ONESIGNAL_REST_API_KEY;
    if (ONESIGNAL_KEY) {
        fetch('https://api.onesignal.com/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Basic ${ONESIGNAL_KEY}` },
            body: JSON.stringify({
                app_id: ONESIGNAL_APP_ID,
                target_channel: 'push',
                include_aliases: { external_id: ['ceo@qkarin.com'] },
                headings: { en: 'Story Covered' },
                contents: { en: `${senderName} covered a story — ${cost.toLocaleString()} coins` },
                url: 'https://throne.qkarin.com/dashboard',
            }),
        }).catch(() => {});
    }

    return NextResponse.json({ success: true, newWallet, meritGained: meritGain });
}
