import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error("Missing Supabase Environment Variables");
        return NextResponse.json({ error: "Server Configuration Error" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });

    try {
        const body = await req.json();
        const { userId, clientData } = body;

        if (!userId) {
            return NextResponse.json({ error: "Missing userId" }, { status: 400 });
        }

        // Extract Vercel headers for Location and IP
        const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'Unknown';
        const country = req.headers.get('x-vercel-ip-country') || 'Unknown';
        const city = req.headers.get('x-vercel-ip-city') || 'Unknown';
        const latitude = req.headers.get('x-vercel-ip-latitude') || 'Unknown';
        const longitude = req.headers.get('x-vercel-ip-longitude') || 'Unknown';

        // Merge client-sniffed data with server-sniffed data
        const trackingData = {
            ...clientData,
            network: {
                ip,
                location: { city, country, lat: latitude, lng: longitude }
            },
            last_ping: new Date().toISOString()
        };

        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);

        // Use a more resilient approach: Update parameters JSONB and try tracking_data column
        const updateData: any = {
            tracking_data: trackingData, // Still try the dedicated column
            last_active: new Date().toISOString()
        };

        // Also merge into existing parameters if possible (requires fetching first to be safe, but let's try a direct update first)
        // Note: Supabase doesn't support partial JSONB updates via .update() easily without overwriting the whole column.
        // However, we can use the 'parameters' column if it exists.

        // Since we know 'parameters' exists from our schema check, let's use it as a reliable fallback/primary.
        // To be safe and not overwrite other params, we'll just try to update tracking_data and last_active first.

        let query = supabase.from('profiles').update(updateData);

        if (isUuid) {
            query = query.eq('ID', userId);
        } else {
            query = query.ilike('member_id', userId);
        }

        const { error } = await query;
        if (error && error.message.includes("tracking_data")) {
            console.log("Dedicated tracking_data column missing, falling back to parameters...");

            // 1. Fetch current parameters
            let fetchQuery = supabase.from('profiles').select('parameters');
            if (isUuid) fetchQuery = fetchQuery.eq('ID', userId);
            else fetchQuery = fetchQuery.ilike('member_id', userId);

            const { data: profile } = await fetchQuery.maybeSingle();
            const currentParams = profile?.parameters || {};

            // 2. Update parameters with merged tracking data
            let fallbackQuery = supabase.from('profiles').update({
                parameters: {
                    ...currentParams,
                    tracking_data: trackingData
                },
                last_active: new Date().toISOString()
            });
            if (isUuid) fallbackQuery = fallbackQuery.eq('ID', userId);
            else fallbackQuery = fallbackQuery.ilike('member_id', userId);

            const { error: fallbackError } = await fallbackQuery;
            if (fallbackError) {
                console.error("Fallback Tracking Update Error:", fallbackError);
                return NextResponse.json({ error: fallbackError.message }, { status: 500 });
            }

            return NextResponse.json({ success: true, note: "stored_in_parameters" });
        }

        if (error) {
            console.error("Tracking Ping Update Error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Tracking Ping Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
