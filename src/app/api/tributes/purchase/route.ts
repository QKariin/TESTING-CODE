import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase';
import { DbService } from '@/lib/supabase-service';
import { discordWishlistPurchase } from '@/lib/discord';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { memberEmail, tributeId, tributeTitle, tributeCost } = body;

        if (!memberEmail || !tributeTitle || tributeCost === undefined) {
            return NextResponse.json({ success: false, error: 'Missing required parameters' }, { status: 400 });
        }

        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memberEmail);
        const profileQuery = isUUID
            ? supabase.from('profiles').select('wallet, score, parameters, member_id, ID, name, avatar_url').eq('ID', memberEmail).single()
            : supabase.from('profiles').select('wallet, score, parameters, member_id, ID, name, avatar_url').ilike('member_id', memberEmail).single();
        const { data: profile, error: profileErr } = await profileQuery;

        if (profileErr || !profile) return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 });

        const currentWallet = profile.wallet || 0;
        const currentScore = profile.score || 0;
        if (currentWallet < tributeCost) return NextResponse.json({ success: false, error: 'INSUFFICIENT_FUNDS', wallet: currentWallet }, { status: 400 });

        const newWallet = currentWallet - tributeCost;
        const meritGain = Math.floor(tributeCost / 2);
        const newScore = currentScore + meritGain;
        const params = profile.parameters || {};
        const newParams = {
            ...params,
            wishlist_spent: (Number(params.wishlist_spent) || 0) + tributeCost,
            last_tribute: { at: new Date().toISOString(), title: tributeTitle, amount: tributeCost },
            tributeHistory: [{ amount: -tributeCost, message: `SACRIFICE: ${tributeTitle}`, date: new Date().toISOString(), type: 'expense' }, ...(Array.isArray((profile.parameters||{}).tributeHistory) ? (profile.parameters||{}).tributeHistory : [])].slice(0,50),
        };

        const profileUuid = profile.ID;
        const realEmail = profile?.member_id || memberEmail;

        const { error: updateErr } = await supabase.from('profiles').update({ wallet: newWallet, parameters: newParams }).eq('ID', profileUuid);

        if (updateErr) return NextResponse.json({ success: false, error: 'Failed to update balance' }, { status: 500 });

        // Update tasks['Tribute History'] - use UUID (tasks.member_id is UUID)
        const { data: taskRow } = await supabase.from('tasks').select('"Tribute History"').eq('member_id', profileUuid).maybeSingle();
        const existingTH: any[] = (() => { try { const v = taskRow?.['Tribute History']; return Array.isArray(v) ? v : (typeof v === 'string' ? JSON.parse(v) : []); } catch { return []; } })();
        const newTH = [{ amount: -tributeCost, title: tributeTitle, date: new Date().toISOString() }, ...existingTH].slice(0, 100);
        supabase.from('tasks').update({ 'Tribute History': newTH }).eq('member_id', profileUuid).then(() => {});

        await DbService.awardPoints(profileUuid, meritGain);

        const msgText = `TRIBUTE PURCHASED: ${tributeTitle} (-${tributeCost} <i class="fas fa-coins" style="color:#c5a059;"></i>)`;

        // System chat message - use email for member_id (FK → profiles.member_id)
        try {
            await supabase.from('chats').insert({
                member_id: realEmail,
                sender_email: 'system',
                content: msgText,
                type: 'system',
                metadata: { isQueen: false }
            });
        } catch (_) {}

        // Insert wishlist-type record so the Updates feed picks it up
        let tributeImage: string | null = null;
        try {
            // Fetch item image from Wishlist table — try by ID first, then by Title
            let tributeRow: any = null;
            if (tributeId) {
                const { data: r1 } = await supabase.from('Wishlist').select('Image').eq('ID', tributeId).maybeSingle();
                tributeRow = r1;
                if (!tributeRow) {
                    const { data: r2 } = await supabase.from('Wishlist').select('Image').eq('Title', tributeId).maybeSingle();
                    tributeRow = r2;
                }
            }
            if (!tributeRow && tributeTitle) {
                const { data: r3 } = await supabase.from('Wishlist').select('Image').eq('Title', tributeTitle).maybeSingle();
                tributeRow = r3;
            }
            let rawImg = tributeRow?.Image || '';
            if (rawImg.startsWith('wix:image://v1/')) {
                const wixId = rawImg.split('/')[3].split('~')[0];
                rawImg = `https://static.wixstatic.com/media/${wixId}`;
            }
            tributeImage = rawImg || null;
            console.log('[tributes/purchase] tributeId:', tributeId, '| tributeTitle:', tributeTitle, '| image:', tributeImage ? 'found' : 'MISSING');
            await supabase.from('chats').insert({
                member_id: realEmail,
                sender_email: realEmail,
                content: `Purchased "${tributeTitle}"`,
                type: 'wishlist',
                metadata: { title: tributeTitle, price: tributeCost, image: tributeImage },
            });
        } catch (_) {}

        // Post gift card to global chat so everyone sees it
        try {
            const senderName = (profile as any).name || realEmail.split('@')[0];
            const senderAvatar = (profile as any).avatar_url || null;
            await supabase.from('global_messages').insert({
                sender_email: realEmail,
                sender_name: senderName,
                sender_avatar: senderAvatar,
                message: `UPDATE_TRIBUTE_CARD::${JSON.stringify({
                    title: tributeTitle,
                    price: tributeCost,
                    image: tributeImage,
                    senderName,
                    senderAvatar,
                })}`,
            });
        } catch (_) {}

        // Discord notification
        const senderNameFinal = (profile as any).name || realEmail.split('@')[0];
        discordWishlistPurchase(senderNameFinal, tributeTitle, tributeCost, tributeImage).catch(() => {});

        return NextResponse.json({ success: true, newWallet, newScore, meritGained: meritGain, message: `Tribute "${tributeTitle}" purchased successfully.` });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
