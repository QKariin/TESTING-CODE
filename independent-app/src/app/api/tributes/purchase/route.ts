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
        const existingHistory = Array.isArray(params.tributeHistory) ? params.tributeHistory :
            (typeof params.tributeHistory === 'string' ? JSON.parse(params.tributeHistory) : []);
        const newHistory = [
            { amount: -tributeCost, message: `SACRIFICE: ${tributeTitle}`, date: new Date().toISOString(), type: 'expense' },
            ...existingHistory
        ].slice(0, 50);
        const newParams = {
            ...params,
            wishlist_spent: (Number(params.wishlist_spent) || 0) + tributeCost,
            last_tribute: { at: new Date().toISOString(), title: tributeTitle, amount: tributeCost },
            tributeHistory: newHistory,
        };

        const realEmail = profile?.member_id || memberEmail;

        const { error: updateErr } = await supabase.from('profiles').update({ wallet: newWallet, parameters: newParams }).eq('member_id', realEmail);

        if (updateErr) return NextResponse.json({ success: false, error: 'Failed to update balance' }, { status: 500 });

        // Update tasks['Tribute History'] — this is the primary source for SACRIFICE stat
        const { data: taskRow } = await supabase.from('tasks').select('"Tribute History"').ilike('member_id', realEmail).maybeSingle();
        const existingTH: any[] = (() => { try { const v = taskRow?.['Tribute History']; return Array.isArray(v) ? v : (typeof v === 'string' ? JSON.parse(v) : []); } catch { return []; } })();
        const newTH = [{ amount: -tributeCost, title: tributeTitle, date: new Date().toISOString() }, ...existingTH].slice(0, 100);
        supabase.from('tasks').update({ 'Tribute History': newTH }).ilike('member_id', realEmail).then(() => {});

        await DbService.awardPoints(realEmail, meritGain);

        supabase.from('profiles').update({
            last_tribute_at: new Date().toISOString(),
            last_tribute_title: tributeTitle,
        }).eq('member_id', realEmail).then(({ error: tsErr }: { error: any }) => {
            if (tsErr) console.warn('[Purchase] col not found:', tsErr.message);
        });

        const msgText = `TRIBUTE PURCHASED: ${tributeTitle} (-${tributeCost} <i class="fas fa-coins" style="color:#c5a059;"></i>)`;
        
        // System message insertion resilient to schema
        const insertData: any = { sender_email: 'system', sender_name: 'SYSTEM', message: msgText, member_id: realEmail };
        // Removed profile_id logic to synchronize with live database schema constraint
        
        try { 
            const ins1 = await supabase.from('chats').insert(insertData);
            if (ins1.error && (ins1.error.message.includes('sender_email') || ins1.error.message.includes('member_id'))) {
                delete insertData.sender_email; 
                delete insertData.member_id;
                await supabase.from('chats').insert(insertData);
            }
        } catch (_) {}

        return NextResponse.json({ success: true, newWallet, newScore, meritGained: meritGain, message: `Tribute "${tributeTitle}" purchased successfully.` });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
