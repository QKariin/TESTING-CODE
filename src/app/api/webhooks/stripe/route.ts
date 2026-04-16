
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createClient } from '@supabase/supabase-js';

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
                    console.log(`✅ Application fee paid for ${email} - app ${applicationId}`);
                }
            }

            // ====================================================
            // A. COIN PURCHASE & TRIBUTE ACTIVATION
            // ====================================================
            if (metadata.type === 'ENTRANCE_TRIBUTE') {
                const userId = metadata.userId;
                const userEmail = metadata.email;
                const userName = metadata.name || userEmail.split('@')[0];
                console.log(`📜 Initializing Account for: ${userEmail} (${userName})`);

                // Create the profile from scratch
                await supabaseAdmin
                    .from('profiles')
                    .insert({
                        ID: userId,
                        member_id: userEmail,
                        name: userName,
                        hierarchy: 'Hall Boy',
                        score: 0,
                        wallet: 5000,
                        parameters: { devotion: 100 }
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

                console.log(`✅ Account Created as Hall Boy.`);
            } else if (metadata.coinsToAdd) {
                const coins = parseInt(metadata.coinsToAdd, 10);
                // Support both new metadata keys (email/userId) and legacy Wix keys
                const userEmail = metadata.email || metadata.wixUserEmail;
                const userId = metadata.userId || metadata.wixUserId;

                console.log(`💰 Processing Coins: ${coins} for ${userEmail || userId}`);

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
                    console.log(`✅ Wallet Updated: ${newBalance} (+${coins})`);
                } else {
                    console.error(`❌ User not found for coin deposit: ${userEmail || userId}`);
                }
            }

            // ====================================================
            // B. SUBSCRIPTION
            // Metadata: type="SUBSCRIPTION_55" OR mode="subscription"
            // ====================================================
            if (session.mode === 'subscription' || metadata.type === "SUBSCRIPTION_55" || metadata.type === "SUBSCRIPTION") {
                const subEmail = session.customer_details?.email || metadata.email;
                const tierId = metadata.tierId || 'basic'; // basic | royal | ownership
                console.log(`💎 Processing Subscription [${tierId}] for: ${subEmail}`);

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

                    console.log(`✅ Subscription [${tierId}] activated for existing user.`);
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
                    console.log(`✅ New Subscriber Profile created [${tierId}].`);
                }
            }

        } catch (err: any) {
            console.error("❌ Webhook Handling Error:", err);
            return new NextResponse(`Webhook Handler Error: ${err.message}`, { status: 500 });
        }
    }

    return new NextResponse(null, { status: 200 });
}
