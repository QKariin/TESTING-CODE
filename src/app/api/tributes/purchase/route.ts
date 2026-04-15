import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase';
import { DbService } from '@/lib/supabase-service';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { memberEmail, tributeId, tributeTitle, tributeCost } = body;

        if (!memberEmail || !tributeTitle || tributeCost === undefined) {
            return NextResponse.json({ success: false, error: 'Missing required parameters' }, { status: 400 });
        }

        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memberEmail);
        const { data: profile, error: profileErr } = await supabase
            .from('profiles')
            .select('wallet, score, parameters, member_id, id')
            .or(isUUID ? `id.eq.${memberEmail}` : `member_id.eq.${memberEmail}`)
            .single();

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

        // System chat message - use UUID for member_id
        try {
            await supabase.from('chats').insert({
                member_id: profileUuid,
                sender_email: 'system',
                content: msgText,
                type: 'system',
                metadata: { isQueen: false }
            });
        } catch (_) {}

        // Insert wishlist-type record so the Updates feed picks it up
        try {
            const { data: tributeRow } = await supabase.from('wishlist').select('image, display_url').eq('id', tributeId).maybeSingle();
            const tributeImage = (tributeRow as any)?.display_url || (tributeRow as any)?.image || null;
            await supabase.from('chats').insert({
                member_id: profileUuid,
                sender_email: realEmail,
                content: `Purchased "${tributeTitle}"`,
                type: 'wishlist',
                metadata: { title: tributeTitle, price: tributeCost, image: tributeImage },
            });
        } catch (_) {}

        return NextResponse.json({ success: true, newWallet, newScore, meritGained: meritGain, message: `Tribute "${tributeTitle}" purchased successfully.` });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
