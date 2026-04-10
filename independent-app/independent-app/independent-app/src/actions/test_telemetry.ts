import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function testTelemetry() {
    const userId = 'pr.finsko@gmail.com'; // Test user email

    const clientData = {
        device: {
            type: "Desktop",
            os: "macOS",
            browser: "Chrome",
            resolution: "1920x1080",
            is_pwa: false,
            battery: { level: 85, charging: true }
        },
        timezone: "Europe/London",
    };

    const trackingData = {
        ...clientData,
        network: {
            ip: "127.0.0.1",
            location: { city: "London", country: "United Kingdom", lat: "51.5074", lng: "-0.1278" }
        },
        last_ping: new Date().toISOString()
    };

    console.log('--- Testing Telemetry Update ---');
    console.log('Updating user:', userId);

    const { data: profile, error: fetchError } = await supabaseAdmin
        .from('profiles')
        .select('id, member_id')
        .eq('member_id', userId)
        .maybeSingle();

    if (fetchError || !profile) {
        console.error('User not found or fetch error:', fetchError);
        return;
    }

    console.log('Found user ID:', profile.id);

    const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ tracking_data: trackingData })
        .eq('id', profile.id);

    if (updateError) {
        if (updateError.message.includes('column "tracking_data" of relation "profiles" does not exist')) {
            console.error('ERROR: Database column "tracking_data" is missing. Please run the SQL command provided.');
        } else {
            console.error('Update Error:', updateError);
        }
    } else {
        console.log('SUCCESS: Telemetry data saved successfully.');

        // Final verify
        const { data: updated, error: verifyError } = await supabaseAdmin
            .from('profiles')
            .select('tracking_data')
            .eq('id', profile.id)
            .single();

        if (verifyError) {
            console.error('Verify Error:', verifyError);
        } else {
            console.log('Retrieved Data:', JSON.stringify(updated.tracking_data, null, 2));
        }
    }
}

testTelemetry();
