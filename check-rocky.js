require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const { data: profiles } = await sb.from('profiles').select('ID, member_id, name, wallet, parameters').ilike('name', '%rocky%');
    console.log('PROFILE:', JSON.stringify(profiles, null, 2));

    if (!profiles || profiles.length === 0) {
        console.log('No profile found — trying member_id search...');
        const { data: p2 } = await sb.from('profiles').select('ID, member_id, name, wallet, parameters').ilike('member_id', '%rocky%');
        console.log('BY EMAIL:', JSON.stringify(p2, null, 2));
        return;
    }

    const email = profiles[0].member_id;
    console.log('\n--- VAULT SESSIONS for', email, '---');
    const { data: sessions } = await sb.from('vault_sessions').select('*').ilike('member_id', email).order('created_at', { ascending: false });
    console.log(JSON.stringify(sessions, null, 2));
}
run().catch(console.error);
