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
        let query = supabase.from('profiles').update({ tracking_data: trackingData });

        if (isUuid) {
            query = query.or(`id.eq.${userId},member_id.eq.${userId}`);
        } else {
            query = query.eq('member_id', userId);
        }

        const { error } = await query;

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
