import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase';
import { DbService } from '@/lib/supabase-service';

// 9 card types for the risky game
const RISKY_CARDS = [
    { name: 'JACKPOT',          icon: '/card-jackpot.svg',       lossPct: 0, isDouble: true },
    { name: 'MY LUCKY BITCH',   icon: '/card-myluckybitch.svg',  lossPct: 0 },
    { name: 'LOW CARD',         icon: '/card-lowcard.svg',       lossPct: 0.25 },
    { name: 'CLOSE CALL',       icon: '/card-badhand.svg',       lossPct: 0.25 },
    { name: 'WILD CARD',        icon: '/card-wildcard.svg',      lossPct: 0.5 },
    { name: 'HIGH STAKES',      icon: '/card-highstakes.svg',    lossPct: 0.5 },
    { name: 'SHARK BITE',       icon: '/card-sharkbite.svg',     lossPct: 0.75 },
    { name: 'DEAD MAN\'S HAND', icon: '/card-deadmanshand.svg',  lossPct: 0.75 },
    { name: 'QUEEN TAKES ALL',  icon: '/card-queentakesall.svg', lossPct: 1.0 },
];

function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

const VALID_AMOUNTS = [500, 1000, 2000, 5000, 10000, 20000];
const VALID_PERCENTS = [10, 25, 50, 75, 100];

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { memberEmail, type } = body;

        if (!memberEmail || !type) {
            return NextResponse.json({ success: false, error: 'Missing parameters' }, { status: 400 });
        }

        // Fetch profile
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memberEmail);
        const q = isUUID
            ? supabase.from('profiles').select('wallet, score, parameters, member_id, ID, name').eq('ID', memberEmail).single()
            : supabase.from('profiles').select('wallet, score, parameters, member_id, ID, name').ilike('member_id', memberEmail).single();
        const { data: profile, error: profileErr } = await q;

        if (profileErr || !profile) {
            return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 });
        }

        const wallet = profile.wallet || 0;
        const realEmail = profile.member_id || memberEmail;
        const senderName = (profile as any).name || realEmail.split('@')[0];
        const profileId = profile.ID;

        // ═══════════════════════════════════════════════════════════
        // DIRECT SEND
        // ═══════════════════════════════════════════════════════════
        if (type === 'direct') {
            const amount = Number(body.amount);
            if (!VALID_AMOUNTS.includes(amount)) {
                return NextResponse.json({ success: false, error: 'Invalid amount' }, { status: 400 });
            }
            if (wallet < amount) {
                return NextResponse.json({ success: false, error: 'INSUFFICIENT_FUNDS' }, { status: 400 });
            }

            const newWallet = wallet - amount;
            const merit = Math.floor(amount / 2);

            await supabase.from('profiles').update({ wallet: newWallet }).eq('ID', profileId);
            await DbService.awardPoints(profileId, merit);

            // Post to global chat
            try {
                await supabase.from('global_messages').insert({
                    sender_email: realEmail,
                    sender_name: senderName,
                    sender_avatar: null,
                    message: `DIRECT_TRIBUTE_CARD::${JSON.stringify({ senderName, amount })}`,
                });
            } catch (_) {}

            // Post to private chat
            try {
                await supabase.from('chats').insert({
                    member_id: realEmail,
                    sender_email: realEmail,
                    content: `DIRECT_TRIBUTE_CARD::${JSON.stringify({ senderName, amount })}`,
                    type: 'tribute',
                    metadata: { senderName, amount },
                });
            } catch (_) {}

            return NextResponse.json({ success: true, newWallet, meritGained: merit });
        }

        // ═══════════════════════════════════════════════════════════
        // RISKY SEND
        // ═══════════════════════════════════════════════════════════
        if (type === 'risky') {
            const stakePercent = Number(body.stakePercent);
            const cardIndex = Number(body.cardIndex);

            if (!VALID_PERCENTS.includes(stakePercent) || cardIndex < 0 || cardIndex > 8) {
                return NextResponse.json({ success: false, error: 'Invalid parameters' }, { status: 400 });
            }

            const stake = Math.floor(wallet * stakePercent / 100);
            if (stake <= 0) {
                return NextResponse.json({ success: false, error: 'INSUFFICIENT_FUNDS' }, { status: 400 });
            }

            // Shuffle cards and determine outcome
            const shuffled = shuffle(RISKY_CARDS);
            const resultCard = shuffled[cardIndex];

            let lossAmount = 0;
            let bonusAmount = 0;
            let cardName = resultCard.name;
            let cardIcon = resultCard.icon;

            if (resultCard.isDouble && stake < 2000) {
                // JACKPOT: they win bonus coins equal to stake
                bonusAmount = stake;
                lossAmount = 0;
            } else if (resultCard.isDouble && stake >= 2000) {
                // High-stakes JACKPOT becomes MY LUCKY BITCH
                cardName = 'MY LUCKY BITCH';
                cardIcon = '/card-myluckybitch.svg';
                lossAmount = 0;
            } else {
                lossAmount = Math.floor(stake * resultCard.lossPct);
            }

            const newWallet = wallet - lossAmount + bonusAmount;
            const merit = Math.floor(lossAmount / 2);

            await supabase.from('profiles').update({ wallet: newWallet }).eq('ID', profileId);
            if (merit > 0) await DbService.awardPoints(profileId, merit);

            // Build all 9 cards for client animation
            const allCards = shuffled.map((c, i) => {
                // For the user's chosen card, apply JACKPOT→MY LUCKY BITCH override
                if (i === cardIndex && c.isDouble && stake >= 2000) {
                    return { name: 'MY LUCKY BITCH', icon: '/card-myluckybitch.svg', lossPct: 0 };
                }
                return { name: c.name, icon: c.icon, lossPct: c.lossPct };
            });

            // Post to global chat
            try {
                const isWin = cardName === 'JACKPOT' && bonusAmount > 0;
                const riskyPayload = {
                    senderName,
                    stakeAmount: stake,
                    cardName,
                    icon: cardIcon,
                    lostAmount: lossAmount,
                    wonAmount: bonusAmount,
                    isWin,
                };
                await supabase.from('global_messages').insert({
                    sender_email: realEmail,
                    sender_name: senderName,
                    sender_avatar: null,
                    message: `RISKY_TRIBUTE_CARD::${JSON.stringify(riskyPayload)}`,
                });
            } catch (_) {}

            // Post to private chat
            try {
                const isWin = cardName === 'JACKPOT' && bonusAmount > 0;
                await supabase.from('chats').insert({
                    member_id: realEmail,
                    sender_email: realEmail,
                    content: `RISKY_TRIBUTE_CARD::${JSON.stringify({
                        senderName,
                        stakeAmount: stake,
                        cardName,
                        icon: cardIcon,
                        lostAmount: lossAmount,
                        wonAmount: bonusAmount,
                        isWin,
                    })}`,
                    type: 'tribute',
                    metadata: { senderName, stakeAmount: stake, cardName, lostAmount: lossAmount, wonAmount: bonusAmount, isWin },
                });
            } catch (_) {}

            return NextResponse.json({
                success: true,
                allCards,
                resultIndex: cardIndex,
                cardName,
                cardIcon,
                lossAmount,
                bonusAmount,
                stake,
                newWallet,
                meritGained: merit,
            });
        }

        return NextResponse.json({ success: false, error: 'Invalid type' }, { status: 400 });
    } catch (err: any) {
        console.error('[TRIBUTE/DIRECT]', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
