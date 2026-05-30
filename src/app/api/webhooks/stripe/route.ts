
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createClient } from '@supabase/supabase-js';
import { discordNewMember } from '@/lib/discord';

// Initialize Supabase Admin (Service Role) dynamically inside the route handler

// Force dynamic (serverless function)
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    );

    const body = await req.text();
    const signature = (await headers()).get('Stripe-Signature') as string;

    let event;

    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET!
        );
    } catch (error: any) {
        console.error(`Webhook Signature Error: ${error.message}`);
        return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 });
    }

    // Handle the event
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as any;
        const metadata = session.metadata || {};

        try {
            // ====================================================
            // 0. APPLICATION FEE
            // ====================================================
            if (metadata.type === 'APPLICATION_FEE') {
                const { applicationId, email } = metadata;
                if (applicationId) {
                    await supabaseAdmin.from('applications').update({
                        payment_status: 'paid',
                        payment_amount: session.amount_total || 9500,
                        stripe_session_id: session.id,
                        status: 'pending',
                    }).eq('id', applicationId);
                    console.log(`[WEBHOOK] Application fee paid for ${email} - app ${applicationId}`);
                }
            }

            // ====================================================
            // A. COIN PURCHASE & TRIBUTE ACTIVATION
            // ====================================================
            if (metadata.type === 'ENTRANCE_TRIBUTE') {
                const userId = metadata.userId;
                const userEmail = metadata.email;
                const userName = metadata.name || userEmail.split('@')[0];
                console.log(`[TRIBUTE] Initializing Account for: ${userEmail} (${userName})`);

                // Create the profile from scratch
                await supabaseAdmin
                    .from('profiles')
                    .insert({
                        ID: userId,
                        member_id: userEmail,
                        name: userName,
                        hierarchy: 'Hall Boy',
                        score: 0,
                        wallet: 4999,
                        parameters: { devotion: 100, promo72h: true }
                    });

                // Create tasks row so task assignment works immediately
                await supabaseAdmin
                    .from('tasks')
                    .insert({
                        ID: userId,
                        member_id: userEmail,
                        Name: userName,
                        Status: 'idle',
                        Taskdom_History: '[]',
                        taskdom_active_task: null,
                        taskdom_pending_state: null,
                    });

                console.log(`[TRIBUTE] Account Created as Hall Boy.`);

                // ── Welcome Card in Global Chat ──
                try {
                    await supabaseAdmin.from('global_messages').insert({
                        sender_email: 'system@qkarin.com',
                        sender_name: 'System',
                        sender_avatar: null,
                        message: `WELCOME_CARD::${JSON.stringify({
                            name: userName,
                            rank: 'Hall Boy',
                            coins: 4999,
                        })}`,
                    });
                    console.log(`[TRIBUTE] Welcome card posted for ${userName}`);
                } catch (e: any) {
                    console.error('[TRIBUTE] Welcome card error:', e.message);
                }

                // ── Push Notification to Queen ──
                try {
                    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://throne.qkarin.com';
                    await fetch(`${baseUrl}/api/push`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            externalId: 'ceo@qkarin.com',
                            title: 'New Tribute Received',
                            message: `${userName} just entered the court as Hall Boy — 4,999 coins deposited.`,
                        }),
                    });
                    console.log(`[TRIBUTE] Push notification sent to Queen`);
                } catch (e: any) {
                    console.error('[TRIBUTE] Push notification error:', e.message);
                }

                // Discord notification
                discordNewMember(userName).catch(() => {});

            } else if (metadata.coinsToAdd) {
                const coins = parseInt(metadata.coinsToAdd, 10);
                // Support both new metadata keys (email/userId) and legacy Wix keys
                const userEmail = metadata.email || metadata.wixUserEmail;
                const userId = metadata.userId || metadata.wixUserId;

                console.log(`[COINS] Processing: ${coins} for ${userEmail || userId}`);

                // Find Profile - try email first (ilike for case-insensitivity), fallback to id
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

                if (profile) {
                    const newBalance = (profile.wallet || 0) + coins;
                    const profileParams = profile.parameters || {};
                    // Track processed sessions for idempotency
                    const processedSessions: string[] = profileParams.processedStripeSessions || [];
                    if (!processedSessions.includes(session.id)) {
                        processedSessions.push(session.id);
                    }
                    profileParams.processedStripeSessions = processedSessions;

                    // Purchase entry - realtime notification + persistent history
                    const purchaseEntry = {
                        coins,
                        name: profile.name || userEmail || userId || 'Unknown',
                        memberId: profile.member_id || userEmail || '',
                        timestamp: new Date().toISOString(),
                        sessionId: session.id,
                    };
                    profileParams.latestPurchaseNotification = purchaseEntry;

                    // Append to persistent purchase history (keep last 100)
                    const purchaseHistory: any[] = profileParams.purchaseHistory || [];
                    if (!purchaseHistory.some((e: any) => e.sessionId === session.id)) {
                        purchaseHistory.unshift(purchaseEntry);
                        if (purchaseHistory.length > 100) purchaseHistory.splice(100);
                    }
                    profileParams.purchaseHistory = purchaseHistory;
                    await supabaseAdmin
                        .from('profiles')
                        .update({ wallet: newBalance, parameters: profileParams })
                        .eq('ID', profile.ID);
                    console.log(`[COINS] Wallet Updated: ${newBalance} (+${coins})`);
                } else {
                    console.error(`[COINS] User not found for coin deposit: ${userEmail || userId}`);
                }
            }

            // ====================================================
            // A2. CHASTITY KEYHOLDER
            // ====================================================
            if (metadata.type === 'CHASTITY_KEYHOLDER') {
                const userId = metadata.userId;
                const userEmail = metadata.email;
                const userName = metadata.name || userEmail.split('@')[0];
                const tierId = metadata.tierId || 'trial';
                const days = parseInt(metadata.days || '3', 10);
                const expiresAt = new Date(Date.now() + days * 86400000).toISOString();

                console.log(`[KEYHOLDER] Processing ${tierId} (${days}d) for: ${userEmail}`);

                // Check if profile already exists
                const { data: existing } = await supabaseAdmin
                    .from('profiles')
                    .select('ID, parameters')
                    .or(`ID.eq.${userId}${userEmail ? `,member_id.ilike.${userEmail}` : ''}`)
                    .maybeSingle();

                if (existing) {
                    // Update existing profile with keyholder info
                    const params = existing.parameters || {};
                    params.source = 'chastity';
                    params.chastity_tier = tierId;
                    params.chastity_days = days;
                    params.chastity_started = new Date().toISOString();
                    params.chastity_expires = expiresAt;
                    await supabaseAdmin
                        .from('profiles')
                        .update({ parameters: params })
                        .eq('ID', existing.ID);
                    console.log(`[KEYHOLDER] Updated existing profile for ${userEmail}`);
                } else {
                    // Create new profile
                    await supabaseAdmin
                        .from('profiles')
                        .insert({
                            ID: userId,
                            member_id: userEmail,
                            name: userName,
                            hierarchy: 'Chastity Sub',
                            score: 0,
                            wallet: 0,
                            parameters: {
                                source: 'chastity',
                                chastity_tier: tierId,
                                chastity_days: days,
                                chastity_started: new Date().toISOString(),
                                chastity_expires: expiresAt,
                            }
                        });

                    // Create tasks row
                    await supabaseAdmin
                        .from('tasks')
                        .insert({
                            ID: userId,
                            member_id: userEmail,
                            Name: userName,
                            Status: 'idle',
                            Taskdom_History: '[]',
                            taskdom_active_task: null,
                            taskdom_pending_state: null,
                        });

                    console.log(`[KEYHOLDER] New chastity profile created for ${userEmail}`);
                }

                // Discord notification
                discordNewMember(`${userName} (Keyholder ${tierId})`).catch(() => {});

                // Push notification to Queen
                try {
                    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://throne.qkarin.com';
                    await fetch(`${baseUrl}/api/push`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            externalId: 'ceo@qkarin.com',
                            title: 'New Keyholder Sub',
                            message: `${userName} surrendered their key — ${tierId} (${days} days)`,
                        }),
                    });
                } catch (e: any) {
                    console.error('[KEYHOLDER] Push notification error:', e.message);
                }
            }

            // ====================================================
            // B. SUBSCRIPTION
            // Metadata: type="SUBSCRIPTION_55" OR mode="subscription"
            // ====================================================
            if (session.mode === 'subscription' || metadata.type === "SUBSCRIPTION_55" || metadata.type === "SUBSCRIPTION") {
                const subEmail = session.customer_details?.email || metadata.email;
                const tierId = metadata.tierId || 'basic'; // basic | royal | ownership
                console.log(`[SUB] Processing Subscription [${tierId}] for: ${subEmail}`);

                const { data: profile } = await supabaseAdmin
                    .from('profiles')
                    .select('*')
                    .ilike('member_id', subEmail)
                    .maybeSingle();

                if (profile) {
                    const params = profile.parameters || {};
                    params.subscriptionStatus = "Active";
                    params.subscriptionTier = tierId;
                    params.subscriptionDate = new Date().toISOString();
                    params.stripeSubscriptionId = session.subscription;

                    params.roles = params.roles || [];
                    const roleKey = `subscriber_${tierId}`;
                    if (!params.roles.includes(roleKey)) {
                        // Remove any previous subscription role before adding new one
                        params.roles = params.roles.filter((r: string) => !r.startsWith('subscriber_'));
                        params.roles.push(roleKey);
                    }

                    await supabaseAdmin
                        .from('profiles')
                        .update({ parameters: params })
                        .eq('ID', profile.ID);

                    console.log(`[SUB] Subscription [${tierId}] activated for existing user.`);
                } else {
                    const subUserId = session.client_reference_id || null;
                    await supabaseAdmin.from('profiles').insert({
                        ...(subUserId ? { ID: subUserId } : {}),
                        member_id: subEmail,
                        name: "New Subscriber",
                        wallet: 0,
                        hierarchy: "Newbie",
                        parameters: {
                            subscriptionStatus: "Active",
                            subscriptionTier: tierId,
                            subscriptionDate: new Date().toISOString(),
                            stripeSubscriptionId: session.subscription,
                            roles: [`subscriber_${tierId}`]
                        }
                    });
                    console.log(`[SUB] New Subscriber Profile created [${tierId}].`);
                }
            }

        } catch (err: any) {
            console.error("[WEBHOOK] Handling Error:", err);
            return new NextResponse(`Webhook Handler Error: ${err.message}`, { status: 500 });
        }
    }

    return new NextResponse(null, { status: 200 });
}
