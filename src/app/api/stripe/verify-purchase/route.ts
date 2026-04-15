import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
        return NextResponse.json({ error: 'Missing session_id' }, { status: 400 });
    }

    try {
        // Retrieve session from Stripe - source of truth
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (session.payment_status !== 'paid') {
            return NextResponse.json({ success: false, reason: 'not_paid' });
        }

        const metadata = session.metadata || {};
        if (!metadata.coinsToAdd) {
            return NextResponse.json({ success: false, reason: 'no_coins_in_metadata' });
        }

        const coins = parseInt(metadata.coinsToAdd, 10);
        const userEmail = metadata.email || metadata.wixUserEmail;
        const userId = metadata.userId || metadata.wixUserId;

        const supabaseAdmin = createSupabaseAdmin(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { autoRefreshToken: false, persistSession: false } }
        );

        // Find profile
        let profile: any = null;
        if (userEmail) {
            const { data } = await supabaseAdmin
                .from('profiles')
                .select('*')
                .ilike('member_id', userEmail)
                .maybeSingle();
            profile = data;
        }
        if (!profile && userId) {
            const { data } = await supabaseAdmin
                .from('profiles')
                .select('*')
                .eq('ID', userId)
                .maybeSingle();
            profile = data;
        }

        if (!profile) {
            return NextResponse.json({ success: false, reason: 'profile_not_found' });
        }

        // Idempotency check - track processed Stripe sessions in parameters
        const params = profile.parameters || {};
        const processedSessions: string[] = params.processedStripeSessions || [];
        if (processedSessions.includes(sessionId)) {
            // Already awarded - return current wallet so UI can sync
            return NextResponse.json({ success: true, alreadyAwarded: true, wallet: profile.wallet });
        }

        // Award coins
        const newBalance = (profile.wallet || 0) + coins;
        processedSessions.push(sessionId);
        params.processedStripeSessions = processedSessions;

        // Purchase entry - used for dashboard notification + persistent history
        const purchaseEntry = {
            coins,
            name: profile.name || userEmail || userId || 'Unknown',
            memberId: profile.member_id || userEmail || '',
            timestamp: new Date().toISOString(),
            sessionId,
        };

        // Realtime notification for dashboard
        params.latestPurchaseNotification = purchaseEntry;

        // Append to persistent purchase history (keep last 100)
        const purchaseHistory: any[] = params.purchaseHistory || [];
        purchaseHistory.unshift(purchaseEntry);
        if (purchaseHistory.length > 100) purchaseHistory.splice(100);
        params.purchaseHistory = purchaseHistory;

        await supabaseAdmin
            .from('profiles')
            .update({ wallet: newBalance, parameters: params })
            .eq('ID', profile.ID);

        console.log(`✅ [verify-purchase] Awarded ${coins} coins to ${userEmail || userId}. New balance: ${newBalance}`);

        return NextResponse.json({ success: true, alreadyAwarded: false, coinsAwarded: coins, wallet: newBalance });

    } catch (err: any) {
        console.error('[verify-purchase] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
