
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Admin (Service Role)
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

// Force dynamic (serverless function)
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
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
            // A. COIN PURCHASE & TRIBUTE ACTIVATION
            // ====================================================
            if (metadata.type === 'ENTRANCE_TRIBUTE') {
                const userId = metadata.userId;
                const userEmail = metadata.email;
                console.log(`📜 Initializing Account for: ${userEmail}`);

                // Create the profile from scratch
                await supabaseAdmin
                    .from('profiles')
                    .insert({
                        id: userId,
                        member_id: userEmail,
                        name: userEmail.split('@')[0],
                        hierarchy: 'Hall Boy',
                        score: 0,
                        wallet: 0,
                        parameters: { devotion: 100 }
                    });

                console.log(`✅ Account Created as Hall Boy.`);
            } else if (metadata.coinsToAdd) {
                const coins = parseInt(metadata.coinsToAdd, 10);
                const userEmail = metadata.wixUserEmail;
                const userId = metadata.wixUserId; // Passed from stripepay.js

                console.log(`💰 Processing Coins: ${coins} for ${userEmail || userId}`);

                // Find Profile
                let query = supabaseAdmin.from('profiles').select('*');
                if (userId) {
                    query = query.eq('member_id', userId); // OR 'id' if you used UUID
                } else if (userEmail) {
                    // Fallback for legacy calls using email
                    query = query.eq('member_id', userEmail);
                }

                const { data: profiles, error } = await query.single();

                if (profiles) {
                    const currentWallet = profiles.wallet || 0;
                    const newBalance = currentWallet + coins;

                    await supabaseAdmin
                        .from('profiles')
                        .update({ wallet: newBalance })
                        .eq('id', profiles.id);

                    console.log(`✅ Wallet Updated: ${newBalance}`);
                } else {
                    console.error(`❌ User not found for coin deposit: ${userEmail || userId}`);
                }
            }

            // ====================================================
            // B. SUBSCRIPTION
            // Metadata: type="SUBSCRIPTION_55" OR mode="subscription"
            // ====================================================
            if (session.mode === 'subscription' || metadata.type === "SUBSCRIPTION_55") {
                const subEmail = session.customer_details?.email || metadata.email;
                console.log(`💎 Processing Subscription for: ${subEmail}`);

                // Try to find profile by email (member_id is often email in this legacy system)
                // If profiles uses UUIDs, we might need to lookup by email in auth.users first, 
                // but since we don't have access to auth.users easily without specific admin rights, 
                // we assume member_id might match email OR we search parameters->email if we stored it?
                // The schema says member_id TEXT UNIQUE.

                const { data: profile } = await supabaseAdmin
                    .from('profiles')
                    .select('*')
                    .eq('member_id', subEmail)
                    .single();

                if (profile) {
                    // Update existing user
                    const params = profile.parameters || {};
                    params.subscriptionStatus = "Active";
                    params.subscriptionDate = new Date().toISOString();
                    params.stripeSubscriptionId = session.subscription;

                    // Assign Role Logic (The Buggle Request)
                    // We map "Role" to a parameter or hierarchy change?
                    // Snippet assigned role "65566...". We'll mark it in params.
                    params.roles = params.roles || [];
                    if (!params.roles.includes("subscriber_55")) {
                        params.roles.push("subscriber_55");
                    }

                    await supabaseAdmin
                        .from('profiles')
                        .update({ parameters: params })
                        .eq('id', profile.id);

                    console.log("✅ Subscription activated for existing user.");
                } else {
                    // User does not exist in Profiles?
                    // We should probably create a "Shadow" profile or just log.
                    // Velo code inserted into 'Tasks'. We can create a profile.
                    await supabaseAdmin.from('profiles').insert({
                        member_id: subEmail,
                        name: "New Subscriber",
                        wallet: 0,
                        hierarchy: "Newbie",
                        parameters: {
                            subscriptionStatus: "Active",
                            subscriptionDate: new Date().toISOString(),
                            stripeSubscriptionId: session.subscription,
                            roles: ["subscriber_55"]
                        }
                    });
                    console.log("✅ New Subscriber Profile created.");
                }
            }

        } catch (err: any) {
            console.error("❌ Webhook Handling Error:", err);
            return new NextResponse(`Webhook Handler Error: ${err.message}`, { status: 500 });
        }
    }

    return new NextResponse(null, { status: 200 });
}
