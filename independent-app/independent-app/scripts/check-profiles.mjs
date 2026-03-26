import { createClient } from '@supabase/supabase-js';

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

async function checkProfiles() {
    const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('member_id, hierarchy, name');

    if (error) {
        console.error("Error fetching profiles:", error);
        return;
    }

    console.log("Found Profiles:");
    data.forEach(p => {
        console.log(`- ${p.member_id} (${p.hierarchy}) - ${p.name}`);
    });
}

checkProfiles();
