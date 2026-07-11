import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { DbService } from '@/lib/supabase-service';
import { discordVaultLock } from '@/lib/discord';

export const dynamic = 'force-dynamic';

const LOCK_TIERS: Record<string, { days: number; coins: number; label: string; eurPrice: number }> = {
    '7':  { days: 7,  coins: 5500,  label: '7 Days',  eurPrice: 55  },
    '30': { days: 30, coins: 15000, label: '30 Days', eurPrice: 150 },
    '90': { days: 90, coins: 30000, label: '90 Days', eurPrice: 300 },
};

// POST /api/vault/apply
// Actions: apply (with coins), apply-instant (lock now + video), apply-keyholder (already paid EUR)
export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { action, duration, message: userMessage, requestedStart } = await req.json();
        const email = (user.email || (user.user_metadata?.provider_id
            ? `twitter_${user.user_metadata.provider_id}` : user.id)).toLowerCase();

        // Get profile — multiple fallback strategies
        let profile: any = null;
        const selectCols = 'ID, wallet, parameters, name, member_id, avatar_url, profile_picture_url';

        // Strategy 1: UUID match
        const { data: byId, error: errById } = await supabaseAdmin
            .from('profiles').select(selectCols).eq('ID', user.id).maybeSingle();
        if (errById) console.error('[VAULT APPLY] byId error:', errById.message, errById.code);
        profile = byId;

        // Strategy 2: email ilike match
        if (!profile) {
            const { data: byEmail, error: errByEmail } = await supabaseAdmin
                .from('profiles').select(selectCols).ilike('member_id', email).maybeSingle();
            if (errByEmail) console.error('[VAULT APPLY] byEmail ilike error:', errByEmail.message, errByEmail.code);
            profile = byEmail;
        }

        // Strategy 3: exact email eq match (in case ilike has issues)
        if (!profile) {
            const { data: byEmailExact, error: errExact } = await supabaseAdmin
                .from('profiles').select(selectCols).eq('member_id', email).maybeSingle();
            if (errExact) console.error('[VAULT APPLY] byEmail eq error:', errExact.message, errExact.code);
            profile = byEmailExact;
        }

        // Strategy 4: if user.email differs from computed email, try user.email directly
        if (!profile && user.email && user.email.toLowerCase() !== email) {
            const { data: byAuthEmail } = await supabaseAdmin
                .from('profiles').select(selectCols).ilike('member_id', user.email).maybeSingle();
            profile = byAuthEmail;
        }

        // Strategy 5: full-text search on member_id containing the email domain
        if (!profile && user.email) {
            const { data: byLike } = await supabaseAdmin
                .from('profiles').select(selectCols).ilike('member_id', `%${user.email.split('@')[0]}%`).limit(1).maybeSingle();
            profile = byLike;
            if (byLike) console.log('[VAULT APPLY] Found profile via fuzzy match:', byLike.member_id);
        }

        if (!profile) {
            console.error('[VAULT APPLY] ALL lookups failed. user.id:', user.id, 'email:', email, 'user.email:', user.email, 'provider:', user.app_metadata?.provider);
            const { data: sampleProfiles, error: sampleErr } = await supabaseAdmin.from('profiles').select('ID, member_id').limit(3);
            console.error('[VAULT APPLY] DB accessible?', sampleErr ? `ERROR: ${sampleErr.message}` : `YES, ${(sampleProfiles||[]).length} profiles found`);
            return NextResponse.json({
                error: 'Profile not found',
                debug: { userId: user.id, email, userEmail: user.email, provider: user.app_metadata?.provider },
            }, { status: 404 });
        }

        const memberId = (profile.member_id || email).toLowerCase();

        // Check for existing active or pending session
        const { data: existing } = await supabaseAdmin
            .from('vault_sessions')
            .select('id, status')
            .eq('member_id', memberId)
            .in('status', ['active', 'pending', 'scheduled', 'awaiting_video'])
            .maybeSingle();

        if (existing) {
            return NextResponse.json({
                error: existing.status === 'active' ? 'Already locked' : 'Lock request already pending',
                existingStatus: existing.status,
            }, { status: 409 });
        }

        const tier = LOCK_TIERS[String(duration)];
        if (!tier) return NextResponse.json({ error: 'Invalid duration' }, { status: 400 });

        // ── KEYHOLDER FLOW (already paid EUR) ──
        if (action === 'apply-keyholder') {
            const params = profile.parameters || {};
            // Verify they have a valid chastity purchase
            if (!params.chastity_tier) {
                return NextResponse.json({ error: 'No keyholder purchase found' }, { status: 400 });
            }

            const chastityDays = params.chastity_days || tier.days;

            // Create session as pending (wait for Queen) or active (instant)
            const { data: session, error } = await supabaseAdmin
                .from('vault_sessions')
                .insert({
                    member_id: memberId,
                    tier: params.chastity_tier,
                    lock_days: chastityDays,
                    status: 'pending',
                })
                .select()
                .single();

            if (error) return NextResponse.json({ error: error.message }, { status: 500 });

            // Clear the chastity purchase marker
            delete params.chastity_tier;
            delete params.chastity_days;
            delete params.chastity_started;
            delete params.chastity_expires;
            params.vault_request = { sessionId: session.id, status: 'pending', requestedAt: new Date().toISOString() };
            await supabaseAdmin.from('profiles').update({ parameters: params }).eq('ID', profile.ID);

            // Notify Queen
            _notifyQueen(profile.name || memberId, chastityDays, 'keyholder').catch(() => {});

            return NextResponse.json({ success: true, status: 'pending', sessionId: session.id });
        }

        // ── COIN PAYMENT FLOW ──
        const wallet = Number(profile.wallet || 0);
        if (wallet < tier.coins) {
            return NextResponse.json({
                error: 'Insufficient coins',
                needed: tier.coins,
                wallet,
            }, { status: 400 });
        }

        // Determine status based on action
        const isInstant = action === 'apply-instant';
        // Instant lock goes to awaiting_video — lock starts when video proof is submitted
        const status = isInstant ? 'awaiting_video' : 'pending';

        // Create vault session
        const insertPayload: any = {
            member_id: memberId,
            tier: `${tier.days}d-coins`,
            lock_days: tier.days,
            status,
            coins_paid: tier.coins,
        };
        if (userMessage) insertPayload.request_message = userMessage;
        if (requestedStart && !isInstant) insertPayload.scheduled_start = requestedStart;

        const { data: session, error } = await supabaseAdmin
            .from('vault_sessions')
            .insert(insertPayload)
            .select()
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        // Deduct coins
        const newWallet = wallet - tier.coins;
        const params = profile.parameters || {};
        params.vault_request = {
            sessionId: session.id,
            status,
            requestedAt: new Date().toISOString(),
            lockDays: tier.days,
            coinsPaid: tier.coins,
            ...(requestedStart && !isInstant ? { requestedStart } : {}),
        };

        // Add to purchase history
        const purchaseHistory: any[] = params.purchaseHistory || [];
        purchaseHistory.unshift({
            type: isInstant ? 'VAULT_LOCK_INSTANT' : 'VAULT_LOCK_REQUEST',
            amount: tier.coins,
            days: tier.days,
            timestamp: new Date().toISOString(),
            sessionId: session.id,
        });
        if (purchaseHistory.length > 100) purchaseHistory.splice(100);
        params.purchaseHistory = purchaseHistory;

        await supabaseAdmin.from('profiles').update({ wallet: newWallet, parameters: params }).eq('ID', profile.ID);

        // System message
        try {
            await DbService.sendMessage(memberId,
                isInstant
                    ? `KEYHOLDER LOCK — ${tier.days} day sentence. ${tier.coins.toLocaleString()} coins charged. Submit your verification video to activate.`
                    : `KEYHOLDER LOCK REQUESTED — ${tier.days} days. ${tier.coins.toLocaleString()} coins held. Waiting for Queen Karin's approval.`,
                'system');
        } catch (_) {}

        // Notify Queen
        _notifyQueen(profile.name || memberId, tier.days, isInstant ? 'instant' : 'request').catch(() => {});

        // Global chat card + Discord
        const memberName = profile.name || memberId.split('@')[0];
        const rawPic = profile.avatar_url || profile.profile_picture_url || '';
        const memberPhoto = (rawPic && rawPic.length > 5) ? rawPic : null;
        const cardData = { name: memberName, photo: memberPhoto, days: tier.days, type: isInstant ? 'instant' : 'request' };
        try { await supabaseAdmin.from('global_messages').insert({ sender_email: 'system', sender_name: 'SYSTEM', sender_avatar: null, message: `VAULT_LOCK_CARD::${JSON.stringify(cardData)}` }); } catch (_) {}
        discordVaultLock(memberName, tier.days, isInstant ? 'instant' : 'request').catch(() => {});

        return NextResponse.json({
            success: true,
            status,
            sessionId: session.id,
            newWallet,
            lockDays: tier.days,
        });
    } catch (err: any) {
        console.error('[VAULT APPLY] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// GET /api/vault/apply — check current vault request status
export async function GET(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const email = (user.email || (user.user_metadata?.provider_id
            ? `twitter_${user.user_metadata.provider_id}` : user.id)).toLowerCase();

        // Look up profile to get member_id — try UUID first, fall back to email
        let getProfile: any = null;
        const { data: gById, error: gErrId } = await supabaseAdmin.from('profiles').select('member_id').eq('ID', user.id).maybeSingle();
        if (gErrId) console.error('[VAULT APPLY GET] byId error:', gErrId.message);
        getProfile = gById;
        if (!getProfile) {
            const { data: gByIdLower } = await supabaseAdmin.from('profiles').select('member_id').eq('id', user.id).maybeSingle();
            getProfile = gByIdLower;
        }
        if (!getProfile) {
            const { data: gByEmail } = await supabaseAdmin.from('profiles').select('member_id').ilike('member_id', email).maybeSingle();
            getProfile = gByEmail;
        }

        const memberId = (getProfile?.member_id || email).toLowerCase();

        const { data: session } = await supabaseAdmin
            .from('vault_sessions')
            .select('*')
            .ilike('member_id', memberId)
            .in('status', ['active', 'pending', 'scheduled', 'awaiting_video'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (!session) return NextResponse.json({ active: false });

        return NextResponse.json({
            active: true,
            status: session.status,
            sessionId: session.id,
            lockDays: session.lock_days,
            tier: session.tier,
            scheduledStart: session.scheduled_start || null,
            coinsPaid: session.coins_paid || 0,
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

async function _notifyQueen(name: string, days: number, type: string) {
    const titles: Record<string, string> = {
        request: 'Lock Request',
        instant: 'INSTANT LOCK',
        keyholder: 'Keyholder Lock',
    };
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://throne.qkarin.com';
    await fetch(`${baseUrl}/api/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            externalId: 'ceo@qkarin.com',
            title: titles[type] || 'Vault',
            message: `${name} wants ${days} days. ${type === 'instant' ? 'Self-locked — needs video.' : 'Awaiting your approval.'}`,
        }),
    });
}
